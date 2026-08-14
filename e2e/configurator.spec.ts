import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Public Configurator E2E Tests
//
// The configurator lives under /(public)/configurator/ and requires NO
// authentication.  Three configurator types exist:
//   - /configurator/boomschors  — Bark/mulch ordering (3-step wizard)
//   - /configurator/gazon       — Lawn installation (4-step wizard)
//   - /configurator/verticuteren — Lawn aeration (3-step wizard)
//
// WS9 step order (keuzepunt 5): specifications (with price) come FIRST,
// customer details (NAW) come LAST — after the price indication.
//   - gazon:        specificaties → foto's → prijsindicatie → gegevens
//   - boomschors:   specificaties (live prijs) → gegevens → bevestiging
//   - verticuteren: specificaties → prijs & datum → gegevens
//
// Additional public pages:
//   - /configurator             — Index with the three service cards (WS9)
//   - /configurator/bedankt     — Thank-you page after submission
//   - /configurator/status      — Lookup request status by reference number
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared layout
// ---------------------------------------------------------------------------

test.describe('Configurator — Layout', () => {
  test('should render the configurator header with Top Tuinen branding', async ({ page }) => {
    await page.goto('/configurator/boomschors');

    // Header in the configurator layout
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('header').getByText('Top Tuinen')).toBeVisible();
    await expect(page.getByText('Online Configurator')).toBeVisible();
  });

  test('should render the footer with contact information', async ({ page }) => {
    await page.goto('/configurator/boomschors');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.getByText('Top Tuinen', { exact: true })).toBeVisible();
    await expect(footer.getByText('info@toptuinen.nl')).toBeVisible();
    await expect(footer.getByText('Bezoek onze hoofdsite')).toBeVisible();
  });

  test('should never show the internal product name to customers', async ({ page }) => {
    for (const path of ['/configurator', '/configurator/gazon']) {
      await page.goto(path);
      await expect(page.locator('body')).not.toContainText('Top Tuinen OS');
    }
  });
});

// ---------------------------------------------------------------------------
// Index page (WS9 — replaces the temporary redirect)
// ---------------------------------------------------------------------------

