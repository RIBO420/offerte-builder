import { test, expect } from '@playwright/test';

test.describe('Public Offerte Page', () => {
  test('should show error for invalid token', async ({ page }) => {
    await page.goto('/offerte/invalid-token');
    // Should show some error or not found message
    await expect(page.locator('body')).toContainText(/niet gevonden|verlopen|error/i);
  });
});
