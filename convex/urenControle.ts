/**
 * De Controlekamer — kantoorzijde van de urenketen (`/uren`).
 * Plan: docs/design/plannen/uren-controlekamer-plan.md (datacontract §2);
 * onderbouwing: docs/design/plannen/uren-redesign-onderzoek-ux.md.
 *
 * Kernprincipes:
 * - **De dag is de beoordelingseenheid, de week het ritme.** Kantoor keurt
 *   nooit per segment goed (§6: schijncontrole); segmenten zijn het bewijs.
 * - **Akkoord is een logboek-kwijting**, geen extra status op `urenDagen`:
 *   `urenLogboek.actie = "dag_akkoord"`. Idempotent, en een heropening zet de
 *   dag terug in de wachtrij (`bepaalKwijting`).
 * - **Geen twee waarheden.** Dit bestand leest UITSLUITEND `urenSegmenten` /
 *   `urenDagen` / `urenLogboek`. De oude engine (`urenRegistraties`,
 *   `exportUren`, nacalculatie, project-uren) blijft ongemoeid en wordt hier
 *   nergens bij opgeteld — op het scherm staan het twee gescheiden secties.
 * - **Geldvrij.** Geen uurtarieven, geen kosten: dit scherm gaat over kloppen,
 *   niet over kosten (dat is rapportage).
 * - **Weekgrenzen Europe/Amsterdam, maandag als start** (lib/urenAfwijkingen).
 * - **Geen full table scans.** Alles via `by_user_datum` /
 *   `by_medewerker_datum` / `by_team_datum` / `by_team_geplandeStart`.
 *
 * Rolgezichten op één route: kantoor krijgt `getControleWeek` + `getDagFilm`,
 * de voorman `getPloegDag`, de medewerker `getMijnWeek`. De rolchecks zijn
 * exact die van `urenSegmenten.ts`/`veldLogica.ts` — hier staat geen tweede
 * rolmodel.
 */

import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { laadDocsMap } from "./lib/batchLoad";
import { werkitemOpDag } from "./planbordLogica";
import {
  filterVoorstellen,
  magDagHeropenen,
  magPloegDagZien,
  magUrenLoggen,
  type SegmentCategorie,
} from "./veldLogica";
import {
  dagkaartVoorstellen,
  dagStatusVoor,
  segmentenVoorDag,
  teamVanMedewerkerOpDag,
  veldContext,
  type VeldContext,
} from "./urenSegmenten";
import {
  bepaalAfwijkingen,
  bepaalKwijting,
  dagLabelVan,
  DATUM_PATROON,
  indirecteMinuten,
  isMaandag,
  kortDagLabelVan,
  laatsteWerkdagen,
  sorteerSegmenten,
  urenVanMinuten,
  vandaagAmsterdam,
  weekDagen,
  weekLabelVan,
  weekStartVan,
  werkendeMinuten,
  type AfwijkingsReden,
  type AfwijkingSegment,
  type DagSegment,
} from "./lib/urenAfwijkingen";

// ============================================
// Datacontract (§2 van het plan) — alle types geëxporteerd
// ============================================

export type { AfwijkingsReden, DagSegment };

/** Eén medewerker-dag zoals elk blok op het scherm hem toont. */
export interface DagSamenvatting {
  medewerkerId: Id<"medewerkers">;
  naam: string;
  datum: string;
  totaalUren: number; // werkende tijd (pauze telt niet mee)
  status: "open" | "ingediend";
  segmenten: DagSegment[];
}

/** Een dag in de wachtrij: minstens één afwijkingsreden. */
export interface DagKaart extends DagSamenvatting {
  redenen: AfwijkingsReden[]; // ≥1
}

/** "Wie is achter": mens + de dagen die nog niet binnen zijn. */
export interface AchterRegel {
  medewerkerId: Id<"medewerkers">;
  naam: string;
  ploegLabel: string | null;
  ontbrekendeDagen: string[];
}

/**
 * Eén cel van de weekstaat. `afwijkend` betekent hier: ingediend mét
 * onbeantwoorde afwijkingsredenen — dezelfde definitie als de wachtrij.
 */
export interface WeekstaatCel {
  datum: string;
  uren: number; // werkende tijd; 0 bij leeg
  status: "leeg" | "open" | "ingediend" | "afwijkend";
}

/**
 * Eén rij van de weekstaat: het volledige medewerkers × dagen-overzicht
 * (aanvulling Ricardo 17 aug — controle-op-afwijking alléén gooide het
 * overzicht weg: "geen overzicht over medewerkers en uren per medewerker en
 * per team"). Alle actieve medewerkers staan erin, ook met een lege week.
 */
export interface WeekstaatRij {
  medewerkerId: Id<"medewerkers">;
  naam: string;
  ploegLabel: string | null; // eerste ploeg van die week, voor de groepering
  dagen: WeekstaatCel[]; // exact de weekdagen, maandag t/m zondag
  totaalUren: number;
}

export interface ControleWeek {
  weekStart: string;
  weekLabel: string; // "Week 33 · 10 t/m 16 augustus"
  achter: AchterRegel[];
  afwijkend: DagKaart[]; // gesorteerd: oudste eerst
  stil: DagSamenvatting[]; // ingediend, geen afwijking, nog niet gekweten
  gekweten: number; // al akkoord dit venster
  weekstaat: WeekstaatRij[]; // gegroepeerd te tonen per ploegLabel
  /**
   * `uren`/`indirect` zijn uren (werkende tijd resp. tijd zonder klus);
   * `ingediend`/`open` zijn AANTALLEN medewerker-dagen — de vraag van kantoor
   * is "hoeveel dagen wachten er nog", niet "hoeveel uur is open".
   */
  totalen: { uren: number; indirect: number; ingediend: number; open: number };
}

export interface FilmStripDag {
  datum: string;
  kortLabel: string;
  status: "compleet" | "open" | "afwijkend";
}

