/**
 * Fase 2 — rooktest (QA-eindronde fase 2).
 *
 * Vervolg op fase1-offerte-rooktest.spec.ts en fase1-modules-rooktest.spec.ts:
 * doorloopt als kantoor-account (e2e-test@toptuinen.nl, rol directie op dev)
 * de schermen van de fase 2-stappen en verifieert per scherm dat het rendert,
 * dat de kernelementen aanwezig zijn en dat er geen console-errors optreden:
 * - /facturen tab "Openstaand" (ouderdomsbuckets + pauzeer-dialoog, §3.2)
 * - /instellingen tab Herinneringen (DebiteurenladderCard, §3.2)
 * - /machinepark (overzicht + detail-dialoog + "Verloopt binnenkort", §3.3)
 * - /planning/lijst (filters + sortering, bijlage B lijstweergave)
 * - /planning/dagkaart (volgorde-voorstel-knop, bijlage B stap 2)
 * - /instellingen/catalogus (NormuurSuggesties-sectie, §3.4 — ook lege staat)
 * - /meldingen (debiteurentaak-filter, §3.2 trede 3)
 * - /portaal/*: het e2e-account is staf (directie) en hoort door de proxy
 *   naar het dashboard teruggestuurd te worden. De ingelogde portaal-flow
 *   zelf vergt een klant-testaccount en valt buiten deze rooktest.
 *
 * Robuustheidslessen uit de fase 1-rooktests: expliciet wachten op
 * kop-teksten, geen stille if-checks die een stap ongemerkt overslaan
 * (data-afhankelijke takken asserteren beide kanten en annoteren welke tak
 * liep), test-timeout hard begrensd. Er wordt niets gemaild
 * (EMAIL_VERZENDEN_ACTIEF=false op dev) en niets aangemaakt of gewijzigd —
 * dialogen worden geopend en geannuleerd.
 */

import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers/auth";

const consoleFouten: { pagina: string; melding: string }[] = [];
let huidigePagina = "login";

// Bekende ruis die geen functioneel defect is (zelfde filter-gedachte als de
// fase 1-rooktests): niets uitfilteren tenzij aantoonbaar omgevingsruis.
const GENEGEERDE_PATRONEN: RegExp[] = [
  /Clerk.*development.*keys/i, // dev-keys-banner van Clerk op dev
  /Failed to load resource.*40[134]/i, // losse asset/auth-probes op dev
];

