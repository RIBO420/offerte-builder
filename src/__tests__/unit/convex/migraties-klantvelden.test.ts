/**
 * De twee eenmalige migraties op de klantvelden (klantfeedback Mickey, sep 2026):
 *
 * 1. `convex/migrations/splitsKlantNaam.ts` — zet `naam` om in `voornaam` +
 *    `achternaam` voor particuliere klanten, en laat bij twijfel (één woord,
 *    bedrijfsachtig, ander klanttype) juist álles staan.
 * 2. `convex/migrations/telefoon2UitNotities.ts` — haalt de regel
 *    "Tweede telefoonnummer: …" die `importKlanten` in `notities` schreef weer
 *    uit die notities en zet het nummer in het echte veld `telefoon2`.
 *
 * Beide migraties hebben hun beslissing per klant als pure functie, precies
 * zodat die hier zonder Convex-context getest kan worden (patroon van
 * `convex/tijdlijnMigratie.ts`). Wat hier groen staat, is wat er over ±460
 * bestaande klanten heen loopt — inclusief de belangrijkste eis: een tweede
 * run verandert niets meer.
 */

import { describe, it, expect } from "vitest";
import { samengesteldeNaam } from "../../../../convex/lib/klantNaam";
import { bepaalNaamSplitsing } from "../../../../convex/migrations/splitsKlantNaam";
import {
  TELEFOON2_NOTITIE_PREFIX,
  bepaalTelefoon2Migratie,
} from "../../../../convex/migrations/telefoon2UitNotities";

describe("bepaalNaamSplitsing", () => {
  it("splitst een particuliere naam in voornaam en achternaam", () => {
    expect(
      bepaalNaamSplitsing({ naam: "Jan van der Berg", klantType: "particulier" })
    ).toEqual({ actie: "splitsen", voornaam: "Jan", achternaam: "van der Berg" });
  });

  it("splitst ook als het klanttype ontbreekt (oud record)", () => {
    expect(bepaalNaamSplitsing({ naam: "Els de Vries" })).toEqual({
      actie: "splitsen",
      voornaam: "Els",
      achternaam: "de Vries",
    });
  });

  it("laat de voornaam leeg als de naam met een tussenvoegsel begint", () => {
    expect(bepaalNaamSplitsing({ naam: "van der Berg" })).toEqual({
      actie: "splitsen",
      voornaam: undefined,
      achternaam: "van der Berg",
    });
  });

  it("negeert spaties rond de naam", () => {
    expect(bepaalNaamSplitsing({ naam: "  Jan de Vries  " })).toEqual({
      actie: "splitsen",
      voornaam: "Jan",
      achternaam: "de Vries",
    });
  });

  it("houdt de weergavenaam gelijk aan de bron", () => {
    const namen = ["Jan van der Berg", "Els de Vries", "van der Berg", "Piet Jansen"];
    for (const naam of namen) {
      const besluit = bepaalNaamSplitsing({ naam });
      expect(besluit.actie).toBe("splitsen");
      if (besluit.actie !== "splitsen") continue;
      expect(
        samengesteldeNaam({
          voornaam: besluit.voornaam,
          achternaam: besluit.achternaam,
          naam,
        })
      ).toBe(naam.trim().replace(/\s+/g, " "));
    }
  });

  it("slaat een naam van één woord over", () => {
    expect(bepaalNaamSplitsing({ naam: "Vries" })).toEqual({
      actie: "overslaan",
      reden: "te_weinig_woorden",
    });
    expect(bepaalNaamSplitsing({ naam: "   " })).toEqual({
      actie: "overslaan",
      reden: "te_weinig_woorden",
    });
  });

  it("slaat een bedrijfsachtige naam over", () => {
    expect(bepaalNaamSplitsing({ naam: "Smeets Advocaten" })).toEqual({
      actie: "overslaan",
      reden: "bedrijfsnaam",
    });
    expect(
      bepaalNaamSplitsing({ naam: "Hoveniersbedrijf Groenveld B.V.", klantType: "particulier" })
    ).toEqual({ actie: "overslaan", reden: "bedrijfsnaam" });
  });

  it("slaat een niet-particuliere klant over", () => {
    for (const klantType of ["zakelijk", "vve", "gemeente", "overig"] as const) {
      expect(bepaalNaamSplitsing({ naam: "Jan de Vries", klantType })).toEqual({
        actie: "overslaan",
        reden: "ander_klanttype",
      });
    }
  });

  it("slaat een klant over die al gesplitst is", () => {
    expect(
      bepaalNaamSplitsing({ naam: "Jan de Vries", achternaam: "de Vries" })
    ).toEqual({ actie: "overslaan", reden: "al_gesplitst" });
    expect(bepaalNaamSplitsing({ naam: "Jan de Vries", voornaam: "Jan" })).toEqual({
      actie: "overslaan",
      reden: "al_gesplitst",
    });
  });

  it("ziet lege velden niet als gesplitst", () => {
    expect(
      bepaalNaamSplitsing({ naam: "Jan de Vries", voornaam: "  ", achternaam: "" })
    ).toEqual({ actie: "splitsen", voornaam: "Jan", achternaam: "de Vries" });
  });

  it("is idempotent: na splitsen verandert een tweede run niets", () => {
    const klant: { naam: string; voornaam?: string; achternaam?: string } = {
      naam: "Jan van der Berg",
    };
    const eerste = bepaalNaamSplitsing(klant);
    expect(eerste.actie).toBe("splitsen");
    if (eerste.actie !== "splitsen") return;

    const naSchrijven = {
      ...klant,
      voornaam: eerste.voornaam,
      achternaam: eerste.achternaam,
    };
    expect(bepaalNaamSplitsing(naSchrijven)).toEqual({
      actie: "overslaan",
      reden: "al_gesplitst",
    });
  });
});

