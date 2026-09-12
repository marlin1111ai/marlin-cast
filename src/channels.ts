// Channel enumeration (D013 / D019: the full lineup, unfiltered, per provider).
//
// Each provider reads its own lineup from its own tab (D018), the combined
// result is cached to disk, and re-enumeration happens only on command —
// never on a /playlist request.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Cdp, findPageTarget } from "./cdp.js";
import { PROVIDERS, type Channel, type ProviderId } from "./providers/index.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CACHE = join(ROOT, "data", "channels.json");

export type { Channel } from "./providers/index.js";

export type ChannelCache = {
  enumeratedAt: string;
  count: number;
  /** Per-provider counts, so a short lineup is visible without counting. */
  byProvider?: Partial<Record<ProviderId, number>>;
  channels: Channel[];
};

export function loadChannels(): ChannelCache | null {
  if (!existsSync(CACHE)) return null;
  try { return JSON.parse(readFileSync(CACHE, "utf8")) as ChannelCache; } catch { return null; }
}

export async function refresh(port: string): Promise<ChannelCache> {
  const cdp = await Cdp.attach(port);
  const channels: Channel[] = [];
  const byProvider: Partial<Record<ProviderId, number>> = {};
  try {
    for (const provider of PROVIDERS) {
      // D018: each provider is enumerated in its own tab, selected by host.
      const target = await findPageTarget(port, provider);
      const { sessionId } = await cdp.send<any>("Target.attachToTarget", { targetId: target.id, flatten: true });
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Runtime.enable", {}, sessionId);
      const found = await provider.enumerate(cdp, sessionId);
      console.log(`[channels] ${provider.id}: ${found.length}`);
      byProvider[provider.id] = found.length;
      channels.push(...found);
    }
  } finally {
    cdp.close();
  }

  // The stream router keys on the channel id alone, so a collision between
  // providers would silently route to the wrong one (step 7).
  const ids = new Set<string>();
  for (const c of channels) {
    if (ids.has(c.id)) throw new Error(`duplicate channel id across providers: ${c.id}`);
    ids.add(c.id);
  }

  const cache: ChannelCache = {
    enumeratedAt: new Date().toISOString(), count: channels.length, byProvider, channels,
  };
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache, null, 2));
  return cache;
}

// CLI: npm run channels
if (process.argv[1] && process.argv[1].endsWith("channels.ts")) {
  const port = process.env.CDP_PORT ?? "9333";
  refresh(port)
    .then((c) => {
      console.log(`enumerated ${c.count} channels at ${c.enumeratedAt}`);
      console.log(`by provider: ${JSON.stringify(c.byProvider)}`);
      console.log(`cached to ${CACHE}`);
      for (const p of PROVIDERS) {
        const mine = c.channels.filter((ch) => ch.provider === p.id);
        console.log(`  --- ${p.label} (${mine.length})`);
        for (const ch of mine.slice(0, 5)) console.log(`      ${ch.id}  ${ch.name}`);
        if (mine.length > 5) console.log(`      ... and ${mine.length - 5} more`);
      }
    })
    .catch((e) => { console.error(String(e)); process.exit(1); });
}
