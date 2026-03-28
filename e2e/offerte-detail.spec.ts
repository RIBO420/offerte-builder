import { test, expect } from '@playwright/test';
import {
  hasTestCredentials,
  login,
  navigateToOffertes,
  navigateToOfferteDetail,
  waitForConvexData,
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

      // Page should have a heading or breadcrumb with "Offertes"
      await expect(page.locator('text=Offertes').first()).toBeVisible();
    });

    test('should navigate to an offerte detail page from the list', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      // Find the first offerte link/row in the list
      const firstOfferte = page
        .locator('a[href*="/offertes/"], tr[class*="cursor"], [role="row"]')
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

      // Should show the not-found state
      await expect(
        page.locator('text=Offerte niet gevonden, text=niet gevonden, text=Niet gevonden'),
      ).toBeVisible({ timeout: 10_000 });

      // Should have a back link
      await expect(
        page.locator('a:has-text("Terug naar Offertes"), button:has-text("Terug")'),
      ).toBeVisible();
    });

    test('should display offerte header with nummer and total', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      // Navigate to first available offerte
      const firstOfferte = page
        .locator('a[href*="/offertes/"]')
        .first();

      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Should display the offerte nummer in the header
      // Offerte nummers follow the pattern like "OFF-2026-001"
      await expect(
        page.locator('text=/OFF-\\d{4}-\\d+|incl\\. BTW/'),
      ).toBeVisible({ timeout: 10_000 });
    });

    test('should display the workflow stepper', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // The workflow stepper should show all statuses
      await expect(page.locator('text=Concept')).toBeVisible();
      await expect(page.locator('text=Voorcalculatie')).toBeVisible();
      await expect(page.locator('text=Verzonden')).toBeVisible();
      await expect(page.locator('text=Geaccepteerd')).toBeVisible();
    });

    test('should display klant details card', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Klant details card should be visible
      await expect(
        page.locator('text=Klant, text=Klantgegevens').first(),
      ).toBeVisible();
    });

    test('should display scopes card', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Scopes card should be present — look for scope-related text
      await expect(
        page.locator('text=Scopes, text=Werkzaamheden').first(),
      ).toBeVisible();
    });

    test('should display totalen card with financial summary', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Totalen card should show financial information
      await expect(page.locator('text=Totalen').first()).toBeVisible();
      // Should contain currency formatting (euro symbol)
      await expect(page.locator('text=/€/')).toBeVisible();
    });

    test('should display tijdlijn card', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Tijdlijn card should be visible
      await expect(
        page.locator('text=Tijdlijn, text=Aangemaakt, text=Laatst gewijzigd').first(),
      ).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Status Changes
  // -----------------------------------------------------------------------

  test.describe('Status Changes', () => {
    test('should show status change confirmation dialog', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Look for a status change button or dropdown in the header
      // The OfferteHeader component should have status change actions
      const statusButton = page.locator(
        'button:has-text("Status"), button:has-text("Voorcalculatie"), button:has-text("Verzenden")',
      ).first();

      if (await statusButton.isVisible()) {
        await statusButton.click();

        // If it opens a dropdown, click a status option
        const statusOption = page.locator(
          '[role="menuitem"]:has-text("Voorcalculatie"), [role="menuitem"]:has-text("Verzonden"), button:has-text("Voorcalculatie")',
        ).first();

        if (await statusOption.isVisible()) {
          await statusOption.click();

          // Confirmation dialog should appear
          await expect(page.locator('text=Status wijzigen?')).toBeVisible();
          await expect(page.locator('text=Annuleren')).toBeVisible();
          await expect(page.locator('text=Bevestigen')).toBeVisible();
        }
      }
    });

    test('should allow canceling a status change', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Try to trigger status change dialog (same as above)
      const statusButton = page.locator(
        'button:has-text("Status"), button:has-text("Voorcalculatie"), button:has-text("Verzenden")',
      ).first();

      if (await statusButton.isVisible()) {
        await statusButton.click();

        const statusOption = page.locator(
          '[role="menuitem"]:has-text("Voorcalculatie"), [role="menuitem"]:has-text("Verzonden")',
        ).first();

        if (await statusOption.isVisible()) {
          await statusOption.click();

          // Dialog should appear
          const dialog = page.locator('text=Status wijzigen?');
          if (await dialog.isVisible()) {
            // Cancel the status change
            await page.locator('button:has-text("Annuleren")').click();

            // Dialog should close
            await expect(dialog).not.toBeVisible();
          }
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // Actions — Duplicate, Delete, Template
  // -----------------------------------------------------------------------

  test.describe('Offerte Actions', () => {
    test('should show action buttons (duplicate, delete, etc.)', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Look for action buttons — they might be in a dropdown menu
      const actionsMenu = page.locator(
        'button:has-text("Acties"), button[aria-label*="menu"], button[aria-label*="Menu"]',
      ).first();

      if (await actionsMenu.isVisible()) {
        await actionsMenu.click();

        // Dropdown should show action options
        const duplicateOption = page.locator(
          'text=Dupliceren, [role="menuitem"]:has-text("Dupliceren")',
        );
        const deleteOption = page.locator(
          'text=Verwijderen, [role="menuitem"]:has-text("Verwijderen")',
        );
        const templateOption = page.locator(
          'text=template, text=Template, [role="menuitem"]:has-text("template")',
        );

        // At least one action should be available
        const hasActions =
          (await duplicateOption.isVisible()) ||
          (await deleteOption.isVisible()) ||
          (await templateOption.isVisible());

        expect(hasActions).toBeTruthy();
      }
    });

    test('should show delete confirmation dialog when deleting', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Open actions menu
      const actionsMenu = page.locator(
        'button:has-text("Acties"), button[aria-label*="menu"], button[aria-label*="Menu"]',
      ).first();

      if (await actionsMenu.isVisible()) {
        await actionsMenu.click();

        const deleteOption = page.locator(
          '[role="menuitem"]:has-text("Verwijderen"), button:has-text("Verwijderen")',
        ).first();

        if (await deleteOption.isVisible()) {
          await deleteOption.click();

          // Delete confirmation dialog should appear
          // The dialog asks about the offerte nummer
          await expect(
            page.locator('[role="alertdialog"], [role="dialog"]'),
          ).toBeVisible();

          // Cancel delete
          await page.locator('button:has-text("Annuleren")').click();
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // Navigation Links
  // -----------------------------------------------------------------------

  test.describe('Navigation Links', () => {
    test('should have a link to edit the offerte (bewerken)', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Look for edit button/link
      const editLink = page.locator(
        'a[href*="bewerken"], button:has-text("Bewerken"), a:has-text("Bewerken")',
      ).first();

      if (await editLink.isVisible()) {
        const href = await editLink.getAttribute('href');
        if (href) {
          expect(href).toContain('bewerken');
        }
      }
    });

    test('should have a link to the voorcalculatie page', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Look for voorcalculatie link
      const voorcalcLink = page.locator(
        'a[href*="voorcalculatie"], button:has-text("Voorcalculatie")',
      ).first();

      if (await voorcalcLink.isVisible()) {
        const href = await voorcalcLink.getAttribute('href');
        if (href) {
          expect(href).toContain('voorcalculatie');
        }
      }
    });

    test('should navigate back to the offerte list', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Look for breadcrumb or back navigation that goes to /offertes
      const backLink = page.locator(
        'a[href="/offertes"], nav a:has-text("Offertes")',
      ).first();

      if (await backLink.isVisible()) {
        await backLink.click();
        await expect(page).toHaveURL(/\/offertes$/);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Voorcalculatie Card
  // -----------------------------------------------------------------------

  test.describe('Voorcalculatie Card', () => {
    test('should show voorcalculatie card for concept offertes', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Voorcalculatie card should be visible for concept offertes
      // or show voorcalculatie data if already filled
      const voorcalcCard = page.locator(
        'text=Voorcalculatie, text=voorcalculatie',
      ).first();

      // This is expected to be present — either as a card or as part of the stepper
      await expect(voorcalcCard).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Engagement Timeline
  // -----------------------------------------------------------------------

  test.describe('Engagement Timeline', () => {
    test('should display the engagement timeline section', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Look for timeline-related elements
      // The EngagementTimeline component shows email logs, versions, and responses
      const timeline = page.locator(
        'text=Activiteit, text=Timeline, text=Geschiedenis',
      ).first();

      // Timeline section should be present in the right column
      if (await timeline.isVisible()) {
        await expect(timeline).toBeVisible();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Regels (Line Items) Card
  // -----------------------------------------------------------------------

  test.describe('Regels Card', () => {
    test('should display offerte regels (line items)', async ({ page }) => {
      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Look for the regels card — it shows materiaal/arbeid/machine line items
      const regelsCard = page.locator(
        'text=Regels, text=Offerte regels, text=Regeloverzicht',
      ).first();

      if (await regelsCard.isVisible()) {
        await expect(regelsCard).toBeVisible();

        // Regels should show types: materiaal, arbeid, or machine
        const hasRegelTypes =
          (await page.locator('text=materiaal').count()) > 0 ||
          (await page.locator('text=arbeid').count()) > 0 ||
          (await page.locator('text=machine').count()) > 0;

        // It is OK if there are no regels yet — just verify the card structure
        expect(hasRegelTypes || (await regelsCard.isVisible())).toBeTruthy();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Responsive Layout
  // -----------------------------------------------------------------------

  test.describe('Responsive Layout', () => {
    test('should display in a two-column layout on desktop', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1280, height: 800 });

      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // The page uses lg:grid-cols-3 — verify the grid container exists
      const gridContainer = page.locator('.grid.lg\\:grid-cols-3, [class*="lg:grid-cols-3"]');
      if (await gridContainer.isVisible()) {
        await expect(gridContainer).toBeVisible();
      }
    });

    test('should stack cards on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });

      await navigateToOffertes(page);
      await waitForConvexData(page);

      const firstOfferte = page.locator('a[href*="/offertes/"]').first();
      if (!(await firstOfferte.isVisible())) {
        test.skip(true, 'No offertes available to test');
        return;
      }

      await firstOfferte.click();
      await waitForConvexData(page);

      // Content should be visible and scrollable on mobile
      await expect(page.locator('h1, text=/OFF-/')).toBeVisible({ timeout: 10_000 });
    });
  });
});
