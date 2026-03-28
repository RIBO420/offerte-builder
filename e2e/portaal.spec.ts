import { test, expect } from '@playwright/test';

/** Portal login page (Clerk <SignIn> component). */
const PORTAAL_LOGIN_URL = '/portaal/inloggen';

// ---------------------------------------------------------------------------
// Klantenportaal (Customer Portal) E2E Tests
//
// The portal lives under /portaal and requires Clerk authentication.
// These tests verify:
//   1. Unauthenticated users are redirected to sign-in
//   2. The portal login page renders correctly
//   3. Portal navigation structure (sidebar links)
//   4. Individual portal sections render expected headings / empty states
//   5. Detail pages handle missing resources gracefully
//
// NOTE: Tests that require a logged-in session are marked with
// `test.skip` when no test credentials are available (CI without Clerk
// Testing Tokens).  Remove the skip once credentials are configured.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. Auth gate — unauthenticated access
// ---------------------------------------------------------------------------

test.describe('Portaal — Auth Gate', () => {
  test('should redirect unauthenticated users to the login page', async ({ page }) => {
    await page.goto('/portaal/overzicht');

    // The portal layout checks isAuthenticated and the Clerk middleware
    // should redirect to /portaal/inloggen or a Clerk-hosted sign-in URL.
    await expect(page).toHaveURL(/inloggen|sign-in/);
  });

  test('should redirect /portaal/offertes to login when not authenticated', async ({ page }) => {
    await page.goto('/portaal/offertes');
    await expect(page).toHaveURL(/inloggen|sign-in/);
  });

  test('should redirect /portaal/projecten to login when not authenticated', async ({ page }) => {
    await page.goto('/portaal/projecten');
    await expect(page).toHaveURL(/inloggen|sign-in/);
  });

  test('should redirect /portaal/facturen to login when not authenticated', async ({ page }) => {
    await page.goto('/portaal/facturen');
    await expect(page).toHaveURL(/inloggen|sign-in/);
  });

  test('should redirect /portaal/documenten to login when not authenticated', async ({ page }) => {
    await page.goto('/portaal/documenten');
    await expect(page).toHaveURL(/inloggen|sign-in/);
  });

  test('should redirect /portaal/chat to login when not authenticated', async ({ page }) => {
    await page.goto('/portaal/chat');
    await expect(page).toHaveURL(/inloggen|sign-in/);
  });

  test('should redirect /portaal/profiel to login when not authenticated', async ({ page }) => {
    await page.goto('/portaal/profiel');
    await expect(page).toHaveURL(/inloggen|sign-in/);
  });
});

// ---------------------------------------------------------------------------
// 2. Login page
// ---------------------------------------------------------------------------

