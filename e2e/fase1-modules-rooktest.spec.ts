/**
 * Fase 1 — rooktest nieuwe modules (QA-eindronde fase 1).
 *
 * Vervolg op fase1-offerte-rooktest.spec.ts: doorloopt als kantoor-account
 * (e2e-test@toptuinen.nl, rol directie op dev) de schermen van de latere
 * fase 1-stappen en verifieert per scherm dat het rendert, dat de
 * kernelementen aanwezig zijn en dat er geen console-errors optreden:
 * - /planning/weekbord (bord + opdrachtenbak)
 * - /planning/dagkaart (kop + inhoud)
 * - /veld (Mijn dag, Buiten-modus-toggle, noodprotocol-knop)
 * - /meldingen (bord + aanmaak-dialoog)
 * - /mails (concept-wachtrij)
 * - /instellingen/mailtriggers (beheerscherm)
 * - /facturen (Te versturen-tab + bulk-selectie)
 * - /facturen/nieuw (losse factuur, regel-editor)
 * - /instellingen/catalogus en /instellingen/tekstblokken (regressie)
 *
 * Robuustheidslessen uit de eerste rooktest: expliciet wachten op
 * kop-teksten, geen stille if-checks die een stap ongemerkt overslaan,
 * test-timeout hard begrensd. Er wordt niets gemaild
 * (EMAIL_VERZENDEN_ACTIEF=false op dev) en niets aangemaakt of gewijzigd.
 */

import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers/auth";

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

test("fase 1 rooktest: planning, veld, meldingen, mails en facturatie", async ({
  page,
}) => {
  bewaakConsole(page);

  await test.step("login als kantoor (e2e-account)", async () => {
    await login(page);
  });

  await test.step("/planning/weekbord: bord + opdrachtenbak renderen", async () => {
    await gaNaar(page, "/planning/weekbord", "weekbord");
    await expect(
      page.getByRole("heading", { name: "Weekbord", exact: true })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("opdrachtenbak")).toBeVisible({
      timeout: 20_000,
    });
  });

  await test.step("/planning/dagkaart: kop + dagweergave", async () => {
    await gaNaar(page, "/planning/dagkaart", "dagkaart");
    await expect(
      page.getByRole("heading", { name: "Dagkaart", exact: true })
    ).toBeVisible({ timeout: 30_000 });
    // De dagkaart-component is klaar met laden zodra de laad-tekst weg is.
    await expect(page.getByText("Dagkaart laden…")).toHaveCount(0, {
      timeout: 30_000,
    });
  });

  await test.step("/veld: Mijn dag + Buiten-modus + noodprotocol", async () => {
    await gaNaar(page, "/veld", "veld");
    await expect(
      page.getByRole("heading", { name: "Mijn dag" })
    ).toBeVisible({ timeout: 30_000 });
    // Noodprotocol-knop is altijd zichtbaar (bijlage C)
    const noodKnop = page.getByRole("button", { name: "Noodprotocol" });
    await expect(noodKnop).toBeVisible();
    // Buiten-modus togglet aantoonbaar (aria-pressed + data-attribuut)
    const buitenKnop = page.getByRole("button", { name: "Buiten" });
    await expect(buitenKnop).toBeVisible();
    await expect(buitenKnop).toHaveAttribute("aria-pressed", "false");
    await buitenKnop.click();
    await expect(buitenKnop).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-buiten-modus='1']")).toBeVisible();
    // Terug naar normaal om geen toestand achter te laten
    await buitenKnop.click();
    await expect(buitenKnop).toHaveAttribute("aria-pressed", "false");
    // Noodprotocol-dialoog opent en toont de 112-instructie
    await noodKnop.click();
    await expect(
      page.getByRole("dialog").getByText(/112/).first()
    ).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
  });

  await test.step("/meldingen: bord + aanmaak-dialoog", async () => {
    await gaNaar(page, "/meldingen", "meldingen");
    await expect(
      page.getByRole("heading", { name: "Meldingen", exact: true })
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Nieuwe melding" }).click();
    await expect(
      page.getByRole("dialog").getByText("Nieuwe melding").first()
    ).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
  });

  await test.step("/mails: concept-wachtrij rendert", async () => {
    await gaNaar(page, "/mails", "mails");
    await expect(
      page.getByRole("heading", { name: "Concept-mails" })
    ).toBeVisible({ timeout: 30_000 });
  });

  await test.step("/instellingen/mailtriggers: beheerscherm rendert", async () => {
    await gaNaar(page, "/instellingen/mailtriggers", "mailtriggers");
    await expect(
      page.getByRole("heading", { name: "Mail-triggers", exact: true })
    ).toBeVisible({ timeout: 30_000 });
  });

  await test.step("/facturen: Te versturen-tab + bulk-selectie", async () => {
    await gaNaar(page, "/facturen", "facturen");
    await expect(
      page.getByRole("heading", { name: "Facturen", exact: true })
    ).toBeVisible({ timeout: 30_000 });
    const wachtrijTab = page.getByRole("tab", { name: /Te versturen/ });
    await expect(wachtrijTab).toBeVisible({ timeout: 20_000 });
    await wachtrijTab.click();
    await expect(wachtrijTab).toHaveAttribute("aria-selected", "true");
    // Met concepten in de wachtrij is de bulk-balk (selecteer-alles) zichtbaar;
    // is de wachtrij leeg, dan hoort de lege-staat er te staan. Beide bewijzen
    // dat de tab inhoudelijk rendert — geen stille pass op een kale pagina.
    await expect(
      page
        .locator("#selecteer-alles")
        .or(page.getByText(/Geen facturen gevonden|Nog geen facturen/))
        .first()
    ).toBeVisible({ timeout: 20_000 });
  });

  await test.step("/facturen/nieuw: regel-editor rendert", async () => {
    await gaNaar(page, "/facturen/nieuw", "facturen-nieuw");
    await expect(
      page.getByRole("heading", { name: "Nieuwe factuur" })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Factuurgegevens").first()).toBeVisible();
    await expect(page.getByText("Totalen").first()).toBeVisible();
  });

  await test.step("/instellingen/catalogus: regressie — lijst rendert", async () => {
    await gaNaar(page, "/instellingen/catalogus", "catalogus-regressie");
    await expect(
      page.getByRole("heading", { name: "Catalogus onderhoud" })
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: /^Acties voor / }).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  await test.step("/instellingen/tekstblokken: regressie — bibliotheek rendert", async () => {
    await gaNaar(page, "/instellingen/tekstblokken", "tekstblokken-regressie");
    await expect(
      page.getByRole("heading", { name: "Tekstblokken" })
    ).toBeVisible({ timeout: 30_000 });
  });

  await test.step("console-foutenrapport", async () => {
    if (consoleFouten.length > 0) {
      console.log("Console-fouten tijdens module-rooktest:");
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
