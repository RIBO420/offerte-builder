import { describe, expect, it } from 'vitest';
import type { MutationCtx } from '../../../../convex/_generated/server';
import type { Id } from '../../../../convex/_generated/dataModel';
import { wijzigKlusInstructie } from '../../../../convex/werkbezoek';
import { MockConvexStore, createMockCtx, createMockUser, seedMockOrganisatie, seedAndereOrganisatie } from '../../helpers/convex-mock';

type Args = { werkitemId: Id<'projecten'>; datum: string; naam: string; instructie: string; expectedUpdatedAt: number; klantId?: Id<'klanten'>; adres?: string | null };
const save = (wijzigKlusInstructie as unknown as { _handler: (ctx: MutationCtx, args: Args) => Promise<{ updatedAt: number }> })._handler;
function fixture(role = 'projectleider') {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store), otherOrgId = seedAndereOrganisatie(store);
  const userId = store.insert('users', createMockUser({ orgId, role }));
  const klantId = store.insert('klanten', { orgId, naam: 'Oorspronkelijke klant' }) as Id<'klanten'>;
  const nieuweKlantId = store.insert('klanten', { orgId, naam: 'Nieuwe klant' }) as Id<'klanten'>;
  const werkitemId = store.insert('projecten', { orgId, klantId, naam: 'Snoeien', status: 'gepland', adres: 'Oude locatie', updatedAt: 100, geplandeStart: '2026-09-12' }) as Id<'projecten'>;
  const args: Args = { werkitemId, datum: '2026-09-12', naam: 'Snoeien', instructie: '', expectedUpdatedAt: 100 };
  return { store, orgId, otherOrgId, userId, klantId, nieuweKlantId, args, ctx: createMockCtx(store) as unknown as MutationCtx };
}

describe('kantoor wijzigt eigen klusklant en uitvoerlocatie', () => {
  it('wijzigt vóór uitvoering de eigen klant, wist het oude adres en bewaart een voor/na-audit', async () => {
    const f = fixture();
    const input = { ...f.args, klantId: f.nieuweKlantId };
    const result = await save(f.ctx, input);
    expect(f.store.get(f.args.werkitemId)).toMatchObject({ klantId: f.nieuweKlantId, geplandeStart: f.args.datum, status: 'gepland' });
    expect(f.store.get(f.args.werkitemId)?.adres).toBeUndefined();
    const audit = f.store.getAll('werkbezoekHistorie');
    expect(audit).toHaveLength(1);
    expect(JSON.parse(audit[0].voor as string)).toMatchObject({ klantId: f.klantId, adres: 'Oude locatie' });
    expect(JSON.parse(audit[0].na as string)).toMatchObject({ klantId: f.nieuweKlantId });
    expect(await save(f.ctx, input)).toEqual(result);
    expect(f.store.getAll('werkbezoekHistorie')).toHaveLength(1);
    expect(f.store.getAll('facturen')).toHaveLength(0);
  });
  it('kan een eigen locatie vastleggen en terugkeren naar het klantadres', async () => {
    const f = fixture();
    const first = await save(f.ctx, { ...f.args, adres: '  Nieuwe weg 2, Utrecht  ' });
    expect(f.store.get(f.args.werkitemId)).toMatchObject({ adres: 'Nieuwe weg 2, Utrecht', klantId: f.klantId });
    await save(f.ctx, { ...f.args, expectedUpdatedAt: first.updatedAt, adres: null });
    expect(f.store.get(f.args.werkitemId)?.adres).toBeUndefined();
  });
  it('weigert vreemde of gearchiveerde klanten en veldrollen', async () => {
    for (const patch of [{ orgId: 'foreign' }, { isArchived: true }, { pipelineStatus: 'lead' }]) {
      const f = fixture();
      f.store.patch(f.nieuweKlantId, patch.orgId ? { orgId: f.otherOrgId } : patch);
      await expect(save(f.ctx, { ...f.args, klantId: f.nieuweKlantId })).rejects.toThrow('actieve klant');
      expect(f.store.getAll('werkbezoekHistorie')).toHaveLength(0);
    }
    const worker = fixture('medewerker');
    await expect(save(worker.ctx, { ...worker.args, klantId: worker.nieuweKlantId })).rejects.toThrow();
  });
  it.each(['urenSegmenten', 'urenRegistraties', 'machineGebruik', 'werkbezoekFotos', 'werkbezoekAntwoorden', 'werkbezoekAfvoer', 'werkbezoekDelegaties', 'materiaalChecks', 'nacalculaties', 'meerwerk', 'projectKosten'])(
    'beschermt klant en locatie zodra %s bewijs bevat, zonder het bewijs te veranderen', async table => {
      const f = fixture();
      f.store.insert(table, { orgId: f.orgId, werkitemId: f.args.werkitemId, projectId: f.args.werkitemId, datum: f.args.datum });
      const before = JSON.stringify(f.store.getAll(table));
      await expect(save(f.ctx, { ...f.args, klantId: f.nieuweKlantId })).rejects.toThrow('uitvoeringshistorie');
      await expect(save(f.ctx, { ...f.args, adres: 'Andere locatie' })).rejects.toThrow('uitvoeringshistorie');
      expect(JSON.stringify(f.store.getAll(table))).toBe(before);
      await save(f.ctx, { ...f.args, naam: 'Duidelijker omschreven', instructie: 'Achterom' });
      expect(f.store.get(f.args.werkitemId)).toMatchObject({ klantId: f.klantId, adres: 'Oude locatie', naam: 'Duidelijker omschreven' });
    });
  it.each(['offerteId', 'contractId', 'contractWerkzaamheidId', 'factuurId'])('houdt klant vast bij financiële koppeling %s', async field => {
    const f = fixture(); f.store.patch(f.args.werkitemId, { [field]: 'linked:record' });
    await expect(save(f.ctx, { ...f.args, klantId: f.nieuweKlantId })).rejects.toThrow('gekoppelde');
    if (field === 'factuurId') await expect(save(f.ctx, { ...f.args, adres: 'Andere locatie' })).rejects.toThrow('gefactureerde');
    else await expect(save(f.ctx, { ...f.args, adres: 'Andere locatie' })).resolves.toHaveProperty('updatedAt');
  });
  it('beschermt ook een gekoppelde factuur wanneer het project zelf geen factuurId bevat', async () => {
    const f = fixture(); f.store.insert('facturen', { orgId: f.orgId, projectId: f.args.werkitemId });
    await expect(save(f.ctx, { ...f.args, klantId: f.nieuweKlantId })).rejects.toThrow('gekoppelde');
    await expect(save(f.ctx, { ...f.args, adres: 'Andere locatie' })).rejects.toThrow('gefactureerde');
  });
  it('weigert gelijktijdige wijziging en ongeldige locatie voordat er een audit wordt geschreven', async () => {
    const f = fixture();
    await expect(save(f.ctx, { ...f.args, expectedUpdatedAt: 99, adres: 'Andere locatie' })).rejects.toThrow('intussen gewijzigd');
    await expect(save(f.ctx, { ...f.args, adres: 'x'.repeat(501) })).rejects.toThrow('maximaal 500');
    await expect(save(f.ctx, { ...f.args, adres: 'Nieuwe\nregel' })).rejects.toThrow('één regel');
    expect(f.store.getAll('werkbezoekHistorie')).toHaveLength(0);
  });
});
