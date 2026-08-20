/**
 * Opruimen van `klantBestanden`: wat mag er weg, en wat mag er juist blijven?
 *
 * Twee bevindingen uit review v13 komen hier samen, en ze wijzen tegengesteld:
 *
 * 1. **GDPR wist de bestanden niet.** `klanten.gdprAnonymize` haalde de PII uit
 *    de klantrij en de opnames uit de tijdlijn, maar de foto's van de tuin en
 *    de geüploade documenten bleven gewoon staan — inclusief hun bestanden in
 *    de storage. Een verwijderverzoek dat de tuin van mevrouw laat staan is
 *    geen verwijderverzoek.
 *
 * 2. **Eén dossierrij verwijderen mocht gedeelde storage niet wissen.**
 *    Een rij met bron `offerte`/`factuur` is een VERWIJZING naar een document
 *    dat elders leeft; `storage.delete` daarop sloopte de PDF onder de offerte
 *    vandaan. Alleen een eigen upload (`upload`/`klant`) heeft een eigen
 *    storage-object.
 */

import { describe, it, expect, vi } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockKlant,
  seedMockOrganisatie,
} from "../../helpers/convex-mock";
import { gdprAnonymize } from "../../../../convex/klanten";
import { verwijder as verwijderBestand } from "../../../../convex/klantBestanden";

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;

/** Convex registreert de handler op de functie zelf (func._handler). */
function handler(fn: unknown): AnyHandler {
  return (fn as { _handler: AnyHandler })._handler;
}

/** Organisatie + directie-account + klant, met een storage-spion. */
function opzet() {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser({ role: "directie", orgId }));
  const klantId = store.insert("klanten", createMockKlant(userId, { orgId }));
  const verwijderd = vi.fn(async () => {});
  const ctx = {
    ...createMockCtx(store),
    storage: { delete: verwijderd },
  };
  return { ctx, store, orgId, userId, klantId, verwijderd };
}

interface BestandOpties {
  bron: "upload" | "klant" | "offerte" | "factuur";
  storageId?: string;
  soort?: "foto" | "document";
  titel?: string;
  klantId?: string;
}

function insertBestand(
  store: MockConvexStore,
  basis: { orgId: string; klantId: string; userId: string },
  opties: BestandOpties
): string {
  return store.insert("klantBestanden", {
    orgId: basis.orgId,
    klantId: opties.klantId ?? basis.klantId,
    soort: opties.soort ?? "foto",
    titel: opties.titel ?? "Tuin voor",
    bron: opties.bron,
    storageId: opties.storageId,
    geuploadDoorId: basis.userId,
    timestamp: Date.now(),
  });
}

// ─── 1. GDPR ─────────────────────────────────────────────────────────────────

describe("gdprAnonymize: klantbestanden vallen onder het verzoek", () => {
  it("verwijdert eigen uploads uit storage én dossier, en de verwijzingen als rij", async () => {
    const { ctx, store, orgId, userId, klantId, verwijderd } = opzet();
    const basis = { orgId, klantId, userId };

    const eigenFoto = insertBestand(store, basis, {
      bron: "upload",
      storageId: "_storage:foto-1",
    });
    const doorKlant = insertBestand(store, basis, {
      bron: "klant",
      storageId: "_storage:foto-2",
    });
    const offerteVerwijzing = insertBestand(store, basis, {
      bron: "offerte",
      soort: "document",
      titel: "Offerte 2026-001",
    });
    const factuurVerwijzing = insertBestand(store, basis, {
      bron: "factuur",
      soort: "document",
      titel: "Factuur 2026-014",
    });

    // Een andere klant in dezelfde organisatie mag niets merken.
    const andereKlantId = store.insert(
      "klanten",
      createMockKlant(userId, { orgId, naam: "Familie Anders" })
    );
    const vanAndereKlant = insertBestand(store, basis, {
      bron: "upload",
      storageId: "_storage:foto-3",
      klantId: andereKlantId,
    });

    await handler(gdprAnonymize)(ctx, { id: klantId });

    // Eigen uploads: storage-object weg.
    expect(verwijderd).toHaveBeenCalledWith("_storage:foto-1");
    expect(verwijderd).toHaveBeenCalledWith("_storage:foto-2");
    // Verwijzingen hebben geen eigen storage-object; die mag niets raken.
    expect(verwijderd).not.toHaveBeenCalledWith("_storage:foto-3");
    expect(verwijderd).toHaveBeenCalledTimes(2);

    // Alle rijen van deze klant zijn weg, ook de verwijzingen.
    for (const id of [eigenFoto, doorKlant, offerteVerwijzing, factuurVerwijzing]) {
      expect(store.get(id)).toBeNull();
    }
    expect(store.get(vanAndereKlant)).not.toBeNull();
  });

  it("gaat door als een bestand al uit de storage verdwenen is", async () => {
    const { ctx, store, orgId, userId, klantId } = opzet();
    ctx.storage.delete = vi.fn(async () => {
      throw new Error("bestand bestaat niet meer");
    });

    const fotoId = insertBestand(
      store,
      { orgId, klantId, userId },
      { bron: "upload", storageId: "_storage:foto-weg" }
    );

    await expect(
      handler(gdprAnonymize)(ctx, { id: klantId })
    ).resolves.toMatchObject({ success: true });

    expect(store.get(fotoId)).toBeNull();
    expect(store.get(klantId)?.gdprAnonymized).toBe(true);
  });
});
