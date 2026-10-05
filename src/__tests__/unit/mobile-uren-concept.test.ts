import { describe, expect, it } from 'vitest';
import { leesUrenConcept, schrijfUrenConcept, urenConceptSleutel, type UrenConcept } from '../../../mobile/lib/uren-concept';
const key = urenConceptSleutel('org-a', 'user-a', '2026-09-12', null)!;
const concept: UrenConcept = { versie: 1, scope: key, datum: '2026-09-12', segmentId: null, revisie: 7, categorie: 'werken', werksoort: 'Tuinaanleg', beginTijd: '08:00', eindTijd: '09:00', werkitemId: 'project-1', notitie: 'Bewaard', opdracht: { sleutel: 'stable-attempt-1', payload: '{"datum":"2026-09-12"}' } };
describe('manual hours draft persistence', () => {
  it('round-trips all manual fields, revision and the exact retry key/payload', () => expect(leesUrenConcept(JSON.stringify(concept), key, concept.datum, null)).toEqual(concept));
  it('isolates account, organisation, date and edit/create identity', () => {
    expect(urenConceptSleutel('org-b', 'user-a', concept.datum, null)).not.toBe(key);
    expect(urenConceptSleutel('org-a', 'user-b', concept.datum, null)).not.toBe(key);
    expect(urenConceptSleutel(null, 'user-a', concept.datum, null)).toBeNull();
    expect(leesUrenConcept(JSON.stringify(concept), key + 'other', concept.datum, null)).toBeNull();
    expect(leesUrenConcept(JSON.stringify(concept), key, '2026-09-13', null)).toBeNull();
    expect(leesUrenConcept(JSON.stringify(concept), key, concept.datum, 'existing-id')).toBeNull();
  });
  it('removes confirmed drafts after queued earlier autosaves, never resurrecting them', async () => {
    let tekst: string | null = null; let vrijgeven: () => void = () => undefined;
    const wacht = new Promise<void>(resolve => { vrijgeven = resolve; });
    const storage = { setItem: async (_key: string, value: string) => { await wacht; tekst = value; }, removeItem: async () => { tekst = null; } };
    const schrijven = schrijfUrenConcept(storage, key, concept);
    const verwijderen = schrijfUrenConcept(storage, key, null);
    vrijgeven(); await Promise.all([schrijven, verwijderen]);
    expect(tekst).toBeNull();
  });
  it('rejects corrupted saved attempts instead of silently dropping retry identity', () => expect(() => leesUrenConcept(JSON.stringify({ ...concept, opdracht: { sleutel: 5 } }), key, concept.datum, null)).toThrow());
});
