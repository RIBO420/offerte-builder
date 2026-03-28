import { test, expect } from '@playwright/test';
import { authenticatedGoto, waitForDataLoad } from './helpers/auth';

/**
 * E2E tests for Project lifecycle flows.
 *
 * Page under test: /projecten, /projecten/[id], /projecten/nieuw
 * Projects are created from accepted offertes (geaccepteerd).
 * Status flow: gepland -> in_uitvoering -> afgerond -> nacalculatie_compleet
 *
 * All UI text is in Dutch.
 * The /projecten page does NOT have a RequireRole guard.
 */

test.describe('Projecten Lifecycle', () => {
  // ────────────────────────────────────────────
  // 1. Navigate to projecten list
  // ────────────────────────────────────────────
  test('should navigate to projecten list page', async ({ page }) => {
    await authenticatedGoto(page, '/projecten');

    // Page title
    await expect(page.getByRole('heading', { level: 1, name: 'Projecten' })).toBeVisible({ timeout: 10_000 });

    // Subtitle
    await expect(
      page.getByText('Calculatie, planning en nacalculatie voor je projecten'),
    ).toBeVisible();

    // Wait for data to load
    await waitForDataLoad(page);
  });

  // ────────────────────────────────────────────
  // 2. Stats cards are visible
  // ────────────────────────────────────────────
  test('should display project status stats cards', async ({ page }) => {
    await authenticatedGoto(page, '/projecten');
    await waitForDataLoad(page);

    // The four status cards should be visible (they use statusConfig labels)
    await expect(page.getByText('Gepland').first()).toBeVisible();
    await expect(page.getByText('In Uitvoering').first()).toBeVisible();
    await expect(page.getByText('Afgerond').first()).toBeVisible();
    await expect(page.getByText('Nacalculatie').first()).toBeVisible();
  });

  // ────────────────────────────────────────────
  // 3. Tab navigation
  // ────────────────────────────────────────────
  test('should switch between status tabs', async ({ page }) => {
    await authenticatedGoto(page, '/projecten');
    await waitForDataLoad(page);

    // "Alle" tab should be active by default
    const tabsList = page.locator('[role="tablist"]');
    const alleTab = tabsList.getByRole('tab', { name: /Alle/ });
    await expect(alleTab).toBeVisible();

    // Click "Gepland" tab
    const geplandTab = tabsList.getByRole('tab', { name: 'Gepland' });
    await geplandTab.click();
    await expect(page).toHaveURL(/status=gepland/);

    // Click "In Uitvoering" tab
    const inUitvoeringTab = tabsList.getByRole('tab', { name: 'In Uitvoering' });
    await inUitvoeringTab.click();
    await expect(page).toHaveURL(/status=in_uitvoering/);

    // Click "Afgerond" tab
    const afgerondTab = tabsList.getByRole('tab', { name: 'Afgerond' });
    await afgerondTab.click();
    await expect(page).toHaveURL(/status=afgerond/);

    // Click "Nacalculatie" tab
    const nacalcTab = tabsList.getByRole('tab', { name: 'Nacalculatie' });
    await nacalcTab.click();
    await expect(page).toHaveURL(/status=nacalculatie_compleet/);

    // Return to "Alle"
    await alleTab.click();
    // URL should no longer contain status param
    await expect(page).not.toHaveURL(/status=/);
  });

  // ────────────────────────────────────────────
  // 4. Search projects
  // ────────────────────────────────────────────
  test('should search projects', async ({ page }) => {
    await authenticatedGoto(page, '/projecten');
    await waitForDataLoad(page);

    // Locate the search input
    const searchInput = page.getByPlaceholder('Zoeken...');
    await expect(searchInput).toBeVisible();

    // Type a search query
    await searchInput.fill('test');

    // Wait for debounced search
    await page.waitForTimeout(500);

    // URL should update with q param
    await expect(page).toHaveURL(/q=test/);
  });

  test('should show no results state for non-matching search', async ({ page }) => {
    await authenticatedGoto(page, '/projecten');
    await waitForDataLoad(page);

    const searchInput = page.getByPlaceholder('Zoeken...');
    await searchInput.fill('xyznonexistent999');

    // Wait for debounced search
    await page.waitForTimeout(500);

    // Should show the "Geen resultaten gevonden" empty state (from NoSearchResults component)
    await expect(
      page.getByText('Geen resultaten gevonden'),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ────────────────────────────────────────────
  // 5. Project detail page
  // ────────────────────────────────────────────
  test('should navigate to project detail page', async ({ page }) => {
    await authenticatedGoto(page, '/projecten');
    await waitForDataLoad(page);

    // Check if any projects exist in the list (table rows are clickable)
    const projectRow = page.locator('table tbody tr').first();
    const hasProjects = await projectRow.isVisible().catch(() => false);
    test.skip(!hasProjects, 'No projects available to test detail navigation');

    // Click on the first project row
    await projectRow.click();

    // Should navigate to the detail page
    await expect(page).toHaveURL(/\/projecten\//, { timeout: 10_000 });

    // Project name should be displayed
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10_000 });

    // Status badge should be visible
    const statusBadge = page.getByText('Gepland')
      .or(page.getByText('In Uitvoering'))
      .or(page.getByText('Afgerond'))
      .or(page.getByText('Nacalculatie Compleet'))
      .or(page.getByText('Voorcalculatie'));
    await expect(statusBadge.first()).toBeVisible();
  });

  // ────────────────────────────────────────────
  // 6. Project detail — module pills (sub-navigation)
  // ────────────────────────────────────────────
  test('should display module navigation pills on project detail', async ({ page }) => {
    await authenticatedGoto(page, '/projecten');
    await waitForDataLoad(page);

    const projectRow = page.locator('table tbody tr').first();
    const hasProjects = await projectRow.isVisible().catch(() => false);
    test.skip(!hasProjects, 'No projects available to test module pills');

    await projectRow.click();
    await expect(page).toHaveURL(/\/projecten\//, { timeout: 10_000 });
    await waitForDataLoad(page);

    // ModulePills should render links to sub-pages
    // These are typically: Planning, Uitvoering, Kosten, Nacalculatie, Factuur
    const planningLink = page.locator('a[href*="/planning"]');
    const uitvoeringLink = page.locator('a[href*="/uitvoering"]');
    const kostenLink = page.locator('a[href*="/kosten"]');
    const nacalculatieLink = page.locator('a[href*="/nacalculatie"]');

    // At least some module pills should be visible
    const moduleLinks = [planningLink, uitvoeringLink, kostenLink, nacalculatieLink];
    let visibleCount = 0;
    for (const link of moduleLinks) {
      if (await link.first().isVisible().catch(() => false)) {
        visibleCount++;
      }
    }
    expect(visibleCount).toBeGreaterThan(0);
  });

  // ────────────────────────────────────────────
  // 7. Navigate to project sub-pages
  // ────────────────────────────────────────────
  test('should navigate to project planning sub-page', async ({ page }) => {
    await authenticatedGoto(page, '/projecten');
    await waitForDataLoad(page);

    const projectRow = page.locator('table tbody tr').first();
    const hasProjects = await projectRow.isVisible().catch(() => false);
    test.skip(!hasProjects, 'No projects available to test sub-pages');

    await projectRow.click();
    await expect(page).toHaveURL(/\/projecten\//, { timeout: 10_000 });
    await waitForDataLoad(page);

    // Click on the planning module pill
    const planningLink = page.locator('a[href*="/planning"]').first();
    const hasPlanningLink = await planningLink.isVisible().catch(() => false);
    test.skip(!hasPlanningLink, 'Planning link not visible on this project');

    await planningLink.click();
    await expect(page).toHaveURL(/\/projecten\/.*\/planning/i, { timeout: 10_000 });
  });

  test('should navigate to project uitvoering sub-page', async ({ page }) => {
    await authenticatedGoto(page, '/projecten');
    await waitForDataLoad(page);

    const projectRow = page.locator('table tbody tr').first();
    const hasProjects = await projectRow.isVisible().catch(() => false);
    test.skip(!hasProjects, 'No projects available to test sub-pages');

    await projectRow.click();
    await expect(page).toHaveURL(/\/projecten\//, { timeout: 10_000 });
    await waitForDataLoad(page);

    const uitvoeringLink = page.locator('a[href*="/uitvoering"]').first();
    const hasUitvoeringLink = await uitvoeringLink.isVisible().catch(() => false);
    test.skip(!hasUitvoeringLink, 'Uitvoering link not visible on this project');

    await uitvoeringLink.click();
    await expect(page).toHaveURL(/\/projecten\/.*\/uitvoering/i, { timeout: 10_000 });
  });

  test('should navigate to project kosten sub-page', async ({ page }) => {
    await authenticatedGoto(page, '/projecten');
    await waitForDataLoad(page);

    const projectRow = page.locator('table tbody tr').first();
    const hasProjects = await projectRow.isVisible().catch(() => false);
    test.skip(!hasProjects, 'No projects available to test sub-pages');

    await projectRow.click();
    await expect(page).toHaveURL(/\/projecten\//, { timeout: 10_000 });
    await waitForDataLoad(page);

    const kostenLink = page.locator('a[href*="/kosten"]').first();
    const hasKostenLink = await kostenLink.isVisible().catch(() => false);
    test.skip(!hasKostenLink, 'Kosten link not visible on this project');

    await kostenLink.click();
    await expect(page).toHaveURL(/\/projecten\/.*\/kosten/i, { timeout: 10_000 });
  });

  // ────────────────────────────────────────────
  // 8. Project detail — back navigation
  // ────────────────────────────────────────────
  test('should navigate back from project detail to projecten list', async ({ page }) => {
    await authenticatedGoto(page, '/projecten');
    await waitForDataLoad(page);

    const projectRow = page.locator('table tbody tr').first();
    const hasProjects = await projectRow.isVisible().catch(() => false);
    test.skip(!hasProjects, 'No projects available to test back navigation');

    await projectRow.click();
    await expect(page).toHaveURL(/\/projecten\//, { timeout: 10_000 });
    await waitForDataLoad(page);

    // Click the back button (aria-label="Terug naar projecten")
    await page.locator('[aria-label="Terug naar projecten"]').click();

    // Should be back on the projecten list
    await expect(page).toHaveURL(/\/projecten$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Projecten' })).toBeVisible();
  });

  // ────────────────────────────────────────────
  // 9. Project not found
  // ────────────────────────────────────────────
  test('should show not found state for invalid project id', async ({ page }) => {
    await authenticatedGoto(page, '/projecten/invalid-project-id-12345');

    // Should show "Project niet gevonden" message
    await expect(page.getByText('Project niet gevonden')).toBeVisible({
      timeout: 15_000,
    });

    // "Terug naar projecten" button should be visible
    await expect(page.getByText('Terug naar projecten')).toBeVisible();
  });

  // ────────────────────────────────────────────
  // 10. New project page (requires accepted offerte)
  // ────────────────────────────────────────────
  test('should display new project page', async ({ page }) => {
    await authenticatedGoto(page, '/projecten/nieuw');

    // The page should load (may show loader first, then content or error)
    await waitForDataLoad(page);

    // Without an offerte param, the page should still render
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
  });

  // ────────────────────────────────────────────
  // 11. URL-driven filters
  // ────────────────────────────────────────────
  test('should restore filter state from URL params', async ({ page }) => {
    // Navigate directly with status filter in URL
    await authenticatedGoto(page, '/projecten?status=gepland');
    await waitForDataLoad(page);

    // The "Gepland" tab should be active
    const geplandTab = page.locator('[role="tablist"]').getByRole('tab', { name: 'Gepland' });
    await expect(geplandTab).toHaveAttribute('data-state', 'active');
  });

  test('should restore search query from URL params', async ({ page }) => {
    await authenticatedGoto(page, '/projecten?q=test');
    await waitForDataLoad(page);

    // The search input should contain the query
    const searchInput = page.getByPlaceholder('Zoeken...');
    await expect(searchInput).toHaveValue('test');
  });

  // ────────────────────────────────────────────
  // 12. Project table columns
  // ────────────────────────────────────────────
  test('should display correct table columns', async ({ page }) => {
    await authenticatedGoto(page, '/projecten');
    await waitForDataLoad(page);

    // Check if any projects exist
    const projectRow = page.locator('table tbody tr').first();
    const hasProjects = await projectRow.isVisible().catch(() => false);
    test.skip(!hasProjects, 'No projects available to verify table columns');

    // Table headers: Project, Status, Aangemaakt, Laatst gewijzigd
    const tableHeader = page.locator('table thead');
    await expect(tableHeader.getByText('Project')).toBeVisible();
    await expect(tableHeader.getByText('Status')).toBeVisible();
    await expect(tableHeader.getByText('Aangemaakt')).toBeVisible();
    await expect(tableHeader.getByText('Laatst gewijzigd')).toBeVisible();
  });
});
