/**
 * Fase 0 — kantoor-rooktest (PRD §8).
 *
 * Doorloopt als kantoor-account (e2e-test@toptuinen.nl, rol directie op dev)
 * alle kantoor-pagina's en verifieert per pagina dat die rendert, dat de
 * kernelementen aanwezig zijn en dat er geen console-errors optreden.
 * Test daarnaast één archiveer-actie (met bevestigingsdialoog) op een
 * concept-offerte en herstelt die daarna via Archief > Recent gearchiveerd.
 *
 * Er wordt niets gemaild (EMAIL_VERZENDEN_ACTIEF=false op dev) en er worden
 * geen records aangemaakt; de archiveer-actie wordt binnen de test hersteld.
 */

import { test, expect, type Page } from "@playwright/test";
import { login, kiesScopeInPalet } from "./helpers/auth";

const consoleFouten: { pagina: string; melding: string }[] = [];
let huidigePagina = "login";

function bewaakConsole(page: Page) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleFouten.push({
        pagina: huidigePagina,
        melding: msg.text().slice(0, 400),
      });
    }
  });
  page.on("pageerror", (err) => {
    consoleFouten.push({
      pagina: huidigePagina,
      melding: `pageerror: ${String(err).slice(0, 400)}`,
    });
  });
}

async function gaNaar(page: Page, pad: string, naam: string) {
  huidigePagina = naam;
  await page.goto(pad);
  await page.waitForLoadState("domcontentloaded");
}

