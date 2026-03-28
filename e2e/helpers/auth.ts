import { type Page, type BrowserContext, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

/**
 * Test user credentials — set via environment variables.
 * These should point to a dedicated Clerk test user account.
 *
 * Required env vars:
 *   E2E_CLERK_USER_EMAIL
 *   E2E_CLERK_USER_PASSWORD
 */
function getTestCredentials() {
  const email = process.env.E2E_CLERK_USER_EMAIL;
  const password = process.env.E2E_CLERK_USER_PASSWORD;

  return { email, password };
}

/**
 * Check whether test credentials are configured.
 */
export function hasTestCredentials(): boolean {
  const { email, password } = getTestCredentials();
  return !!(email && password);
}

/**
 * Log in via the Clerk sign-in page.
 *
 * Navigates to /sign-in, fills email + password, and waits
 * until the dashboard is loaded (redirect away from /sign-in).
 */
export async function login(page: Page): Promise<void> {
  const { email, password } = getTestCredentials();

  if (!email || !password) {
    throw new Error(
      'E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD must be set to run authenticated tests.',
    );
  }

  // Bypass Clerk bot detection for automated tests
  await setupClerkTestingToken({ page });

  await page.goto('/sign-in');

  // Clerk renders its own form (Dutch locale) — wait for the email input
  const emailInput = page.getByLabel('E-mailadres');
  await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
  await emailInput.fill(email);

  // Fill password — both fields visible on one page
  const passwordInput = page.getByLabel('Wachtwoord');
  await passwordInput.fill(password);

  // Click "Inloggen" to submit
  const loginButton = page.getByRole('button', { name: 'Inloggen' });
  await loginButton.click();

  // Wait for redirect away from sign-in — the dashboard should load
  await page.waitForURL((url) => !url.pathname.includes('sign-in'), {
    timeout: 15_000,
  });
}

/**
 * Assert that the user is currently authenticated by checking
 * that navigating to the dashboard does NOT redirect to /sign-in.
 */
export async function assertAuthenticated(page: Page): Promise<void> {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  const url = page.url();
  expect(url).not.toContain('sign-in');
}

/**
 * Save the authenticated session state to a file so it can be
 * reused across tests without logging in every time.
 */
export async function saveAuthState(
  context: BrowserContext,
  path: string = 'e2e/.auth/state.json',
): Promise<void> {
  await context.storageState({ path });
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to the offerte list page and wait for it to load.
 */
export async function navigateToOffertes(page: Page): Promise<void> {
  await page.goto('/offertes');
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to a new aanleg offerte wizard.
 */
export async function navigateToNieuweAanleg(page: Page): Promise<void> {
  await page.goto('/offertes/nieuw/aanleg');
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to a new onderhoud offerte wizard.
 */
export async function navigateToNieuwOnderhoud(page: Page): Promise<void> {
  await page.goto('/offertes/nieuw/onderhoud');
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to a specific offerte detail page.
 */
export async function navigateToOfferteDetail(
  page: Page,
  offerteId: string,
): Promise<void> {
  await page.goto(`/offertes/${offerteId}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for Convex data to finish loading.
 *
 * Convex queries resolve asynchronously. This helper waits until
 * loading indicators (skeleton / spinner) disappear from the page.
 */
export async function waitForConvexData(
  page: Page,
  timeout = 10_000,
): Promise<void> {
  // Wait for any skeleton loaders to disappear
  const skeleton = page.locator('[class*="skeleton"], [class*="Skeleton"]');
  if ((await skeleton.count()) > 0) {
    await skeleton.first().waitFor({ state: 'hidden', timeout });
  }

  // Wait for any Loader2 spinners to disappear
  const spinner = page.locator('[class*="animate-spin"]');
  if ((await spinner.count()) > 0) {
    await spinner.first().waitFor({ state: 'hidden', timeout });
  }
}

// ---------------------------------------------------------------------------
// Wizard interaction helpers
// ---------------------------------------------------------------------------

/**
 * Fill in the klant (customer) data manually in the wizard form.
 */
export async function fillKlantData(
  page: Page,
  data: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
  },
): Promise<void> {
  // Fill in the required customer fields
  const naamInput = page
    .locator('input[name="naam"], label:has-text("Naam") + input, label:has-text("Naam") ~ input')
    .first();
  await naamInput.fill(data.naam);

  const adresInput = page
    .locator('input[name="adres"], label:has-text("Adres") + input, label:has-text("Adres") ~ input')
    .first();
  await adresInput.fill(data.adres);

  const postcodeInput = page
    .locator(
      'input[name="postcode"], label:has-text("Postcode") + input, label:has-text("Postcode") ~ input',
    )
    .first();
  await postcodeInput.fill(data.postcode);

  const plaatsInput = page
    .locator(
      'input[name="plaats"], label:has-text("Plaats") + input, label:has-text("Plaats") ~ input',
    )
    .first();
  await plaatsInput.fill(data.plaats);

  if (data.email) {
    const emailInput = page
      .locator(
        'input[name="email"], label:has-text("Email") + input, label:has-text("E-mail") ~ input',
      )
      .first();
    await emailInput.fill(data.email);
  }

  if (data.telefoon) {
    const telefoonInput = page
      .locator(
        'input[name="telefoon"], label:has-text("Telefoon") + input, label:has-text("Telefoon") ~ input',
      )
      .first();
    await telefoonInput.fill(data.telefoon);
  }
}

/**
 * Click the "Volgende" (Next) button in a wizard step.
 */
export async function clickVolgende(page: Page): Promise<void> {
  const button = page.locator('button:has-text("Volgende")').first();
  await button.click();
}

/**
 * Click the "Vorige" (Previous) button in a wizard step.
 */
export async function clickVorige(page: Page): Promise<void> {
  const button = page.locator('button:has-text("Vorige")').first();
  await button.click();
}

/**
 * Select a scope by clicking on it (checkbox-style toggle).
 */
export async function selectScope(page: Page, scopeNaam: string): Promise<void> {
  const scopeCard = page.locator(`[role="checkbox"]:has-text("${scopeNaam}")`);
  await scopeCard.click();
}

/**
 * Generate unique test klant data for use in wizard flows.
 */
export function getTestKlantData() {
  const timestamp = Date.now();
  return {
    naam: `E2E Test Klant ${timestamp}`,
    adres: 'Teststraat 123',
    postcode: '1234 AB',
    plaats: 'Teststad',
    email: `test-${timestamp}@example.com`,
    telefoon: '0612345678',
  };
}

// ---------------------------------------------------------------------------
// Aliases used by klant-crud and project-lifecycle tests
// ---------------------------------------------------------------------------

/**
 * Log in and navigate to a dashboard page.
 * Waits for the target path to actually load (guards against role-based redirects).
 */
export async function authenticatedGoto(page: Page, path: string): Promise<void> {
  await login(page);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/**
 * Check if the current page was redirected away from the target path.
 * Useful for pages behind RequireRole guards.
 * Returns true if the page is on the expected path, false if redirected.
 */
export async function isOnExpectedPage(page: Page, expectedPathPrefix: string): Promise<boolean> {
  const url = new URL(page.url());
  return url.pathname.startsWith(expectedPathPrefix);
}

/**
 * Alias for waitForConvexData.
 */
export async function waitForDataLoad(page: Page): Promise<void> {
  await waitForConvexData(page);
}
