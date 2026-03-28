import { test, expect } from '@playwright/test';

test.describe('Public Offerte Page', () => {
  test('should show error for invalid token', async ({ page }) => {
    await page.goto('/offerte/invalid-token');
    // Route is protected — should redirect to sign-in or show error
    await expect(page.locator('body')).toContainText(/sign in|inloggen|niet gevonden|verlopen|error/i);
  });
});
