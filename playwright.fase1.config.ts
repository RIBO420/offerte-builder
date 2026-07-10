// Tijdelijke config voor de fase 1-rooktest (offerte-blok): poort 3000 is op
// deze machine bezet door een ander project, dus de dev-server draait op 3100
// (zelfde patroon als playwright.fase0.config.ts).
//
// Next 16 heeft een dev-lock (.next/dev/lock): er kan maar één `next dev` per
// project draaien. Draait er al een dev-server (bv. via de preview-tooling op
// een andere poort), zet dan FASE1_BASE_URL naar die server — de webServer-stap
// wordt dan overgeslagen in plaats van vast te lopen op de lock.
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const externeServer = process.env.FASE1_BASE_URL;

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  testMatch: /(fase1-(offerte|modules)|fase2)-rooktest\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: externeServer ?? "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(externeServer
    ? {}
    : {
        webServer: {
          command: "npm run dev -- --port 3100",
          url: "http://localhost:3100",
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
