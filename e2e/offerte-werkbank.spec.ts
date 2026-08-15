import { test, expect } from "@playwright/test";
import {
  hasTestCredentials,
  login,
  navigateToNieuweAanleg,
  navigateToNieuwOnderhoud,
  waitForConvexData,
  kiesScopeInPalet,
} from "./helpers/auth";

// ---------------------------------------------------------------------------
// Het werkblad — /offertes/nieuw/aanleg en /offertes/nieuw/onderhoud
//
// Verving de 5-stapswizard (masterplan offerte-entree, fase B). Wat deze
// specs bewaken is bewust data-onafhankelijk: dat de offerte al bestaat bij
// binnenkomst, dat het palet scopes live in het document zet, dat `?scope=`
// het contract met de entree nakomt, en dat er nooit zijwaarts gescrold
// wordt. Bedragen en regels hangen van normuren en producten af en horen
// daarom in de unit-tests (`src/__tests__/unit/werkbank.test.ts`).
// ---------------------------------------------------------------------------

const OFFERTENUMMER = /OFF-\d{4}-\d+/;

test.describe("Offerte-werkblad", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCredentials(), "E2E-auth is niet geconfigureerd");
    await login(page);
  });

  test("aanleg: de offerte bestaat meteen, zonder tussenstap", async ({
    page,
  }) => {
    await navigateToNieuweAanleg(page);
    await waitForConvexData(page);

    // Geen stepper, geen "Beginnen": een offertenummer in de kop.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      OFFERTENUMMER,
      { timeout: 20_000 }
    );
    await expect(page.getByText("Werkblad · Aanleg")).toBeVisible();
    await expect(page.getByText(/Stap \d+ van \d+/)).toHaveCount(0);

    // Het id staat in de URL, zodat herladen hetzelfde concept oppakt.
    await expect(page).toHaveURL(/offerte=/);
  });

  test("zonder klant blijft het een concept en zegt het werkblad dat ook", async ({
    page,
  }) => {
    await navigateToNieuweAanleg(page);
    await waitForConvexData(page);

    await expect(page.getByText("Nog geen klant gekoppeld")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText(/Een klant is verplicht vóór versturen/)
    ).toBeVisible();
  });

  test("het palet zet een scope live in het document en haalt hem er weer uit", async ({
    page,
  }) => {
    await navigateToNieuweAanleg(page);
    await waitForConvexData(page);

    await expect(page.getByText("Kies een werkzaamheid om te beginnen")).toBeVisible(
      { timeout: 20_000 }
    );

    await kiesScopeInPalet(page, "Bestrating");
    await expect(page.locator("#werkbank-scope-bestrating")).toBeVisible({
      timeout: 10_000,
    });

    await kiesScopeInPalet(page, "Bestrating");
    await expect(page.locator("#werkbank-scope-bestrating")).toHaveCount(0);
  });

  test("de lettertoets doet hetzelfde als de paletknop", async ({ page }) => {
    await navigateToNieuweAanleg(page);
    await waitForConvexData(page);

    await page.getByRole("heading", { level: 1 }).click();
    await page.keyboard.press("s");

    await expect(page.locator("#werkbank-scope-bestrating")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("?scope= uit de entree staat meteen open, onzin wordt genegeerd", async ({
    page,
  }) => {
    await page.goto(
      "/offertes/nieuw/aanleg?scope=grondwerk&scope=borders&scope=gras&scope=heggen"
    );
    await waitForConvexData(page);

    await expect(page.locator("#werkbank-scope-grondwerk")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("#werkbank-scope-borders")).toBeVisible();
    await expect(page.locator("#werkbank-scope-gras")).toBeVisible();
    // "heggen" hoort bij onderhoud en mag hier niet landen (TT-004).
    await expect(page.locator("#werkbank-scope-heggen")).toHaveCount(0);
  });

  test("onderhoud opent zijn eigen palet en het onderhoudscontract", async ({
    page,
  }) => {
    await navigateToNieuwOnderhoud(page);
    await waitForConvexData(page);

    await expect(page.getByText("Werkblad · Onderhoud")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { name: "Onderhoudscontract" })
    ).toBeVisible();
    // Garantie is een aanleg-keuze; die hoort hier niet te staan.
    await expect(
      page.getByRole("radiogroup", { name: "Garantiepakket" })
    ).toHaveCount(0);
  });

  test("scrolt nooit zijwaarts — ook niet op een smal scherm", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto("/offertes/nieuw/onderhoud?scope=gras");
    await waitForConvexData(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      OFFERTENUMMER,
      { timeout: 20_000 }
    );

    const overloop = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(overloop).toBeLessThanOrEqual(0);

    // Op smal formaat staat het palet bóven het document — niet weggelaten.
    await expect(page.getByRole("heading", { name: "Palet" })).toBeVisible();
  });
});
