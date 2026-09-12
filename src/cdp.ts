// Minimal Chrome DevTools Protocol client.
//
// Deliberately not Playwright: the pipeline needs browser-level commands
// Playwright does not surface directly (Extensions.loadUnpacked,
// Extensions.triggerAction, Target.getTargets with a "tab" filter), and this
// is ~80 lines over Node 22's built-in global WebSocket, so it adds no
// dependency. Attaching, never launching, is D009.

export type Session = string | undefined;

export class Cdp {
  private ws: WebSocket;
  private id = 0;
  private pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void }>();
  private listeners = new Map<string, ((p: any) => void)[]>();
  readonly browser: string;

  private constructor(ws: WebSocket, browser: string) {
    this.ws = ws;
    this.browser = browser;
    ws.addEventListener("message", (ev: MessageEvent) => {
      const m = JSON.parse(String(ev.data));
      if (m.method) {
        for (const fn of this.listeners.get(m.method) ?? []) fn(m.params);
        return;
      }
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      m.error ? p.rej(new Error(`${m.error.message}${m.error.data ? ` — ${m.error.data}` : ""}`)) : p.res(m.result);
    });
  }

  static async attach(port: string | number): Promise<Cdp> {
    const base = `http://127.0.0.1:${port}`;
    const version = await fetch(`${base}/json/version`).then((r) => r.json() as any);
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise<void>((res, rej) => {
      ws.addEventListener("open", () => res(), { once: true });
      ws.addEventListener("error", () => rej(new Error(`cannot open ${base}`)), { once: true });
    });
    return new Cdp(ws, version.Browser);
  }

  send<T = any>(method: string, params: Record<string, unknown> = {}, sessionId?: Session): Promise<T> {
    const id = ++this.id;
    const msg: Record<string, unknown> = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }

  on(method: string, fn: (p: any) => void): void {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method)!.push(fn);
  }

  close(): void {
    try { this.ws.close(); } catch { /* already gone */ }
  }
}

/** Evaluate an expression in a session, throwing on a page-side exception
 *  rather than quietly returning undefined. */
export async function evalIn<T = any>(cdp: Cdp, session: Session, expression: string): Promise<T> {
  const r = await cdp.send<any>("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, session);
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  }
  return r.result.value as T;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Navigate and wait for the NEW document.
 *
 *  Page.navigate returns as soon as the navigation is scheduled, so a probe
 *  run straight afterwards reads the OLD document — which matters for the
 *  signed-in checks, where the old page can already be on the very path the
 *  check is looking for. A sentinel stamped on the outgoing document is gone
 *  once the document is replaced, so its absence is the signal. */
export async function navigateAndSettle(
  cdp: Cdp, session: Session, url: string, timeoutMs = 30000,
): Promise<void> {
  await evalIn(cdp, session, `(() => { window.__mcNav = 1; return 1; })()`).catch(() => {});
  await cdp.send("Page.navigate", { url }, session);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const fresh = await evalIn<boolean>(cdp, session,
      `(() => typeof window.__mcNav === "undefined" && document.readyState !== "loading")()`).catch(() => false);
    if (fresh) return;
    await sleep(200);
  }
  throw new Error(`navigation to ${url} did not settle within ${timeoutMs}ms`);
}

/** D018: one tab per provider, both opened by the owner via
 *  scripts/start-chrome.sh. The tab is the page target whose URL HOST is the
 *  provider's, and there is no fallback to "any page" — with two providers
 *  logged in to one Chrome, "any page" would silently drive the wrong tab. */
export async function findPageTarget(
  port: string | number,
  provider: { id: string; host: string },
): Promise<{ id: string; url: string }> {
  const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json() as any);
  const t = list.find((x: any) => {
    if (x.type !== "page") return false;
    try { return new URL(x.url).host === provider.host; } catch { return false; }
  });
  if (!t) {
    const open = list.filter((x: any) => x.type === "page").map((x: any) => x.url).join(", ") || "(none)";
    throw new Error(`fatal: no ${provider.id} tab open — no page target with host ${provider.host}; open pages: ${open}`);
  }
  return { id: t.id, url: t.url };
}

/** Extensions.triggerAction insists on a "tab" target, which is a different
 *  target type from the "page" target and is hidden unless asked for.
 *
 *  With two provider tabs in one Chrome the old "else tabs[0]" fallback could
 *  arm capture on the wrong tab, so the match is exact URL first, then same
 *  host, and only a single-tab browser is allowed to fall through. */
export async function tabTargetId(cdp: Cdp, pageSession: Session): Promise<string> {
  const { targetInfos } = await cdp.send<any>("Target.getTargets", { filter: [{}] });
  const tabs = targetInfos.filter((t: any) => t.type === "tab");
  if (!tabs.length) throw new Error("no tab target found");
  if (tabs.length === 1) return tabs[0].targetId;
  const here = await evalIn<string>(cdp, pageSession, "location.href").catch(() => null);
  if (!here) throw new Error("cannot identify the tab target: the page would not report location.href");
  const exact = tabs.find((t: any) => t.url === here);
  if (exact) return exact.targetId;
  let host = "";
  try { host = new URL(here).host; } catch { /* not a URL */ }
  const sameHost = host ? tabs.filter((t: any) => { try { return new URL(t.url).host === host; } catch { return false; } }) : [];
  if (sameHost.length === 1) return sameHost[0].targetId;
  throw new Error(`cannot identify the tab target for ${here} among ${tabs.length} tabs`);
}
