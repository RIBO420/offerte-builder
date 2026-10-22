/**
 * Regel verslepen in de vrije builder — pure helper, los te testen.
 *
 * De volgorde van de offerte ís de volgorde van de `regels`-array (PDF en
 * factuur volgen hem). Hoofdstukken hebben geen eigen veld: hun volgorde is
 * die van eerste verschijning in de regels. Daarom groepeert deze helper het
 * resultaat altijd per hoofdstuk in de bestaande hoofdstukvolgorde; anders
 * zou het verslepen van de eerste regel van een hoofdstuk het hele hoofdstuk
 * laten verspringen.
 */

interface Regel {
  id: string;
  scope: string;
}

function uniek(waarden: string[]): string[] {
  const uit: string[] = [];
  for (const w of waarden) if (!uit.includes(w)) uit.push(w);
  return uit;
}

/**
 * Verplaats regel `actieveId` naar hoofdstuk `doelHoofdstuk`.
 *
 * - `overId` is een regel in dat hoofdstuk: de regel komt op diens plek —
 *   binnen hetzelfde hoofdstuk met dnd-kit's arrayMove-gedrag (omlaag
 *   slepen = ná de doelregel), vanuit een ander hoofdstuk ervóór.
 * - `overId` is `null` (of geen regel van dat hoofdstuk): achteraan in het
 *   hoofdstuk, ook als dat nog leeg is.
 *
 * `hoofdstukVolgorde` is de volgorde zoals de editor hem toont (inclusief
 * lege hoofdstukken); zonder volgt hij uit de regels.
 */
export function verplaatsRegel<T extends Regel>(
  regels: readonly T[],
  actieveId: string,
  overId: string | null,
  doelHoofdstuk: string,
  hoofdstukVolgorde?: readonly string[]
): T[] {
  const actief = regels.find((r) => r.id === actieveId);
  if (!actief) return [...regels];
  if (overId === actieveId && actief.scope === doelHoofdstuk) return [...regels];

  const volgorde = uniek([
    ...(hoofdstukVolgorde ?? []),
    ...regels.map((r) => r.scope),
    doelHoofdstuk,
  ]);

  const perHoofdstuk = new Map<string, T[]>(volgorde.map((h) => [h, []]));
  for (const r of regels) {
    if (r.id !== actieveId) perHoofdstuk.get(r.scope)!.push(r);
  }

  const doel = perHoofdstuk.get(doelHoofdstuk)!;
  const verplaatst: T = { ...actief, scope: doelHoofdstuk };
  const overIndex = overId === null ? -1 : doel.findIndex((r) => r.id === overId);

  if (overIndex === -1) {
    doel.push(verplaatst);
  } else {
    let invoegOp = overIndex;
    if (actief.scope === doelHoofdstuk) {
      // Zelfde hoofdstuk: stond de regel boven de doelregel, dan komt hij
      // eronder (zoals arrayMove), anders erboven.
      const origineel = regels.filter((r) => r.scope === doelHoofdstuk);
      const van = origineel.findIndex((r) => r.id === actieveId);
      const naar = origineel.findIndex((r) => r.id === overId);
      if (van < naar) invoegOp = overIndex + 1;
    }
    doel.splice(invoegOp, 0, verplaatst);
  }

  return volgorde.flatMap((h) => perHoofdstuk.get(h)!);
}
