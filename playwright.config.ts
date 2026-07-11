import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local so E2E tests can read Clerk credentials
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  testDir: './e2e',
  // De fase-rooktests zijn omgevingsspecifieke smoke-tests (dev-data,
  // e2e-account met directie-rol) en draaien via playwright.fase1.config.ts —
  // niet in de generieke CI-run.
  testIgnore: /fase[0-2].*rooktest\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
