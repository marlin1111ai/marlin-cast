// Provider contract (D017/D018).
//
// Everything that knows a provider's URLs, selectors, session marker, lineup
// source or player API lives behind this interface; nothing else in the app
// names a provider. The recon inventory (notebook/reports/recon-philo.md
// step 1, rows a–g) is the list of lines this moved.

import type { Cdp, Session } from "../cdp.js";

export type ProviderId = "youtubetv" | "philo";

export type Channel = {
  id: string;
  name: string;
  logo: string | null;
  /** Which provider tunes this channel. The stream router reads it. */
  provider: ProviderId;
  /** YouTube TV: deep-link path+query exactly as the guide supplied it. */
  href?: string;
  /** Philo: the guide row's opaque TileGroup id, used to resolve the
   *  currently-airing broadcast at tune time. Server-validated, so it cannot
   *  be derived from the channel id — it has to be carried from enumeration. */
  tileGroupId?: string;
};

/** Result of a page-side poll probe: `ok` ends the poll, `fatal` aborts it. */
export type Probe = { ok: boolean; fatal?: string; [k: string]: unknown };

/** What a provider is handed during a tune. */
export type TuneCtx = {
  cdp: Cdp;
  session: Session;
  /** Poll a page-side expression; see capture.ts pollPage. */
  poll(name: string, expression: string, timeoutMs: number, intervalMs?: number): Promise<Probe>;
  /** One real input event pair — user activation, not el.click(). */
  click(x: number, y: number): Promise<void>;
  /** One real pointer move. Some players arm their control auto-hide timer
   *  from a mousemove handler and never from a click. */
  move(x: number, y: number): Promise<void>;
  captureW: number;
  captureH: number;
};

export type QualityResult = {
  /** What /health reports. YouTube TV: the player's own level name. Philo: the
   *  element's videoHeight, since Philo exposes no player API to pin. */
  quality: string;
  is1080: boolean;
  detail: Record<string, unknown>;
};

export interface Provider {
  readonly id: ProviderId;
  /** M3U group-title. */
  readonly label: string;
  /** D018: the tab is the page target with THIS url host. No fallback. */
  readonly host: string;
  /** Where `npm run login` sends the tab to read session state. */
  readonly homeUrl: string;
  /** Where an idle stop parks the tab. */
  readonly parkUrl: string;

  /** Run after navigating the tab to homeUrl. */
  checkSignedIn(cdp: Cdp, session: Session): Promise<{ signedIn: boolean; detail: string }>;

  /** The full unfiltered lineup (D013/D019). Count is whatever the provider
   *  reports — never hardcoded. */
  enumerate(cdp: Cdp, session: Session): Promise<Channel[]>;

  /** Tune step 1: navigate to the channel and wait for its document.
   *  Aborts with a fatal "SIGNED OUT" probe if the session is gone. */
  navigate(ctx: TuneCtx, channel: Channel): Promise<void>;

  /** Tune step 3: a real video element decoding and playing. */
  play(ctx: TuneCtx, channel: Channel): Promise<void>;

  /** Tune step 4: settle and report quality. */
  quality(ctx: TuneCtx, channel: Channel): Promise<QualityResult>;
}