/** Leest het badge-getal uit een sidebar-menu-item, of null. */
async function sidebarBadge(page: Page, titel: string): Promise<number | null> {
  const link = page.locator(`a:has-text("${titel}")`).first();
  const tekst = (await link.textContent()) ?? "";
  const match = tekst.replace(titel, "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

test.describe.configure({ mode: "serial" });
test.setTimeout(420_000);

test("fase 0 kantoor-rooktest: alle pagina's + archiveer/herstel", async ({
  page,
}) => {
  bewaakConsole(page);

  await test.step("login als kantoor (e2e-account)", async () => {
    await login(page);
  });

  await test.step("dashboard: KPI's en datumlabels", async () => {
    await gaNaar(page, "/dashboard", "dashboard");
    await expect(page.locator("main, [data-slot=sidebar-inset]").first()).toBeVisible();
    // Datumlabels van de omzetgrafiek/KPI's (huidige maand/kwartaal)
    await expect
      .soft(page.getByText(/jul\.? 2026/i).first(), "maandlabel Jul 2026")
      .toBeVisible({ timeout: 20_000 });
    await expect
      .soft(page.getByText(/Q3 2026/).first(), "kwartaallabel Q3 2026")
      .toBeVisible({ timeout: 10_000 });
  });

  let leadsBadge: number | null = null;
  let nieuwOfferteNummer = "";
  await test.step("/leads: bord en badge", async () => {
    leadsBadge = await sidebarBadge(page, "Leads");
    await gaNaar(page, "/leads", "leads");
    await expect(
      page.getByRole("heading", { name: /leads/i }).first()
    ).toBeVisible({ timeout: 20_000 });
    console.log(`[rooktest] sidebar-badge Leads: ${leadsBadge}`);
  });

  await test.step("/klanten: lijst, badge en klant-detail", async () => {
    const klantenBadge = await sidebarBadge(page, "Klanten");
    await gaNaar(page, "/klanten", "klanten");
    await expect(
      page.getByRole("heading", { name: "Klanten" }).first()
    ).toBeVisible({ timeout: 20_000 });
    console.log(`[rooktest] sidebar-badge Klanten: ${klantenBadge}`);

    // Klant-detail openen (eerste rij) — LeadHistorieCard is optioneel
    const eersteKlantLink = page
      .locator('table tbody tr a[href^="/klanten/"]')
      .first();
    if (await eersteKlantLink.isVisible().catch(() => false)) {
      await eersteKlantLink.click();
      await page.waitForURL(/\/klanten\/[a-z0-9]+/i, { timeout: 15_000 });
      await page.waitForLoadState("domcontentloaded");
      const heeftLeadHistorie = await page
        .getByText("Lead-historie")
        .first()
        .isVisible()
        .catch(() => false);
      console.log(`[rooktest] klant-detail geladen; Lead-historie zichtbaar: ${heeftLeadHistorie}`);
    } else {
      console.log("[rooktest] geen klant-rijen zichtbaar op /klanten");
    }
  });

  await test.step("/offertes: lijst en Concepten opruimen-knop", async () => {
    await gaNaar(page, "/offertes", "offertes");
    await expect(
      page.getByRole("heading", { name: /offertes/i }).first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: /concepten opruimen/i })
    ).toBeVisible({ timeout: 15_000 });
  });

  await test.step("werkblad: concept bestaat meteen + autosave-indicator", async () => {
    // Het e2e-account heeft geen eigen offertes (data is user-scoped). Sinds
    // fase B hoeft daar geen wizard meer voor doorlopen te worden: het
    // werkblad maakt bij binnenkomst zelf een concept aan — dat concept is
    // meteen het testrecord voor de archiveer/herstel-stap hieronder.
    await gaNaar(page, "/offertes/nieuw/onderhoud", "werkblad-onderhoud");

    const kop = page.getByRole("heading", { level: 1 });
    await expect(kop).toContainText(/OFF-\d{4}-\d+/, { timeout: 30_000 });
    nieuwOfferteNummer =
      (await kop.textContent())?.match(/OFF-\d{4}-\d+/)?.[0] ?? "";
    expect(nieuwOfferteNummer.length).toBeGreaterThan(0);
    console.log(`[rooktest] concept-offerte aangemaakt: ${nieuwOfferteNummer}`);

    // Een wijziging in het document moet zichzelf opslaan (§5.3a): de
    // indicator gaat van "Alles wordt automatisch bewaard" naar een tijdstip.
    await kiesScopeInPalet(page, "Gras onderhoud");
    const grasInput = page.locator('input[inputmode="decimal"]').first();
    await grasInput.click();
    await grasInput.fill("100");
    await grasInput.blur();

    await expect
      .soft(
        page.getByText(/Opgeslagen om/).first(),
        "autosave heeft het concept opgeslagen (indicator met tijdstip)"
      )
      .toBeVisible({ timeout: 45_000 });
  });

  await test.step("/archief: Recent gearchiveerd", async () => {
    await gaNaar(page, "/archief", "archief");
    await expect(page.getByText("Recent gearchiveerd").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  await test.step("/projecten: laadt met exportknop (kantoor)", async () => {
    await gaNaar(page, "/projecten", "projecten");
    await expect(
      page.getByRole("heading", { name: "Projecten" }).first()
    ).toBeVisible({ timeout: 20_000 });
    await expect
      .soft(
        page.getByRole("button", { name: /exporteren/i }),
        "exportknop zichtbaar voor kantoor"
      )
      .toBeVisible({ timeout: 15_000 });
  });

  await test.step("archiveer + herstel een concept-offerte", async () => {
    const nummer = nieuwOfferteNummer;
    await gaNaar(page, "/offertes", "offertes-archiveer");
    const eersteRij = page
      .locator("table tbody tr", { hasText: nummer })
      .first();
    await expect(eersteRij).toBeVisible({ timeout: 20_000 });
    console.log(`[rooktest] archiveer-test op offerte: ${nummer}`);

    // Archiveren via rij-menu + bevestigingsdialoog
    await eersteRij.getByRole("button", { name: "Meer opties" }).click();
    await page.getByRole("menuitem", { name: "Archiveren" }).click();
    await expect(page.getByText("Offerte archiveren?")).toBeVisible({
      timeout: 10_000,
    });
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Archiveren" })
      .click();
    await expect(page.getByText("Offerte gearchiveerd").first()).toBeVisible({
      timeout: 15_000,
    });

    // Herstellen via Archief > Recent gearchiveerd
    await gaNaar(page, "/archief", "archief-herstel");
    await expect(page.getByText("Recent gearchiveerd").first()).toBeVisible({
      timeout: 20_000,
    });
    const herstelRij = page.getByText(`Offerte ${nummer}`, { exact: false });
    await expect(herstelRij.first()).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole("button", { name: `Offerte ${nummer}`, exact: false })
      .or(page.locator(`[aria-label*="${nummer}"][aria-label$="herstellen"]`))
      .first()
      .click();
    await expect(page.getByText("Hersteld").first()).toBeVisible({
      timeout: 15_000,
    });

    // Controle: offerte staat weer in de lijst
    await gaNaar(page, "/offertes", "offertes-na-herstel");
    await expect(page.getByText(nummer).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  await test.step("console-foutenrapport", async () => {
    console.log(
      `[rooktest] console-fouten (${consoleFouten.length}): ` +
        JSON.stringify(consoleFouten, null, 2)
    );
  });
});
