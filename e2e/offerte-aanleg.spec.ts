import { test, expect } from '@playwright/test';
import {
  hasTestCredentials,
  login,
  navigateToNieuweAanleg,
  waitForConvexData,
  fillKlantData,
  clickVolgende,
  clickVorige,
  selectScope,
  getTestKlantData,
  fillAllNumberInputs,
  clickVolgendeWhenReady,
} from './helpers/auth';

// ---------------------------------------------------------------------------
// Aanleg Offerte Wizard — E2E Tests
//
// These tests cover the full "Nieuwe Aanleg Offerte" wizard flow:
//   Step 0: Snelstart (package / template selection)
//   Step 1: Klantgegevens & Scopes
//   Step 2: Scope Details
//   Step 3: Garantie
//   Step 4: Bevestigen (review & submit)
//
// The wizard page does NOT have RequireRole, so any authenticated user
// can access it.
// ---------------------------------------------------------------------------

test.describe('Aanleg Offerte Wizard', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCredentials(), 'Skipping: E2E auth credentials not configured');
    await login(page);
  });

  // -----------------------------------------------------------------------
  // Step 0 — Snelstart
  // -----------------------------------------------------------------------

  test.describe('Step 0: Snelstart', () => {
    test('should load the wizard and display package selector', async ({ page }) => {
      await navigateToNieuweAanleg(page);
      await waitForConvexData(page);

      // Verify page title
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Nieuwe Aanleg Offerte');

      // Verify we are on step 1 of 5 (Snelstart)
      await expect(page.getByText('Stap 1 van 5: Snelstart')).toBeVisible();
    });

    test('should allow skipping package selection to go to step 1', async ({ page }) => {
      await navigateToNieuweAanleg(page);
      await waitForConvexData(page);

      // The skip button says "Start vanaf nul"
      await page.getByRole('button', { name: 'Start vanaf nul' }).click();

      // Should advance to step 2 (Klantgegevens & Scopes)
      await expect(page.getByText('Stap 2 van 5')).toBeVisible();
      await expect(page.getByText('Klantgegevens & Scopes')).toBeVisible();
    });

    test('should show template selector when clicking the template option', async ({ page }) => {
      await navigateToNieuweAanleg(page);
      await waitForConvexData(page);

      // Look for the template selection option ("Kies template")
      const templateButton = page.getByRole('button', { name: 'Kies template' });

      if (await templateButton.isVisible()) {
        await templateButton.click();

        // Should show the template selector with back button
        await expect(
          page.getByText('Terug naar Snelstart Pakketten'),
        ).toBeVisible();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Step 1 — Klantgegevens & Scopes
  // -----------------------------------------------------------------------

  test.describe('Step 1: Klantgegevens & Scopes', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToNieuweAanleg(page);
      await waitForConvexData(page);

      // Skip past step 0 (Snelstart)
      await page.getByRole('button', { name: 'Start vanaf nul' }).click();
      await expect(page.getByText('Stap 2 van 5')).toBeVisible();
    });

    test('should display the klant form and scope selection', async ({ page }) => {
      // Klantgegevens card should be visible
      await expect(page.getByText('Klantgegevens').first()).toBeVisible();

      // Scope Selectie card should be visible
      // All 7 aanleg scopes should be listed
      await expect(page.getByText('Grondwerk')).toBeVisible();
      await expect(page.getByText('Bestrating')).toBeVisible();
      await expect(page.getByText('Borders & Beplanting')).toBeVisible();
      await expect(page.getByText('Gras / Gazon')).toBeVisible();
      await expect(page.getByText('Houtwerk')).toBeVisible();
      await expect(page.getByText('Water / Elektra')).toBeVisible();
      await expect(page.getByText('Specials')).toBeVisible();
    });

    test('should display the bereikbaarheid selector', async ({ page }) => {
      await expect(page.getByText('Bereikbaarheid').first()).toBeVisible();
      await expect(page.getByText('Algemene Parameters')).toBeVisible();
    });

    test('should allow filling in klant data manually', async ({ page }) => {
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);

      // Verify the samenvatting sidebar shows the klant name
      await expect(page.getByText(klantData.naam)).toBeVisible();
    });

    test('should advance to step 2 when form is valid', async ({ page }) => {
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);
      await selectScope(page, 'Grondwerk');

      await clickVolgende(page);

      // Should be on step 3 of 5 (Scope Details)
      await expect(page.getByText('Stap 3 van 5')).toBeVisible();
      await expect(page.getByText('Scope Details')).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Step 2 — Scope Details
  // -----------------------------------------------------------------------

  test.describe('Step 2: Scope Details', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToNieuweAanleg(page);
      await waitForConvexData(page);

      // Skip step 0
      await page.getByRole('button', { name: 'Start vanaf nul' }).click();

      // Fill step 1
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);
      await selectScope(page, 'Grondwerk');
      await selectScope(page, 'Bestrating');
      await clickVolgende(page);

      await expect(page.getByText('Stap 3 van 5')).toBeVisible();
    });

    test('should display scope detail forms for selected scopes', async ({ page }) => {
      // Should show detail forms for Grondwerk and Bestrating
      await expect(page.getByText('Grondwerk').first()).toBeVisible();
      await expect(page.getByText('Bestrating').first()).toBeVisible();
    });

    test('should allow filling in grondwerk details', async ({ page }) => {
      // Find a number input and fill it in
      const oppervlakteInput = page.locator('input[type="number"]').first();

      if (await oppervlakteInput.isVisible()) {
        await oppervlakteInput.fill('50');
      }
    });

    test('should allow navigating back to step 1', async ({ page }) => {
      await clickVorige(page);

      // Should be back on step 2 of 5
      await expect(page.getByText('Stap 2 van 5')).toBeVisible();
      await expect(page.getByText('Klantgegevens & Scopes')).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Step 3 — Garantie
  // -----------------------------------------------------------------------

  test.describe('Step 3: Garantie', () => {
    test('should display the garantie pakket selector', async ({ page }) => {
      await navigateToNieuweAanleg(page);
      await waitForConvexData(page);

      // Skip step 0
      await page.getByRole('button', { name: 'Start vanaf nul' }).click();

      // Fill step 1
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);
      await selectScope(page, 'Gras / Gazon');
      await clickVolgende(page);

      // Fill step 2 — fill oppervlakte for gras
      // NumberInput renders type="text" with inputMode="decimal", not type="number"
      const oppervlakteInput = page.locator('#gras-oppervlakte');
      await oppervlakteInput.fill('100');
      await oppervlakteInput.blur();
      await page.waitForTimeout(500); // wait for debounced onChange to propagate

      await clickVolgendeWhenReady(page);

      // Should be on step 4 of 5 (Garantie)
      await expect(page.getByText('Stap 4 van 5')).toBeVisible();

      // Garantie step should have navigation buttons
      await expect(page.getByRole('button', { name: /Vorige/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /Volgende/ })).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Step 4 — Bevestigen (Review)
  // -----------------------------------------------------------------------

  test.describe('Step 4: Bevestigen', () => {
    test('should display the review section with klant and scope summary', async ({ page }) => {
      await navigateToNieuweAanleg(page);
      await waitForConvexData(page);

      // Skip step 0
      await page.getByRole('button', { name: 'Start vanaf nul' }).click();

      // Fill step 1
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);
      await selectScope(page, 'Gras / Gazon');
      await clickVolgende(page);

      // Fill step 2
      // NumberInput renders type="text" with inputMode="decimal", not type="number"
      const oppervlakteInput = page.locator('#gras-oppervlakte');
      await oppervlakteInput.fill('100');
      await oppervlakteInput.blur();
      await page.waitForTimeout(500); // wait for debounced onChange to propagate

      await clickVolgendeWhenReady(page);

      // Skip step 3 (Garantie)
      await clickVolgende(page);

      // Should be on step 5 of 5 (Bevestigen)
      await expect(page.getByText('Stap 5 van 5: Bevestigen')).toBeVisible();

      // Review section should show the klant data
      await expect(page.getByText(klantData.naam)).toBeVisible();

      // Should show the selected scope
      await expect(page.getByText('Gras').first()).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Bereikbaarheid parameter
  // -----------------------------------------------------------------------

  test.describe('Bereikbaarheid', () => {
    test('should allow changing the bereikbaarheid parameter', async ({ page }) => {
      await navigateToNieuweAanleg(page);
      await waitForConvexData(page);

      // Skip step 0
      await page.getByRole('button', { name: 'Start vanaf nul' }).click();

      // Open bereikbaarheid selector
      const trigger = page.locator('#bereikbaarheid');
      await trigger.click();

      // Should show the three options in the dropdown
      // Use getByRole to target the select items specifically
      const listbox = page.locator('[role="listbox"]');
      await expect(listbox.getByText('Goed (factor 1.0)')).toBeVisible();
      await expect(listbox.getByText('Beperkt (factor 1.2)')).toBeVisible();
      await expect(listbox.getByText('Slecht (factor 1.5)')).toBeVisible();

      // Select "Beperkt"
      await listbox.getByText('Beperkt (factor 1.2)').click();
    });
  });

  // -----------------------------------------------------------------------
  // Auto-save & Draft
  // -----------------------------------------------------------------------

  test.describe('Auto-save & Draft', () => {
    test('should show auto-save indicator when editing', async ({ page }) => {
      await navigateToNieuweAanleg(page);
      await waitForConvexData(page);

      // Skip step 0
      await page.getByRole('button', { name: 'Start vanaf nul' }).click();

      // After entering step 1, auto-save indicator should appear
      // Text can be "Auto-save aan", "Opslaan...", or "Opgeslagen om..."
      const autoSaveIndicator = page.getByText('Auto-save aan')
        .or(page.getByText(/Opslaan/))
        .or(page.getByText(/Opgeslagen/));
      await expect(autoSaveIndicator.first()).toBeVisible({ timeout: 5_000 });
    });

    test('should persist wizard data across page reloads', async ({ page }) => {
      await navigateToNieuweAanleg(page);
      await waitForConvexData(page);

      // Skip step 0
      await page.getByRole('button', { name: 'Start vanaf nul' }).click();

      // Fill in some klant data
      const klantData = getTestKlantData();
      await fillKlantData(page, klantData);
      await selectScope(page, 'Grondwerk');

      // Wait for auto-save to trigger
      await page.waitForTimeout(1_000);

      // Reload the page
      await page.reload();
      await waitForConvexData(page);

      // Should show a restore draft dialog with "Concept gevonden" or "Herstellen"
      const restoreDialog = page.getByText('Concept gevonden')
        .or(page.getByText('Herstellen'));
      await expect(restoreDialog.first()).toBeVisible({ timeout: 5_000 });
    });
  });
});
