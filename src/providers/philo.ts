// Philo (D017) — second provider, read-only.
//
// Everything here comes from notebook/reports/recon-philo.md step 2 plus the
// task-021 probes recorded in notebook/reports/task-021.md. Nothing is
// guessed: the lineup is the guide page's own `page` GraphQL query, re-issued
// in the page with the page's own session, and the player URL is the one the
// guide's own "Watch live" control navigates to.
//
// Philo tops out at 1280x720 under Widevine L3 and exposes no player JS API,
// so there is no quality pin (D017); the frame is upscaled into the 1920x1080
// capture exactly as ESPN is today.

import { evalIn, navigateAndSettle, sleep, type Cdp, type Session } from "../cdp.js";
import type { Channel, Provider, QualityResult, TuneCtx } from "./types.js";

const HOST = "www.philo.com";
const HOME_URL = "https://www.philo.com/";
/** Idle park: the guide leaves no <video> at all and issues no media traffic
 *  (recon 2e), so it is a cleaner park than YouTube TV's. */
const GUIDE_URL = "https://www.philo.com/player/guide";
const PLAYER_URL = "https://www.philo.com/player/player/broadcast/";

/** The one <video> on a Philo player page (recon 2d). Philo is the opposite of
 *  YouTube TV here: one element, not forty. */
const VIDEO = "video#video";

/** Automatic persisted query for operationName "page" — the query the guide
 *  issues for itself. Captured from the guide's own POST to /graphql.
 *  If Philo ships a new web bundle this hash changes and the server answers
 *  PersistedQueryNotFound; the enumeration then fails loud rather than
 *  returning a short lineup. Re-capture it from the guide's own request. */
const PAGE_QUERY_HASH = "03de2c8dc0e1331c511a2796c3e723a71d4bc6cca173a82e3903b891921b3cb4";

/** Sent verbatim as the guide sends them. */
const CAPABILITIES = [
  "COLLECTION_TILE_GROUPS", "HERO_PROMOTION", "MOVIE_SHOWINGS", "GUIDE_FILTERS",
  "SEARCH_PAGE_RECS", "UNIFIED_SHOWS_MOVIES_SEARCH_RESULTS", "EXTERNAL_CONTENT",
  "COLLECTION_GROUPS", "OUT_OF_PLAN_CONTENT", "CHANNEL_TILE_GROUPS_V2", "PROMOTION_TILE",
];

/** Signed in = philo.com settles on a /player/ path (recon 2a). Nothing here
 *  looks for, or navigates to, a login page. */
const ON_PLAYER_PATH = `location.pathname.indexOf("/player/") === 0`;

/** Which of the five channel-logo fields the playlist carries, and the width
 *  its ${width} placeholder is filled with. colorSquare is the brand-colour
 *  square mark — the only one that reads on both light and dark clients;
 *  whiteSquare would vanish on a light background. */
const LOGO_FIELD = "colorSquare";
const LOGO_WIDTH = 400;

/** Build the in-page expression that issues the guide's own `page` query and
 *  reduces the (up to ~900 KB) response to just what we need, in the page. */
function pageQuery(vars: Record<string, unknown>, mapFn: string): string {
  const payload = JSON.stringify([{
    operationName: "page",
    variables: {
      pageType: "GUIDE", typeId: null, filterId: null, filter: null, sorterId: null,
      endCursor: null, startCursor: null, firstGroups: 10, initialTiles: 12,
      lastGroups: null, numSparseGroups: 0, includeTileChannel: true,
      iconFormat: "SVG", channelLogoFormat: "AUTO", capabilities: CAPABILITIES,
      startTime: null, endTime: null,
      ...vars,
    },
    extensions: { persistedQuery: { version: 1, sha256Hash: PAGE_QUERY_HASH } },
  }]);
  return `(async () => {
    const res = await fetch("/graphql", { method: "POST", credentials: "include",
      headers: { "content-type": "application/json" }, body: ${JSON.stringify(payload)} });
    if (!res.ok) return { error: "graphql HTTP " + res.status };
    const j = await res.json();
    const errs = j && j[0] && j[0].errors;
    if (errs) return { error: JSON.stringify(errs).slice(0, 400) };
    const page = j && j[0] && j[0].data && j[0].data.page;
    if (!page) return { error: "graphql: no page in response" };
    return (${mapFn})(page);
  })()`;
}

