/**
 * Geen enkele dashboardpagina mag haar inhoud achter een animatieframe zetten.
 *
 * De regel achter deze test staat uitgeschreven in
 * `src/components/pagina-reveal.tsx`: framer-motion rekent op
 * `requestAnimationFrame`, en die staat stil in een achtergrondtab, een zware
 * tab of op een trage machine. Een `initial` met `opacity: 0` is dan geen
 * beginstaat maar een eindstaat — de pagina blijft blanco terwijl de data er
 * gewoon is. Gemeten op `/projecten` (15 aug 2026): buitenste wrapper op
 * `opacity 0.12164`, headerrij op `0`, tabel met drie rijen van 49px aanwezig.
 *
 * Deze test is grover dan een render-test en juist daarom nuttig: hij leest de
 * bron van élke pagina onder `(dashboard)` en valt over het patroon zelf, ook
 * op schermen waar nog geen render-test voor bestaat. Wie een entree wil
 * toevoegen, gebruikt `PaginaReveal` (CSS, `fill-mode: none`).
 *
 * Twee ontsnappingsluiken, allebei met een prijs:
 *
 * - De bestandenlijst hieronder is geen vrijbrief maar een opvolgpunt: elk
 *   bestand erin stond ten tijde van de sweep (15 aug 2026) bij een collega in
 *   de steigers. De lijst hoort te krimpen, nooit te groeien.
 * - Eén regel mag `blanco-beginstaat-ok:` in het commentaar erboven zetten,
 *   mét de reden erachter. Dat is bedoeld voor beweging die pas ontstaat na
 *   een gebruikershandeling (een uitklap bijvoorbeeld): staat rAF stil in een
 *   achtergrondtab, dan is er per definitie niemand die klikt.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const WORTELS = [
  join(process.cwd(), "src", "app", "(dashboard)"),
  join(process.cwd(), "src", "components"),
];

/**
 * In de steigers bij een collega tijdens een sweep. Leeg sinds de
 * componenten-sweep (15 aug 2026) — en zo hoort hij te blijven: nieuwe
 * uitzonderingen gaan via `blanco-beginstaat-ok:` op de regel zelf, mét reden.
 */
const UITGEZONDERD = new Set<string>([]);

/**
 * Patronen die de zichtbaarheid van inhoud aan een JS-animatieframe hangen.
 * `initial="hidden"` hoort erbij: dat is de variants-spelling van hetzelfde.
 */
const PATRONEN: Array<[naam: string, patroon: RegExp]> = [
  ["initial met opacity 0", /initial=\{\{\s*opacity:\s*0\b/],
  ["initial=\"hidden\"", /initial="hidden"/],
  ["initial via reducedMotion", /initial=\{(?:prefers)?[Rr]educedMotion/],
  ["variant met opacity 0", /hidden:\s*\{\s*opacity:\s*0\b/],
];

/** Hoeveel regels commentaar boven een treffer nog als toelichting tellen. */
const MARKER = "blanco-beginstaat-ok:";
const MARKER_BEREIK = 8;

function tsxBestanden(map: string): string[] {
  return readdirSync(map).flatMap((naam) => {
    const pad = join(map, naam);
    if (statSync(pad).isDirectory()) return tsxBestanden(pad);
    return pad.endsWith(".tsx") ? [pad] : [];
  });
}

describe("dashboardpagina's en componenten", () => {
  const bestanden = WORTELS.flatMap((wortel) =>
    tsxBestanden(wortel).map((pad) => ({ wortel, pad }))
  );

  it("vindt überhaupt bestanden om te controleren", () => {
    expect(bestanden.length).toBeGreaterThan(150);
  });

  it("zetten hun inhoud niet achter een animatieframe", () => {
    const gevonden: string[] = [];

    for (const { wortel, pad } of bestanden) {
      const relatief = relative(wortel, pad).split(sep).join("/");
      if (UITGEZONDERD.has(relatief)) continue;

      const regels = readFileSync(pad, "utf8").split("\n");
      regels.forEach((regel, i) => {
        // Commentaarregels beschrijven het patroon soms om ervoor te
        // waarschuwen (pagina-reveal.tsx doet precies dat) — geen treffer.
        const kaal = regel.trimStart();
        if (kaal.startsWith("*") || kaal.startsWith("//") || kaal.startsWith("/*")) {
          return;
        }
        for (const [naam, patroon] of PATRONEN) {
          if (!patroon.test(regel)) continue;
          const toelichting = regels
            .slice(Math.max(0, i - MARKER_BEREIK), i)
            .some((r) => r.includes(MARKER));
          if (!toelichting) gevonden.push(`${relatief}:${i + 1}: ${naam}`);
        }
      });
    }

    expect(gevonden).toEqual([]);
  });

  it("houdt de uitzonderingenlijst eerlijk: alleen bestanden die bestaan", () => {
    for (const relatief of UITGEZONDERD) {
      expect(
        WORTELS.some((wortel) => {
          try {
            statSync(join(wortel, relatief));
            return true;
          } catch {
            return false;
          }
        })
      ).toBe(true);
    }
  });
});