describe("bepaalTelefoon2Migratie", () => {
  it("gebruikt exact de regel die importKlanten schreef", () => {
    expect(TELEFOON2_NOTITIE_PREFIX).toBe("Tweede telefoonnummer:");
  });

  it("haalt het nummer uit notities die alleen die regel bevatten", () => {
    expect(
      bepaalTelefoon2Migratie({ notities: "Tweede telefoonnummer: 0612345678" })
    ).toEqual({
      actie: "verplaatsen",
      telefoon2: "0612345678",
      notities: undefined,
      resterendeRegels: 0,
    });
  });

  it("laat de overige notitieregels staan", () => {
    expect(
      bepaalTelefoon2Migratie({
        notities:
          "Belt liever 's avonds\nTweede telefoonnummer: 06-12 34 56 78\nSleutel ligt bij de buren",
      })
    ).toEqual({
      actie: "verplaatsen",
      telefoon2: "0612345678",
      notities: "Belt liever 's avonds\nSleutel ligt bij de buren",
      resterendeRegels: 0,
    });
  });

  it("negeert spaties voor, achter en in het nummer", () => {
    expect(
      bepaalTelefoon2Migratie({
        notities: "  Tweede telefoonnummer:  +31 6 1234 5678  \n",
      })
    ).toEqual({
      actie: "verplaatsen",
      telefoon2: "+31612345678",
      notities: undefined,
      resterendeRegels: 0,
    });
  });

  it("laat toelichting achter het nummer geen nummer worden", () => {
    expect(
      bepaalTelefoon2Migratie({ notities: "Tweede telefoonnummer: 0612345678 (werk)" })
    ).toEqual({
      actie: "verplaatsen",
      telefoon2: "0612345678",
      notities: undefined,
      resterendeRegels: 0,
    });
  });

  it("slaat een onbruikbaar nummer over en laat de notitie staan", () => {
    expect(
      bepaalTelefoon2Migratie({ notities: "Tweede telefoonnummer: onbekend" })
    ).toEqual({ actie: "overslaan", reden: "ongeldig_nummer" });
    expect(bepaalTelefoon2Migratie({ notities: "Tweede telefoonnummer: 12345" })).toEqual({
      actie: "overslaan",
      reden: "ongeldig_nummer",
    });
  });

  it("slaat klanten zonder zo'n regel over", () => {
    expect(bepaalTelefoon2Migratie({})).toEqual({
      actie: "overslaan",
      reden: "geen_regel",
    });
    expect(bepaalTelefoon2Migratie({ notities: "Alleen een gewone notitie" })).toEqual({
      actie: "overslaan",
      reden: "geen_regel",
    });
  });

  it("raakt een klant die al een telefoon2 heeft niet aan", () => {
    expect(
      bepaalTelefoon2Migratie({
        notities: "Tweede telefoonnummer: 0612345678",
        telefoon2: "0698765432",
      })
    ).toEqual({ actie: "overslaan", reden: "al_telefoon2" });
  });

  it("verplaatst de eerste bruikbare regel en meldt wat blijft staan", () => {
    expect(
      bepaalTelefoon2Migratie({
        notities:
          "Tweede telefoonnummer: onbekend\nTweede telefoonnummer: 0612345678\nTweede telefoonnummer: 0201234567",
      })
    ).toEqual({
      actie: "verplaatsen",
      telefoon2: "0612345678",
      notities:
        "Tweede telefoonnummer: onbekend\nTweede telefoonnummer: 0201234567",
      resterendeRegels: 2,
    });
  });

  it("is idempotent: na verplaatsen verandert een tweede run niets", () => {
    const eerste = bepaalTelefoon2Migratie({
      notities: "Sleutel bij de buren\nTweede telefoonnummer: 0612345678",
    });
    expect(eerste.actie).toBe("verplaatsen");
    if (eerste.actie !== "verplaatsen") return;

    expect(
      bepaalTelefoon2Migratie({
        notities: eerste.notities,
        telefoon2: eerste.telefoon2,
      })
    ).toEqual({ actie: "overslaan", reden: "geen_regel" });
  });
});
