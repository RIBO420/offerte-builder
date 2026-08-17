#!/usr/bin/env node
/**
 * Zet de AI-sleutels uit .env.local door naar de Convex-omgeving.
 *
 * De gesprekslog-analyse (gesprekAnalyse.analyseer) en de transcriptie
 * (transcriptie.transcribeer) draaien als Convex-actions en lezen hun
 * sleutels dus uit de Convex-env — niet uit .env.local. Dit script bestaat
 * zodat je de sleutels maar op één plek hoeft te plakken:
 *
 *   npm run env:sync-ai        → dev-deployment
 *   npm run env:sync-ai:prod   → productie (npx convex env set --prod)
 *
 * Alleen sleutels die in .env.local een waarde hebben gaan mee; lege regels
 * worden overgeslagen met een melding, er wordt nooit iets gewist.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const SLEUTELS = ["ANTHROPIC_API_KEY", "DEEPGRAM_API_KEY"];
const prod = process.argv.includes("--prod");

let inhoud;
try {
  inhoud = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
} catch {
  console.error("Geen .env.local gevonden — draai dit vanuit offerte-builder/.");
  process.exit(1);
}

// Simpele KEY=waarde-parser: geen quotes-gedoe nodig voor API-sleutels.
const waarden = new Map();
for (const regel of inhoud.split("\n")) {
  const m = regel.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) waarden.set(m[1], m[2].trim());
}

let gezet = 0;
for (const sleutel of SLEUTELS) {
  const waarde = waarden.get(sleutel);
  if (!waarde) {
    console.log(`· ${sleutel}: leeg in .env.local — overgeslagen`);
    continue;
  }
  const args = ["convex", "env", "set", sleutel, waarde];
  if (prod) args.push("--prod");
  const uitkomst = spawnSync("npx", args, { stdio: "inherit" });
  if (uitkomst.status !== 0) {
    console.error(`✗ ${sleutel}: convex env set faalde (zie hierboven)`);
    process.exit(uitkomst.status ?? 1);
  }
  gezet++;
}

console.log(
  gezet
    ? `Klaar: ${gezet} sleutel(s) gezet op ${prod ? "PRODUCTIE" : "de dev-deployment"}.`
    : "Niets gezet — plak eerst je sleutels in .env.local."
);