type GqlResult<T> = T & { error?: string };

async function runPageQuery<T>(cdp: Cdp, session: Session, vars: Record<string, unknown>, mapFn: string): Promise<T> {
  const r = await evalIn<GqlResult<T>>(cdp, session, pageQuery(vars, mapFn));
  if (r && r.error) throw new Error(`philo: ${r.error}`);
  return r as T;
}

/** One row of the guide's channel list. */
const MAP_ROWS = `(page) => ({
  total: page.groups && page.groups.summary ? page.groups.summary.totalCount : null,
  hasNext: !!(page.groups && page.groups.pageInfo && page.groups.pageInfo.hasNextPage),
  endCursor: page.groups && page.groups.pageInfo ? page.groups.pageInfo.endCursor : null,
  rows: (page.groups ? page.groups.edges : []).map((e) => {
    const c = e.node.channel || {};
    return {
      channelId: c.channelId || null,
      displayName: c.displayName || null,
      logo: c.${LOGO_FIELD} || null,
      tileGroupId: e.node.link ? e.node.link.typeId : null,
      tier: e.node.header ? e.node.header.title : null
    };
  })
})`;

/** The tiles of one guide row, reduced to what picks the live broadcast. */
const MAP_TILES = `(page) => {
  const edges = page.groups ? page.groups.edges : [];
  const row = edges[0];
  if (!row) return { tiles: [], name: null };
  return {
    name: row.node.channel ? row.node.channel.displayName : null,
    tiles: (row.node.tiles ? row.node.tiles.edges : []).map((t) => ({
      id: t.node.playableAssetId, type: t.node.playableAssetType,
      playable: !!t.node.hasPlayable, title: t.node.title,
      from: t.node.availabilityStartsAt, to: t.node.availabilityEndsAt
    }))
  };
}`;

type Tile = { id: string; type: string; playable: boolean; title: string | null; from: string | null; to: string | null };

/** The tile that is on the air right now: airing window contains now, it is a
 *  live Broadcast, and the account can play it. */
function airingNow(tiles: Tile[]): Tile | null {
  const now = Date.now();
  for (const t of tiles) {
    if (t.type !== "BROADCAST" || !t.playable || !t.id) continue;
    const from = t.from ? Date.parse(t.from) : NaN;
    const to = t.to ? Date.parse(t.to) : NaN;
    if (Number.isFinite(from) && Number.isFinite(to) && from <= now && now < to) return t;
  }
  return null;
}

/** Resolve the currently-airing Broadcast id for a channel.
 *
 *  Fast path: the channel's own guide row, addressed by the opaque TileGroup
 *  id carried from enumeration (one request, ~150 ms). Those ids are validated
 *  server-side and carry the row's tier, so one can go stale when a channel
 *  moves between Favorite/All/Free — hence the fallback, which re-reads the
 *  guide itself and also refreshes the id in memory. */
async function resolveBroadcast(cdp: Cdp, session: Session, channel: Channel): Promise<{ tile: Tile; via: string }> {
  if (channel.tileGroupId) {
    try {
      const r = await runPageQuery<{ tiles: Tile[]; name: string | null }>(cdp, session,
        { pageType: "TILE_GROUP", typeId: channel.tileGroupId, firstGroups: 1, initialTiles: 8 }, MAP_TILES);
      const tile = airingNow(r.tiles);
      if (tile) return { tile, via: "tileGroupId" };
      console.warn(`[philo] ${channel.name}: tile group returned ${r.tiles.length} tiles, none airing now — rescanning the guide`);
    } catch (e) {
      console.warn(`[philo] ${channel.name}: tile group lookup failed (${String(e)}) — rescanning the guide`);
    }
  }
  // Fallback: walk the guide with one tile per row until this channel shows up.
  let cursor: string | null = null;
  for (let page = 0; page < 12; page++) {
    const r: any = await runPageQuery<any>(cdp, session,
      { firstGroups: 50, initialTiles: 1, endCursor: cursor }, `(page) => ({
        hasNext: !!(page.groups && page.groups.pageInfo && page.groups.pageInfo.hasNextPage),
        endCursor: page.groups && page.groups.pageInfo ? page.groups.pageInfo.endCursor : null,
        rows: (page.groups ? page.groups.edges : []).map((e) => ({
          channelId: e.node.channel ? e.node.channel.channelId : null,
          tileGroupId: e.node.link ? e.node.link.typeId : null,
          tiles: (e.node.tiles ? e.node.tiles.edges : []).map((t) => ({
            id: t.node.playableAssetId, type: t.node.playableAssetType,
            playable: !!t.node.hasPlayable, title: t.node.title,
            from: t.node.availabilityStartsAt, to: t.node.availabilityEndsAt }))
        }))
      })`);
    for (const row of r.rows) {
      if (row.channelId !== channel.id) continue;
      if (row.tileGroupId) channel.tileGroupId = row.tileGroupId;  // refresh in memory
      const tile = airingNow(row.tiles);
      if (tile) return { tile, via: "guide rescan" };
      throw new Error(`fatal: philo channel ${channel.name} has no live broadcast airing now`);
    }
    if (!r.hasNext) break;
    cursor = r.endCursor;
  }
  throw new Error(`fatal: philo channel ${channel.name} (${channel.id}) is not in the guide`);
}

