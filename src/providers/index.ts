// The provider registry. Order here is the order the playlist emits (D017:
// YouTube TV first, then Philo).

import { philo } from "./philo.js";
import { youtubeTv } from "./youtubetv.js";
import type { Channel, Provider, ProviderId } from "./types.js";

export * from "./types.js";

export const PROVIDERS: Provider[] = [youtubeTv, philo];

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
