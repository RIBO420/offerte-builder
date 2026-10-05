/** Herhaalbare Expo-fixture. Alleen de bestaande ontwikkeldeployment. */
import { internalMutation, internalQuery, type MutationCtx } from './_generated/server';
import type { DataModel, Id, TableNames } from './_generated/dataModel';
import type { DocumentByName, WithoutSystemFields } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { teamVanMedewerkerOpDag } from './urenSegmenten';
import { valideerUrenPeriode } from './lib/urenTotalen';
import { fotoHashGelijk } from './lib/fotoHash';
function guard() {
  if (process.env.CONVEX_CLOUD_URL !== 'https://affable-rook-669.convex.cloud') throw new ConvexError('Expo-fixture mag uitsluitend in affable-rook-669 draaien');
}
async function voegToe<T extends TableNames>(ctx: MutationCtx, run: number, tabel: T, doc: WithoutSystemFields<DocumentByName<DataModel, T>>): Promise<Id<T>> {
  const id = await ctx.db.insert(tabel, doc);
  await ctx.db.insert('demoSeed', { tabel, documentId: id, geseedOp: run });
  return id;
}
export const accounts = internalQuery({ args: { naam: v.string() }, handler: async (ctx, args) => {
  guard();
  return (await ctx.db.query('users').collect()).filter(u => u.name === args.naam).map(u => ({ id: u._id, naam: u.name, role: u.role, linkedMedewerkerId: u.linkedMedewerkerId, orgId: u.orgId }));
} });
/** Read-only uploaddiagnose, zonder hashinhoud, opslag-URL of tokens. */
export const fotoControle = internalQuery({ args: { userId: v.id('users'), datum: v.string(), storageId: v.optional(v.id('_storage')) }, handler: async (ctx, args) => {
  guard(); valideerUrenPeriode(args.datum, args.datum);
  const user = await ctx.db.get(args.userId);
  if (!user?.orgId || !user.linkedMedewerkerId) throw new ConvexError('Kies een gekoppeld testaccount');
  const tickets = (await ctx.db.query('werkbezoekUploads').withIndex('by_org_user', q => q.eq('orgId', user.orgId!).eq('userId', user._id)).collect()).filter(t => t.datum === args.datum).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const recent = await ctx.db.system.query('_storage').order('desc').take(50);
  return Promise.all(tickets.map(async ticket => {
    const item = await ctx.db.get(ticket.werkitemId);
    if (!item || item.orgId !== user.orgId || item.naam !== `Expo integratietest · ${args.datum}` || !item.toegewezenMedewerkerIds?.includes(user.linkedMedewerkerId!)) return { fixture: false };
    const metadata = ticket.storageId || args.storageId ? await ctx.db.system.get(ticket.storageId ?? args.storageId!) : recent.find(m => fotoHashGelijk(m.sha256, ticket.sha256));
    return { fixture: true, ticketId: ticket._id, createdAt: ticket.createdAt, gekoppeld: !!ticket.storageId, metadataGevonden: !!metadata, hashGelijk: metadata ? metadata.sha256 === ticket.sha256 : null, genormaliseerdeHashGelijk: metadata ? fotoHashGelijk(metadata.sha256, ticket.sha256) : null, ticketHashLengte: ticket.sha256.length, opslagHashLengte: metadata?.sha256.length ?? null, size: metadata?.size ?? null, contentType: metadata?.contentType ?? null };
  }));
} });
export const controle = internalQuery({ args: { userId: v.id('users'), datum: v.string() }, handler: async (ctx, args) => {
  guard(); valideerUrenPeriode(args.datum, args.datum);
  const user = await ctx.db.get(args.userId);
  if (!user?.orgId || !user.linkedMedewerkerId) throw new ConvexError('Kies een gekoppeld testaccount');
  const orgId = user.orgId;
  const [retouren, segmenten, bezoeken] = await Promise.all([
    ctx.db.query('aanhangerRetouren').withIndex('by_org_datum', q => q.eq('orgId', orgId).eq('datum', args.datum)).collect(),
    ctx.db.query('urenSegmenten').withIndex('by_org_datum', q => q.eq('orgId', orgId).eq('datum', args.datum)).collect(),
    ctx.db.query('werkbezoekAntwoorden').withIndex('by_org_datum', q => q.eq('orgId', orgId).eq('datum', args.datum)).collect(),
  ]);
  return { orgId, retouren: retouren.map(r => ({ keuze: r.keuze, datum: r.datum, revision: r.revision })), segmenten: segmenten.filter(s => s.medewerkerId === user.linkedMedewerkerId).map(s => ({ begin: s.beginTijd, eind: s.eindTijd, categorie: s.categorie, status: s.status })), bezoeken: bezoeken.map(b => ({ werkitemId: b.werkitemId, af: b.afgerond })) };
} });
export const maak = internalMutation({ args: { userId: v.id('users'), datum: v.string() }, handler: async (ctx, args) => {
  guard(); valideerUrenPeriode(args.datum, args.datum);
  const user = await ctx.db.get(args.userId);
  if (!user?.orgId || !user.linkedMedewerkerId) throw new ConvexError('Kies een bestaand gekoppeld testaccount');
  const orgId = user.orgId, medewerkerId = user.linkedMedewerkerId;
  const medewerker = await ctx.db.get(medewerkerId);
  if (!medewerker || medewerker.orgId !== orgId) throw new ConvexError('Medewerker hoort niet bij deze testorganisatie');
  const naam = `Expo integratietest · ${args.datum}`;
  const bestaand = (await ctx.db.query('projecten').withIndex('by_org', q => q.eq('orgId', orgId)).collect()).find(p => p.naam === naam && p.toegewezenMedewerkerIds?.includes(medewerkerId));
  if (bestaand) return { werkitemId: bestaand._id, klantId: bestaand.klantId, teamId: bestaand.teamId, bestaat: true };
  const run = Date.now();
  const bestaandTeam = await teamVanMedewerkerOpDag(ctx.db, orgId, medewerkerId, args.datum);
  const teamId = bestaandTeam?._id ?? await voegToe(ctx, run, 'teams', { orgId, naam: 'Expo testploeg', leden: [medewerkerId], isActief: true, kleur: '#4ADE80', createdAt: run, updatedAt: run });
  const klantId = await voegToe(ctx, run, 'klanten', { orgId, naam: 'Expo testtuin', adres: 'Teststraat 1', postcode: '1234 AB', plaats: 'Testdorp', email: 'expo@voorbeeld.test', createdAt: run, updatedAt: run });
  const voertuigId = await voegToe(ctx, run, 'voertuigen', { orgId, kenteken: 'EXPO-TEST', merk: 'Test', model: 'Aanhanger', type: 'aanhanger', status: 'actief', createdAt: run, updatedAt: run });
  const werkitemId = await voegToe(ctx, run, 'projecten', { orgId, type: 'project', naam, klantId, teamId, status: 'gepland', urenBron: 'segmenten', geplandeStart: args.datum, geplandeEind: args.datum, geplandeStartTijd: '08:00', geplandeEindTijd: '10:00', duurOverrideMinuten: 120, volgordeBinnenDag: 1, toegewezenMedewerkerIds: [medewerkerId], toegewezenVoertuigen: [voertuigId], uitvoeringsInstructie: 'Testdag: voorstel, foto, klusmelding, afvoer en aanhangerretour. Deze gegevens zijn uitsluitend voor Expo-testen.', createdAt: run, updatedAt: run });
  await voegToe(ctx, run, 'middelReserveringen', { orgId, middelType: 'voertuig', voertuigId, middelSleutel: `voertuig:${voertuigId}`, werkitemId, datum: args.datum, createdAt: run });
  await voegToe(ctx, run, 'protocollen', { orgId, titel: 'Expo — app gebruiken', wanneer: 'Tijdens de integratietest', stappen: ['Controleer je planning.', 'Registreer de uitvoering en de retourvulling.', 'Wacht tot de wachtrij leeg is en dien daarna de dag in.'], doelgroepen: [], actief: true, revision: 1, door: user._id, createdAt: run, updatedAt: run });
  return { werkitemId, klantId, voertuigId, teamId, geseedOp: run, bestaat: false };
} });
