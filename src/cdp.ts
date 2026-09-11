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

/** The page target showing YouTube TV, or any page target as a fallback. */
export async function findPageTarget(port: string | number): Promise<{ id: string; url: string }> {
  const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json() as any);
  const t = list.find((x: any) => x.type === "page" && x.url.includes("tv.youtube.com"))
         ?? list.find((x: any) => x.type === "page");
  if (!t) throw new Error("no page target to drive");
  return { id: t.id, url: t.url };
}

/** Extensions.triggerAction insists on a "tab" target, which is a different
 *  target type from the "page" target and is hidden unless asked for. */
export async function tabTargetId(cdp: Cdp, pageSession: Session): Promise<string> {
  const { targetInfos } = await cdp.send<any>("Target.getTargets", { filter: [{}] });
  const tabs = targetInfos.filter((t: any) => t.type === "tab");
  if (!tabs.length) throw new Error("no tab target found");
  if (tabs.length === 1) return tabs[0].targetId;
  const here = await evalIn<string>(cdp, pageSession, "location.href").catch(() => null);
  return (tabs.find((t: any) => t.url === here) ?? tabs[0]).targetId;
}
