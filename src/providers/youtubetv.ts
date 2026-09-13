// YouTube TV (D002). The tune polls, quality ladder and park URL are unchanged
// from task-019.
//
// Task-022 (D020): a channel is keyed on its guide row's stationId, read from
// the guide page's own /youtubei/v1/browse response. The watch id is what
// rotates (notebook/reports/recon-stable-ids.md), so it is carried as the
// thing to play and refreshed from the guide when a tune cannot load it.

import { evalIn, navigateAndSettle, sleep, type Cdp, type Session } from "../cdp.js";
import type { Channel, Enumerated, Provider, QualityResult, Skipped, TuneCtx } from "./types.js";

const HOST = "tv.youtube.com";
/** Where the capture tab parks after an idle stop: the YouTube TV live
 *  guide, logged in, with no channel playing (task-018). */
const GUIDE_URL = "https://tv.youtube.com/live";

/** The guide's own request for its rows. recon-stable-ids step 2: one
 *  /youtubei/v1/browse response carries every row under
 *  contents.epgRenderer.paginationRenderer.epgPaginationRenderer.contents. */
const GUIDE_API_PATH = "/youtubei/v1/browse";
const GUIDE_API_TIMEOUT_MS = 30000;

/** The signed-out marker for this provider: the guide chrome renders a
 *  "SIGN IN" call to action when the session is gone (task-002). */
const SIGNED_OUT_TEST = `/SIGN IN/i.test((document.body && document.body.innerText) || "")`;

/** One row of the guide response, reduced to what identifies it. */
type GuideRow = {
  position: number;
  stationId: string | null;
  watchId: string | null;
  label: string | null;
  discrete: boolean;
};

/** The rows of a /youtubei/v1/browse body, or null if this body is not the
 *  guide (the page issues several browse requests; only one has epgRenderer). */
function parseGuide(text: string): GuideRow[] | null {
  let j: any;
  try { j = JSON.parse(text.startsWith(")]}'") ? text.slice(4) : text); } catch { return null; }
  const rows = j?.contents?.epgRenderer?.paginationRenderer?.epgPaginationRenderer?.contents;
  if (!Array.isArray(rows)) return null;
  return rows.map((r: any, position: number) => {
    const e = r?.epgRowRenderer ?? {};
    const s = e.station?.epgStationRenderer ?? {};
    return {
      position,
      stationId: e.stationId ?? s.stationId ?? null,
      watchId: e.navigationEndpoint?.watchEndpoint?.videoId ?? null,
      label: s.icon?.accessibility?.accessibilityData?.label ?? null,
      discrete: s.isDiscreteStation === true,
    };
  });
}

type Tile = { id: string; name: string; logo: string | null; href: string };

/** The guide's rendered tiles: name, watch href and logo, exactly as the
 *  pre-task-022 enumerator read them (logo source unchanged). */
async function readTiles(cdp: Cdp, session: Session): Promise<Tile[]> {
  // Give the grid a chance to fill in; bail out as soon as it stops growing.
  let last = -1;
  for (let i = 0; i < 12; i++) {
    const n = await evalIn<number>(cdp, session,
      `document.querySelectorAll("ytu-endpoint.tenx-thumb[aria-label]").length`);
    if (n > 0 && n === last) break;
    last = n;
    await sleep(1500);
  }

  return evalIn<Tile[]>(cdp, session, `(() => {
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll("ytu-endpoint.tenx-thumb[aria-label]")) {
      const name = (el.getAttribute("aria-label") || "").replace(/^watch /i, "").trim();
      const a = el.querySelector("a[href]");
      if (!name || !a) continue;
      const href = a.getAttribute("href");
      const m = href && href.match(/watch\\/([^?&#]+)/);
      if (!m) continue;
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      // The first <img> is often a 1x1 data: placeholder until the row is
      // lazily loaded, so take the first real URL and normalise the
      // protocol-relative "//host/..." the guide emits.
      let logo = null;
      for (const img of el.querySelectorAll("img")) {
        const src = img.getAttribute("src") || "";
        if (src && !src.startsWith("data:")) { logo = src.startsWith("//") ? "https:" + src : src; break; }
      }
      if (!logo) {
        const thumb = el.querySelector("ytu-thumbnail[src]");
        const raw = thumb && thumb.getAttribute("src");
        if (raw) {
          try {
            const u = JSON.parse(raw).thumbnails?.[0]?.url;
            if (u) logo = u.startsWith("//") ? "https:" + u : u;
          } catch (e) { /* not JSON, leave null */ }
        }
      }
      out.push({ id, name, logo, href });
    }
    return out;
  })()`);
}

/** Load the live guide in this tab and read it: rows (and their stationIds)
 *  from the page's own /youtubei/v1/browse response, name/href/logo from the
 *  rendered tiles, joined on the watch id. Read-only — nothing is replayed.
 *  Used by enumeration and by the one tune-time re-read. */
