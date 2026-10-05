/** Public source seed, migration 20260620000013_native_planning.sql. Matches
 * only suggest equipment; accepting never changes stock or vehicle inventory. */
export interface MateriaalRegel { trefwoord: string; naam: string; soort: "machine" | "materiaal"; actief?: boolean }
const machines = new Set(["Grasmaaier", "Bosmaaier", "Heggenschaar", "Bladblazer", "Onkruidbrander", "Trilplaat", "Aanhanger"]);
export const STANDAARD_MATERIAAL_REGELS: MateriaalRegel[] = [
  ["maai", "Grasmaaier"], ["gras", "Grasmaaier"], ["gazon", "Grasmaaier"], ["kantmaai", "Bosmaaier"], ["trimmen", "Bosmaaier"],
  ["snoei", "Heggenschaar"], ["snoei", "Snoeischaar"], ["heg", "Heggenschaar"], ["haag", "Heggenschaar"], ["struik", "Snoeischaar"], ["boom", "Takkenzaag"], ["tak", "Takkenzaag"],
  ["blad", "Bladblazer"], ["herfst", "Bladblazer"], ["onkruid", "Schoffel"], ["onkruid", "Onkruidbrander"], ["wieden", "Schoffel"],
  ["aanleg", "Kruiwagen"], ["aanleg", "Schep"], ["graven", "Spade"], ["grond", "Kruiwagen"], ["bestrat", "Trilplaat"], ["tegel", "Rubberen hamer"], ["beplant", "Plantschep"], ["planten", "Plantschep"], ["zaaien", "Hark"], ["hark", "Hark"],
  ["spuit", "Rugspuit"], ["spuiten", "Rugspuit"], ["water", "Tuinslang"], ["beregen", "Tuinslang"], ["afval", "Aanhanger"], ["afvoer", "Aanhanger"],
].map(([trefwoord, naam]) => ({ trefwoord, naam, soort: machines.has(naam) ? "machine" : "materiaal", actief: true }));
const norm = (s: string) => s.trim().toLocaleLowerCase("nl");
export function effectieveMateriaalRegels(overrides: MateriaalRegel[]) {
  const regelMap = new Map(STANDAARD_MATERIAAL_REGELS.map(r => [`${norm(r.trefwoord)}|${norm(r.naam)}`, r]));
  for (const r of overrides) regelMap.set(`${norm(r.trefwoord)}|${norm(r.naam)}`, r);
  return [...regelMap.values()].sort((a, b) => a.trefwoord.localeCompare(b.trefwoord) || a.naam.localeCompare(b.naam));
}
export function materiaalSuggesties(omschrijving: string, regels: MateriaalRegel[], bestaandeNamen: string[] = []) {
  const tekst = norm(omschrijving), bekend = new Set(bestaandeNamen.map(norm));
  const resultaat = new Map<string, { naam: string; soort: "machine" | "materiaal"; trefwoorden: string[] }>();
  for (const regel of regels) {
    const trefwoord = norm(regel.trefwoord), sleutel = norm(regel.naam);
    if (regel.actief === false || !trefwoord || !sleutel || !tekst.includes(trefwoord) || bekend.has(sleutel)) continue;
    const suggestie = resultaat.get(sleutel) ?? { naam: regel.naam.trim(), soort: regel.soort, trefwoorden: [] };
    if (!suggestie.trefwoorden.includes(trefwoord)) suggestie.trefwoorden.push(trefwoord);
    resultaat.set(sleutel, suggestie);
  }
  return [...resultaat.values()];
}
