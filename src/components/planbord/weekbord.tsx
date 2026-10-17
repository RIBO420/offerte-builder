"use client";

/**
 * Weekbord (PRD §2.2, weergave 1): resource-timeline met rijen = teams en
 * kolommen = dagen. Eigen grid + dnd-kit — zie het B3-besluit in adapter.ts.
 *
 * - Slepen = verplaatsen (dag/team); rand slepen = duur aanpassen.
 * - Bak → bord = plannen; bord → bak (of min-knop) = terug in de bak.
 * - Dupliceren met behoud van team/tijden; splitsen over dagen/teams.
 * - Ziekte/uitval-knop per team-dag; bemanning per team-dag; afwezigheid.
 * - Kantoor plant; voorman/medewerker kijkt mee (alles read-only).
 * - Elke planwijziging wordt server-side audit-gelogd (planbordLogboek).
 */

import { memo, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  addDagen,
  beschikbaarheidsHint,
  dagenTussen,
  magPlanbordMuteren,
} from "../../../convex/planbordLogica";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CalendarClock,
  CalendarOff,
  Copy,
  Minus,
  Scissors,
  UserX,
  Users,
} from "lucide-react";
import {
  naarBemanningCel,
  naarEvents,
  naarResources,
  eventsVoorTeamDag,
  type BakItem,
  type PlanbordEvent,
  type PlanbordResource,
} from "./adapter";
import { getISOWeek } from "date-fns";
import {
  PERIODES,
  bereikLabel,
  isWeekend,
  kolomDatums,
  kolomLabel,
  periodeBereik,
  schuifAnker,
  vandaagIso,
  type Periode,
} from "./periode";
import { Opdrachtenbak } from "./opdrachtenbak";
import {
  AfwezigheidDialog,
  BemanningDialog,
  DupliceerDialog,
  SplitsDialog,
  UitvalAlert,
} from "./dialogen";

// ============================================
// Blok (één gepland werkitem op het bord)
// ============================================

