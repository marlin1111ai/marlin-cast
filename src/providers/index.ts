// The provider registry. Order here is the order the playlist emits (D017:
// YouTube TV first, then Philo).

import { philo } from "./philo.js";
import { youtubeTv } from "./youtubetv.js";
import type { Channel, Provider, ProviderId } from "./types.js";

export * from "./types.js";

const ALL: Provider[] = [youtubeTv, philo];

/** Test knob (task-024): MC_PROVIDERS="youtubetv" restricts every path —
 *  login, enumeration, playlist, tuning — to the named providers, so a
 *  container can be exercised with a profile that carries only one login.
 *  Unset in production: both providers, D017. Loud when set. */
function enabled(): Provider[] {
  const raw = process.env.MC_PROVIDERS;
  if (!raw) return ALL;
  const want = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const picked = ALL.filter((p) => want.includes(p.id));
  const unknown = want.filter((w) => !ALL.some((p) => p.id === w));
  if (unknown.length) throw new Error(`MC_PROVIDERS names unknown provider(s): ${unknown.join(", ")}`);
  if (!picked.length) throw new Error("MC_PROVIDERS selects no provider");
  console.warn(`[providers] MC_PROVIDERS=${raw} — restricted to ${picked.map((p) => p.id).join(", ")} (test knob; unset in production)`);
  return picked;
}

export const PROVIDERS: Provider[] = enabled();

const BY_ID = new Map<string, Provider>(PROVIDERS.map((p) => [p.id, p]));

export function providerById(id: string): Provider {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`unknown provider "${id}"`);
  return p;
}

/** The stream router maps a channel to its provider through this (step 7). */
export function providerFor(channel: Channel): Provider {
  return providerById(channel.provider);
}

export type { Channel, Provider, ProviderId };