/** The redirect to /player/... is the app's own, so it lands a moment after
 *  the document loads. Poll for it; a timeout means signed out. */
async function waitForPlayerPath(cdp: Cdp, session: Session): Promise<{ signedIn: boolean; detail: string }> {
  let href = "";
  for (let i = 0; i < 40; i++) {
    href = await evalIn<string>(cdp, session, `location.href`).catch(() => "");
    const onPlayer = await evalIn<boolean>(cdp, session, ON_PLAYER_PATH).catch(() => false);
    if (onPlayer) return { signedIn: true, detail: `${HOST}: signed in (${href})` };
    await sleep(500);
  }
  return { signedIn: false, detail: `${HOST}: SIGNED OUT (settled on ${href || "?"}, not a /player/ path)` };
}

/** Direct navigation to the broadcast URL starts at the START of the DVR
 *  availability window, not at the live edge — measured 2h05m behind wall
 *  clock on AMC. Assigning a currentTime past the end of the seek range makes
 *  the page's own player clamp to the live edge. */
async function seekToLive(ctx: TuneCtx, channel: Channel): Promise<void> {
  const before = await evalIn<number>(ctx.cdp, ctx.session,
    `(() => document.querySelector(${JSON.stringify(VIDEO)}).currentTime)()`).catch(() => -1);
  await evalIn(ctx.cdp, ctx.session,
    `(() => { document.querySelector(${JSON.stringify(VIDEO)}).currentTime = 1e9; return 1; })()`).catch(() => {});
  const live = await ctx.poll("live edge", `(() => {
    const v = document.querySelector(${JSON.stringify(VIDEO)});
    if (!v) return { ok: false, why: "no video element" };
    return { ok: v.videoWidth > 0 && !v.paused && v.readyState >= 2 && v.currentTime > ${Math.max(0, before)},
             ct: Math.round(v.currentTime), paused: v.paused, readyState: v.readyState };
  })()`, 30000);
  console.log(`[philo] ${channel.name}: seek to live ${Math.round(before)}s -> ${live.ct}s`);
}

/** Get Philo's control overlay off the picture before capture starts.
 *
 *  Measured: the click that satisfies the autoplay policy also SHOWS the
 *  overlay, and Philo arms its auto-hide timer from a `mousemove` handler
 *  only. A tune that clicks and never moves the pointer therefore leaves the
 *  title, scrubber, START OVER / LIVE and the whole button row burnt into
 *  every captured frame, indefinitely — confirmed over a 5.7-minute capture,
 *  and NOT caused by tab capture (stopping the recorder mid-stream did not
 *  clear it) nor by tab activation (A/B tested). One mouseMoved is not enough;
 *  a short sweep is, and the overlay then clears in ~2 s and stays clear.
 *
 *  A failure here is loud but not fatal: a stream with the overlay on it is
 *  still a stream, and failing the tune outright would be worse. */
