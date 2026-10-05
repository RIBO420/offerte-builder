import { describe, expect, it } from "vitest";
import type { MutationCtx } from "../../../../convex/_generated/server";
import type { Id } from "../../../../convex/_generated/dataModel";
import { meld, getDag, getOverzicht, getHistorie } from "../../../../convex/aanhangerRetouren";
import { MockConvexStore, createMockCtx, createMockUser, seedMockOrganisatie, seedAndereOrganisatie } from "../../helpers/convex-mock";

const meldHandler = (meld as unknown as { _handler: (ctx: MutationCtx, args: Args) => Promise<{ id: Id<"aanhangerRetouren">; revision: number; replayed: boolean }> })._handler;
type Args = { retourId: string; datum: string; teamId?: Id<"teams">; verantwoordelijkeMedewerkerId?: Id<"medewerkers">; voertuigId?: Id<"voertuigen">; keuze: "geen_aanhanger" | "leeg" | "kwart" | "half" | "driekwart" | "vol"; waargenomenOp: number; idempotencyKey: string; expectedRevision?: number; correctieReden?: string; notitie?: string };
function handler<A, R>(fn: unknown) { return (fn as { _handler: (ctx: MutationCtx, args: A) => Promise<R> })._handler; }
const dagHandler = handler<{ datum: string; teamId?: Id<"teams"> }, { retouren: Array<{ retourId: string; keuze: string; gemeldDoorNaam: string }>; aanhangers: Array<{ _id: string }>; preselectedVoertuigId: string | null }>(getDag);
const overzichtHandler = handler<{ datum: string }, unknown[]>(getOverzicht);
const historieHandler = handler<{ retourId: string }, Array<{ revision: number; reden: string; voor?: string }>>(getHistorie);

function fixture(role = "medewerker") {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const anderOrgId = seedAndereOrganisatie(store);
  const medewerkerId = store.insert("medewerkers", { orgId, naam: "Sam", isActief: true }) as Id<"medewerkers">;
  const collegaId = store.insert("medewerkers", { orgId, naam: "Kim", isActief: true }) as Id<"medewerkers">;
  const userId = store.insert("users", createMockUser({ role, orgId, linkedMedewerkerId: medewerkerId }));
  const teamId = store.insert("teams", { orgId, naam: "Groen", leden: [medewerkerId, collegaId], isActief: true }) as Id<"teams">;
  const voertuigId = store.insert("voertuigen", { orgId, type: "aanhanger", merk: "Hapert", model: "Cobalt", kenteken: "XX-12-XX", status: "actief" }) as Id<"voertuigen">;
  const ctx = createMockCtx(store) as unknown as MutationCtx;
  const args: Args = { retourId: "ploeg-retour-1", datum: "2026-08-12", teamId, voertuigId, keuze: "half", waargenomenOp: Date.parse("2026-08-12T15:00:00Z"), idempotencyKey: "command-1" };
  return { store, ctx, orgId, anderOrgId, medewerkerId, collegaId, userId, teamId, voertuigId, args };
}

