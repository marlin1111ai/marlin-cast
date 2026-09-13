// Channel enumeration (D013 / D019: the full lineup, unfiltered, per provider).
//
// Each provider reads its own lineup from its own tab (D018), the combined
// result is cached to disk, and re-enumeration happens only on command —
// never on a /playlist request.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Cdp, findPageTarget } from "./cdp.js";
import { PROVIDERS, type Channel, type ProviderId, type Skipped } from "./providers/index.js";

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

/** Write one channel's changed fields back to the cache, matched on provider +
 *  key (D020). Used when a tune finds a YouTube TV watch id has rotated. */
export function saveChannel(changed: Channel): void {
  const cache = loadChannels();
  if (!cache) throw new Error(`no channel cache at ${CACHE}`);
  const row = cache.channels.find((c) => c.provider === changed.provider && c.key === changed.key);
  if (!row) throw new Error(`${changed.provider} channel ${changed.key} is not in ${CACHE}`);
  Object.assign(row, changed);
  writeFileSync(CACHE, JSON.stringify(cache, null, 2));
}

export async function refresh(port: string): Promise<{ cache: ChannelCache; skipped: Partial<Record<ProviderId, Skipped[]>> }> {
  const cdp = await Cdp.attach(port);
  const channels: Channel[] = [];
  const byProvider: Partial<Record<ProviderId, number>> = {};
  const skipped: Partial<Record<ProviderId, Skipped[]>> = {};
  try {
    for (const provider of PROVIDERS) {
      // D018: each provider is enumerated in its own tab, selected by host.
      const target = await findPageTarget(port, provider);
      const { sessionId } = await cdp.send<any>("Target.attachToTarget", { targetId: target.id, flatten: true });
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Runtime.enable", {}, sessionId);
      const found = await provider.enumerate(cdp, sessionId);
      console.log(`[channels] ${provider.id}: ${found.channels.length} (skipped ${found.skipped.length})`);
      byProvider[provider.id] = found.channels.length;
      skipped[provider.id] = found.skipped;
      channels.push(...found.channels);
    }
  } finally {
    cdp.close();
  }

  // D020: the stream router keys on the channel key alone, so a missing key or
  // a collision between providers would silently route to the wrong channel.
  const keys = new Set<string>();
  for (const c of channels) {
    if (!c.key) throw new Error(`channel has no key: ${c.provider} ${c.id} ${c.name}`);
    if (keys.has(c.key)) throw new Error(`duplicate channel key across providers: ${c.key}`);
    keys.add(c.key);
  }

  const cache: ChannelCache = {
    enumeratedAt: new Date().toISOString(), count: channels.length, byProvider, channels,
  };
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache, null, 2));
  return { cache, skipped };
}

// CLI: npm run channels
if (process.argv[1] && process.argv[1].endsWith("channels.ts")) {
  const port = process.env.CDP_PORT ?? "9333";
  refresh(port)
    .then(({ cache: c, skipped }) => {
      console.log(`enumerated ${c.count} channels at ${c.enumeratedAt}`);
      console.log(`by provider: ${JSON.stringify(c.byProvider)}`);
      console.log(`cached to ${CACHE}`);
      for (const p of PROVIDERS) {
        const mine = c.channels.filter((ch) => ch.provider === p.id);
        console.log(`  --- ${p.label} (${mine.length})`);
        for (const ch of mine.slice(0, 5)) console.log(`      ${ch.key}  ${ch.id}  ${ch.name}`);
        if (mine.length > 5) console.log(`      ... and ${mine.length - 5} more`);
        const left = skipped[p.id] ?? [];
        console.log(`  skipped guide rows (${left.length}):`);
        for (const s of left) console.log(`      row ${s.position}  ${s.name ?? "?"}  — ${s.reason}`);
      }
    })
    .catch((e) => { console.error(String(e)); process.exit(1); });
}
