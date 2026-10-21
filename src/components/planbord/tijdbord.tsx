"use client";

/**
 * Tijdbord (HERO-nabouw fase 4, docs/hero-nabouw/planning/PLANNING-MODULE.md):
 * het planbord op een tijdas. Rijen = teams (of medewerkers), kolommen =
 * dagen, binnen elke dag de werkdag als tijdas.
 *
 * - Slepen = verplaatsen naar een andere dag, tijd of team (I-1); stap 15 min,
 *   in brede weergaven 1 uur (I-3); live de nieuwe tijden (I-4).
 * - Randen aan beide kanten trekken (I-2): binnen de dag = tijd, naar een
 *   andere dag = dagen erbij of eraf.
 * - Pijltjes ±15 min, shift+pijl ±1 dag (I-6); ctrl+z / ctrl+shift+z (I-7).
 * - Overlap = rode rand, niet blokkeren (I-11).
 * - Uit de bak: begintijd waar je loslaat, dagen volgens begrote uren.
 * - Verlof: aangevraagd gestreept (waarschuwing), goedgekeurd/ziek effen.
 * - Werkt met muis en aanraken (tablet: even vasthouden om te slepen).
 *
 * Datamodel en rekenregels: convex/tijdbordLogica.ts; geometrie: tijdas.ts.
 * Schrijven gaat via werkitems.updatePlanning (zelfde pad als het weekbord).
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CirclePlay,
  CloudRain,
  Copy,
  Inbox,
  MoreHorizontal,
  Redo2,
  Scissors,
  Undo2,
  UserX,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { addDagen, dagenTussen, magPlanbordMuteren } from "../../../convex/planbordLogica";
import {
  afwezigLabel,
  afwezigOp,
  blokkeertInplannen,
  geplandeManuren,
  isWerkdag,
  korteTijdLabel,
  minutenNaarTijd,
  naarVolgendeWerkdag,
  schuif,
  tijdNaarMinuten,
  trekEind,
  trekStart,
  vensterVan,
  verplaats,
  voorstelUitBak,
  werkdagUit,
  werkdagenIn,
  type BordAfwezigheid,
  type Plan,
  type Werkdag,
} from "../../../convex/tijdbordLogica";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVorigeData } from "@/hooks/use-vorige-data";
import {
  naarBemanningCel,
  naarEvents,
  naarResources,
  type BakItem,
  type PlanbordEvent,
} from "./adapter";
import { bereikLabel, isWeekend, kolomDatums, kolomKop, periodeBereik, schuifAnker, vandaagIso } from "./periode";
import { minuutOpX, overlapt, segmentPositie, uurMarkeringen } from "./tijdas";
import { Opdrachtenbak } from "./opdrachtenbak";

type Weergave = "dag" | "week" | "14dagen";
type Rijen = "teams" | "medewerkers";

const WEERGAVEN: { id: Weergave; label: string }[] = [
  { id: "dag", label: "Dag" },
  { id: "week", label: "Week" },
  { id: "14dagen", label: "2 weken" },
];

const OPSLAG_SLEUTEL = "tijdbord-voorkeur";

interface Voorkeur {
  weergave: Weergave;
  weekend: boolean;
  rijen: Rijen;
}

function leesVoorkeur(): Voorkeur {
  const standaard: Voorkeur = { weergave: "week", weekend: false, rijen: "teams" };
  try {
    const ruw = window.localStorage.getItem(OPSLAG_SLEUTEL);
    return ruw ? { ...standaard, ...(JSON.parse(ruw) as Partial<Voorkeur>) } : standaard;
  } catch {
    return standaard;
  }
}

function bewaarVoorkeur(v: Voorkeur): void {
  try {
    window.localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify(v));
  } catch {
    // privévenster of geblokkeerde opslag: dan onthoudt het bord het niet
  }
}

/** Planning zoals updatePlanning hem kent; geplandeStart null = in de bak. */
interface PlanStand {
  plan: Plan | null;
  teamId: Id<"teams"> | null;
}

interface Stap {
  id: Id<"projecten">;
  voor: PlanStand;
  na: PlanStand;
}

/** Eén handeling op het bord (kan meerdere blokken raken) — één undo-stap. */
interface Wijziging {
  titel: string;
  stappen: Stap[];
}

function planVan(ev: PlanbordEvent, werkdag: Werkdag): Plan {
  const v = vensterVan(
    { geplandeStartTijd: ev.startTijd, geplandeEindTijd: ev.eindTijd },
    werkdag
  );
  return {
    geplandeStart: ev.start,
    geplandeEind: ev.eind,
    geplandeStartTijd: minutenNaarTijd(v.start),
    geplandeEindTijd: minutenNaarTijd(v.eind),
  };
}

function dagLabel(plan: Plan): string {
  const dagen = dagenTussen(plan.geplandeStart, plan.geplandeEind) + 1;
  return dagen > 1 ? `${korteTijdLabel(plan)} · ${dagen} dgn` : korteTijdLabel(plan);
}

// ============================================
// Cel (team × dag) en blok-segment
// ============================================

