/**
 * Planbord-logica — pure, testbare functies voor het weekbord (PRD §2.2, stap 5a).
 *
 * Bewust gescheiden van convex/planbord.ts (queries/mutations) en
 * convex/werkitems.ts zodat unit-tests (src/__tests__/unit/convex) deze
 * businesslogica zonder Convex-runtime kunnen testen, en zodat er geen
 * import-cykels ontstaan tussen werkitems.ts en planbord.ts.
 *
 * NB (naamconflict, MODULE-GAP-ANALYSE): de tabel `routes` is GPS-tracking.
 * Planbord-concepten heten hier dan ook nooit "route"; de geordende werkitems
 * van één team op één dag zijn een "team-dag" (route-dagkaart volgt in 5b).
 */

// LET OP: dit bestand heeft bewust GEEN runtime-imports (alleen `import type`),
// zodat het veilig gedeeld kan worden met de client-UI (src/components/planbord)
// en unit-tests zonder de Convex-server-runtime mee te bundelen.
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

// ============================================
// Datum-helpers (YYYY-MM-DD, lexicografisch sorteerbaar)
// ============================================

const DAG_MS = 24 * 60 * 60 * 1000;

export function addDagen(datum: string, dagen: number): string {
  const ms = Date.parse(`${datum}T00:00:00Z`) + dagen * DAG_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Aantal dagen tussen twee datums (eind - start; 0 bij gelijke datums). */
export function dagenTussen(start: string, eind: string): number {
  return Math.round(
    (Date.parse(`${eind}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
      DAG_MS
  );
}

/** ISO-weekdag van een datum: 1 = maandag … 7 = zondag. */
export function isoWeekdag(datum: string): number {
  const d = new Date(`${datum}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** True als [aStart..aEind] en [bStart..bEind] (inclusief) overlappen. */
export function overlaptPeriode(
  aStart: string,
  aEind: string,
  bStart: string,
  bEind: string
): boolean {
  return aStart <= bEind && bStart <= aEind;
}

/** True als `datum` binnen de (inclusieve) planning van een werkitem valt. */
export function werkitemOpDag(
  item: Pick<Doc<"projecten">, "geplandeStart" | "geplandeEind">,
  datum: string
): boolean {
  if (!item.geplandeStart) return false;
  const eind = item.geplandeEind ?? item.geplandeStart;
  return item.geplandeStart <= datum && datum <= eind;
}

// ============================================
// Rolcheck (PRD §2.2: kantoor plant, voorman leest)
// ============================================

/**
 * Alleen kantoor (directie/projectleider) mag het planbord muteren.
 * Zelfde semantiek als roles.isKantoorRol (incl. legacy "admin" → directie),
 * maar zonder runtime-import zodat de client-UI dit ook kan gebruiken.
 */
const KANTOOR_ROLLEN = new Set(["directie", "projectleider", "admin"]);

export function magPlanbordMuteren(role: string | undefined | null): boolean {
  return KANTOOR_ROLLEN.has(role ?? "");
}

// ============================================
// Seizoensvenster-bewaking (waarschuwing, GEEN blokkade)
// ============================================

export interface Seizoensvenster {
  vensterVanMaand?: number; // 1-12; venster mag over de jaargrens lopen
  vensterTotMaand?: number; // 1-12
}

/** True als de maand van `datum` binnen het seizoensvenster valt. */
export function datumBinnenVenster(
  venster: Seizoensvenster,
  datum: string
): boolean {
  const van = venster.vensterVanMaand ?? 1;
  const tot = venster.vensterTotMaand ?? 12;
  const maand = Number(datum.slice(5, 7));
  if (van <= tot) return maand >= van && maand <= tot;
  // Venster over de jaargrens (bv. van=10, tot=3): okt-dec of jan-mrt
  return maand >= van || maand <= tot;
}

const MAAND_NAMEN = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

/**
 * Seizoensvenster-bewaking (PRD §2.2): plannen buiten het venster van een
 * bouwsteen geeft een WAARSCHUWING, geen blokkade. Geeft de waarschuwings-
 * tekst terug, of null als de datum binnen het venster valt (of er geen
 * venster is).
 */
export function seizoensvensterWaarschuwing(
  venster: Seizoensvenster | null | undefined,
  geplandeStart: string | null | undefined,
  omschrijving?: string
): string | null {
  if (!geplandeStart || !venster) return null;
  if (
    venster.vensterVanMaand === undefined &&
    venster.vensterTotMaand === undefined
  ) {
    return null;
  }
  if (datumBinnenVenster(venster, geplandeStart)) return null;
  const van = MAAND_NAMEN[(venster.vensterVanMaand ?? 1) - 1];
  const tot = MAAND_NAMEN[(venster.vensterTotMaand ?? 12) - 1];
  const wat = omschrijving ? `"${omschrijving}"` : "dit werk";
  return `Let op: ${wat} valt buiten het seizoensvenster (${van} t/m ${tot}). Plannen kan gewoon, maar controleer of dit klopt.`;
}

// ============================================
// Wachtrij-relevantie (PRD §2.2: terugkerende beurten alleen in de
// weken waarin ze relevant zijn)
// ============================================

/** Marge rond de voorziene datum waarbinnen een beurt "relevant" is. */
export const WACHTRIJ_MARGE_DAGEN = 14;

/**
 * Bepaalt of een ongepland werkitem relevant is voor de bak in de periode
 * [start..eind]:
 * - projecten: altijd relevant (geen ritme);
 * - beurten zonder voorzieneDatum: altijd relevant (losse beurt zonder ritme);
 * - beurten mét voorzieneDatum: relevant als [voorzieneDatum - marge ..
 *   voorzieneDatum + marge] overlapt met de getoonde periode. Een beurt die
 *   al vóór de periode had gemoeten blijft zichtbaar (achterstallig werk
 *   mag niet uit beeld verdwijnen).
 */
export function isRelevantVoorWachtrij(
  item: Pick<Doc<"projecten">, "type" | "voorzieneDatum">,
  start: string,
  eind: string,
  margeDagen: number = WACHTRIJ_MARGE_DAGEN
): boolean {
  if ((item.type ?? "project") === "project") return true;
  if (!item.voorzieneDatum) return true;
  // Achterstallig: voorziene datum al verstreken vóór het einde van de periode
  if (item.voorzieneDatum <= eind) return true;
  // Komt eraan: venster rond de voorziene datum raakt de periode
  return addDagen(item.voorzieneDatum, -margeDagen) <= eind &&
    start <= addDagen(item.voorzieneDatum, margeDagen);
}

// ============================================
// Beschikbaarheidsvenster (klant/werkitem) — hint, geen blokkade
// ============================================

export interface BeschikbaarheidsVenster {
  dagen?: number[]; // ISO-weekdagen 1-7
  vanDatum?: string; // YYYY-MM-DD
  totDatum?: string; // YYYY-MM-DD
  notitie?: string;
}

const DAG_NAMEN = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

/**
 * Toetst een plandatum aan een beschikbaarheidsvenster. Geeft null terug als
 * het past (of er geen venster is), anders een mensleesbare hint voor de bak.
 */
export function beschikbaarheidsHint(
  venster: BeschikbaarheidsVenster | null | undefined,
  datum: string
): string | null {
  if (!venster) return null;
  if (venster.dagen && venster.dagen.length > 0) {
    if (!venster.dagen.includes(isoWeekdag(datum))) {
      const namen = venster.dagen
        .filter((d) => d >= 1 && d <= 7)
        .map((d) => DAG_NAMEN[d - 1])
        .join(", ");
      return `Klant is alleen beschikbaar op: ${namen}`;
    }
  }
  if (venster.vanDatum && datum < venster.vanDatum) {
    return `Klant is pas beschikbaar vanaf ${venster.vanDatum}`;
  }
  if (venster.totDatum && datum > venster.totDatum) {
    return `Klant is beschikbaar tot ${venster.totDatum}`;
  }
  return null;
}

/**
 * Effectieve planvoorkeuren van een werkitem: werkitem-velden winnen van
 * klant-velden (PRD §2.2: twee nieuwe velden op klant/werkitem).
 */
export function effectievePlanvoorkeuren(
  werkitem: Pick<Doc<"projecten">, "voorkeursTeamId" | "beschikbaarheidsVenster">,
  klant: Pick<Doc<"klanten">, "voorkeursTeamId" | "beschikbaarheidsVenster"> | null
): {
  voorkeursTeamId: Id<"teams"> | undefined;
  beschikbaarheidsVenster: BeschikbaarheidsVenster | undefined;
} {
  return {
    voorkeursTeamId: werkitem.voorkeursTeamId ?? klant?.voorkeursTeamId,
    beschikbaarheidsVenster:
      werkitem.beschikbaarheidsVenster ?? klant?.beschikbaarheidsVenster,
  };
}

// ============================================
// Bemanning per team-dag (default = vaste teamleden)
// ============================================

/**
 * Bemanning van een team op een dag: de teamBemanning-rij wint; zonder rij
 * gelden de vaste teamleden (teams.leden) als default.
 */
export function bemanningVoorDag(
  team: Pick<Doc<"teams">, "leden">,
  rij: Pick<Doc<"teamBemanning">, "medewerkerIds"> | null | undefined
): { medewerkerIds: Id<"medewerkers">[]; bron: "aangepast" | "default" } {
  if (rij) return { medewerkerIds: rij.medewerkerIds, bron: "aangepast" };
  return { medewerkerIds: team.leden, bron: "default" };
}

/** True als een afwezigheidsblok een medewerker op een datum raakt. */
export function isAfwezig(
  blok: Pick<
    Doc<"afwezigheidsblokken">,
    "medewerkerId" | "teamId" | "startDatum" | "eindDatum"
  >,
  datum: string,
  medewerkerId: Id<"medewerkers">,
  teamId: Id<"teams">
): boolean {
  if (datum < blok.startDatum || datum > blok.eindDatum) return false;
  if (blok.medewerkerId) return blok.medewerkerId === medewerkerId;
  if (blok.teamId) return blok.teamId === teamId;
  return false;
}

// ============================================
// Dupliceren & splitsen (PRD §2.2)
// ============================================

/**
 * Dupliceren naar een andere dag met behoud van team en tijden (expliciete
 * wens Yannick): zelfde duur, zelfde teamId (door de aanroeper te kopiëren),
 * zelfde geplandeStartTijd/geplandeEindTijd — alleen de datums schuiven.
 */
export function berekenDuplicaatPlanning(
  origineel: Pick<Doc<"projecten">, "geplandeStart" | "geplandeEind">,
  doelDatum: string
): { geplandeStart: string; geplandeEind: string } {
  const duurDagen =
    origineel.geplandeStart && origineel.geplandeEind
      ? dagenTussen(origineel.geplandeStart, origineel.geplandeEind)
      : 0;
  return {
    geplandeStart: doelDatum,
    geplandeEind: addDagen(doelDatum, Math.max(0, duurDagen)),
  };
}

export interface SplitsDeel {
  geplandeStart: string;
  geplandeEind?: string;
  teamId?: Id<"teams">;
}

/**
 * Valideert splits-invoer (klus over meerdere dagen of teams): minimaal twee
 * delen, elk met geldige datums. Gooit niets — geeft een foutmelding of null.
 */
export function valideerSplitsDelen(delen: SplitsDeel[]): string | null {
  if (delen.length < 2) {
    return "Splitsen vereist minimaal twee delen";
  }
  for (const deel of delen) {
    if (deel.geplandeEind && deel.geplandeEind < deel.geplandeStart) {
      return "Einddatum van een deel ligt vóór de startdatum";
    }
  }
  return null;
}

// ============================================
// Migratie-afleiding (weekPlanning → werkitem-planvelden)
// ============================================

export interface AfgeleidePlanning {
  geplandeStart: string;
  geplandeEind: string;
  teamId: Id<"teams"> | null;
  redenGeenTeam: string | null;
}

/**
 * Leidt werkitem-planvelden af uit legacy weekPlanning-rijen (B1-restant):
 * - geplandeStart/geplandeEind = min/max van de dag-toewijzingen (eenduidig);
 * - teamId alleen als precies één actief team ALLE ingeplande medewerkers
 *   bevat (anders niet eenduidig → gerapporteerd, niet gegokt).
 * Geeft null als er geen rijen zijn (niets af te leiden).
 */
export function afleidPlanningUitWeekPlanning(
  rijen: Pick<Doc<"weekPlanning">, "medewerkerId" | "datum">[],
  teams: Pick<Doc<"teams">, "_id" | "leden" | "isActief">[]
): AfgeleidePlanning | null {
  if (rijen.length === 0) return null;
  const datums = rijen.map((r) => r.datum).sort();
  const medewerkerIds = [...new Set(rijen.map((r) => r.medewerkerId))];

  const kandidaten = teams.filter(
    (t) =>
      t.isActief &&
      medewerkerIds.every((m) => t.leden.some((lid) => lid === m))
  );

  let teamId: Id<"teams"> | null = null;
  let redenGeenTeam: string | null = null;
  if (kandidaten.length === 1) {
    teamId = kandidaten[0]._id;
  } else if (kandidaten.length === 0) {
    redenGeenTeam = "geen actief team bevat alle ingeplande medewerkers";
  } else {
    redenGeenTeam = `meerdere teams (${kandidaten.length}) bevatten alle ingeplande medewerkers`;
  }

  return {
    geplandeStart: datums[0],
    geplandeEind: datums[datums.length - 1],
    teamId,
    redenGeenTeam,
  };
}

// ============================================
// Audit-logging (PRD §2.2: wie, wat, wanneer — meteen bij het bord)
// ============================================

export type PlanbordActie = Doc<"planbordLogboek">["actie"];

/**
 * Schrijft één audit-event naar planbordLogboek. Geen PII in details:
 * alleen namen van interne entiteiten (werkitem/team) en datums.
 */
export async function logPlanwijziging(
  ctx: MutationCtx,
  event: {
    // Tenant-scope loopt sinds de org-migratie (fase 3) over `orgId`; `userId`
    // blijft tot fase 6 verplicht meegeschreven omdat het schemaveld dat nog is.
    orgId: Id<"organisaties">;
    userId: Id<"users">;
    door: Id<"users">;
    actie: PlanbordActie;
    details: string;
    werkitemId?: Id<"projecten">;
    teamId?: Id<"teams">;
  }
): Promise<void> {
  await ctx.db.insert("planbordLogboek", {
    orgId: event.orgId,
    userId: event.userId,
    door: event.door,
    actie: event.actie,
    details: event.details,
    werkitemId: event.werkitemId,
    teamId: event.teamId,
    createdAt: Date.now(),
  });
}