test.describe('Configurator — Index', () => {
  test('should show the service chooser on /configurator', async ({ page }) => {
    await page.goto('/configurator');

    await expect(
      page.getByRole('heading', { name: 'Waar kunnen we u mee helpen?' }),
    ).toBeVisible();

    // Three service cards linking to the wizards
    await expect(page.getByRole('link', { name: /Gazon aanleggen/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Boomschors bestellen/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Verticuteren/ })).toBeVisible();

    // Status lookup entry point
    await expect(page.getByRole('link', { name: /Volg uw aanvraag/ })).toBeVisible();
  });

  test('service card should navigate to the gazon wizard', async ({ page }) => {
    await page.goto('/configurator');

    await page.getByRole('link', { name: /Gazon aanleggen/ }).click();
    await expect(page).toHaveURL(/\/configurator\/gazon/);
    await expect(page.locator('h2:has-text("Gazon aanleggen")')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Boomschors Configurator (3 steps: specificaties → gegevens → bevestiging)
// ---------------------------------------------------------------------------

test.describe('Configurator — Boomschors', () => {
  test('should load the boomschors configurator page', async ({ page }) => {
    await page.goto('/configurator/boomschors');

    await expect(page.locator('h1:has-text("Boomschors bestellen")')).toBeVisible();
    await expect(
      page.getByText('Configureer uw bestelling in 3 eenvoudige stappen'),
    ).toBeVisible();
    await expect(page.getByText('Zelf bestellen')).toBeVisible();
  });

  test('should show step 1 (Specificaties) by default', async ({ page }) => {
    await page.goto('/configurator/boomschors');

    // WS9: specifications come first
    await expect(
      page.getByRole('heading', { name: 'Boomschors specificaties' }),
    ).toBeVisible();

    // Product options are immediately visible
    await expect(page.getByText('Grove boomschors')).toBeVisible();
    await expect(page.getByText('Fijne boomschors')).toBeVisible();
    await expect(page.getByText('Cacaodoppen')).toBeVisible();
    await expect(page.getByText('Houtsnippers')).toBeVisible();
  });

  test('should validate step 1 required fields before advancing', async ({ page }) => {
    await page.goto('/configurator/boomschors');

    // Try to go to next step without filling anything
    await page.getByRole('button', { name: 'Volgende' }).click();

    // Should stay on step 1 — specifications still visible
    await expect(
      page.getByRole('heading', { name: 'Boomschors specificaties' }),
    ).toBeVisible();
  });

  test('should show price banner on step 1 when oppervlakte is filled', async ({ page }) => {
    await page.goto('/configurator/boomschors');

    // WS9: the price indication is visible BEFORE any customer details
    await page.locator('#oppervlakte').fill('50');

    // 50m² at 7cm = 3.5m³ which qualifies
    await expect(page.getByText('Geschatte prijs')).toBeVisible({ timeout: 5_000 });
  });

  test('should navigate to step 2 (Uw gegevens) after filling specificaties', async ({ page }) => {
    await page.goto('/configurator/boomschors');

    await fillBoomschorsSpecificaties(page);
    await page.getByRole('button', { name: 'Volgende' }).click();

    // NAW comes only after the price indication (WS9)
    await expect(page.getByRole('heading', { name: 'Uw gegevens' })).toBeVisible();
  });

  test('should navigate back to step 1 with Vorige button', async ({ page }) => {
    await page.goto('/configurator/boomschors');
    await fillBoomschorsSpecificaties(page);
    await page.getByRole('button', { name: 'Volgende' }).click();

    // Now on step 2, click Vorige
    await page.getByRole('button', { name: 'Vorige' }).click();

    // Should be back on the specifications
    await expect(
      page.getByRole('heading', { name: 'Boomschors specificaties' }),
    ).toBeVisible();
  });

  test('should navigate to step 3 (Samenvatting) after filling step 2', async ({ page }) => {
    await page.goto('/configurator/boomschors');
    await fillBoomschorsSpecificaties(page);
    await page.getByRole('button', { name: 'Volgende' }).click();

    await fillBoomschorsKlantgegevens(page);
    await page.getByRole('button', { name: 'Volgende' }).click();

    // Should now be on step 3 — the submit button should say "Bestelling plaatsen"
    await expect(
      page.getByRole('button', { name: /Bestelling plaatsen/ }),
    ).toBeVisible();
  });

  test('should show contact info at the bottom', async ({ page }) => {
    await page.goto('/configurator/boomschors');

    // The boomschors page has footer text with phone and email
    await expect(page.getByText('020-123 4567')).toBeVisible();
    await expect(page.getByText('info@toptuinen.nl').first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Gazon Configurator (4 steps: specs → foto's → prijsindicatie → gegevens)
// ---------------------------------------------------------------------------

test.describe('Configurator — Gazon', () => {
  test('should load the gazon configurator page', async ({ page }) => {
    await page.goto('/configurator/gazon');

    await expect(page.locator('h2:has-text("Gazon aanleggen")')).toBeVisible();
    await expect(
      page.getByText('Configureer uw gazonproject en ontvang direct een indicatieprijs'),
    ).toBeVisible();
    await expect(
      page.getByText('Vrijblijvend en eenvoudig in 4 stappen'),
    ).toBeVisible();
  });

  test('should show step 1 (Gazon specificaties) by default', async ({ page }) => {
    await page.goto('/configurator/gazon');

    // WS9: specifications come first
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Gazon specificaties' }),
    ).toBeVisible();
    await expect(page.getByText('Type gras')).toBeVisible();
  });

  test('should validate step 1 required fields', async ({ page }) => {
    await page.goto('/configurator/gazon');

    // Try to advance without filling in data
    await page.getByRole('button', { name: 'Volgende stap' }).click();

    // Should stay on step 1 — specifications still visible
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Gazon specificaties' }),
    ).toBeVisible();
  });

  test('should navigate to step 2 (Foto\'s) after filling specificaties', async ({ page }) => {
    await page.goto('/configurator/gazon');

    await fillGazonSpecificaties(page);
    await page.getByRole('button', { name: 'Volgende stap' }).click();

    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Foto' }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('should show the prijsindicatie BEFORE asking for customer details', async ({ page }) => {
    await page.goto('/configurator/gazon');

    await fillGazonSpecificaties(page);
    await page.getByRole('button', { name: 'Volgende stap' }).click(); // → foto's
    await page.getByRole('button', { name: 'Volgende stap' }).click(); // → prijsindicatie

    // Price overview with total, without any NAW fields on this step (WS9)
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'prijsindicatie' }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Totaal (incl. BTW)')).toBeVisible();
    await expect(page.getByPlaceholder('Jan de Vries')).not.toBeVisible();

    // The NAW step comes only after the price
    await page.getByRole('button', { name: 'Volgende stap' }).click(); // → gegevens
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Uw gegevens' }),
    ).toBeVisible();
    await expect(page.getByText('Bijna klaar')).toBeVisible();
    await expect(page.getByPlaceholder('Echt')).toBeVisible();
  });

  test('should navigate back with Vorige stap button', async ({ page }) => {
    await page.goto('/configurator/gazon');
    await fillGazonSpecificaties(page);
    await page.getByRole('button', { name: 'Volgende stap' }).click();

    // Go back
    await page.getByRole('button', { name: 'Vorige stap' }).click();

    // Should be back on step 1 (specificaties)
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Gazon specificaties' }),
    ).toBeVisible();
  });

  test('Vorige stap button should be disabled on step 1', async ({ page }) => {
    await page.goto('/configurator/gazon');

    const vorigeButton = page.getByRole('button', { name: 'Vorige stap' });
    await expect(vorigeButton).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Verticuteren Configurator (3 steps: specs → prijs & datum → gegevens)
// ---------------------------------------------------------------------------

test.describe('Configurator — Verticuteren', () => {
  test('should load the verticuteren configurator page', async ({ page }) => {
    await page.goto('/configurator/verticuteren');

    await expect(page.locator('h2:has-text("Verticuteren")')).toBeVisible();
    await expect(
      page.getByText('Configureer uw verticuteeropdracht'),
    ).toBeVisible();
    await expect(
      page.getByText('ontvang direct een indicatieprijs'),
    ).toBeVisible();
  });

  test('should show step 1 (Specificaties) by default', async ({ page }) => {
    await page.goto('/configurator/verticuteren');

    // WS9: specifications come first
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Verticuteren specificaties' }),
    ).toBeVisible();
  });

  test('should validate step 1 required fields', async ({ page }) => {
    await page.goto('/configurator/verticuteren');

    await page.getByRole('button', { name: 'Volgende stap' }).click();

    // Should stay on step 1
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Verticuteren specificaties' }),
    ).toBeVisible();
  });

  test('should show prijsindicatie on step 2, before customer details', async ({ page }) => {
    await page.goto('/configurator/verticuteren');

    await fillVerticuterenSpecificaties(page);
    await page.getByRole('button', { name: 'Volgende stap' }).click();

    // Step 2 shows the price indication & date — no NAW fields yet (WS9)
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'prijsindicatie' }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Totaal (incl. BTW)')).toBeVisible();
    await expect(page.getByPlaceholder('Jan de Vries')).not.toBeVisible();
  });

  test('should navigate back with Vorige stap button', async ({ page }) => {
    await page.goto('/configurator/verticuteren');
    await fillVerticuterenSpecificaties(page);
    await page.getByRole('button', { name: 'Volgende stap' }).click();

    await page.getByRole('button', { name: 'Vorige stap' }).click();

    // Should be on step 1 (specificaties) again
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Verticuteren specificaties' }),
    ).toBeVisible();
  });

  test('Vorige stap button should be disabled on step 1', async ({ page }) => {
    await page.goto('/configurator/verticuteren');

    const vorigeButton = page.getByRole('button', { name: 'Vorige stap' });
    await expect(vorigeButton).toBeDisabled();
  });

  test('should show privacy/data notice on step 1', async ({ page }) => {
    await page.goto('/configurator/verticuteren');

    await expect(
      page.getByText('Uw gegevens worden veilig opgeslagen'),
    ).toBeVisible();
  });

  test('should show error message area for submission errors', async ({ page }) => {
    await page.goto('/configurator/verticuteren');

    // The error container is hidden by default — it only appears on submit failure
    // Verify the page does NOT show an error initially
    const errorBanner = page.getByText('Er is een fout opgetreden bij het indienen');
    await expect(errorBanner).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Bedankt (Thank You) Page
// ---------------------------------------------------------------------------

test.describe('Configurator — Bedankt Page', () => {
  test('should show generic thank-you page without referentie param', async ({ page }) => {
    await page.goto('/configurator/bedankt');

    await expect(page.getByText('Bedankt!')).toBeVisible();
    await expect(
      page.getByText('Wij hebben uw aanvraag ontvangen'),
    ).toBeVisible();

    // Should show the "next steps" timeline
    await expect(page.getByText('Wat er nu gaat gebeuren')).toBeVisible();
    await expect(page.getByText('Wij beoordelen uw aanvraag')).toBeVisible();
    await expect(page.getByText('Bevestiging per e-mail')).toBeVisible();
    await expect(page.getByText('Inplannen van de werkzaamheden')).toBeVisible();

    // Should show the "back to main site" link
    await expect(page.getByText('Terug naar Top Tuinen')).toBeVisible();
  });

  test('should show referentie-specific page with ref param', async ({ page }) => {
    await page.goto('/configurator/bedankt?ref=CFG-20260101-1234');

    await expect(page.getByText('Bedankt voor uw aanvraag')).toBeVisible();

    // Should show the reference number
    await expect(page.getByText('CFG-20260101-1234')).toBeVisible();
    await expect(page.getByText('Uw referentienummer')).toBeVisible();

    // Should show "Bewaar dit nummer" instruction
    await expect(
      page.getByText('Bewaar dit nummer'),
    ).toBeVisible();

    // Should show "Volg uw aanvraag" button
    await expect(page.getByText('Volg uw aanvraag')).toBeVisible();

    // Should show "next steps" timeline
    await expect(page.getByText('Wat er nu gaat gebeuren')).toBeVisible();
  });

  test('should handle betaald=true parameter', async ({ page }) => {
    await page.goto('/configurator/bedankt?ref=CFG-20260101-5678&betaald=true');

    await expect(page.getByText('Bedankt voor uw aanvraag')).toBeVisible();
    await expect(page.getByText('Uw aanbetaling is ontvangen')).toBeVisible();
  });

  test('should also accept referentie param (alias for ref)', async ({ page }) => {
    await page.goto('/configurator/bedankt?referentie=CFG-20260101-9999');

    await expect(page.getByText('CFG-20260101-9999')).toBeVisible();
    await expect(page.getByText('Uw referentienummer')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Status Lookup Page
// ---------------------------------------------------------------------------

test.describe('Configurator — Status Page', () => {
  test('should load the status lookup page', async ({ page }) => {
    await page.goto('/configurator/status');

    await expect(
      page.locator('h2:has-text("Aanvraagstatus opzoeken")'),
    ).toBeVisible();
    await expect(
      page.getByText('Voer uw referentienummer in'),
    ).toBeVisible();
  });

  test('should show the search input with placeholder', async ({ page }) => {
    await page.goto('/configurator/status');

    const searchInput = page.getByPlaceholder(/referentienummer/);
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute(
      'placeholder',
      /CFG-/,
    );
  });

  test('should show the search button', async ({ page }) => {
    await page.goto('/configurator/status');

    const zoekButton = page.getByRole('button', { name: 'Zoeken' });
    await expect(zoekButton).toBeVisible();
  });

  test('should show helper text when no search has been performed', async ({ page }) => {
    await page.goto('/configurator/status');

    await expect(
      page.getByText('Uw referentienummer vindt u in de bevestigingsmail'),
    ).toBeVisible();
    await expect(
      page.getByText('Heeft u geen referentienummer'),
    ).toBeVisible();
  });

  test('should validate empty search input', async ({ page }) => {
    await page.goto('/configurator/status');

    // Clear the input and click search
    const searchInput = page.getByPlaceholder(/referentienummer/);
    await searchInput.fill('');

    const zoekButton = page.getByRole('button', { name: 'Zoeken' });
    await zoekButton.click();

    // Should show a validation error
    await expect(
      page.getByText('Voer een referentienummer in'),
    ).toBeVisible();
  });

  test('should validate invalid reference number format', async ({ page }) => {
    await page.goto('/configurator/status');

    const searchInput = page.getByPlaceholder(/referentienummer/);
    await searchInput.fill('INVALID-123');

    const zoekButton = page.getByRole('button', { name: 'Zoeken' });
    await zoekButton.click();

    // Should show format validation error
    await expect(
      page.getByText('Referentienummer moet beginnen met "CFG-"'),
    ).toBeVisible();
  });

  test('should accept valid CFG format and trigger search', async ({ page }) => {
    await page.goto('/configurator/status');

    const searchInput = page.getByPlaceholder(/referentienummer/);
    await searchInput.fill('CFG-20260101-0001');

    const zoekButton = page.getByRole('button', { name: 'Zoeken' });
    await zoekButton.click();

    // After clicking search, the validation error should NOT be visible
    const validationError = page.getByText('Referentienummer moet beginnen met');
    await expect(validationError).not.toBeVisible();

    // Should show either loading state (animate-pulse skeleton), results,
    // or "niet gevonden" — check each independently to avoid strict mode issues
    await expect(async () => {
      const pulseVisible = await page.locator('.animate-pulse').first().isVisible().catch(() => false);
      const nietGevondenVisible = await page.locator('[data-slot="card-title"]:has-text("Geen aanvraag gevonden")').isVisible().catch(() => false);
      const referentieVisible = await page.locator('.font-mono:has-text("CFG-")').isVisible().catch(() => false);
      expect(pulseVisible || nietGevondenVisible || referentieVisible).toBeTruthy();
    }).toPass({ timeout: 10_000 });
  });

  test('should show "Geen aanvraag gevonden" for non-existent reference', async ({ page }) => {
    await page.goto('/configurator/status');

    const searchInput = page.getByPlaceholder(/referentienummer/);
    await searchInput.fill('CFG-99990101-9999');

    const zoekButton = page.getByRole('button', { name: 'Zoeken' });
    await zoekButton.click();

    // Wait for Convex to return null (aanvraag not found)
    // CardTitle renders as a <div data-slot="card-title">, not a heading role
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Geen aanvraag gevonden' }),
    ).toBeVisible({ timeout: 15_000 });

    // Should show help text
    await expect(page.getByText('Neem contact met ons op')).toBeVisible();
  });

  test('should support Enter key to trigger search', async ({ page }) => {
    await page.goto('/configurator/status');

    const searchInput = page.getByPlaceholder(/referentienummer/);
    await searchInput.fill('CFG-20260101-0001');
    await searchInput.press('Enter');

    // Should trigger search (validation passes)
    const validationError = page.getByText('Referentienummer moet beginnen met');
    await expect(validationError).not.toBeVisible();
  });

  test('should pre-fill search from ref query parameter', async ({ page }) => {
    await page.goto('/configurator/status?ref=CFG-20260315-4567');

    // The input should be pre-filled with the ref value
    const searchInput = page.getByPlaceholder(/referentienummer/);
    await expect(searchInput).toHaveValue('CFG-20260315-4567');

    // Should automatically trigger a search — show loading, result, or not-found
    await expect(async () => {
      const pulseVisible = await page.locator('.animate-pulse').first().isVisible().catch(() => false);
      const nietGevondenVisible = await page.locator('[data-slot="card-title"]:has-text("Geen aanvraag gevonden")').isVisible().catch(() => false);
      const referentieVisible = await page.locator('.font-mono:has-text("CFG-")').isVisible().catch(() => false);
      expect(pulseVisible || nietGevondenVisible || referentieVisible).toBeTruthy();
    }).toPass({ timeout: 10_000 });
  });

  test('should clear validation error when user types', async ({ page }) => {
    await page.goto('/configurator/status');

    // Trigger validation error first
    const searchInput = page.getByPlaceholder(/referentienummer/);
    await searchInput.fill('');
    await page.getByRole('button', { name: 'Zoeken' }).click();
    await expect(page.getByText('Voer een referentienummer in')).toBeVisible();

    // Start typing — error should disappear
    await searchInput.fill('C');
    await expect(page.getByText('Voer een referentienummer in')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Cross-configurator tests
// ---------------------------------------------------------------------------

test.describe('Configurator — Cross-cutting', () => {
  test('all configurator pages should be publicly accessible (no auth required)', async ({ page }) => {
    // Index (WS9)
    const indexResponse = await page.goto('/configurator');
    expect(indexResponse?.status()).toBeLessThan(400);
    expect(page.url()).toContain('/configurator');

    // Boomschors
    const boomschorsResponse = await page.goto('/configurator/boomschors');
    expect(boomschorsResponse?.status()).toBeLessThan(400);
    expect(page.url()).toContain('/configurator/boomschors');

    // Gazon
    const gazonResponse = await page.goto('/configurator/gazon');
    expect(gazonResponse?.status()).toBeLessThan(400);
    expect(page.url()).toContain('/configurator/gazon');

    // Verticuteren
    const verticuterenResponse = await page.goto('/configurator/verticuteren');
    expect(verticuterenResponse?.status()).toBeLessThan(400);
    expect(page.url()).toContain('/configurator/verticuteren');

    // Bedankt
    const bedanktResponse = await page.goto('/configurator/bedankt');
    expect(bedanktResponse?.status()).toBeLessThan(400);
    expect(page.url()).toContain('/configurator/bedankt');

    // Status
    const statusResponse = await page.goto('/configurator/status');
    expect(statusResponse?.status()).toBeLessThan(400);
    expect(page.url()).toContain('/configurator/status');
  });

  test('all configurators should NOT redirect to sign-in', async ({ page }) => {
    const paths = [
      '/configurator',
      '/configurator/boomschors',
      '/configurator/gazon',
      '/configurator/verticuteren',
      '/configurator/bedankt',
      '/configurator/status',
    ];

    for (const path of paths) {
      await page.goto(path);
      const url = page.url();
      expect(url).not.toContain('sign-in');
      expect(url).not.toContain('inloggen');
    }
  });
});

// ---------------------------------------------------------------------------
// Helper functions for filling form steps (WS9 step order)
// ---------------------------------------------------------------------------

/**
 * Fill in step 1 (Specificaties) for the boomschors configurator.
 * Selects "ophalen" to skip bezorgPostcode validation.
 */
async function fillBoomschorsSpecificaties(page: import('@playwright/test').Page) {
  // Fill in oppervlakte (surface area in m²)
  await page.locator('#oppervlakte').fill('50');

  // Switch bezorging to "ophalen" to skip bezorgPostcode validation
  // (the default is "bezorgen" which requires a postcode)
  await page.locator('label[for="bezorging-ophalen"]').click();

  // The product type (soort) and layer thickness (laagDikte) have defaults,
  // so we don't need to change them unless testing specific scenarios.
}

/**
 * Fill in step 2 (Uw gegevens) for the boomschors configurator.
 * Uses input IDs defined in Stap1Klantgegevens component.
 */
async function fillBoomschorsKlantgegevens(page: import('@playwright/test').Page) {
  await page.locator('#naam').fill('Test Klant');
  await page.locator('#email').fill('test@example.com');
  await page.locator('#telefoon').fill('0612345678');
  await page.locator('#adres').fill('Teststraat 1');
  await page.locator('#postcode').fill('1234 AB');
  await page.locator('#plaats').fill('Echt');
}

/**
 * Fill in step 1 (Gazon specificaties) for the gazon configurator.
 * Oppervlakte + type gras + ondergrond + poortbreedte (moved here in WS9).
 */
async function fillGazonSpecificaties(page: import('@playwright/test').Page) {
  await page.getByPlaceholder('50').fill('100');
  await page.getByRole('button', { name: /Graszoden/ }).click();
  await page.getByRole('button', { name: /Kale grond/ }).click();
  await page.getByPlaceholder('120').fill('100');
}

/**
 * Fill in step 1 (Verticuteren specificaties) for the verticuteren
 * configurator. Oppervlakte + conditie + poortbreedte (moved here in WS9).
 */
async function fillVerticuterenSpecificaties(page: import('@playwright/test').Page) {
  await page.getByPlaceholder('75').fill('100');
  await page.getByRole('button', { name: /Uitstekend/ }).click();
  await page.getByPlaceholder('120').fill('100');
}
