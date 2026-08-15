"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertTriangle,
  Briefcase,
  ListTodo,
  MoreHorizontal,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaakCheckbox } from "@/components/taken/taak-checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

type Prioriteit = "laag" | "normaal" | "hoog";

/** Rijtype uit de query zelf afleiden — dan kan het niet uiteenlopen. */
type VerrijkteKlantTaak = FunctionReturnType<
  typeof api.klantTaken.listVoorKlant
>[number];

const PRIORITEIT_LABELS: Record<Prioriteit, string> = {
  laag: "Laag",
  normaal: "Normaal",
  hoog: "Hoog",
};

/** Alleen `hoog` verdient inkt in de lijst; `laag` staat lager in de sortering. */
const PRIORITEIT_RANG: Record<Prioriteit, number> = {
  hoog: 0,
  normaal: 1,
  laag: 2,
};

/** Sentinelwaarde: Radix Select accepteert geen lege string als item-value. */
const NIEMAND = "__niemand__";

const MS_PER_DAG = 86_400_000;

const DATUM_KORT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
});
const DATUM_KORT_WEEKDAG = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const DATUM_KORT_JAAR = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function vandaagISO(): string {
  // Lokale datum, niet toISOString() — die schuift bij ons een dag terug 's avonds.
  const nu = new Date();
  const maand = `${nu.getMonth() + 1}`.padStart(2, "0");
  const dag = `${nu.getDate()}`.padStart(2, "0");
  return `${nu.getFullYear()}-${maand}-${dag}`;
}

/** ISO-datum → lokale middernacht, zodat dagverschillen niet over een tijdzone struikelen. */
function parseISODatum(iso: string): Date {
  const [jaar, maand, dag] = iso.split("-").map(Number);
  return new Date(jaar, maand - 1, dag);
}

function dagenVerschil(vanISO: string, totISO: string): number {
  return Math.round(
    (parseISODatum(totISO).getTime() - parseISODatum(vanISO).getTime()) /
      MS_PER_DAG
  );
}

function formatDeadline(deadline: string): string {
  return DATUM_KORT_JAAR.format(parseISODatum(deadline));
}

interface DeadlineWeergave {
  tekst: string;
  teLaat: boolean;
  /** Vandaag en te laat verdienen nadruk; de rest blijft voetnoot-grijs. */
  nadruk: boolean;
}

/**
 * "3 dagen te laat" leest sneller dan "11 aug" met een rode kleur: het getal
 * doet het werk, niet de kleur alleen.
 */
function deadlineWeergave(deadline: string, vandaag: string): DeadlineWeergave {
  const dagen = dagenVerschil(vandaag, deadline);
  if (dagen < 0) {
    const aantal = Math.abs(dagen);
    return {
      tekst: `${aantal} ${aantal === 1 ? "dag" : "dagen"} te laat`,
      teLaat: true,
      nadruk: true,
    };
  }
  if (dagen === 0) return { tekst: "Vandaag", teLaat: false, nadruk: true };
  if (dagen === 1) return { tekst: "Morgen", teLaat: false, nadruk: false };

  const datum = parseISODatum(deadline);
  if (dagen <= 7) {
    return {
      tekst: DATUM_KORT_WEEKDAG.format(datum),
      teLaat: false,
      nadruk: false,
    };
  }
  const anderJaar = datum.getFullYear() !== parseISODatum(vandaag).getFullYear();
  return {
    tekst: (anderJaar ? DATUM_KORT_JAAR : DATUM_KORT).format(datum),
    teLaat: false,
    nadruk: false,
  };
}

/** Twee letters volstaan als schijfje; de volle naam blijft in `title` staan. */
function initialen(naam?: string): string {
  const delen = (naam ?? "").trim().split(/\s+/).filter(Boolean);
  if (delen.length === 0) return "—";
  if (delen.length === 1) return delen[0].slice(0, 2).toUpperCase();
  return (delen[0][0] + delen[delen.length - 1][0]).toUpperCase();
}

/**
 * Sorteergroep van een open taak: te laat → vandaag → toekomstige deadline →
 * zonder deadline. Zonder deadline onderaan, want die taak vraagt niets van je
 * dag.
 */
function deadlineGroep(deadline: string | undefined, vandaag: string): number {
  if (!deadline) return 3;
  if (deadline < vandaag) return 0;
  if (deadline === vandaag) return 1;
  return 2;
}

