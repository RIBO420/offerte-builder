export interface TijdRegel { categorie: string; beginTijd: string; eindTijd: string }
export const tijdMinuten = (tijd: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(tijd) ? Number(tijd.slice(0, 2)) * 60 + Number(tijd.slice(3)) : NaN;
export const minutenTijd = (waarde: number) => `${Math.floor(waarde / 60).toString().padStart(2, '0')}:${(waarde % 60).toString().padStart(2, '0')}`;
function controleer<T extends TijdRegel>(regels: T[]): T[] {
  for (const r of regels) if (!(tijdMinuten(r.beginTijd) < tijdMinuten(r.eindTijd))) throw new Error('Deze wijziging past niet binnen de dag. Controleer de tijden.');
  const gesorteerd = [...regels].sort((a, b) => tijdMinuten(a.beginTijd) - tijdMinuten(b.beginTijd));
  for (let i = 1; i < gesorteerd.length; i++) if (tijdMinuten(gesorteerd[i].beginTijd) < tijdMinuten(gesorteerd[i - 1].eindTijd)) throw new Error('Deze wijziging overlapt een ander segment.');
  return regels;
}
export function wijzigVoorstelTijd<T extends TijdRegel>(regels: T[], index: number, veld: 'beginTijd' | 'eindTijd', waarde: string, schuifMee: boolean): T[] {
  const regel = regels[index];
  if (!regel || !Number.isFinite(tijdMinuten(waarde))) throw new Error('Vul een tijd als HH:MM in.');
  const verschil = tijdMinuten(waarde) - tijdMinuten(regel[veld]);
  return controleer(regels.map((r, i) => {
    if (i === index) return veld === 'beginTijd' ? { ...r, beginTijd: waarde, eindTijd: minutenTijd(tijdMinuten(r.eindTijd) + verschil) } : { ...r, eindTijd: waarde };
    if (i > index && schuifMee) return { ...r, beginTijd: minutenTijd(tijdMinuten(r.beginTijd) + verschil), eindTijd: minutenTijd(tijdMinuten(r.eindTijd) + verschil) };
    return r;
  }));
}
/** Een genomen pauze vervangt een deel van het klantwerk; de vertrek-/eindtijd blijft gelijk. */
export function splitsVoorPauze<T extends TijdRegel>(regels: T[], index: number, beginTijd: string, duur: number, maakPauze: (regel: T, begin: string, eind: string) => T): T[] {
  const r = regels[index]; const start = tijdMinuten(beginTijd); const eind = start + duur;
  if (!r || r.categorie !== 'werken' || !Number.isInteger(duur) || duur < 1 || !(start >= tijdMinuten(r.beginTijd) && eind <= tijdMinuten(r.eindTijd))) throw new Error('Kies een pauze binnen het werkblok met een positieve duur.');
  const vervanging: T[] = [];
  if (start > tijdMinuten(r.beginTijd)) vervanging.push({ ...r, eindTijd: beginTijd });
  vervanging.push(maakPauze(r, beginTijd, minutenTijd(eind)));
  if (eind < tijdMinuten(r.eindTijd)) vervanging.push({ ...r, beginTijd: minutenTijd(eind) });
  return controleer([...regels.slice(0, index), ...vervanging, ...regels.slice(index + 1)]);
}
