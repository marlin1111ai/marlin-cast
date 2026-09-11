// Channel enumeration (D013: the full lineup, unfiltered).
//
// Reads the live guide in the attached Chrome using the selector recorded in
// task-002, caches the result to disk, and re-enumerates only on command —
// never on a /playlist request.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Cdp, evalIn, findPageTarget, sleep, type Session } from "./cdp.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CACHE = join(ROOT, "data", "channels.json");

export type Channel = {
  id: string;        // YouTube video id from the guide href
  name: string;      // display name from aria-label
  logo: string | null;
  href: string;      // deep link path+query exactly as the guide supplied it
};

export type ChannelCache = { enumeratedAt: string; count: number; channels: Channel[] };

export function loadChannels(): ChannelCache | null {
  if (!existsSync(CACHE)) return null;
  try { return JSON.parse(readFileSync(CACHE, "utf8")) as ChannelCache; } catch { return null; }
}

/** Read the guide. The count is whatever the guide has — never hardcoded. */
export async function enumerateChannels(cdp: Cdp, session: Session): Promise<Channel[]> {
  await cdp.send("Page.navigate", { url: "https://tv.youtube.com/live" }, session);
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
      out.push({ id, name, logo, href });
    }
    return out;
  })()`);

  if (!channels.length) {
    const signedOut = await evalIn<boolean>(cdp, session, `/SIGN IN/i.test(document.body.innerText || "")`);
    throw new Error(signedOut ? "guide enumerated 0 channels — the session is SIGNED OUT" : "guide enumerated 0 channels");
  }
  return channels;
}

export async function refresh(port: string): Promise<ChannelCache> {
  const cdp = await Cdp.attach(port);
  const target = await findPageTarget(port);
  const { sessionId } = await cdp.send<any>("Target.attachToTarget", { targetId: target.id, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  const channels = await enumerateChannels(cdp, sessionId);
  const cache: ChannelCache = { enumeratedAt: new Date().toISOString(), count: channels.length, channels };
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache, null, 2));
  cdp.close();
  return cache;
}

// CLI: npm run channels
if (process.argv[1] && process.argv[1].endsWith("channels.ts")) {
  const port = process.env.CDP_PORT ?? "9333";
  refresh(port)
    .then((c) => {
      console.log(`enumerated ${c.count} channels at ${c.enumeratedAt}`);
      console.log(`cached to ${CACHE}`);
      for (const ch of c.channels.slice(0, 10)) console.log(`  ${ch.id}  ${ch.name}`);
      if (c.count > 10) console.log(`  ... and ${c.count - 10} more`);
    })
    .catch((e) => { console.error(String(e)); process.exit(1); });
}
