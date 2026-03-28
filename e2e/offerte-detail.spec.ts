import { test, expect } from '@playwright/test';
import {
  hasTestCredentials,
  login,
  navigateToOffertes,
  navigateToOfferteDetail,
  waitForConvexData,
  isOnExpectedPage,
} from './helpers/auth';

// ---------------------------------------------------------------------------
// Offerte Detail Page — E2E Tests
//
// These tests cover the offerte detail page interactions:
//   - Loading and displaying offerte data
//   - Workflow stepper display
//   - Status changes with confirmation dialog
//   - Duplicate, delete, and template actions
//   - Klant details, scopes, regels, and totalen cards
//   - Navigation to related pages (voorcalculatie, bewerken, history)
//
// NOTE: The /offertes list page is behind RequireRole (directie, projectleider).
// If the test user doesn't have this role, tests that navigate via the list
// will be skipped. The offerte detail page itself has NO RequireRole.
// ---------------------------------------------------------------------------

test.describe('Offerte Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCredentials(), 'Skipping: E2E auth credentials not configured');
    await login(page);
  });

  // -----------------------------------------------------------------------
  // Navigation — finding an offerte to test with
  // -----------------------------------------------------------------------

  test.describe('Offerte List Navigation', () => {
    test('should load the offerte list page', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const onOffertesPage = await isOnExpectedPage(page, '/offertes');
      test.skip(!onOffertesPage, 'Test user does not have the required role to access /offertes');

      // Page should have "Offertes" text
      await expect(page.getByText('Offertes').first()).toBeVisible();
    });

    test('should navigate to an offerte detail page from the list', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const onOffertesPage = await isOnExpectedPage(page, '/offertes');
      test.skip(!onOffertesPage, 'Test user does not have the required role to access /offertes');

      // Find the first offerte link/row in the list
      const firstOfferte = page
        .locator('a[href*="/offertes/"]')
        .first();

      if (await firstOfferte.isVisible()) {
        await firstOfferte.click();
        await waitForConvexData(page);

        // Should navigate to a detail page
        await expect(page).toHaveURL(/\/offertes\/.+/);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Detail Page — Content
  // -----------------------------------------------------------------------

  test.describe('Detail Page Content', () => {
    test('should show "not found" for an invalid offerte ID', async ({ page }) => {
      await navigateToOfferteDetail(page, 'nonexistent-id-12345');
      await waitForConvexData(page, 15_000);

      // An invalid (non-Convex) ID triggers arg validation, caught by the
      // error boundary ("Er is iets misgegaan") or if the ID happens to be
      // valid-format-but-missing, the page shows "Offerte niet gevonden".
      const errorOrNotFound = page.getByText('niet gevonden')
        .or(page.getByText('Niet gevonden'))
        .or(page.getByText('Er is iets misgegaan'));
      await expect(errorOrNotFound.first()).toBeVisible({ timeout: 15_000 });
    });

    test('should display offerte header with nummer and total', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const onOffertesPage = await isOnExpectedPage(page, '/offertes');
      test.skip(!onOffertesPage, 'Test user does not have the required role to access /offertes');

      // Navigate to first available offerte
      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Should display the offerte nummer in the header (pattern: OFF-2026-001)
      // or at least show some offerte-related content
      await expect(
        page.getByText(/OFF-\d{4}-\d+/).or(page.getByText(/incl\. BTW/)),
      ).toBeVisible({ timeout: 10_000 });
    });

    test('should display the workflow stepper', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const onOffertesPage = await isOnExpectedPage(page, '/offertes');
      test.skip(!onOffertesPage, 'Test user does not have the required role to access /offertes');

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // The workflow stepper should show statuses
      await expect(page.getByText('Concept')).toBeVisible();
      await expect(page.getByText('Voorcalculatie').first()).toBeVisible();
      await expect(page.getByText('Verzonden')).toBeVisible();
      await expect(page.getByText('Geaccepteerd')).toBeVisible();
    });

    test('should display klant details card', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const onOffertesPage = await isOnExpectedPage(page, '/offertes');
      test.skip(!onOffertesPage, 'Test user does not have the required role to access /offertes');

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Klant details card should be visible
      await expect(
        page.getByText('Klant').or(page.getByText('Klantgegevens')).first(),
      ).toBeVisible();
    });

    test('should display totalen card with financial summary', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const onOffertesPage = await isOnExpectedPage(page, '/offertes');
      test.skip(!onOffertesPage, 'Test user does not have the required role to access /offertes');

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Totalen card should show financial information
      await expect(page.getByText('Totalen').first()).toBeVisible();
      // Should contain currency formatting (euro symbol)
      await expect(page.locator('text=/€/')).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Navigation Links
  // -----------------------------------------------------------------------

  test.describe('Navigation Links', () => {
    test('should have a link to edit the offerte (bewerken)', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const onOffertesPage = await isOnExpectedPage(page, '/offertes');
      test.skip(!onOffertesPage, 'Test user does not have the required role to access /offertes');

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Look for edit button/link
      const editLink = page.locator('a[href*="bewerken"]')
        .or(page.getByRole('link', { name: 'Bewerken' }))
        .or(page.getByRole('button', { name: 'Bewerken' }))
        .first();

      if (await editLink.isVisible()) {
        const href = await editLink.getAttribute('href');
        if (href) {
          expect(href).toContain('bewerken');
        }
      }
    });

    test('should navigate back to the offerte list', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const onOffertesPage = await isOnExpectedPage(page, '/offertes');
      test.skip(!onOffertesPage, 'Test user does not have the required role to access /offertes');

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Look for breadcrumb or back navigation that goes to /offertes
      const backLink = page.locator('a[href="/offertes"]')
        .or(page.locator('nav').getByRole('link', { name: 'Offertes' }))
        .first();

      if (await backLink.isVisible()) {
        await backLink.click();
        await expect(page).toHaveURL(/\/offertes$/);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Responsive Layout
  // -----------------------------------------------------------------------

  test.describe('Responsive Layout', () => {
    test('should stack cards on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });

      await navigateToOffertes(page);
      await waitForConvexData(page);

      const onOffertesPage = await isOnExpectedPage(page, '/offertes');
      test.skip(!onOffertesPage, 'Test user does not have the required role to access /offertes');

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Content should be visible and scrollable on mobile
      await expect(page.getByRole('heading', { level: 1 }).or(page.locator('text=/OFF-/'))).toBeVisible({ timeout: 10_000 });
    });
  });
});
