import { expect, it } from 'vitest';
import { add, importBatch, update, remove } from '../../../../convex/urenRegistraties';
import { MockConvexStore, createMockCtx, seedMockOrganisatie } from '../../helpers/convex-mock';
const handler = (fn: unknown) => (fn as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
it('laat een medewerker de dagvergrendeling niet via legacy projecturen omzeilen', async () => {
  const store = new MockConvexStore(), orgId = seedMockOrganisatie(store);
  store.insert('users', { orgId, clerkId: 'clerk_test_user_123', role: 'medewerker', name: 'Medewerker' });
  const ctx = createMockCtx(store);
  for (const fn of [add, importBatch, update, remove]) await expect(handler(fn)(ctx, {})).rejects.toThrow();
  expect(store.getAll('urenRegistraties')).toHaveLength(0);
});
it('behoudt kantoorregistratie en de organisatiegrens', async () => {
  const store = new MockConvexStore(), orgId = seedMockOrganisatie(store);
  store.insert('users', { orgId, clerkId: 'clerk_test_user_123', role: 'projectleider', name: 'Kantoor' });
  const projectId = store.insert('projecten', { orgId, naam: 'Test' });
  const ctx = createMockCtx(store);
  await handler(add)(ctx, { projectId, datum: '2026-09-12', medewerker: 'Historische kracht', uren: 2 });
  expect(store.getAll('urenRegistraties')).toHaveLength(1);
  store.patch(projectId, { orgId: 'andere_org' });
  await expect(handler(add)(ctx, { projectId, datum: '2026-09-12', medewerker: 'Historische kracht', uren: 2 })).rejects.toThrow();
});
