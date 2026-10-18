import { describe, expect, it } from 'vitest';
import { VeldOutbox, outboxSleutel, type VeldOpdracht } from '../../../../mobile/lib/veld-outbox-core';
const rij = (id: string): VeldOpdracht => ({ id, type: 'retour', payload: { idempotencyKey: id }, status: 'wacht', aangemaaktOp: 1 });
function maak() {
  const data = new Map<string, string>();
  const storage = { getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => { data.set(k, v); } };
  return { storage, box: new VeldOutbox(storage, outboxSleutel('org', 'user')) };
}
describe('veldoutbox', () => {
  it('herstelt een mislukte foto zonder bestand/payload/sleutel opnieuw te maken', async () => {
    const { box } = maak();
    const foto: VeldOpdracht = { id: 'foto-1', type: 'foto', payload: { localUri: 'file:///document/foto-1.jpg', sleutel: 'stabiel', datum: '2026-09-12' }, status: 'conflict', fout: 'Oude native uploadfout', aangemaaktOp: 1 };
    await box.voegToe(foto); await box.probeerOpnieuw(foto.id);
    expect(await box.lees()).toEqual([{ ...foto, status: 'wacht', fout: undefined }]);
    const uitgevoerd: VeldOpdracht[] = [];
    await box.verwerk({ online: () => true, juisteSessie: () => true, uitvoeren: async r => { uitgevoerd.push(r); }, classificeer: () => 'conflict' as const });
    expect(uitgevoerd[0].payload).toEqual(foto.payload); expect(await box.lees()).toEqual([]);
  });
  it('isoleert organisatie en gebruiker en overleeft herstart', async () => {
    const { box, storage } = maak(); await box.voegToe(rij('a'));
    expect(await new VeldOutbox(storage, outboxSleutel('org', 'user')).lees()).toHaveLength(1);
    expect(await new VeldOutbox(storage, outboxSleutel('ander', 'user')).lees()).toEqual([]);
    expect(await new VeldOutbox(storage, outboxSleutel('org', 'ander')).lees()).toEqual([]);
  });
  it('verwerkt FIFO eenmaal bij gelijktijdige reconnects', async () => {
    const { box } = maak(); await Promise.all([box.voegToe(rij('a')), box.voegToe(rij('b'))]);
    const gedaan: string[] = [];
    const opties = { online: () => true, juisteSessie: () => true, uitvoeren: async (r: VeldOpdracht) => { gedaan.push(r.id); }, classificeer: () => 'conflict' as const };
    await Promise.all([box.verwerk(opties), box.verwerk(opties)]);
    expect(gedaan).toEqual(['a', 'b']); expect(await box.lees()).toEqual([]);
  });
  it('bewaart een afwijzing zichtbaar als conflict zonder volgende opdrachten te blokkeren', async () => {
    const { box } = maak(); await box.voegToe(rij('a')); await box.voegToe(rij('b'));
    const gedaan: string[] = [];
    await box.verwerk({ online: () => true, juisteSessie: () => true, uitvoeren: async r => { gedaan.push(r.id); if (r.id === 'a') throw new Error('Dag ingediend'); }, classificeer: () => 'conflict' as const });
    expect(gedaan).toEqual(['a', 'b']);
    expect(await box.lees()).toMatchObject([{ id: 'a', status: 'conflict', fout: 'Dag ingediend' }]);
  });
  it('houdt bij een tijdelijke serverfout de volgorde vast en wacht de backoff af', async () => {
    const { box } = maak(); await box.voegToe(rij('a')); await box.voegToe(rij('b'));
    let nu = 1_000; const gedaan: string[] = [];
    const opties = { online: () => true, juisteSessie: () => true, nu: () => nu, classificeer: () => 'tijdelijk' as const,
      uitvoeren: async (r: VeldOpdracht) => { gedaan.push(r.id); if (nu < 40_000) throw new Error('503'); } };
    await box.verwerk(opties);
    expect(gedaan).toEqual(['a']);
    expect(await box.lees()).toMatchObject([{ id: 'a', status: 'wacht', pogingen: 1, volgendePogingOp: 31_000 }, { id: 'b', status: 'wacht' }]);
    nu = 20_000; await box.verwerk(opties); expect(gedaan).toEqual(['a']);
    nu = 40_000; await box.verwerk(opties); expect(gedaan).toEqual(['a', 'a', 'b']);
    expect(await box.lees()).toEqual([]);
  });
  it('verliest geen opdracht bij netwerkfout of sessiewissel tijdens verzending', async () => {
    const { box } = maak(); await box.voegToe(rij('a'));
    await box.verwerk({ online: () => true, juisteSessie: () => true, uitvoeren: async () => { throw new Error('offline'); }, classificeer: () => 'netwerk' as const });
    expect((await box.lees())[0].status).toBe('wacht');
    let huidig = true;
    await box.verwerk({ online: () => true, juisteSessie: () => huidig, uitvoeren: async () => { huidig = false; }, classificeer: () => 'conflict' as const });
    expect(await box.lees()).toHaveLength(1);
  });
  it('weigert gewijzigde inhoud onder dezelfde id en meldt opslagfouten', async () => {
    const { box } = maak(); await box.voegToe(rij('a'));
    await expect(box.voegToe({ ...rij('a'), payload: { anders: true } })).rejects.toThrow();
    const stuk = new VeldOutbox({ getItem: async () => null, setItem: async () => { throw new Error('Vol'); } }, 'x');
    await expect(stuk.voegToe(rij('a'))).rejects.toThrow('Vol');
  });
});

it('kan nieuwe invoer duurzaam bewaren terwijl een eerdere verzending nog wacht', async () => {
  const { box } = maak(); await box.voegToe(rij('a'));
  let los!: () => void;
  const wacht = new Promise<void>(resolve => { los = resolve; });
  const gedaan: string[] = [];
  const verwerking = box.verwerk({ online: () => true, juisteSessie: () => true, uitvoeren: async r => { gedaan.push(r.id); if (r.id === 'a') await wacht; }, classificeer: () => 'conflict' as const });
  await box.voegToe(rij('b'));
  expect((await box.lees()).map(r => r.id)).toEqual(['a', 'b']);
  los(); await verwerking;
  expect(gedaan).toEqual(['a', 'b']); expect(await box.lees()).toEqual([]);
});
