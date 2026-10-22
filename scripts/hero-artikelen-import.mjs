#!/usr/bin/env node
/**
 * HERO-artikelexport (Excel, alle kolommen aan) → prijsboek, via de internal
 * mutation heroArtikelImport:importeer. Standaard een proefrun die alleen telt.
 *
 *   node scripts/hero-artikelen-import.mjs "<export.xlsx>" --org <orgId>
 *   node scripts/hero-artikelen-import.mjs "<export.xlsx>" --org <orgId> --uitvoeren
 *   … --prod   (productie; alleen na expliciete go)
 *
 * De export moet de kolommen Artikelnummer, Naam, IP, CP Standaardmarge,
 * CP VK1 en Gebruikt hebben (in HERO: Artikel → ☰ → alle kolommen aan →
 * Exporteren → Excel).
 */
import { execFileSync } from "node:child_process";
import ExcelJS from "exceljs";

const args = process.argv.slice(2);
const bestand = args.find((a) => !a.startsWith("--"));
const orgIndex = args.indexOf("--org");
const orgId = orgIndex >= 0 ? args[orgIndex + 1] : undefined;
const uitvoeren = args.includes("--uitvoeren");
const prod = args.includes("--prod");

if (!bestand || !orgId) {
  console.error('Gebruik: node scripts/hero-artikelen-import.mjs "<export.xlsx>" --org <orgId> [--uitvoeren] [--prod]');
  process.exit(1);
}

const celWaarde = (v) => {
  if (v && typeof v === "object") {
    if ("result" in v) return v.result;
    if ("text" in v) return v.text;
    if ("richText" in v) return v.richText.map((d) => d.text).join("");
  }
  return v;
};
const tekst = (v) => {
  const w = celWaarde(v);
  return w === null || w === undefined ? "" : String(w).trim();
};
const getal = (v) => {
  const w = celWaarde(v);
  if (typeof w === "number") return w;
  const n = Number.parseFloat(String(w ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const werkboek = new ExcelJS.Workbook();
await werkboek.xlsx.readFile(bestand);
const blad = werkboek.worksheets[0];
const regels = [];
blad.eachRow({ includeEmpty: false }, (rij) => regels.push(rij.values.slice(1)));

// Koppen kunnen HTML bevatten ("Gebruikt <i …>"): alleen de tekst telt
const koppen = regels[0].map((k) => tekst(k).replace(/<[^>]+>/g, "").trim());
const kolom = (naam) => {
  const i = koppen.indexOf(naam);
  if (i < 0) throw new Error(`Kolom "${naam}" ontbreekt in de export — zet in HERO alle kolommen aan`);
  return i;
};
const k = {
  nr: kolom("Artikelnummer"),
  naam: kolom("Naam"),
  besch: koppen.indexOf("Beschrijving"),
  eenheid: koppen.indexOf("Eenheid"),
  btw: koppen.indexOf("BTW"),
  ip: kolom("IP"),
  standaard: kolom("CP Standaardmarge"),
  vk1: kolom("CP VK1"),
  gebruikt: kolom("Gebruikt"),
};

const rijen = regels
  .slice(1)
  .map((r) => ({
    artikelnummer: tekst(r[k.nr]),
    naam: tekst(r[k.naam]),
    ...(k.besch >= 0 && tekst(r[k.besch]) ? { beschrijving: tekst(r[k.besch]) } : {}),
    ...(k.eenheid >= 0 && tekst(r[k.eenheid]) ? { eenheid: tekst(r[k.eenheid]) } : {}),
    ...(k.btw >= 0 && tekst(r[k.btw]) ? { btw: tekst(r[k.btw]) } : {}),
    inkoopprijs: getal(r[k.ip]),
    standaardmarge: getal(r[k.standaard]),
    vk1: getal(r[k.vk1]),
    gebruikt: getal(r[k.gebruikt]),
  }))
  .filter((r) => r.artikelnummer && r.naam);

console.log(`${rijen.length} artikelen gelezen uit ${bestand}`);

// Alles in één aanroep: de dubbele-namenregel moet alle artikelen tegelijk
// zien. ~400 KB voor 921 artikelen; past binnen ARG_MAX van macOS (1 MB).
const uitvoer = execFileSync(
  "npx",
  [
    "convex",
    "run",
    "heroArtikelImport:importeer",
    JSON.stringify({ orgId, rijen, uitvoeren }),
    ...(prod ? ["--prod"] : []),
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }
);
console.log(uitvoer);
if (!uitvoeren) console.log("Proefrun: er is niets opgeslagen. Voeg --uitvoeren toe om te importeren.");
