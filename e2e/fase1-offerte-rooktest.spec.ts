/**
 * Fase 1 — rooktest offerte-blok (PRD §2.5, QA-consolidatieronde).
 *
 * Doorloopt als kantoor-account (e2e-test@toptuinen.nl, rol directie op dev)
 * de nieuwe schermen van het offerte-blok en verifieert per scherm dat het
 * rendert, dat de kernelementen aanwezig zijn en dat er geen console-errors
 * optreden:
 * - /instellingen/catalogus (lijst, bewerken-dialoog, live-berekening,
 *   keuzeregel-optieprijzen)
 * - /instellingen/tekstblokken
 * - /contracten/nieuw (bouwsteen-kiezer, jaarprijs/maandbedrag, facturatie)
 * - klant-detail onderhoud-sectie (contracten + losse beurten)
 * - offerte-wizard stap Bouwstenen (tegels, live doorrekening, zand-keuze)
 * - /offertes/nieuw/vrij + regel-editor (picker, marge↔verkoop, overzichts-
 *   blok, tekstblok-kiezer)
 * - /leveranciers (import-dialoog opent)
 *
 * Er wordt niets gemaild (EMAIL_VERZENDEN_ACTIEF=false op dev). De vrije
 * offerte die de editor-test aanmaakt wordt binnen de test gearchiveerd.
 */

import { test, expect, type Page } from "@playwright/test";
import { login, fillKlantData, getTestKlantData } from "./helpers/auth";

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
      melding: `pageerror: ${err.message.slice(0, 400)}`,
    });
  });
}

async function gaNaar(page: Page, pad: string, naam: string) {
  huidigePagina = naam;
  await page.goto(pad);
  await page.waitForLoadState("domcontentloaded");
}

test.describe.configure({ mode: "serial" });
// Ruim maar begrensd: een vastgelopen server mag de run nooit urenlang gijzelen.
test.setTimeout(120_000);