async function readGuide(cdp: Cdp, session: Session): Promise<Enumerated> {
  const requests = new Set<string>();
  const bodies: Promise<GuideRow[] | null>[] = [];
  const onResponse = (p: any, sid?: string) => {
    if (sid !== session) return;
    try { if (new URL(p.response.url).pathname === GUIDE_API_PATH) requests.add(p.requestId); } catch { /* not a URL */ }
  };
  const onFinished = (p: any, sid?: string) => {
    if (sid !== session || !requests.has(p.requestId)) return;
    requests.delete(p.requestId);
    bodies.push(cdp.send<any>("Network.getResponseBody", { requestId: p.requestId }, session)
      .then((b) => parseGuide(b.base64Encoded ? Buffer.from(b.body, "base64").toString("utf8") : b.body))
      .catch(() => null));
  };

  // Declared, not inferred: TypeScript does not carry assignments made inside
  // the try block past `finally`, and would otherwise type `rows` as never.
  let rows = null as GuideRow[] | null;
  let tiles: Tile[] = [];
  cdp.on("Network.responseReceived", onResponse);
  cdp.on("Network.loadingFinished", onFinished);
  try {
    await cdp.send("Network.enable", { maxTotalBufferSize: 64_000_000, maxResourceBufferSize: 32_000_000 }, session);
    await navigateAndSettle(cdp, session, GUIDE_URL);
    await sleep(10000);
    tiles = await readTiles(cdp, session);

    const started = Date.now();
    while (!rows && Date.now() - started < GUIDE_API_TIMEOUT_MS) {
      for (const r of await Promise.all(bodies)) if (r && !rows) rows = r;
      if (!rows) await sleep(500);
    }
  } finally {
    cdp.off("Network.responseReceived", onResponse);
    cdp.off("Network.loadingFinished", onFinished);
    await cdp.send("Network.disable", {}, session).catch(() => {});
  }

  if (!tiles.length) {
    const signedOut = await evalIn<boolean>(cdp, session, SIGNED_OUT_TEST);
    throw new Error(signedOut ? "guide enumerated 0 channels — the session is SIGNED OUT" : "guide enumerated 0 channels");
  }
  if (!rows) {
    throw new Error(`fatal: the guide's own ${GUIDE_API_PATH} response (contents.epgRenderer) was not observed while loading ${GUIDE_URL}`);
  }

  const byWatch = new Map(tiles.map((t) => [t.id, t]));
  const channels: Channel[] = [];
  const skipped: Skipped[] = [];
  for (const r of rows) {
    const why: string[] = [];
    if (!r.stationId) why.push("no stationId");
    if (!r.watchId) why.push("no watch link");
    const tile = r.watchId ? byWatch.get(r.watchId) : undefined;
    if (r.watchId && !tile) why.push(`watch id ${r.watchId} has no rendered guide tile`);
    if (why.length || !tile || !r.stationId) {
      skipped.push({ position: r.position, name: r.label, reason: why.join(", ") });
      continue;
    }
    channels.push({
      key: r.stationId,
      id: tile.id,
      name: tile.name,
      logo: tile.logo,
      href: tile.href,
      provider: "youtubetv",
      discrete: r.discrete,
      position: r.position,
    });
  }
  console.log(`[youtubetv] guide rows ${rows.length}, tiles ${tiles.length}, channels ${channels.length}, skipped ${skipped.length}`);
  if (!channels.length) throw new Error("guide response carried no playable rows");
  return { channels, skipped };
}

/** Navigate to the channel's watch URL and wait for poll 1. */
async function load(ctx: TuneCtx, channel: Channel): Promise<void> {
  const url = `https://tv.youtube.com/${String(channel.href ?? "").replace(/^\//, "")}`;
  await ctx.cdp.send("Page.navigate", { url }, ctx.session);

  // Poll 1 (was sleep 9000): the navigation has actually committed to this
  // channel's document and the player element is mounted. Checking the id is
  // in location.href is what stops the next polls reading the OLD document.
  await ctx.poll("navigation", `(() => {
    const signedOut = ${SIGNED_OUT_TEST};
    if (signedOut) return { ok: false, fatal: "SIGNED OUT" };
    const onTarget = location.href.indexOf(${JSON.stringify(channel.id)}) !== -1;
    const player = !!document.querySelector("#movie_player");
    return { ok: onTarget && player, onTarget, player, href: location.href.slice(0, 60) };
  })()`, 30000);
}

