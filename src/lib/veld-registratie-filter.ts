/** Filters always operate on the loaded complete period; dropdowns are independent. */
export interface FilterbareRegistratie { id: string; datum: string; beginTijd: string; medewerkerId: string; klantId: string | null; categorie: string; status: string }
export interface RegistratieFilters { medewerker: string; klant: string; categorie: string; status: string }
export const legeRegistratieFilters: RegistratieFilters = { medewerker: "alle", klant: "alle", categorie: "alle", status: "alle" };
export function filterRegistraties<T extends FilterbareRegistratie>(regels: T[], filters: RegistratieFilters): T[] {
  return [...new Map(regels.map(r => [r.id, r])).values()].filter(r =>
    (filters.medewerker === "alle" || r.medewerkerId === filters.medewerker) &&
    (filters.klant === "alle" || (filters.klant === "zonder" ? r.klantId === null : r.klantId === filters.klant)) &&
    (filters.categorie === "alle" || r.categorie === filters.categorie) &&
    (filters.status === "alle" || r.status === filters.status))
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.beginTijd.localeCompare(b.beginTijd) || a.id.localeCompare(b.id));
}
