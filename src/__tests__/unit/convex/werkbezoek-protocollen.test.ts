import { describe, expect, it, vi } from "vitest";
import type { MutationCtx } from "../../../../convex/_generated/server";
import type { Id } from "../../../../convex/_generated/dataModel";
import { meldAfronding, meldAfvoer, stelAfvoerTariefIn, delegeer, assertDagGereed, getVoorDag, getKantoorDag, wijzigKlusInstructie, uploadUrl, voegFotoToe, verwijderFoto } from "../../../../convex/werkbezoek";
import { opslaan, list, get, archiveer, listContacten, opslaanContact, archiveerContact } from "../../../../convex/protocollen";
import { MockConvexStore, createMockCtx, createMockUser, seedMockOrganisatie, seedAndereOrganisatie } from "../../helpers/convex-mock";

// Real registered handlers against the index-aware schema-backed mock.
function handler<A, R>(fn: unknown) { return (fn as { _handler: (ctx: MutationCtx, args: A) => Promise<R> })._handler; }
type Visit = { werkitemId: Id<"projecten">; datum: string };
const afsluiten = handler<Visit & { afgerond: boolean; reden?: string; resterendMinuten?: number; expectedRevision?: number; sleutel: string }, { id: Id<"werkbezoekAntwoorden">; revision: number }>(meldAfronding);
const delegeren = handler<Visit & { onderdeel: "foto" | "afronding" | "aanhanger" | "afvoer"; naarMedewerkerId?: Id<"medewerkers">; sleutel: string }, { id: string }>(delegeer);
const afvoeren = handler<Visit & { keuze: "geen" | "half" | "vol"; sleutel: string; expectedRevision?: number; bedragCent?: number }, { id: Id<"werkbezoekAfvoer">; revision: number }>(meldAfvoer);
const tariefInstellen = handler<{ geldigVanaf: string; volTariefCent: number }, unknown>(stelAfvoerTariefIn);
const dag = handler<{ datum: string }, { gereed: boolean; bezoeken: Array<{ werkitemId: string; gedeeldGereed: boolean; ontbreekt: string[]; fotos: unknown[] }> }>(getVoorDag);
const kantoorDag = handler<{ datum: string }, { bezoeken: unknown[] }>(getKantoorDag);
const upload = handler<Visit & { sha256: string }, { url: string; ticketId: Id<"werkbezoekUploads"> }>(uploadUrl);
const foto = handler<Visit & { fase: "voor" | "na"; storageId: Id<"_storage">; ticketId: Id<"werkbezoekUploads">; sleutel: string }, { id: Id<"werkbezoekFotos"> }>(voegFotoToe);
const wisFoto = handler<{ id: Id<"werkbezoekFotos"> }, void>(verwijderFoto);
type ProtocolIn = { id?: Id<"protocollen">; titel: string; wanneer: string; stappen: string[]; doelgroepen: ("medewerker" | "voorman")[]; actief: boolean; expectedRevision?: number };
const saveProtocol = handler<ProtocolIn, { id: Id<"protocollen">; revision: number }>(opslaan);
const listProtocol = handler<Record<string, never>, Array<{ _id: string; actief: boolean }>>(list);
const getProtocol = handler<{ id: Id<"protocollen"> }, { revision: number }>(get);
const archiveProtocol = handler<{ id: Id<"protocollen">; expectedRevision: number }, unknown>(archiveer);
const contacten = handler<Record<string, never>, unknown[]>(listContacten);
const saveContact = handler<{ id?: Id<"protocolContacten">; naam: string; telefoon: string; spoed: boolean; volgorde: number; actief: boolean; expectedRevision?: number }, { id: Id<"protocolContacten">; revision: number }>(opslaanContact);
const archiveContact = handler<{ id: Id<"protocolContacten">; expectedRevision: number }, unknown>(archiveerContact);

