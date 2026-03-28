import { test, expect } from '@playwright/test';
import { authenticatedGoto, waitForDataLoad, isOnExpectedPage } from './helpers/auth';

/**
 * E2E tests for Klant (Customer) CRUD operations.
 *
 * Page under test: /klanten
 * The page is role-protected (directie, projectleider) and uses
 * Clerk auth + Convex backend. All UI text is in Dutch.
 *
 * NOTE: The /klanten page is behind a RequireRole guard that requires
 * "directie" or "projectleider" role. If the E2E test user does not
 * have one of these roles, the page will redirect to /dashboard and
 * all tests will be skipped.
 */

// Unique suffix to avoid collisions between parallel test runs
const UNIQUE = Date.now().toString(36);
const TEST_KLANT = {
  naam: `E2E Testklant ${UNIQUE}`,
  adres: 'Teststraat 42',
  postcode: '1234 AB',
  plaats: 'Amsterdam',
  email: `e2e-${UNIQUE}@test.toptuinen.nl`,
  telefoon: '06-12345678',
  notities: 'Aangemaakt door E2E test',
};

const UPDATED_KLANT = {
  naam: `E2E Testklant Bijgewerkt ${UNIQUE}`,
  adres: 'Nieuwelaan 100',
  postcode: '5678 CD',
  plaats: 'Rotterdam',
  telefoon: '06-87654321',
};

