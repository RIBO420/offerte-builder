import { afterEach, expect, it, vi } from 'vitest';
import { getPeriode } from '../../../../convex/veldDekking';
import { opslaan, verwerk } from '../../../../convex/veldHerinneringen';
import { MockConvexStore, createMockCtx, seedMockOrganisatie, seedAndereOrganisatie } from '../../helpers/convex-mock';
const handler = (fn: unknown) => (fn as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
function fixture() {
  const store = new MockConvexStore(), orgId = seedMockOrganisatie(store), andereOrg = seedAndereOrganisatie(store);
  const userId = store.insert('users', { orgId, clerkId: 'clerk_test_user_123', role: 'directie', name: 'Kantoor', email: 'kantoor@voorbeeld.test', createdAt: 1 });
  const medewerkerId = store.insert('medewerkers', { orgId, naam: 'Test medewerker', isActief: true });
  return { store, orgId, andereOrg, userId, medewerkerId, ctx: createMockCtx(store) };
}
afterEach(() => vi.useRealTimers());
it('weigert ontvangers van een andere organisatie en veldrollen', async () => {
  const f = fixture();
  const vreemd = f.store.insert('users', { orgId: f.andereOrg, role: 'directie' });
  const args = { actief: true, uurAmsterdam: 18, dagOffset: 0, weekdagen: [1], ontvangerIds: [vreemd] };
  await expect(handler(opslaan)(f.ctx, args)).rejects.toThrow('ontvanger');
  f.store.patch(f.userId, { role: 'medewerker' });
  await expect(handler(opslaan)(f.ctx, { ...args, ontvangerIds: [f.userId] })).rejects.toThrow('kantoor');
  await expect(handler(getPeriode)(f.ctx, { van: '2026-09-07', tot: '2026-09-07' })).rejects.toThrow('kantoor');
});
it('maakt alleen voor open ingevoerde dagen eenmaal een melding, stil zonder uren', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-07T16:15:00Z'));
  const f = fixture();
  await handler(opslaan)(f.ctx, { actief: true, uurAmsterdam: 18, dagOffset: 0, weekdagen: [1], ontvangerIds: [f.userId, f.userId] });
  await handler(verwerk)(f.ctx, {});
  expect(f.store.getAll('notifications')).toHaveLength(0);
  f.store.insert('urenSegmenten', { orgId: f.orgId, medewerkerId: f.medewerkerId, datum: '2026-09-07', categorie: 'loods', beginTijd: '08:00', eindTijd: '09:00', status: 'open' });
  await handler(verwerk)(f.ctx, {}); await handler(verwerk)(f.ctx, {});
  expect(f.store.getAll('notifications')).toHaveLength(1);
  expect(f.store.getAll('notifications')[0]).toMatchObject({ orgId: f.orgId, userId: f.userId, metadata: { route: '/uren', datum: '2026-09-07', openDagen: 1 } });
  expect(f.store.getAll('veldHerinnerRuns')).toHaveLength(1);
});
it('koppelt dekking op werkitem en medewerker en telt afwezigheid afzonderlijk', async () => {
  const f = fixture();
  const ander = f.store.insert('medewerkers', { orgId: f.orgId, naam: 'Collega' });
  const werkitemId = f.store.insert('projecten', { orgId: f.orgId, naam: 'Tuin', status: 'gepland', geplandeStart: '2026-09-07', toegewezenMedewerkerIds: [f.medewerkerId, ander] });
  f.store.insert('urenSegmenten', { orgId: f.orgId, medewerkerId: f.medewerkerId, werkitemId, datum: '2026-09-07', categorie: 'werken', beginTijd: '08:00', eindTijd: '09:00', status: 'ingediend' });
  f.store.insert('urenDagen', { orgId: f.orgId, medewerkerId: f.medewerkerId, datum: '2026-09-07', status: 'ingediend' });
  f.store.insert('afwezigheidsblokken', { orgId: f.orgId, medewerkerId: ander, startDatum: '2026-09-07', eindDatum: '2026-09-07' });
  const rijen = await handler(getPeriode)(f.ctx, { van: '2026-09-07', tot: '2026-09-07' }) as Array<{ medewerkerId: string; status: string; ontbrekendeBezoeken: number; bezoeken: Array<{ gelogd: boolean; afwezig: boolean }> }>;
  expect(rijen.find(r => r.medewerkerId === f.medewerkerId)).toMatchObject({ status: 'ingediend', ontbrekendeBezoeken: 0 });
  expect(rijen.find(r => r.medewerkerId === ander)).toMatchObject({ status: 'niets', ontbrekendeBezoeken: 0, bezoeken: [{ gelogd: false, afwezig: true }] });
});
it.each(['inactief', 'verwijderd'])('slaat oude opt-in van een %s organisatie over', async toestand => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-07T16:15:00Z'));
  const f = fixture();
  await handler(opslaan)(f.ctx, { actief: true, ookEmail: true, uurAmsterdam: 18, dagOffset: 0, weekdagen: [1], ontvangerIds: [f.userId] });
  f.store.insert('urenSegmenten', { orgId: f.orgId, medewerkerId: f.medewerkerId, datum: '2026-09-07', categorie: 'loods', beginTijd: '08:00', eindTijd: '09:00', status: 'open' });
  if (toestand === 'inactief') f.store.patch(f.orgId, { actief: false }); else f.store.delete(f.orgId);
  await handler(verwerk)(f.ctx, {});
  expect(f.store.getAll('notifications')).toHaveLength(0);
  expect(f.store.getAll('veldHerinnerRuns')).toHaveLength(0);
  expect(f.ctx.scheduler.runAfter).not.toHaveBeenCalled();
});
