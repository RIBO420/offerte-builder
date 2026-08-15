/**
 * De werkvlakken van de dagstaat zijn een ontwerpbesluit met gemeten grenzen,
 * geen smaakje: `--surface-primair` (loofgroen, eigen werk) en
 * `--surface-aandacht` (leem/amber, wat je aandacht vraagt) moeten van de
 * pagina afstappen zónder de tekst erop onder AA te duwen. De vorige tint was
 * bijna kleurloos (chroma 0,011) en las als vuil; wie hem terugdraait naar
 * "iets neutraler" moet dat hier zien gebeuren.
 *
 * Even hard bewaakt: de rand van het afvinkhokje. `border-input` haalde
 * gemeten 1,03:1 op het nieuwe vlak — het hokje was onzichtbaar. WCAG 1.4.11
 * vraagt 3:1 voor niet-tekstuele bedieningselementen.
 *
 * De rekensom staat hier expres helemaal uitgeschreven: geen kleurbibliotheek
 * in de dependencies, en een testwaarde die je zelf kunt narekenen is meer
 * waard dan een die uit een black box komt.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── OKLCH → sRGB → WCAG ────────────────────────────────────────────────────
type Rgb = [number, number, number];

function oklchNaarSrgb(L: number, C: number, hoek: number): Rgb {
  const h = (hoek * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lineair: Rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lineair.map((x) => {
    const c =
      x <= 0.0031308
        ? 12.92 * x
        : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, c));
  }) as Rgb;
}

function luminantie([r, g, b]: Rgb): number {
  const f = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(een: Rgb, twee: Rgb): number {
  const a = luminantie(een);
  const b = luminantie(twee);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Kleur met dekking `alpha` over een ondergrond leggen. */
function over(voorgrond: Rgb, alpha: number, achtergrond: Rgb): Rgb {
  return voorgrond.map(
    (v, i) => v * alpha + achtergrond[i] * (1 - alpha)
  ) as Rgb;
}

// ── Tokens uit globals.css lezen ───────────────────────────────────────────
const CSS = readFileSync(
  resolve(process.cwd(), "src/app/globals.css"),
  "utf8"
);

/**
 * `:root` en `.dark` uitsnijden. Niet zomaar de eerste treffer pakken: verderop
 * staan `.portal`-blokken die dezelfde tokennamen opnieuw zetten.
 */
function blok(start: string, eind: string): string {
  const van = CSS.indexOf(start);
  const tot = CSS.indexOf(eind, van);
  expect(van, `blok ${start} niet gevonden in globals.css`).toBeGreaterThan(-1);
  return CSS.slice(van, tot);
}

const BLOKKEN = {
  licht: blok("\n:root {", "\n.dark {"),
  donker: blok("\n.dark {", "\n@layer base"),
};

function token(thema: keyof typeof BLOKKEN, naam: string): Rgb {
  const treffer = BLOKKEN[thema].match(
    new RegExp(`--${naam}:\\s*oklch\\(([^)]+)\\)`)
  );
  expect(treffer, `--${naam} niet als oklch() gevonden in ${thema}`).not.toBeNull();
  const [L, C, H] = treffer![1].trim().split(/\s+/).map(Number);
  return oklchNaarSrgb(L, C, H);
}

const AA_TEKST = 4.5;
/** WCAG 1.4.11: niet-tekstuele bedieningselementen en hun randen. */
const AA_NIET_TEKST = 3;

describe.each(["licht", "donker"] as const)(
  "werkvlakken (%s)",
  (thema) => {
    const achtergrond = token(thema, "background");
    const kaart = token(thema, "card");
    const vlakken = {
      "surface-primair": token(thema, "surface-primair"),
      "surface-aandacht": token(thema, "surface-aandacht"),
    };

    it.each(Object.entries(vlakken))(
      "%s stapt zichtbaar van de pagina af",
      (_naam, vlak) => {
        // De vlakstap draagt de hiërarchie. `--card` haalt hier maar ~1,05:1;
        // een werkvlak dat daaronder zakt kan geen werkstrook meer markeren.
        expect(contrast(achtergrond, vlak)).toBeGreaterThanOrEqual(1.15);
        expect(contrast(kaart, vlak)).toBeGreaterThanOrEqual(1.13);
      }
    );

    it.each(Object.entries(vlakken))(
      "%s houdt alle teksttokens boven AA",
      (_naam, vlak) => {
        for (const tekst of [
          "foreground",
          "muted-foreground",
          "primary",
          // "3 dagen te laat" in een takenregel. Bewust niet `--destructive`:
          // dat token meet hier 4,2:1 en is dus alleen goed genoeg als stip,
          // niet als tekst van 11px.
          "status-vervallen-text",
        ]) {
          expect(
            contrast(token(thema, tekst), vlak),
            `${tekst} op dit vlak`
          ).toBeGreaterThanOrEqual(AA_TEKST);
        }

        // `--destructive` draagt hier alleen nog de prioriteitsstip: geen
        // tekst, dus 3:1 volstaat (WCAG 1.4.11).
        expect(
          contrast(token(thema, "destructive"), vlak)
        ).toBeGreaterThanOrEqual(AA_NIET_TEKST);
      }
    );

    it.each(Object.entries(vlakken))(
      "%s laat het afvinkhokje zien (rand ≥ 3:1)",
      (_naam, vlak) => {
        const merkgroen = token(thema, "primary");
        // TaakCheckbox tekent zijn rand als `border-primary/75`.
        expect(
          contrast(over(merkgroen, 0.75, vlak), vlak)
        ).toBeGreaterThanOrEqual(AA_NIET_TEKST);
        // En het aangevinkte vlak zelf blijft ruim zichtbaar.
        expect(contrast(merkgroen, vlak)).toBeGreaterThanOrEqual(
          AA_NIET_TEKST
        );

        // Ter vergelijking het probleem dat dit oploste: de standaardrand van
        // <Checkbox> verdwijnt volledig in het vlak.
        expect(contrast(token(thema, "input"), vlak)).toBeLessThan(1.4);
      }
    );

    it("houdt de twee vlakken uit elkaar én laat de hover-overlay staan", () => {
      // Amber en groen moeten als twee soorten werk lezen, niet als één tint
      // met ruis. Gelijke lichtheid, dus het onderscheid zit in de kleur —
      // daarom hier een minimumafstand in chroma/hue, niet in contrast.
      const [p, a] = [vlakken["surface-primair"], vlakken["surface-aandacht"]];
      const afstand = Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]);
      expect(afstand).toBeGreaterThan(0.08);

      // `--muted` ligt er als hover-overlay overheen; te licht en die feedback
      // verdwijnt. In donker is de stap van nature klein, daar volstaat "niet
      // exact gelijk".
      const drempel = thema === "licht" ? 1.03 : 1.005;
      for (const vlak of Object.values(vlakken)) {
        expect(
          contrast(over(token(thema, "muted"), 0.4, vlak), vlak)
        ).toBeGreaterThan(drempel);
      }
    });
  }
);
