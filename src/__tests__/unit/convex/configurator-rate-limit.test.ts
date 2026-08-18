/**
 * Unit tests voor de rate limits op de publieke configurator-instroom
 * (audit §3, convex/security.ts).
 *
 * De limieten zitten bewust ruim: de configurator is de klantgerichte
 * instroom van leads, dus een echte klant mag er nooit tegenaan lopen. Deze
 * tests leggen zowel de bovengrens vast (de limiet slaat écht aan) als de
 * ruimte eronder (een normale klant komt gewoon door).
 *
 * De teller in convex/security.ts leeft op moduleniveau, dus elke test
 * begint met het doorspoelen van de klok zodat oude vensters verlopen zijn.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  CONFIGURATOR_MAX_GLOBAAL,
  CONFIGURATOR_MAX_PER_EMAIL,
  REFERENTIE_LOOKUP_MAX_GLOBAAL,
  REISTIJD_MAX_PER_GEBRUIKER,
  checkConfiguratorEmailRateLimit,
  checkConfiguratorGlobaalRateLimit,
  checkPublicOfferteRateLimit,
  checkReferentieLookupRateLimit,
  checkReistijdRateLimit,
} from "../../../../convex/security";
import {
  create as createAanvraag,
  getByReferentie,
} from "../../../../convex/configuratorAanvragen";
import {
  MockConvexStore,
  createMockCtx,
  seedMockOrganisatie,
} from "../../helpers/convex-mock";
import type { QueryCtx } from "../../../../convex/_generated/server";

const EEN_UUR_MS = 60 * 60 * 1000;

let klok = new Date("2026-01-01T09:00:00.000Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  // Twee uur verder dan de vorige test: alle vensters (max. 1 uur) zijn
  // daarmee verlopen en de tellers starten schoon.
  klok += 2 * EEN_UUR_MS;
  vi.setSystemTime(klok);
});

afterAll(() => {
  vi.useRealTimers();
});

describe("rate limit per e-mailadres op configuratorAanvragen.create", () => {
  it("laat een klant het toegestane aantal aanvragen doen en blokkeert pas daarna", () => {
    const email = "klant@voorbeeld.nl";

    for (let poging = 1; poging <= CONFIGURATOR_MAX_PER_EMAIL; poging++) {
      expect(checkConfiguratorEmailRateLimit(email).allowed).toBe(true);
    }

    const overschrijding = checkConfiguratorEmailRateLimit(email);
    expect(overschrijding.allowed).toBe(false);
    expect(overschrijding.remaining).toBe(0);
    expect(overschrijding.resetAt).toBeGreaterThan(Date.now());
  });

  it("raakt andere klanten niet: de limiet is per e-mailadres", () => {
    const spammer = "bot@voorbeeld.nl";
    for (let poging = 0; poging <= CONFIGURATOR_MAX_PER_EMAIL; poging++) {
      checkConfiguratorEmailRateLimit(spammer);
    }
    expect(checkConfiguratorEmailRateLimit(spammer).allowed).toBe(false);

    expect(checkConfiguratorEmailRateLimit("echte.klant@voorbeeld.nl").allowed).toBe(
      true
    );
  });

  it("normaliseert het e-mailadres, zodat hoofdletters de limiet niet omzeilen", () => {
    const email = "Herhaal@Voorbeeld.NL";
    for (let poging = 0; poging < CONFIGURATOR_MAX_PER_EMAIL; poging++) {
      checkConfiguratorEmailRateLimit(email);
    }

    expect(checkConfiguratorEmailRateLimit("  herhaal@voorbeeld.nl ").allowed).toBe(
      false
    );
  });

  it("geeft de klant na het uurvenster weer ruimte", () => {
    const email = "geduldig@voorbeeld.nl";
    for (let poging = 0; poging <= CONFIGURATOR_MAX_PER_EMAIL; poging++) {
      checkConfiguratorEmailRateLimit(email);
    }
    expect(checkConfiguratorEmailRateLimit(email).allowed).toBe(false);

    // Regressie op de opruimlogica: die mag een uurvenster niet na één
    // minuut al wissen, en moet het na een uur wél vrijgeven.
    vi.setSystemTime(klok + EEN_UUR_MS / 2);
    expect(checkConfiguratorEmailRateLimit(email).allowed).toBe(false);

    vi.setSystemTime(klok + EEN_UUR_MS + 1000);
    expect(checkConfiguratorEmailRateLimit(email).allowed).toBe(true);
  });
});

describe("globale noodrem op configuratorAanvragen.create", () => {
  it("blokkeert pas boven het globale plafond", () => {
    for (let poging = 1; poging <= CONFIGURATOR_MAX_GLOBAAL; poging++) {
      expect(checkConfiguratorGlobaalRateLimit().allowed).toBe(true);
    }

    expect(checkConfiguratorGlobaalRateLimit().allowed).toBe(false);
  });
});

describe("rate limit op configuratorAanvragen.getByReferentie", () => {
  it("remt referentie-enumeratie af zodra het plafond bereikt is", () => {
    for (let poging = 1; poging <= REFERENTIE_LOOKUP_MAX_GLOBAAL; poging++) {
      expect(checkReferentieLookupRateLimit().allowed).toBe(true);
    }

    expect(checkReferentieLookupRateLimit().allowed).toBe(false);
  });
});

describe("getByReferentie degradeert netjes bij overschrijding", () => {
  type ReferentieHandler = (
    ctx: QueryCtx,
    args: { referentie: string }
  ) => Promise<{ referentie: string } | null>;

  const handler = (
    getByReferentie as unknown as { _handler: ReferentieHandler }
  )._handler;

  /** Nep-ctx die één aanvraag kent en bijhoudt of de db geraakt is. */
  function maakCtx(gevonden: { referentie: string } | null) {
    const geraakt = { db: false };
    const ctx = {
      db: {
        query: () => {
          geraakt.db = true;
          return {
            withIndex: () => ({ unique: async () => gevonden }),
          };
        },
      },
    } as unknown as QueryCtx;
    return { ctx, geraakt };
  }

  it("geeft de aanvraag terug zolang er quotum is", async () => {
    const { ctx } = maakCtx({ referentie: "CFG-20260101-0001" });
    const aanvraag = await handler(ctx, { referentie: "CFG-20260101-0001" });
    expect(aanvraag?.referentie).toBe("CFG-20260101-0001");
  });

  it("geeft null in plaats van een throw zodra het plafond bereikt is", async () => {
    for (let poging = 0; poging <= REFERENTIE_LOOKUP_MAX_GLOBAAL; poging++) {
      checkReferentieLookupRateLimit();
    }

    const { ctx, geraakt } = maakCtx({ referentie: "CFG-20260101-0002" });
    // Een throw zou de publieke statuspagina (live subscription) in de
    // error-boundary duwen tot de bezoeker herlaadt; null valt in het
    // bestaande "niet gevonden"-pad.
    await expect(
      handler(ctx, { referentie: "CFG-20260101-0002" })
    ).resolves.toBeNull();
    expect(geraakt.db).toBe(false);
  });
});

