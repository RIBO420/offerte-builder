"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Check, ChevronsUpDown, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { useCurrentUser } from "@/hooks/use-current-user";
import { useKlanten, useKlantenSearch } from "@/hooks/use-klanten";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Prioriteit = "laag" | "normaal" | "hoog";

const PRIORITEIT_LABELS: Record<Prioriteit, string> = {
  laag: "Laag",
  normaal: "Normaal",
  hoog: "Hoog",
};

/** Hoeveel klanten de kiezer toont voordat je gaat typen. */
const ZICHTBARE_KLANTEN = 8;

function vandaagISO(): string {
  // Lokale datum, niet toISOString() — die schuift 's avonds een dag terug.
  const nu = new Date();
  const maand = `${nu.getMonth() + 1}`.padStart(2, "0");
  const dag = `${nu.getDate()}`.padStart(2, "0");
  return `${nu.getFullYear()}-${maand}-${dag}`;
}

/** Kale trigger-vorm van de composer-strip; gelijk aan het klantdossier. */
const KALE_TRIGGER =
  "h-7 min-h-0 w-auto gap-1 border-0 bg-transparent px-1.5 text-xs text-muted-foreground shadow-none hover:bg-accent hover:text-foreground dark:bg-transparent dark:hover:bg-accent";

export interface GekozenKlant {
  id: Id<"klanten">;
  naam: string;
}

/**
 * Klantkiezer van de dagstaat-composer: zoeken op naam, met de recent
 * aangeraakte klanten als eerste aanbod.
 *
 * Bewust een eigen, compacte kiezer en niet de `KlantKiezer` uit
 * `offerte/klant-koppeling.tsx`: die hoort bij de offerte-editors (en staat
 * daar onder handen), toont offertehistorie, leads en "nieuwe klant aanmaken",
 * en is daarmee veel te zwaar voor één regel in een bento-cel. Wat we wél
 * delen zijn de datalagen: `useKlanten` en `useKlantenSearch`.
 *
 * Opvolgpunt: zodra de eenwording van de klant-koppelcomponenten klaar is,
 * kan deze kiezer daar mogelijk een compacte variant van worden.
 */
