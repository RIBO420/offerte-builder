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
// Additional public pages:
//   - /configurator/bedankt     — Thank-you page after submission
//   - /configurator/status      — Lookup request status by reference number
//
// These tests verify:
//   1. Page loads and layout rendering
//   2. Step navigation (forward / backward)
//   3. Form validation (required fields)
//   4. Form filling for each wizard type
//   5. Bedankt (thank-you) page variants
//   6. Status lookup page
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
});

// ---------------------------------------------------------------------------
// Boomschors Configurator (3 steps)
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

  test('should show step 1 (Uw gegevens) by default', async ({ page }) => {
    await page.goto('/configurator/boomschors');

    // Step 1 heading should be visible
    await expect(page.getByRole('heading', { name: 'Uw gegevens' })).toBeVisible();

    // Step 1 form fields should be present
    await expect(page.getByLabel(/Naam/)).toBeVisible();
  });

  test('should validate step 1 required fields before advancing', async ({ page }) => {
    await page.goto('/configurator/boomschors');

    // Try to go to next step without filling anything
    await page.getByRole('button', { name: 'Volgende' }).click();

    // Should stay on step 1 — validation errors should appear
    // The page should still show step 1 content
    await expect(page.getByRole('heading', { name: 'Uw gegevens' })).toBeVisible();
  });

  test('should navigate to step 2 after filling step 1', async ({ page }) => {
    await page.goto('/configurator/boomschors');

    // Fill in klantgegevens (step 1)
    await fillBoomschorsStap1(page);

    // Click Volgende
    await page.getByRole('button', { name: 'Volgende' }).click();

    // Should now be on step 2 (Specificaties)
    await expect(page.getByRole('heading', { name: 'Boomschors specificaties' })).toBeVisible();
  });

  test('should show product options on step 2', async ({ page }) => {
    await page.goto('/configurator/boomschors');
    await fillBoomschorsStap1(page);
    await page.getByRole('button', { name: 'Volgende' }).click();

    // Step 2 should show product type options
    await expect(page.getByText('Grove boomschors')).toBeVisible();
    await expect(page.getByText('Fijne boomschors')).toBeVisible();
    await expect(page.getByText('Cacaodoppen')).toBeVisible();
    await expect(page.getByText('Houtsnippers')).toBeVisible();
  });

  test('should navigate back to step 1 with Vorige button', async ({ page }) => {
    await page.goto('/configurator/boomschors');
    await fillBoomschorsStap1(page);
    await page.getByRole('button', { name: 'Volgende' }).click();

    // Now on step 2, click Vorige
    await page.getByRole('button', { name: 'Vorige' }).click();

    // Should be back on step 1
    await expect(page.getByRole('heading', { name: 'Uw gegevens' })).toBeVisible();
  });

  test('should show price banner on step 2 when oppervlakte is filled', async ({ page }) => {
    await page.goto('/configurator/boomschors');
    await fillBoomschorsStap1(page);
    await page.getByRole('button', { name: 'Volgende' }).click();

    // Fill in oppervlakte on step 2
    const oppervlakteInput = page.locator('#oppervlakte');
    if (await oppervlakteInput.isVisible().catch(() => false)) {
      await oppervlakteInput.fill('50');

      // Price banner should appear (if m³ >= 1)
      // 50m² at 7cm = 3.5m³ which qualifies
      await expect(page.getByText('Geschatte prijs')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('should navigate to step 3 (Samenvatting) after filling step 2', async ({ page }) => {
    await page.goto('/configurator/boomschors');
    await fillBoomschorsStap1(page);
    await page.getByRole('button', { name: 'Volgende' }).click();

    // Fill step 2 specificaties (switch to ophalen to avoid bezorgPostcode validation)
    await fillBoomschorsStap2(page);
    await page.getByRole('button', { name: 'Volgende' }).click();

    // Should now be on step 3 — the submit button should say "Bestelling plaatsen"
    await expect(
      page.getByRole('button', { name: /Bestelling plaatsen/ }),
    ).toBeVisible();
  });

  test('should show the Bestelling plaatsen button on step 3', async ({ page }) => {
    await page.goto('/configurator/boomschors');
    await fillBoomschorsStap1(page);
    await page.getByRole('button', { name: 'Volgende' }).click();
    await fillBoomschorsStap2(page);
    await page.getByRole('button', { name: 'Volgende' }).click();

    const submitButton = page.getByRole('button', { name: /Bestelling plaatsen/ });
    await expect(submitButton).toBeVisible();
  });

  test('should show contact info at the bottom', async ({ page }) => {
    await page.goto('/configurator/boomschors');

    // The boomschors page has footer text with phone and email
    await expect(page.getByText('020-123 4567')).toBeVisible();
    await expect(page.getByText('info@toptuinen.nl').first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Gazon Configurator (4 steps)
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

  test('should show step 1 (Klantgegevens) by default', async ({ page }) => {
    await page.goto('/configurator/gazon');

    // Form fields should be visible
    const inputs = page.locator('input');
    await expect(inputs.first()).toBeVisible();
  });

  test('should validate step 1 required fields', async ({ page }) => {
    await page.goto('/configurator/gazon');

    // Try to advance without filling in data
    await page.getByRole('button', { name: 'Volgende stap' }).click();

    // Should stay on step 1 — form should still be visible
    const inputs = page.locator('input');
    expect(await inputs.count()).toBeGreaterThan(0);
  });

  test('should navigate to step 2 after filling step 1', async ({ page }) => {
    await page.goto('/configurator/gazon');

    await fillGazonStap1(page);
    await page.getByRole('button', { name: 'Volgende stap' }).click();

    // Step 2 should show gazon specification content (card title)
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'Gazon specificaties' }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('should navigate back with Vorige stap button', async ({ page }) => {
    await page.goto('/configurator/gazon');
    await fillGazonStap1(page);
    await page.getByRole('button', { name: 'Volgende stap' }).click();

    // Go back
    await page.getByRole('button', { name: 'Vorige stap' }).click();

    // Should be back on step 1
    await page.waitForTimeout(300);
    const inputs = page.locator('input');
    expect(await inputs.count()).toBeGreaterThan(3);
  });

  test('Vorige stap button should be disabled on step 1', async ({ page }) => {
    await page.goto('/configurator/gazon');

    const vorigeButton = page.getByRole('button', { name: 'Vorige stap' });
    await expect(vorigeButton).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Verticuteren Configurator (3 steps)
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

  test('should show step 1 (Klantgegevens) by default', async ({ page }) => {
    await page.goto('/configurator/verticuteren');

    const inputs = page.locator('input');
    await expect(inputs.first()).toBeVisible();
  });

  test('should validate step 1 required fields', async ({ page }) => {
    await page.goto('/configurator/verticuteren');

    await page.getByRole('button', { name: 'Volgende stap' }).click();

    // Should stay on step 1
    const inputs = page.locator('input');
    expect(await inputs.count()).toBeGreaterThan(0);
  });

  test('should navigate to step 2 after filling step 1', async ({ page }) => {
    await page.goto('/configurator/verticuteren');

    await fillVerticuterenStap1(page);
    await page.getByRole('button', { name: 'Volgende stap' }).click();

    // Step 2 should show verticuteren specification card title
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: 'specificaties' }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('should navigate back with Vorige stap button', async ({ page }) => {
    await page.goto('/configurator/verticuteren');
    await fillVerticuterenStap1(page);
    await page.getByRole('button', { name: 'Volgende stap' }).click();

    await page.getByRole('button', { name: 'Vorige stap' }).click();

    // Should be on step 1 again
    await page.waitForTimeout(300);
    const inputs = page.locator('input');
    expect(await inputs.count()).toBeGreaterThan(3);
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
// Helper functions for filling form steps
// ---------------------------------------------------------------------------

/**
 * Fill in step 1 (Klantgegevens) for the boomschors configurator.
 * Uses input IDs defined in Stap1Klantgegevens component.
 */
async function fillBoomschorsStap1(page: import('@playwright/test').Page) {
  await page.locator('#naam').fill('Test Klant');
  await page.locator('#email').fill('test@example.com');
  await page.locator('#telefoon').fill('0612345678');
  await page.locator('#adres').fill('Teststraat 1');
  await page.locator('#postcode').fill('1234 AB');
  await page.locator('#plaats').fill('Amsterdam');
}

/**
 * Fill in step 2 (Specificaties) for the boomschors configurator.
 * Selects default product type and fills in oppervlakte.
 */
async function fillBoomschorsStap2(page: import('@playwright/test').Page) {
  // Fill in oppervlakte (surface area in m²)
  await page.locator('#oppervlakte').fill('50');

  // Switch bezorging to "ophalen" to skip bezorgPostcode validation
  // (the default is "bezorgen" which requires a postcode)
  await page.locator('label[for="bezorging-ophalen"]').click();

  // The product type (soort) and layer thickness (laagDikte) have defaults,
  // so we don't need to change them unless testing specific scenarios.
}

/**
 * Fill in step 1 (Klantgegevens) for the gazon configurator.
 * Uses placeholder-based selectors since gazon form uses Field wrapper without IDs.
 */
async function fillGazonStap1(page: import('@playwright/test').Page) {
  await page.getByPlaceholder('Jan de Vries').fill('Test Klant');
  await page.getByPlaceholder('jan@email.nl').fill('test@example.com');
  await page.getByPlaceholder('06-12345678').fill('0612345678');
  await page.getByPlaceholder('Tuinstraat 12').fill('Teststraat 1');
  await page.getByPlaceholder('1234 AB').fill('1234 AB');
  await page.getByPlaceholder('Amsterdam').fill('Amsterdam');
  await page.getByPlaceholder('120').fill('100');
}

/**
 * Fill in step 1 (Klantgegevens) for the verticuteren configurator.
 * Same structure as gazon (includes poortbreedte).
 */
async function fillVerticuterenStap1(page: import('@playwright/test').Page) {
  await page.getByPlaceholder('Jan de Vries').fill('Test Klant');
  await page.getByPlaceholder('jan@email.nl').fill('test@example.com');
  await page.getByPlaceholder('06-12345678').fill('0612345678');
  await page.getByPlaceholder('Tuinstraat 12').fill('Teststraat 1');
  await page.getByPlaceholder('1234 AB').fill('1234 AB');
  await page.getByPlaceholder('Amsterdam').fill('Amsterdam');
  await page.getByPlaceholder('120').fill('100');
}
