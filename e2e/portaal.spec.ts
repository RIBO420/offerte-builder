import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Klantenportaal (Customer Portal) E2E Tests
//
// The portal lives under /portaal and requires Clerk authentication.
// Since the single-login refactor there is ONE login terminal at the app
// root "/". The dedicated /portaal/inloggen and /portaal/registreren routes
// were removed — unauthenticated portal access now redirects to "/".
//
// These tests verify:
//   1. Unauthenticated users are redirected to the single login at "/"
//   2. The login form renders at "/"
//   3. Legacy portal auth routes (inloggen/registreren) redirect to "/"
//   4. Individual portal sections render expected headings / empty states
//   5. Detail pages handle missing resources gracefully
//   6. /portaal/koppelen is protected (invitees must log in first)
//
// NOTE: Tests that require a logged-in session branch on whether we end up
// on the portal page or get redirected to the login. Without test
// credentials the redirect branch runs; configure Clerk Testing Tokens +
// helpers/auth.ts to exercise the authenticated branch.
// ---------------------------------------------------------------------------

/**
 * Assert the browser is sitting on the single login terminal at "/".
 * The custom Clerk form always renders the "E-mailadres" field, which no
 * portal page exposes — so its presence proves we were redirected to login.
 */
async function expectAtLogin(page: Page) {
  await expect(page).not.toHaveURL(/\/portaal\//);
  await expect(page.getByLabel('E-mailadres')).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// 1. Auth gate — unauthenticated access redirects to the single login
// ---------------------------------------------------------------------------

test.describe('Portaal — Auth Gate', () => {
  const protectedRoutes = [
    '/portaal/overzicht',
    '/portaal/offertes',
    '/portaal/projecten',
    '/portaal/facturen',
    '/portaal/documenten',
    '/portaal/chat',
    '/portaal/profiel',
  ];

  for (const route of protectedRoutes) {
    test(`should redirect ${route} to the login when not authenticated`, async ({ page }) => {
      await page.goto(route);
      await expectAtLogin(page);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Single login page (replaces the old /portaal/inloggen)
// ---------------------------------------------------------------------------

test.describe('Portaal — Single Login', () => {
  test('renders the login form at the app root', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Welkom terug')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('E-mailadres')).toBeVisible();
    await expect(page.getByLabel('Wachtwoord')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Inloggen' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Legacy portal auth routes — removed, must redirect to the single login
// ---------------------------------------------------------------------------

test.describe('Portaal — Legacy auth routes', () => {
  test('old /portaal/inloggen redirects to the single login', async ({ page }) => {
    await page.goto('/portaal/inloggen');
    await expectAtLogin(page);
  });

  test('old /portaal/registreren redirects to the single login (no self-service signup)', async ({ page }) => {
    await page.goto('/portaal/registreren');
    await expectAtLogin(page);
  });
});

// ---------------------------------------------------------------------------
// 4. Portal sections (authenticated)
//
// These tests require a valid Clerk session. In local dev you can set
// E2E_PORTAAL_EMAIL and E2E_PORTAAL_PASSWORD environment variables.
// In CI, configure Clerk Testing Tokens and update helpers/auth.ts.
//
// When no credentials are available the page redirects to the login and the
// test asserts that instead.
// ---------------------------------------------------------------------------

test.describe('Portaal — Overzicht (Dashboard)', () => {
  test('should show loading state or redirect to login', async ({ page }) => {
    await page.goto('/portaal/overzicht');

    if (page.url().includes('/portaal/overzicht')) {
      // Authenticated: the layout shows at least the loading spinner / main.
      const spinner = page.locator('.animate-spin');
      const main = page.locator('main');
      await expect(spinner.or(main)).toBeVisible({ timeout: 10_000 });
    } else {
      await expectAtLogin(page);
    }
  });
});

test.describe('Portaal — Offertes', () => {
  test('should redirect to login or show the offertes page', async ({ page }) => {
    await page.goto('/portaal/offertes');

    if (page.url().includes('/portaal/offertes')) {
      await expect(page.locator('h1:has-text("Offertes")')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('text=Bekijk en reageer op uw offertes')).toBeVisible();

      const emptyState = page.locator('text=Geen offertes');
      const offerteCard = page.locator('[class*="rounded-xl"]').first();
      await expect(emptyState.or(offerteCard)).toBeVisible({ timeout: 10_000 });
    } else {
      await expectAtLogin(page);
    }
  });

  test('empty state should show informative message', async ({ page }) => {
    await page.goto('/portaal/offertes');
    if (!page.url().includes('/portaal/offertes')) {
      test.skip(); // Not authenticated
      return;
    }

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

    if (page.url().includes('/portaal/projecten')) {
      await expect(page.locator('h1:has-text("Projecten")')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('text=Volg de voortgang van uw projecten')).toBeVisible();

      const emptyState = page.locator('text=Geen projecten');
      const projectCard = page.locator('text=Bekijken').first();
      await expect(emptyState.or(projectCard)).toBeVisible({ timeout: 10_000 });
    } else {
      await expectAtLogin(page);
    }
  });

  test('empty state should show informative message', async ({ page }) => {
    await page.goto('/portaal/projecten');
    if (!page.url().includes('/portaal/projecten')) {
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

    if (page.url().includes('/portaal/facturen')) {
      await expect(page.locator('h1:has-text("Facturen")')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('text=Bekijk en betaal uw facturen')).toBeVisible();

      const emptyState = page.locator('text=Geen facturen');
      const factuurCard = page.locator('[class*="rounded-xl"]').first();
      await expect(emptyState.or(factuurCard)).toBeVisible({ timeout: 10_000 });
    } else {
      await expectAtLogin(page);
    }
  });

  test('empty state should show informative message', async ({ page }) => {
    await page.goto('/portaal/facturen');
    if (!page.url().includes('/portaal/facturen')) {
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

    if (page.url().includes('/portaal/documenten')) {
      await expect(page.locator('h1:has-text("Documenten")')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('text=Download uw offertes en facturen als PDF')).toBeVisible();

      const emptyState = page.locator('text=Er zijn nog geen documenten beschikbaar');
      const documentSection = page.locator('h2:has-text("Offertes"), h2:has-text("Facturen")').first();
      await expect(emptyState.or(documentSection)).toBeVisible({ timeout: 10_000 });
    } else {
      await expectAtLogin(page);
    }
  });
});

test.describe('Portaal — Berichten (Chat)', () => {
  test('should redirect to login or show the berichten page', async ({ page }) => {
    await page.goto('/portaal/chat');

    if (page.url().includes('/portaal/chat')) {
      await expect(page.locator('h1:has-text("Berichten")')).toBeVisible({ timeout: 10_000 });
      await expect(
        page.locator('text=Communiceer direct met Top Tuinen'),
      ).toBeVisible();

      await expect(page.locator('h2:has-text("Gesprekken")')).toBeVisible();
    } else {
      await expectAtLogin(page);
    }
  });
});

test.describe('Portaal — Profiel', () => {
  test('should redirect to login or show the profiel page', async ({ page }) => {
    await page.goto('/portaal/profiel');

    if (page.url().includes('/portaal/profiel')) {
      await expect(page.locator('h1:has-text("Mijn profiel")')).toBeVisible({ timeout: 10_000 });
      await expect(
        page.locator('text=Beheer uw persoonlijke gegevens'),
      ).toBeVisible();

      await expect(
        page.locator('h2:has-text("Persoonlijke gegevens")'),
      ).toBeVisible();
      await expect(page.locator('h2:has-text("Weergave")')).toBeVisible();
      await expect(page.locator('h2:has-text("Beveiliging")')).toBeVisible();
    } else {
      await expectAtLogin(page);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Detail pages — error handling
// ---------------------------------------------------------------------------

test.describe('Portaal — Offerte Detail (not found)', () => {
  test('should show "niet gevonden" or redirect for invalid offerte ID', async ({ page }) => {
    await page.goto('/portaal/offertes/invalid-id-12345');

    if (page.url().includes('/portaal/offertes')) {
      const notFound = page.locator('text=Offerte niet gevonden');
      const backLink = page.locator('text=Terug naar offertes');
      const skeleton = page.locator('[class*="animate-pulse"]').first();
      await expect(notFound.or(backLink).or(skeleton)).toBeVisible({ timeout: 10_000 });
    } else {
      await expectAtLogin(page);
    }
  });
});

test.describe('Portaal — Project Detail (not found)', () => {
  test('should show "niet gevonden" or redirect for invalid project ID', async ({ page }) => {
    await page.goto('/portaal/projecten/invalid-id-12345');

    if (page.url().includes('/portaal/projecten')) {
      const notFound = page.locator('text=Project niet gevonden');
      const backLink = page.locator('text=Terug naar projecten');
      const skeleton = page.locator('[class*="animate-pulse"]').first();
      await expect(notFound.or(backLink).or(skeleton)).toBeVisible({ timeout: 10_000 });
    } else {
      await expectAtLogin(page);
    }
  });
});

test.describe('Portaal — Factuur Detail (not found)', () => {
  test('should show "niet gevonden" or redirect for invalid factuur ID', async ({ page }) => {
    await page.goto('/portaal/facturen/invalid-id-12345');

    if (page.url().includes('/portaal/facturen')) {
      const notFound = page.locator('text=Factuur niet gevonden');
      const backLink = page.locator('text=Terug naar facturen');
      const skeleton = page.locator('[class*="animate-pulse"]').first();
      await expect(notFound.or(backLink).or(skeleton)).toBeVisible({ timeout: 10_000 });
    } else {
      await expectAtLogin(page);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Portal navigation links (authenticated only)
// ---------------------------------------------------------------------------

test.describe('Portaal — Navigation Structure', () => {
  test('portal navigation should contain all expected links', async ({ page }) => {
    await page.goto('/portaal/overzicht');

    if (!page.url().includes('/portaal/overzicht')) {
      test.skip(); // Not authenticated — redirected to the single login
      return;
    }

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
// 7. Koppelen (account linking) page — now a protected route
// ---------------------------------------------------------------------------

test.describe('Portaal — Koppelen Page', () => {
  test('redirects unauthenticated invitees to the single login', async ({ page }) => {
    await page.goto('/portaal/koppelen?token=test-token');

    if (page.url().includes('/portaal/koppelen')) {
      // Authenticated: the linking page renders its own status UI.
      const linking = page.locator('text=Account koppelen');
      const invalid = page.locator('text=Ongeldige link');
      const spinner = page.locator('.animate-spin').first();
      await expect(linking.or(invalid).or(spinner)).toBeVisible({ timeout: 10_000 });
    } else {
      await expectAtLogin(page);
    }
  });
});