test("fase 1 rooktest: nieuwe offerte-schermen", async ({ page }) => {
  bewaakConsole(page);

  await test.step("login als kantoor (e2e-account)", async () => {
    await login(page);
  });

  await test.step("/instellingen/catalogus: lijst + form + live-berekening + optieprijzen", async () => {
    await gaNaar(page, "/instellingen/catalogus", "catalogus");
    await expect(
      page.getByRole("heading", { name: "Catalogus onderhoud" })
    ).toBeVisible({ timeout: 30_000 });
    // Lijst met minstens één bouwsteen-rij (acties-knop aanwezig)
    const actieKnoppen = page.getByRole("button", { name: /^Acties voor / });
    await expect(actieKnoppen.first()).toBeVisible({ timeout: 20_000 });

    // Nieuwe bouwsteen: live-berekening reageert op uren-invoer
    await page.getByRole("button", { name: "Nieuwe bouwsteen" }).click();
    await expect(
      page.getByRole("heading", { name: "Nieuwe bouwsteen" })
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: /geschatte uren per beurt/i })
      .fill("2");
    await expect(page.getByTestId("live-berekening")).toContainText(
      /per beurt|uurtarief/i
    );

    // Keuzeregel-optieprijzen (fix zand #17): velden verschijnen bij soort
    await page.getByLabel(/^Soort/).first().click();
    await page.getByRole("option", { name: "Keuzeregel" }).click();
    await expect(
      page.getByRole("textbox", { name: /prijs onkruidvrij voegzand/i })
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: /prijs straatzand/i })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // Bewerken-dialoog van een bestaande bouwsteen opent voorgevuld
    await actieKnoppen.first().click();
    await page.getByRole("menuitem", { name: /bewerken/i }).click();
    await expect(
      page.getByRole("heading", { name: "Bouwsteen bewerken" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  await test.step("/instellingen/tekstblokken: bibliotheek rendert", async () => {
    await gaNaar(page, "/instellingen/tekstblokken", "tekstblokken");
    await expect(
      page.getByRole("heading", { name: "Tekstblokken" })
    ).toBeVisible({ timeout: 30_000 });
  });

  await test.step("/contracten/nieuw: wizard met stappen rendert", async () => {
    await gaNaar(page, "/contracten/nieuw", "contracten-nieuw");
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    // Stap-kaart zichtbaar (STEPS[currentStep].title)
    await expect(page.locator("[data-slot=card-title]").first()).toBeVisible();
  });

  await test.step("klant-detail: onderhoud-sectie met contracten + losse beurten", async () => {
    await gaNaar(page, "/klanten", "klanten");
    const klantLink = page.locator('a[href^="/klanten/"]').first();
    await expect(klantLink).toBeVisible({ timeout: 30_000 });
    huidigePagina = "klant-detail";
    await klantLink.click();
    await expect(page.getByText("Onderhoud").first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText(/Contracten en losse beurten/).first()
    ).toBeVisible();
  });

  await test.step("offerte-wizard stap Bouwstenen: tegels + doorrekening + zand", async () => {
    await gaNaar(page, "/offertes/nieuw/onderhoud", "wizard-onderhoud");
    // Stap 1 is altijd Snelstart: expliciet wachten en doorklikken — een
    // stille if-check liet de test eerder op stap 1 achter, waarna
    // fillKlantData een naam-veld zocht dat daar niet bestaat.
    const startKnop = page.getByRole("button", { name: /start vanaf nul/i });
    await expect(startKnop).toBeVisible({ timeout: 20_000 });
    await startKnop.click();
    await expect(page.getByText(/Stap 2 van \d+/)).toBeVisible({
      timeout: 20_000,
    });
    await fillKlantData(page, getTestKlantData());
    // "Volgende: Details" blijft disabled tot er minstens één
    // werkzaamheid is aangevinkt. Kies Reiniging: die scope heeft geen
    // verplichte detailvelden op stap 3 (gras zou daar blokkeren op
    // oppervlakte > 0) én raakt de reinigingsreceptuur in de Bouwstenen-stap.
    await page.getByRole("checkbox", { name: /^reiniging/i }).check();
    // Doorklikken tot de Bouwstenen-stap zichtbaar is (max 4 stappen)
    for (let i = 0; i < 4; i++) {
      const opBouwstenen = await page
        .getByText(/Stap \d+ van \d+: Bouwstenen/)
        .isVisible()
        .catch(() => false);
      if (opBouwstenen) break;
      await page.getByRole("button", { name: /volgende/i }).click();
      await page.waitForTimeout(1_500);
    }
    await expect(page.getByText(/Stap \d+ van \d+: Bouwstenen/)).toBeVisible({
      timeout: 20_000,
    });
    // Pakket-tegels bovenin (bijlage A)
    await expect(page.getByText(/compleet/i).first()).toBeVisible();
    // Live doorrekening: zet een bouwsteen aan → jaarprijs/maandbedrag vullen
    const eersteSwitch = page.getByRole("switch", { name: / aan\/uit$/ });
    await expect(eersteSwitch.first()).toBeVisible({ timeout: 20_000 });
    await eersteSwitch.first().click();
    await expect(page.getByTestId("catalogus-jaarprijs")).toBeVisible();
    await expect(page.getByTestId("catalogus-maandbedrag")).toBeVisible();
    // Zand-keuzeregel: aanzetten → beide optieprijzen zichtbaar
    const zandSwitch = page.getByRole("switch", { name: /zand.* aan\/uit$/i });
    if (await zandSwitch.first().isVisible().catch(() => false)) {
      await zandSwitch.first().click();
      await expect(
        page.getByText("Onkruidvrij voegzand").first()
      ).toBeVisible();
      await expect(page.getByText("Straatzand").first()).toBeVisible();
    }
    // Wizard verlaten zonder op te slaan
    await gaNaar(page, "/offertes", "offertes");
  });

  let vrijeOfferteNummer = "";
  await test.step("/offertes/nieuw/vrij + editor: picker, marge, overzicht, tekstblokken", async () => {
    await gaNaar(page, "/offertes/nieuw/vrij", "vrij-start");
    await expect(
      page.getByRole("heading", { name: "Vrije offerte" })
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("combobox", { name: "Kies klant" }).click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Naar de regel-editor" }).click();

    huidigePagina = "vrij-editor";
    const editorKop = page.getByRole("heading", { name: /^Vrije offerte / });
    await expect(editorKop).toBeVisible({ timeout: 30_000 });
    vrijeOfferteNummer =
      (await editorKop.textContent())?.replace("Vrije offerte", "").trim() ??
      "";
    expect(vrijeOfferteNummer.length).toBeGreaterThan(0);

    // Overzichtsblok + tekstblok-kiezer + artikel-picker aanwezig
    await expect(page.getByTestId("overzichtsblok")).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: /kies aanhef-tekstblok/i })
    ).toBeVisible();
    // Regel toevoegen → marge↔verkoopprijs-velden van de regel-editor
    const regelKnop = page
      .getByRole("button", { name: /regel|artikel/i })
      .first();
    await regelKnop.click();
    // Artikel-picker (zoekveld) of direct een lege regel
    const zoekArtikel = page.getByRole("textbox", { name: "Zoek artikel" });
    if (await zoekArtikel.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.keyboard.press("Escape");
    }
    const regelRij = page.getByTestId("vrije-regel").first();
    if (await regelRij.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(
        regelRij.getByRole("textbox", { name: "Marge percentage" })
      ).toBeVisible();
      await expect(
        regelRij.getByRole("textbox", { name: "Verkoopprijs per eenheid" })
      ).toBeVisible();
    }
  });

  await test.step("opruimen: vrije concept-offerte archiveren", async () => {
    if (!vrijeOfferteNummer) return;
    await gaNaar(page, "/offertes", "offertes-opruimen");
    const rij = page
      .locator("table tbody tr", { hasText: vrijeOfferteNummer })
      .first();
    await expect(rij).toBeVisible({ timeout: 20_000 });
    await rij.getByRole("button", { name: "Meer opties" }).click();
    await page.getByRole("menuitem", { name: "Archiveren" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Archiveren" })
      .click();
    await expect(page.getByText("Offerte gearchiveerd").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step("/leveranciers: import-dialoog opent", async () => {
    await gaNaar(page, "/leveranciers", "leveranciers");
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    const importKnop = page.getByRole("button", { name: /import/i }).first();
    await expect(importKnop).toBeVisible({ timeout: 20_000 });
    await importKnop.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
  });

  await test.step("console-foutenrapport", async () => {
    if (consoleFouten.length > 0) {
      console.log("Console-fouten tijdens rooktest:");
      for (const fout of consoleFouten) {
        console.log(`- [${fout.pagina}] ${fout.melding}`);
      }
    }
    const echteFouten = consoleFouten.filter(
      (f) =>
        !/favicon|404|hydrat|Download the React DevTools|third-party cookie/i.test(
          f.melding
        )
    );
    expect(echteFouten, JSON.stringify(echteFouten, null, 2)).toHaveLength(0);
  });
});
