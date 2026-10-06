/**
 * Tijd- en groeperingslogica van de chat. Puur, zonder Intl: dag- en maandnamen
 * staan hier vast, zodat ze op Hermes overal gelijk zijn (zelfde keuze als
 * lib/datum-labels.ts). Tijden zijn epoch-ms in de tijdzone van het toestel.
 */

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const DAGEN_KORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MAANDEN_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** Twee berichten van dezelfde afzender vormen één reeks zolang er minder dan dit tussen zit. */
const REEKS_PAUZE_MS = 10 * 60 * 1000;

function begin(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Hele kalenderdagen tussen twee momenten (0 = zelfde dag), zomertijd-veilig. */
function dagenVerschil(ts: number, nu: number): number {
  return Math.round((begin(nu) - begin(ts)) / 86_400_000);
}

export function zelfdeDag(a: number, b: number): boolean {
  return begin(a) === begin(b);
}

/** "09:14" */
export function klokTijd(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Tijd rechts in de inbox: "09:14", "Gisteren", "dinsdag", "5 okt", "5 okt 2025". */
export function inboxTijd(ts: number, nu: number = Date.now()): string {
  const verschil = dagenVerschil(ts, nu);
  if (verschil <= 0) return klokTijd(ts);
  if (verschil === 1) return 'Gisteren';
  const d = new Date(ts);
  if (verschil < 7) return DAGEN[d.getDay()];
  const jaar = d.getFullYear() !== new Date(nu).getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()} ${MAANDEN_KORT[d.getMonth()]}${jaar}`;
}

/** Dagscheiding in een gesprek: "Vandaag", "Gisteren", "ma 5 okt", "ma 5 okt 2025". */
export function dagScheiding(ts: number, nu: number = Date.now()): string {
  const verschil = dagenVerschil(ts, nu);
  if (verschil <= 0) return 'Vandaag';
  if (verschil === 1) return 'Gisteren';
  const d = new Date(ts);
  const jaar = d.getFullYear() !== new Date(nu).getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${DAGEN_KORT[d.getDay()]} ${d.getDate()} ${MAANDEN_KORT[d.getMonth()]}${jaar}`;
}

export function initialen(naam: string): string {
  const delen = naam.trim().split(/\s+/).filter(Boolean);
  if (delen.length === 0) return '?';
  const eerste = delen[0][0] ?? '';
  const laatste = delen.length > 1 ? delen[delen.length - 1][0] ?? '' : '';
  return `${eerste}${laatste}`.toUpperCase();
}

export function voornaam(naam: string): string {
  return naam.trim().split(/\s+/)[0] || naam;
}

// ── Groeperen voor de omgekeerde berichtenlijst ─────────────────────────────

export interface ChatBericht {
  _id: string;
  /** Zelfde sleutel = zelfde afzender (userId, of 'ik'/'ander' in een DM). */
  afzender: string;
  naam: string;
  rol?: string;
  tekst: string;
  tijd: number;
  eigen: boolean;
}

export type ChatItem =
  | { soort: 'dag'; key: string; label: string }
  | ({ soort: 'bericht'; key: string; eersteVanReeks: boolean; laatsteVanReeks: boolean } & ChatBericht);

/**
 * Zet berichten (oplopend, oudste eerst — zo levert convex/chat.ts ze) om naar
 * items voor een `inverted` FlatList: nieuwste eerst, met een dagscheiding boven
 * het eerste bericht van elke dag en reeksvlaggen voor strakkere bubbels.
 */
export function chatItems(berichten: ChatBericht[], nu: number = Date.now()): ChatItem[] {
  const oplopend: ChatItem[] = [];
  berichten.forEach((b, i) => {
    const vorige = berichten[i - 1];
    const volgende = berichten[i + 1];
    const nieuweDag = !vorige || !zelfdeDag(vorige.tijd, b.tijd);
    const eersteVanReeks = nieuweDag || vorige.afzender !== b.afzender || b.tijd - vorige.tijd > REEKS_PAUZE_MS;
    const laatsteVanReeks =
      !volgende || !zelfdeDag(volgende.tijd, b.tijd) || volgende.afzender !== b.afzender || volgende.tijd - b.tijd > REEKS_PAUZE_MS;
    if (nieuweDag) oplopend.push({ soort: 'dag', key: `dag-${b._id}`, label: dagScheiding(b.tijd, nu) });
    oplopend.push({ soort: 'bericht', key: b._id, eersteVanReeks, laatsteVanReeks, ...b });
  });
  return oplopend.reverse();
}