export interface FilmPloeg {
  teamId: Id<"teams">;
  naam: string;
  voermanNaam?: string;
  busLabel?: string;
  stops: string[];
  leden: DagSamenvatting[];
}

export interface DagFilm {
  datum: string;
  dagLabel: string; // "maandag 10 augustus 2026"
  strip: FilmStripDag[]; // laatste 10 werkdagen
  ploegen: FilmPloeg[];
  los: DagSamenvatting[]; // niet in een ploeg die dag
  /** `nietIngediend` = aantal medewerker-dagen dat nog niet op slot staat. */
  totaalZin: { uren: number; indirect: number; nietIngediend: number };
}

/** Kantoorcorrectie of -akkoord zoals de medewerker het in zijn week ziet. */
export interface WeekCorrectie {
  datum: string;
  actie: Doc<"urenLogboek">["actie"];
  details: string;
  createdAt: number;
}

export interface MijnWeek {
  weekStart: string;
  weekLabel: string;
  medewerker: { _id: Id<"medewerkers">; naam: string };
  dagen: DagSamenvatting[]; // exact 7, maandag t/m zondag
  correcties: WeekCorrectie[]; // nieuwste eerst
}

export interface PloegDagLid extends DagSamenvatting {
  openVoorstellen: number;
  isEigenDag: boolean;
}

export interface PloegDag {
  datum: string;
  dagLabel: string;
  ploeg: {
    teamId: Id<"teams">;
    naam: string;
    voermanNaam?: string;
    busLabel?: string;
    stops: string[];
  };
  leden: PloegDagLid[];
  totaalZin: { uren: number; indirect: number; nietIngediend: number };
}

// ============================================
// Gedeelde helpers
// ============================================

function assertGeldigeDatum(datum: string): void {
  if (!DATUM_PATROON.test(datum)) {
    throw new ConvexError("Ongeldige datum (verwacht YYYY-MM-DD)");
  }
}

function assertGeldigeWeekStart(weekStart: string): void {
  assertGeldigeDatum(weekStart);
  if (!isMaandag(weekStart)) {
    throw new ConvexError("weekStart moet een maandag zijn (YYYY-MM-DD)");
  }
}

/** Auth + kantoor-eis: de Controlekamer is kantoorwerk (§8.5, zelfde check
 * als `heropenDag`/`getWieIsAchter` in urenSegmenten.ts). */
async function kantoorContext(
  ctx: QueryCtx | MutationCtx
): Promise<VeldContext> {
  const veld = await veldContext(ctx);
  if (!magDagHeropenen(veld.rol)) {
    throw new ConvexError("De urencontrole is alleen voor kantoor");
  }
  return veld;
}

/** Segment-doc → contract-segment (geldvrij, met herkenbaar label). */
function naarDagSegment(
  segment: Doc<"urenSegmenten">,
  werkitemNamen: Map<string, string>,
  klantNamen: Map<string, string>
): DagSegment {
  const label =
    (segment.werkitemId
      ? werkitemNamen.get(segment.werkitemId.toString())
      : undefined) ??
    (segment.klantId ? klantNamen.get(segment.klantId.toString()) : undefined);
  return {
    beginTijd: segment.beginTijd,
    eindTijd: segment.eindTijd,
    categorie: segment.categorie as SegmentCategorie,
    ...(label ? { label } : {}),
  };
}

/** Segment-doc → invoer voor de afwijkingsregels. */
function naarAfwijkingSegment(segment: Doc<"urenSegmenten">): AfwijkingSegment {
  return {
    beginTijd: segment.beginTijd,
    eindTijd: segment.eindTijd,
    categorie: segment.categorie as SegmentCategorie,
    werkitemId: segment.werkitemId?.toString() ?? null,
    bron: segment.bron,
  };
}

/**
 * Namen van de werkitems en klanten waar de segmenten naar wijzen, in één
 * ronde (audit §5: geen N+1 per segment). De segmenten zijn al tenant-gescoped,
 * dus de gevonden documenten horen bij hetzelfde bedrijf.
 */
async function labelsVoorSegmenten(
  ctx: QueryCtx | MutationCtx,
  segmenten: Doc<"urenSegmenten">[]
): Promise<{ werkitemNamen: Map<string, string>; klantNamen: Map<string, string> }> {
  const [werkitems, klanten] = await Promise.all([
    laadDocsMap(
      ctx,
      segmenten.map((s) => s.werkitemId)
    ),
    laadDocsMap(
      ctx,
      segmenten.map((s) => s.klantId)
    ),
  ]);
  return {
    werkitemNamen: new Map(
      [...werkitems.entries()].map(([id, doc]) => [id, doc.naam])
    ),
    klantNamen: new Map(
      [...klanten.entries()].map(([id, doc]) => [id, doc.naam])
    ),
  };
}

/** Medewerkers van het bedrijf + vangnet voor ids die daar niet in zitten. */
async function medewerkerNamen(
  ctx: QueryCtx | MutationCtx,
  companyUserId: Id<"users">,
  extraIds: Id<"medewerkers">[]
): Promise<{
  actief: Doc<"medewerkers">[];
  alle: Map<string, Doc<"medewerkers">>;
}> {
  const eigen = await ctx.db
    .query("medewerkers")
    .withIndex("by_user", (q) => q.eq("userId", companyUserId))
    .collect();
  const alle = new Map<string, Doc<"medewerkers">>();
  for (const mw of eigen) alle.set(mw._id.toString(), mw);

  const ontbrekend = extraIds.filter((id) => !alle.has(id.toString()));
  if (ontbrekend.length > 0) {
    const extra = await laadDocsMap(ctx, ontbrekend);
    for (const mw of extra.values()) {
      // Tenant-grens: alleen medewerkers van dit bedrijf mogen erbij komen.
      if (mw.userId.toString() === companyUserId.toString()) {
        alle.set(mw._id.toString(), mw);
      }
    }
  }
  return { actief: eigen.filter((mw) => mw.isActief !== false), alle };
}

