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
 *
 * De `start`-mutations zelf draaien hieronder tegen een nep-ctx, omdat het
 * rapport dat de operator leest hun tweede belofte is: een dry run toont ALLE
 * klanten (niet de eerste 100), een echte run schrijft 100 per transactie.
 * Die nep-ctx houdt zich aan de regel van Convex waar de eerste versie van deze
 * migraties op stukliep: één `paginate` per functie-aanroep, een tweede gooit
 * dezelfde fout als de echte runtime. `convex-test` is in dit project niet
 * geïnstalleerd; de handler zit op `_handler` van de geregistreerde mutation,
 * vandaar de cast.
 */

import { describe, it, expect } from "vitest";
import { samengesteldeNaam } from "../../../../convex/lib/klantNaam";
import {
  bepaalNaamSplitsing,
  start as startSplitsKlantNaam,
} from "../../../../convex/migrations/splitsKlantNaam";
import {
  TELEFOON2_NOTITIE_PREFIX,
  bepaalTelefoon2Migratie,
  start as startTelefoon2UitNotities,
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

  it("laat een regel met toelichting achter het nummer staan", () => {
    // De import schreef één kaal nummer; staat er tekst achter, dan heeft
    // iemand de regel met de hand aangepast en weten we niet meer welk stuk
    // het nummer is. Dan blijft de notitie staan en wordt de klant gemeld.
    expect(
      bepaalTelefoon2Migratie({ notities: "Tweede telefoonnummer: 0612345678 (werk)" })
    ).toEqual({ actie: "overslaan", reden: "ongeldig_nummer" });
  });

  it("plakt twee nummers op één regel niet aan elkaar", () => {
    // Zonder deze bescherming werd "0612345678 of 0687654321" één nummer van
    // 20 cijfers én verdween de regel uit de notities.
    expect(
      bepaalTelefoon2Migratie({
        notities: "Tweede telefoonnummer: 0612345678 of 0687654321",
      })
    ).toEqual({ actie: "overslaan", reden: "ongeldig_nummer" });
    expect(
      bepaalTelefoon2Migratie({
        notities: "Tweede telefoonnummer: 0612345678 / 0687654321",
      })
    ).toEqual({ actie: "overslaan", reden: "ongeldig_nummer" });
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

// ─── De start-mutations: dry run ziet alles, echte run blijft gebatcht ───────

type FakeKlant = {
  _id: string;
  naam: string;
  voornaam?: string;
  achternaam?: string;
  klantType?: "particulier" | "zakelijk" | "vve" | "gemeente" | "overig";
  notities?: string;
  telefoon2?: string;
};

type FakeCtx = {
  db: {
    query: (tabel: string) => {
      collect: () => Promise<FakeKlant[]>;
      paginate: (opts: { cursor: string | null; numItems: number }) => Promise<{
        page: FakeKlant[];
        continueCursor: string;
        isDone: boolean;
      }>;
    };
    patch: (id: string, velden: Record<string, unknown>) => Promise<void>;
  };
};

/** Woordelijk de fout die Convex gooit bij een tweede gepagineerde query. */
const CONVEX_PAGINATE_FOUT =
  "This query or mutation function ran multiple paginated queries. " +
  "Convex only supports a single paginated query in each function.";

type StartArgs = { cursor?: string | null; dryRun?: boolean };
type StartHandler<R> = (ctx: FakeCtx, args: StartArgs) => Promise<R>;
const handlerVan = <R,>(fn: unknown): StartHandler<R> =>
  (fn as { _handler: StartHandler<R> })._handler;

/**
 * Nep-ctx met een cursor die daadwerkelijk verder telt — de gedeelde mock in
 * `src/__tests__/helpers/convex-mock.ts` geeft altijd een lege cursor terug en
 * zou de bug (alleen de eerste pagina) dus niet kunnen laten zien.
 *
 * En, belangrijker: deze ctx gooit bij een tweede `paginate` exact de fout van
 * de echte runtime. De eerste versie van deze migraties lustte in de dry run
 * over `paginate` heen; omdat de oude nep-ctx onbeperkt pagineerde, was dat
 * hier groen en in de dev-deployment stuk. Eén ctx = één handler-aanroep.
 */
function nepCtx(klanten: FakeKlant[]) {
  const patches: Array<{ id: string; velden: Record<string, unknown> }> = [];
  let paginas = 0;
  let collects = 0;

  const ctx: FakeCtx = {
    db: {
      query: () => ({
        collect: async () => {
          collects++;
          return klanten;
        },
        paginate: async ({ cursor, numItems }) => {
          paginas++;
          if (paginas > 1) throw new Error(CONVEX_PAGINATE_FOUT);
          const vanaf = cursor === null ? 0 : Number(cursor);
          const page = klanten.slice(vanaf, vanaf + numItems);
          const tot = vanaf + page.length;
          return { page, continueCursor: String(tot), isDone: tot >= klanten.length };
        },
      }),
      patch: async (id, velden) => {
        patches.push({ id, velden });
      },
    },
  };

  return { ctx, patches, paginas: () => paginas, collects: () => collects };
}

/** 250 klanten = drie pagina's van 100: even splitsbaar, oneven twijfel. */
function naamKlanten(): FakeKlant[] {
  return Array.from({ length: 250 }, (_, i) => ({
    _id: `klant_${i}`,
    naam: i % 2 === 0 ? `Jan${i} Jansen` : `Jansen${i}`,
  }));
}

/** 250 klanten: even een bruikbaar geparkeerd nummer, oneven een onbruikbaar. */
function telefoonKlanten(): FakeKlant[] {
  return Array.from({ length: 250 }, (_, i) => ({
    _id: `klant_${i}`,
    naam: `Klant ${i}`,
    notities:
      i % 2 === 0
        ? "Tweede telefoonnummer: 0612345678"
        : "Tweede telefoonnummer: onbekend",
  }));
}

describe("splitsKlantNaam:start", () => {
  const start = handlerVan<{
    dryRun: boolean;
    bekeken: number;
    gesplitst: number;
    alGesplitst: number;
    twijfel: number;
    twijfelVoorbeelden: unknown[];
    isDone: boolean;
    continueCursor: string | null;
  }>(startSplitsKlantNaam);

  it("telt in een dry run ALLE klanten, niet alleen de eerste batch", async () => {
    const { ctx, patches } = nepCtx(naamKlanten());

    const rapport = await start(ctx, { dryRun: true });

    expect(rapport.bekeken).toBe(250);
    expect(rapport.gesplitst).toBe(125);
    expect(rapport.twijfel).toBe(125);
    expect(rapport.isDone).toBe(true);
    expect(rapport.continueCursor).toBeNull();
    expect(patches).toHaveLength(0);
  });

  it("leest de dry run in één keer, zonder paginate", async () => {
    // Convex staat één gepagineerde query per functie-aanroep toe; lussen met
    // `paginate` liet de migratie in de dev-deployment crashen.
    const { ctx, paginas, collects } = nepCtx(naamKlanten());

    await start(ctx, { dryRun: true });

    expect(paginas()).toBe(0);
    expect(collects()).toBe(1);
  });

  it("houdt de voorbeeldlijst ook over meerdere pagina's op 50", async () => {
    const { ctx } = nepCtx(naamKlanten());

    const rapport = await start(ctx, { dryRun: true });

    expect(rapport.twijfelVoorbeelden).toHaveLength(50);
  });

  it("schrijft per batch van 100 en geeft een cursor terug", async () => {
    const { ctx, patches, paginas, collects } = nepCtx(naamKlanten());

    const rapport = await start(ctx, { dryRun: false });

    expect(rapport.bekeken).toBe(100);
    expect(rapport.isDone).toBe(false);
    expect(rapport.continueCursor).toBe("100");
    expect(paginas()).toBe(1);
    expect(collects()).toBe(0);
    expect(patches).toHaveLength(50);
    expect(patches[0]).toEqual({
      id: "klant_0",
      velden: { voornaam: "Jan0", achternaam: "Jansen" },
    });
  });

  it("loopt met de cursor door tot de laatste batch", async () => {
    const { ctx, patches } = nepCtx(naamKlanten());

    const laatste = await start(ctx, { dryRun: false, cursor: "200" });

    expect(laatste.bekeken).toBe(50);
    expect(laatste.isDone).toBe(true);
    expect(laatste.continueCursor).toBeNull();
    expect(patches).toHaveLength(25);
  });
});

describe("telefoon2UitNotities:start", () => {
  const start = handlerVan<{
    dryRun: boolean;
    bekeken: number;
    verplaatst: number;
    ongeldig: number;
    ongeldigeVoorbeelden: unknown[];
    isDone: boolean;
    continueCursor: string | null;
  }>(startTelefoon2UitNotities);

  it("telt in een dry run ALLE klanten, niet alleen de eerste batch", async () => {
    const { ctx, patches } = nepCtx(telefoonKlanten());

    const rapport = await start(ctx, { dryRun: true });

    expect(rapport.bekeken).toBe(250);
    expect(rapport.verplaatst).toBe(125);
    expect(rapport.ongeldig).toBe(125);
    expect(rapport.ongeldigeVoorbeelden).toHaveLength(50);
    expect(rapport.isDone).toBe(true);
    expect(rapport.continueCursor).toBeNull();
    expect(patches).toHaveLength(0);
  });

  it("leest de dry run in één keer, zonder paginate", async () => {
    const { ctx, paginas, collects } = nepCtx(telefoonKlanten());

    await start(ctx, { dryRun: true });

    expect(paginas()).toBe(0);
    expect(collects()).toBe(1);
  });

  it("schrijft per batch van 100 en geeft een cursor terug", async () => {
    const { ctx, patches } = nepCtx(telefoonKlanten());

    const rapport = await start(ctx, { dryRun: false });

    expect(rapport.bekeken).toBe(100);
    expect(rapport.isDone).toBe(false);
    expect(rapport.continueCursor).toBe("100");
    expect(patches).toHaveLength(50);
    expect(patches[0]).toEqual({
      id: "klant_0",
      velden: { telefoon2: "0612345678", notities: undefined },
    });
  });
});
