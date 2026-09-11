import { createInterface } from "node:readline/promises";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type BrowserContext } from "playwright";

const PROFILE_DIR = resolve("data/chrome-profile");
const CHROME_PATH = "/usr/bin/google-chrome";
const TARGET = "https://tv.youtube.com";

/**
 * Launch the INSTALLED Google Chrome, not Playwright's bundled Chromium:
 * bundled Chromium ships no Widevine CDM, so DRM playback cannot be
 * evaluated there. Prefer channel resolution; fall back to the known path.
 */
async function launchChrome(): Promise<BrowserContext> {
  const opts = {
    headless: false,
    viewport: null,
    /* Playwright's default args include --password-store=basic, which makes Chrome
     * derive its cookie-encryption key from a hardcoded string (the "v10" scheme).
     * Plain Chrome on this desktop autodetects gnome-libsecret and writes "v11"
     * cookies instead, so a hand-login done in plain Chrome is undecryptable to a
     * Playwright-launched Chrome, which silently drops those cookies and then
     * overwrites them. Chrome honours the LAST occurrence of a repeated switch, so
     * appending this overrides Playwright's default and both launches share one
     * keyring-backed store. */
    args: ["--start-maximized", "--password-store=gnome-libsecret"],
  };
  try {
    return await chromium.launchPersistentContext(PROFILE_DIR, {
      ...opts,
      channel: "chrome",
    });
  } catch (err) {
    console.error(`channel:"chrome" failed (${(err as Error).message.split("\n")[0]}); falling back to ${CHROME_PATH}`);
    return await chromium.launchPersistentContext(PROFILE_DIR, {
      ...opts,
      executablePath: CHROME_PATH,
    });
  }
}

const main = async () => {
  mkdirSync(PROFILE_DIR, { recursive: true });

  const context = await launchChrome();
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });

  console.log(
    "\nOWNER: connect to marlinpc with Jump Desktop, log in to YouTube TV " +
      "in the Chrome window on that desktop, then press Enter here",
  );

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("");
  rl.close();

  const shot = resolve(`notebook/reports/login-state-${Date.now()}.png`);
  await page.screenshot({ path: shot });
  console.log(`screenshot: ${shot}`);
  console.log(`url: ${page.url()}`);

  await context.close();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