/** Actieve teams van het bedrijf. */
async function actieveTeams(
  ctx: QueryCtx | MutationCtx,
  companyUserId: Id<"users">
): Promise<Doc<"teams">[]> {
  const teams = await ctx.db
    .query("teams")
    .withIndex("by_user", (q) => q.eq("userId", companyUserId))
    .collect();
  return teams.filter((team) => team.isActief !== false);
}

/**
 * Bemanning per team op één dag: de dag-afwijking (`teamBemanning`) wint van
 * `teams.leden` — zelfde regel als `teamVanMedewerkerOpDag`.
 */
function bemanningVoorDag(
  teams: Doc<"teams">[],
  bemanningRijen: Doc<"teamBemanning">[]
): Map<string, Id<"medewerkers">[]> {
  const perTeam = new Map<string, Id<"medewerkers">[]>();
  for (const team of teams) {
    const afwijking = bemanningRijen.find(
      (r) => r.teamId.toString() === team._id.toString()
    );
    perTeam.set(team._id.toString(), afwijking?.medewerkerIds ?? team.leden);
  }
  return perTeam;
}

/** Voorman van een ploeg: het lid met functie "voorman" (eerste treffer). */
function voermanVan(
  leden: Id<"medewerkers">[],
  medewerkers: Map<string, Doc<"medewerkers">>
): string | undefined {
  for (const id of leden) {
    const mw = medewerkers.get(id.toString());
    if (mw?.functie?.toLowerCase().includes("voorman")) return mw.naam;
  }
  return undefined;
}

/** Buslabel van een ploeg op één dag: dag-override → standaardbus → geen. */
async function busLabelVoorTeamDag(
  ctx: QueryCtx | MutationCtx,
  companyUserId: Id<"users">,
  team: Doc<"teams">,
  datum: string
): Promise<string | undefined> {
  const override = await ctx.db
    .query("teamBusOverrides")
    .withIndex("by_team_datum", (q) =>
      q.eq("teamId", team._id).eq("datum", datum)
    )
    .unique();
  const voertuigId =
    override && override.userId.toString() === companyUserId.toString()
      ? override.voertuigId
      : team.standaardVoertuigId;
  if (!voertuigId) return undefined;
  const voertuig = await ctx.db.get(voertuigId);
  if (!voertuig || voertuig.userId.toString() !== companyUserId.toString()) {
    return undefined;
  }
  const merkModel = [voertuig.merk, voertuig.model].filter(Boolean).join(" ");
  return merkModel ? `${merkModel} · ${voertuig.kenteken}` : voertuig.kenteken;
}

/**
 * Uren + indirect + niet-ingediend van een reeks medewerker-dagen, in één zin.
 * `nietIngediend` telt mensen, niet uren: een ploeggenoot zonder één segment is
 * juist de reden dat de dag nog niet door kan.
 */
function totaalZinVan(
  dagen: { segmenten: Doc<"urenSegmenten">[]; status: "open" | "ingediend" }[]
): { uren: number; indirect: number; nietIngediend: number } {
  let minuten = 0;
  let indirect = 0;
  let nietIngediend = 0;
  for (const dag of dagen) {
    const invoer = dag.segmenten.map(naarAfwijkingSegment);
    minuten += werkendeMinuten(invoer);
    indirect += indirecteMinuten(invoer);
    if (dag.status !== "ingediend") nietIngediend++;
  }
  return {
    uren: urenVanMinuten(minuten),
    indirect: urenVanMinuten(indirect),
    nietIngediend,
  };
}

// ============================================
// Weekberekening (gedeeld door getControleWeek en keurWeekGoed)
// ============================================

interface WeekDagBron {
  datum: string;
  segmenten: Doc<"urenSegmenten">[];
  dagRijen: Doc<"urenDagen">[];
  logRijen: Doc<"urenLogboek">[];
  bemanningRijen: Doc<"teamBemanning">[];
}

/**
 * Eén ronde over de week: per dag alle segmenten, dagstatussen, logboekregels
 * en bemanning van het hele bedrijf — 4 indexqueries per dag, 28 in totaal, en
 * geen enkele scan. Daarna wordt alles in het geheugen gekruist; dat is
 * goedkoper dan per medewerker per dag een query.
 */
async function weekBronnen(
  ctx: QueryCtx | MutationCtx,
  companyUserId: Id<"users">,
  dagen: string[]
): Promise<WeekDagBron[]> {
  return await Promise.all(
    dagen.map(async (datum) => {
      const [segmenten, dagRijen, logRijen, bemanningRijen] = await Promise.all([
        ctx.db
          .query("urenSegmenten")
          .withIndex("by_user_datum", (q) =>
            q.eq("userId", companyUserId).eq("datum", datum)
          )
          .collect(),
        ctx.db
          .query("urenDagen")
          .withIndex("by_user_datum", (q) =>
            q.eq("userId", companyUserId).eq("datum", datum)
          )
          .collect(),
        ctx.db
          .query("urenLogboek")
          .withIndex("by_user_datum", (q) =>
            q.eq("userId", companyUserId).eq("datum", datum)
          )
          .collect(),
        ctx.db
          .query("teamBemanning")
          .withIndex("by_user_datum", (q) =>
            q.eq("userId", companyUserId).eq("datum", datum)
          )
          .collect(),
      ]);
      return { datum, segmenten, dagRijen, logRijen, bemanningRijen };
    })
  );
}

/**
 * Had de ploeg van een medewerker die dag ingeplande werkitems? Per team één
 * indexquery voor de hele week (`by_team_geplandeStart`), daarna per dag
 * filteren met `werkitemOpDag` — niet per dag opnieuw de planning ophalen.
 */