interface KlantTakenCardProps {
  klantId: Id<"klanten">;
}

/**
 * Takenlijst per klant: wat moet er nog gebeuren voor deze klant, en wie doet
 * het. Bewust gescheiden van de klanttijdlijn (wat er gebeurd is).
 *
 * De sectie is één paneel met een `divide-y` lijst; de bovenste regel is de
 * composer. Geen "Nieuwe taak"-knop die eerst een formulier moet openen — de
 * snelste route van gedachte naar taak is klikken en typen.
 */
export function KlantTakenCard({ klantId }: KlantTakenCardProps) {
  const taken = useQuery(api.klantTaken.listVoorKlant, { klantId });
  const medewerkers = useQuery(api.medewerkers.list, { isActief: true });

  const createTaak = useMutation(api.klantTaken.create);
  const setStatus = useMutation(api.klantTaken.setStatus);
  const updateTaak = useMutation(api.klantTaken.update);
  const removeTaak = useMutation(api.klantTaken.remove);

  const [open, setOpen] = useState(false);
  const [titel, setTitel] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [toelichtingOpen, setToelichtingOpen] = useState(false);
  const [prioriteit, setPrioriteit] = useState<Prioriteit>("normaal");
  const [deadline, setDeadline] = useState("");
  const [toegewezenAan, setToegewezenAan] = useState<string>(NIEMAND);
  const [bezig, setBezig] = useState(false);
  const [toonAfgerond, setToonAfgerond] = useState(false);
  const [nieuweTaakId, setNieuweTaakId] = useState<string | null>(null);
  // Radix zet zijn Select-inhoud in een portal; zonder deze vlag klapt de
  // composer dicht zodra je een keuzelijst opent.
  const [keuzelijstOpen, setKeuzelijstOpen] = useState(false);

  const titelRef = useRef<HTMLInputElement>(null);

  const vandaag = vandaagISO();

  const openTaken = useMemo(() => {
    const nu = vandaagISO();
    return (taken ?? [])
      .filter((t) => t.status === "open")
      .sort((a, b) => {
        const groepVerschil =
          deadlineGroep(a.deadline, nu) - deadlineGroep(b.deadline, nu);
        if (groepVerschil !== 0) return groepVerschil;
        if (a.deadline && b.deadline && a.deadline !== b.deadline) {
          return a.deadline < b.deadline ? -1 : 1;
        }
        const prioVerschil =
          PRIORITEIT_RANG[a.prioriteit] - PRIORITEIT_RANG[b.prioriteit];
        if (prioVerschil !== 0) return prioVerschil;
        return a.createdAt - b.createdAt;
      });
  }, [taken]);

  const afgerondeTaken = useMemo(
    () => (taken ?? []).filter((t) => t.status === "afgerond"),
    [taken]
  );

  const medewerkerLijst = medewerkers ?? [];
  const gekozenMedewerker = medewerkerLijst.find(
    (m) => m._id === toegewezenAan
  );

  const heeftInvoer =
    titel.trim() !== "" ||
    omschrijving.trim() !== "" ||
    deadline !== "" ||
    toegewezenAan !== NIEMAND ||
    prioriteit !== "normaal";

  const resetForm = () => {
    setTitel("");
    setOmschrijving("");
    setToelichtingOpen(false);
    setPrioriteit("normaal");
    setDeadline("");
    setToegewezenAan(NIEMAND);
  };

  const handleCreate = async () => {
    if (!titel.trim()) {
      showErrorToast("Geef de taak een titel");
      return;
    }
    setBezig(true);
    try {
      const id = await createTaak({
        klantId,
        titel: titel.trim(),
        omschrijving: omschrijving.trim() || undefined,
        prioriteit,
        deadline: deadline || undefined,
        toegewezenAanId:
          toegewezenAan === NIEMAND
            ? undefined
            : (toegewezenAan as Id<"medewerkers">),
      });
      showSuccessToast("Taak toegevoegd");
      setNieuweTaakId(id);
      resetForm();
      // Composer blijft open en de cursor terug in het titelveld: vijf taken
      // achter elkaar invoeren moet kunnen zonder opnieuw te klikken.
      titelRef.current?.focus();
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij toevoegen taak"
      );
    } finally {
      setBezig(false);
    }
  };

  const handleToggle = async (
    id: Id<"klantTaken">,
    huidigeStatus: "open" | "afgerond"
  ) => {
    try {
      await setStatus({
        id,
        status: huidigeStatus === "open" ? "afgerond" : "open",
      });
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij bijwerken taak"
      );
    }
  };

  const handleToewijzen = async (id: Id<"klantTaken">, waarde: string) => {
    try {
      await updateTaak({
        id,
        toegewezenAanId:
          waarde === NIEMAND ? null : (waarde as Id<"medewerkers">),
      });
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij toewijzen taak"
      );
    }
  };

  const handlePrioriteit = async (id: Id<"klantTaken">, waarde: string) => {
    try {
      await updateTaak({ id, prioriteit: waarde as Prioriteit });
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij bijwerken taak"
      );
    }
  };

  const handleVerwijderen = async (id: Id<"klantTaken">) => {
    try {
      await removeTaak({ id });
      showSuccessToast("Taak verwijderd");
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij verwijderen taak"
      );
    }
  };

  const handleComposerBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    // Van veld naar veld tabben mag de strip niet dichtklappen — alleen als de
    // focus de composer echt verlaat én er niets is ingevuld.
    if (keuzelijstOpen) return;
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    if (heeftInvoer) return;
    setOpen(false);
  };

  /**
   * De tekstregel is maar ~19px hoog in een rij van ~35px, en het plus-icoon
   * links is helemaal geen invoerveld. Wie op de regel klikt in plaats van
   * precies op de tekst, kreeg dus niets — en omdat de strip met "Toevoegen"
   * en de selects pas ná het openklappen bestaat, leest dat als "de knoppen
   * doen het niet". De hele regel opent nu de composer.
   */
  const openViaRegel = (event: React.MouseEvent<HTMLDivElement>) => {
    const doel = event.target as Element | null;
    // Portalinhoud (select-menu's) borrelt via de React-boom hierheen maar
    // zit niet in de regel-DOM; focus stelen sluit dan het open menu vóór de
    // keuze landt (zelfde valkuil als de dagstaat-klantkiezer, 16 aug).
    if (doel && !event.currentTarget.contains(doel)) {
      return;
    }
    // Eigen controls houden hun eigen gedrag (knoppen, selects, tekstvelden).
    if (doel?.closest("button, input, textarea, select, a, [role='combobox']")) {
      return;
    }
    // preventDefault houdt de focus waar hij hoort: in het titelveld.
    event.preventDefault();
    titelRef.current?.focus();
  };

  const kaleTriggerClasses =
    "h-7 min-h-0 w-auto gap-1 border-0 bg-transparent px-1.5 text-xs text-muted-foreground shadow-none hover:bg-accent hover:text-foreground dark:bg-transparent dark:hover:bg-accent";

  const heeftTaken = openTaken.length > 0 || afgerondeTaken.length > 0;
  const zichtbaarAfgerond = toonAfgerond ? afgerondeTaken : [];
  const lijstLeeg = openTaken.length === 0 && zichtbaarAfgerond.length === 0;

  // Taken zijn werkstroom: vooruitkijken staat bovenaan het dossier en weegt
  // zwaarder dan het archief eronder. Ook zónder taken blijft dit een paneel —
  // de composer is hier de reden dat je er bent. Wat wél verdwijnt is het lege
  // blok eronder: dat wordt één regel achter het kopje.
  const legeRegel =
    taken !== undefined && lijstLeeg
      ? { tekst: heeftTaken ? "Alles afgevinkt." : "Nog geen taken." }
      : undefined;

  return (
    <SectiePaneel
      titel="Taken"
      icoon={<ListTodo />}
      telling={openTaken.length}
      gewicht="primair"
      legeRegel={legeRegel}
      uitleg="Losse to-do's voor deze klant: terugbellen, offerte narekenen, materiaal bestellen. Wijs een taak toe aan een collega en hij verschijnt ook op diens Mijn taken. Enter slaat direct op."
    >
      {/* Composer: één regel die pas openklapt zodra je hem aanraakt. */}
      <div
        data-open={open}
        onBlur={handleComposerBlur}
        onMouseDown={openViaRegel}
        className={cn(
          "group/composer px-3 py-2 data-[open=false]:cursor-text data-[open=false]:hover:bg-muted/30",
          // Zonder taken eronder is er niets om van te scheiden.
          !lijstLeeg && "border-b"
        )}
      >
        <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5">
          <Plus
            className="mt-0.5 size-4 justify-self-center text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0">
            <input
              ref={titelRef}
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleCreate();
                  return;
                }
                if (e.key === "Escape" && !heeftInvoer) {
                  setOpen(false);
                  e.currentTarget.blur();
                }
              }}
              aria-label="Nieuwe taak"
              placeholder="Nieuwe taak — bijv. terugbellen over de oprit"
              className="w-full border-0 bg-transparent p-0 text-sm leading-snug outline-none placeholder:text-muted-foreground focus-visible:ring-0"
            />

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-150 group-data-[open=false]/composer:hidden">
              {toelichtingOpen ? (
                <textarea
                  value={omschrijving}
                  onChange={(e) => setOmschrijving(e.target.value)}
                  onInput={(e) => {
                    // Meegroeien zonder de hoogte te animeren (§2.4).
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  rows={1}
                  aria-label="Toelichting bij de taak"
                  placeholder="Extra context…"
                  className="max-h-36 w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-xs leading-snug outline-none placeholder:text-muted-foreground focus-visible:ring-0"
                />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-7 min-h-0 px-1.5 text-xs text-muted-foreground"
                  onClick={() => setToelichtingOpen(true)}
                >
                  + Toelichting
                </Button>
              )}

              <Select
                value={toegewezenAan}
                onValueChange={setToegewezenAan}
                onOpenChange={setKeuzelijstOpen}
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Taak toewijzen"
                  className={cn(kaleTriggerClasses, "max-w-[10rem]")}
                >
                  <span className="flex min-w-0 items-center gap-1">
                    <User className="size-3 shrink-0" />
                    <span className="truncate">
                      {gekozenMedewerker?.naam ?? "Toewijzen"}
                    </span>
                  </span>
                </SelectTrigger>
                {/* position="popper" is hier niet optioneel. `SelectContent`
                    staat in deze repo standaard op "item-aligned", en die
                    modus legt de lijst over de trigger heen door zelf top/left
                    uit te rekenen. Bij deze compacte h-7-trigger komt daar
                    top:1167px uit — ruim onder de vouw, dus de lijst opent
                    buiten beeld en je kunt niets kiezen. "popper" gebruikt
                    Radix' Popper mét collision detection, net als elke
                    DropdownMenu in de app (die werken daarom wél). */}
                <SelectContent position="popper">
                  <SelectItem value={NIEMAND}>Niemand</SelectItem>
                  {medewerkerLijst.map((medewerker) => (
                    <SelectItem key={medewerker._id} value={medewerker._id}>
                      {medewerker.naam}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                min={vandaag}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                aria-label="Deadline"
                className="h-7 w-auto min-h-0 border-0 bg-transparent px-1.5 text-xs shadow-none dark:bg-transparent"
              />

              <Select
                value={prioriteit}
                onValueChange={(waarde) => setPrioriteit(waarde as Prioriteit)}
                onOpenChange={setKeuzelijstOpen}
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Prioriteit"
                  className={kaleTriggerClasses}
                >
                  <span className="flex items-center gap-1.5">
                    {prioriteit === "hoog" && (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-destructive"
                        aria-hidden
                      />
                    )}
                    {prioriteit === "laag" && (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                        aria-hidden
                      />
                    )}
                    <span>{PRIORITEIT_LABELS[prioriteit]}</span>
                  </span>
                </SelectTrigger>
                {/* position="popper" is hier niet optioneel. `SelectContent`
                    staat in deze repo standaard op "item-aligned", en die
                    modus legt de lijst over de trigger heen door zelf top/left
                    uit te rekenen. Bij deze compacte h-7-trigger komt daar
                    top:1167px uit — ruim onder de vouw, dus de lijst opent
                    buiten beeld en je kunt niets kiezen. "popper" gebruikt
                    Radix' Popper mét collision detection, net als elke
                    DropdownMenu in de app (die werken daarom wél). */}
                <SelectContent position="popper">
                  {(Object.keys(PRIORITEIT_LABELS) as Prioriteit[]).map(
                    (waarde) => (
                      <SelectItem key={waarde} value={waarde}>
                        {PRIORITEIT_LABELS[waarde]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>

              <Button
                type="button"
                size="xs"
                className="ml-auto h-7 min-h-0"
                onClick={handleCreate}
                disabled={bezig || !titel.trim()}
              >
                Toevoegen
              </Button>
            </div>
          </div>
        </div>
      </div>

      {taken === undefined ? (
        <ul className="divide-y">
          {[0, 1].map((i) => (
            <li
              key={i}
              className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5 px-3 py-2"
            >
              <Skeleton className="mt-0.5 size-4 rounded-[4px]" />
              <Skeleton className="mt-0.5 h-3.5 w-[55%]" />
            </li>
          ))}
        </ul>
      ) : lijstLeeg ? null : (
        <ul className="divide-y">
          {openTaken.map((taak) => (
            <TaakRegel
              key={taak._id}
              taak={taak}
              vandaag={vandaag}
              medewerkers={medewerkerLijst}
              isNieuw={taak._id === nieuweTaakId}
              onToggle={handleToggle}
              onToewijzen={handleToewijzen}
              onPrioriteit={handlePrioriteit}
              onVerwijderen={handleVerwijderen}
            />
          ))}

          {zichtbaarAfgerond.length > 0 && (
            <li className="bg-muted/30 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Afgerond
            </li>
          )}

          {zichtbaarAfgerond.map((taak) => (
            <TaakRegel
              key={taak._id}
              taak={taak}
              vandaag={vandaag}
              medewerkers={medewerkerLijst}
              isNieuw={false}
              onToggle={handleToggle}
              onToewijzen={handleToewijzen}
              onPrioriteit={handlePrioriteit}
              onVerwijderen={handleVerwijderen}
            />
          ))}
        </ul>
      )}

      {afgerondeTaken.length > 0 && (
        <div className="border-t px-3 py-1.5">
          <button
            type="button"
            onClick={() => setToonAfgerond((waarde) => !waarde)}
            className="rounded text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {toonAfgerond
              ? "Afgeronde taken verbergen"
              : `${afgerondeTaken.length} afgeronde ta${afgerondeTaken.length === 1 ? "ak" : "ken"} tonen`}
          </button>
        </div>
      )}
    </SectiePaneel>
  );
}

interface TaakRegelProps {
  taak: VerrijkteKlantTaak;
  vandaag: string;
  medewerkers: { _id: Id<"medewerkers">; naam: string }[];
  isNieuw: boolean;
  onToggle: (
    id: Id<"klantTaken">,
    huidigeStatus: "open" | "afgerond"
  ) => Promise<void>;
  onToewijzen: (id: Id<"klantTaken">, waarde: string) => Promise<void>;
  onPrioriteit: (id: Id<"klantTaken">, waarde: string) => Promise<void>;
  onVerwijderen: (id: Id<"klantTaken">) => Promise<void>;
}

/**
 * Eén regel: titel boven, meta eronder. Je scant "wat moet er gebeuren", niet
 * "wie was het ook alweer" — toegewezene, deadline en klus zijn de voetnoot.
 */
function TaakRegel({
  taak,
  vandaag,
  medewerkers,
  isNieuw,
  onToggle,
  onToewijzen,
  onPrioriteit,
  onVerwijderen,
}: TaakRegelProps) {
  const isAfgerond = taak.status === "afgerond";
  const isHoog = taak.prioriteit === "hoog" && !isAfgerond;
  const deadline =
    taak.deadline && !isAfgerond
      ? deadlineWeergave(taak.deadline, vandaag)
      : null;

  const metaDelen: ReactNode[] = [];

  if (deadline && taak.deadline) {
    metaDelen.push(
      <time
        key="deadline"
        dateTime={taak.deadline}
        title={formatDeadline(taak.deadline)}
        className={cn(
          "inline-flex items-center gap-1",
          // `text-destructive` haalt op het werkvlak gemeten 4,2:1 — onder AA
          // voor deze 11px-regel. `--status-vervallen-text` is dezelfde
          // betekenis uit de ene statusbron en meet 10,2:1 (licht) / 9,1:1
          // (donker). De dagstaat gebruikte die al; hier stond hij nog niet.
          deadline.teLaat && "font-medium text-status-vervallen-text",
          !deadline.teLaat && deadline.nadruk && "font-medium text-foreground"
        )}
      >
        {deadline.teLaat && <AlertTriangle className="size-3 shrink-0" />}
        {deadline.tekst}
      </time>
    );
  }

  metaDelen.push(
    <span
      key="toegewezen"
      className="inline-flex min-w-0 items-center gap-1"
      title={taak.toegewezenAanNaam ?? "Niet toegewezen"}
    >
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium leading-none text-muted-foreground"
      >
        {initialen(taak.toegewezenAanNaam)}
      </span>
      <span className="truncate @max-[30rem]/sectie:sr-only">
        {taak.toegewezenAanNaam ?? "Niet toegewezen"}
      </span>
    </span>
  );

  if (taak.werkitemNaam) {
    metaDelen.push(
      <span
        key="werkitem"
        className="inline-flex min-w-0 items-center gap-1"
        title={taak.werkitemNaam}
      >
        <Briefcase className="size-3 shrink-0" />
        <span className="truncate @max-[30rem]/sectie:max-w-[8rem]">
          {taak.werkitemNaam}
        </span>
      </span>
    );
  }

  return (
    <li
      className={cn(
        "group grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-2.5 px-3 py-2 transition-colors duration-100 hover:bg-muted/40",
        isNieuw &&
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200"
      )}
    >
      {/* Zelfde hokje als op de dagstaat: zichtbare merkgroene rand (≥3:1),
          geneutraliseerde 44px-wrapper en een onzichtbare hitzone om het
          16px-vinkje. Zie components/taken/taak-checkbox.tsx. */}
      <TaakCheckbox
        wrapperClassName="mt-0.5"
        checked={isAfgerond}
        onCheckedChange={() => onToggle(taak._id, taak.status)}
        aria-label={
          isAfgerond
            ? `Taak ${taak.titel} heropenen`
            : `Taak ${taak.titel} afronden`
        }
      />

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          {/* Prioriteitsstip op een vaste plek: zo beginnen alle titels op
              dezelfde x, ook zonder stip. Alleen `hoog` krijgt echt inkt —
              een zachte halo eromheen laat hem branden zonder groter te
              worden. Een lijst waarin alles kleur heeft, wijst nergens meer
              naar; `laag` is daarom een open ringetje in plaats van een
              tweede gevulde stip. */}
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              isAfgerond
                ? "bg-transparent"
                : isHoog
                  ? "bg-destructive ring-2 ring-destructive/20"
                  : taak.prioriteit === "laag"
                    ? "border border-muted-foreground/40"
                    : "bg-muted-foreground/30"
            )}
            title={
              isAfgerond
                ? undefined
                : `Prioriteit: ${PRIORITEIT_LABELS[taak.prioriteit]}`
            }
          >
            {isHoog && <span className="sr-only">Hoge prioriteit</span>}
          </span>
          {/* Afgerond = gedempte tekst met een zachte doorhaling, geen
              blanket-opacity over de hele rij: zo blijft het groene vinkje
              vol van kleur staan als bewijs dat het gedaan is. */}
          <span
            className={cn(
              "truncate text-sm leading-snug transition-colors duration-200",
              isHoog && "font-medium",
              isAfgerond &&
                "text-muted-foreground line-through decoration-muted-foreground/50"
            )}
            title={taak.titel}
          >
            {taak.titel}
          </span>
        </div>

        <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] leading-tight text-muted-foreground">
          {metaDelen.map((deel, index) => (
            <Fragment key={index}>
              {index > 0 && <span aria-hidden>·</span>}
              {deel}
            </Fragment>
          ))}
        </p>

        {taak.omschrijving && (
          <p
            className="mt-0.5 line-clamp-2 break-words text-xs leading-snug text-muted-foreground/90 @max-[30rem]/sectie:line-clamp-1"
            title={taak.omschrijving}
          >
            {taak.omschrijving}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center opacity-0 transition-opacity duration-100 group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100 @max-[30rem]/sectie:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-6 min-h-0"
              aria-label={`Acties voor ${taak.titel}`}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs">
              Toewijzen aan
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={taak.toegewezenAanId ?? NIEMAND}
              onValueChange={(waarde) => onToewijzen(taak._id, waarde)}
            >
              <DropdownMenuRadioItem value={NIEMAND}>
                Niet toegewezen
              </DropdownMenuRadioItem>
              {medewerkers.map((medewerker) => (
                <DropdownMenuRadioItem
                  key={medewerker._id}
                  value={medewerker._id}
                >
                  {medewerker.naam}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Prioriteit</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={taak.prioriteit}
              onValueChange={(waarde) => onPrioriteit(taak._id, waarde)}
            >
              {(Object.keys(PRIORITEIT_LABELS) as Prioriteit[]).map((waarde) => (
                <DropdownMenuRadioItem key={waarde} value={waarde}>
                  {PRIORITEIT_LABELS[waarde]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onVerwijderen(taak._id)}
            >
              <Trash2 className="size-3.5" />
              Verwijderen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
