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

import { useMemo, useState } from "react";
import Link from "next/link";
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
import {
  ChevronLeft,
  ChevronRight,
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

function WerkitemBlok({
  event,
  spanKolommen,
  magMuteren,
  onOntplan,
  onDupliceer,
  onSplits,
}: {
  event: PlanbordEvent;
  spanKolommen: number;
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
        width: `calc(${spanKolommen * 100}% + ${(spanKolommen - 1) * 0}px)`,
        transform: CSS.Translate.toString(blokTransform),
        zIndex: blokSleept ? 40 : 10,
      }}
      className={`group relative rounded border p-1 text-xs shadow-sm ${
        isBeurt
          ? "border-emerald-300 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950"
          : "border-blue-300 bg-blue-100 dark:border-blue-800 dark:bg-blue-950"
      } ${magMuteren ? "cursor-grab" : ""} ${blokSleept ? "opacity-70" : ""}`}
    >
      <div {...blokListeners} {...blokAttributes}>
        <p className="truncate pr-4 font-medium">{event.titel}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {event.startTijd && event.eindTijd
            ? `${event.startTijd}–${event.eindTijd}`
            : event.geschatteUren != null
              ? `${event.geschatteUren} u`
              : isBeurt
                ? "Beurt"
                : "Project"}
          {duurDagen > 0 ? ` · ${duurDagen + 1} dgn` : ""}
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
}

// ============================================
// Cel (één team × één dag)
// ============================================

function TeamDagCel({
  teamId,
  datum,
  children,
  weekend,
  teamAfwezig,
}: {
  teamId: Id<"teams"> | null;
  datum: string;
  children: React.ReactNode;
  weekend: boolean;
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
      className={`min-h-[72px] space-y-1 border-b border-r p-1 ${
        weekend ? "bg-muted/40" : ""
      } ${teamAfwezig ? "bg-red-50 dark:bg-red-950/30" : ""} ${
        isOver ? "bg-primary/10 ring-1 ring-inset ring-primary" : ""
      }`}
    >
      {children}
    </div>
  );
}

// ============================================
// Weekbord
// ============================================