async function planningPerTeam(
  ctx: QueryCtx | MutationCtx,
  companyUserId: Id<"users">,
  teams: Doc<"teams">[],
  tot: string
): Promise<Map<string, Doc<"projecten">[]>> {
  const perTeam = new Map<string, Doc<"projecten">[]>();
  await Promise.all(
    teams.map(async (team) => {
      const kandidaten = await ctx.db
        .query("projecten")
        .withIndex("by_team_geplandeStart", (q) =>
          q.eq("teamId", team._id).lte("geplandeStart", tot)
        )
        .collect();
      perTeam.set(
        team._id.toString(),
        kandidaten.filter(
          (item) =>
            !item.deletedAt &&
            item.isArchived !== true &&
            item.status !== "vervallen" &&
            item.userId.toString() === companyUserId.toString()
        )
      );
    })
  );
  return perTeam;
}

interface BeoordeeldeDag {
  medewerkerId: Id<"medewerkers">;
  naam: string;
  datum: string;
  status: "open" | "ingediend";
  segmenten: Doc<"urenSegmenten">[];
  redenen: AfwijkingsReden[];
  gekweten: boolean;
  heeftPlanning: boolean;
  teamNaam: string | null;
}

/**
 * De hele week beoordeeld: per medewerker per dag de status, de redenen en de
 * kwijting. `getControleWeek` maakt hier de drie vraagblokken van en
 * `keurWeekGoed` gebruikt exact dezelfde uitkomst — één definitie van "stil".
 */
async function beoordeelWeek(
  ctx: QueryCtx | MutationCtx,
  veld: VeldContext,
  weekStart: string
): Promise<{
  dagen: string[];
  vandaag: string;
  beoordeeld: BeoordeeldeDag[];
  actieveMedewerkers: { medewerkerId: Id<"medewerkers">; naam: string }[];
}> {
  const dagen = weekDagen(weekStart);
  const vandaag = vandaagAmsterdam();
  const companyUserId = veld.companyUserId;

  const [bronnen, teams] = await Promise.all([
    weekBronnen(ctx, companyUserId, dagen),
    actieveTeams(ctx, companyUserId),
  ]);

  const alleSegmenten = bronnen.flatMap((b) => b.segmenten);
  const [{ actief, alle }, planning] = await Promise.all([
    medewerkerNamen(ctx, companyUserId, [
      ...alleSegmenten.map((s) => s.medewerkerId),
      ...bronnen.flatMap((b) => b.dagRijen.map((r) => r.medewerkerId)),
    ]),
    planningPerTeam(ctx, companyUserId, teams, dagen[dagen.length - 1]),
  ]);

  const teamPerId = new Map(teams.map((t) => [t._id.toString(), t]));
  const beoordeeld: BeoordeeldeDag[] = [];

  for (const bron of bronnen) {
    // Toekomstige dagen zijn geen werkvoorraad: die beoordeelt niemand.
    if (bron.datum > vandaag) continue;

    const bemanning = bemanningVoorDag(teams, bron.bemanningRijen);
    const teamVanMedewerker = new Map<string, Doc<"teams">>();
    for (const [teamId, leden] of bemanning) {
      const team = teamPerId.get(teamId);
      if (!team) continue;
      for (const lid of leden) {
        if (!teamVanMedewerker.has(lid.toString())) {
          teamVanMedewerker.set(lid.toString(), team);
        }
      }
    }

    // Kandidaten van deze dag: actieve medewerkers + wie er data heeft.
    const kandidaten = new Set<string>(actief.map((mw) => mw._id.toString()));
    for (const segment of bron.segmenten) {
      kandidaten.add(segment.medewerkerId.toString());
    }
    for (const rij of bron.dagRijen) kandidaten.add(rij.medewerkerId.toString());

    for (const medewerkerSleutel of kandidaten) {
      const medewerker = alle.get(medewerkerSleutel);
      if (!medewerker) continue;

      const segmenten = sorteerSegmenten(
        bron.segmenten.filter(
          (s) => s.medewerkerId.toString() === medewerkerSleutel
        )
      );
      const dagRij = bron.dagRijen.find(
        (r) => r.medewerkerId.toString() === medewerkerSleutel
      );
      const logRijen = bron.logRijen.filter(
        (r) => r.medewerkerId.toString() === medewerkerSleutel
      );
      const team = teamVanMedewerker.get(medewerkerSleutel) ?? null;
      const heeftPlanning = team
        ? (planning.get(team._id.toString()) ?? []).some((item) =>
            werkitemOpDag(item, bron.datum)
          )
        : false;

      if (segmenten.length === 0 && !dagRij && !heeftPlanning) continue;

      const kwijting = bepaalKwijting(logRijen);
      const status = dagRij?.status ?? ("open" as const);
      const redenen =
        status === "ingediend"
          ? bepaalAfwijkingen(segmenten.map(naarAfwijkingSegment), {
              heeftPlanning,
              isHeropend: kwijting.heropend,
            })
          : [];

      beoordeeld.push({
        medewerkerId: medewerker._id,
        naam: medewerker.naam,
        datum: bron.datum,
        status,
        segmenten,
        redenen,
        gekweten: kwijting.gekweten,
        heeftPlanning,
        teamNaam: team?.naam ?? null,
      });
    }
  }

  return {
    dagen,
    vandaag,
    beoordeeld,
    actieveMedewerkers: actief.map((mw) => ({
      medewerkerId: mw._id,
      naam: mw.naam,
    })),
  };
}

// ============================================
// Query — de Controlekamer (kantoor-gezicht)
// ============================================

