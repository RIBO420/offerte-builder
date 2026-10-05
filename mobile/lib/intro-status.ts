// Overbrugt alleen de bevestigde HTTP-mutatie tot de live query vernieuwt.
// Account + organisatie voorkomt dat een tweede gebruiker de intro overslaat.
const bevestigd = new Set<string>();
export const introScope = (orgId: string | null | undefined, userId: string | null | undefined) => orgId && userId ? `${orgId}:${userId}` : null;
export const introIsBevestigd = (scope: string | null) => scope !== null && bevestigd.has(scope);
export const bevestigIntroLokaal = (scope: string | null) => { if (scope) bevestigd.add(scope); };
