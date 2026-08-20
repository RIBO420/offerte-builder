/**
 * `klanten.setDossierToestemmingen` — de twee schakelaars uit de dossier-tab
 * Instellingen (klantdossier v13 §A8).
 *
 * Drie dingen moeten hier vastliggen:
 *
 * 1. **Eén schakelaar zet de andere niet om.** Beide argumenten zijn optioneel;
 *    wie alleen de opnametoestemming aanzet, mag de mailvoorkeur niet wissen.
 * 2. **Het oudere `inplanBevestigingsMail` blijft ongemoeid.** Dat veld voedt
 *    de mailtrigger in `werkitems.ts`; samenvoegen is een migratiebesluit, en
 *    deze mutation mag daar niet stiekem op vooruitlopen.
 * 3. **Een klantaccount en een andere organisatie komen er niet in.** Dit is
 *    intern dossier.
 */
import { describe, it, expect } from "vitest";

import { setDossierToestemmingen } from "../../../../convex/klanten";
import {
  MockConvexStore,
  createMockCtx,
  createMockKlant,
  createMockUser,
  seedAndereOrganisatie,
  seedMockOrganisatie,
} from "../../helpers/convex-mock";

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;

/** Convex registreert de handler op de functie zelf (func._handler). */
function handler(fn: unknown): AnyHandler {
  return (fn as { _handler: AnyHandler })._handler;
}

function bouwWereld(role = "directie") {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser({ role }));
  const klantId = store.insert(
    "klanten",
    createMockKlant(userId, {
      orgId,
      naam: "Familie De Vries",
      // Bestaande opt-in op het óude veld: die moet blijven staan.
      inplanBevestigingsMail: true,
    })
  );
  return { store, ctx: createMockCtx(store), orgId, userId, klantId };
}

describe("klanten.setDossierToestemmingen", () => {
  it("schrijft alleen de v13-velden en laat inplanBevestigingsMail staan", async () => {
    const wereld = bouwWereld();

    await handler(setDossierToestemmingen)(wereld.ctx, {
      id: wereld.klantId,
      bevestigingsmailBijInplannen: true,
      opnameToestemming: true,
    });

    const klant = wereld.store.get(wereld.klantId) as Record<string, unknown>;
    expect(klant.bevestigingsmailBijInplannen).toBe(true);
    expect(klant.opnameToestemming).toBe(true);
    expect(klant.inplanBevestigingsMail).toBe(true);
  });

  it("laat de andere vlag met rust als je er één meestuurt", async () => {
    const wereld = bouwWereld();

    await handler(setDossierToestemmingen)(wereld.ctx, {
      id: wereld.klantId,
      bevestigingsmailBijInplannen: true,
    });
    await handler(setDossierToestemmingen)(wereld.ctx, {
      id: wereld.klantId,
      opnameToestemming: true,
    });
    // En weer intrekken: false is een waarde, geen "niet meegegeven".
    await handler(setDossierToestemmingen)(wereld.ctx, {
      id: wereld.klantId,
      opnameToestemming: false,
    });

    const klant = wereld.store.get(wereld.klantId) as Record<string, unknown>;
    expect(klant.bevestigingsmailBijInplannen).toBe(true);
    expect(klant.opnameToestemming).toBe(false);
  });

  it("weigert een klantaccount", async () => {
    const wereld = bouwWereld("klant");

    await expect(
      handler(setDossierToestemmingen)(wereld.ctx, {
        id: wereld.klantId,
        opnameToestemming: true,
      })
    ).rejects.toThrow();

    const klant = wereld.store.get(wereld.klantId) as Record<string, unknown>;
    expect(klant.opnameToestemming).toBeUndefined();
  });

  it("komt niet bij de klant van een andere organisatie", async () => {
    const wereld = bouwWereld();
    const andereOrgId = seedAndereOrganisatie(wereld.store);
    const buurmanKlantId = wereld.store.insert(
      "klanten",
      createMockKlant(wereld.userId, {
        orgId: andereOrgId,
        naam: "Groen & Co-klant",
      })
    );

    await expect(
      handler(setDossierToestemmingen)(wereld.ctx, {
        id: buurmanKlantId,
        opnameToestemming: true,
      })
    ).rejects.toThrow();

    const klant = wereld.store.get(buurmanKlantId) as Record<string, unknown>;
    expect(klant.opnameToestemming).toBeUndefined();
  });
});