export const getControleWeek = query({
  args: { weekStart: v.optional(v.string()) }, // YYYY-MM-DD, maandag
  handler: async (ctx, args): Promise<ControleWeek> => {
    const veld = await kantoorContext(ctx);
    const weekStart = args.weekStart ?? weekStartVan(vandaagAmsterdam());
    assertGeldigeWeekStart(weekStart);

    const { dagen, vandaag, beoordeeld, actieveMedewerkers } =
      await beoordeelWeek(ctx, veld, weekStart);
    const { werkitemNamen, klantNamen } = await labelsVoorSegmenten(
      ctx,
      beoordeeld.flatMap((d) => d.segmenten)
    );

    const samenvatting = (dag: BeoordeeldeDag): DagSamenvatting => ({
      medewerkerId: dag.medewerkerId,
      naam: dag.naam,
      datum: dag.datum,
      totaalUren: urenVanMinuten(
        werkendeMinuten(dag.segmenten.map(naarAfwijkingSegment))
      ),
      status: dag.status,
      segmenten: dag.segmenten.map((s) =>
        naarDagSegment(s, werkitemNamen, klantNamen)
      ),
    });

    const oudsteEerst = (a: DagSamenvatting, b: DagSamenvatting) =>
      a.datum.localeCompare(b.datum) || a.naam.localeCompare(b.naam);

    const afwijkend: DagKaart[] = beoordeeld
      .filter(
        (d) => d.status === "ingediend" && !d.gekweten && d.redenen.length > 0
      )
      .map((d) => ({ ...samenvatting(d), redenen: d.redenen }))
      .sort(oudsteEerst);

    const stil: DagSamenvatting[] = beoordeeld
      .filter(
        (d) => d.status === "ingediend" && !d.gekweten && d.redenen.length === 0
      )
      .map(samenvatting)
      .sort(oudsteEerst);

    const gekweten = beoordeeld.filter(
      (d) => d.status === "ingediend" && d.gekweten
    ).length;

    // "Achter" = een dag die vóór vandaag ligt, ingepland was (of al begonnen
    // is) en nog niet is ingediend. Vandaag zelf is nooit "achter": de dag is
    // dan nog niet om (§6: werklijst, geen schandpaal).
    const achterPerMedewerker = new Map<string, AchterRegel>();
    for (const dag of beoordeeld) {
      if (dag.datum >= vandaag) continue;
      if (dag.status === "ingediend") continue;
      if (!dag.heeftPlanning && dag.segmenten.length === 0) continue;
      const bestaand = achterPerMedewerker.get(dag.medewerkerId.toString());
      if (bestaand) {
        bestaand.ontbrekendeDagen.push(dag.datum);
        bestaand.ploegLabel = bestaand.ploegLabel ?? dag.teamNaam;
      } else {
        achterPerMedewerker.set(dag.medewerkerId.toString(), {
          medewerkerId: dag.medewerkerId,
          naam: dag.naam,
          ploegLabel: dag.teamNaam,
          ontbrekendeDagen: [dag.datum],
        });
      }
    }
    const achter = [...achterPerMedewerker.values()]
      .map((regel) => ({
        ...regel,
        ontbrekendeDagen: [...regel.ontbrekendeDagen].sort(),
      }))
      .sort(
        (a, b) =>
          b.ontbrekendeDagen.length - a.ontbrekendeDagen.length ||
          a.naam.localeCompare(b.naam)
      );

    let minuten = 0;
    let indirect = 0;
    let ingediendeDagen = 0;
    let openDagen = 0;
    for (const dag of beoordeeld) {
      const invoer = dag.segmenten.map(naarAfwijkingSegment);
      minuten += werkendeMinuten(invoer);
      indirect += indirecteMinuten(invoer);
      if (dag.status === "ingediend") ingediendeDagen++;
      else if (dag.heeftPlanning || dag.segmenten.length > 0) openDagen++;
    }

    // De weekstaat: alle actieve medewerkers (ook met een lege week) plus
    // iedereen die deze week iets heeft, met per weekdag uren + status.
    const rijPerMedewerker = new Map<string, WeekstaatRij>();
    const maakRij = (medewerkerId: Id<"medewerkers">, naam: string) => ({
      medewerkerId,
      naam,
      ploegLabel: null as string | null,
      dagen: dagen.map((datum) => ({
        datum,
        uren: 0,
        status: "leeg" as const,
      })) as WeekstaatCel[],
      totaalUren: 0,
    });
    for (const mw of actieveMedewerkers) {
      rijPerMedewerker.set(mw.medewerkerId.toString(), maakRij(mw.medewerkerId, mw.naam));
    }
    for (const dag of beoordeeld) {
      const sleutel = dag.medewerkerId.toString();
      let rij = rijPerMedewerker.get(sleutel);
      if (!rij) {
        rij = maakRij(dag.medewerkerId, dag.naam);
        rijPerMedewerker.set(sleutel, rij);
      }
      rij.ploegLabel = rij.ploegLabel ?? dag.teamNaam;
      const cel = rij.dagen.find((c) => c.datum === dag.datum);
      if (!cel) continue;
      cel.uren = urenVanMinuten(
        werkendeMinuten(dag.segmenten.map(naarAfwijkingSegment))
      );
      cel.status =
        dag.status === "ingediend"
          ? dag.redenen.length > 0 && !dag.gekweten
            ? "afwijkend"
            : "ingediend"
          : "open";
      rij.totaalUren = Math.round((rij.totaalUren + cel.uren) * 100) / 100;
    }
    const weekstaat = [...rijPerMedewerker.values()].sort(
      (a, b) =>
        // Ploegen bij elkaar (alfabetisch), ploegloos onderaan, dan op naam.
        (a.ploegLabel ?? "￿").localeCompare(b.ploegLabel ?? "￿") ||
        a.naam.localeCompare(b.naam)
    );

    return {
      weekStart,
      weekLabel: weekLabelVan(weekStart),
      achter,
      afwijkend,
      stil,
      gekweten,
      weekstaat,
      totalen: {
        uren: urenVanMinuten(minuten),
        indirect: urenVanMinuten(indirect),
        ingediend: ingediendeDagen,
        open: openDagen,
      },
    };
  },
});

// ============================================
// Query — de Ploegenfilm (dag-doorklik, kantoor-gezicht)
// ============================================

const STRIP_WERKDAGEN = 10;