function bewaakConsole(page: Page) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const tekst = msg.text();
      if (GENEGEERDE_PATRONEN.some((p) => p.test(tekst))) return;
      consoleFouten.push({
        pagina: huidigePagina,
        melding: tekst.slice(0, 400),
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

test("fase 2 rooktest: debiteuren, machinepark, planning-lijst, nacalculatie", async ({
  page,
}) => {
  bewaakConsole(page);

  await test.step("login als kantoor (e2e-account)", async () => {
    await login(page);
  });

  await test.step("/facturen tab Openstaand: buckets + pauzeer-dialoog", async () => {
    await gaNaar(page, "/facturen", "facturen-openstaand");
    await expect(
      page.getByRole("tab", { name: "Openstaand" })
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("tab", { name: "Openstaand" }).click();

    // Vier ouderdomsbuckets (§3.2) — labels uit BUCKET_LABELS.
    for (const label of [
      "0–14 dagen",
      "14–30 dagen",
      "30–60 dagen",
      "60+ dagen",
    ]) {
      await expect(page.getByText(label).first()).toBeVisible({
        timeout: 20_000,
      });
    }
    await expect(
      page.getByText("Openstaande posten", { exact: true })
    ).toBeVisible({ timeout: 20_000 });

    // Pauzeer-dialoog: alleen te openen als er een actieve (niet-gepauzeerde)
    // openstaande post is. Geen stille overslag: de lege staat wordt expliciet
    // geasserteerd en geannoteerd.
    const pauzeerKnop = page
      .getByRole("button", { name: "Pauzeren" })
      .first();
    const legeStaat = page.getByText("Geen openstaande posten");
    await expect(pauzeerKnop.or(legeStaat).first()).toBeVisible({
      timeout: 20_000,
    });
    if (await pauzeerKnop.isVisible()) {
      await pauzeerKnop.click();
      await expect(
        page.getByRole("heading", { name: "Debiteurenladder pauzeren" })
      ).toBeVisible({ timeout: 10_000 });
      // Annuleren — er wordt niets gepauzeerd.
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("heading", { name: "Debiteurenladder pauzeren" })
      ).toBeHidden({ timeout: 10_000 });
      test.info().annotations.push({
        type: "tak",
        description: "openstaand: pauzeer-dialoog geopend en geannuleerd",
      });
    } else {
      await expect(legeStaat).toBeVisible();
      test.info().annotations.push({
        type: "tak",
        description:
          "openstaand: geen actieve posten op dev — lege staat geasserteerd, pauzeer-dialoog niet te openen",
      });
    }
  });

  await test.step("/instellingen tab Herinneringen: DebiteurenladderCard", async () => {
    await gaNaar(page, "/instellingen", "instellingen-herinneringen");
    const herinneringenTab = page.getByRole("tab", { name: "Herinneringen" });
    await expect(herinneringenTab).toBeVisible({ timeout: 30_000 });
    await herinneringenTab.click();
    await expect(
      page.getByText("Debiteurenladder", { exact: true }).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  await test.step("/machinepark: overzicht + detail-dialoog + vervalsignaal", async () => {
    await gaNaar(page, "/machinepark", "machinepark");
    await expect(
      page.getByRole("heading", { name: "Machinepark", exact: true })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("tab", { name: "Overzicht" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("tab", { name: "Teams & bussen" })
    ).toBeVisible();

    // Overzichtstabel of expliciete lege staat — geen derde mogelijkheid.
    const detailKnop = page
      .getByRole("button", { name: /^(Beheer|Details)$/ })
      .first();
    const legeStaat = page.getByText("Nog geen materieel");
    await expect(detailKnop.or(legeStaat).first()).toBeVisible({
      timeout: 20_000,
    });
    if (await detailKnop.isVisible()) {
      await detailKnop.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
      test.info().annotations.push({
        type: "tak",
        description: "machinepark: detail-dialoog geopend en gesloten",
      });
    } else {
      await expect(legeStaat).toBeVisible();
      test.info().annotations.push({
        type: "tak",
        description: "machinepark: geen materieel op dev — lege staat geasserteerd",
      });
    }

    // "Verloopt binnenkort" rendert alleen bij items binnen de termijn —
    // beide takken expliciet vastleggen.
    const vervalBanner = page.getByText("Verloopt binnenkort");
    if (await vervalBanner.isVisible()) {
      await expect(page.getByRole("status")).toBeVisible();
      test.info().annotations.push({
        type: "tak",
        description: "machinepark: 'Verloopt binnenkort'-banner zichtbaar",
      });
    } else {
      test.info().annotations.push({
        type: "tak",
        description:
          "machinepark: geen vervalitems binnen de waarschuwtermijn op dev — banner terecht afwezig",
      });
    }
  });

  await test.step("/planning/lijst: filters + sortering", async () => {
    await gaNaar(page, "/planning/lijst", "planning-lijst");
    await expect(
      page.getByRole("heading", { name: "Afsprakenlijst", exact: true })
    ).toBeVisible({ timeout: 30_000 });

    // Weergave-tabs + filters aanwezig.
    await expect(page.getByRole("tab", { name: "Alle" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel("Team")).toBeVisible();
    await expect(page.getByLabel("Status")).toBeVisible();
    await expect(page.getByLabel("Van")).toBeVisible();
    await expect(page.getByLabel("Tot en met")).toBeVisible();

    // De sorteerkoppen renderen alleen mét rijen; zet de periode ruim zodat
    // bestaande dev-afspraken (verleden én toekomst) binnen het venster vallen.
    await page.getByLabel("Van").fill("2020-01-01");
    await page.getByLabel("Tot en met").fill("2030-12-31");

    const sorteerDatum = page.getByRole("button", {
      name: "Sorteer op Datum",
    });
    const geenAfspraken = page.getByText("Geen afspraken in deze periode");
    await expect(sorteerDatum.or(geenAfspraken).first()).toBeVisible({
      timeout: 20_000,
    });
    if (await sorteerDatum.isVisible()) {
      // Sorteren: kolomkop-knoppen zijn klikbaar en de pagina blijft staan.
      await sorteerDatum.click();
      await sorteerDatum.click(); // asc → desc → weer asc: geen crash
      await expect(
        page.getByRole("button", { name: "Sorteer op Team" })
      ).toBeVisible();
      await page.getByRole("button", { name: "Sorteer op Team" }).click();
      await expect(
        page.getByRole("heading", { name: "Afsprakenlijst", exact: true })
      ).toBeVisible();
      test.info().annotations.push({
        type: "tak",
        description: "lijst: sortering op Datum en Team doorlopen",
      });
    } else {
      await expect(geenAfspraken).toBeVisible();
      test.info().annotations.push({
        type: "tak",
        description:
          "lijst: geen afspraken op dev (2020–2030) — lege staat geasserteerd, sortering niet klikbaar",
      });
    }
  });

  await test.step("/planning/dagkaart: volgorde-voorstel-knop", async () => {
    await gaNaar(page, "/planning/dagkaart", "dagkaart");
    await expect(
      page.getByRole("heading", { name: "Dagkaart", exact: true })
    ).toBeVisible({ timeout: 30_000 });

    // De knop "Stel volgorde voor" rendert alleen bij ≥2 stops op de kaart.
    // Beide takken expliciet: knop zichtbaar, of aantoonbaar <2 stops
    // (lege-dag-tekst of geen actieve teams).
    const volgordeKnop = page.getByRole("button", {
      name: "Stel volgorde voor",
    });
    const legeDag = page.getByText("Geen opdrachten op deze dag");
    const geenTeams = page.getByText("Nog geen actieve teams");
    await expect(
      volgordeKnop.or(legeDag).or(geenTeams).first()
    ).toBeVisible({ timeout: 30_000 });
    if (await volgordeKnop.isVisible()) {
      test.info().annotations.push({
        type: "tak",
        description: "dagkaart: 'Stel volgorde voor' zichtbaar (≥2 stops)",
      });
    } else if (await legeDag.isVisible()) {
      test.info().annotations.push({
        type: "tak",
        description:
          "dagkaart: geen (of één) stop vandaag — knop terecht afwezig; lege-dag-tekst geasserteerd",
      });
    } else {
      // 1 stop laat de knop weg maar toont wél een stop; dat pad valt
      // hierbuiten. Alleen 'geen teams' resteert als geldige derde staat.
      await expect(geenTeams).toBeVisible();
      test.info().annotations.push({
        type: "tak",
        description: "dagkaart: geen actieve teams op dev",
      });
    }
  });

  await test.step("/instellingen/catalogus: NormuurSuggesties-sectie", async () => {
    await gaNaar(page, "/instellingen/catalogus", "catalogus-normuur");
    // De kaart rendert voor kantoor altijd zodra de data geladen is — ook in
    // de lege staat (zichtbare lege-staat-tekst i.p.v. verdwenen sectie).
    await expect(page.getByTestId("normuur-suggesties")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText("Normuur-suggesties uit nacalculatie")
    ).toBeVisible();
    const legeStaat = page.getByTestId("normuur-suggesties-leeg");
    if (await legeStaat.isVisible()) {
      test.info().annotations.push({
        type: "tak",
        description: "catalogus: normuur-suggesties in lege staat gerenderd",
      });
    } else {
      test.info().annotations.push({
        type: "tak",
        description: "catalogus: normuur-suggesties met voorstellen gevuld",
      });
    }
  });

  await test.step("/meldingen: debiteurentaak-filter", async () => {
    await gaNaar(page, "/meldingen", "meldingen-debiteuren");
    await expect(
      page.getByRole("heading", { name: "Meldingen", exact: true })
    ).toBeVisible({ timeout: 30_000 });

    // Taaksoort-filter: optie "Debiteurentaken" bestaat en filtert zonder crash.
    const taaksoortSelect = page
      .getByRole("combobox")
      .filter({ hasText: "Alles" })
      .first();
    await expect(taaksoortSelect).toBeVisible({ timeout: 20_000 });
    await taaksoortSelect.click();
    await expect(
      page.getByRole("option", { name: "Debiteurentaken" })
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("option", { name: "Debiteurentaken" }).click();
    // Bord blijft renderen na filteren.
    await expect(
      page.getByRole("heading", { name: "Meldingen", exact: true })
    ).toBeVisible();
  });

  await test.step("/portaal: staf wordt teruggestuurd naar dashboard", async () => {
    // Het e2e-account is directie; staf hoort van /portaal/* naar /dashboard
    // gestuurd te worden — door de proxy (Clerk-claim) of anders door de
    // Convex-rol-guard in de portaal-layout. De ingelogde klant-flow van het
    // portaal vergt een apart klant-testaccount en valt buiten deze rooktest.
    huidigePagina = "portaal-afscherming";
    await page.goto("/portaal/overzicht");
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    expect(
      page.url(),
      "staf-account mag niet op het klantportaal landen"
    ).toContain("/dashboard");
    test.info().annotations.push({
      type: "let-op",
      description:
        "portaal: alleen afscherming getest — ingelogde portaal-flow vergt een klant-testaccount",
    });
  });

  await test.step("geen console-errors op de bezochte schermen", async () => {
    expect(
      consoleFouten,
      `Console-errors:\n${consoleFouten
        .map((f) => `- [${f.pagina}] ${f.melding}`)
        .join("\n")}`
    ).toEqual([]);
  });
});