async function dismissControls(ctx: TuneCtx, channel: Channel): Promise<void> {
  const hidden = `(() => {
    const c = document.querySelector('[class*="playerOverlayContainer"]');
    if (!c) return { ok: false, why: "no overlay container" };
    const cls = String(c.className);
    return { ok: !/overlayActive|controlsActive/.test(cls), cls: cls.replace(/___\w+/g, "") };
  })()`;
  const x = Math.round(ctx.captureW / 2);
  const h = ctx.captureH;
  const sweep: [number, number][] = [
    [x, Math.round(h * 0.83)], [x, Math.round(h * 0.93)], [x, h - 1],
    [Math.round(x * 0.4), h - 1], [x, Math.round(h / 2)],
  ];
  for (let round = 0; round <= 3; round++) {
    try {
      // Round 0 is a cheap look: the overlay often clears on its own, and
      // then the tune pays ~0 for this step.
      const gone = await ctx.poll("controls hidden", hidden, round === 0 ? 1200 : 2500, 300);
      console.log(`[philo] ${channel.name}: control overlay clear after ${round} sweep(s) (${gone.cls})`);
      return;
    } catch { /* still showing — sweep and look again */ }
    for (const [mx, my] of sweep) { await ctx.move(mx, my); await sleep(90); }
    await ctx.move(x, h * 2);   // park the pointer off the page
  }
  console.warn(`[philo] ${channel.name} WARNING: the control overlay did NOT clear after 3 pointer sweeps — the player's title, scrubber and button row will be burnt into the capture. See notebook/reports/task-021.md.`);
}

