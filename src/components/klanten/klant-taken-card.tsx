"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  ChevronDown,
  ListTodo,
  NotebookPen,
  Plus,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { TaakKaart } from "@/components/taken/taak-kaart";
import {
  NIEMAND,
  PRIORITEIT_LABELS,
  parseISODatum,
  persoonLabel,
  vandaagISO,
  type TaakPrioriteit,
} from "@/components/taken/types";
import { cn } from "@/lib/utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const DATUM_KORT_WEEKDAG = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** ISO-datum + n dagen → ISO-datum, in lokale tijd (zie `vandaagISO`). */
function plusDagenISO(vanISO: string, dagen: number): string {
  const datum = parseISODatum(vanISO);
  datum.setDate(datum.getDate() + dagen);
  const maand = `${datum.getMonth() + 1}`.padStart(2, "0");
  const dag = `${datum.getDate()}`.padStart(2, "0");
  return `${datum.getFullYear()}-${maand}-${dag}`;
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

const PRIORITEIT_RANG: Record<TaakPrioriteit, number> = {
  hoog: 0,
  normaal: 1,
  laag: 2,
};

/**
 * Takenlijst per klant: wat moet er nog gebeuren voor deze klant, wie maakt het
 * en wie checkt het. Bewust gescheiden van de klanttijdlijn (wat er gebeurd is).
 *
 * De kaarten komen uit de gedeelde taken-kit (`components/taken/`), dezelfde
 * die het werkbord "Mijn dag" gebruikt: één taakkaart, twee plekken. Anders
 * lopen de statusknoppen en de maker/checker-selects op twee schermen uit
 * elkaar zodra er iets verandert.
 *
 * De bovenste regel is de composer. Geen "Nieuwe taak"-knop die eerst een
 * formulier moet openen — de snelste route van gedachte naar taak is klikken
 * en typen.
 */
export function KlantTakenCard({ klantId }: { klantId: Id<"klanten"> }) {
  const taken = useQuery(api.klantTaken.listVoorKlant, { klantId });
  const personen = useQuery(api.users.takenToewijsbaar, {});

  const createTaak = useMutation(api.klantTaken.create);

  const [open, setOpen] = useState(false);
  const [titel, setTitel] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [toelichtingOpen, setToelichtingOpen] = useState(false);
  const [prioriteit, setPrioriteit] = useState<TaakPrioriteit>("normaal");
  const [deadline, setDeadline] = useState("");
  const [maker, setMaker] = useState<string>(NIEMAND);
  const [bezig, setBezig] = useState(false);
  const [toonAfgerond, setToonAfgerond] = useState(false);
  // Radix zet zijn Select-inhoud in een portal; zonder deze vlag klapt de
  // composer dicht zodra je een keuzelijst opent.
  const [keuzelijstOpen, setKeuzelijstOpen] = useState(false);

  const titelRef = useRef<HTMLInputElement>(null);

  const vandaag = vandaagISO();
  const personenLijst = useMemo(() => personen ?? [], [personen]);

  const openTaken = useMemo(() => {
    const nu = vandaagISO();
    return (taken ?? [])
      .filter((t) => t.status !== "klaar")
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
    () => (taken ?? []).filter((t) => t.status === "klaar"),
    [taken]
  );

  const gekozenPersoon = personenLijst.find((p) => p._id === maker);

  const heeftInvoer =
    titel.trim() !== "" ||
    omschrijving.trim() !== "" ||
    deadline !== "" ||
    maker !== NIEMAND ||
    prioriteit !== "normaal";

  const resetForm = () => {
    setTitel("");
    setOmschrijving("");
    setToelichtingOpen(false);
    setPrioriteit("normaal");
    setDeadline("");
    setMaker(NIEMAND);
  };

  const handleCreate = async () => {
    if (!titel.trim()) {
      showErrorToast("Geef de taak een titel");
      return;
    }
    setBezig(true);
    try {
      await createTaak({
        klantId,
        titel: titel.trim(),
        omschrijving: omschrijving.trim() || undefined,
        prioriteit,
        deadline: deadline || undefined,
        makerId: maker === NIEMAND ? undefined : (maker as Id<"users">),
      });
      showSuccessToast("Taak toegevoegd");
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
   * precies op de tekst, kreeg dus niets. De hele regel opent nu de composer.
   */
  const openViaRegel = (event: React.MouseEvent<HTMLDivElement>) => {
    const doel = event.target as Element | null;
    // Portalinhoud (select-menu's) borrelt via de React-boom hierheen maar zit
    // niet in de regel-DOM; focus stelen sluit dan het open menu vóór de keuze
    // landt (zelfde valkuil als de dagstaat-klantkiezer, 16 aug).
    if (doel && !event.currentTarget.contains(doel)) return;
    // Eigen controls houden hun eigen gedrag (knoppen, selects, tekstvelden).
    if (doel?.closest("button, input, textarea, select, a, [role='combobox']")) {
      return;
    }
    // preventDefault houdt de focus waar hij hoort: in het titelveld.
    event.preventDefault();
    titelRef.current?.focus();
  };

  // Chip-taal van de metaregel: zelfde vorm als de typechips van de
  // gesprekscomposer. Leeg = gedempt met gekleurde rand bij hover; gezet =
  // primary-tint zodat je in één blik ziet wát er al gekozen is.
  const chipKlasse =
    "inline-flex h-7 min-h-0 w-auto items-center gap-1.5 rounded-full border bg-transparent px-2.5 text-xs font-medium shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-transparent";
  const chipLeeg =
    "text-muted-foreground hover:border-primary hover:bg-transparent hover:text-foreground dark:hover:bg-transparent";
  const chipGezet =
    "border-primary/40 bg-primary/10 text-foreground dark:bg-primary/15";

  const heeftTaken = openTaken.length > 0 || afgerondeTaken.length > 0;
  const lijstLeeg = !heeftTaken;

  // Taken zijn werkstroom: vooruitkijken staat bovenaan het dossier en weegt
  // zwaarder dan het archief eronder. Ook zónder taken blijft dit een paneel —
  // de composer is hier de reden dat je er bent.
  const legeRegel =
    taken !== undefined && lijstLeeg ? { tekst: "Nog geen taken." } : undefined;

  return (
    <SectiePaneel
      titel="Taken"
      icoon={<ListTodo />}
      telling={openTaken.length}
      kopbalk
      legeRegel={legeRegel}
      uitleg="Losse to-do's voor deze klant: terugbellen, offerte narekenen, materiaal bestellen. Op een open kaart kies je wie het maakt en wie het vóór verzending checkt; die taak komt dan ook op hun Mijn dag te staan. Enter slaat direct op."
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

            {/* Toelichting op een eigen regel: een groeiend tekstveld midden in
                de metaregel duwde de controls uit het lood. */}
            {toelichtingOpen && (
              <textarea
                value={omschrijving}
                onChange={(e) => setOmschrijving(e.target.value)}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
                rows={1}
                aria-label="Toelichting bij de taak"
                placeholder="Extra context…"
                className="mt-1 max-h-36 w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-xs leading-snug outline-none placeholder:text-muted-foreground focus-visible:ring-0 group-data-[open=false]/composer:hidden"
              />
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-150 group-data-[open=false]/composer:hidden">
              <Popover onOpenChange={setKeuzelijstOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Deadline kiezen"
                    className={cn(chipKlasse, deadline ? chipGezet : chipLeeg)}
                  >
                    <CalendarDays className="size-3.5" aria-hidden />
                    {deadline
                      ? DATUM_KORT_WEEKDAG.format(parseISODatum(deadline))
                      : "Deadline"}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-2">
                  <div className="grid gap-1">
                    {(
                      [
                        ["Vandaag", vandaag],
                        ["Morgen", plusDagenISO(vandaag, 1)],
                        ["Volgende week", plusDagenISO(vandaag, 7)],
                      ] as const
                    ).map(([label, iso]) => (
                      <Button
                        key={label}
                        type="button"
                        variant={deadline === iso ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 justify-between px-2 font-normal"
                        onClick={() => setDeadline(iso)}
                      >
                        {label}
                        <span className="text-xs text-muted-foreground">
                          {DATUM_KORT_WEEKDAG.format(parseISODatum(iso))}
                        </span>
                      </Button>
                    ))}
                  </div>
                  <Input
                    type="date"
                    min={vandaag}
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    aria-label="Deadline"
                    className="mt-2 h-8"
                  />
                  {deadline && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-7 w-full justify-start px-2 text-xs text-muted-foreground"
                      onClick={() => setDeadline("")}
                    >
                      Geen deadline
                    </Button>
                  )}
                </PopoverContent>
              </Popover>

              <Select
                value={maker}
                onValueChange={setMaker}
                onOpenChange={setKeuzelijstOpen}
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Taak toewijzen"
                  className={cn(
                    chipKlasse,
                    "max-w-[12rem]",
                    gekozenPersoon ? chipGezet : chipLeeg
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <User className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                      {gekozenPersoon?.naam ?? "Toewijzen"}
                    </span>
                  </span>
                </SelectTrigger>
                {/* position="popper" is hier niet optioneel. `SelectContent`
                    staat in deze repo standaard op "item-aligned", en die modus
                    legt de lijst over de trigger heen door zelf top/left uit te
                    rekenen. Bij deze compacte h-7-trigger komt daar top:1167px
                    uit — ruim onder de vouw, dus de lijst opent buiten beeld en
                    je kunt niets kiezen. */}
                <SelectContent position="popper">
                  <SelectItem value={NIEMAND}>Niemand</SelectItem>
                  {personenLijst.map((persoon) => (
                    <SelectItem key={persoon._id} value={persoon._id}>
                      {persoonLabel(persoon)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={prioriteit}
                onValueChange={(waarde) =>
                  setPrioriteit(waarde as TaakPrioriteit)
                }
                onOpenChange={setKeuzelijstOpen}
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Prioriteit"
                  className={cn(
                    chipKlasse,
                    prioriteit !== "normaal" ? chipGezet : chipLeeg
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span>{PRIORITEIT_LABELS[prioriteit]}</span>
                  </span>
                </SelectTrigger>
                <SelectContent position="popper">
                  {(Object.keys(PRIORITEIT_LABELS) as TaakPrioriteit[]).map(
                    (waarde) => (
                      <SelectItem key={waarde} value={waarde}>
                        {PRIORITEIT_LABELS[waarde]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>

              {!toelichtingOpen && (
                <button
                  type="button"
                  className={cn(chipKlasse, chipLeeg)}
                  onClick={() => setToelichtingOpen(true)}
                >
                  <NotebookPen className="size-3.5" aria-hidden />
                  Notitie
                </button>
              )}

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
        <>
          {openTaken.length > 0 && (
            <>
              <p className="bg-muted/30 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Open ({openTaken.length})
              </p>
              <ul className="divide-y">
                {openTaken.map((taak) => (
                  <li key={taak._id}>
                    <TaakKaart taak={taak} personen={personenLijst} />
                  </li>
                ))}
              </ul>
            </>
          )}

          {afgerondeTaken.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setToonAfgerond((waarde) => !waarde)}
                aria-expanded={toonAfgerond}
                className="flex w-full items-center gap-1.5 border-t bg-muted/30 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-3.5 transition-transform duration-150",
                    toonAfgerond && "rotate-180"
                  )}
                />
                Afgerond ({afgerondeTaken.length})
              </button>
              {toonAfgerond && (
                <ul className="divide-y border-t">
                  {afgerondeTaken.map((taak) => (
                    <li key={taak._id}>
                      <TaakKaart taak={taak} personen={personenLijst} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </SectiePaneel>
  );
}
