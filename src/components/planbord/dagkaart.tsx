"use client";

/**
 * Route-dagkaart (PRD §2.2 weergave 2, stap 5b — spec Mickey): één team, één
 * dag, chronologisch. Vertrek loods → reistijd → klantblok → pauze →
 * klantblok → … → loods-afronding → einde-dag-check.
 *
 * - Blokken zijn AFGELEID (server, convex/dagkaart.getDagkaart); alleen
 *   afwijkingen worden opgeslagen. Elke wijziging cascadeert live door
 *   (Convex-reactiviteit) en logt stil in het planbordLogboek — geen
 *   notificatie-spam.
 * - Klantblok = één geheel: slepen (dnd-kit) neemt taken én reistijden mee.
 * - Handmatige tijd/duur blijft altijd leidend; wissen = terug naar berekend.
 * - Modus Vandaag (live regie) / Planvenster (datumkeuze) — zelfde kaart.
 * - Kantoor muteert; voorman/medewerker leest mee (alles read-only).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { magPlanbordMuteren } from "../../../convex/planbordLogica";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Clock,
  Coffee,
  Flag,
  GripVertical,
  Home,
  MapPin,
  RotateCcw,
  Route,
  Scissors,
  Truck,
  UserX,
  Warehouse,
} from "lucide-react";
import { vandaagIso } from "./periode";

type Modus = "vandaag" | "planvenster";

type Dagkaart = FunctionReturnType<typeof api.dagkaart.getDagkaart>;
type DagBlok = Dagkaart["blokken"][number];
type DagStop = Dagkaart["stops"][number];

const STATUS_LABELS: Record<string, string> = {
  gepland: "Gepland",
  in_uitvoering: "In uitvoering",
  uitgevoerd: "Uitgevoerd",
  afgerond: "Afgerond",
  deels_uitgevoerd: "Deels uitgevoerd",
};

// ============================================
// Klantblok (sorteerbaar; blok = één geheel)
// ============================================

function KlantBlok({
  blok,
  stop,
  magMuteren,
  onStartTijd,
  onDuur,
  onHerstelTijden,
  onTaakLos,
}: {
  blok: DagBlok;
  stop: DagStop;
  magMuteren: boolean;
  onStartTijd: (id: Id<"projecten">, tijd: string | null) => void;
  onDuur: (id: Id<"projecten">, minuten: number | null) => void;
  onHerstelTijden: (id: Id<"projecten">) => void;
  onTaakLos: (id: Id<"projecten">, index: number, omschrijving: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.werkitemId, disabled: !magMuteren });

  const heeftOverride =
    stop.handmatigeStartTijd !== null || stop.duurOverrideMinuten !== null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="dagkaart-klantblok"
      className={`rounded-md border bg-card p-3 shadow-sm ${
        isDragging ? "opacity-60 ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {magMuteren && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Versleep ${stop.naam}`}
            className="mt-1 cursor-grab touch-none text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold tabular-nums">
              {blok.start}–{blok.eind}
            </span>
            <span className="truncate font-medium">
              {stop.klantNaam ?? stop.naam}
            </span>
            <Badge variant="outline">
              {STATUS_LABELS[stop.status] ?? stop.status}
            </Badge>
            {blok.handmatigeStart && (
              <Badge variant="secondary" title="Handmatige starttijd — blijft leidend">
                handmatig
              </Badge>
            )}
          </div>
          {stop.adres && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {stop.adres}
            </p>
          )}
          {stop.bijzonderheden && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {stop.bijzonderheden}
            </p>
          )}

          {stop.taken.length > 0 && (
            <ul className="space-y-1">
              {stop.taken.map((taak, index) => (
                <li
                  key={`${taak.omschrijving}-${index}`}
                  className="flex items-center gap-2 text-sm"
                >
                  {taak.code && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {taak.code}
                    </Badge>
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {taak.omschrijving}
                  </span>
                  {taak.normUren !== null && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {taak.normUren} u
                    </span>
                  )}
                  {magMuteren && stop.taken.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        onTaakLos(stop.werkitemId, index, taak.omschrijving)
                      }
                      title="Taak losmaken → rest-opdracht terug in de bak"
                      aria-label={`Maak taak ${taak.omschrijving} los`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Scissors className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {magMuteren && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <Input
                  type="time"
                  className="h-7 w-[100px] text-xs"
                  aria-label={`Starttijd ${stop.naam}`}
                  key={`start-${stop.handmatigeStartTijd ?? blok.start}`}
                  defaultValue={stop.handmatigeStartTijd ?? blok.start}
                  onBlur={(e) => {
                    const tijd = e.target.value;
                    if (tijd && tijd !== (stop.handmatigeStartTijd ?? blok.start)) {
                      onStartTijd(stop.werkitemId, tijd);
                    }
                  }}
                />
              </label>
              <label className="flex items-center gap-1">
                <span className="text-muted-foreground">duur</span>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  className="h-7 w-[76px] text-xs"
                  aria-label={`Duur in minuten ${stop.naam}`}
                  key={`duur-${stop.duurMinuten}`}
                  defaultValue={stop.duurMinuten}
                  onBlur={(e) => {
                    const minuten = Number(e.target.value);
                    if (
                      Number.isFinite(minuten) &&
                      minuten > 0 &&
                      minuten !== stop.duurMinuten
                    ) {
                      onDuur(stop.werkitemId, minuten);
                    }
                  }}
                />
                <span className="text-muted-foreground">min</span>
              </label>
              {heeftOverride && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onHerstelTijden(stop.werkitemId)}
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Terug naar berekend
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Vaste blokken (reistijd, pauze, loods, markers)
// ============================================

function VastBlok({ blok }: { blok: DagBlok }) {
  const inhoud = {
    vertrek: { icoon: Truck, label: "Vertrek loods" },
    reistijd: {
      icoon: Route,
      label: `Reistijd${blok.reistijdMinuten ? ` (${blok.reistijdMinuten} min)` : ""}`,
    },
    pauze: { icoon: Coffee, label: "Pauze" },
    loods_afronding: {
      icoon: Warehouse,
      label: "Loods-afronding (aanhanger/afval, materieel, defecten)",
    },
    einde_dag: { icoon: Flag, label: "Einde-dag-check" },
    klant: { icoon: Home, label: "" },
  }[blok.soort];
  const Icoon = inhoud.icoon;
  const marker = blok.soort === "vertrek" || blok.soort === "einde_dag";
  return (
    <div
      data-testid={`dagkaart-blok-${blok.soort}`}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground"
    >
      <Icoon className="h-4 w-4 shrink-0" />
      <span className="font-mono text-xs tabular-nums">
        {marker ? blok.start : `${blok.start}–${blok.eind}`}
      </span>
      <span>{inhoud.label}</span>
    </div>
  );
}

// ============================================
// Standaardblokken-regelaar (dag-afwijking, alleen kantoor)
// ============================================

function StandaardblokkenBalk({
  kaart,
  magMuteren,
  onAfwijking,
  onHerstel,
}: {
  kaart: Dagkaart;
  magMuteren: boolean;
  onAfwijking: (velden: {
    vertrekTijd?: string;
    pauzeStart?: string;
    pauzeEind?: string;
    loodsAfrondingMinuten?: number;
  }) => void;
  onHerstel: () => void;
}) {
  const s = kaart.standaarden;
  if (!magMuteren) {
    return (
      <p className="text-xs text-muted-foreground">
        Vertrek {s.vertrekTijd} · pauze {s.pauzeStart}–{s.pauzeEind} ·
        loods-afronding {s.loodsAfrondingMinuten} min
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <label className="flex items-center gap-1">
        <span className="text-muted-foreground">vertrek</span>
        <Input
          type="time"
          className="h-7 w-[96px] text-xs"
          aria-label="Vertrektijd loods (deze dag)"
          key={`vertrek-${s.vertrekTijd}`}
          defaultValue={s.vertrekTijd}
          onBlur={(e) => {
            if (e.target.value && e.target.value !== s.vertrekTijd) {
              onAfwijking({ vertrekTijd: e.target.value });
            }
          }}
        />
      </label>
      <label className="flex items-center gap-1">
        <span className="text-muted-foreground">pauze</span>
        <Input
          type="time"
          className="h-7 w-[96px] text-xs"
          aria-label="Pauzestart (deze dag)"
          key={`pauzestart-${s.pauzeStart}`}
          defaultValue={s.pauzeStart}
          onBlur={(e) => {
            if (e.target.value && e.target.value !== s.pauzeStart) {
              onAfwijking({ pauzeStart: e.target.value });
            }
          }}
        />
        <span>–</span>
        <Input
          type="time"
          className="h-7 w-[96px] text-xs"
          aria-label="Pauze-einde (deze dag)"
          key={`pauzeeind-${s.pauzeEind}`}
          defaultValue={s.pauzeEind}
          onBlur={(e) => {
            if (e.target.value && e.target.value !== s.pauzeEind) {
              onAfwijking({ pauzeEind: e.target.value });
            }
          }}
        />
      </label>
      <label className="flex items-center gap-1">
        <span className="text-muted-foreground">afronding</span>
        <Input
          type="number"
          min={0}
          max={1440}
          className="h-7 w-[70px] text-xs"
          aria-label="Loods-afronding in minuten (deze dag)"
          key={`afronding-${s.loodsAfrondingMinuten}`}
          defaultValue={s.loodsAfrondingMinuten}
          onBlur={(e) => {
            const minuten = Number(e.target.value);
            if (
              Number.isFinite(minuten) &&
              minuten >= 0 &&
              minuten !== s.loodsAfrondingMinuten
            ) {
              onAfwijking({ loodsAfrondingMinuten: minuten });
            }
          }}
        />
        <span className="text-muted-foreground">min</span>
      </label>
      {kaart.heeftDagAfwijking && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onHerstel}
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          Standaard herstellen
        </Button>
      )}
    </div>
  );
}

// ============================================
// Dagkaart
// ============================================

export function Dagkaart() {
  const zoekparams = useSearchParams();
  const datumParam = zoekparams.get("datum");
  const teamParam = zoekparams.get("team") as Id<"teams"> | null;

  // Deep-link (?team=..&datum=..) opent het planvenster op die dag
  const [modus, setModus] = useState<Modus>(() =>
    datumParam && datumParam !== vandaagIso() ? "planvenster" : "vandaag"
  );
  const [planDatum, setPlanDatum] = useState(() => datumParam ?? vandaagIso());
  const [gekozenTeamId, setTeamId] = useState<Id<"teams"> | null>(teamParam);

  // Client-navigatie naar dezelfde route met andere params (bv. een andere
  // cel op het weekbord): state tijdens render bijstellen — geen effect.
  const [vorigeParams, setVorigeParams] = useState(zoekparams.toString());
  if (zoekparams.toString() !== vorigeParams) {
    setVorigeParams(zoekparams.toString());
    setTeamId(teamParam);
    if (datumParam) {
      setModus(datumParam !== vandaagIso() ? "planvenster" : "vandaag");
      setPlanDatum(datumParam);
    }
  }

  const datum = modus === "vandaag" ? vandaagIso() : planDatum;

  const rolInfo = useQuery(api.roles.getCurrentUserRole);
  const magMuteren = magPlanbordMuteren(rolInfo?.role);

  const context = useQuery(api.planbord.getBordContext, {
    start: datum,
    eind: datum,
  });
  // Default = eerste actieve team; expliciete keuze wint
  const teamId = gekozenTeamId ?? context?.teams[0]?._id ?? null;

  const kaart = useQuery(
    api.dagkaart.getDagkaart,
    teamId ? { teamId, datum } : "skip"
  );

  const herorden = useMutation(api.dagkaart.herordenDag);
  const setTijd = useMutation(api.dagkaart.setTijdOverride);
  const setAfwijking = useMutation(api.dagkaart.setDagAfwijking);
  const taakLos = useMutation(api.dagkaart.maakTaakLos);
  const koppelLos = useMutation(api.planbord.koppelTeamLos);
  const berekenReistijden = useAction(api.dagkaart.berekenReistijdenVoorDag);

  // Reistijden (bij)berekenen zodra de kaart opent — no-op zonder Maps-key
  useEffect(() => {
    if (!teamId) return;
    berekenReistijden({ teamId, datum }).catch(() => {
      // Fail-closed: de kaart toont dan de standaard-reistijd
    });
  }, [teamId, datum, berekenReistijden]);

  const stopsPerId = useMemo(() => {
    const map = new Map<string, DagStop>();
    for (const stop of kaart?.stops ?? []) map.set(stop.werkitemId, stop);
    return map;
  }, [kaart?.stops]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const meld = (fout: unknown, fallback: string) =>
    toast.error(fout instanceof Error ? fout.message : fallback);

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!kaart || !teamId || !over || active.id === over.id) return;
    const ids = kaart.stops.map((s) => s.werkitemId);
    const van = ids.indexOf(active.id as Id<"projecten">);
    const naar = ids.indexOf(over.id as Id<"projecten">);
    if (van < 0 || naar < 0) return;
    try {
      await herorden({
        teamId,
        datum,
        werkitemIds: arrayMove(ids, van, naar),
      });
    } catch (fout) {
      meld(fout, "Herordenen mislukt");
    }
  };

  const onStartTijd = async (id: Id<"projecten">, tijd: string | null) => {
    try {
      await setTijd({ id, geplandeStartTijd: tijd });
    } catch (fout) {
      meld(fout, "Starttijd aanpassen mislukt");
    }
  };
  const onDuur = async (id: Id<"projecten">, minuten: number | null) => {
    try {
      await setTijd({ id, duurOverrideMinuten: minuten });
    } catch (fout) {
      meld(fout, "Duur aanpassen mislukt");
    }
  };
  const onHerstelTijden = async (id: Id<"projecten">) => {
    try {
      await setTijd({ id, geplandeStartTijd: null, duurOverrideMinuten: null });
    } catch (fout) {
      meld(fout, "Herstellen mislukt");
    }
  };
  const onTaakLos = async (
    id: Id<"projecten">,
    index: number,
    omschrijving: string
  ) => {
    try {
      await taakLos({ id, taakIndex: index });
      toast.success(`"${omschrijving}" staat als rest-opdracht in de bak`);
    } catch (fout) {
      meld(fout, "Taak losmaken mislukt");
    }
  };
  const onTeamLos = async () => {
    if (!teamId || !kaart) return;
    if (
      !window.confirm(
        `Team ${kaart.team.naam} loskoppelen van ${datum}? Alle opdrachten van deze dag gaan terug in de bak.`
      )
    ) {
      return;
    }
    try {
      const resultaat = await koppelLos({ teamId, datum });
      toast.success(
        `${resultaat.aantalTerugInBak} werkitem(s) terug in de bak`
      );
    } catch (fout) {
      meld(fout, "Team loskoppelen mislukt");
    }
  };
  const onAfwijking = async (velden: {
    vertrekTijd?: string;
    pauzeStart?: string;
    pauzeEind?: string;
    loodsAfrondingMinuten?: number;
  }) => {
    if (!teamId) return;
    try {
      await setAfwijking({ teamId, datum, ...velden });
    } catch (fout) {
      meld(fout, "Standaardblokken aanpassen mislukt");
    }
  };
  const onHerstelAfwijking = async () => {
    if (!teamId) return;
    try {
      await setAfwijking({ teamId, datum, herstel: true });
    } catch (fout) {
      meld(fout, "Herstellen mislukt");
    }
  };

  return (
    <div className="space-y-4">
      {/* Kop: modus, datum + team (loskoppelbaar/omwisselbaar) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border p-0.5">
          <Button
            variant={modus === "vandaag" ? "default" : "ghost"}
            size="sm"
            onClick={() => setModus("vandaag")}
          >
            Vandaag
          </Button>
          <Button
            variant={modus === "planvenster" ? "default" : "ghost"}
            size="sm"
            onClick={() => setModus("planvenster")}
          >
            Planvenster
          </Button>
        </div>
        {modus === "planvenster" && (
          <Input
            type="date"
            className="h-9 w-[150px]"
            aria-label="Datum"
            value={planDatum}
            onChange={(e) => {
              if (e.target.value) setPlanDatum(e.target.value);
            }}
          />
        )}
        <select
          aria-label="Team"
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={teamId ?? ""}
          onChange={(e) => setTeamId((e.target.value || null) as Id<"teams"> | null)}
        >
          {(context?.teams ?? []).map((team) => (
            <option key={team._id} value={team._id}>
              {team.naam}
            </option>
          ))}
        </select>
        {magMuteren && kaart && kaart.stops.length > 0 && (
          <Button variant="outline" size="sm" onClick={onTeamLos}>
            <UserX className="mr-1 h-4 w-4" />
            Team loskoppelen
          </Button>
        )}
        <div className="ml-auto">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/planning/weekbord">Naar weekbord</Link>
          </Button>
        </div>
      </div>

      {kaart === undefined || context === undefined ? (
        <p className="text-sm text-muted-foreground">Dagkaart laden…</p>
      ) : !teamId ? (
        <p className="text-sm text-muted-foreground">
          Nog geen actieve teams. Maak eerst een team aan onder Teams.
        </p>
      ) : (
        <div className="rounded-lg border">
          <div className="space-y-1 border-b bg-muted/40 p-3">
            <p className="text-sm font-medium">
              {kaart.team.naam} · {kaart.datum}
              {kaart.reistijdBron === "standaard" && (
                <span
                  className="ml-2 text-xs font-normal text-muted-foreground"
                  title="Geen Google Maps-key op deze omgeving; reistijden zijn de instelbare standaard per verplaatsing"
                >
                  (standaard-reistijden)
                </span>
              )}
            </p>
            <StandaardblokkenBalk
              kaart={kaart}
              magMuteren={magMuteren}
              onAfwijking={onAfwijking}
              onHerstel={onHerstelAfwijking}
            />
          </div>

          {kaart.stops.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Geen opdrachten op deze dag. Plan opdrachten via het weekbord.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={kaart.stops.map((s) => s.werkitemId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1 p-2">
                  {kaart.blokken.map((blok, index) => {
                    if (blok.soort !== "klant") {
                      return <VastBlok key={`${blok.soort}-${index}`} blok={blok} />;
                    }
                    const stop = stopsPerId.get(String(blok.werkitemId));
                    if (!stop) return null;
                    return (
                      <KlantBlok
                        key={stop.werkitemId}
                        blok={blok}
                        stop={stop}
                        magMuteren={magMuteren}
                        onStartTijd={onStartTijd}
                        onDuur={onDuur}
                        onHerstelTijden={onHerstelTijden}
                        onTaakLos={onTaakLos}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
}
