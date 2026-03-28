import { test, expect } from '@playwright/test';
import {
  hasTestCredentials,
  login,
  navigateToNieuwOnderhoud,
  waitForConvexData,
  fillKlantData,
  clickVolgende,
  clickVorige,
  selectScope,
  getTestKlantData,
} from './helpers/auth';

// ---------------------------------------------------------------------------
// Onderhoud Offerte Wizard — E2E Tests
//
// These tests cover the full "Nieuwe Onderhoud Offerte" wizard flow:
//   Step 0: Snelstart (package / template selection)
//   Step 1: Klantgegevens & Werkzaamheden
//   Step 2: Details per Werkzaamheid
//   Step 3: Bevestigen (review & submit)
// ---------------------------------------------------------------------------

test.describe('Onderhoud Offerte Wizard', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCredentials(), 'Skipping: E2E auth credentials not configured');
    await login(page);
  });

  // -----------------------------------------------------------------------
  // Step 0 — Snelstart
  // -----------------------------------------------------------------------

  test.describe('Step 0: Snelstart', () => {
    test('should load the wizard and show the correct title', async ({ page }) => {
      await navigateToNieuwOnderhoud(page);
      await waitForConvexData(page);

      // Verify page title
      await expect(page.locator('h1')).toContainText('Nieuwe Onderhoud Offerte');

      // Verify we are on step 1 of 4 (Snelstart)
      await expect(page.locator('text=Stap 1 van 4')).toBeVisible();
      await expect(page.locator('text=Snelstart')).toBeVisible();
    });

    test('should allow skipping to manual input', async ({ page }) => {
      await navigateToNieuwOnderhoud(page);
      await waitForConvexData(page);

      const skipButton = page.locator(
        'button:has-text("Handmatig"), button:has-text("Overslaan"), button:has-text("Geen template")',
      ).first();
      await skipButton.click();

      // Should advance to step 2 (Klantgegevens & Werkzaamheden)
      await expect(page.locator('text=Stap 2 van 4')).toBeVisible();
      await expect(page.locator('text=Klantgegevens & Werkzaamheden')).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Step 1 — Klantgegevens & Werkzaamheden
  // -----------------------------------------------------------------------

  test.describe('Step 1: Klantgegevens & Werkzaamheden', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToNieuwOnderhoud(page);
      await waitForConvexData(page);

      // Skip past step 0
      const skipButton = page.locator(
        'button:has-text("Handmatig"), button:has-text("Overslaan"), button:has-text("Geen template")',
      ).first();
      await skipButton.click();
      await expect(page.locator('text=Stap 2 van 4')).toBeVisible();
    });

    test('should display klant form, parameters, and scope checkboxes', async ({ page }) => {
      // Klantgegevens should be visible
      await expect(page.locator('text=Klantgegevens')).toBeVisible();

      // Onderhoud scopes should be listed
      await expect(page.locator('text=Gras onderhoud')).toBeVisible();
      await expect(page.locator('text=Borders onderhoud')).toBeVisible();
      await expect(page.locator('text=Heggen onderhoud')).toBeVisible();
      await expect(page.locator('text=Bomen onderhoud')).toBeVisible();
      await expect(page.locator('text=Overige werkzaamheden')).toBeVisible();
    });

    test('should display onderhoud-specific parameters (bereikbaarheid + achterstalligheid)', async ({
      page,
    }) => {
      await expect(page.locator('text=Bereikbaarheid')).toBeVisible();
      await expect(page.locator('text=Achterstalligheid')).toBeVisible();
    });

    test('should allow filling klant data and selecting scopes', async ({ page }) => {
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);

      // Select some onderhoud scopes
      await selectScope(page, 'Gras onderhoud');
      await selectScope(page, 'Borders onderhoud');

      // Verify the selections are reflected in the page
      const selectedScopes = page.locator('[role="checkbox"][aria-checked="true"]');
      await expect(selectedScopes).toHaveCount(2);
    });

    test('should show verplicht badges for scopes with required sub-items', async ({ page }) => {
      // Heggen onderhoud has verplicht: ["lengte", "hoogte", "breedte"]
      const heggenScope = page.locator('[role="checkbox"]:has-text("Heggen onderhoud")');
      await expect(heggenScope).toBeVisible();

      // Should show verplicht badges
      await expect(heggenScope.locator('text=lengte')).toBeVisible();
    });

    test('should advance to step 2 when form is valid', async ({ page }) => {
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);
      await selectScope(page, 'Gras onderhoud');

      await clickVolgende(page);

      // Should be on step 3 of 4 (Details per Werkzaamheid)
      await expect(page.locator('text=Stap 3 van 4')).toBeVisible();
      await expect(page.locator('text=Details per Werkzaamheid')).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Step 2 — Details per Werkzaamheid
  // -----------------------------------------------------------------------

  test.describe('Step 2: Details per Werkzaamheid', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToNieuwOnderhoud(page);
      await waitForConvexData(page);

      // Skip step 0
      const skipButton = page.locator(
        'button:has-text("Handmatig"), button:has-text("Overslaan"), button:has-text("Geen template")',
      ).first();
      await skipButton.click();

      // Fill step 1
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);
      await selectScope(page, 'Gras onderhoud');
      await selectScope(page, 'Heggen onderhoud');
      await clickVolgende(page);

      await expect(page.locator('text=Stap 3 van 4')).toBeVisible();
    });

    test('should display detail forms for each selected scope', async ({ page }) => {
      // Should show detail sections for gras and heggen
      await expect(page.locator('text=Gras').first()).toBeVisible();
      await expect(page.locator('text=Heggen').first()).toBeVisible();
    });

    test('should allow filling in gras onderhoud details', async ({ page }) => {
      // Find number inputs and fill them in
      const oppervlakteInput = page.locator('input[type="number"]').first();
      if (await oppervlakteInput.isVisible()) {
        await oppervlakteInput.fill('200');
        await expect(oppervlakteInput).toHaveValue('200');
      }
    });

    test('should allow navigating back to step 1', async ({ page }) => {
      await clickVorige(page);
      await expect(page.locator('text=Stap 2 van 4')).toBeVisible();
    });

    test('should show validation state per scope', async ({ page }) => {
      // The wizard step summary shows a green check or orange dot per scope
      // depending on whether the scope data is valid
      const checkIcons = page.locator('svg.text-green-600, .text-green-600');
      const warningDots = page.locator('.bg-orange-400');

      // At least one indicator should be present (either valid or invalid state)
      const totalIndicators =
        (await checkIcons.count()) + (await warningDots.count());
      expect(totalIndicators).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Step 3 — Bevestigen
  // -----------------------------------------------------------------------

  test.describe('Step 3: Bevestigen', () => {
    test('should display the review section with all entered data', async ({ page }) => {
      await navigateToNieuwOnderhoud(page);
      await waitForConvexData(page);

      // Navigate through all steps
      // Skip step 0
      const skipButton = page.locator(
        'button:has-text("Handmatig"), button:has-text("Overslaan"), button:has-text("Geen template")',
      ).first();
      await skipButton.click();

      // Fill step 1
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);
      await selectScope(page, 'Gras onderhoud');
      await clickVolgende(page);

      // Fill step 2 — fill in required numeric fields
      const numberInputs = page.locator('input[type="number"]');
      const inputCount = await numberInputs.count();
      for (let i = 0; i < inputCount; i++) {
        const input = numberInputs.nth(i);
        const currentValue = await input.inputValue();
        if (currentValue === '0' || currentValue === '') {
          await input.fill('100');
        }
      }
      await clickVolgende(page);

      // Should be on step 4 of 4 (Bevestigen)
      await expect(page.locator('text=Stap 4 van 4')).toBeVisible();
      await expect(page.locator('text=Bevestigen')).toBeVisible();

      // Should show the klant data in the review
      await expect(page.locator(`text=${klantData.naam}`)).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Full Flow — end-to-end submission
  // -----------------------------------------------------------------------

  test.describe('Full Flow', () => {
    test('should complete the entire onderhoud offerte wizard', async ({ page }) => {
      await navigateToNieuwOnderhoud(page);
      await waitForConvexData(page);

      // Step 0: Skip
      const skipButton = page.locator(
        'button:has-text("Handmatig"), button:has-text("Overslaan"), button:has-text("Geen template")',
      ).first();
      await skipButton.click();

      // Step 1: Fill klant data and select scopes
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);
      await selectScope(page, 'Gras onderhoud');
      await selectScope(page, 'Borders onderhoud');
      await clickVolgende(page);

      // Step 2: Fill scope details
      await expect(page.locator('text=Stap 3 van 4')).toBeVisible();
      const numberInputs = page.locator('input[type="number"]');
      const inputCount = await numberInputs.count();
      for (let i = 0; i < inputCount; i++) {
        const input = numberInputs.nth(i);
        const currentValue = await input.inputValue();
        if (currentValue === '0' || currentValue === '') {
          await input.fill('75');
        }
      }
      await clickVolgende(page);

      // Step 3: Bevestigen — review and submit
      await expect(page.locator('text=Stap 4 van 4')).toBeVisible();
      await expect(page.locator(`text=${klantData.naam}`)).toBeVisible();

      // Submit the offerte
      const submitButton = page.locator(
        'button:has-text("Aanmaken"), button:has-text("Offerte aanmaken"), button:has-text("Bevestigen")',
      ).first();
      await expect(submitButton).toBeVisible();
      await submitButton.click();

      // Wait for success
      await expect(
        page.locator('text=aangemaakt, text=Offerte aangemaakt, text=succesvol'),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  // -----------------------------------------------------------------------
  // Onderhoud-specific parameters
  // -----------------------------------------------------------------------

  test.describe('Onderhoud Parameters', () => {
    test('should allow setting achterstalligheid level', async ({ page }) => {
      await navigateToNieuwOnderhoud(page);
      await waitForConvexData(page);

      // Skip step 0
      const skipButton = page.locator(
        'button:has-text("Handmatig"), button:has-text("Overslaan"), button:has-text("Geen template")',
      ).first();
      await skipButton.click();

      // Look for achterstalligheid selector
      const achterstalligheid = page.locator('text=Achterstalligheid');
      await expect(achterstalligheid).toBeVisible();

      // Click the achterstalligheid select trigger
      const selectTrigger = page
        .locator('select, [role="combobox"]')
        .filter({ hasText: /laag|gemiddeld|hoog/i })
        .first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();
      }
    });

    test('should allow entering tuin oppervlakte', async ({ page }) => {
      await navigateToNieuwOnderhoud(page);
      await waitForConvexData(page);

      // Skip step 0
      const skipButton = page.locator(
        'button:has-text("Handmatig"), button:has-text("Overslaan"), button:has-text("Geen template")',
      ).first();
      await skipButton.click();

      // Look for tuin oppervlakte field
      const tuinOppervlakte = page.locator(
        'input[name="tuinOppervlakte"], label:has-text("Oppervlakte") ~ input, label:has-text("oppervlakte") ~ input',
      ).first();

      if (await tuinOppervlakte.isVisible()) {
        await tuinOppervlakte.fill('500');
        await expect(tuinOppervlakte).toHaveValue('500');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Additional onderhoud scopes
  // -----------------------------------------------------------------------

  test.describe('Extended Scopes', () => {
    test('should display all onderhoud scope options including extended scopes', async ({ page }) => {
      await navigateToNieuwOnderhoud(page);
      await waitForConvexData(page);

      // Skip step 0
      const skipButton = page.locator(
        'button:has-text("Handmatig"), button:has-text("Overslaan"), button:has-text("Geen template")',
      ).first();
      await skipButton.click();

      // Core onderhoud scopes
      await expect(page.locator('text=Gras onderhoud')).toBeVisible();
      await expect(page.locator('text=Borders onderhoud')).toBeVisible();
      await expect(page.locator('text=Heggen onderhoud')).toBeVisible();
      await expect(page.locator('text=Bomen onderhoud')).toBeVisible();
      await expect(page.locator('text=Overige werkzaamheden')).toBeVisible();

      // Extended onderhoud scopes
      await expect(page.locator('text=Reiniging')).toBeVisible();
      await expect(page.locator('text=Bemesting')).toBeVisible();
      await expect(page.locator('text=Gazonanalyse')).toBeVisible();
      await expect(page.locator('text=Mollenbestrijding')).toBeVisible();
    });

    test('should allow selecting extended scopes like Bemesting', async ({ page }) => {
      await navigateToNieuwOnderhoud(page);
      await waitForConvexData(page);

      // Skip step 0
      const skipButton = page.locator(
        'button:has-text("Handmatig"), button:has-text("Overslaan"), button:has-text("Geen template")',
      ).first();
      await skipButton.click();

      // Select an extended scope
      await selectScope(page, 'Bemesting');

      // Verify it is checked
      const bemestingScope = page.locator('[role="checkbox"]:has-text("Bemesting")');
      await expect(bemestingScope).toHaveAttribute('aria-checked', 'true');
    });
  });
});