export const philo: Provider = {
  id: "philo",
  label: "Philo",
  host: HOST,
  homeUrl: HOME_URL,
  parkUrl: GUIDE_URL,

  /** Signed in = navigating to philo.com settles on a /player/ path (recon 2a).
   *  Anything else is SIGNED OUT. Nothing here looks for, or navigates to, a
   *  login or code-entry page. */
  async checkSignedIn(cdp: Cdp, session: Session) {
    await navigateAndSettle(cdp, session, HOME_URL);
    return waitForPlayerPath(cdp, session);
  },

  /** D019: every row the guide's channel list returns, unfiltered, all three
   *  tiers (Favorite / All / Free). The list is the guide page's own `page`
   *  query, re-issued here in the page with the page's own session — the same
   *  request the guide makes for itself, paged on groups.pageInfo until
   *  hasNextPage is false. Count is checked against groups.summary.totalCount
   *  and never hardcoded. */
  async enumerate(cdp: Cdp, session: Session): Promise<Channel[]> {
    await navigateAndSettle(cdp, session, GUIDE_URL);
    const signed = await waitForPlayerPath(cdp, session);
    if (!signed.signedIn) throw new Error(`fatal: "SIGNED OUT" — ${signed.detail}`);

    const channels: Channel[] = [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    let total: number | null = null;
    let tiers: Record<string, number> = {};

    for (let page = 0; page < 20; page++) {
      const r: any = await runPageQuery<any>(cdp, session,
        { firstGroups: 50, initialTiles: 0, endCursor: cursor }, MAP_ROWS);
      if (total === null) total = r.total;
      for (const row of r.rows) {
        if (!row.channelId || !row.displayName) continue;
        if (seen.has(row.channelId)) continue;
        seen.add(row.channelId);
        tiers[row.tier ?? "?"] = (tiers[row.tier ?? "?"] ?? 0) + 1;
        channels.push({
          id: row.channelId,
          name: row.displayName,
          // ${width} is Philo's own placeholder in every channel-logo URL.
          logo: row.logo ? String(row.logo).replace("${width}", String(LOGO_WIDTH)) : null,
          provider: "philo",
          tileGroupId: row.tileGroupId ?? undefined,
        });
      }
      if (!r.hasNext) break;
      cursor = r.endCursor;
    }

    if (!channels.length) throw new Error("philo: the guide returned 0 channels");
    console.log(`[philo] ${channels.length} channels, totalCount ${total}, tiers ${JSON.stringify(tiers)}`);
    if (total !== null && channels.length !== total) {
      throw new Error(`philo: enumerated ${channels.length} channels but groups.summary.totalCount is ${total}`);
    }
    return channels;
  },

  /** Tune step 1: resolve the live broadcast, then navigate straight to its
   *  player URL. The guide's own "Watch live" control lands on exactly this
   *  URL (recon 2d); going there directly skips the tile -> details -> click
   *  path entirely. */
  async navigate(ctx: TuneCtx, channel: Channel): Promise<void> {
    const { tile, via } = await resolveBroadcast(ctx.cdp, ctx.session, channel);
    console.log(`[philo] ${channel.name}: broadcast ${tile.id} "${tile.title}" (${tile.from} -> ${tile.to}) via ${via}`);
    await ctx.cdp.send("Page.navigate", { url: PLAYER_URL + tile.id }, ctx.session);

    await ctx.poll("navigation", `(() => {
      if (!(${ON_PLAYER_PATH})) return { ok: false, fatal: "SIGNED OUT" };
      const onTarget = location.href.indexOf(${JSON.stringify(tile.id)}) !== -1;
      const v = document.querySelector(${JSON.stringify(VIDEO)});
      return { ok: onTarget && !!v, onTarget, video: !!v, href: location.href.slice(0, 60) };
    })()`, 30000);
  },

  /** Tune step 3. Two things YouTube TV never needs:
   *
   *  1. A real input event. The page calls play() itself and Chrome's autoplay
   *     policy refuses it — the video is unmuted and the tab may have no user
   *     activation — so the pipeline reaches kPlaying and is paused at once
   *     (recon 2d). One real mousePressed+mouseReleased at the video centre
   *     grants activation; el.click() does not.
   *  2. A seek to the live edge. Direct navigation to the broadcast URL starts
   *     at the START of the DVR availability window, not at the live edge —
   *     measured 2h05m behind wall clock on AMC. Assigning a currentTime past
   *     the end of the seek range makes the page's own player clamp to the
   *     live edge (measured: 226s -> 7777s, ~5s behind wall clock).
   */
  async play(ctx: TuneCtx, channel: Channel): Promise<void> {
    const probe = `(() => {
      const v = document.querySelector(${JSON.stringify(VIDEO)});
      if (!v) return { ok: false, why: "no video element" };
      return { ok: v.videoWidth > 0 && v.readyState >= 2,
               w: v.videoWidth, h: v.videoHeight, paused: v.paused, readyState: v.readyState };
    })()`;
    await ctx.poll("media ready", probe, 30000);

    const box = await evalIn<{ x: number; y: number; paused: boolean } | null>(ctx.cdp, ctx.session, `(() => {
      const v = document.querySelector(${JSON.stringify(VIDEO)});
      if (!v) return null;
      const r = v.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), paused: v.paused };
    })()`);
    if (box && box.paused) {
      await ctx.click(box.x, box.y);
      console.log(`[philo] ${channel.name}: dispatched one real click at ${box.x},${box.y} to satisfy the autoplay policy`);
    }

    await ctx.poll("player ready", `(() => {
      const v = document.querySelector(${JSON.stringify(VIDEO)});
      if (!v) return { ok: false, why: "no video element" };
      return { ok: v.videoWidth > 0 && !v.paused && v.readyState >= 2,
               w: v.videoWidth, h: v.videoHeight, paused: v.paused, readyState: v.readyState };
    })()`, 30000);

    await seekToLive(ctx, channel);
    await dismissControls(ctx, channel);
  },

  /** No quality pin: Philo exposes no player JS API, only a UI menu, and its
   *  ladder tops out at 1280x720 (D017). ABR picks the top rung on its own —
   *  recon measured the 4300000 (1280x720) representation being fetched. What
   *  /health reports is therefore the element's own videoHeight. */
  async quality(ctx: TuneCtx, channel: Channel): Promise<QualityResult> {
    const got = await ctx.poll("quality report", `(() => {
      const v = document.querySelector(${JSON.stringify(VIDEO)});
      if (!v) return { ok: false, why: "no video element" };
      const r = v.getBoundingClientRect();
      return { ok: v.videoWidth > 0 && v.videoHeight > 0,
        quality: v.videoHeight + "p",
        is1080: v.videoHeight >= 1080,
        video: v.videoWidth + "x" + v.videoHeight,
        box: Math.round(r.width) + "x" + Math.round(r.height),
        viewport: innerWidth + "x" + innerHeight };
    })()`, 20000);
    if (!got.is1080) {
      console.warn(`[tune] ${channel.name} WARNING: Philo has no hd1080 rendition — capturing ${got.video} upscaled into the ${ctx.captureW}x${ctx.captureH} frame (D017)`);
    }
    return { quality: String(got.quality ?? "unknown"), is1080: !!got.is1080, detail: got };
  },
};