function KlantKiezer({
  waarde,
  onKies,
  onOpenChange,
}: {
  waarde: GekozenKlant | null;
  onKies: (klant: GekozenKlant) => void;
  /** Meldt de composer dat er een portal openstaat (anders klapt hij dicht). */
  onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [zoek, setZoek] = useState("");

  // Twee bestaande hooks: de lijst voor het eerste aanbod, de zoekindex zodra
  // je typt (die slaat zichzelf over bij een lege term).
  const { klanten, recentKlanten } = useKlanten();
  const { results } = useKlantenSearch(zoek);

  const opties = useMemo(() => {
    if (zoek.trim()) return results.slice(0, ZICHTBARE_KLANTEN);
    const gezien = new Set<string>();
    const uit: { _id: Id<"klanten">; naam: string; plaats?: string }[] = [];
    for (const klant of [...recentKlanten, ...klanten]) {
      if (gezien.has(klant._id)) continue;
      gezien.add(klant._id);
      uit.push(klant);
      if (uit.length >= ZICHTBARE_KLANTEN) break;
    }
    return uit;
  }, [zoek, results, recentKlanten, klanten]);

  const zetOpen = (nieuw: boolean) => {
    setOpen(nieuw);
    onOpenChange(nieuw);
    if (!nieuw) setZoek("");
  };

  return (
    <Popover open={open} onOpenChange={zetOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          role="combobox"
          aria-expanded={open}
          aria-label="Klant kiezen"
          className={cn(
            KALE_TRIGGER,
            "max-w-[11rem]",
            // Verplicht veld: zolang er geen klant staat, ziet de knop eruit
            // als een in te vullen vak in plaats van als een stille actie.
            !waarde && "border border-dashed border-border",
            waarde && "font-medium text-foreground"
          )}
        >
          <UserRound className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{waarde?.naam ?? "Klant kiezen"}</span>
          <ChevronsUpDown className="size-3 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        {/* shouldFilter uit: de lijst komt van de zoekindex, niet van cmdk —
            anders filtert cmdk de serverresultaten nóg een keer weg. */}
        <Command shouldFilter={false}>
          <CommandInput
            value={zoek}
            onValueChange={setZoek}
            placeholder="Zoek klant…"
          />
          <CommandList>
            <CommandEmpty>Geen klant gevonden.</CommandEmpty>
            <CommandGroup>
              {opties.map((klant) => (
                <CommandItem
                  key={klant._id}
                  value={klant._id}
                  onSelect={() => {
                    onKies({ id: klant._id, naam: klant.naam });
                    zetOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-3.5",
                      waarde?.id === klant._id ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{klant.naam}</span>
                  {klant.plaats && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {klant.plaats}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Composer van "Mijn taken" op de dagstaat: één regel die openklapt zodra je
 * hem aanraakt, precies zoals de takencomposer op het klantdossier
 * (`klanten/klant-taken-card.tsx`, zie docs/dev/ui-patronen.md).
 *
 * Eén verschil, en dat is het hele punt: een taak hoort bij een klant, en op
 * het dashboard staat die klant niet vast. De strip krijgt daarom een compacte
 * klantkiezer, en zonder klant kun je niet opslaan.
 *
 * Tweede keuze: de taak komt op jóuw naam. Dit blok heet "Mijn taken" — wie
 * hier iets invoert, voert het voor zichzelf in. Toewijzen aan een collega
 * blijft op het klantdossier, waar de hele ploeg in de keuzelijst staat.
 * (Zonder gekoppeld medewerkerprofiel — kantoor — blijft de taak onverdeeld;
 * `klantTaken.mijnTaken` toont die gebruiker toch alle open taken.)
 */
export function DagstaatTaakComposer({
  metScheiding,
}: {
  /** Staat er een lijst onder? Dan een scheidingslijn, anders niets. */
  metScheiding: boolean;
}) {
  const createTaak = useMutation(api.klantTaken.create);
  const { user } = useCurrentUser();

  const [open, setOpen] = useState(false);
  // Pas ná de eerste opening mag de strip bestaan: de klantkiezer abonneert
  // zich op de klantenlijst, en die query hoort niet bij het laden van het
  // dashboard te horen. Daarna blijft hij staan (CSS verbergt hem), zodat de
  // subscriptie warm blijft en er niets opnieuw hoeft te monteren.
  const [ooitGeopend, setOoitGeopend] = useState(false);
  const [titel, setTitel] = useState("");
  const [klant, setKlant] = useState<GekozenKlant | null>(null);
  const [deadline, setDeadline] = useState("");
  const [prioriteit, setPrioriteit] = useState<Prioriteit>("normaal");
  const [bezig, setBezig] = useState(false);
  // Radix zet Select- en Popover-inhoud in een portal; zonder deze vlag klapt
  // de composer dicht zodra je een keuzelijst opent.
  const [keuzelijstOpen, setKeuzelijstOpen] = useState(false);

  const titelRef = useRef<HTMLInputElement>(null);

  const heeftInvoer =
    titel.trim() !== "" ||
    klant !== null ||
    deadline !== "" ||
    prioriteit !== "normaal";

  const openen = () => {
    setOpen(true);
    setOoitGeopend(true);
  };

  const handleCreate = async () => {
    if (!klant) {
      showErrorToast("Kies eerst de klant waar deze taak bij hoort");
      return;
    }
    if (!titel.trim()) {
      showErrorToast("Geef de taak een titel");
      return;
    }
    setBezig(true);
    try {
      await createTaak({
        klantId: klant.id,
        titel: titel.trim(),
        prioriteit,
        deadline: deadline || undefined,
        toegewezenAanId: user?.linkedMedewerkerId ?? undefined,
      });
      showSuccessToast("Taak toegevoegd");
      // Klant blijft staan: twee taken voor dezelfde klant achter elkaar
      // invoeren is de normale gang. De rest gaat terug naar leeg en de
      // cursor terug in het titelveld.
      setTitel("");
      setDeadline("");
      setPrioriteit("normaal");
      titelRef.current?.focus();
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij toevoegen taak"
      );
    } finally {
      setBezig(false);
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (keuzelijstOpen) return;
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    if (heeftInvoer) return;
    setOpen(false);
  };

  /**
   * Het klikvlak is de hele regel, niet het veld van 19px. Eigen controls
   * houden hun eigen gedrag; `preventDefault` houdt de focus in het titelveld.
   */
  const openViaRegel = (event: React.MouseEvent<HTMLDivElement>) => {
    const doel = event.target as Element | null;
    // Portalinhoud (de klantkiezer-popover, select-menu's) borrelt via de
    // Réact-boom naar deze handler maar zit niet in de regel-DOM. Zonder deze
    // check steelt preventDefault+focus de klik: Radix ziet de focus buiten
    // de popover en sluit hem vóór de keuze landt — een aangeklikt
    // zoekresultaat ging zo verloren (melding 16 aug).
    if (doel && !event.currentTarget.contains(doel)) {
      return;
    }
    if (doel?.closest("button, input, textarea, select, a, [role='combobox']")) {
      return;
    }
    event.preventDefault();
    openen();
    titelRef.current?.focus();
  };

  return (
    <div
      data-open={open}
      onBlur={handleBlur}
      onMouseDown={openViaRegel}
      className={cn(
        "group/composer px-3 py-2 data-[open=false]:cursor-text data-[open=false]:hover:bg-muted/40",
        metScheiding && "border-b"
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
            onFocus={openen}
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
            className="w-full border-0 bg-transparent p-0 text-[13px] leading-5 outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          />

          {ooitGeopend && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-150 group-data-[open=false]/composer:hidden">
              <KlantKiezer
                waarde={klant}
                onKies={setKlant}
                onOpenChange={setKeuzelijstOpen}
              />

              <Input
                type="date"
                min={vandaagISO()}
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
                  className={KALE_TRIGGER}
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
                {/* position="popper": `SelectContent` staat in deze repo op
                    "item-aligned", en die modus rekent bij een compacte
                    h-7-trigger een top ver onder de vouw uit — de lijst opent
                    dan buiten beeld. Zie klant-taken-card.tsx. */}
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
                disabled={bezig || !titel.trim() || !klant}
              >
                Toevoegen
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