describe("rate limit op de reistijdberekening (Google Maps-kosten)", () => {
  it("staat een planner ruim toe en remt daarna af", () => {
    const gebruiker = "clerk_planner";

    for (let poging = 1; poging <= REISTIJD_MAX_PER_GEBRUIKER; poging++) {
      expect(checkReistijdRateLimit(gebruiker).allowed).toBe(true);
    }

    expect(checkReistijdRateLimit(gebruiker).allowed).toBe(false);
  });

  it("is per gebruiker, zodat één driftige tenant de rest niet blokkeert", () => {
    const druk = "clerk_druk";
    for (let poging = 0; poging <= REISTIJD_MAX_PER_GEBRUIKER; poging++) {
      checkReistijdRateLimit(druk);
    }
    expect(checkReistijdRateLimit(druk).allowed).toBe(false);

    expect(checkReistijdRateLimit("clerk_ander").allowed).toBe(true);
  });
});

describe("bestaande offerte-limiet blijft ongewijzigd", () => {
  it("staat 30 verzoeken per minuut per share-token toe", () => {
    const token = "share-token-abcdef";

    for (let poging = 1; poging <= 30; poging++) {
      expect(checkPublicOfferteRateLimit(token).allowed).toBe(true);
    }

    expect(checkPublicOfferteRateLimit(token).allowed).toBe(false);

    // Na het minuutvenster mag het weer.
    vi.setSystemTime(klok + 61000);
    expect(checkPublicOfferteRateLimit(token).allowed).toBe(true);
  });
});

/**
 * Bij welke organisatie hoort een lead die binnenkomt zónder ingelogde
 * gebruiker? De configurator heeft geen JWT en dus geen `org_id`-claim; de
 * gewone resolvers (`requireOrgId`, `requireOrgContext`) kunnen hier per
 * definitie niet werken. De afgeleide keuze mag nooit "de eerste de beste
 * organisatie" worden: bij twijfel liever géén tenant dan de verkeerde.
 */
describe("publieke lead-intake: bij welke organisatie hoort de lead?", () => {
  const geldigeAanvraag = {
    type: "gazon" as const,
    klantNaam: "Jan de Vries",
    klantTelefoon: "0612345678",
    klantAdres: "Dorpsstraat 1",
    klantPostcode: "1234 AB",
    klantPlaats: "Utrecht",
    specificaties: {},
    indicatiePrijs: 1250,
  };

  function createHandler(store: MockConvexStore) {
    const ctx = createMockCtx(store);
    const handler = (
      createAanvraag as unknown as {
        _handler: (ctx: unknown, args: unknown) => Promise<unknown>;
      }
    )._handler;
    return (args: Record<string, unknown>) => handler(ctx, args);
  }

  it("hangt de lead aan de enige actieve organisatie", async () => {
    const store = new MockConvexStore();
    const orgId = seedMockOrganisatie(store);

    await createHandler(store)({
      ...geldigeAanvraag,
      klantEmail: "enige.org@voorbeeld.nl",
    });

    const leads = store.getAll("configuratorAanvragen");
    expect(leads).toHaveLength(1);
    expect(leads[0].orgId).toBe(orgId);
  });

  it("laat orgId leeg als er meerdere actieve organisaties zijn", async () => {
    const store = new MockConvexStore();
    seedMockOrganisatie(store);
    seedMockOrganisatie(store, { clerkOrgId: "clerk_test_org_456" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await createHandler(store)({
      ...geldigeAanvraag,
      klantEmail: "twee.orgs@voorbeeld.nl",
    });

    // De lead gaat niet verloren — hij komt alleen niet op een bord terecht,
    // want een gok naar de verkeerde tenant is erger dan geen tenant.
    const leads = store.getAll("configuratorAanvragen");
    expect(leads).toHaveLength(1);
    expect(leads[0].orgId).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("negeert een inactieve organisatie bij het bepalen van de tenant", async () => {
    const store = new MockConvexStore();
    const actieveOrgId = seedMockOrganisatie(store);
    seedMockOrganisatie(store, {
      clerkOrgId: "clerk_test_org_oud",
      actief: false,
    });

    await createHandler(store)({
      ...geldigeAanvraag,
      klantEmail: "inactieve.org@voorbeeld.nl",
    });

    expect(store.getAll("configuratorAanvragen")[0].orgId).toBe(actieveOrgId);
  });
});
