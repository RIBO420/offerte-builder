"use client";

/**
 * Route-dagkaart (PRD §2.2 weergave 2, stap 5b — spec Mickey): één ploeg, één
 * dag, chronologisch. Vertrek loods → reistijd → klantblok → pauze →
 * klantblok → … → loods-afronding → einde-dag-check.
 *
 * - Blokken zijn AFGELEID (server, convex/dagkaart.getDagkaart); alleen
 *   afwijkingen worden opgeslagen. Elke wijziging cascadeert live door
 *   (Convex-reactiviteit) en logt stil in het planbordLogboek — geen
 *   notificatie-spam.
 * - Klantblok = één geheel: slepen (dnd-kit) neemt taken én reistijden mee.
 * - Handmatige tijd/duur blijft altijd leidend; wissen = terug naar berekend.
 * - De datumnavigatie (vorige dag / Vandaag / volgende dag / kies datum) is
 *   het planvenster. Modus "vandaag" volgt de klok (live regie, ook na
 *   middernacht); elke andere dag is modus "planvenster".
 * - De tijdlijn is een lijst, geen tijdschaal: rijhoogtes zijn niet
 *   proportioneel, zodat slepen en tijden bewerken eenvoudig blijven.
 * - Kantoor muteert; voorman/medewerker leest mee (alles read-only).
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { addDagen, magPlanbordMuteren } from "../../../convex/planbordLogica";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  MapPin,
  RotateCcw,
  Route,
  Scissors,
  Users,
} from "lucide-react";
import { naarBemanningCel } from "./adapter";
import { dagVoluit, duurTekst } from "./datum-nl";
import { PlanStatusPil, planStatusConfig } from "./plan-status";
import { vandaagIso } from "./periode";

type Modus = "vandaag" | "planvenster";

type Dagkaart = FunctionReturnType<typeof api.dagkaart.getDagkaart>;
type DagBlok = Dagkaart["blokken"][number];
type DagStop = Dagkaart["stops"][number];

const meld = (fout: unknown, fallback: string) =>
  toast.error(fout instanceof Error ? fout.message : fallback);

const naarMinuten = (tijd: string) => {
  const [uur, minuut] = tijd.split(":").map(Number);
  return uur * 60 + minuut;
};

/** Enter in een tijdveld = opslaan (via blur), net als wegklikken. */
const blurBijEnter = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "Enter") e.currentTarget.blur();
};

/** Pauze-patroon: arcering naast kleur, zodat de pauze ook zonder kleur leesbaar is. */
const PAUZE_ARCERING =
  "bg-[repeating-linear-gradient(135deg,var(--muted)_0_5px,transparent_5px_10px)]";

// ============================================
// Tijdlijnrij: tijdkolom links, inhoud rechts aan een doorlopende lijn
// ============================================

type RijPositie = "eerste" | "midden" | "laatste";

function TijdlijnInhoud({
  positie,
  children,
}: {
  positie: RijPositie;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative min-w-0 pb-2 pl-6",
        "before:absolute before:left-[5px] before:w-px before:bg-border",
        positie === "eerste" && "before:top-2.5 before:bottom-0",
        positie === "midden" && "before:top-0 before:bottom-0",
        positie === "laatste" && "before:top-0 before:h-2.5"
      )}
    >
      {children}
    </div>
  );
}

function TijdLabel({ tijd }: { tijd: string }) {
  return (
    <span className="pt-0.5 text-right text-[11px] leading-5 text-muted-foreground tabular-nums">
      {tijd}
    </span>
  );
}

const RIJ = "grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3";

function HandmatigLabel() {
  return (
    <span className="rounded-full bg-surface-aandacht px-1.5 text-[11px] leading-4 text-foreground">
      handmatig
    </span>
  );
}

// ============================================
// Klantblok (sorteerbaar; blok = één geheel)
// ============================================

