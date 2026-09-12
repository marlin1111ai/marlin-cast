// YouTube TV (D002). Behaviour is unchanged from task-019: same URLs, same
// selectors, same four-poll tune, same quality ladder, same park URL. The
// lines below were moved here verbatim from src/channels.ts and
// src/capture.ts; nothing about them was re-derived.

import { evalIn, navigateAndSettle, sleep, type Cdp, type Session } from "../cdp.js";
import type { Channel, Provider, QualityResult, TuneCtx } from "./types.js";

const HOST = "tv.youtube.com";
/** Where the capture tab parks after an idle stop: the YouTube TV live
 *  guide, logged in, with no channel playing (task-018). */
const GUIDE_URL = "https://tv.youtube.com/live";

/** The signed-out marker for this provider: the guide chrome renders a
 *  "SIGN IN" call to action when the session is gone (task-002). */
const SIGNED_OUT_TEST = `/SIGN IN/i.test((document.body && document.body.innerText) || "")`;

export const youtubeTv: Provider = {
  id: "youtubetv",
  label: "YouTube TV",
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

  /** Read the guide. The count is whatever the guide has — never hardcoded. */
  async enumerate(cdp: Cdp, session: Session): Promise<Channel[]> {
    await navigateAndSettle(cdp, session, GUIDE_URL);
    await sleep(10000);

    // Give the grid a chance to fill in; bail out as soon as it stops growing.
    let last = -1;
    for (let i = 0; i < 12; i++) {
      const n = await evalIn<number>(cdp, session,
        `document.querySelectorAll("ytu-endpoint.tenx-thumb[aria-label]").length`);
      if (n > 0 && n === last) break;
      last = n;
      await sleep(1500);
    }

    const channels = await evalIn<Channel[]>(cdp, session, `(() => {
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
        out.push({ id, name, logo, href, provider: "youtubetv" });
      }
      return out;
    })()`);

    if (!channels.length) {
      const signedOut = await evalIn<boolean>(cdp, session, SIGNED_OUT_TEST);
      throw new Error(signedOut ? "guide enumerated 0 channels — the session is SIGNED OUT" : "guide enumerated 0 channels");
    }
    return channels;
  },

  async navigate(ctx: TuneCtx, channel: Channel): Promise<void> {
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