function TijdCel({
  teamId,
  datum,
  hoogte,
  grijs,
  onbemand,
  onKlik,
  children,
}: {
  teamId: Id<"teams"> | null;
  datum: string;
  hoogte: number;
  grijs: boolean;
  onbemand: boolean;
  /** Klik op een lege plek (I-10) */
  onKlik?: (e: React.MouseEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tcel-${teamId ?? "zonder"}-${datum}`,
    data: { soort: "tcel", teamId, datum },
  });
  return (
    <div
      ref={setNodeRef}
      data-tcel-datum={datum}
      data-tcel-team={teamId ?? ""}
      style={{ height: hoogte }}
      onClick={onKlik}
      className={`relative border-l border-t ${grijs ? "bg-muted/50" : "bg-card"} ${
        isOver ? "bg-accent/60" : ""
      } ${onbemand ? "outline outline-1 -outline-offset-1 outline-amber-400/70" : ""}`}
    >
      {children}
    </div>
  );
}

interface SegmentProps {
  ev: PlanbordEvent;
  plan: Plan;
  datum: string;
  baan: number;
  werkdag: Werkdag;
  isEerste: boolean;
  isLaatste: boolean;
  geselecteerd: boolean;
  overlap: boolean;
  magMuteren: boolean;
  sleepLabel: string | null;
  urenLabel: { tekst: string; tekort: boolean } | null;
  vasteTijd: boolean;
  voortgang: { status: string; gewerkt?: number };
  onSelecteer: (id: Id<"projecten">, toevoegen: boolean) => void;
  onMenu: (x: number, y: number, id: Id<"projecten">) => void;
  onRandStart: (e: React.PointerEvent, ev: PlanbordEvent, plan: Plan, kant: "start" | "eind") => void;
}

const BAAN_HOOGTE = 34;
const KOP_HOOGTE = 18;

const Segment = memo(function Segment({
  ev,
  plan,
  datum,
  baan,
  werkdag,
  isEerste,
  isLaatste,
  geselecteerd,
  overlap,
  magMuteren,
  sleepLabel,
  urenLabel,
  vasteTijd,
  voortgang,
  onSelecteer,
  onMenu,
  onRandStart,
}: SegmentProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tblok-${ev.id}-${datum}`,
    data: { soort: "tblok", werkitemId: ev.id, dagIndex: dagenTussen(plan.geplandeStart, datum) },
    disabled: !magMuteren,
  });
  const pos = segmentPositie(
    tijdNaarMinuten(plan.geplandeStartTijd),
    tijdNaarMinuten(plan.geplandeEindTijd),
    werkdag
  );
  const isBeurt = ev.type === "onderhoudsbeurt";
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      aria-pressed={geselecteerd}
      aria-label={`${ev.titel}, ${dagLabel(plan)}`}
      data-testid="tijdbord-blok"
      onClick={(e) => {
        e.stopPropagation();
        onSelecteer(ev.id, e.shiftKey || e.metaKey || e.ctrlKey);
      }}
      onContextMenu={(e) => {
        if (!magMuteren) return;
        e.preventDefault();
        e.stopPropagation();
        onMenu(e.clientX, e.clientY, ev.id);
      }}
      style={{
        left: `${pos.left}%`,
        width: `max(${pos.width}%, 6px)`,
        top: KOP_HOOGTE + baan * BAAN_HOOGTE + 2,
        height: BAAN_HOOGTE - 4,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 40 : geselecteerd ? 20 : 10,
        touchAction: magMuteren ? "none" : undefined,
      }}
      className={`group absolute select-none overflow-hidden border px-1.5 text-[11px] leading-4 ${
        isEerste && !pos.afgekaptLinks ? "rounded-l-md" : ""
      } ${isLaatste && !pos.afgekaptRechts ? "rounded-r-md" : ""} ${
        isBeurt
          ? "border-status-geaccepteerd-border bg-status-geaccepteerd"
          : "border-status-gepland-border bg-status-gepland"
      } ${vasteTijd ? "" : "border-dashed"} ${overlap ? "ring-2 ring-destructive" : ""} ${
        geselecteerd ? "ring-2 ring-ring" : ""
      } ${magMuteren ? "cursor-grab" : ""} ${isDragging ? "opacity-80 shadow-lg" : ""}`}
    >
      {magMuteren && isEerste && (
        <span
          aria-hidden="true"
          onPointerDown={(e) => onRandStart(e, ev, plan, "start")}
          className="absolute inset-y-0 left-0 w-2 cursor-ew-resize touch-none hover:bg-foreground/15 [@media(pointer:coarse)]:w-4"
        />
      )}
      <p className="flex items-center gap-1 truncate pt-0.5 font-semibold" title={ev.titel}>
        {voortgang.status === "afgerond" || voortgang.status === "uitgevoerd" ? (
          <CircleCheck className="size-3 shrink-0 text-status-geaccepteerd-text" aria-label="Klaar" />
        ) : voortgang.status === "in_uitvoering" ? (
          <CirclePlay className="size-3 shrink-0 text-status-gepland-text" aria-label="Bezig" />
        ) : null}
        <span className="truncate">{ev.titel}</span>
      </p>
      <p className="flex gap-1.5 truncate tabular-nums text-muted-foreground">
        <span>{sleepLabel ?? (isEerste ? dagLabel(plan) : korteTijdLabel(plan))}</span>
        {isEerste && urenLabel && (
          <span className={urenLabel.tekort ? "font-medium text-amber-700 dark:text-amber-300" : ""}>
            {urenLabel.tekst}
          </span>
        )}
        {isEerste && voortgang.gewerkt !== undefined && (
          <span title="Gewerkt volgens de medewerker-app">{voortgang.gewerkt} u gewerkt</span>
        )}
      </p>
      {magMuteren && isLaatste && (
        <span
          aria-hidden="true"
          onPointerDown={(e) => onRandStart(e, ev, plan, "eind")}
          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize touch-none hover:bg-foreground/15 [@media(pointer:coarse)]:w-4"
        />
      )}
    </div>
  );
});

// ============================================
// Tijdbord
// ============================================

