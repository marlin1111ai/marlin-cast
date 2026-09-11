import { chromium, type Browser, type Page } from "playwright";

const PORT = process.env.CDP_PORT ?? "9333";
const ENDPOINT = `http://127.0.0.1:${PORT}`;
const TARGET = "https://tv.youtube.com";

/**
 * Attach to the Chrome the owner launched with scripts/start-chrome.sh (D009).
 *
 * This never launches Chrome, never creates a profile and never passes a
 * profile path. Playwright owning the profile is what the launchPersistentContext
 * approach did, and it reported navigator.webdriver === true; attaching reports
 * false. See notebook/reports/task-001c-cookie-destruction.md.
 */
const attach = async (): Promise<Browser> => {
  try {
    return await chromium.connectOverCDP(ENDPOINT);
  } catch {
    console.error(
      `No Chrome is listening on ${ENDPOINT}.\n\n` +
        "Start it first, in a terminal on the marlinpc desktop:\n" +
        "    cd /Apps/marlin-cast && ./scripts/start-chrome.sh\n\n" +
        "Leave that running, then run this again.",
    );
    process.exit(1);
  }
};

const firstPage = async (browser: Browser): Promise<Page> => {
  const context = browser.contexts()[0];
  if (!context) throw new Error("attached, but Chrome exposed no browser context");
  return context.pages()[0] ?? (await context.newPage());
};

const main = async () => {
  const browser = await attach();
  console.log(`attached: yes  (${ENDPOINT}, Chrome ${browser.version()})`);

  const page = await firstPage(browser);
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);

  const webdriver = await page.evaluate(() => navigator.webdriver);
  console.log(`navigator.webdriver: ${webdriver}`);

  const signedOut = await page.evaluate(() => /SIGN IN/i.test(document.body.innerText ?? ""));
  console.log(`tv.youtube.com: ${signedOut ? "SIGNED OUT" : "signed in"}`);
  console.log(`url: ${page.url()}`);

  // Detaches only. Chrome keeps running and keeps the session (task-001c).
  await browser.close();
  console.log("detached (Chrome left running)");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
