import type { SegmentCategorie } from '../types/veld';
import type { Werksoort } from './werksoorten';
export interface UrenConcept {
  versie: 1; scope: string; datum: string; segmentId: string | null; revisie: number;
  categorie: SegmentCategorie; werksoort?: Werksoort; beginTijd: string; eindTijd: string;
  werkitemId: string | null; notitie: string;
  opdracht?: { sleutel: string; payload: string };
}
export function urenConceptSleutel(orgId: string | null | undefined, userId: string | null | undefined, datum: string, segmentId: string | null) {
  return orgId && userId ? `toptuinen:urenconcept:v1:${encodeURIComponent(orgId)}:${encodeURIComponent(userId)}:${datum}:${segmentId ?? 'nieuw'}` : null;
}
export function leesUrenConcept(tekst: string | null, scope: string, datum: string, segmentId: string | null): UrenConcept | null {
  if (!tekst) return null;
  const waarde: unknown = JSON.parse(tekst);
  if (!waarde || typeof waarde !== 'object') throw new Error('Het urenconcept kan niet worden gelezen.');
  const r = waarde as Partial<UrenConcept>;
  // Een verkeerd gescopeerde kopie mag nooit invoervelden van een andere gebruiker tonen.
  if (r.scope !== scope || r.datum !== datum || r.segmentId !== segmentId) return null;
  if (r.versie !== 1 || !Number.isInteger(r.revisie) || (r.revisie ?? -1) < 0 || typeof r.categorie !== 'string' || typeof r.beginTijd !== 'string' || typeof r.eindTijd !== 'string' || typeof r.notitie !== 'string' || !(r.werkitemId === null || typeof r.werkitemId === 'string')) throw new Error('Het urenconcept is beschadigd. Je kunt het verwijderen en opnieuw beginnen.');
  if (r.opdracht) {
    if (typeof r.opdracht.sleutel !== 'string' || !r.opdracht.sleutel || typeof r.opdracht.payload !== 'string') throw new Error('De eerdere opslagpoging kan niet worden gelezen.');
    const payload: unknown = JSON.parse(r.opdracht.payload);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('De eerdere opslagpoging is beschadigd.');
  }
  return r as UrenConcept;
}
/** Eén schrijfrij per sleutel voorkomt dat oude autosave een verwijderde draft terugzet. */
const schrijfrijen = new Map<string, Promise<unknown>>();
export function schrijfUrenConcept(storage: { setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }, sleutel: string, concept: UrenConcept | null): Promise<void> {
  const vorig = schrijfrijen.get(sleutel) ?? Promise.resolve();
  const volgende = vorig.catch(() => undefined).then(() => concept ? storage.setItem(sleutel, JSON.stringify(concept)) : storage.removeItem(sleutel));
  schrijfrijen.set(sleutel, volgende);
  return volgende;
}
