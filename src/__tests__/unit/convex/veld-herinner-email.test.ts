import { afterEach, expect, it, vi } from 'vitest';
import { verstuur, leesOpdracht, registreer } from '../../../../convex/veldHerinnerEmail';
import { MockConvexStore, createMockCtx, seedMockOrganisatie, seedAndereOrganisatie } from '../../helpers/convex-mock';
const handler = (fn: unknown) => (fn as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('doet geen externe call wanneer mailverzending uitstaat', async () => {
  vi.stubEnv('EMAIL_VERZENDEN_ACTIEF', 'false'); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const ctx = { runQuery: vi.fn().mockResolvedValue({ ontvangers: ['test@voorbeeld.test'], onderwerp: 'Test', tekst: 'Test' }), runMutation: vi.fn() };
  await handler(verstuur)(ctx, { runId: 'run' });
  expect(fetcher).not.toHaveBeenCalled(); expect(ctx.runMutation.mock.calls[0][1]).toMatchObject({ status: 'onderdrukt' });
});
it('stuurt één samenvatting met provider-idempotentie en registreert succes', async () => {
  vi.stubEnv('EMAIL_VERZENDEN_ACTIEF', 'true'); vi.stubEnv('RESEND_API_KEY', 'fake-key'); vi.stubEnv('RESEND_FROM_EMAIL', 'test@voorbeeld.test');
  const fetcher = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', fetcher);
  const ctx = { runQuery: vi.fn().mockResolvedValue({ ontvangers: ['kantoor@voorbeeld.test'], onderwerp: 'Test', tekst: 'Samenvatting' }), runMutation: vi.fn() };
  await handler(verstuur)(ctx, { runId: 'run' });
  expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toBe('velduren-run');
  expect(ctx.runMutation.mock.calls[0][1]).toMatchObject({ status: 'verzonden' });
});
it('verstuurt geen ingeplande mail nadat de actuele opdracht vervallen is', async () => {
  vi.stubEnv('EMAIL_VERZENDEN_ACTIEF', 'true'); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const ctx = { runQuery: vi.fn().mockResolvedValue(null), runMutation: vi.fn() };
  await handler(verstuur)(ctx, { runId: 'run' });
  expect(fetcher).not.toHaveBeenCalled();
  expect(ctx.runMutation.mock.calls[0][1]).toMatchObject({ status: 'onderdrukt' });
});
it('bewaart de afgeronde zendstatus bij een herhaalde uitvoering', async () => {
  const store = new MockConvexStore(), orgId = seedMockOrganisatie(store);
  const runId = store.insert('veldHerinnerRuns', { orgId, datum: '2026-09-12', emailStatus: 'verzonden' });
  const ctx = createMockCtx(store);
  expect(await handler(leesOpdracht)(ctx, { runId })).toBeNull();
  await handler(registreer)(ctx, { runId, status: 'onderdrukt', fout: 'Herhaalde uitvoering' });
  expect(store.get(runId)).toMatchObject({ emailStatus: 'verzonden' });
});
it('verwijdert oude, buitenlandse en niet-kantoorontvangers vóór verzending', async () => {
  const store = new MockConvexStore(), orgId = seedMockOrganisatie(store), ander = seedAndereOrganisatie(store);
  const a = store.insert('users', { orgId, role: 'directie', email: 'kantoor@voorbeeld.test' });
  const b = store.insert('users', { orgId: ander, role: 'directie', email: 'vreemd@voorbeeld.test' });
  const c = store.insert('users', { orgId, role: 'medewerker', email: 'worker@voorbeeld.test' });
  const medewerkerId = store.insert('medewerkers', { orgId, naam: 'Test', isActief: true });
  const config = store.insert('veldHerinnerInstellingen', { orgId, actief: true, ookEmail: true, ontvangerIds: [a, b, c] });
  const runId = store.insert('veldHerinnerRuns', { orgId, datum: '2026-09-12', emailStatus: 'gepland' });
  store.insert('urenSegmenten', { orgId, medewerkerId, datum: '2026-09-12', categorie: 'loods', beginTijd: '08:00', eindTijd: '09:00', status: 'open' });
  const ctx = createMockCtx(store);
  expect(await handler(leesOpdracht)(ctx, { runId })).toMatchObject({ ontvangers: ['kantoor@voorbeeld.test'] });
  store.patch(orgId, { actief: false }); expect(await handler(leesOpdracht)(ctx, { runId })).toBeNull();
  store.patch(orgId, { actief: true });
  store.patch(config, { ookEmail: false }); expect(await handler(leesOpdracht)(ctx, { runId })).toBeNull();
  store.patch(config, { ookEmail: true });
  store.patch(config, { actief: false }); expect(await handler(leesOpdracht)(ctx, { runId })).toBeNull();
});