export const getDagFilm = query({
  args: { datum: v.string() },
  handler: async (ctx, args): Promise<DagFilm> => {
    assertGeldigeDatum(args.datum);
    const veld = await kantoorContext(ctx);
    const companyUserId = veld.companyUserId;

    const stripDagen = laatsteWerkdagen(args.datum, STRIP_WERKDAGEN);
    if (!stripDagen.includes(args.datum)) stripDagen.push(args.datum);
    stripDagen.sort();

    const [bronnen, teams] = await Promise.all([
      weekBronnen(ctx, companyUserId, stripDagen),
      actieveTeams(ctx, companyUserId),
    ]);

    const dagBron = bronnen.find((b) => b.datum === args.datum);
    const segmentenVanDag = dagBron?.segmenten ?? [];

    const [{ alle }, { werkitemNamen, klantNamen }] = await Promise.all([
      medewerkerNamen(ctx, companyUserId, [
        ...segmentenVanDag.map((s) => s.medewerkerId),
        ...(dagBron?.dagRijen ?? []).map((r) => r.medewerkerId),
        ...teams.flatMap((t) => t.leden),
        ...(dagBron?.bemanningRijen ?? []).flatMap((r) => r.medewerkerIds),
      ]),
      labelsVoorSegmenten(ctx, segmentenVanDag),
    ]);

    /** Eén medewerker-dag op de focusdag. */
    const dagVan = (medewerkerId: Id<"medewerkers">): DagSamenvatting | null => {
      const medewerker = alle.get(medewerkerId.toString());
      if (!medewerker) return null;
      const segmenten = sorteerSegmenten(
        segmentenVanDag.filter(
          (s) => s.medewerkerId.toString() === medewerkerId.toString()
        )
      );
      const dagRij = (dagBron?.dagRijen ?? []).find(
        (r) => r.medewerkerId.toString() === medewerkerId.toString()
      );
      return {
        medewerkerId: medewerker._id,
        naam: medewerker.naam,
        datum: args.datum,
        totaalUren: urenVanMinuten(
          werkendeMinuten(segmenten.map(naarAfwijkingSegment))
        ),
        status: dagRij?.status ?? "open",
        segmenten: segmenten.map((s) =>
          naarDagSegment(s, werkitemNamen, klantNamen)
        ),
      };
    };

    // Filmstrip: één statuslabel per werkdag. Bewust zónder de
    // planning-vergelijking (die kost per dag een ronde langs alle teams);
    // "handmatig i.p.v. voorstel" telt hier dus niet mee — de kaarten in de
    // Controlekamer en de film zelf laten dat wél zien.
    const strip: FilmStripDag[] = bronnen.map((bron) => {
      const medewerkerIds = new Set<string>([
        ...bron.segmenten.map((s) => s.medewerkerId.toString()),
        ...bron.dagRijen.map((r) => r.medewerkerId.toString()),
      ]);
      let afwijkend = false;
      let open = false;
      for (const id of medewerkerIds) {
        const segmenten = bron.segmenten.filter(
          (s) => s.medewerkerId.toString() === id
        );
        const dagRij = bron.dagRijen.find(
          (r) => r.medewerkerId.toString() === id
        );
        const status = dagRij?.status ?? "open";
        if (status !== "ingediend") {
          open = true;
          continue;
        }
        const kwijting = bepaalKwijting(
          bron.logRijen.filter((r) => r.medewerkerId.toString() === id)
        );
        if (kwijting.gekweten) continue;
        if (
          bepaalAfwijkingen(segmenten.map(naarAfwijkingSegment), {
            isHeropend: kwijting.heropend,
          }).length > 0
        ) {
          afwijkend = true;
        }
      }
      return {
        datum: bron.datum,
        kortLabel: kortDagLabelVan(bron.datum),
        status: afwijkend ? "afwijkend" : open ? "open" : "compleet",
      };
    });

    // Ploeg-hoofdstukken van de focusdag.
    const bemanning = bemanningVoorDag(teams, dagBron?.bemanningRijen ?? []);
    const inEenPloeg = new Set<string>();
    const ploegen: FilmPloeg[] = [];
    for (const team of teams) {
      const leden = bemanning.get(team._id.toString()) ?? [];
      const [afgeleid, busLabel] = await Promise.all([
        dagkaartVoorstellen(ctx.db, companyUserId, team._id, args.datum),
        busLabelVoorTeamDag(ctx, companyUserId, team, args.datum),
      ]);
      const ledenDagen = leden
        .map((id) => {
          inEenPloeg.add(id.toString());
          return dagVan(id);
        })
        .filter((d): d is DagSamenvatting => d !== null)
        .sort((a, b) => a.naam.localeCompare(b.naam));

      // Een ploeg zonder stops én zonder gelogde tijd is die dag niet gereden.
      if (
        afgeleid.stops.length === 0 &&
        ledenDagen.every((d) => d.segmenten.length === 0)
      ) {
        continue;
      }
      const voermanNaam = voermanVan(leden, alle);
      ploegen.push({
        teamId: team._id,
        naam: team.naam,
        ...(voermanNaam ? { voermanNaam } : {}),
        ...(busLabel ? { busLabel } : {}),
        stops: afgeleid.stops.map((stop) =>
          stop.klantNaam ? `${stop.naam} · ${stop.klantNaam}` : stop.naam
        ),
        leden: ledenDagen,
      });
    }
    ploegen.sort((a, b) => a.naam.localeCompare(b.naam));

    const losseIds = new Set<string>([
      ...segmentenVanDag.map((s) => s.medewerkerId.toString()),
      ...(dagBron?.dagRijen ?? []).map((r) => r.medewerkerId.toString()),
    ]);
    const los = [...losseIds]
      .filter((id) => !inEenPloeg.has(id))
      .map((id) => alle.get(id))
      .filter((mw): mw is Doc<"medewerkers"> => mw !== undefined)
      .map((mw) => dagVan(mw._id))
      .filter((d): d is DagSamenvatting => d !== null)
      .sort((a, b) => a.naam.localeCompare(b.naam));

    const alleDagen = [...ploegen.flatMap((p) => p.leden), ...los];
    const medewerkerDagen = alleDagen.map((dag) => ({
      status: dag.status,
      segmenten: segmentenVanDag.filter(
        (s) => s.medewerkerId.toString() === dag.medewerkerId.toString()
      ),
    }));

    return {
      datum: args.datum,
      dagLabel: dagLabelVan(args.datum),
      strip,
      ploegen,
      los,
      totaalZin: totaalZinVan(medewerkerDagen),
    };
  },
});