function fixture(role = "medewerker") {
  const store = new MockConvexStore(), orgId = seedMockOrganisatie(store) as Id<"organisaties">, otherOrgId = seedAndereOrganisatie(store);
  const medewerkerId = store.insert("medewerkers", { orgId, naam: "Sam" }) as Id<"medewerkers">;
  const collegaId = store.insert("medewerkers", { orgId, naam: "Kim" }) as Id<"medewerkers">;
  const userId = store.insert("users", createMockUser({ orgId, role, linkedMedewerkerId: medewerkerId }));
  const teamId = store.insert("teams", { orgId, naam: "Groen", leden: [medewerkerId, collegaId], isActief: true });
  const klantId = store.insert("klanten", { orgId, naam: "Tuin BV" });
  const werkitemId = store.insert("projecten", { orgId, klantId, naam: "Snoeien", teamId, geplandeStart: "2026-08-12", status: "gepland" }) as Id<"projecten">;
  const ctx = createMockCtx(store) as unknown as MutationCtx;
  ctx.storage = { generateUploadUrl: vi.fn(async () => "https://storage.invalid/upload"), getUrl: vi.fn(async () => "https://storage.invalid/photo"), delete: vi.fn() } as unknown as MutationCtx["storage"];
  ctx.db.system = { get: vi.fn(async () => ({ sha256: "qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=", contentType: "image/jpeg", size: 512 })) } as unknown as MutationCtx["db"]["system"];
  const bezoek = { werkitemId, datum: "2026-08-12" };
  const worked = () => store.insert("urenSegmenten", { orgId, medewerkerId, werkitemId, datum: bezoek.datum, categorie: "werken", beginTijd: "08:00", eindTijd: "09:00" });
  return { store, ctx, orgId, otherOrgId, userId, medewerkerId, collegaId, teamId, klantId, bezoek, worked };
}

