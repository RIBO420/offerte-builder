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

  // The single login form lives at the app root "/".
  await page.goto('/');

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

  // Wait for redirect into the authenticated app — the login form lives at "/",
  // so wait for the dashboard (or klant portal) instead of "away from /sign-in".
  await page.waitForURL(
    (url) =>
      url.pathname.includes('dashboard') || url.pathname.includes('portaal'),
    { timeout: 15_000 },
  );
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
 * Open het werkblad voor een aanleg-offerte (fase B: geen wizard meer —
 * bij binnenkomst bestaat het concept al).
 */
export async function navigateToNieuweAanleg(page: Page): Promise<void> {
  await page.goto('/offertes/nieuw/aanleg');
  await page.waitForLoadState('networkidle');
}

/** Open het werkblad voor een onderhoud-offerte. */
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
 * Koppel een klant in het werkblad.
 *
 * Het werkblad heeft geen losse naam/adres-velden meer: je kiest een klant
 * (of lead) uit de lijst, precies zoals kantoor dat doet. Daarom pakt deze
 * helper de eerste klant uit "Recente klanten".
 */
export async function koppelEersteKlant(page: Page): Promise<string | null> {
  const sectie = page.locator("#werkbank-klant");
  await sectie.getByRole("combobox").first().click();
  const eerste = page.getByRole("option").first();
  await eerste.waitFor({ state: "visible", timeout: 10_000 });
  const naam = await eerste.textContent();
  await eerste.click();
  return naam?.trim() ?? null;
}

/**
 * Zet een scope in het document via het palet (of haal hem eruit).
 * De knop draagt de lettertoets en de scopenaam.
 */
export async function kiesScopeInPalet(
  page: Page,
  scopeNaam: string,
): Promise<void> {
  await page
    .getByRole("button", { name: new RegExp(scopeNaam, "i") })
    .first()
    .click();
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