// React.memo: voorkomt dat elke bord-rerender (query-updates, dialogen,
// filterwissels) alle blokken opnieuw rendert; props zijn stabiel gemaakt
// via useCallback in Weekbord.
const WerkitemBlok = memo(function WerkitemBlok({
  event,
  spanKolommen,
  loopDoor = false,
  magMuteren,
  onOntplan,
  onDupliceer,
  onSplits,
}: {
  event: PlanbordEvent;
  /** Breedte in startcellen; mag een breuk zijn (smallere weekendkolommen). */
  spanKolommen: number;
  /** Het blok loopt door na het zichtbare bereik: rechts geen afronding, wel een pijl. */
  loopDoor?: boolean;
  magMuteren: boolean;
  onOntplan: (event: PlanbordEvent) => void;
  onDupliceer: (event: PlanbordEvent) => void;
  onSplits: (event: PlanbordEvent) => void;
}) {
  const duurDagen = dagenTussen(event.start, event.eind);
  const {
    attributes: blokAttributes,
    listeners: blokListeners,
    setNodeRef: setBlokRef,
    transform: blokTransform,
    isDragging: blokSleept,
  } = useDraggable({
    id: `blok-${event.id}`,
    data: { soort: "blok", werkitemId: event.id, duurDagen },
    disabled: !magMuteren,
  });
  const {
    attributes: resizeAttributes,
    listeners: resizeListeners,
    setNodeRef: setResizeRef,
    transform: resizeTransform,
  } = useDraggable({
    id: `resize-${event.id}`,
    data: { soort: "resize", werkitemId: event.id, start: event.start },
    disabled: !magMuteren,
  });

  const isBeurt = event.type === "onderhoudsbeurt";
  return (
    <div
      ref={setBlokRef}
      data-testid="werkitem-blok"
      style={{
        // Breedte in startcellen. Weekendkolommen zijn op de weekweergave
        // smaller, dus de factor kan een breuk zijn — de aanroeper rekent hem
        // uit op de kolomgewichten. De px-term telt de padding (2×6px) en de
        // 1px celrand mee die tussen de overgestoken cellen liggen.
        width: `calc(${spanKolommen * 100}% + ${(spanKolommen - 1) * 13}px)`,
        transform: CSS.Translate.toString(blokTransform),
        zIndex: blokSleept ? 40 : 10,
      }}
      // Statuskleur uit de tokenreceptuur (DESIGN.md): project = gepland
      // (steenblauw), onderhoudsbeurt = groen. Geen rauwe paletkleuren meer.
      className={`group relative border px-2.5 py-1.5 text-xs transition-shadow hover:shadow-md ${
        loopDoor ? "rounded-l-md rounded-r-sm border-r-0" : "rounded-md"
      } ${
        isBeurt
          ? "border-status-geaccepteerd-border bg-status-geaccepteerd"
          : "border-status-gepland-border bg-status-gepland"
      } ${magMuteren ? "cursor-grab" : ""} ${blokSleept ? "opacity-70 shadow-lg" : ""}`}
    >
      <div {...blokListeners} {...blokAttributes}>
        <p className="truncate pr-4 text-[13px] leading-5 font-semibold" title={event.titel}>
          {event.titel}
        </p>
        <p
          className={`flex items-center gap-1.5 truncate text-[11px] leading-4 tabular-nums ${
            isBeurt ? "text-status-geaccepteerd-text" : "text-status-gepland-text"
          }`}
        >
          <span
            aria-hidden="true"
            className={`size-1.5 shrink-0 rounded-full ${
              isBeurt ? "bg-status-geaccepteerd-dot" : "bg-status-gepland-dot"
            }`}
          />
          <span className="truncate">
            {event.startTijd && event.eindTijd
              ? `${event.startTijd}–${event.eindTijd}`
              : event.geschatteUren != null
                ? `${event.geschatteUren} u`
                : isBeurt
                  ? "Beurt"
                  : "Project"}
            {duurDagen > 0 ? ` · ${duurDagen + 1} dgn` : ""}
          </span>
          {loopDoor && (
            <ArrowRight
              className="ml-auto h-3 w-3 shrink-0"
              aria-label="loopt door na deze periode"
            />
          )}
        </p>
      </div>
      {magMuteren && (
        <>
          <div className="absolute right-0.5 top-0.5 hidden gap-0.5 group-hover:flex">
            <button
              title="Terug in de bak"
              className="rounded bg-background/80 p-0.5 hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                onOntplan(event);
              }}
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              title="Dupliceren naar andere dag (team en tijden blijven)"
              className="rounded bg-background/80 p-0.5 hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                onDupliceer(event);
              }}
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              title="Splitsen over dagen/teams"
              className="rounded bg-background/80 p-0.5 hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                onSplits(event);
              }}
            >
              <Scissors className="h-3 w-3" />
            </button>
          </div>
          <div
            ref={setResizeRef}
            {...resizeListeners}
            {...resizeAttributes}
            title="Sleep om de duur aan te passen"
            className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-r bg-foreground/10 hover:bg-foreground/30"
            style={{ transform: CSS.Translate.toString(resizeTransform) }}
          />
        </>
      )}
    </div>
  );
});

// ============================================
// Cel (één team × één dag)
// ============================================