export function Tijdbord() {
  // De pagina laadt het bord zonder SSR, dus localStorage is hier beschikbaar
  const [voorkeur, setVoorkeurState] = useState<Voorkeur>(leesVoorkeur);
  const setVoorkeur = (deel: Partial<Voorkeur>) =>
    setVoorkeurState((v) => {
      const nieuw = { ...v, ...deel };
      bewaarVoorkeur(nieuw);
      return nieuw;
    });
  const [anker, setAnker] = useState(vandaagIso());
  const bereik = useMemo(() => periodeBereik(voorkeur.weergave, anker), [voorkeur.weergave, anker]);
  const kolommen = useMemo(
    () =>
      kolomDatums(bereik.start, bereik.eind).filter(
        (d) => voorkeur.weekend || voorkeur.weergave === "dag" || !isWeekend(d)
      ),
    [bereik, voorkeur.weekend, voorkeur.weergave]
  );

  // — Data —
  const rolInfo = useQuery(api.roles.getCurrentUserRole);
  const { data: context } = useVorigeData(useQuery(api.planbord.getBordContext, bereik));
  const { data: werkitems } = useVorigeData(useQuery(api.werkitems.listVoorPlanbord, bereik));
  const { data: wachtrij } = useVorigeData(
    useQuery(api.planbord.getWachtrij, bereik) as BakItem[] | undefined
  );
  const magMuteren = magPlanbordMuteren(rolInfo?.role) && voorkeur.rijen === "teams";
  const werkdag = useMemo(() => werkdagUit(context?.werkdag), [context?.werkdag]);
  const resources = useMemo(() => (context ? naarResources(context) : []), [context]);
  const events = useMemo(() => (werkitems ? naarEvents(werkitems) : []), [werkitems]);
  const verlof: BordAfwezigheid[] = useMemo(() => context?.verlof ?? [], [context?.verlof]);
  const namen: Record<string, string> = useMemo(
    () => context?.medewerkerNamen ?? {},
    [context?.medewerkerNamen]
  );

  const updatePlanning = useMutation(api.werkitems.updatePlanning);
  const dupliceer = useMutation(api.planbord.dupliceerWerkitem);
  const splits = useMutation(api.planbord.splitsWerkitem);
  const { data: voortgang } = useVorigeData(useQuery(api.planbord.getVoortgang, bereik));

  // Alt ingedrukt tijdens slepen = kopiëren
  const altIngedrukt = useRef(false);
  useEffect(() => {
    const zet = (e: KeyboardEvent) => {
      altIngedrukt.current = e.altKey;
    };
    window.addEventListener("keydown", zet);
    window.addEventListener("keyup", zet);
    return () => {
      window.removeEventListener("keydown", zet);
      window.removeEventListener("keyup", zet);
    };
  }, []);

  // Contextmenu (I-9), klik op een lege plek (I-10), verlof behandelen
  const [menu, setMenu] = useState<{ x: number; y: number; id: Id<"projecten"> } | null>(null);
  const [legePlek, setLegePlek] = useState<{
    x: number;
    y: number;
    teamId: Id<"teams"> | null;
    datum: string;
    minuut: number;
  } | null>(null);
  const [verlofOpen, setVerlofOpen] = useState<BordAfwezigheid | null>(null);

  // — Bemanning per team-dag (min goedgekeurd verlof en ziekte) —
  const bemanning = useCallback(
    (teamId: Id<"teams">, datum: string) => {
      if (!context) return { mensen: [] as Id<"medewerkers">[], aangevraagd: [] as BordAfwezigheid[] };
      const cel = naarBemanningCel(context, teamId, datum);
      const aanwezig = cel.teamAfwezig
        ? []
        : cel.medewerkerIds.filter((m) => {
            if (cel.afwezigen.includes(m)) return false;
            const a = afwezigOp(verlof, m, datum);
            return !a || !blokkeertInplannen(a.status);
          });
      const aangevraagd = cel.medewerkerIds
        .map((m) => afwezigOp(verlof, m, datum))
        .filter((a): a is BordAfwezigheid => !!a && a.status === "aangevraagd");
      return { mensen: aanwezig, aangevraagd };
    },
    [context, verlof]
  );

  // — Preview tijdens slepen/trekken —
  const [preview, setPreview] = useState<{ id: Id<"projecten">; plan: Plan; teamId?: Id<"teams"> | null } | null>(null);
  const [sleep, setSleep] = useState<{ id: Id<"projecten">; label: string } | null>(null);
  // Selectie (I-8): klik = één blok, shift/ctrl-klik = erbij of eraf
  const [selectie, setSelectie] = useState<Set<Id<"projecten">>>(new Set());
  const selecteer = useCallback((id: Id<"projecten">, toevoegen: boolean) => {
    setSelectie((huidig) => {
      if (!toevoegen) return new Set([id]);
      const nieuw = new Set(huidig);
      if (nieuw.has(id)) nieuw.delete(id);
      else nieuw.add(id);
      return nieuw;
    });
  }, []);
  const wisSelectie = useCallback(() => setSelectie(new Set()), []);

  const planVoor = useCallback(
    (ev: PlanbordEvent): Plan =>
      preview && preview.id === ev.id ? preview.plan : planVan(ev, werkdag),
    [preview, werkdag]
  );

  // — Undo / redo (I-7) —
  const [terug, setTerug] = useState<Wijziging[]>([]);
  const [vooruit, setVooruit] = useState<Wijziging[]>([]);

  const schrijf = useCallback(
    async (id: Id<"projecten">, stand: PlanStand) => {
      const res = await updatePlanning(
        stand.plan
          ? { id, ...stand.plan, teamId: stand.teamId }
          : { id, geplandeStart: null, geplandeEind: null, teamId: null }
      );
      if (res?.waarschuwing) toast.warning(res.waarschuwing);
    },
    [updatePlanning]
  );

  const pasToe = useCallback(
    async (w: Wijziging) => {
      try {
        for (const stap of w.stappen) await schrijf(stap.id, stap.na);
        setTerug((t) => [...t.slice(-49), w]);
        setVooruit([]);
      } catch (fout) {
        toast.error(fout instanceof Error ? fout.message : "Plannen mislukt");
      }
    },
    [schrijf]
  );

  const ongedaan = useCallback(async () => {
    const w = terug[terug.length - 1];
    if (!w) return;
    try {
      for (const stap of [...w.stappen].reverse()) await schrijf(stap.id, stap.voor);
      setTerug((t) => t.slice(0, -1));
      setVooruit((v) => [...v, w]);
      toast.success(`Ongedaan: ${w.titel}`);
    } catch (fout) {
      toast.error(fout instanceof Error ? fout.message : "Ongedaan maken mislukt");
    }
  }, [terug, schrijf]);

  const opnieuw = useCallback(async () => {
    const w = vooruit[vooruit.length - 1];
    if (!w) return;
    try {
      for (const stap of w.stappen) await schrijf(stap.id, stap.na);
      setVooruit((v) => v.slice(0, -1));
      setTerug((t) => [...t, w]);
    } catch (fout) {
      toast.error(fout instanceof Error ? fout.message : "Opnieuw mislukt");
    }
  }, [vooruit, schrijf]);

  const standVan = useCallback(
    (ev: PlanbordEvent): PlanStand => ({ plan: planVan(ev, werkdag), teamId: ev.resourceId }),
    [werkdag]
  );

  /** Dezelfde bewerking op alle geselecteerde blokken (of alleen dit blok). */
  const groep = useCallback(
    (titel: string, ids: Iterable<Id<"projecten">>, maak: (ev: PlanbordEvent) => PlanStand | null): Wijziging => {
      const stappen: Stap[] = [];
      for (const id of ids) {
        const ev = events.find((x) => x.id === id);
        const na = ev ? maak(ev) : null;
        if (ev && na) stappen.push({ id: ev.id, voor: standVan(ev), na });
      }
      return { titel: stappen.length > 1 ? `${titel} (${stappen.length} blokken)` : titel, stappen };
    },
    [events, standVan]
  );

  // — Toetsenbord (I-6, I-7) —
  useEffect(() => {
    const opToets = (e: KeyboardEvent) => {
      const doel = e.target as HTMLElement | null;
      if (doel && (doel.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(doel.tagName))) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void (e.shiftKey ? opnieuw() : ongedaan());
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        void opnieuw();
        return;
      }
      if (e.key === "Escape") {
        wisSelectie();
        setMenu(null);
        setLegePlek(null);
        return;
      }
      if (selectie.size === 0 || !magMuteren) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const richting = e.key === "ArrowRight" ? 1 : -1;
      void pasToe(
        groep(e.shiftKey ? "Dag verschoven" : "Tijd verschoven", selectie, (ev) => ({
          plan: e.shiftKey
            ? schuif(planVan(ev, werkdag), 0, richting)
            : schuif(planVan(ev, werkdag), 15 * richting, 0),
          teamId: ev.resourceId,
        }))
      );
    };
    window.addEventListener("keydown", opToets);
    return () => window.removeEventListener("keydown", opToets);
  }, [selectie, magMuteren, werkdag, pasToe, groep, ongedaan, opnieuw, wisSelectie]);

  // — Randen trekken (I-2): pointer events, ook op aanraakschermen —
  const onRandStart = useCallback(
    (e: React.PointerEvent, ev: PlanbordEvent, plan: Plan, kant: "start" | "eind") => {
      e.stopPropagation();
      e.preventDefault();
      setSelectie(new Set([ev.id]));
      let laatste: Plan | null = null;
      const beweeg = (pe: PointerEvent) => {
        const cel = document
          .elementsFromPoint(pe.clientX, pe.clientY)
          .find((n): n is HTMLElement => n instanceof HTMLElement && !!n.dataset.tcelDatum);
        if (!cel) return;
        const r = cel.getBoundingClientRect();
        const minuut = minuutOpX(pe.clientX - r.left, r.width, werkdag);
        const datum = cel.dataset.tcelDatum!;
        laatste = kant === "eind" ? trekEind(plan, datum, minuut) : trekStart(plan, datum, minuut);
        setPreview({ id: ev.id, plan: laatste });
      };
      const klaar = () => {
        window.removeEventListener("pointermove", beweeg);
        window.removeEventListener("pointerup", klaar);
        window.removeEventListener("pointercancel", klaar);
        const nieuw = laatste;
        if (nieuw && JSON.stringify(nieuw) !== JSON.stringify(plan)) {
          void pasToe(groep(ev.titel, [ev.id], () => ({ plan: nieuw, teamId: ev.resourceId }))).finally(
            () => setPreview(null)
          );
        } else {
          setPreview(null);
        }
      };
      window.addEventListener("pointermove", beweeg);
      window.addEventListener("pointerup", klaar);
      window.addEventListener("pointercancel", klaar);
    },
    [werkdag, pasToe, groep]
  );

  // — Slepen (I-1, I-4) —
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Tablet: even vasthouden voordat het blok meegaat, zodat scrollen blijft werken
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  type Actief =
    | { soort: "bak"; werkitemId: Id<"projecten"> }
    | { soort: "tblok"; werkitemId: Id<"projecten">; dagIndex: number };
  type Doel = { soort: "tcel"; teamId: Id<"teams"> | null; datum: string } | { soort: "bak-drop" };

  const kandidaat = useCallback(
    (e: DragMoveEvent | DragEndEvent): { stand: PlanStand; ev?: PlanbordEvent } | null => {
      const actief = e.active.data.current as Actief | undefined;
      const doel = e.over?.data.current as Doel | undefined;
      if (!actief || !doel || doel.soort !== "tcel" || !e.over) return null;
      const cel = e.over.rect;
      if (actief.soort === "tblok") {
        const ev = events.find((x) => x.id === actief.werkitemId);
        const blok = e.active.rect.current.translated;
        if (!ev || !blok) return null;
        const minuut = minuutOpX(blok.left - cel.left, cel.width, werkdag);
        const plan = verplaats(planVan(ev, werkdag), addDagen(doel.datum, -actief.dagIndex), minuut);
        return { stand: { plan, teamId: doel.teamId }, ev };
      }
      const pointer = e.activatorEvent as PointerEvent | TouchEvent | MouseEvent;
      const startX =
        "touches" in pointer ? (pointer.touches[0]?.clientX ?? 0) : (pointer as MouseEvent).clientX;
      const minuut = minuutOpX(startX + e.delta.x - cel.left, cel.width, werkdag);
      const item = wachtrij?.find((w) => w._id === actief.werkitemId);
      const mensen = doel.teamId ? bemanning(doel.teamId, doel.datum).mensen.length : 1;
      const plan = voorstelUitBak(doel.datum, minuut, item?.geschatteUren, mensen, werkdag);
      return { stand: { plan, teamId: doel.teamId } };
    },
    [events, werkdag, wachtrij, bemanning]
  );

  const onDragMove = (e: DragMoveEvent) => {
    const k = kandidaat(e);
    const id = (e.active.data.current as Actief | undefined)?.werkitemId;
    if (k?.stand.plan && id) setSleep({ id, label: dagLabel(k.stand.plan) });
    else setSleep(null);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setSleep(null);
    const actief = e.active.data.current as Actief | undefined;
    const doel = e.over?.data.current as Doel | undefined;
    if (!actief || !doel) return;
    if (doel.soort === "bak-drop") {
      if (actief.soort !== "tblok") return;
      const ids = selectie.has(actief.werkitemId) ? selectie : [actief.werkitemId];
      await pasToe(groep("Terug naar de bak", ids, () => ({ plan: null, teamId: null })));
      return;
    }
    const k = kandidaat(e);
    if (!k?.stand.plan) return;
    // Waarschuwing bij een verlofaanvraag in het team (I-11: niet blokkeren)
    if (doel.teamId) {
      const { aangevraagd } = bemanning(doel.teamId, doel.datum);
      if (aangevraagd.length > 0) {
        toast.warning(
          `Let op: ${aangevraagd.map((a) => namen[a.medewerkerId] ?? "iemand").join(", ")} heeft verlof aangevraagd op deze dag.`
        );
      }
    }
    if (actief.soort === "tblok" && k.ev) {
      const ev = k.ev;
      const nieuwPlan = k.stand.plan!;
      // Alt-slepen = kopiëren (I-8): een kopie op de nieuwe plek
      if (altIngedrukt.current) {
        try {
          const { id: kopieId } = await dupliceer({ id: ev.id, doelDatum: nieuwPlan.geplandeStart });
          await updatePlanning({ id: kopieId, ...nieuwPlan, teamId: k.stand.teamId });
          toast.success(`Kopie van ${ev.titel} gemaakt`);
        } catch (fout) {
          toast.error(fout instanceof Error ? fout.message : "Kopiëren mislukt");
        }
        return;
      }
      // Meerdere geselecteerd: allemaal evenveel dagen en minuten mee (team blijft)
      if (selectie.has(ev.id) && selectie.size > 1) {
        const oud = planVan(ev, werkdag);
        const dagen = dagenTussen(oud.geplandeStart, nieuwPlan.geplandeStart);
        const minuten =
          tijdNaarMinuten(nieuwPlan.geplandeStartTijd) - tijdNaarMinuten(oud.geplandeStartTijd);
        await pasToe(
          groep("Verplaatst", selectie, (x) => ({
            plan: schuif(planVan(x, werkdag), minuten, dagen),
            teamId: x.resourceId,
          }))
        );
        return;
      }
      await pasToe(groep(ev.titel, [ev.id], () => k.stand));
    } else if (actief.soort === "bak") {
      const item = wachtrij?.find((w) => w._id === actief.werkitemId);
      await pasToe({
        titel: item?.naam ?? "Klus",
        stappen: [{ id: actief.werkitemId, voor: { plan: null, teamId: null }, na: k.stand }],
      });
    }
  };

  // — Indeling per cel: banen voor overlappende blokken —
  const rijen = useMemo(() => {
    const ids: (Id<"teams"> | null)[] = resources.map((r) => r.id);
    if (events.some((e) => e.resourceId === null)) ids.push(null);
    return ids;
  }, [resources, events]);

  const indeling = useMemo(() => {
    type Item = { ev: PlanbordEvent; plan: Plan; baan: number; overlap: boolean };
    const map = new Map<string, Item[]>();
    for (const ev of events) {
      const plan = planVoor(ev);
      const team = preview?.id === ev.id && preview.teamId !== undefined ? preview.teamId : ev.resourceId;
      for (const datum of kolommen) {
        if (datum < plan.geplandeStart || datum > plan.geplandeEind) continue;
        const sleutel = `${team ?? "zonder"}|${datum}`;
        map.set(sleutel, [...(map.get(sleutel) ?? []), { ev, plan, baan: 0, overlap: false }]);
      }
    }
    for (const lijst of map.values()) {
      lijst.sort((a, b) => a.plan.geplandeStartTijd.localeCompare(b.plan.geplandeStartTijd));
      const banen: number[] = [];
      for (const item of lijst) {
        const v = { start: tijdNaarMinuten(item.plan.geplandeStartTijd), eind: tijdNaarMinuten(item.plan.geplandeEindTijd) };
        let baan = banen.findIndex((eind) => eind <= v.start);
        if (baan === -1) {
          baan = banen.length;
          banen.push(v.eind);
        } else banen[baan] = v.eind;
        item.baan = baan;
        item.overlap = lijst.some(
          (ander) =>
            ander !== item &&
            overlapt(v, {
              start: tijdNaarMinuten(ander.plan.geplandeStartTijd),
              eind: tijdNaarMinuten(ander.plan.geplandeEindTijd),
            })
        );
      }
    }
    return map;
  }, [events, kolommen, planVoor, preview]);

  const begrotingLabel = useCallback(
    (ev: PlanbordEvent, plan: Plan) => {
      if (!ev.geschatteUren || !ev.resourceId) return null;
      const gepland = geplandeManuren(plan, (d) => bemanning(ev.resourceId!, d).mensen.length);
      return {
        tekst: `${(Math.round(gepland * 10) / 10).toLocaleString("nl-NL")}/${ev.geschatteUren.toLocaleString("nl-NL")} u`,
        tekort: gepland + 0.01 < ev.geschatteUren,
      };
    },
    [bemanning]
  );

  // — Capaciteit per team per dag: "24 u / 18 u gepland" —
  const capaciteitLabel = (
    teamId: Id<"teams">,
    datum: string,
    lijst: { plan: Plan }[],
    mensen: number
  ): string => {
    const capaciteit = mensen * werkdag.urenPerDag;
    const gepland = lijst.reduce(
      (t, { plan }) =>
        t + ((tijdNaarMinuten(plan.geplandeEindTijd) - tijdNaarMinuten(plan.geplandeStartTijd)) / 60) * mensen,
      0
    );
    const nl = (n: number) => (Math.round(n * 10) / 10).toLocaleString("nl-NL");
    return `${nl(gepland)} van ${nl(capaciteit)} u`;
  };

  // — Contextmenu-acties (I-9) —
  const openMenu = useCallback((x: number, y: number, id: Id<"projecten">) => {
    setSelectie((huidig) => (huidig.has(id) ? huidig : new Set([id])));
    setLegePlek(null);
    setMenu({ x, y, id });
  }, []);

  const menuActie = async (actie: "weer" | "bak" | "kopie" | "verdeel") => {
    const ids = [...selectie];
    setMenu(null);
    if (actie === "weer") {
      await pasToe(
        groep("Slecht weer", ids, (ev) => ({
          plan: naarVolgendeWerkdag(planVan(ev, werkdag)),
          teamId: ev.resourceId,
        }))
      );
      return;
    }
    if (actie === "bak") {
      await pasToe(groep("Terug naar de bak", ids, () => ({ plan: null, teamId: null })));
      return;
    }
    for (const id of ids) {
      const ev = events.find((x) => x.id === id);
      if (!ev) continue;
      const plan = planVan(ev, werkdag);
      try {
        if (actie === "kopie") {
          await dupliceer({ id, doelDatum: naarVolgendeWerkdag(plan).geplandeStart });
          toast.success(`Kopie van ${ev.titel} op de volgende werkdag`);
        } else {
          const dagen = werkdagenIn(plan.geplandeStart, plan.geplandeEind);
          if (dagen.length < 2) {
            toast.info(`${ev.titel} staat maar één werkdag gepland`);
            continue;
          }
          await splits({
            id,
            delen: dagen.map((d) => ({
              geplandeStart: d,
              geplandeEind: d,
              ...(ev.resourceId ? { teamId: ev.resourceId } : {}),
            })),
          });
          toast.success(`${ev.titel} verdeeld over ${dagen.length} dagen`);
        }
      } catch (fout) {
        toast.error(fout instanceof Error ? fout.message : "Actie mislukt");
      }
    }
  };

  // — Klik op een lege plek: een klus uit de bak hier plannen (I-10) —
  const planHier = async (item: BakItem) => {
    const plek = legePlek;
    setLegePlek(null);
    if (!plek) return;
    const mensen = plek.teamId ? bemanning(plek.teamId, plek.datum).mensen.length : 1;
    await pasToe({
      titel: item.naam,
      stappen: [
        {
          id: item._id,
          voor: { plan: null, teamId: null },
          na: {
            plan: voorstelUitBak(plek.datum, plek.minuut, item.geschatteUren, mensen, werkdag),
            teamId: plek.teamId,
          },
        },
      ],
    });
  };

  // — Verlof: gevolgen van goedkeuren voor de planning —
  const verlofGevolgen = (a: BordAfwezigheid): string[] => {
    const uit: string[] = [];
    for (const datum of kolommen) {
      if (datum < a.startDatum || datum > a.eindDatum) continue;
      for (const r of resources) {
        const bem = bemanning(r.id, datum);
        if (!bem.mensen.includes(a.medewerkerId as Id<"medewerkers">)) continue;
        const klussen = (indeling.get(`${r.id}|${datum}`) ?? []).length;
        const dag = kolomKop(datum, "ruim").voluit;
        if (klussen > 0) {
          uit.push(
            bem.mensen.length - 1 === 0
              ? `${dag}: ${r.naam} is dan onbemand (${klussen} ${klussen === 1 ? "klus" : "klussen"})`
              : `${dag}: ${klussen} ${klussen === 1 ? "klus" : "klussen"} bij ${r.naam}, nog ${bem.mensen.length - 1} man`
          );
        }
      }
    }
    return uit;
  };

  // — Medewerkerweergave (read-only afgeleide van dezelfde data) —
  const medewerkerRijen = useMemo(() => {
    const ids = new Set<string>();
    for (const r of resources) r.ledenDefault.forEach((m) => ids.add(m));
    for (const b of context?.bemanning ?? []) b.medewerkerIds.forEach((m) => ids.add(m));
    return [...ids].sort((a, b) => (namen[a] ?? "").localeCompare(namen[b] ?? ""));
  }, [resources, context?.bemanning, namen]);

  const teamVanMedewerker = (medewerkerId: string, datum: string): Id<"teams"> | null => {
    for (const r of resources) {
      if (bemanning(r.id, datum).mensen.includes(medewerkerId as Id<"medewerkers">)) return r.id;
    }
    return null;
  };

  // — Weergave —
  const breedte = useRef<HTMLDivElement>(null);
  const [celBreedte, setCelBreedte] = useState(200);
  useEffect(() => {
    const el = breedte.current;
    if (!el) return;
    const meet = () => setCelBreedte((el.clientWidth - 144) / Math.max(1, kolommen.length));
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, [kolommen.length]);
  const uren = uurMarkeringen(werkdag, celBreedte);
  const raster = `9rem repeat(${kolommen.length}, minmax(0, 1fr))`;
  const vandaag = vandaagIso();
  const reistijd = context?.reistijd;

  const celHoogte = (teamId: Id<"teams"> | null) => {
    let banen = 1;
    for (const d of kolommen) {
      const lijst = indeling.get(`${teamId ?? "zonder"}|${d}`) ?? [];
      banen = Math.max(banen, ...lijst.map((i) => i.baan + 1));
    }
    return KOP_HOOGTE + banen * BAAN_HOOGTE + 4;
  };

  return (
    <div
      className="flex flex-wrap items-start gap-4"
      onClick={() => {
        wisSelectie();
        setMenu(null);
        setLegePlek(null);
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={() => setSleep(null)}
      >
        <div className="min-w-0 flex-[999_1_40rem] space-y-3">
          {/* Werkbalk */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex overflow-hidden rounded-lg border">
              <button
                type="button"
                aria-label="Vorige periode"
                onClick={() => setAnker(schuifAnker(voorkeur.weergave, anker, -1))}
                className="grid size-9 place-items-center text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setAnker(vandaagIso())}
                className="h-9 border-x px-3 text-sm font-medium hover:bg-accent"
              >
                Vandaag
              </button>
              <button
                type="button"
                aria-label="Volgende periode"
                onClick={() => setAnker(schuifAnker(voorkeur.weergave, anker, 1))}
                className="grid size-9 place-items-center text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <span className="text-base font-semibold tabular-nums">{bereikLabel(bereik.start, bereik.eind)}</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg bg-muted p-[3px]" role="group" aria-label="Zoom">
                {WEERGAVEN.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    aria-pressed={voorkeur.weergave === w.id}
                    onClick={() => setVoorkeur({ weergave: w.id })}
                    className={`h-8 rounded-md px-3 text-sm ${
                      voorkeur.weergave === w.id ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg bg-muted p-[3px]" role="group" aria-label="Rijen">
                {(["teams", "medewerkers"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={voorkeur.rijen === r}
                    onClick={() => setVoorkeur({ rijen: r })}
                    className={`h-8 rounded-md px-3 text-sm ${
                      voorkeur.rijen === r ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {r === "teams" ? "Teams" : "Medewerkers"}
                  </button>
                ))}
              </div>
              {voorkeur.weergave !== "dag" && (
                <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={voorkeur.weekend}
                    onChange={(e) => setVoorkeur({ weekend: e.target.checked })}
                  />
                  Weekend
                </label>
              )}
              <Button variant="outline" size="icon" aria-label="Ongedaan maken (ctrl+z)" disabled={!terug.length} onClick={() => void ongedaan()}>
                <Undo2 className="size-4" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Opnieuw (ctrl+shift+z)" disabled={!vooruit.length} onClick={() => void opnieuw()}>
                <Redo2 className="size-4" />
              </Button>
              {magMuteren && selectie.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    setMenu({ x: r.left, y: r.bottom + 4, id: [...selectie][0] });
                  }}
                >
                  <MoreHorizontal className="size-4" />
                  {selectie.size > 1 ? `${selectie.size} blokken` : "Acties"}
                </Button>
              )}
            </div>
          </div>

          {/* Raster */}
          <div ref={breedte} className="overflow-hidden rounded-lg border" role="grid" aria-label="Tijdbord">
            {/* Kop: dagen + uren */}
            <div className="grid bg-muted/40" style={{ gridTemplateColumns: raster }}>
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {minutenNaarTijd(werkdag.start)}–{minutenNaarTijd(werkdag.eind)}
              </div>
              {kolommen.map((d) => {
                const kop = kolomKop(d, kolommen.length > 7 ? "krap" : "ruim");
                return (
                  <div key={d} className={`border-l px-1 pt-1 ${d === vandaag ? "bg-accent/50" : ""}`}>
                    <p className="truncate text-xs font-semibold" title={kop.voluit}>{kop.dag} {kop.nummer}</p>
                    <div className="relative h-4">
                      {uren.map((m) => (
                        <span
                          key={m}
                          className="absolute -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground first:translate-x-0"
                          style={{ left: `${((m - werkdag.start) / (werkdag.eind - werkdag.start)) * 100}%` }}
                        >
                          {m / 60}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {voorkeur.rijen === "teams" ? (
              rijen.map((teamId) => {
                const team = resources.find((r) => r.id === teamId);
                const hoogte = celHoogte(teamId);
                return (
                  <div key={teamId ?? "zonder"} className="grid" style={{ gridTemplateColumns: raster }}>
                    <div className="border-t px-2 py-1.5" style={{ height: hoogte }}>
                      <p className="truncate text-sm font-semibold">{team?.naam ?? "Zonder team"}</p>
                    </div>
                    {kolommen.map((datum) => {
                      const lijst = indeling.get(`${teamId ?? "zonder"}|${datum}`) ?? [];
                      const bem = teamId ? bemanning(teamId, datum) : null;
                      const mensen = bem?.mensen.length ?? 0;
                      const werkdagHier = isWerkdag(datum);
                      return (
                        <TijdCel
                          key={datum}
                          teamId={teamId}
                          datum={datum}
                          hoogte={hoogte}
                          grijs={!werkdagHier}
                          onbemand={!!teamId && lijst.length > 0 && mensen === 0}
                          onKlik={
                            magMuteren && (wachtrij?.length ?? 0) > 0
                              ? (e) => {
                                  e.stopPropagation();
                                  const r = e.currentTarget.getBoundingClientRect();
                                  wisSelectie();
                                  setMenu(null);
                                  setLegePlek({
                                    x: e.clientX,
                                    y: e.clientY,
                                    teamId,
                                    datum,
                                    minuut: minuutOpX(e.clientX - r.left, r.width, werkdag),
                                  });
                                }
                              : undefined
                          }
                        >
                          {teamId && (
                            <p
                              className="flex h-[18px] items-center gap-1 truncate px-1 text-[10px] text-muted-foreground"
                              title={bem?.mensen.map((m) => namen[m]).join(", ")}
                            >
                              <span className="tabular-nums">
                                {mensen} man · {capaciteitLabel(teamId, datum, lijst, mensen)}
                              </span>
                              {lijst.length > 0 && mensen === 0 && (
                                <span className="font-medium text-amber-700 dark:text-amber-300">onbemand</span>
                              )}
                              {bem?.aangevraagd.map((a) => (
                                <button
                                  type="button"
                                  key={a.medewerkerId}
                                  disabled={!a.aanvraagId}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVerlofOpen(a);
                                  }}
                                  className="rounded-sm bg-[repeating-linear-gradient(135deg,var(--muted),var(--muted)_3px,transparent_3px,transparent_6px)] px-1 enabled:hover:underline"
                                >
                                  {namen[a.medewerkerId]?.split(" ")[0] ?? "?"}: {afwezigLabel(a)}
                                </button>
                              ))}
                            </p>
                          )}
                          {/* Standaardblok reistijd (uit Instellingen → Planning) */}
                          {teamId && reistijd && werkdagHier && mensen > 0 && (() => {
                            const van = tijdNaarMinuten(reistijd.vertrekTijd);
                            const pos = segmentPositie(van, van + reistijd.minuten, werkdag);
                            return pos.width > 0 ? (
                              <div
                                aria-hidden="true"
                                title={`Reistijd ${reistijd.vertrekTijd} (${reistijd.minuten} min)`}
                                className="absolute bottom-1 rounded-sm bg-[repeating-linear-gradient(135deg,var(--border),var(--border)_2px,transparent_2px,transparent_5px)]"
                                style={{ left: `${pos.left}%`, width: `${pos.width}%`, top: KOP_HOOGTE + 2 }}
                              />
                            ) : null;
                          })()}
                          {lijst.map(({ ev, plan, baan, overlap }) => (
                            <Segment
                              key={ev.id}
                              ev={ev}
                              plan={plan}
                              datum={datum}
                              baan={baan}
                              werkdag={werkdag}
                              isEerste={datum === plan.geplandeStart || datum === kolommen[0]}
                              isLaatste={datum === plan.geplandeEind || datum === kolommen[kolommen.length - 1]}
                              geselecteerd={selectie.has(ev.id)}
                              overlap={overlap}
                              magMuteren={magMuteren}
                              sleepLabel={sleep?.id === ev.id ? sleep.label : null}
                              urenLabel={datum === plan.geplandeStart ? begrotingLabel(ev, plan) : null}
                              vasteTijd={!!(ev.startTijd && ev.eindTijd)}
                              voortgang={{ status: ev.status, gewerkt: voortgang?.[ev.id] }}
                              onSelecteer={selecteer}
                              onMenu={openMenu}
                              onRandStart={onRandStart}
                            />
                          ))}
                        </TijdCel>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              medewerkerRijen.map((m) => (
                <div key={m} className="grid" style={{ gridTemplateColumns: raster }}>
                  <div className="border-t px-2 py-1.5 text-sm font-medium">{namen[m] ?? "Onbekend"}</div>
                  {kolommen.map((datum) => {
                    const a = afwezigOp(verlof, m, datum);
                    const team = teamVanMedewerker(m, datum);
                    const lijst = team ? (indeling.get(`${team}|${datum}`) ?? []) : [];
                    return (
                      <div key={datum} className={`relative min-h-12 border-l border-t p-1 ${isWerkdag(datum) ? "" : "bg-muted/50"}`}>
                        {a && (
                          <p
                            className={`rounded-sm px-1 text-[11px] ${
                              blokkeertInplannen(a.status)
                                ? "bg-muted font-medium"
                                : "bg-[repeating-linear-gradient(135deg,var(--muted),var(--muted)_3px,transparent_3px,transparent_6px)]"
                            }`}
                          >
                            {afwezigLabel(a)}
                          </p>
                        )}
                        {lijst.map(({ ev, plan }) => (
                          <p key={ev.id} className="truncate text-[11px]">
                            <span className="tabular-nums text-muted-foreground">{plan.geplandeStartTijd}</span> {ev.titel}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))
            )}

            {/* Rij "Afwezig": goedgekeurd verlof en ziekte effen, aanvragen gestreept */}
            {voorkeur.rijen === "teams" && verlof.length > 0 && (
              <div className="grid" style={{ gridTemplateColumns: raster }}>
                <div className="flex items-center gap-1.5 border-t px-2 py-1.5 text-sm text-muted-foreground">
                  <UserX className="size-4" aria-hidden="true" />
                  Afwezig
                </div>
                {kolommen.map((datum) => {
                  const vandaagAfwezig = verlof.filter((a) => a.startDatum <= datum && datum <= a.eindDatum);
                  return (
                    <div key={datum} className="flex flex-wrap content-start gap-0.5 border-l border-t p-1">
                      {vandaagAfwezig.map((a, i) => (
                        <button
                          type="button"
                          key={`${a.medewerkerId}-${i}`}
                          title={afwezigLabel(a)}
                          disabled={!(a.aanvraagId && a.status === "aangevraagd")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setVerlofOpen(a);
                          }}
                          className={`max-w-full truncate rounded-sm px-1 text-[10px] enabled:hover:underline ${
                            blokkeertInplannen(a.status)
                              ? "bg-muted font-medium"
                              : "border border-dashed bg-[repeating-linear-gradient(135deg,var(--muted),var(--muted)_3px,transparent_3px,transparent_6px)]"
                          }`}
                        >
                          {namen[a.medewerkerId]?.split(" ")[0] ?? "?"}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Sleep om te verplaatsen, trek aan een rand om korter of langer te maken (per{" "}
            {celBreedte / ((werkdag.eind - werkdag.start) / 15) >= 2.5 ? "kwartier" : "uur"}). Klik een blok en gebruik
            de pijltjes voor ±15 min, shift+pijl voor ±1 dag. Op een tablet: even vasthouden om te slepen.
          </p>
        </div>

        <div className="min-w-0 flex-[1_1_18rem]" onClick={(e) => e.stopPropagation()}>
          <Opdrachtenbak
            items={wachtrij}
            kolommen={kolommen}
            filterDatum={null}
            onFilterDatum={() => {}}
            magSlepen={magMuteren}
          />
        </div>
      </DndContext>

      {menu && (
        <div
          role="menu"
          className="fixed z-50 min-w-56 rounded-md border bg-popover p-1 text-sm shadow-md"
          style={{ left: Math.min(menu.x, window.innerWidth - 240), top: Math.min(menu.y, window.innerHeight - 200) }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { actie: "weer" as const, label: "Slecht weer → volgende werkdag", icoon: CloudRain },
            { actie: "kopie" as const, label: "Kopie op de volgende werkdag", icoon: Copy },
            { actie: "verdeel" as const, label: "Verdeel over losse dagen", icoon: Scissors },
            { actie: "bak" as const, label: "Terug naar de bak", icoon: Inbox },
          ].map(({ actie, label, icoon: Icoon }) => (
            <button
              key={actie}
              type="button"
              role="menuitem"
              onClick={() => void menuActie(actie)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent"
            >
              <Icoon className="size-4 text-muted-foreground" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}

      {legePlek && (
        <LegePlekKiezer
          plek={legePlek}
          items={wachtrij ?? []}
          teamNaam={resources.find((r) => r.id === legePlek.teamId)?.naam ?? "zonder team"}
          onKies={(item) => void planHier(item)}
          onSluit={() => setLegePlek(null)}
        />
      )}

      {verlofOpen && (
        <VerlofBesluit
          aanvraag={verlofOpen}
          naam={namen[verlofOpen.medewerkerId] ?? "Medewerker"}
          gevolgen={verlofGevolgen(verlofOpen)}
          onSluit={() => setVerlofOpen(null)}
        />
      )}
    </div>
  );
}

function LegePlekKiezer({
  plek,
  items,
  teamNaam,
  onKies,
  onSluit,
}: {
  plek: { x: number; y: number; datum: string; minuut: number };
  items: BakItem[];
  teamNaam: string;
  onKies: (item: BakItem) => void;
  onSluit: () => void;
}) {
  const [zoek, setZoek] = useState("");
  const zichtbaar = items.filter((i) =>
    `${i.naam} ${i.klantNaam ?? ""}`.toLowerCase().includes(zoek.toLowerCase())
  );
  return (
    <div
      role="dialog"
      aria-label="Klus hier plannen"
      className="fixed z-50 w-72 rounded-md border bg-popover p-2 text-sm shadow-md"
      style={{ left: Math.min(plek.x, window.innerWidth - 300), top: Math.min(plek.y, window.innerHeight - 320) }}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="px-1 pb-1.5 text-xs text-muted-foreground">
        {teamNaam} · {kolomKop(plek.datum, "ruim").voluit} · {minutenNaarTijd(plek.minuut)}
      </p>
      <input
        autoFocus
        value={zoek}
        onChange={(e) => setZoek(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onSluit()}
        placeholder="Zoek een klus uit de bak…"
        className="mb-1 h-8 w-full rounded-md border bg-transparent px-2 text-sm"
      />
      <ul className="max-h-56 overflow-y-auto">
        {zichtbaar.map((item) => (
          <li key={item._id}>
            <button
              type="button"
              onClick={() => onKies(item)}
              className="flex w-full items-baseline gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent"
            >
              <span className="min-w-0 flex-1 truncate">{item.naam}</span>
              {item.geschatteUren != null && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.geschatteUren} u</span>
              )}
            </button>
          </li>
        ))}
        {zichtbaar.length === 0 && <li className="px-2 py-1.5 text-muted-foreground">Niets gevonden</li>}
      </ul>
    </div>
  );
}

function VerlofBesluit({
  aanvraag,
  naam,
  gevolgen,
  onSluit,
}: {
  aanvraag: BordAfwezigheid;
  naam: string;
  gevolgen: string[];
  onSluit: () => void;
}) {
  const goedkeuren = useMutation(api.verlof.goedkeuren);
  const afkeuren = useMutation(api.verlof.afkeuren);
  const [reden, setReden] = useState("");
  const [bezig, setBezig] = useState(false);

  const besluit = async (akkoord: boolean) => {
    if (!aanvraag.aanvraagId) return;
    setBezig(true);
    try {
      const id = aanvraag.aanvraagId as Id<"verlofaanvragen">;
      if (akkoord) await goedkeuren({ id });
      else await afkeuren({ id, afwijzingReden: reden.trim() || undefined });
      toast.success(akkoord ? `Verlof van ${naam} goedgekeurd` : `Verlof van ${naam} afgewezen`);
      onSluit();
    } catch (fout) {
      toast.error(
        fout instanceof Error && "data" in fout
          ? String((fout as { data: unknown }).data)
          : "Opslaan mislukt"
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onSluit()}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{afwezigLabel(aanvraag)}: {naam}</DialogTitle>
          <DialogDescription>
            {aanvraag.startDatum === aanvraag.eindDatum
              ? kolomKop(aanvraag.startDatum, "ruim").voluit
              : `${kolomKop(aanvraag.startDatum, "ruim").voluit} t/m ${kolomKop(aanvraag.eindDatum, "ruim").voluit}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Gevolgen voor de planning in deze periode</p>
          {gevolgen.length === 0 ? (
            <p className="text-muted-foreground">Geen klussen geraakt in de getoonde periode.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5">
              {gevolgen.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}
          <input
            value={reden}
            onChange={(e) => setReden(e.target.value)}
            placeholder="Reden bij afwijzen (optioneel)"
            className="mt-2 h-9 w-full rounded-md border bg-transparent px-2"
          />
          <p className="text-xs text-muted-foreground">
            {naam} krijgt een melding van het besluit in de app.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => void besluit(false)} disabled={bezig}>
            Afwijzen
          </Button>
          <Button onClick={() => void besluit(true)} disabled={bezig}>
            Goedkeuren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
