import { expect, it, vi } from "vitest";
import type { MutationCtx } from "../../../../convex/_generated/server";
import type { Id } from "../../../../convex/_generated/dataModel";
import { slaDagvoorstelOp, dienDagIn, heropenDag, updateSegment } from "../../../../convex/urenSegmenten";
import { delegeer, meldAfronding, meldAfvoer, uploadUrl, voegFotoToe, getVoorDag } from "../../../../convex/werkbezoek";
import { meld as meldRetour, getDag as getRetourDag } from "../../../../convex/aanhangerRetouren";
import { MockConvexStore, createMockCtx, createMockUser, seedMockOrganisatie, seedAndereOrganisatie, TEST_CLERK_ORG_ID, TEST_ANDERE_CLERK_ORG_ID } from "../../helpers/convex-mock";

// One shared store, separate immutable authenticated contexts. Only storage/network
// are mocked: real handlers compose auth, receipts, readiness and day revisions.
const call = <R = unknown>(fn: unknown, ctx: MutationCtx, args: unknown) =>
  (fn as { _handler: (ctx: MutationCtx, args: unknown) => Promise<R> })._handler(ctx, args);
function fixture() {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store), otherOrgId = seedAndereOrganisatie(store);
  function actor(naam: string, role: string, org = orgId, claim = TEST_CLERK_ORG_ID) {
    const medewerkerId = store.insert("medewerkers", { orgId: org, naam, isActief: true });
    const userId = store.insert("users", createMockUser({ clerkId: naam, name: naam, role, orgId: org, linkedMedewerkerId: medewerkerId }));
    const ctx = createMockCtx(store, { identity: { subject: naam, org_id: claim } }) as unknown as MutationCtx;
    ctx.storage = { generateUploadUrl: vi.fn(async () => "https://storage.invalid/upload"), getUrl: vi.fn(async () => "https://storage.invalid/photo") } as unknown as MutationCtx["storage"];
    ctx.db.system = { get: vi.fn(async () => ({ sha256: "qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=", contentType: "image/jpeg", size: 512 })) } as unknown as MutationCtx["db"]["system"];
    return { medewerkerId, userId, ctx };
  }
  const sam = actor("Sam", "medewerker"), kim = actor("Kim", "voorman"), kantoor = actor("Kantoor", "projectleider");
  const vreemd = actor("Vreemd", "projectleider", otherOrgId, TEST_ANDERE_CLERK_ORG_ID);
  const teamId = store.insert("teams", { orgId, naam: "Groen", leden: [sam.medewerkerId, kim.medewerkerId], isActief: true });
  const klantId = store.insert("klanten", { orgId, naam: "Eigen klant" });
  const datum = "2026-08-12";
  const werkitemId = store.insert("projecten", { orgId, klantId, naam: "Eigen onderhoud", uitvoeringCategorie: "onderhoud", teamId, geplandeStart: datum, status: "gepland" });
  const voertuigId = store.insert("voertuigen", { orgId, type: "aanhanger", merk: "Hapert", model: "Cobalt", kenteken: "AA-12-BB", status: "actief" });
  const bezoek = { datum, werkitemId };
  const voorstel = { datum, verwachteRevisie: 0, sleutel: "dagvoorstel-zelfde-sleutel", segmenten: [{ categorie: "werken", beginTijd: "08:00", eindTijd: "09:00", werkitemId, klantId }] };
  return { store, orgId, sam, kim, kantoor, vreemd, teamId, voertuigId, bezoek, voorstel };
}