describe("werkbezoek: gedeelde uitvoering zonder facturatie", () => {
  it("kantoor bewerkt omschrijving/categorie/instructie met conflictaudit zonder planning/klantwijziging", async () => {
    const f = fixture("projectleider");
    f.store.patch(f.bezoek.werkitemId, { updatedAt: 100, uitvoeringCategorie: "onderhoud", uitvoeringsInstructie: "Oud" });
    const save = handler<Visit & { naam: string; categorie?: "aanleg" | "onderhoud"; instructie: string; expectedUpdatedAt: number }, { updatedAt: number }>(wijzigKlusInstructie);
    const input = { ...f.bezoek, naam: "Nieuwe haag", categorie: "aanleg" as const, instructie: "Hek achterom", expectedUpdatedAt: 100 };
    const first = await save(f.ctx, input);
    expect(await save(f.ctx, input)).toEqual(first);
    expect(f.store.get(f.bezoek.werkitemId)).toMatchObject({ naam: "Nieuwe haag", uitvoeringCategorie: "aanleg", uitvoeringsInstructie: "Hek achterom", geplandeStart: f.bezoek.datum, klantId: f.klantId, teamId: f.teamId });
    expect(f.store.getAll("werkbezoekHistorie")).toHaveLength(1);
    await expect(save(f.ctx, { ...input, naam: "Een andere naam" })).rejects.toThrow("intussen gewijzigd");
    f.store.patch(f.userId, { role: "medewerker" });
    await expect(save(f.ctx, { ...input, expectedUpdatedAt: first.updatedAt })).rejects.toThrow("Alleen kantoor");
    f.store.patch(f.userId, { role: "projectleider" });
    f.store.patch(f.bezoek.werkitemId, { orgId: f.otherOrgId });
    await expect(save(f.ctx, input)).rejects.toThrow("niet gevonden");
  });

  it("afronding is idempotent, vereist reden voor onvoltooid en verandert de opdracht niet", async () => {
    const f = fixture();
    await expect(afsluiten(f.ctx, { ...f.bezoek, afgerond: false, sleutel: "one" })).rejects.toThrow("waarom");
    const input = { ...f.bezoek, afgerond: false, reden: "Regen", resterendMinuten: 60, sleutel: "one" };
    const first = await afsluiten(f.ctx, input);
    expect(await afsluiten(f.ctx, input)).toEqual(first);
    expect(f.store.getAll("werkbezoekAntwoorden")).toHaveLength(1);
    expect(f.store.get(f.bezoek.werkitemId)).toMatchObject({ status: "gepland" });
    expect(f.store.getAll("facturen")).toHaveLength(0);
    await expect(afsluiten(f.ctx, { ...input, afgerond: true, sleutel: "two", expectedRevision: 0 })).rejects.toThrow("collega");
    await afsluiten(f.ctx, { ...input, afgerond: true, sleutel: "two", expectedRevision: 1 });
    expect(f.store.getAll("werkbezoekHistorie")).toHaveLength(2);
  });

  it("dagbemanning en tenant zijn bepalend; vast teamlid kan niet langs de override", async () => {
    const f = fixture();
    f.store.insert("teamBemanning", { orgId: f.orgId, teamId: f.teamId, datum: f.bezoek.datum, medewerkerIds: [f.collegaId] });
    await expect(afsluiten(f.ctx, { ...f.bezoek, afgerond: true, sleutel: "one" })).rejects.toThrow("toegewezen");
    f.store.patch(f.bezoek.werkitemId, { orgId: f.otherOrgId });
    await expect(afsluiten(f.ctx, { ...f.bezoek, afgerond: true, sleutel: "one" })).rejects.toThrow("niet gevonden");
  });

  it("delegatie geldt per medewerker en laat de gedeelde ontbrekende informatie zichtbaar", async () => {
    const f = fixture(); f.worked();
    const scope = { orgId: f.orgId, medewerkerId: f.medewerkerId, datum: f.bezoek.datum };
    await expect(assertDagGereed(f.ctx, scope)).rejects.toThrow("foto, afronding, aanhanger");
    for (const onderdeel of ["foto", "afronding", "aanhanger", "afvoer"] as const) await delegeren(f.ctx, { ...f.bezoek, onderdeel, sleutel: onderdeel });
    await expect(assertDagGereed(f.ctx, scope)).resolves.toBeUndefined();
    const result = await dag(f.ctx, { datum: f.bezoek.datum });
    expect(result.gereed).toBe(true);
    expect(result.bezoeken[0]).toMatchObject({ gedeeldGereed: false, ontbreekt: ["foto", "afronding", "aanhanger", "afvoer"] });
    f.store.insert("urenSegmenten", { orgId: f.orgId, medewerkerId: f.collegaId, werkitemId: f.bezoek.werkitemId, datum: f.bezoek.datum, categorie: "werken" });
    await expect(assertDagGereed(f.ctx, { ...scope, medewerkerId: f.collegaId })).rejects.toThrow("Maak de bezoekmelding");
  });

  it("ongewerkte planning blokkeert niet; één foto plus antwoord/retour is voldoende", async () => {
    const f = fixture();
    const scope = { orgId: f.orgId, medewerkerId: f.medewerkerId, datum: f.bezoek.datum };
    await expect(assertDagGereed(f.ctx, scope)).resolves.toBeUndefined();
    f.worked();
    await afsluiten(f.ctx, { ...f.bezoek, afgerond: true, sleutel: "complete" });
    await afvoeren(f.ctx, { ...f.bezoek, keuze: "geen", sleutel: "waste" });
    f.store.insert("werkbezoekFotos", { orgId: f.orgId, ...f.bezoek, fase: "voor", storageId: "storage:one", door: f.userId });
    f.store.insert("aanhangerRetouren", { orgId: f.orgId, datum: f.bezoek.datum, teamId: f.teamId, keuze: "geen_aanhanger" });
    await expect(assertDagGereed(f.ctx, scope)).resolves.toBeUndefined();
  });

  it("houdt foto-only bezoek bij kantoor en uploader zichtbaar na verplaatsen, zonder uren", async () => {
    const f = fixture();
    const ticket = await upload(f.ctx, { ...f.bezoek, sha256: "a".repeat(64) });
    await foto(f.ctx, { ...f.bezoek, fase: "voor", storageId: "storage:voor" as Id<"_storage">, ticketId: ticket.ticketId, sleutel: "voorfoto" });
    f.store.patch(f.bezoek.werkitemId, { geplandeStart: "2026-09-01" });
    expect((await dag(f.ctx, { datum: f.bezoek.datum })).bezoeken).toHaveLength(1);
    f.store.patch(f.userId, { role: "projectleider", linkedMedewerkerId: undefined });
    expect((await kantoorDag(f.ctx, { datum: f.bezoek.datum })).bezoeken).toHaveLength(1);
    f.store.patch(f.userId, { role: "medewerker", linkedMedewerkerId: f.medewerkerId });
    await expect(afsluiten(f.ctx, { ...f.bezoek, afgerond: true, sleutel: "na-verplaatsing" })).resolves.toHaveProperty("id");
  });

  it("houdt afvoer/delegatie-only historie bij kantoor en eigen actor, niet willekeurig ploeglid", async () => {
    for (const soort of ["afvoer", "delegatie"] as const) {
      const f = fixture();
      if (soort === "afvoer") await afvoeren(f.ctx, { ...f.bezoek, keuze: "half", sleutel: "afvoer" });
      else await delegeren(f.ctx, { ...f.bezoek, onderdeel: "foto", sleutel: "delegate" });
      f.store.patch(f.bezoek.werkitemId, { geplandeStart: "2026-09-01" });
      expect((await dag(f.ctx, { datum: f.bezoek.datum })).bezoeken).toHaveLength(1);
      await expect(upload(f.ctx, { ...f.bezoek, sha256: "a".repeat(64) })).resolves.toHaveProperty("ticketId");
      f.store.patch(f.userId, { role: "projectleider", linkedMedewerkerId: undefined });
      expect((await kantoorDag(f.ctx, { datum: f.bezoek.datum })).bezoeken).toHaveLength(1);
    }
    const g = fixture();
    g.store.insert("werkbezoekFotos", { orgId: g.orgId, ...g.bezoek, fase: "na", storageId: "storage:colleague", door: "users:other" });
    g.store.patch(g.bezoek.werkitemId, { geplandeStart: "2026-09-01" });
    expect((await dag(g.ctx, { datum: g.bezoek.datum })).bezoeken).toHaveLength(0);
    await expect(afsluiten(g.ctx, { ...g.bezoek, afgerond: true, sleutel: "not-mine" })).rejects.toThrow("niet toegewezen");
    g.store.patch(g.bezoek.werkitemId, { orgId: g.otherOrgId });
    await expect(upload(g.ctx, { ...g.bezoek, sha256: "a".repeat(64) })).rejects.toThrow("niet gevonden");
  });

  it("bewaart historisch bezoek bij verplaatste planning met echte eigen uren", async () => {
    const f = fixture(); f.worked();
    f.store.patch(f.bezoek.werkitemId, { geplandeStart: "2026-09-01" });
    expect((await dag(f.ctx, { datum: f.bezoek.datum })).bezoeken).toHaveLength(1);
    await expect(afsluiten(f.ctx, { ...f.bezoek, afgerond: true, sleutel: "one" })).resolves.toMatchObject({ revision: 1 });
  });

  it("kantoor ziet alle eigen bedrijfsbezoeken zonder medewerkerkoppeling", async () => {
    const f = fixture("projectleider");
    f.store.patch(f.userId, { linkedMedewerkerId: undefined });
    f.store.insert("projecten", { orgId: f.otherOrgId, naam: "Andere tenant", geplandeStart: f.bezoek.datum });
    expect((await kantoorDag(f.ctx, { datum: f.bezoek.datum })).bezoeken).toHaveLength(1);
    f.store.patch(f.userId, { role: "medewerker" });
    await expect(kantoorDag(f.ctx, { datum: f.bezoek.datum })).rejects.toThrow("Alleen kantoor");
  });

  it("upload koppelt actor/bezoek/hash; herhaalde metadata maakt één foto en één tijdlijn-event", async () => {
    const f = fixture();
    const ticket = await upload(f.ctx, { ...f.bezoek, sha256: "a".repeat(64) });
    const input = { ...f.bezoek, fase: "voor" as const, storageId: "storage:one" as Id<"_storage">, ticketId: ticket.ticketId, sleutel: "photo" };
    const first = await foto(f.ctx, input);
    expect(await foto(f.ctx, input)).toEqual(first);
    expect(await foto(f.ctx, { ...input, sleutel: "photo-again" })).toEqual(first);
    expect(f.store.getAll("klantTijdlijn")).toHaveLength(1);
    expect(f.store.getAll("werkbezoekFotos")).toHaveLength(1);
    expect((await dag(f.ctx, { datum: f.bezoek.datum })).bezoeken[0].fotos).toHaveLength(1);
    await wisFoto(f.ctx, first);
    expect((await dag(f.ctx, { datum: f.bezoek.datum })).bezoeken[0].fotos).toHaveLength(0);
    expect(f.store.getAll("klantTijdlijn")[0].bijlagen).toEqual([]);
    expect(f.ctx.storage.delete).not.toHaveBeenCalled();
  });

  it("weigert andere hash en andermans uploadticket", async () => {
    const f = fixture();
    const ticket = await upload(f.ctx, { ...f.bezoek, sha256: "b".repeat(64) });
    const input = { ...f.bezoek, fase: "na" as const, storageId: "storage:one" as Id<"_storage">, ticketId: ticket.ticketId, sleutel: "photo" };
    await expect(foto(f.ctx, input)).rejects.toThrow("wijkt af");
    f.store.patch(ticket.ticketId, { userId: "users:someone" });
    await expect(foto(f.ctx, input)).rejects.toThrow("account");
    expect(f.store.getAll("werkbezoekFotos")).toHaveLength(0);
  });
  it.each([
    [{ sha256: "a".repeat(64), contentType: "application/octet-stream", size: 512 }, "bestandstype"],
    [{ sha256: "a".repeat(64), contentType: "image/jpeg", size: 16 * 1024 * 1024 }, "15 MB"],
    [{ sha256: "q".repeat(43) + "=", contentType: "image/jpeg", size: 512 }, "wijkt af"],
    [null, "ontbreekt"],
  ])("onderscheidt opslagvalidatiefouten en koppelt geen ongeldige foto (%s)", async (metadata, melding) => {
    const f = fixture();
    const ticket = await upload(f.ctx, { ...f.bezoek, sha256: "a".repeat(64) });
    f.ctx.db.system.get = vi.fn(async () => metadata) as unknown as MutationCtx["db"]["system"]["get"];
    await expect(foto(f.ctx, { ...f.bezoek, fase: "voor", storageId: "storage:ongeldig" as Id<"_storage">, ticketId: ticket.ticketId, sleutel: "ongeldig" })).rejects.toThrow(melding);
    expect(f.store.getAll("werkbezoekFotos")).toHaveLength(0);
    expect(f.store.getAll("klantTijdlijn")).toHaveLength(0);
    expect(f.store.getAll("werkbezoekOpdrachten")).toHaveLength(0);
  });
  it("klusafvoer staat los van retouren; geen standaardprijs en tariefsnapshot per melding", async () => {
    const f = fixture();
    const input = { ...f.bezoek, keuze: "half" as const, sleutel: "afvoer" };
    const first = await afvoeren(f.ctx, input);
    expect(f.store.get(first.id)?.bedragCent).toBeUndefined();
    expect(await afvoeren(f.ctx, input)).toEqual(first);
    await expect(afvoeren(f.ctx, { ...input, sleutel: "other", bedragCent: 500 })).rejects.toThrow("Alleen kantoor");
    expect(f.store.getAll("aanhangerRetouren")).toHaveLength(0);
    expect(f.store.getAll("facturen")).toHaveLength(0);
    f.store.patch(f.userId, { role: "projectleider" });
    await tariefInstellen(f.ctx, { geldigVanaf: "2026-08-01", volTariefCent: 6000 });
    await afvoeren(f.ctx, { ...input, sleutel: "priced", expectedRevision: 1 });
    expect(f.store.get(first.id)).toMatchObject({ bedragCent: 3000, volTariefCent: 6000 });
    await tariefInstellen(f.ctx, { geldigVanaf: "2026-09-01", volTariefCent: 8000 });
    expect(f.store.get(first.id)?.bedragCent).toBe(3000);
    await expect(tariefInstellen(f.ctx, { geldigVanaf: "2026-08-01", volTariefCent: 9000 })).rejects.toThrow("al een tarief");
  });
});