// React.memo: tijdens dnd-sorts en reactieve kaart-updates rendert alleen
// het blok dat wijzigt; de handlers zijn stabiel via useCallback in Dagkaart.
const KlantBlok = memo(function KlantBlok({
  blok,
  stop,
  pauze,
  positie,
  magMuteren,
  onStartTijd,
  onDuur,
  onHerstelTijden,
  onTaakLos,
}: {
  blok: DagBlok;
  stop: DagStop;
  /** Vaste pauze die binnen dit klantblok valt (het werk loopt eromheen). */
  pauze: DagBlok | null;
  positie: RijPositie;
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
  const kleur = planStatusConfig(stop.status).color;
  const titel = stop.klantNaam ?? stop.naam;
  const onderregel = [stop.klantNaam ? stop.naam : null, stop.adres]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(RIJ, isDragging && "relative z-10")}
    >
      <TijdLabel tijd={blok.start} />
      <TijdlijnInhoud positie={positie}>
        <div
          data-testid="dagkaart-klantblok"
          className={cn(
            "space-y-2 rounded-lg border p-3",
            kleur.bg,
            kleur.border,
            isDragging && "opacity-80 shadow-lg ring-2 ring-primary"
          )}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {magMuteren && (
              <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label={`Versleep ${stop.naam}`}
                className={cn(
                  "-ml-1 grid size-6 shrink-0 cursor-grab touch-none place-items-center rounded transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  kleur.text
                )}
              >
                <GripVertical aria-hidden="true" className="size-4" />
              </button>
            )}
            <span className="min-w-0 truncate text-[15px] font-semibold" title={titel}>
              {titel}
            </span>
            <span className={cn("text-[13px] tabular-nums", kleur.text)}>
              {blok.start}–{blok.eind}
            </span>
            <PlanStatusPil status={stop.status} className="ml-auto" />
          </div>

          {onderregel && (
            <p className={cn("flex items-start gap-1 text-[13px]", kleur.text)}>
              {stop.adres && (
                <MapPin aria-hidden="true" className="mt-[3px] size-3.5 shrink-0" />
              )}
              <span className="min-w-0">{onderregel}</span>
            </p>
          )}

          {stop.bijzonderheden && (
            /* Vast klantkenmerk. Bewust kort: het dossier mag 2000 tekens
               bevatten, de dagkaart toont er hooguit twee regels van (regel 1:
               nooit horizontaal scrollen). `title` geeft de rest. */
            <p
              className="line-clamp-2 rounded-md bg-surface-aandacht px-2 py-1 text-xs text-foreground"
              title={stop.bijzonderheden}
            >
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
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {taak.code}
                    </Badge>
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {taak.omschrijving}
                  </span>
                  {taak.normUren !== null && (
                    <span className={cn("text-xs tabular-nums", kleur.text)}>
                      {String(taak.normUren).replace(".", ",")} u
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
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        kleur.text
                      )}
                    >
                      <Scissors aria-hidden="true" className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Veldtaken uit meldingen (§2.4/§8.6): eigen regel in het
              klantblok, alleen zichtbaar als de getagde medewerker vandaag
              in dit team zit én dit klantblok op de dagkaart staat. */}
          {stop.veldtaken.length > 0 && (
            <ul className="space-y-1" data-testid="dagkaart-veldtaken">
              {stop.veldtaken.map((taak) => (
                <li
                  key={taak.veldtaakId}
                  className="flex items-center gap-2 rounded-md bg-card/70 px-2 py-1 text-sm"
                >
                  <Badge variant="outline" className="text-[11px]">
                    Veldtaak
                  </Badge>
                  <span className="min-w-0 flex-1 truncate">{taak.tekst}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    @{taak.medewerkerNaam}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {pauze && (
            <div
              data-testid="dagkaart-blok-pauze"
              className={cn(
                "flex flex-wrap items-center gap-x-2 rounded-md border px-2.5 py-1 text-xs",
                kleur.border,
                PAUZE_ARCERING
              )}
            >
              <span className="font-semibold">Pauze</span>
              <span className={cn("tabular-nums", kleur.text)}>
                {pauze.start}–{pauze.eind}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
            <label className="inline-flex h-7 items-center gap-1.5 rounded-md bg-card/70 px-2.5">
              <span className={kleur.text}>start</span>
              {magMuteren ? (
                <Input
                  type="time"
                  className="h-6 w-[5.5rem] border-0 bg-transparent px-1 text-xs font-semibold tabular-nums shadow-none md:text-xs dark:bg-transparent"
                  aria-label={`Starttijd ${stop.naam}`}
                  key={`start-${stop.handmatigeStartTijd ?? blok.start}`}
                  defaultValue={stop.handmatigeStartTijd ?? blok.start}
                  onKeyDown={blurBijEnter}
                  onBlur={(e) => {
                    const tijd = e.target.value;
                    if (tijd && tijd !== (stop.handmatigeStartTijd ?? blok.start)) {
                      onStartTijd(stop.werkitemId, tijd);
                    }
                  }}
                />
              ) : (
                <span className="font-semibold tabular-nums">{blok.start}</span>
              )}
              {blok.handmatigeStart && <HandmatigLabel />}
            </label>

            <label className="inline-flex h-7 items-center gap-1.5 rounded-md bg-card/70 px-2.5">
              <span className={kleur.text}>duur</span>
              {magMuteren ? (
                <>
                  <Input
                    type="text"
                    inputMode="numeric"
                    className="h-6 w-12 border-0 bg-transparent px-1 text-right text-xs font-semibold tabular-nums shadow-none md:text-xs dark:bg-transparent"
                    aria-label={`Duur in minuten ${stop.naam}`}
                    key={`duur-${stop.duurMinuten}`}
                    defaultValue={stop.duurMinuten}
                    onKeyDown={blurBijEnter}
                    onBlur={(e) => {
                      const minuten = Number(e.target.value.replace(",", "."));
                      if (
                        Number.isInteger(minuten) &&
                        minuten > 0 &&
                        minuten <= 1440 &&
                        minuten !== stop.duurMinuten
                      ) {
                        onDuur(stop.werkitemId, minuten);
                      } else if (minuten !== stop.duurMinuten) {
                        e.target.value = String(stop.duurMinuten);
                      }
                    }}
                  />
                  <span className={kleur.text}>min</span>
                  {stop.duurMinuten >= 60 && (
                    <span className="text-muted-foreground tabular-nums">
                      ({duurTekst(stop.duurMinuten)})
                    </span>
                  )}
                </>
              ) : (
                <span className="font-semibold tabular-nums">
                  {duurTekst(stop.duurMinuten)}
                </span>
              )}
              {stop.duurOverrideMinuten !== null && <HandmatigLabel />}
            </label>

            {magMuteren && heeftOverride && (
              <Button
                variant="outline"
                size="xs"
                className={cn(
                  "h-7 bg-transparent px-2.5 shadow-none hover:bg-card/70 dark:bg-transparent",
                  kleur.border,
                  kleur.text
                )}
                onClick={() => onHerstelTijden(stop.werkitemId)}
              >
                <RotateCcw aria-hidden="true" />
                Terug naar berekend
              </Button>
            )}
          </div>
        </div>
      </TijdlijnInhoud>
    </li>
  );
});

// ============================================
// Vaste blokken (markers, reistijd, pauze, loods-afronding)
// ============================================

function VastBlok({ blok, positie }: { blok: DagBlok; positie: RijPositie }) {
  const testId = `dagkaart-blok-${blok.soort}`;
  let inhoud: ReactNode;

  if (blok.soort === "vertrek" || blok.soort === "einde_dag") {
    inhoud = (
      <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-[5px] left-0 size-[11px] rounded-full border-2 border-primary",
            blok.soort === "einde_dag" ? "bg-primary" : "bg-card"
          )}
        />
        <span className="font-semibold">
          {blok.soort === "vertrek" ? "Vertrek loods" : "Einde-dag-check"}
        </span>
        <span className="text-muted-foreground tabular-nums">{blok.start}</span>
      </div>
    );
  } else if (blok.soort === "reistijd") {
    inhoud = (
      <div className="rounded-md border border-dashed px-3 py-0.5 text-xs text-muted-foreground tabular-nums">
        {blok.start}–{blok.eind} · reistijd
        {blok.reistijdMinuten ? ` ${blok.reistijdMinuten} min` : ""}
      </div>
    );
  } else if (blok.soort === "pauze") {
    inhoud = (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2 rounded-md border px-3 py-1 text-xs",
          PAUZE_ARCERING
        )}
      >
        <span className="font-semibold">Pauze</span>
        <span className="text-muted-foreground tabular-nums">
          {blok.start}–{blok.eind}
        </span>
      </div>
    );
  } else {
    inhoud = (
      <div className="flex flex-wrap items-center gap-x-2 rounded-md border bg-muted px-3 py-1 text-xs">
        <span className="font-semibold">Loods-afronding</span>
        <span className="text-muted-foreground tabular-nums">
          {blok.start}–{blok.eind} · aanhanger en afval, materieel, defecten
        </span>
      </div>
    );
  }

  return (
    <li data-testid={testId} className={RIJ}>
      <TijdLabel tijd={blok.start} />
      <TijdlijnInhoud positie={positie}>{inhoud}</TijdlijnInhoud>
    </li>
  );
}

// ============================================
// Zijkolom: dagindeling (dag-afwijking, alleen kantoor)
// ============================================

type AfwijkingVelden = {
  vertrekTijd?: string;
  pauzeStart?: string;
  pauzeEind?: string;
  loodsAfrondingMinuten?: number;
};

function TijdVeld({
  id,
  label,
  ariaLabel,
  waarde,
  onWijzig,
}: {
  id: string;
  label: string;
  ariaLabel: string;
  waarde: string;
  onWijzig: (tijd: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        type="time"
        className="h-9 tabular-nums"
        aria-label={ariaLabel}
        key={`${id}-${waarde}`}
        defaultValue={waarde}
        onKeyDown={blurBijEnter}
        onBlur={(e) => {
          if (e.target.value && e.target.value !== waarde) {
            onWijzig(e.target.value);
          }
        }}
      />
    </div>
  );
}

function DagindelingPaneel({
  kaart,
  magMuteren,
  onAfwijking,
  onHerstel,
}: {
  kaart: Dagkaart;
  magMuteren: boolean;
  onAfwijking: (velden: AfwijkingVelden) => void;
  onHerstel: () => void;
}) {
  const s = kaart.standaarden;
  return (
    <SectiePaneel
      titel="Dagindeling"
      kopbalk
      uitleg="Wijzigingen gelden alleen voor deze ploeg op deze dag; alles erna schuift automatisch mee."
    >
      {magMuteren ? (
        <div className="space-y-3 p-3">
          <div className="grid grid-cols-2 gap-2.5">
            <TijdVeld
              id="dagindeling-vertrek"
              label="Vertrek"
              ariaLabel="Vertrektijd loods (deze dag)"
              waarde={s.vertrekTijd}
              onWijzig={(tijd) => onAfwijking({ vertrekTijd: tijd })}
            />
            <div className="flex min-w-0 flex-col gap-1">
              <label
                htmlFor="dagindeling-afronding"
                className="text-xs text-muted-foreground"
              >
                Afronding (min)
              </label>
              <Input
                id="dagindeling-afronding"
                type="text"
                inputMode="numeric"
                className="h-9 tabular-nums"
                aria-label="Loods-afronding in minuten (deze dag)"
                key={`afronding-${s.loodsAfrondingMinuten}`}
                defaultValue={s.loodsAfrondingMinuten}
                onKeyDown={blurBijEnter}
                onBlur={(e) => {
                  const minuten = Number(e.target.value.replace(",", "."));
                  if (
                    Number.isInteger(minuten) &&
                    minuten >= 0 &&
                    minuten <= 1440 &&
                    minuten !== s.loodsAfrondingMinuten
                  ) {
                    onAfwijking({ loodsAfrondingMinuten: minuten });
                  } else if (minuten !== s.loodsAfrondingMinuten) {
                    e.target.value = String(s.loodsAfrondingMinuten);
                  }
                }}
              />
            </div>
            <TijdVeld
              id="dagindeling-pauzestart"
              label="Pauze van"
              ariaLabel="Pauzestart (deze dag)"
              waarde={s.pauzeStart}
              onWijzig={(tijd) => onAfwijking({ pauzeStart: tijd })}
            />
            <TijdVeld
              id="dagindeling-pauzeeind"
              label="tot"
              ariaLabel="Pauze-einde (deze dag)"
              waarde={s.pauzeEind}
              onWijzig={(tijd) => onAfwijking({ pauzeEind: tijd })}
            />
          </div>
          {kaart.heeftDagAfwijking && (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 text-muted-foreground"
              onClick={onHerstel}
            >
              <RotateCcw aria-hidden="true" />
              Standaard herstellen
            </Button>
          )}
        </div>
      ) : (
        <dl className="grid grid-cols-[1fr_auto] gap-y-2 p-3 text-[13px]">
          <dt className="text-muted-foreground">Vertrek</dt>
          <dd className="font-semibold tabular-nums">{s.vertrekTijd}</dd>
          <dt className="text-muted-foreground">Pauze</dt>
          <dd className="font-semibold tabular-nums">
            {s.pauzeStart}–{s.pauzeEind}
          </dd>
          <dt className="text-muted-foreground">Afronding</dt>
          <dd className="font-semibold tabular-nums">
            {s.loodsAfrondingMinuten} min
          </dd>
        </dl>
      )}
    </SectiePaneel>
  );
}

// ============================================
// Dagkaart
// ============================================

export function Dagkaart() {
  const router = useRouter();
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

  /** Datumnavigatie = planvenster; vandaag valt terug op live regie. */
  const gaNaarDatum = (nieuw: string) => {
    if (!nieuw) return;
    if (nieuw === vandaagIso()) {
      setModus("vandaag");
    } else {
      setModus("planvenster");
      setPlanDatum(nieuw);
    }
  };
  const datumKiezer = useRef<HTMLInputElement>(null);
  const openDatumKiezer = () => {
    const veld = datumKiezer.current;
    if (!veld) return;
    try {
      veld.showPicker();
    } catch {
      veld.focus();
      veld.click();
    }
  };

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

  // "Stel volgorde voor" (bijlage B, route-intelligentie stap 2): preview op
  // aanvraag — de query draait pas na de klik en de planner beslist
  // (overnemen = bestaande herordenDag; verwerpen = paneel sluiten).
  const [toonVoorstel, setToonVoorstel] = useState(false);
  // Team-/datumwissel sluit het voorstel: state tijdens render bijstellen
  // (zelfde patroon als vorigeParams hierboven — geen effect).
  const [voorstelContext, setVoorstelContext] = useState(`${teamId}|${datum}`);
  if (voorstelContext !== `${teamId}|${datum}`) {
    setVoorstelContext(`${teamId}|${datum}`);
    setToonVoorstel(false);
  }
  const voorstel = useQuery(
    api.dagkaart.getVolgordeVoorstel,
    toonVoorstel && magMuteren && teamId ? { teamId, datum } : "skip"
  );

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

  /**
   * Rijen van de tijdlijn. Een pauze die binnen een klantblok valt (het werk
   * loopt eromheen door) staat ín dat blok, niet als losse rij erna — anders
   * lijkt het alsof de pauze pas na het werk komt.
   */
  const rijen = useMemo(() => {
    if (!kaart) return [];
    const pauze = kaart.blokken.find((b) => b.soort === "pauze") ?? null;
    const gastBlok = pauze
      ? kaart.blokken.find(
          (b) =>
            b.soort === "klant" &&
            naarMinuten(b.start) <= naarMinuten(pauze.start) &&
            naarMinuten(pauze.start) < naarMinuten(b.eind)
        )
      : undefined;
    return kaart.blokken
      .filter((b) => !(gastBlok && b === pauze))
      .map((blok) => ({
        blok,
        pauze: gastBlok && blok === gastBlok ? pauze : null,
      }));
  }, [kaart]);

  const samenvatting = useMemo(() => {
    if (!kaart) return null;
    const vertrek = kaart.blokken.find((b) => b.soort === "vertrek");
    const einde = kaart.blokken.find((b) => b.soort === "einde_dag");
    return {
      werkdag:
        kaart.stops.length > 0 && vertrek && einde
          ? `${vertrek.start}–${einde.start}`
          : "—",
      bijKlant: kaart.stops.reduce((som, s) => som + s.duurMinuten, 0),
      reistijd: kaart.blokken
        .filter((b) => b.soort === "reistijd")
        .reduce((som, b) => som + (b.reistijdMinuten ?? 0), 0),
      klanten: kaart.stops.length,
    };
  }, [kaart]);

  const bemanning = useMemo(() => {
    if (!context || !teamId) return null;
    const cel = naarBemanningCel(context, teamId, datum);
    return {
      ...cel,
      leden: cel.medewerkerIds.map((id) => ({
        id,
        naam: context.medewerkerNamen[id] ?? "Onbekende medewerker",
        afwezig: cel.afwezigen.includes(id),
      })),
    };
  }, [context, teamId, datum]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

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

  // Stabiele handlers (useCallback) zodat de gememoiseerde KlantBlok's niet
  // op elke render van de kaart opnieuw renderen.
  const onStartTijd = useCallback(
    async (id: Id<"projecten">, tijd: string | null) => {
      try {
        await setTijd({ id, geplandeStartTijd: tijd });
      } catch (fout) {
        meld(fout, "Starttijd aanpassen mislukt");
      }
    },
    [setTijd]
  );
  const onDuur = useCallback(
    async (id: Id<"projecten">, minuten: number | null) => {
      try {
        await setTijd({ id, duurOverrideMinuten: minuten });
      } catch (fout) {
        meld(fout, "Duur aanpassen mislukt");
      }
    },
    [setTijd]
  );
  const onHerstelTijden = useCallback(
    async (id: Id<"projecten">) => {
      try {
        await setTijd({ id, geplandeStartTijd: null, duurOverrideMinuten: null });
      } catch (fout) {
        meld(fout, "Herstellen mislukt");
      }
    },
    [setTijd]
  );
  const onTaakLos = useCallback(
    async (id: Id<"projecten">, index: number, omschrijving: string) => {
      try {
        await taakLos({ id, taakIndex: index });
        toast.success(`"${omschrijving}" staat als rest-opdracht in de bak`);
      } catch (fout) {
        meld(fout, "Taak losmaken mislukt");
      }
    },
    [taakLos]
  );
  const onVoorstelOvernemen = async () => {
    if (!voorstel || !teamId) return;
    try {
      await herorden({
        teamId,
        datum,
        werkitemIds: voorstel.volgorde.map((v) => v.werkitemId),
      });
      toast.success("Voorgestelde volgorde overgenomen");
      setToonVoorstel(false);
    } catch (fout) {
      meld(fout, "Volgorde overnemen mislukt");
    }
  };
  const onTeamLos = async () => {
    if (!teamId || !kaart) return;
    if (
      !window.confirm(
        `${kaart.team.naam} loskoppelen op ${dagVoluit(datum).toLowerCase()}? Alle opdrachten van deze dag gaan terug in de opdrachtenbak.`
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
      meld(fout, "Ploeg loskoppelen mislukt");
    }
  };
  const onAfwijking = async (velden: AfwijkingVelden) => {
    if (!teamId) return;
    try {
      await setAfwijking({ teamId, datum, ...velden });
    } catch (fout) {
      meld(fout, "Dagindeling aanpassen mislukt");
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

  const teams = context?.teams ?? [];

  return (
    <div className="@container space-y-4">
      {/* Werkbalk: dag (= planvenster) links, ploeg rechts */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <div className="flex overflow-hidden rounded-md border">
            <button
              type="button"
              aria-label="Vorige dag"
              onClick={() => gaNaarDatum(addDagen(datum, -1))}
              className="grid size-[34px] place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-pressed={modus === "vandaag"}
              onClick={() => setModus("vandaag")}
              className={cn(
                "h-[34px] border-x px-3 text-[13px] font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                modus === "vandaag" && "bg-muted"
              )}
            >
              Vandaag
            </button>
            <button
              type="button"
              aria-label="Volgende dag"
              onClick={() => gaNaarDatum(addDagen(datum, 1))}
              className="grid size-[34px] place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
          <h2
            className="font-display text-lg font-semibold tabular-nums"
            aria-live="polite"
          >
            {dagVoluit(datum, vandaagIso())}
          </h2>
          <div className="relative">
            <button
              type="button"
              aria-label="Kies een datum"
              onClick={openDatumKiezer}
              className="grid size-[34px] place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <CalendarDays aria-hidden="true" className="size-4" />
            </button>
            {/* Native datumkiezer achter de knop; zelf niet te focussen */}
            <input
              ref={datumKiezer}
              type="date"
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-0"
              value={datum}
              onChange={(e) => gaNaarDatum(e.target.value)}
            />
          </div>
        </div>

        {teams.length > 0 && (
          <div
            role="group"
            aria-label="Ploeg"
            className="ml-auto flex flex-wrap gap-0.5 rounded-lg bg-muted p-[3px]"
          >
            {teams.map((team) => {
              const actief = team._id === teamId;
              return (
                <button
                  key={team._id}
                  type="button"
                  aria-pressed={actief}
                  onClick={() => setTeamId(team._id)}
                  className={cn(
                    "h-[30px] max-w-[12rem] truncate rounded-md px-3 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    actief
                      ? "bg-card font-semibold text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {team.naam}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Zonder team wordt de kaart-query geskipt en blijft `kaart` undefined;
          check daarom eerst op context + teamId, anders blijft "laden…" eeuwig
          staan op omgevingen zonder actieve teams. */}
      {context === undefined || (teamId !== null && kaart === undefined) ? (
        <p className="text-sm text-muted-foreground">Dagkaart laden…</p>
      ) : !teamId || kaart === undefined ? (
        <EmptyState
          icon={<Users aria-hidden />}
          title="Nog geen actieve teams"
          description="Maak eerst een team aan; daarna verschijnt hier de dagkaart van dat team."
          action={{
            label: "Naar teams",
            onClick: () => router.push("/medewerkers/teams"),
          }}
        />
      ) : (
        <div className="grid items-start gap-4 @4xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-4">
            {/* Volgordevoorstel (preview) — de planner beslist: overnemen of
                verwerpen. Handmatig vastgezette starttijden blijven staan. */}
            {toonVoorstel && magMuteren && (
              <div
                className="space-y-2 rounded-lg border bg-muted/40 p-3"
                data-testid="volgorde-voorstel"
              >
                {voorstel === undefined ? (
                  <p className="text-sm text-muted-foreground">
                    Volgorde berekenen…
                  </p>
                ) : voorstel === null || !voorstel.gewijzigd ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      {voorstel === null
                        ? "Geen voorstel mogelijk: minder dan twee stops of alle stops staan handmatig vast."
                        : "De huidige volgorde is al de kortste route volgens de bekende reistijden."}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setToonVoorstel(false)}
                    >
                      Sluiten
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium">
                      Voorgestelde volgorde (kortste route vanaf de loods
                      {voorstel.reistijdBron === "standaard"
                        ? ", op standaard-reistijden"
                        : ""}
                      ):
                    </p>
                    <ol className="list-inside list-decimal text-sm">
                      {voorstel.volgorde.map((stop) => (
                        <li key={stop.werkitemId}>{stop.naam}</li>
                      ))}
                    </ol>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      Geschatte reistijd {voorstel.nieuweReistijdMinuten} min in
                      plaats van {voorstel.oudeReistijdMinuten} min
                      {voorstel.tijdwinstMinuten > 0
                        ? ` — ${voorstel.tijdwinstMinuten} min winst`
                        : ""}
                      . Handmatig vastgezette tijden blijven staan.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={onVoorstelOvernemen}>
                        Overnemen
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setToonVoorstel(false)}
                      >
                        Verwerpen
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            <section
              aria-label={`Dagverloop ${kaart.team.naam}`}
              className="rounded-lg border bg-card px-3 py-4 @md:px-4"
            >
              {kaart.stops.length === 0 ? (
                <p className="text-sm text-muted-foreground">
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
                    <ol>
                      {rijen.map(({ blok, pauze }, index) => {
                        const positie: RijPositie =
                          index === 0
                            ? "eerste"
                            : index === rijen.length - 1
                              ? "laatste"
                              : "midden";
                        if (blok.soort !== "klant") {
                          return (
                            <VastBlok
                              key={`${blok.soort}-${index}`}
                              blok={blok}
                              positie={positie}
                            />
                          );
                        }
                        const stop = stopsPerId.get(String(blok.werkitemId));
                        if (!stop) return null;
                        return (
                          <KlantBlok
                            key={stop.werkitemId}
                            blok={blok}
                            stop={stop}
                            pauze={pauze}
                            positie={positie}
                            magMuteren={magMuteren}
                            onStartTijd={onStartTijd}
                            onDuur={onDuur}
                            onHerstelTijden={onHerstelTijden}
                            onTaakLos={onTaakLos}
                          />
                        );
                      })}
                    </ol>
                  </SortableContext>
                </DndContext>
              )}
              {kaart.stops.length > 0 && (
                <p className="mt-2 pl-[3.5rem] text-xs text-muted-foreground">
                  {magMuteren
                    ? "Sleep een klantblok om te herordenen. Pas je een tijd of duur aan, dan schuift alles erna mee."
                    : "Je kijkt mee; alleen kantoor past de dagkaart aan."}
                </p>
              )}
            </section>
          </div>

          <aside
            aria-label={`Dag van ${kaart.team.naam}`}
            className="flex min-w-0 flex-col gap-4"
          >
            {samenvatting && (
              <SectiePaneel titel="De dag in het kort" kopbalk>
                <div className="space-y-3 p-3">
                  <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-[13px]">
                    <dt className="text-muted-foreground">Werkdag</dt>
                    <dd className="font-semibold tabular-nums">
                      {samenvatting.werkdag}
                    </dd>
                    <dt className="text-muted-foreground">Bij de klant</dt>
                    <dd className="font-semibold tabular-nums">
                      {duurTekst(samenvatting.bijKlant)}
                    </dd>
                    <dt className="text-muted-foreground">Reistijd</dt>
                    <dd className="font-semibold tabular-nums">
                      {duurTekst(samenvatting.reistijd)}
                    </dd>
                    <dt className="text-muted-foreground">Klanten</dt>
                    <dd className="font-semibold tabular-nums">
                      {samenvatting.klanten}
                    </dd>
                  </dl>
                  {kaart.reistijdBron === "standaard" && kaart.stops.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Reistijden zijn de standaard per verplaatsing; er is geen
                      routeplanner gekoppeld.
                    </p>
                  )}
                  {bemanning && (
                    <div className="flex flex-col gap-1 border-t pt-3">
                      <span className="text-xs text-muted-foreground">
                        Bemanning
                        {bemanning.bron === "aangepast"
                          ? " · aangepast voor deze dag"
                          : ""}
                      </span>
                      {bemanning.teamAfwezig ? (
                        <span className="text-[13px]">Hele ploeg afwezig</span>
                      ) : bemanning.leden.length === 0 ? (
                        <span className="text-[13px] text-muted-foreground">
                          Geen bemanning ingesteld
                        </span>
                      ) : (
                        <ul className="text-[13px]">
                          {bemanning.leden.map((lid, index) => (
                            <li key={lid.id} className="inline">
                              <span
                                className={cn(
                                  lid.afwezig && "text-muted-foreground line-through"
                                )}
                              >
                                {lid.naam}
                              </span>
                              {lid.afwezig && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  (afwezig)
                                </span>
                              )}
                              {index < bemanning.leden.length - 1 ? ", " : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </SectiePaneel>
            )}

            <DagindelingPaneel
              kaart={kaart}
              magMuteren={magMuteren}
              onAfwijking={onAfwijking}
              onHerstel={onHerstelAfwijking}
            />

            <div className="flex flex-col gap-2">
              {magMuteren && kaart.stops.length > 1 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setToonVoorstel(true)}
                >
                  <Route aria-hidden="true" />
                  Stel volgorde voor
                </Button>
              )}
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/planning/weekbord?datum=${datum}`}>Open deze week op het weekbord</Link>
              </Button>
              {magMuteren && kaart.stops.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/50"
                    onClick={onTeamLos}
                  >
                    Ploeg loskoppelen voor deze dag
                  </Button>
                  <p className="text-xs text-pretty text-muted-foreground">
                    Bij ziekte of uitval: het werk van deze dag gaat terug in de
                    opdrachtenbak.
                  </p>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
