import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should redirect to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/');
    // Should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/);
  });

  test('sign-in page should load', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.locator('text=Inloggen')).toBeVisible();
  });
});