describe("fysieke aanhangerretouren", () => {
  it.each(["geen_aanhanger", "leeg", "kwart", "half", "driekwart", "vol"] as const)("bewaart keuze %s zonder kosten of factuur", async keuze => {
    const f = fixture();
    const result = await meldHandler(f.ctx, { ...f.args, keuze, voertuigId: keuze === "geen_aanhanger" ? undefined : f.voertuigId });
    expect(f.store.get(result.id)).toMatchObject({ keuze, revision: 1, gemeldDoor: f.userId, verantwoordelijkeMedewerkerId: f.medewerkerId });
    expect(f.store.getAll("aanhangerRetourHistorie")).toHaveLength(1);
    expect(f.store.getAll("facturen")).toHaveLength(0);
    expect(f.store.getAll("voorraadMutaties")).toHaveLength(0);
  });

  it("maakt replay idempotent en weigert een hergebruikte sleutel met andere inhoud", async () => {
    const f = fixture();
    const first = await meldHandler(f.ctx, f.args);
    expect(await meldHandler(f.ctx, f.args)).toEqual({ ...first, replayed: true });
    await expect(meldHandler(f.ctx, { ...f.args, keuze: "vol" })).rejects.toThrow("opdrachtsleutel");
    expect(f.store.getAll("aanhangerRetouren")).toHaveLength(1);
    expect(f.store.getAll("aanhangerRetourHistorie")).toHaveLength(1);
  });

  it("deelt één retour met collega en bewaart de oorspronkelijke melder bij correctie", async () => {
    const f = fixture();
    await meldHandler(f.ctx, f.args);
    f.store.patch(f.userId, { clerkId: "original-reporter" });
    const collegaUserId = f.store.insert("users", createMockUser({ role: "medewerker", orgId: f.orgId, linkedMedewerkerId: f.collegaId, name: "Kim" }));
    const dag = await dagHandler(f.ctx, { datum: f.args.datum });
    expect(dag.retouren).toHaveLength(1);
    const changed = await meldHandler(f.ctx, { ...f.args, keuze: "vol", expectedRevision: 1, idempotencyKey: "command-2", correctieReden: "Vulling opnieuw bekeken" });
    expect(changed.revision).toBe(2);
    expect(f.store.get(changed.id)).toMatchObject({ gemeldDoor: f.userId, laatstGewijzigdDoor: collegaUserId });
    const history = await historieHandler(f.ctx, { retourId: f.args.retourId });
    expect(history).toHaveLength(2);
    expect(JSON.parse(history[1].voor!)).toMatchObject({ keuze: "half", revision: 1, gemeldDoor: f.userId });
  });

  it("weigert verouderde revisie en een correctie zonder reden", async () => {
    const f = fixture();
    await meldHandler(f.ctx, f.args);
    await expect(meldHandler(f.ctx, { ...f.args, expectedRevision: 0, idempotencyKey: "next", correctieReden: "Fout" })).rejects.toThrow("intussen gewijzigd");
    await expect(meldHandler(f.ctx, { ...f.args, expectedRevision: 1, idempotencyKey: "next" })).rejects.toThrow("reden");
    expect(f.store.getAll("aanhangerRetourHistorie")).toHaveLength(1);
  });

  it("onderscheidt meerdere retouren en laat melden na uren indienen toe", async () => {
    const f = fixture();
    f.store.insert("urenDagen", { orgId: f.orgId, medewerkerId: f.medewerkerId, datum: f.args.datum, status: "ingediend" });
    await meldHandler(f.ctx, f.args);
    await meldHandler(f.ctx, { ...f.args, retourId: "ploeg-retour-2", idempotencyKey: "next", keuze: "leeg" });
    expect((await dagHandler(f.ctx, { datum: f.args.datum })).retouren).toHaveLength(2);
  });

  it("dagbemanning wint van vaste leden, ook voor verantwoordelijke en gelezen historie", async () => {
    const f = fixture();
    await meldHandler(f.ctx, f.args);
    f.store.insert("teamBemanning", { orgId: f.orgId, teamId: f.teamId, datum: f.args.datum, medewerkerIds: [f.collegaId] });
    await expect(meldHandler(f.ctx, { ...f.args, retourId: "next", verantwoordelijkeMedewerkerId: f.collegaId })).rejects.toThrow("eigen ploeg");
    await expect(dagHandler(f.ctx, { datum: f.args.datum, teamId: f.teamId })).rejects.toThrow("Geen toegang");
    await expect(historieHandler(f.ctx, { retourId: f.args.retourId })).rejects.toThrow("verantwoordelijke");
  });

  it("valideert fysiek voertuig, tenant, geen-aanhanger en datum", async () => {
    const f = fixture();
    const vreemd = f.store.insert("voertuigen", { orgId: f.anderOrgId, type: "aanhanger" }) as Id<"voertuigen">;
    await expect(meldHandler(f.ctx, { ...f.args, voertuigId: vreemd })).rejects.toThrow("eigen bedrijf");
    await expect(meldHandler(f.ctx, { ...f.args, voertuigId: undefined })).rejects.toThrow("Selecteer");
    await expect(meldHandler(f.ctx, { ...f.args, keuze: "geen_aanhanger" })).rejects.toThrow("Geen aanhanger");
    await expect(meldHandler(f.ctx, { ...f.args, datum: "2026-02-30" })).rejects.toThrow("Ongeldige datum");
    await expect(meldHandler(f.ctx, { ...f.args, datum: "2026-08-13" })).rejects.toThrow("werkdag");
    f.store.patch(f.voertuigId, { type: "bus" });
    await expect(meldHandler(f.ctx, f.args)).rejects.toThrow("Selecteer");
  });

  it("kantooroverzicht is tenantgebonden en niet toegankelijk voor medewerkers/klanten", async () => {
    const f = fixture("projectleider");
    await meldHandler(f.ctx, f.args);
    f.store.insert("aanhangerRetouren", { orgId: f.anderOrgId, datum: f.args.datum, retourId: "foreign", waargenomenOp: 0 });
    expect(await overzichtHandler(f.ctx, { datum: f.args.datum })).toHaveLength(1);
    f.store.patch(f.userId, { role: "medewerker" });
    await expect(overzichtHandler(f.ctx, { datum: f.args.datum })).rejects.toThrow("Alleen kantoor");
    f.store.patch(f.userId, { role: "klant" });
    await expect(meldHandler(f.ctx, f.args)).rejects.toThrow("alleen voor medewerkers");
  });

  it("kan niet andermans soloretour wijzigen of een gedeelde sleutel naar andere scope verplaatsen", async () => {
    const f = fixture();
    await expect(meldHandler(f.ctx, { ...f.args, teamId: undefined, verantwoordelijkeMedewerkerId: f.collegaId })).rejects.toThrow("eigen retour");
    await meldHandler(f.ctx, f.args);
    await expect(meldHandler(f.ctx, { ...f.args, teamId: undefined, expectedRevision: 1, idempotencyKey: "next", correctieReden: "Fout" })).rejects.toThrow("andere dag");
  });

  it("voorselectie gebruikt alleen reserveringen voor de eigen ploeg", async () => {
    const f = fixture();
    f.store.insert("voertuigen", { orgId: f.orgId, type: "aanhanger", merk: "Ander", model: "A", kenteken: "YY", status: "actief" });
    const werkitemId = f.store.insert("projecten", { orgId: f.orgId, teamId: f.teamId });
    f.store.insert("middelReserveringen", { orgId: f.orgId, datum: f.args.datum, werkitemId, voertuigId: f.voertuigId });
    expect((await dagHandler(f.ctx, { datum: f.args.datum })).preselectedVoertuigId).toBe(f.voertuigId);
    expect((await dagHandler(f.ctx, { datum: f.args.datum })).retouren).toHaveLength(0);
  });
});