test.describe('Portaal — Login Page', () => {
  test('should render the login page with Top Tuinen branding', async ({ page }) => {
    await page.goto(PORTAAL_LOGIN_URL);

    // The auth layout shows "Top Tuinen" and "Klantenportaal" branding
    await expect(page.locator('text=Top Tuinen')).toBeVisible();
    await expect(page.locator('text=Klantenportaal')).toBeVisible();
  });

  test('should show the Clerk sign-in component', async ({ page }) => {
    await page.goto(PORTAAL_LOGIN_URL);

    // Clerk <SignIn> renders a form — wait for it to load
    // The component renders with a card that contains sign-in controls
    const clerkRoot = page.locator('.cl-rootBox, .cl-signIn-root, [data-clerk-component]');
    await expect(clerkRoot.first()).toBeVisible({ timeout: 15_000 });
  });

  test('should display the "TT" logo badge', async ({ page }) => {
    await page.goto(PORTAAL_LOGIN_URL);

    // The auth layout contains a "TT" logo element
    await expect(page.locator('text=TT')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Registration page
// ---------------------------------------------------------------------------

test.describe('Portaal — Registration Page', () => {
  test('should render the registration page', async ({ page }) => {
    await page.goto('/portaal/registreren');

    // Should show the Top Tuinen branding
    await expect(page.getByText('Top Tuinen', { exact: true })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Portal sections (authenticated)
//
// These tests require a valid Clerk session.  In local dev you can set
// E2E_PORTAAL_EMAIL and E2E_PORTAAL_PASSWORD environment variables.
// In CI, configure Clerk Testing Tokens and update helpers/auth.ts.
//
// When no credentials are available the tests verify that the portal
// layout at least begins rendering (the loading spinner / auth check).
// ---------------------------------------------------------------------------

test.describe('Portaal — Overzicht (Dashboard)', () => {
  // Without auth, we can only test that the page starts loading
  test('should show loading state or redirect', async ({ page }) => {
    const response = await page.goto('/portaal/overzicht');

    // Either we get the portal loading spinner or a redirect to login
    const url = page.url();
    const isPortaal = url.includes('/portaal/overzicht');
    const isLogin = url.includes('inloggen') || url.includes('sign-in');

    expect(isPortaal || isLogin).toBeTruthy();

    if (isPortaal) {
      // If somehow we got to the page (e.g. during dev), the layout should
      // show at least the loading spinner
      const spinner = page.locator('.animate-spin');
      const main = page.locator('main');
      await expect(spinner.or(main)).toBeVisible({ timeout: 10_000 });
    }
  });
});

test.describe('Portaal — Offertes', () => {
  test('should redirect to login or show the offertes page', async ({ page }) => {
    await page.goto('/portaal/offertes');
    const url = page.url();

    if (url.includes('/portaal/offertes')) {
      // Page heading
      await expect(page.locator('h1:has-text("Offertes")')).toBeVisible({ timeout: 10_000 });
      // Subtitle text
      await expect(page.locator('text=Bekijk en reageer op uw offertes')).toBeVisible();

      // Should show either offerte cards or the empty state
      const emptyState = page.locator('text=Geen offertes');
      const offerteCard = page.locator('[class*="rounded-xl"]').first();
      await expect(emptyState.or(offerteCard)).toBeVisible({ timeout: 10_000 });
    } else {
      // Redirected to login — that's expected
      expect(url).toMatch(/inloggen|sign-in/);
    }
  });

  test('empty state should show informative message', async ({ page }) => {
    await page.goto('/portaal/offertes');
    const url = page.url();
    if (!url.includes('/portaal/offertes')) {
      test.skip(); // Not authenticated
      return;
    }

    // If the empty state is visible, verify the message
    const emptyState = page.locator('text=Geen offertes');
    if (await emptyState.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(
        page.locator('text=Er zijn nog geen offertes voor u beschikbaar'),
      ).toBeVisible();
    }
  });
});

test.describe('Portaal — Projecten', () => {
  test('should redirect to login or show the projecten page', async ({ page }) => {
    await page.goto('/portaal/projecten');
    const url = page.url();

    if (url.includes('/portaal/projecten')) {
      await expect(page.locator('h1:has-text("Projecten")')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('text=Volg de voortgang van uw projecten')).toBeVisible();

      // Empty state or project cards
      const emptyState = page.locator('text=Geen projecten');
      const projectCard = page.locator('text=Bekijken').first();
      await expect(emptyState.or(projectCard)).toBeVisible({ timeout: 10_000 });
    } else {
      expect(url).toMatch(/inloggen|sign-in/);
    }
  });

  test('empty state should show informative message', async ({ page }) => {
    await page.goto('/portaal/projecten');
    const url = page.url();
    if (!url.includes('/portaal/projecten')) {
      test.skip();
      return;
    }

    const emptyState = page.locator('text=Geen projecten');
    if (await emptyState.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(
        page.locator('text=Er zijn nog geen lopende projecten'),
      ).toBeVisible();
    }
  });
});

test.describe('Portaal — Facturen', () => {
  test('should redirect to login or show the facturen page', async ({ page }) => {
    await page.goto('/portaal/facturen');
    const url = page.url();

    if (url.includes('/portaal/facturen')) {
      await expect(page.locator('h1:has-text("Facturen")')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('text=Bekijk en betaal uw facturen')).toBeVisible();

      // Empty state or factuur cards
      const emptyState = page.locator('text=Geen facturen');
      const factuurCard = page.locator('[class*="rounded-xl"]').first();
      await expect(emptyState.or(factuurCard)).toBeVisible({ timeout: 10_000 });
    } else {
      expect(url).toMatch(/inloggen|sign-in/);
    }
  });

  test('empty state should show informative message', async ({ page }) => {
    await page.goto('/portaal/facturen');
    const url = page.url();
    if (!url.includes('/portaal/facturen')) {
      test.skip();
      return;
    }

    const emptyState = page.locator('text=Geen facturen');
    if (await emptyState.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(
        page.locator('text=Er zijn nog geen facturen beschikbaar'),
      ).toBeVisible();
    }
  });
});

test.describe('Portaal — Documenten', () => {
  test('should redirect to login or show the documenten page', async ({ page }) => {
    await page.goto('/portaal/documenten');
    const url = page.url();

    if (url.includes('/portaal/documenten')) {
      await expect(page.locator('h1:has-text("Documenten")')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('text=Download uw offertes en facturen als PDF')).toBeVisible();

      // Empty state or document sections
      const emptyState = page.locator('text=Er zijn nog geen documenten beschikbaar');
      const documentSection = page.locator('h2:has-text("Offertes"), h2:has-text("Facturen")').first();
      await expect(emptyState.or(documentSection)).toBeVisible({ timeout: 10_000 });
    } else {
      expect(url).toMatch(/inloggen|sign-in/);
    }
  });
});

test.describe('Portaal — Berichten (Chat)', () => {
  test('should redirect to login or show the berichten page', async ({ page }) => {
    await page.goto('/portaal/chat');
    const url = page.url();

    if (url.includes('/portaal/chat')) {
      await expect(page.locator('h1:has-text("Berichten")')).toBeVisible({ timeout: 10_000 });
      await expect(
        page.locator('text=Communiceer direct met Top Tuinen'),
      ).toBeVisible();

      // Should show the chat layout with "Gesprekken" sidebar
      await expect(page.locator('h2:has-text("Gesprekken")')).toBeVisible();
    } else {
      expect(url).toMatch(/inloggen|sign-in/);
    }
  });
});

test.describe('Portaal — Profiel', () => {
  test('should redirect to login or show the profiel page', async ({ page }) => {
    await page.goto('/portaal/profiel');
    const url = page.url();

    if (url.includes('/portaal/profiel')) {
      await expect(page.locator('h1:has-text("Mijn profiel")')).toBeVisible({ timeout: 10_000 });
      await expect(
        page.locator('text=Beheer uw persoonlijke gegevens'),
      ).toBeVisible();

      // Should show the personal details card
      await expect(
        page.locator('h2:has-text("Persoonlijke gegevens")'),
      ).toBeVisible();

      // Should show the appearance toggle card
      await expect(page.locator('h2:has-text("Weergave")')).toBeVisible();

      // Should show the security card
      await expect(page.locator('h2:has-text("Beveiliging")')).toBeVisible();
    } else {
      expect(url).toMatch(/inloggen|sign-in/);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Detail pages — error handling
// ---------------------------------------------------------------------------

test.describe('Portaal — Offerte Detail (not found)', () => {
  test('should show "niet gevonden" or redirect for invalid offerte ID', async ({ page }) => {
    await page.goto('/portaal/offertes/invalid-id-12345');
    const url = page.url();

    if (url.includes('/portaal/offertes')) {
      // If authenticated, the page should show a "niet gevonden" message
      // or a skeleton (while Convex resolves null)
      const notFound = page.locator('text=Offerte niet gevonden');
      const backLink = page.locator('text=Terug naar offertes');
      const skeleton = page.locator('[class*="animate-pulse"]').first();
      await expect(notFound.or(backLink).or(skeleton)).toBeVisible({ timeout: 10_000 });
    } else {
      // Redirected to login
      expect(url).toMatch(/inloggen|sign-in/);
    }
  });
});

test.describe('Portaal — Project Detail (not found)', () => {
  test('should show "niet gevonden" or redirect for invalid project ID', async ({ page }) => {
    await page.goto('/portaal/projecten/invalid-id-12345');
    const url = page.url();

    if (url.includes('/portaal/projecten')) {
      const notFound = page.locator('text=Project niet gevonden');
      const backLink = page.locator('text=Terug naar projecten');
      const skeleton = page.locator('[class*="animate-pulse"]').first();
      await expect(notFound.or(backLink).or(skeleton)).toBeVisible({ timeout: 10_000 });
    } else {
      expect(url).toMatch(/inloggen|sign-in/);
    }
  });
});

test.describe('Portaal — Factuur Detail (not found)', () => {
  test('should show "niet gevonden" or redirect for invalid factuur ID', async ({ page }) => {
    await page.goto('/portaal/facturen/invalid-id-12345');
    const url = page.url();

    if (url.includes('/portaal/facturen')) {
      const notFound = page.locator('text=Factuur niet gevonden');
      const backLink = page.locator('text=Terug naar facturen');
      const skeleton = page.locator('[class*="animate-pulse"]').first();
      await expect(notFound.or(backLink).or(skeleton)).toBeVisible({ timeout: 10_000 });
    } else {
      expect(url).toMatch(/inloggen|sign-in/);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Portal navigation links
// ---------------------------------------------------------------------------

test.describe('Portaal — Navigation Structure', () => {
  test('portal navigation should contain all expected links', async ({ page }) => {
    // Navigate to the portal — even if redirected to login, the portal
    // uses a separate nav component. We check the nav links exist when
    // the layout is rendered. If redirected to login, we skip.
    await page.goto('/portaal/overzicht');
    const url = page.url();

    if (!url.includes('/portaal/overzicht')) {
      test.skip(); // Not authenticated
      return;
    }

    // The PortaalNav component renders links for each section
    const expectedLinks = [
      { href: '/portaal/overzicht', label: 'Overzicht' },
      { href: '/portaal/offertes', label: 'Offertes' },
      { href: '/portaal/projecten', label: 'Projecten' },
      { href: '/portaal/facturen', label: 'Facturen' },
      { href: '/portaal/chat', label: 'Berichten' },
      { href: '/portaal/documenten', label: 'Documenten' },
    ];

    for (const link of expectedLinks) {
      const navLink = page.locator(`a[href="${link.href}"]`);
      await expect(navLink).toBeVisible();
      await expect(navLink).toContainText(link.label);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Koppelen (account linking) page
// ---------------------------------------------------------------------------

test.describe('Portaal — Koppelen Page', () => {
  test('should render the account linking page', async ({ page }) => {
    await page.goto('/portaal/koppelen');

    // This page is under the auth layout, so it should show Top Tuinen branding
    await expect(page.locator('text=Top Tuinen')).toBeVisible();
  });
});
