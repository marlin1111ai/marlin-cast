// npm run login — report the session state of every provider (D017/D018).
//
// Attaches to the Chrome the owner launched with scripts/start-chrome.sh
// (D009). This never launches Chrome, never creates a profile and never passes
// a profile path. It never types credentials and never navigates to a login or
// accounts page: it navigates each provider's own tab to that provider's home
// URL and reads where it lands.

import { Cdp, evalIn, findPageTarget, type Session } from "./cdp.js";
import { PROVIDERS } from "./providers/index.js";

const PORT = process.env.CDP_PORT ?? "9333";

const attach = async (): Promise<Cdp> => {
  try {
    return await Cdp.attach(PORT);
  } catch {
    console.error(
      `No Chrome is listening on http://127.0.0.1:${PORT}.\n\n` +
        "Start it first, in a terminal on the marlinpc desktop:\n" +
        "    cd /Apps/marlin-cast && ./scripts/start-chrome.sh\n\n" +
        "Leave that running, then run this again.",
    );
    process.exit(1);
  }
};

const main = async () => {
  const cdp = await attach();
  console.log(`attached: yes  (127.0.0.1:${PORT}, Chrome ${cdp.browser})`);

  let bad = 0;
  for (const provider of PROVIDERS) {
    let target;
    try {
      // D018: no fallback to "any page" — a missing tab is a loud failure.
      target = await findPageTarget(PORT, provider);
    } catch (e) {
      console.log(`${provider.id}: ${String(e instanceof Error ? e.message : e)}`);
      bad++;
      continue;
    }
    const { sessionId } = await cdp.send<any>("Target.attachToTarget", { targetId: target.id, flatten: true });
    const session = sessionId as Session;
    await cdp.send("Page.enable", {}, session);
    await cdp.send("Runtime.enable", {}, session);

    // checkSignedIn navigates the tab to the provider's home URL itself.
    const { signedIn, detail } = await provider.checkSignedIn(cdp, session);
    const webdriver = await evalIn<boolean>(cdp, session, `navigator.webdriver`).catch(() => null);
    const href = await evalIn<string>(cdp, session, `location.href`).catch(() => "?");
    console.log(`${provider.id}: ${detail}`);
    console.log(`  navigator.webdriver: ${webdriver}`);
    console.log(`  url: ${href}`);
    if (!signedIn) bad++;
  }

  // Detaches only. Chrome keeps running and keeps the session (task-001c).
  cdp.close();
  console.log("detached (Chrome left running)");
  if (bad) process.exit(1);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