export function Weekbord() {
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

  async function planMetWaarschuwing(args: Parameters<typeof updatePlanning>[0]) {
    const resultaat = await updatePlanning(args);
    if (resultaat?.waarschuwing) toast.warning(resultaat.waarschuwing);
  }

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

  async function onOntplan(event: PlanbordEvent) {
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
  }

  const kolomBreedte = kolommen.length > 14 ? 64 : 110;
  const bemanningCel = (teamId: Id<"teams">, datum: string) =>
    context ? naarBemanningCel(context, teamId, datum) : null;
  const eventsZonderTeam = events.filter((e) => e.resourceId === null);

  return (
    <div className="flex gap-4">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="min-w-0 flex-1 space-y-3">
          {/* Periodetoggle + navigatie */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1" data-testid="periodetoggle">
              {PERIODES.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={periode === p.id ? "default" : "outline"}
                  onClick={() => setPeriode(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setAnker(schuifAnker(periode, anker, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-40 text-center text-sm font-medium">
                {bereikLabel(bereik.start, bereik.eind)}
              </span>
              <Button size="sm" variant="outline" onClick={() => setAnker(schuifAnker(periode, anker, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAnker(vandaagIso())}>
                Vandaag
              </Button>
              {magMuteren && (
                <Button size="sm" variant="outline" onClick={() => setAfwezigheidOpen(true)}>
                  <CalendarOff className="mr-1 h-4 w-4" />
                  Afwezigheid
                </Button>
              )}
            </div>
          </div>

          {/* Het bord */}
          <div className="overflow-x-auto rounded-lg border">
            <div style={{ minWidth: 160 + kolommen.length * kolomBreedte }}>
              {/* Kolomkoppen */}
              <div
                className="grid border-b bg-muted/50"
                style={{ gridTemplateColumns: `160px repeat(${kolommen.length}, 1fr)` }}
              >
                <div className="border-r p-2 text-xs font-semibold">Team</div>
                {kolommen.map((datum) => {
                  const label = kolomLabel(datum);
                  return (
                    <div
                      key={datum}
                      className={`border-r p-1 text-center text-[11px] ${
                        isWeekend(datum) ? "bg-muted/60" : ""
                      } ${datum === vandaagIso() ? "font-bold text-primary" : ""}`}
                    >
                      <div>{label.dag}</div>
                      <div>{label.datum}</div>
                    </div>
                  );
                })}
              </div>

              {/* Teamrijen */}
              {context === undefined || werkitems === undefined ? (
                <p className="p-4 text-sm text-muted-foreground">Bord laden…</p>
              ) : resources.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Nog geen actieve teams. Maak eerst een team aan onder Teams.
                </p>
              ) : (
                resources.map((team) => (
                  <div
                    key={team.id}
                    className="grid"
                    style={{ gridTemplateColumns: `160px repeat(${kolommen.length}, 1fr)` }}
                  >
                    <div className="border-b border-r p-2">
                      <p className="text-sm font-medium">{team.naam}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {team.ledenDefault.length} vaste leden
                      </p>
                    </div>
                    {kolommen.map((datum) => {
                      const cel = bemanningCel(team.id, datum);
                      const dagEvents = eventsVoorTeamDag(events, team.id, datum).filter(
                        // Alleen renderen op de eerste zichtbare dag van het blok
                        (ev) => ev.start === datum || (ev.start < bereik.start && datum === bereik.start)
                      );
                      return (
                        <TeamDagCel
                          key={datum}
                          teamId={team.id}
                          datum={datum}
                          weekend={isWeekend(datum)}
                          teamAfwezig={cel?.teamAfwezig ?? false}
                        >
                          {dagEvents.map((ev) => {
                            const zichtbareStart = ev.start < bereik.start ? bereik.start : ev.start;
                            const zichtbaarEind = ev.eind > bereik.eind ? bereik.eind : ev.eind;
                            const span = Math.min(
                              dagenTussen(zichtbareStart, zichtbaarEind) + 1,
                              kolommen.length
                            );
                            return (
                              <WerkitemBlok
                                key={ev.id}
                                event={ev}
                                spanKolommen={Math.max(1, span)}
                                magMuteren={magMuteren}
                                onOntplan={onOntplan}
                                onDupliceer={setDupliceerEvent}
                                onSplits={setSplitsEvent}
                              />
                            );
                          })}
                          {cel && (
                            <div className="flex items-center justify-between pt-0.5">
                              <button
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
                                className={`flex items-center gap-0.5 rounded px-1 text-[10px] ${
                                  cel.afwezigen.length > 0 || cel.teamAfwezig
                                    ? "text-red-600"
                                    : "text-muted-foreground"
                                } ${cel.bron === "aangepast" ? "font-semibold" : ""} ${
                                  magMuteren ? "hover:bg-muted" : ""
                                }`}
                              >
                                <Users className="h-3 w-3" />
                                {cel.medewerkerIds.length - cel.afwezigen.length}/
                                {cel.medewerkerIds.length}
                              </button>
                              <span className="flex items-center gap-0.5">
                                <Link
                                  data-testid="dagkaart-link"
                                  href={`/planning/dagkaart?team=${team.id}&datum=${datum}`}
                                  title="Open dagkaart (route-weergave van deze team-dag)"
                                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  <CalendarClock className="h-3 w-3" />
                                </Link>
                                {magMuteren && (
                                  <button
                                    data-testid="uitval-knop"
                                    title="Ziekte/uitval: team deze dag loskoppelen"
                                    onClick={() =>
                                      setUitvalDoel({
                                        teamId: team.id,
                                        teamNaam: team.naam,
                                        datum,
                                      })
                                    }
                                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-red-600"
                                  >
                                    <UserX className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            </div>
                          )}
                        </TeamDagCel>
                      );
                    })}
                  </div>
                ))
              )}

              {/* Gepland zonder team */}
              {eventsZonderTeam.length > 0 && (
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `160px repeat(${kolommen.length}, 1fr)` }}
                >
                  <div className="border-b border-r p-2">
                    <p className="text-sm font-medium text-amber-700">Zonder team</p>
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
