/** Tijdelijk schouw-script: logt in via het dev-ticket en schiet pagina's af. */
import { chromium } from "@playwright/test";

const BASIS = "http://localhost:3000";
const UIT = process.env.UIT_DIR;
const DOELEN = JSON.parse(process.env.DOELEN); // [{pad, naam, breedte}]

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(BASIS, { waitUntil: "networkidle" });
const uitkomst = await page.evaluate(async () => {
  const r = await fetch("/dev-login-ticket.js", { cache: "no-store" });
  const { ticket } = await r.json();
  await window.Clerk.load();
  const s = await window.Clerk.client.signIn.create({ strategy: "ticket", ticket });
  if (s.status !== "complete") return "status=" + s.status;
  await window.Clerk.setActive({ session: s.createdSessionId });
  return "ok";
});
if (uitkomst !== "ok") { console.error("Inloggen mislukte:", uitkomst); process.exit(1); }

for (const doel of DOELEN) {
  await page.setViewportSize({ width: doel.breedte ?? 1440, height: 900 });
  await page.goto(`${BASIS}${doel.pad}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${UIT}/${doel.naam}.png`, fullPage: true });
  console.log("✓", doel.naam);
}
await browser.close();