// ============================================
// Query — mijn week (medewerker-gezicht)
// ============================================

export const getMijnWeek = query({
  args: { weekStart: v.optional(v.string()) },
  handler: async (ctx, args): Promise<MijnWeek | null> => {
    const veld = await veldContext(ctx);
    if (!magUrenLoggen(veld.rol)) {
      throw new ConvexError("Urenregistratie is niet beschikbaar voor deze rol");
    }
    // Kantoor is niet altijd medewerker: dan is er geen "mijn week" — geen
    // fout maar null, zodat de UI het gezicht kan omschakelen (getVeldDag doet
    // hetzelfde).
    const medewerker = veld.eigenMedewerker;
    if (!medewerker) return null;

    const weekStart = args.weekStart ?? weekStartVan(vandaagAmsterdam());
    assertGeldigeWeekStart(weekStart);
    const dagen = weekDagen(weekStart);

    const perDag = await Promise.all(
      dagen.map(async (datum) => {
        const [segmenten, dagRij, logRijen] = await Promise.all([
          segmentenVoorDag(
            ctx.db,
            veld.companyUserId,
            medewerker._id,
            datum
          ),
          dagStatusVoor(ctx.db, veld.companyUserId, medewerker._id, datum),
          ctx.db
            .query("urenLogboek")
            .withIndex("by_medewerker_datum", (q) =>
              q.eq("medewerkerId", medewerker._id).eq("datum", datum)
            )
            .collect(),
        ]);
        return { datum, segmenten: sorteerSegmenten(segmenten), dagRij, logRijen };
      })
    );

    const { werkitemNamen, klantNamen } = await labelsVoorSegmenten(
      ctx,
      perDag.flatMap((d) => d.segmenten)
    );

    const correcties: WeekCorrectie[] = perDag
      .flatMap((dag) =>
        dag.logRijen.filter(
          (r) =>
            r.userId.toString() === veld.companyUserId.toString() &&
            r.actie !== "dag_ingediend"
        )
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({
        datum: r.datum,
        actie: r.actie,
        details: r.details,
        createdAt: r.createdAt,
      }));

    return {
      weekStart,
      weekLabel: weekLabelVan(weekStart),
      medewerker: { _id: medewerker._id, naam: medewerker.naam },
      dagen: perDag.map((dag) => ({
        medewerkerId: medewerker._id,
        naam: medewerker.naam,
        datum: dag.datum,
        totaalUren: urenVanMinuten(
          werkendeMinuten(dag.segmenten.map(naarAfwijkingSegment))
        ),
        status: dag.dagRij?.status ?? ("open" as const),
        segmenten: dag.segmenten.map((s) =>
          naarDagSegment(s, werkitemNamen, klantNamen)
        ),
      })),
      correcties,
    };
  },
});

// ============================================
// Query — de ploegdag (voorman-gezicht)
// ============================================

export const getPloegDag = query({
  args: { datum: v.optional(v.string()) },
  handler: async (ctx, args): Promise<PloegDag | null> => {
    const veld = await veldContext(ctx);
    if (!magPloegDagZien(veld.rol)) {
      throw new ConvexError(
        "De ploegdag is voor de voorman en kantoor; een medewerker ziet zijn eigen week"
      );
    }
    const datum = args.datum ?? vandaagAmsterdam();
    assertGeldigeDatum(datum);

    // De ploeg volgt uit de eigen medewerker-koppeling; kantoor zonder
    // koppeling gebruikt de ploegenfilm (getDagFilm) en krijgt hier null.
    const eigen = veld.eigenMedewerker;
    if (!eigen) return null;
    const team = await teamVanMedewerkerOpDag(
      ctx.db,
      veld.companyUserId,
      eigen._id,
      datum
    );
    if (!team) return null;

    const bemanningRijen = await ctx.db
      .query("teamBemanning")
      .withIndex("by_team_datum", (q) =>
        q.eq("teamId", team._id).eq("datum", datum)
      )
      .collect();
    const afwijking = bemanningRijen.find(
      (r) => r.userId.toString() === veld.companyUserId.toString()
    );
    const leden = afwijking?.medewerkerIds ?? team.leden;

    const [afgeleid, busLabel, ledenDocs] = await Promise.all([
      dagkaartVoorstellen(ctx.db, veld.companyUserId, team._id, datum),
      busLabelVoorTeamDag(ctx, veld.companyUserId, team, datum),
      laadDocsMap(ctx, leden),
    ]);

    const perLid = await Promise.all(
      leden.map(async (lidId) => {
        const medewerker = ledenDocs.get(lidId.toString());
        if (
          !medewerker ||
          medewerker.userId.toString() !== veld.companyUserId.toString()
        ) {
          return null;
        }
        const [segmenten, dagRij] = await Promise.all([
          segmentenVoorDag(ctx.db, veld.companyUserId, lidId, datum),
          dagStatusVoor(ctx.db, veld.companyUserId, lidId, datum),
        ]);
        return {
          medewerker,
          segmenten: sorteerSegmenten(segmenten),
          status: dagRij?.status ?? ("open" as const),
          openVoorstellen: filterVoorstellen(afgeleid.voorstellen, segmenten)
            .length,
        };
      })
    );
    const geldig = perLid.filter((l): l is NonNullable<typeof l> => l !== null);

    const { werkitemNamen, klantNamen } = await labelsVoorSegmenten(
      ctx,
      geldig.flatMap((l) => l.segmenten)
    );
    const voermanNaam = voermanVan(leden, ledenDocs);

    return {
      datum,
      dagLabel: dagLabelVan(datum),
      ploeg: {
        teamId: team._id,
        naam: team.naam,
        ...(voermanNaam ? { voermanNaam } : {}),
        ...(busLabel ? { busLabel } : {}),
        stops: afgeleid.stops.map((stop) =>
          stop.klantNaam ? `${stop.naam} · ${stop.klantNaam}` : stop.naam
        ),
      },
      leden: geldig
        .map((lid) => ({
          medewerkerId: lid.medewerker._id,
          naam: lid.medewerker.naam,
          datum,
          totaalUren: urenVanMinuten(
            werkendeMinuten(lid.segmenten.map(naarAfwijkingSegment))
          ),
          status: lid.status,
          segmenten: lid.segmenten.map((s) =>
            naarDagSegment(s, werkitemNamen, klantNamen)
          ),
          openVoorstellen: lid.openVoorstellen,
          isEigenDag: lid.medewerker._id.toString() === eigen._id.toString(),
        }))
        .sort((a, b) => a.naam.localeCompare(b.naam)),
      totaalZin: totaalZinVan(
        geldig.map((lid) => ({ status: lid.status, segmenten: lid.segmenten }))
      ),
    };
  },
});