it("doorloopt twee echte crewactors: eigen uren, persoonlijke delegatie, gedeelde uitvoering en kantoorcorrectie", async () => {
  const f = fixture();
  const urenSam = await call<{ ids: Id<"urenSegmenten">[]; revisie: number }>(slaDagvoorstelOp, f.sam.ctx, f.voorstel);
  const urenKim = await call<{ ids: Id<"urenSegmenten">[]; revisie: number }>(slaDagvoorstelOp, f.kim.ctx, f.voorstel);
  expect(urenSam.ids[0]).not.toBe(urenKim.ids[0]);
  expect(f.store.get(urenSam.ids[0])).toMatchObject({ medewerkerId: f.sam.medewerkerId, ingevoerdDoor: f.sam.userId });
  expect(f.store.get(urenKim.ids[0])).toMatchObject({ medewerkerId: f.kim.medewerkerId, ingevoerdDoor: f.kim.userId });
  await expect(call(dienDagIn, f.sam.ctx, { datum: f.bezoek.datum })).rejects.toThrow("Maak de bezoekmelding");
  for (const onderdeel of ["foto", "afronding", "aanhanger", "afvoer"]) {
    await call(delegeer, f.sam.ctx, { ...f.bezoek, onderdeel, naarMedewerkerId: f.kim.medewerkerId, sleutel: `delegatie-${onderdeel}` });
  }
  await call(dienDagIn, f.sam.ctx, { datum: f.bezoek.datum });
  await expect(call(dienDagIn, f.kim.ctx, { datum: f.bezoek.datum })).rejects.toThrow("Maak de bezoekmelding");
  // A lost response replay returns the original IDs even after submit; it must
  // not append hours, unlock the day or adopt a colleague's actor identity.
  expect(await call(slaDagvoorstelOp, f.sam.ctx, f.voorstel)).toEqual(urenSam);
  expect(f.store.getAll("urenSegmenten")).toHaveLength(2);
  await expect(call(updateSegment, f.sam.ctx, { id: urenSam.ids[0], eindTijd: "09:15" })).rejects.toThrow("ingediend");
  await expect(call(heropenDag, f.sam.ctx, { datum: f.bezoek.datum, medewerkerId: f.sam.medewerkerId })).rejects.toThrow("Alleen kantoor");

  const ticket = await call<{ ticketId: string }>(uploadUrl, f.kim.ctx, { ...f.bezoek, sha256: "a".repeat(64) });
  const fotoInput = { ...f.bezoek, fase: "voor", storageId: "_storage:test-foto", ticketId: ticket.ticketId, sleutel: "foto-voor-1" };
  await expect(call(voegFotoToe, f.sam.ctx, fotoInput)).rejects.toThrow("account");
  const foto = await call(voegFotoToe, f.kim.ctx, fotoInput);
  expect(await call(voegFotoToe, f.kim.ctx, fotoInput)).toEqual(foto);
  await call(meldAfronding, f.kim.ctx, { ...f.bezoek, afgerond: false, reden: "Regen", resterendMinuten: 60, sleutel: "afronding-1" });
  await call(meldAfvoer, f.kim.ctx, { ...f.bezoek, keuze: "kwart", sleutel: "afvoer-1" });
  const retourInput = { datum: f.bezoek.datum, teamId: f.teamId, voertuigId: f.voertuigId, retourId: "gedeelde-retour-1", keuze: "half", waargenomenOp: Date.parse("2026-08-12T15:00:00Z"), idempotencyKey: "retour-1" };
  await call(meldRetour, f.kim.ctx, retourInput);
  expect(await call(getRetourDag, f.sam.ctx, { datum: f.bezoek.datum, teamId: f.teamId })).toMatchObject({ retouren: [{ keuze: "half", gemeldDoorNaam: "Kim" }] });
  expect(await call(getVoorDag, f.sam.ctx, { datum: f.bezoek.datum })).toMatchObject({ gereed: true, bezoeken: [{ gedeeldGereed: true }] });
  await call(dienDagIn, f.kim.ctx, { datum: f.bezoek.datum });
  expect(f.store.getAll("urenDagen").every(d => d.status === "ingediend")).toBe(true);
  expect(f.store.getAll("werkbezoekFotos")).toHaveLength(1);
  expect(f.store.getAll("klantTijdlijn")).toHaveLength(1);
  expect(f.store.getAll("werkbezoekAfvoer")[0]).toMatchObject({ keuze: "kwart" });
  expect(f.store.getAll("werkbezoekAfvoer")[0].bedragCent).toBeUndefined();
  expect(f.store.get(f.bezoek.werkitemId)).toMatchObject({ status: "gepland" });
  expect(f.store.getAll("facturen")).toHaveLength(0);

  await call(heropenDag, f.kantoor.ctx, { datum: f.bezoek.datum, medewerkerId: f.sam.medewerkerId });
  const dagSam = () => f.store.getAll("urenDagen").find(d => d.medewerkerId === f.sam.medewerkerId)!;
  const revisie = dagSam().revisie;
  const correctie = { id: urenSam.ids[0], eindTijd: "09:15", verwachteRevisie: revisie, sleutel: "kantoor-correctie-1" };
  await call(updateSegment, f.kantoor.ctx, correctie);
  expect(await call(updateSegment, f.kantoor.ctx, correctie)).toBe(urenSam.ids[0]);
  await expect(call(updateSegment, f.sam.ctx, { ...correctie, eindTijd: "09:30", sleutel: "medewerker-conflict" })).rejects.toThrow(/gewijzigd|revisie/i);
  expect(f.store.get(urenSam.ids[0])).toMatchObject({ eindTijd: "09:15", ingevoerdDoor: f.sam.userId });
  expect(f.store.getAll("urenLogboek")).toEqual(expect.arrayContaining([expect.objectContaining({ actie: "dag_heropend", door: f.kantoor.userId }), expect.objectContaining({ actie: "segment_gecorrigeerd", door: f.kantoor.userId })]));
  await call(dienDagIn, f.sam.ctx, { datum: f.bezoek.datum });
  expect(dagSam().status).toBe("ingediend");

  await expect(call(updateSegment, f.vreemd.ctx, correctie)).rejects.toThrow("niet gevonden");
  await expect(call(voegFotoToe, f.vreemd.ctx, fotoInput)).rejects.toThrow("niet gevonden");
  await expect(call(meldRetour, f.vreemd.ctx, retourInput)).rejects.toThrow();
  await expect(call(heropenDag, f.vreemd.ctx, { datum: f.bezoek.datum, medewerkerId: f.sam.medewerkerId })).rejects.toThrow("niet gevonden");
  expect(f.store.getAll("urenSegmenten")).toHaveLength(2);
  expect(f.store.getAll("aanhangerRetouren")).toHaveLength(1);
});

it("geeft opgeslagen opdrachtresultaten alleen terug na actuele sessie- en organisatiecontrole", async () => {
  const f = fixture();
  await call(slaDagvoorstelOp, f.sam.ctx, f.voorstel);
  const uitgelogd = createMockCtx(f.store, { identity: null }) as unknown as MutationCtx;
  const andereOrganisatie = createMockCtx(f.store, { identity: { subject: "Sam", org_id: TEST_ANDERE_CLERK_ORG_ID } }) as unknown as MutationCtx;
  await expect(call(slaDagvoorstelOp, uitgelogd, f.voorstel)).rejects.toThrow();
  await expect(call(slaDagvoorstelOp, andereOrganisatie, f.voorstel)).rejects.toThrow();
  f.store.patch(f.orgId, { actief: false });
  await expect(call(slaDagvoorstelOp, f.sam.ctx, f.voorstel)).rejects.toThrow();
  expect(f.store.getAll("urenOpdrachten")).toHaveLength(1);
  expect(f.store.getAll("urenSegmenten")).toHaveLength(1);
});