const TeamDagCel = memo(function TeamDagCel({
  teamId,
  datum,
  children,
  weekend,
  vandaag,
  teamAfwezig,
}: {
  teamId: Id<"teams"> | null;
  datum: string;
  children: React.ReactNode;
  weekend: boolean;
  vandaag: boolean;
  teamAfwezig: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cel-${teamId ?? "zonder"}-${datum}`,
    data: { soort: "cel", teamId, datum },
  });
  return (
    <div
      ref={setNodeRef}
      data-testid="team-dag-cel"
      // group/cel: de bemanning- en dagkaartknoppen staan pas in beeld bij
      // hover of focus. Op elke cel "3/3" met twee iconen was ruis; wat
      // afwijkt (afwezig, aangepast) blijft wél altijd zichtbaar.
      className={`group/cel flex min-h-[84px] min-w-0 flex-col gap-1 border-b border-l border-border/60 p-1.5 ${
        weekend ? WEEKEND_ARCERING : ""
      } ${vandaag ? "bg-primary/[0.06]" : ""} ${
        teamAfwezig ? "bg-status-afgewezen/60" : ""
      } ${isOver ? "bg-primary/10 ring-1 ring-inset ring-primary" : ""}`}
    >
      {children}
    </div>
  );
});

/**
 * Weekend: schuine arcering naast de tint, zodat "geen gewone werkdag" ook
 * zonder kleur leesbaar is (DESIGN.md, Shapes). Zelfde patroon als het
 * dagbalk-gat.
 */
const WEEKEND_ARCERING =
  "bg-[repeating-linear-gradient(135deg,color-mix(in_oklch,var(--foreground)_4%,transparent)_0_5px,transparent_5px_10px)]";

/** Op de weekweergave krijgen za en zo ruim de helft van een werkdag. */
const WEEKEND_GEWICHT = 0.6;

/** "week 42" of "week 42–45" — ISO-weken, want de planning begint op maandag. */
function weekLabel(start: string, eind: string): string {
  const [van, tot] = [start, eind].map((d) => getISOWeek(new Date(`${d}T12:00:00`)));
  return van === tot ? `week ${van}` : `week ${van}–${tot}`;
}

// ============================================
// Weekbord
// ============================================

export function Weekbord() {
  const router = useRouter();
  const [periode, setPeriode] = useState<Periode>("week");
  const [anker, setAnker] = useState(vandaagIso());
  const [filterDatum, setFilterDatum] = useState<string | null>(null);

  const bereik = useMemo(() => periodeBereik(periode, anker), [periode, anker]);
  const kolommen = useMemo(
    () => kolomDatums(bereik.start, bereik.eind),
    [bereik]
  );

  // — Data (adapter: Convex → resources/events) —
  const rolInfo = useQuery(api.roles.getCurrentUserRole);
  const context = useQuery(api.planbord.getBordContext, bereik);
  const werkitems = useQuery(api.werkitems.listVoorPlanbord, bereik);
  const wachtrij = useQuery(api.planbord.getWachtrij, bereik) as
    | BakItem[]
    | undefined;

  const magMuteren = magPlanbordMuteren(rolInfo?.role);
  const resources: PlanbordResource[] = useMemo(
    () => (context ? naarResources(context) : []),
    [context]
  );
  const events: PlanbordEvent[] = useMemo(
    () => (werkitems ? naarEvents(werkitems) : []),
    [werkitems]
  );

  // — Mutations —
  const updatePlanning = useMutation(api.werkitems.updatePlanning);
  const dupliceer = useMutation(api.planbord.dupliceerWerkitem);
  const splits = useMutation(api.planbord.splitsWerkitem);
  const koppelLos = useMutation(api.planbord.koppelTeamLos);
  const setBemanning = useMutation(api.planbord.setBemanning);
  const herstelBemanning = useMutation(api.planbord.herstelBemanning);
  const createAfwezigheid = useMutation(api.planbord.createAfwezigheid);

  // — Dialogen —
  const [dupliceerEvent, setDupliceerEvent] = useState<PlanbordEvent | null>(null);
  const [splitsEvent, setSplitsEvent] = useState<PlanbordEvent | null>(null);
  const [uitvalDoel, setUitvalDoel] = useState<{
    teamId: Id<"teams">;
    teamNaam: string;
    datum: string;
  } | null>(null);
  const [bemanningDoel, setBemanningDoel] = useState<{
    teamId: Id<"teams">;
    teamNaam: string;
    datum: string;
  } | null>(null);
  const [afwezigheidOpen, setAfwezigheidOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const planMetWaarschuwing = useCallback(
    async (args: Parameters<typeof updatePlanning>[0]) => {
      const resultaat = await updatePlanning(args);
      if (resultaat?.waarschuwing) toast.warning(resultaat.waarschuwing);
    },
    [updatePlanning]
  );

  async function onDragEnd(e: DragEndEvent) {
    const actief = e.active.data.current as
      | { soort: "bak"; werkitemId: Id<"projecten"> }
      | { soort: "blok"; werkitemId: Id<"projecten">; duurDagen: number }
      | { soort: "resize"; werkitemId: Id<"projecten">; start: string }
      | undefined;
    const doel = e.over?.data.current as
      | { soort: "cel"; teamId: Id<"teams"> | null; datum: string }
      | { soort: "bak-drop" }
      | undefined;
    if (!actief || !doel) return;

    try {
      if (doel.soort === "bak-drop") {
        if (actief.soort === "blok") {
          // Terugslepen naar de bak = ontplannen
          await planMetWaarschuwing({
            id: actief.werkitemId,
            geplandeStart: null,
            geplandeEind: null,
            teamId: null,
          });
        }
        return;
      }

      if (actief.soort === "bak") {
        // Bak → bord = plannen (teamId + datums via updatePlanning)
        const bakItem = wachtrij?.find((w) => w._id === actief.werkitemId);
        const hint = bakItem
          ? beschikbaarheidsHint(bakItem.beschikbaarheidsVenster, doel.datum)
          : null;
        if (hint) toast.info(hint);
        await planMetWaarschuwing({
          id: actief.werkitemId,
          geplandeStart: doel.datum,
          geplandeEind: doel.datum,
          teamId: doel.teamId,
        });
      } else if (actief.soort === "blok") {
        // Verplaatsen met behoud van duur
        await planMetWaarschuwing({
          id: actief.werkitemId,
          geplandeStart: doel.datum,
          geplandeEind: addDagen(doel.datum, actief.duurDagen),
          teamId: doel.teamId,
        });
      } else if (actief.soort === "resize") {
        // Randen trekken = duur aanpassen (nooit vóór de startdag)
        const eind = doel.datum < actief.start ? actief.start : doel.datum;
        await planMetWaarschuwing({
          id: actief.werkitemId,
          geplandeEind: eind,
        });
      }
    } catch (fout) {
      toast.error(fout instanceof Error ? fout.message : "Plannen mislukt");
    }
  }

  const onOntplan = useCallback(
    async (event: PlanbordEvent) => {
      try {
        await planMetWaarschuwing({
          id: event.id,
          geplandeStart: null,
          geplandeEind: null,
          teamId: null,
        });
      } catch (fout) {
        toast.error(fout instanceof Error ? fout.message : "Ontplannen mislukt");
      }
    },
    [planMetWaarschuwing]
  );

  const vandaag = vandaagIso();
  // Weekweergave: vloeiend raster zonder minimumbreedte, met smallere
  // weekendkolommen — nooit zijwaarts scrollen (harde regel 1). Langere
  // periodes houden hun minimumbreedte: 28+ kolommen passen niet zonder.
  const compact = kolommen.length <= 7;
  const kolomGewicht = (datum: string) =>
    compact && isWeekend(datum) ? WEEKEND_GEWICHT : 1;
  // De teamkolom geeft mee op een smal scherm (max 28%), anders blijven er
  // op een telefoon alleen splinters van de dagkolommen over.
  const rasterKolommen = `${compact ? "min(220px, 28%)" : "160px"} ${kolommen
    .map((datum) => `minmax(0, ${kolomGewicht(datum)}fr)`)
    .join(" ")}`;
  const kolomBreedte = kolommen.length > 14 ? 64 : 110;
  const minBordBreedte = compact ? undefined : 160 + kolommen.length * kolomBreedte;
  /** Breedte van een blok in startcellen, op de kolomgewichten. */
  const spanFactor = (start: string, eind: string) => {
    const zichtbaar = kolommen.filter((d) => d >= start && d <= eind);
    if (zichtbaar.length === 0) return 1;
    const som = zichtbaar.reduce((t, d) => t + kolomGewicht(d), 0);
    return som / kolomGewicht(zichtbaar[0]);
  };
  const werkdagen = kolommen.filter((d) => !isWeekend(d));
  const bemanningCel = (teamId: Id<"teams">, datum: string) =>
    context ? naarBemanningCel(context, teamId, datum) : null;
  const eventsZonderTeam = events.filter((e) => e.resourceId === null);

  return (
    <div className="flex flex-wrap items-start gap-4">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="min-w-0 flex-[999_1_40rem] space-y-3">
          {/* Navigatie links, periode en afwezigheid rechts */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-3">
              <div className="flex overflow-hidden rounded-lg border">
                <button
                  type="button"
                  aria-label="Vorige periode"
                  onClick={() => setAnker(schuifAnker(periode, anker, -1))}
                  className="grid size-9 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAnker(vandaagIso())}
                  className="h-9 border-x px-3 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Vandaag
                </button>
                <button
                  type="button"
                  aria-label="Volgende periode"
                  onClick={() => setAnker(schuifAnker(periode, anker, 1))}
                  className="grid size-9 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <p className="flex items-baseline gap-2">
                <span className="text-base font-semibold tabular-nums">
                  {bereikLabel(bereik.start, bereik.eind)}
                </span>
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {weekLabel(bereik.start, bereik.eind)}
                </span>
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div
                role="radiogroup"
                aria-label="Periode"
                data-testid="periodetoggle"
                className="flex flex-wrap gap-0.5 rounded-lg bg-muted p-[3px]"
              >
                {PERIODES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={periode === p.id}
                    onClick={() => setPeriode(p.id)}
                    className={`h-[30px] whitespace-nowrap rounded-md px-2.5 text-[13px] transition-colors ${
                      periode === p.id
                        ? "bg-card font-semibold text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {magMuteren && (
                <Button size="sm" variant="outline" className="h-9" onClick={() => setAfwezigheidOpen(true)}>
                  <CalendarOff className="mr-1.5 h-4 w-4" />
                  Afwezigheid
                </Button>
              )}
            </div>
          </div>

          {/* Materieel-waarschuwingen (PRD §3.3): kapotte bus/machine op
              gekoppelde team-dagen + dubbel geclaimd schaars materieel.
              Waarschuwing, geen blokkade — zelfde toon als de
              seizoenswaarschuwing. */}
          {(context?.materieelWaarschuwingen?.length ?? 0) > 0 && (
            <div
              role="status"
              className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
            >
              <p className="mb-1 flex items-center gap-1 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Materieel-waarschuwingen
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {(() => {
                  // Groepeer identieke teksten (bv. kapotte bus, hele week)
                  const perTekst = new Map<string, string[]>();
                  for (const w of context!.materieelWaarschuwingen) {
                    const datums = perTekst.get(w.tekst) ?? [];
                    datums.push(w.datum);
                    perTekst.set(w.tekst, datums);
                  }
                  return [...perTekst.entries()].map(([tekst, datums]) => {
                    const gesorteerd = [...datums].sort();
                    const wanneer =
                      gesorteerd.length === 1
                        ? gesorteerd[0]
                        : `${gesorteerd[0]} t/m ${gesorteerd[gesorteerd.length - 1]}`;
                    return (
                      <li key={tekst}>
                        {tekst} ({wanneer})
                      </li>
                    );
                  });
                })()}
              </ul>
            </div>
          )}

          {/* Het bord */}
          <div className={`rounded-xl border bg-card ${compact ? "overflow-hidden" : "overflow-x-auto"}`}>
            <div style={{ minWidth: minBordBreedte }}>
              {/* Kolomkoppen */}
              <div className="grid border-b" style={{ gridTemplateColumns: rasterKolommen }}>
                <div className="flex flex-col justify-center px-3.5 py-2.5">
                  <span className="text-[13px] font-semibold">
                    {resources.length} {resources.length === 1 ? "ploeg" : "ploegen"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">bezetting werkdagen</span>
                </div>
                {kolommen.map((datum) => {
                  const label = kolomLabel(datum);
                  const isVandaag = datum === vandaag;
                  return (
                    <div
                      key={datum}
                      className={`min-w-0 border-l border-border/60 px-2.5 py-2 ${
                        isWeekend(datum) && !isVandaag ? WEEKEND_ARCERING : ""
                      } ${isVandaag ? "bg-primary/[0.06] shadow-[inset_0_-2px_0_var(--primary)]" : ""}`}
                    >
                      <p
                        className={`truncate text-[11px] ${
                          isVandaag ? "font-semibold text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {label.dag}
                        {isVandaag && <span className="sr-only"> (vandaag)</span>}
                      </p>
                      <p
                        className={`truncate text-[15px] leading-5 font-semibold tabular-nums ${
                          isVandaag ? "" : "text-muted-foreground"
                        }`}
                      >
                        {compact ? label.datum.split(" ")[0] : label.datum}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Teamrijen */}
              {context === undefined || werkitems === undefined ? (
                <p className="p-4 text-sm text-muted-foreground">Bord laden…</p>
              ) : resources.length === 0 ? (
                <EmptyState
                  icon={<Users aria-hidden />}
                  title="Nog geen actieve teams"
                  description="Maak eerst een team aan; daarna kun je hier werk inplannen."
                  action={{
                    label: "Naar teams",
                    onClick: () => router.push("/medewerkers/teams"),
                  }}
                />
              ) : (
                resources.map((team) => {
                  const bezet = werkdagen.map(
                    (datum) => eventsVoorTeamDag(events, team.id, datum).length > 0
                  );
                  const aantalBezet = bezet.filter(Boolean).length;
                  return (
                    <div
                      key={team.id}
                      className="grid"
                      style={{ gridTemplateColumns: rasterKolommen }}
                    >
                      <div className="flex min-w-0 flex-col justify-center gap-1 border-b border-border/60 px-3.5 py-2.5">
                        <p className="truncate text-sm font-semibold" title={team.naam}>
                          {team.naam}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {team.ledenDefault.length} vaste leden
                        </p>
                        {werkdagen.length > 0 && werkdagen.length <= 7 && (
                          <p className="flex items-center gap-2">
                            <span aria-hidden="true" className="flex gap-[3px]">
                              {bezet.map((isBezet, i) => (
                                <span
                                  key={werkdagen[i]}
                                  className={`h-1 w-3.5 rounded-full ${
                                    isBezet ? "bg-status-gepland-dot" : "bg-muted"
                                  }`}
                                />
                              ))}
                            </span>
                            <span
                              className={`text-[11px] tabular-nums ${
                                aantalBezet === 0 ? "text-accent-warm" : "text-muted-foreground"
                              }`}
                            >
                              <span className="sr-only">Bezet op </span>
                              {aantalBezet}/{werkdagen.length}
                              <span className="sr-only"> werkdagen</span>
                              {aantalBezet === 0 ? " · vrij" : ""}
                            </span>
                          </p>
                        )}
                      </div>
                      {kolommen.map((datum) => {
                        const cel = bemanningCel(team.id, datum);
                        const dagEvents = eventsVoorTeamDag(events, team.id, datum).filter(
                          // Alleen renderen op de eerste zichtbare dag van het blok
                          (ev) => ev.start === datum || (ev.start < bereik.start && datum === bereik.start)
                        );
                        const afwijkend =
                          !!cel &&
                          (cel.afwezigen.length > 0 || cel.teamAfwezig || cel.bron === "aangepast");
                        return (
                          <TeamDagCel
                            key={datum}
                            teamId={team.id}
                            datum={datum}
                            weekend={isWeekend(datum)}
                            vandaag={datum === vandaag}
                            teamAfwezig={cel?.teamAfwezig ?? false}
                          >
                            {dagEvents.map((ev) => {
                              const zichtbareStart = ev.start < bereik.start ? bereik.start : ev.start;
                              const zichtbaarEind = ev.eind > bereik.eind ? bereik.eind : ev.eind;
                              return (
                                <WerkitemBlok
                                  key={ev.id}
                                  event={ev}
                                  spanKolommen={spanFactor(zichtbareStart, zichtbaarEind)}
                                  loopDoor={ev.eind > bereik.eind}
                                  magMuteren={magMuteren}
                                  onOntplan={onOntplan}
                                  onDupliceer={setDupliceerEvent}
                                  onSplits={setSplitsEvent}
                                />
                              );
                            })}
                            {cel && (
                              <div
                                className={`mt-auto flex items-center justify-between gap-1 transition-opacity ${
                                  afwijkend
                                    ? ""
                                    : "opacity-0 group-hover/cel:opacity-100 focus-within:opacity-100"
                                }`}
                              >
                                <button
                                  type="button"
                                  data-testid="bemanning-knop"
                                  title={
                                    cel.bron === "aangepast"
                                      ? "Bemanning aangepast voor deze dag"
                                      : "Vaste teamleden"
                                  }
                                  disabled={!magMuteren}
                                  onClick={() =>
                                    setBemanningDoel({
                                      teamId: team.id,
                                      teamNaam: team.naam,
                                      datum,
                                    })
                                  }
                                  className={`flex min-h-6 min-w-0 items-center gap-1 rounded-full px-1.5 text-[11px] tabular-nums ${
                                    afwijkend
                                      ? "border border-status-verzonden-border bg-status-verzonden text-status-verzonden-text"
                                      : "text-muted-foreground"
                                  } ${magMuteren && !afwijkend ? "hover:bg-muted" : ""}`}
                                >
                                  <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
                                  <span className="truncate">
                                    {cel.medewerkerIds.length - cel.afwezigen.length}/
                                    {cel.medewerkerIds.length}
                                    {cel.teamAfwezig
                                      ? " · team afwezig"
                                      : cel.afwezigen.length > 0
                                        ? ` · ${cel.afwezigen.length} afwezig`
                                        : cel.bron === "aangepast"
                                          ? " · aangepast"
                                          : ""}
                                  </span>
                                </button>
                                <span className="flex shrink-0 items-center gap-0.5">
                                  <Link
                                    data-testid="dagkaart-link"
                                    href={`/planning/dagkaart?team=${team.id}&datum=${datum}`}
                                    title="Open dagkaart (route-weergave van deze team-dag)"
                                    aria-label="Open dagkaart"
                                    className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                                  >
                                    <CalendarClock className="h-3.5 w-3.5" />
                                  </Link>
                                  {magMuteren && (
                                    <button
                                      type="button"
                                      data-testid="uitval-knop"
                                      title="Ziekte/uitval: team deze dag loskoppelen"
                                      aria-label="Ziekte of uitval melden"
                                      onClick={() =>
                                        setUitvalDoel({
                                          teamId: team.id,
                                          teamNaam: team.naam,
                                          datum,
                                        })
                                      }
                                      className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-status-afgewezen-text"
                                    >
                                      <UserX className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </span>
                              </div>
                            )}
                          </TeamDagCel>
                        );
                      })}
                    </div>
                  );
                })
              )}

              {/* Gepland zonder team */}
              {eventsZonderTeam.length > 0 && (
                <div className="grid" style={{ gridTemplateColumns: rasterKolommen }}>
                  <div className="border-b border-border/60 px-3.5 py-2.5">
                    <p className="text-sm font-semibold text-status-verzonden-text">Zonder team</p>
                    <Badge variant="outline" className="text-[10px]">
                      nog toewijzen
                    </Badge>
                  </div>
                  {kolommen.map((datum) => (
                    <TeamDagCel
                      key={datum}
                      teamId={null}
                      datum={datum}
                      weekend={isWeekend(datum)}
                      vandaag={datum === vandaag}
                      teamAfwezig={false}
                    >
                      {eventsVoorTeamDag(eventsZonderTeam, null, datum)
                        .filter(
                          (ev) =>
                            ev.start === datum ||
                            (ev.start < bereik.start && datum === bereik.start)
                        )
                        .map((ev) => (
                          <WerkitemBlok
                            key={ev.id}
                            event={ev}
                            spanKolommen={1}
                            magMuteren={magMuteren}
                            onOntplan={onOntplan}
                            onDupliceer={setDupliceerEvent}
                            onSplits={setSplitsEvent}
                          />
                        ))}
                    </TeamDagCel>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Legenda: kleur is nooit het enige signaal, maar wel het snelste. */}
          <ul aria-label="Legenda" className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-status-gepland-dot" />
              Project
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-status-geaccepteerd-dot" />
              Onderhoudsbeurt
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-status-verzonden-dot" />
              Afwijkende bemanning of afwezigheid
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-2.5 w-4 rounded-sm outline outline-1 outline-border ${WEEKEND_ARCERING}`} />
              Weekend
            </li>
          </ul>

          {!magMuteren && (
            <p className="text-xs text-muted-foreground">
              Je kijkt mee met het planbord. Alleen kantoor (directie of
              projectleider) kan de planning wijzigen.
            </p>
          )}
        </div>

        {/* Wachtrij-zijbalk */}
        <Opdrachtenbak
          items={wachtrij}
          kolommen={kolommen}
          filterDatum={filterDatum}
          onFilterDatum={setFilterDatum}
          magSlepen={magMuteren}
        />
      </DndContext>

      {/* Dialogen */}
      <DupliceerDialog
        event={dupliceerEvent}
        onSluit={() => setDupliceerEvent(null)}
        onDupliceer={async (id, doelDatum) => {
          try {
            const resultaat = await dupliceer({ id, doelDatum });
            if (resultaat?.waarschuwing) toast.warning(resultaat.waarschuwing);
            toast.success("Werkitem gedupliceerd (team en tijden behouden)");
          } catch (fout) {
            toast.error(fout instanceof Error ? fout.message : "Dupliceren mislukt");
          }
        }}
      />
      <SplitsDialog
        event={splitsEvent}
        resources={resources}
        onSluit={() => setSplitsEvent(null)}
        onSplits={async (id, delen) => {
          try {
            await splits({ id, delen });
            toast.success(`Gesplitst in ${delen.length} delen`);
          } catch (fout) {
            toast.error(fout instanceof Error ? fout.message : "Splitsen mislukt");
          }
        }}
      />
      <UitvalAlert
        doel={uitvalDoel}
        onSluit={() => setUitvalDoel(null)}
        onBevestig={async (teamId, datum) => {
          try {
            const resultaat = await koppelLos({ teamId, datum });
            toast.success(
              `${resultaat.aantalTerugInBak} werkitem(s) terug in de bak`
            );
          } catch (fout) {
            toast.error(fout instanceof Error ? fout.message : "Loskoppelen mislukt");
          }
        }}
      />
      <BemanningDialog
        doel={bemanningDoel}
        medewerkerNamen={context?.medewerkerNamen ?? {}}
        huidige={
          bemanningDoel
            ? (bemanningCel(bemanningDoel.teamId, bemanningDoel.datum)?.medewerkerIds ?? [])
            : []
        }
        bron={
          bemanningDoel
            ? (bemanningCel(bemanningDoel.teamId, bemanningDoel.datum)?.bron ?? "default")
            : "default"
        }
        onSluit={() => setBemanningDoel(null)}
        onOpslaan={async (teamId, datum, medewerkerIds) => {
          try {
            await setBemanning({ teamId, datum, medewerkerIds });
            toast.success("Bemanning opgeslagen");
          } catch (fout) {
            toast.error(fout instanceof Error ? fout.message : "Opslaan mislukt");
          }
        }}
        onHerstel={async (teamId, datum) => {
          await herstelBemanning({ teamId, datum });
          toast.success("Terug naar vaste teamleden");
        }}
      />
      <AfwezigheidDialog
        open={afwezigheidOpen}
        resources={resources}
        medewerkerNamen={context?.medewerkerNamen ?? {}}
        onSluit={() => setAfwezigheidOpen(false)}
        onOpslaan={async (invoer) => {
          try {
            await createAfwezigheid(invoer);
            toast.success("Afwezigheid geplaatst");
          } catch (fout) {
            toast.error(fout instanceof Error ? fout.message : "Plaatsen mislukt");
          }
        }}
      />
    </div>
  );
}