// ============================================
// Mutations — kwijting ("akkoord" = logboek-entry)
// ============================================

/** Bestaande kwijting/heropening van één medewerker-dag, tenant-gescoped. */
async function kwijtingVoorDag(
  ctx: MutationCtx,
  companyUserId: Id<"users">,
  medewerkerId: Id<"medewerkers">,
  datum: string
) {
  const rijen = await ctx.db
    .query("urenLogboek")
    .withIndex("by_medewerker_datum", (q) =>
      q.eq("medewerkerId", medewerkerId).eq("datum", datum)
    )
    .collect();
  return bepaalKwijting(
    rijen.filter((r) => r.userId.toString() === companyUserId.toString())
  );
}

async function schrijfKwijting(
  ctx: MutationCtx,
  veld: VeldContext,
  medewerker: Doc<"medewerkers">,
  datum: string
): Promise<void> {
  await ctx.db.insert("urenLogboek", {
    userId: veld.companyUserId,
    medewerkerId: medewerker._id,
    datum,
    actie: "dag_akkoord",
    details: `Dag ${datum} van ${medewerker.naam} akkoord verklaard door kantoor`,
    door: veld.user._id,
    createdAt: Date.now(),
  });
}

/**
 * Één dag akkoord verklaren. Idempotent: een tweede klik (of twee tabbladen)
 * schrijft geen tweede entry en geeft `alAkkoord: true` terug. Een dag die na
 * het akkoord heropend is, kan opnieuw gekweten worden — dat is een nieuwe
 * ronde, geen dubbele.
 */
export const keurDagGoed = mutation({
  args: {
    medewerkerId: v.id("medewerkers"),
    datum: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ gekweten: boolean; alAkkoord: boolean }> => {
    assertGeldigeDatum(args.datum);
    const veld = await kantoorContext(ctx);

    const medewerker = await ctx.db.get(args.medewerkerId);
    if (
      !medewerker ||
      medewerker.userId.toString() !== veld.companyUserId.toString()
    ) {
      throw new ConvexError("Medewerker niet gevonden");
    }
    const dagRij = await dagStatusVoor(
      ctx.db,
      veld.companyUserId,
      medewerker._id,
      args.datum
    );
    if (dagRij?.status !== "ingediend") {
      throw new ConvexError(
        "Alleen een ingediende dag kan akkoord verklaard worden"
      );
    }

    const kwijting = await kwijtingVoorDag(
      ctx,
      veld.companyUserId,
      medewerker._id,
      args.datum
    );
    if (kwijting.gekweten) return { gekweten: false, alAkkoord: true };

    await schrijfKwijting(ctx, veld, medewerker, args.datum);
    return { gekweten: true, alAkkoord: false };
  },
});

/**
 * Alle stille dagen van een week in één keer akkoord ("Alles akkoord").
 * Stil = ingediend, geen afwijkingsreden, nog niet gekweten — exact dezelfde
 * definitie als het blok *Wat kan door?* in `getControleWeek`, want beide
 * gebruiken `beoordeelWeek`. Afwijkende dagen blijven dus staan: die vragen
 * een blik, en die neemt deze knop niet weg.
 */
export const keurWeekGoed = mutation({
  args: { weekStart: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ gekweten: number }> => {
    const veld = await kantoorContext(ctx);
    const weekStart = args.weekStart ?? weekStartVan(vandaagAmsterdam());
    assertGeldigeWeekStart(weekStart);

    const { beoordeeld } = await beoordeelWeek(ctx, veld, weekStart);
    const stil = beoordeeld.filter(
      (d) => d.status === "ingediend" && !d.gekweten && d.redenen.length === 0
    );

    let gekweten = 0;
    for (const dag of stil) {
      const medewerker = await ctx.db.get(dag.medewerkerId);
      if (
        !medewerker ||
        medewerker.userId.toString() !== veld.companyUserId.toString()
      ) {
        continue;
      }
      // Dubbelcheck per dag: tussen berekening en schrijven kan een andere
      // kantoortab dezelfde dag al gekweten hebben.
      const bestaand = await kwijtingVoorDag(
        ctx,
        veld.companyUserId,
        dag.medewerkerId,
        dag.datum
      );
      if (bestaand.gekweten) continue;
      await schrijfKwijting(ctx, veld, medewerker, dag.datum);
      gekweten++;
    }
    return { gekweten };
  },
});
