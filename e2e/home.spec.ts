import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should show sign-in when not authenticated', async ({ page }) => {
    await page.goto('/');
    // Should show sign-in form (rendered inline or via redirect)
    await expect(page.getByLabel('E-mailadres').or(page.getByText('Inloggen'))).toBeVisible({ timeout: 10_000 });
  });

  test('sign-in page should load', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.locator('text=Inloggen')).toBeVisible();
  });
});