export const youtubeTv: Provider = {
  id: "youtubetv",
  label: "YouTube TV",
  slug: "youtube-tv",
  host: HOST,
  homeUrl: "https://tv.youtube.com",
  parkUrl: GUIDE_URL,

  /** Navigates the tab to the home URL and reads the session marker off the
   *  page it lands on. The 6 s settle is what task-001c's check used: the
   *  "SIGN IN" call to action only appears once the app has hydrated. */
  async checkSignedIn(cdp: Cdp, session: Session) {
    await navigateAndSettle(cdp, session, this.homeUrl);
    await sleep(6000);
    const signedOut = await evalIn<boolean>(cdp, session, SIGNED_OUT_TEST);
    return { signedIn: !signedOut, detail: `${HOST}: ${signedOut ? "SIGNED OUT" : "signed in"}` };
  },

  /** Read the guide. The count is whatever the guide has — never hardcoded.
   *  Rows with no stationId or no watch link are not channels (D013 note) and
   *  are returned as skipped. */
  async enumerate(cdp: Cdp, session: Session): Promise<Enumerated> {
    return readGuide(cdp, session);
  },

  /** Tune step 1 with the cached watch id. If poll 1 cannot be satisfied (the
   *  URL never carries that id, or #movie_player never mounts), the watch id
   *  may have rotated: re-read the guide ONCE, take this stationId's current
   *  watch id, persist it, and retry the tune ONCE. A second failure is fatal. */
  async navigate(ctx: TuneCtx, channel: Channel): Promise<void> {
    try {
      await load(ctx, channel);
      return;
    } catch (e) {
      // Only a poll-1 miss means "this watch id did not load". SIGNED OUT and
      // CDP errors are not rotation and are not retried.
      if (!String(e).includes("navigation: not satisfied within")) throw e;
      const stale = channel.id;
      console.warn(`[youtubetv] ${channel.name} (${channel.key}): watch id ${stale} did not load — re-reading the guide once (${String(e).slice(0, 160)})`);

      const guide = await readGuide(ctx.cdp, ctx.session);
      const row = guide.channels.find((c) => c.key === channel.key);
      if (!row) {
        throw new Error(`fatal: youtubetv station ${channel.key} (${channel.name}): cached watch id ${stale} did not load, and the re-read guide has no playable row for this station (re-read watch id: none)`);
      }
      channel.id = row.id;
      channel.href = row.href;
      ctx.saveChannel(channel);
      console.log(`[youtubetv] ${channel.name} (${channel.key}): watch id ${stale} -> ${row.id} from the re-read guide (cache updated); retrying the tune once`);

      try {
        await load(ctx, channel);
      } catch (e2) {
        throw new Error(`fatal: youtubetv station ${channel.key} (${channel.name}): tune failed with cached watch id ${stale} and again with re-read watch id ${row.id} — ${String(e2)}`);
      }
    }
  },

  async play(ctx: TuneCtx): Promise<void> {
    // Poll 3 (kept from the old page-side loop, now a named stage): a real
    // video element is decoding and playing.
    await ctx.poll("player ready", `(() => {
      const p = document.querySelector("#movie_player");
      const v = document.querySelector("#movie_player video.html5-main-video");
      if (!v || !p) return { ok: false, why: "no player yet" };
      return { ok: v.videoWidth > 0 && !v.paused && v.readyState >= 2,
               w: v.videoWidth, h: v.videoHeight, paused: v.paused, readyState: v.readyState };
    })()`, 30000);
  },

  async quality(ctx: TuneCtx, channel: Channel): Promise<QualityResult> {
    // Poll 4 (was sleep 3500): wait on the QUALITY ACTUALLY SETTLING with the
    // element reporting matching real dimensions — not on elapsed time.
    //
    // Task-009 saw tunes report success at hd720 with the element reading 0x0.
    // Two separate causes, and this poll addresses both:
    //   * a STALE element was measured after the pin, so the element is
    //     re-queried every iteration and the pin re-applied (it is idempotent);
    //   * some channels genuinely have NO 1080p rendition — ESPN advertises
    //     only ["hd720","large","medium","small"]. Demanding hd1080 there can
    //     never succeed, so the target is the best level the channel actually
    //     offers at or below hd1080. The level reached is reported, never
    //     silently accepted: a tune below hd1080 warns in the log and shows in
    //     /health.
    const pinned = await ctx.poll("quality pin", `(() => {
      const p = document.querySelector("#movie_player");
      const v = document.querySelector("#movie_player video.html5-main-video");
      if (!p || !v) return { ok: false, why: "player went away" };
      const avail = (p.getAvailableQualityLevels ? p.getAvailableQualityLevels() : []) || [];
      if (!avail.length) return { ok: false, why: "no quality levels advertised yet" };
      const ladder = ["hd1080", "hd720", "large", "medium", "small", "tiny"];
      const target = ladder.find(function (q) { return avail.indexOf(q) !== -1; });
      if (!target) return { ok: false, why: "no usable quality level", available: avail };
      try { p.setPlaybackQualityRange(target, target); } catch (e) {}
      const minH = { hd1080: 1080, hd720: 720, large: 480, medium: 360, small: 240, tiny: 144 }[target] || 1;
      const q = p.getPlaybackQuality();
      const r = v.getBoundingClientRect();
      return {
        ok: q === target && v.videoWidth > 0 && v.videoHeight >= minH,
        target: target,
        quality: q,
        is1080: target === "hd1080",
        video: v.videoWidth + "x" + v.videoHeight,
        box: Math.round(r.width) + "x" + Math.round(r.height),
        viewport: innerWidth + "x" + innerHeight,
        available: avail.slice(0, 6)
      };
    })()`, 20000);
    if (!pinned.is1080) {
      console.warn(`[tune] ${channel.name} WARNING: channel offers no hd1080 — settled at ${pinned.quality} (available: ${JSON.stringify(pinned.available)})`);
    }
    return { quality: String(pinned.quality ?? "unknown"), is1080: !!pinned.is1080, detail: pinned };
  },
};