test.describe('Klanten CRUD', () => {
  test.describe.configure({ mode: 'serial' });

  // ────────────────────────────────────────────
  // 1. Navigate to klanten list
  // ────────────────────────────────────────────
  test('should navigate to klanten list page', async ({ page }) => {
    await authenticatedGoto(page, '/klanten');

    // The /klanten page requires "directie" or "projectleider" role.
    // If the test user doesn't have this role, they get redirected to /dashboard.
    const onKlantenPage = await isOnExpectedPage(page, '/klanten');
    test.skip(!onKlantenPage, 'Test user does not have the required role (directie/projectleider) to access /klanten');

    // Page title should be visible
    await expect(page.getByRole('heading', { level: 1, name: 'Klanten' })).toBeVisible({ timeout: 10_000 });

    // Wait for data to load
    await waitForDataLoad(page);
  });

  // ────────────────────────────────────────────
  // 2. Create a new klant
  // ────────────────────────────────────────────
  test('should open the new klant dialog and create a klant', async ({ page }) => {
    await authenticatedGoto(page, '/klanten');
    const onKlantenPage = await isOnExpectedPage(page, '/klanten');
    test.skip(!onKlantenPage, 'Test user does not have the required role to access /klanten');

    await waitForDataLoad(page);

    // Click "Nieuwe Klant" button to open the dialog
    await page.getByRole('button', { name: 'Nieuwe Klant' }).click();

    // The dialog should appear
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Nieuwe Klant')).toBeVisible();

    // Fill in the required fields
    await dialog.locator('#naam').fill(TEST_KLANT.naam);
    await dialog.locator('#adres').fill(TEST_KLANT.adres);
    await dialog.locator('#postcode').fill(TEST_KLANT.postcode);
    await dialog.locator('#plaats').fill(TEST_KLANT.plaats);

    // Fill optional fields
    await dialog.locator('#telefoon').fill(TEST_KLANT.telefoon);
    await dialog.locator('#email').fill(TEST_KLANT.email);
    await dialog.locator('#notities').fill(TEST_KLANT.notities);

    // Submit the form
    await dialog.getByRole('button', { name: 'Toevoegen' }).click();

    // Dialog should close
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Success toast should appear
    await expect(page.getByText('Klant toegevoegd')).toBeVisible({ timeout: 5_000 });

    // The new klant should appear in the list
    await expect(page.getByText(TEST_KLANT.naam)).toBeVisible({ timeout: 10_000 });
  });

  // ────────────────────────────────────────────
  // 3. Search / filter klanten
  // ────────────────────────────────────────────
  test('should search for a klant by name', async ({ page }) => {
    await authenticatedGoto(page, '/klanten');
    const onKlantenPage = await isOnExpectedPage(page, '/klanten');
    test.skip(!onKlantenPage, 'Test user does not have the required role to access /klanten');

    await waitForDataLoad(page);

    // Locate the search input
    const searchInput = page.getByPlaceholder('Zoek klanten...');
    await expect(searchInput).toBeVisible();

    // Type the unique test klant name
    await searchInput.fill(TEST_KLANT.naam);

    // Wait for debounced search to take effect
    await page.waitForTimeout(500);

    // The test klant should be visible in filtered results
    await expect(page.getByText(TEST_KLANT.naam)).toBeVisible({ timeout: 10_000 });
  });

  test('should filter klanten by pipeline status', async ({ page }) => {
    await authenticatedGoto(page, '/klanten');
    const onKlantenPage = await isOnExpectedPage(page, '/klanten');
    test.skip(!onKlantenPage, 'Test user does not have the required role to access /klanten');

    await waitForDataLoad(page);

    // Click the "Lead" pipeline filter badge (first match to avoid sidebar links)
    // The pipeline badges show "Lead (count)" text
    const leadBadge = page.getByText(/^Lead \(\d+\)$/).first();
    await leadBadge.click();

    // Wait for filter to apply
    await page.waitForTimeout(300);

    // URL should update with pipeline param
    await expect(page).toHaveURL(/pipeline=lead/);
  });

  test('should filter klanten by type', async ({ page }) => {
    await authenticatedGoto(page, '/klanten');
    const onKlantenPage = await isOnExpectedPage(page, '/klanten');
    test.skip(!onKlantenPage, 'Test user does not have the required role to access /klanten');

    await waitForDataLoad(page);

    // Click the "Particulier" type filter badge
    // The type filter section has a "Type:" label followed by badges
    const particulierBadge = page.getByText('Particulier').first();
    await particulierBadge.click();

    // Wait for filter to apply
    await page.waitForTimeout(300);

    // URL should update with type param
    await expect(page).toHaveURL(/type=particulier/);
  });

  // ────────────────────────────────────────────
  // 4. View klant detail page
  // ────────────────────────────────────────────
  test('should navigate to klant detail page', async ({ page }) => {
    await authenticatedGoto(page, '/klanten');
    const onKlantenPage = await isOnExpectedPage(page, '/klanten');
    test.skip(!onKlantenPage, 'Test user does not have the required role to access /klanten');

    await waitForDataLoad(page);

    // Search for our test klant first
    const searchInput = page.getByPlaceholder('Zoek klanten...');
    await searchInput.fill(TEST_KLANT.naam);
    await page.waitForTimeout(500);

    // Click the klant name link in the table
    await page.getByRole('link', { name: TEST_KLANT.naam }).first().click();

    // Should navigate to the detail page
    await expect(page).toHaveURL(/\/klanten\//, { timeout: 10_000 });

    // Klant name should be displayed as heading
    await expect(page.getByRole('heading', { level: 1, name: TEST_KLANT.naam })).toBeVisible({
      timeout: 10_000,
    });

    // Contact details card should show the address
    await expect(page.getByText('Contactgegevens')).toBeVisible();
    await expect(page.getByText(TEST_KLANT.adres)).toBeVisible();
    await expect(page.getByText(TEST_KLANT.postcode)).toBeVisible();
    await expect(page.getByText(TEST_KLANT.plaats)).toBeVisible();

    // Phone and email should be visible
    await expect(page.getByText(TEST_KLANT.telefoon)).toBeVisible();
    await expect(page.getByText(TEST_KLANT.email)).toBeVisible();

    // Notes should be visible
    await expect(page.getByText(TEST_KLANT.notities)).toBeVisible();

    // Statistics card should exist
    await expect(page.getByText('Statistieken')).toBeVisible();

    // Offertes section should exist
    await expect(page.getByText('Offertes').first()).toBeVisible();
  });

  test('should show pipeline status badge on klant detail', async ({ page }) => {
    await authenticatedGoto(page, '/klanten');
    const onKlantenPage = await isOnExpectedPage(page, '/klanten');
    test.skip(!onKlantenPage, 'Test user does not have the required role to access /klanten');

    await waitForDataLoad(page);

    // Navigate to klant detail via search
    const searchInput = page.getByPlaceholder('Zoek klanten...');
    await searchInput.fill(TEST_KLANT.naam);
    await page.waitForTimeout(500);
    await page.getByRole('link', { name: TEST_KLANT.naam }).first().click();

    await expect(page).toHaveURL(/\/klanten\//, { timeout: 10_000 });

    // Pipeline status badge should be visible (default is "Lead")
    await expect(page.getByText('Lead').first()).toBeVisible();

    // Klant type badge should be visible (default is "Particulier")
    await expect(page.getByText('Particulier').first()).toBeVisible();
  });

  // ────────────────────────────────────────────
  // 5. Edit klant information
  // ────────────────────────────────────────────
  test('should edit a klant via the edit dialog', async ({ page }) => {
    await authenticatedGoto(page, '/klanten');
    const onKlantenPage = await isOnExpectedPage(page, '/klanten');
    test.skip(!onKlantenPage, 'Test user does not have the required role to access /klanten');

    await waitForDataLoad(page);

    // Search for our test klant
    const searchInput = page.getByPlaceholder('Zoek klanten...');
    await searchInput.fill(TEST_KLANT.naam);
    await page.waitForTimeout(500);

    // Click the edit button (pencil icon) on the klant row
    await page.locator('button[aria-label="Bewerken"]').first().click();

    // The edit dialog should appear
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Klant Bewerken')).toBeVisible();

    // Clear and fill updated fields
    await dialog.locator('#naam').clear();
    await dialog.locator('#naam').fill(UPDATED_KLANT.naam);

    await dialog.locator('#adres').clear();
    await dialog.locator('#adres').fill(UPDATED_KLANT.adres);

    await dialog.locator('#postcode').clear();
    await dialog.locator('#postcode').fill(UPDATED_KLANT.postcode);

    await dialog.locator('#plaats').clear();
    await dialog.locator('#plaats').fill(UPDATED_KLANT.plaats);

    await dialog.locator('#telefoon').clear();
    await dialog.locator('#telefoon').fill(UPDATED_KLANT.telefoon);

    // Click save button
    await dialog.getByRole('button', { name: 'Opslaan' }).click();

    // Dialog should close
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Success toast
    await expect(page.getByText('Klant bijgewerkt')).toBeVisible({ timeout: 5_000 });

    // Updated name should appear in the list
    await expect(page.getByText(UPDATED_KLANT.naam)).toBeVisible({ timeout: 10_000 });
  });

  // ────────────────────────────────────────────
  // 6. Delete klant (with confirmation dialog)
  // ────────────────────────────────────────────
  test('should delete a klant with confirmation dialog', async ({ page }) => {
    await authenticatedGoto(page, '/klanten');
    const onKlantenPage = await isOnExpectedPage(page, '/klanten');
    test.skip(!onKlantenPage, 'Test user does not have the required role to access /klanten');

    await waitForDataLoad(page);

    // Search for our updated test klant
    const searchInput = page.getByPlaceholder('Zoek klanten...');
    await searchInput.fill(UPDATED_KLANT.naam);
    await page.waitForTimeout(500);

    // Click the delete button (trash icon) on the klant row
    await page.locator('button[aria-label="Verwijderen"]').first().click();

    // The AlertDialog confirmation should appear
    const alertDialog = page.locator('[role="alertdialog"]');
    await expect(alertDialog).toBeVisible();
    await expect(page.getByText('Klant Verwijderen')).toBeVisible();
    await expect(page.getByText('Weet je zeker dat je')).toBeVisible();

    // Click the destructive "Verwijderen" button to confirm
    await alertDialog.getByRole('button', { name: 'Verwijderen' }).click();

    // Dialog should close
    await expect(alertDialog).toBeHidden({ timeout: 10_000 });

    // Success toast
    await expect(page.getByText('Klant verwijderd')).toBeVisible({ timeout: 5_000 });

    // The klant should no longer be visible in the list
    await expect(page.getByText(UPDATED_KLANT.naam)).toBeHidden({ timeout: 10_000 });
  });

  // ────────────────────────────────────────────
  // 7. Form validation
  // ────────────────────────────────────────────
  test('should show validation error when required fields are empty', async ({ page }) => {
    await authenticatedGoto(page, '/klanten');
    const onKlantenPage = await isOnExpectedPage(page, '/klanten');
    test.skip(!onKlantenPage, 'Test user does not have the required role to access /klanten');

    await waitForDataLoad(page);

    // Open "Nieuwe Klant" dialog
    await page.getByRole('button', { name: 'Nieuwe Klant' }).click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Leave all fields empty and click "Toevoegen"
    await dialog.getByRole('button', { name: 'Toevoegen' }).click();

    // Should show a toast error about required fields
    await expect(page.getByText('Vul alle verplichte velden in')).toBeVisible({ timeout: 5_000 });

    // Dialog should remain open
    await expect(dialog).toBeVisible();
  });

  // ────────────────────────────────────────────
  // 8. Klant detail — back navigation
  // ────────────────────────────────────────────
  test('should navigate back from klant detail to klanten list', async ({ page }) => {
    await authenticatedGoto(page, '/klanten');
    const onKlantenPage = await isOnExpectedPage(page, '/klanten');
    test.skip(!onKlantenPage, 'Test user does not have the required role to access /klanten');

    await waitForDataLoad(page);

    // Click into the first klant (if any)
    const firstKlantLink = page.locator('a[href^="/klanten/"]').first();
    const klantVisible = await firstKlantLink.isVisible().catch(() => false);
    test.skip(!klantVisible, 'No klanten available to test back navigation');

    await firstKlantLink.click();
    await expect(page).toHaveURL(/\/klanten\//, { timeout: 10_000 });

    // Click the back button (aria-label="Terug naar klanten")
    await page.locator('[aria-label="Terug naar klanten"]').first().click();

    // Should be back on the klanten list
    await expect(page).toHaveURL(/\/klanten$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Klanten' })).toBeVisible();
  });

  // ────────────────────────────────────────────
  // 9. Klant detail — empty offertes state
  // ────────────────────────────────────────────
  test('should show empty offertes state on new klant detail', async ({ page }) => {
    await authenticatedGoto(page, '/klanten');
    const onKlantenPage = await isOnExpectedPage(page, '/klanten');
    test.skip(!onKlantenPage, 'Test user does not have the required role to access /klanten');

    await waitForDataLoad(page);

    const freshName = `E2E Empty ${Date.now().toString(36)}`;

    // Open add dialog
    await page.getByRole('button', { name: 'Nieuwe Klant' }).click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Fill minimal required fields
    await dialog.locator('#naam').fill(freshName);
    await dialog.locator('#adres').fill('Testweg 1');
    await dialog.locator('#postcode').fill('9999 ZZ');
    await dialog.locator('#plaats').fill('Teststad');

    await dialog.getByRole('button', { name: 'Toevoegen' }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Navigate to the new klant detail
    await page.getByPlaceholder('Zoek klanten...').fill(freshName);
    await page.waitForTimeout(500);
    await page.getByRole('link', { name: freshName }).first().click();

    await expect(page).toHaveURL(/\/klanten\//, { timeout: 10_000 });

    // Should show the "Nog geen offertes" empty state
    await expect(page.getByText('Nog geen offertes')).toBeVisible({ timeout: 10_000 });
  });
});