describe("protocollen", () => {
  const input: ProtocolIn = { titel: "Veilig werken", wanneer: "Voor vertrek", stappen: ["Controleer je materiaal"], doelgroepen: ["medewerker"], actief: true };
  it("kantoor beheert versiegeschiedenis en medewerkers zien alleen hun actieve doelgroep", async () => {
    const f = fixture("projectleider");
    const result = await saveProtocol(f.ctx, input);
    await saveProtocol(f.ctx, { ...input, titel: "Voorman", doelgroepen: ["voorman"] });
    f.store.patch(f.userId, { role: "medewerker" });
    expect(await listProtocol(f.ctx, {})).toHaveLength(1);
    await expect(saveProtocol(f.ctx, input)).rejects.toThrow("Geen toegang");
    f.store.patch(f.userId, { role: "projectleider" });
    await expect(archiveProtocol(f.ctx, { id: result.id, expectedRevision: 0 })).rejects.toThrow("gewijzigd");
    await archiveProtocol(f.ctx, { id: result.id, expectedRevision: 1 });
    expect(f.store.getAll("protocolHistorie")).toHaveLength(3);
    f.store.patch(f.userId, { role: "medewerker" });
    expect(await listProtocol(f.ctx, {})).toHaveLength(0);
    await expect(getProtocol(f.ctx, { id: result.id })).rejects.toThrow("niet gevonden");
  });
  it("weigert cross-org beheer en klanttoegang", async () => {
    const f = fixture("directie");
    const result = await saveProtocol(f.ctx, input);
    f.store.patch(result.id, { orgId: f.otherOrgId });
    expect(await listProtocol(f.ctx, {})).toHaveLength(0);
    await expect(saveProtocol(f.ctx, { ...input, id: result.id, expectedRevision: 1 })).rejects.toThrow("niet gevonden");
    f.store.patch(f.userId, { role: "klant" });
    await expect(listProtocol(f.ctx, {})).rejects.toThrow("Geen toegang");
  });
  it("beheert losse noodcontacten inclusief 112, rollen en archiveren", async () => {
    const f = fixture("directie");
    const input = { naam: "Alarmnummer", telefoon: "112", spoed: true, volgorde: 1, actief: true };
    const saved = await saveContact(f.ctx, input);
    await expect(saveContact(f.ctx, { ...input, id: saved.id, expectedRevision: 0 })).rejects.toThrow("gewijzigd");
    f.store.patch(f.userId, { role: "medewerker" });
    expect(await contacten(f.ctx, {})).toHaveLength(1);
    await expect(saveContact(f.ctx, input)).rejects.toThrow("Geen toegang");
    f.store.patch(f.userId, { role: "directie" });
    await archiveContact(f.ctx, { id: saved.id, expectedRevision: 1 });
    f.store.patch(f.userId, { role: "medewerker" });
    expect(await contacten(f.ctx, {})).toHaveLength(0);
  });
});
