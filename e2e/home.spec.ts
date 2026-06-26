import { test, expect } from '@playwright/test';

// The app has a single login terminal at the root "/". There is no separate
// /sign-in or /sign-up route anymore — both redirect to "/". Accounts are
// created internally (Clerk), so self-service sign-up is disabled.

test.describe('Home Page — single login', () => {
  test('root shows the login form when not authenticated', async ({ page }) => {
    await page.goto('/');

    await expect(page).not.toHaveURL(/sign-in|sign-up/);
    await expect(page.getByText('Welkom terug')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('E-mailadres')).toBeVisible();
    await expect(page.getByLabel('Wachtwoord')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Inloggen' })).toBeVisible();
  });

  test('legacy /sign-in redirects to the single login at "/"', async ({ page }) => {
    await page.goto('/sign-in');

    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.getByLabel('E-mailadres')).toBeVisible({ timeout: 10_000 });
  });

  test('legacy /sign-up redirects to the single login at "/"', async ({ page }) => {
    await page.goto('/sign-up');

    await expect(page).not.toHaveURL(/sign-up/);
    await expect(page.getByLabel('E-mailadres')).toBeVisible({ timeout: 10_000 });
  });
});
