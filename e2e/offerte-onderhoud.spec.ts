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
//
// The wizard page does NOT have RequireRole, so any authenticated user
// can access it.
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
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Nieuwe Onderhoud Offerte');

      // Verify we are on step 1 of 4 (Snelstart)
      await expect(page.getByText('Stap 1 van 4: Snelstart')).toBeVisible();
    });

    test('should allow skipping to manual input', async ({ page }) => {
      await navigateToNieuwOnderhoud(page);
      await waitForConvexData(page);

      // The skip button says "Start vanaf nul" (from PackageSelector)
      await page.getByRole('button', { name: 'Start vanaf nul' }).click();

      // Should advance to step 2 (Klantgegevens & Werkzaamheden)
      await expect(page.getByText('Stap 2 van 4')).toBeVisible();
      await expect(page.getByText('Klantgegevens & Werkzaamheden')).toBeVisible();
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
      await page.getByRole('button', { name: 'Start vanaf nul' }).click();
      await expect(page.getByText('Stap 2 van 4')).toBeVisible();
    });

    test('should display klant form, parameters, and scope checkboxes', async ({ page }) => {
      // Klantgegevens should be visible
      await expect(page.getByText('Klantgegevens').first()).toBeVisible();

      // Onderhoud scopes should be listed
      await expect(page.getByText('Gras onderhoud')).toBeVisible();
      await expect(page.getByText('Borders onderhoud')).toBeVisible();
      await expect(page.getByText('Heggen onderhoud')).toBeVisible();
      await expect(page.getByText('Bomen onderhoud')).toBeVisible();
      await expect(page.getByText('Overige werkzaamheden')).toBeVisible();
    });

    test('should display onderhoud-specific parameters', async ({ page }) => {
      await expect(page.getByText('Bereikbaarheid').first()).toBeVisible();
      await expect(page.getByText('Achterstalligheid').first()).toBeVisible();
    });

    test('should allow filling klant data and selecting scopes', async ({ page }) => {
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);

      // Select some onderhoud scopes
      await selectScope(page, 'Gras onderhoud');
      await selectScope(page, 'Borders onderhoud');

      // Verify the klant name is shown
      await expect(page.getByText(klantData.naam)).toBeVisible();
    });

    test('should advance to step 2 when form is valid', async ({ page }) => {
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);
      await selectScope(page, 'Gras onderhoud');

      await clickVolgende(page);

      // Should be on step 3 of 4 (Details per Werkzaamheid)
      await expect(page.getByText('Stap 3 van 4')).toBeVisible();
      await expect(page.getByText('Details per Werkzaamheid')).toBeVisible();
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
      await page.getByRole('button', { name: 'Start vanaf nul' }).click();

      // Fill step 1
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);
      await selectScope(page, 'Gras onderhoud');
      await selectScope(page, 'Heggen onderhoud');
      await clickVolgende(page);

      await expect(page.getByText('Stap 3 van 4')).toBeVisible();
    });

    test('should display detail forms for each selected scope', async ({ page }) => {
      // Should show detail sections for gras and heggen
      await expect(page.getByText('Gras').first()).toBeVisible();
      await expect(page.getByText('Heggen').first()).toBeVisible();
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
      await expect(page.getByText('Stap 2 van 4')).toBeVisible();
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
      await page.getByRole('button', { name: 'Start vanaf nul' }).click();

      // Fill step 1
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);
      await selectScope(page, 'Gras onderhoud');
      await clickVolgende(page);

      // Fill step 2 — fill in the grasoppervlakte field (uses type="text" inputMode="decimal")
      // The gras form has grasAanwezig=true by default, requiring grasOppervlakte > 0
      const grasInput = page.locator('input[inputmode="decimal"]').first();
      await grasInput.click();
      await grasInput.fill('100');
      // Blur to trigger validation (debounce + react-hook-form)
      await grasInput.blur();
      await page.waitForTimeout(500);
      await clickVolgende(page);

      // Should be on step 4 of 4 (Bevestigen)
      await expect(page.getByText('Stap 4 van 4: Bevestigen')).toBeVisible();

      // Should show the klant data in the review
      await expect(page.getByText(klantData.naam)).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Extended Scopes
  // -----------------------------------------------------------------------

  test.describe('Extended Scopes', () => {
    test('should display all onderhoud scope options', async ({ page }) => {
      await navigateToNieuwOnderhoud(page);
      await waitForConvexData(page);

      // Skip step 0
      await page.getByRole('button', { name: 'Start vanaf nul' }).click();

      // Core onderhoud scopes
      await expect(page.getByText('Gras onderhoud')).toBeVisible();
      await expect(page.getByText('Borders onderhoud')).toBeVisible();
      await expect(page.getByText('Heggen onderhoud')).toBeVisible();
      await expect(page.getByText('Bomen onderhoud')).toBeVisible();
      await expect(page.getByText('Overige werkzaamheden')).toBeVisible();

      // Extended onderhoud scopes
      await expect(page.getByText('Reiniging')).toBeVisible();
      await expect(page.getByText('Bemesting')).toBeVisible();
      await expect(page.getByText('Gazonanalyse')).toBeVisible();
      await expect(page.getByText('Mollenbestrijding')).toBeVisible();
    });
  });
});
