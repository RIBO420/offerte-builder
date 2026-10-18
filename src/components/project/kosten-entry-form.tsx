"use client";

/**
 * Kosten boeken op een project: materiaal (verbruik uit de productenlijst) of
 * machine-inzet. Opslaan loopt via `projectKosten.create`; de regels van
 * formulier naar mutatie staan in `kosten/boeken.ts`.
 *
 * Arbeid boek je als uren bij Uitvoering (daar hoort de medewerker en de
 * urenregistratie bij); dit formulier verwijst daarheen. "Overig" heeft geen
 * opslag in de backend en wordt daarom niet aangeboden.
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { format, subDays } from "date-fns";
import { CalendarIcon, Clock, Loader2, Search } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/ui/number-input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format/currency";
import { nl } from "@/lib/date-locale";
import { cn } from "@/lib/utils";
import type { KostSoort } from "./kosten/stand";
import {
  boekBedrag,
  naarCreateArgs,
  type BoekInvoer,
  type BoekMachine,
  type BoekProduct,
  type CreateArgs,
} from "./kosten/boeken";

type Tab = "materiaal" | "machine" | "arbeid";

const TABS: { id: Tab; label: string }[] = [
  { id: "materiaal", label: "Materiaal" },
  { id: "machine", label: "Machine" },
  { id: "arbeid", label: "Arbeid" },
];

interface KostenEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projecten">;
  /** Voorinstelling vanuit "Materiaal boeken" e.d.; overig valt terug op materiaal. */
  soort?: KostSoort;
  isLoading?: boolean;
  /** Geeft true terug als het opslaan lukte; dan sluit de ouder het formulier. */
  onSubmit: (args: CreateArgs) => Promise<boolean>;
}

function beginTab(soort?: KostSoort): Tab {
  return soort === "machine" || soort === "arbeid" ? soort : "materiaal";
}

export function KostenEntryForm({
  open,
  onOpenChange,
  projectId,
  soort,
  isLoading = false,
  onSubmit,
}: KostenEntryFormProps) {
  const [tab, setTab] = useState<Tab>(() => beginTab(soort));
  const [datum, setDatum] = useState<Date>(() => new Date());
  const [hoeveelheid, setHoeveelheid] = useState(0);
  const [omschrijving, setOmschrijving] = useState("");
  const [notities, setNotities] = useState("");
  const [product, setProduct] = useState<BoekProduct | null>(null);
  const [zoekterm, setZoekterm] = useState("");
  const [machineId, setMachineId] = useState<string>("");
  const [tarief, setTarief] = useState(0);
  const [fout, setFout] = useState<string | null>(null);

  const term = zoekterm.trim();
  const zoekResultaten = useQuery(
    api.producten.search,
    tab === "materiaal" && !product && term.length >= 2 ? { zoekterm: term } : "skip"
  );
  const machines = useQuery(api.machines.list, tab === "machine" ? {} : "skip");
  const actieveMachines = (machines ?? []).filter((m) => m.isActief);
  const machine: BoekMachine | null = actieveMachines.find((m) => m._id === machineId) ?? null;

  const gedeeld = {
    datum: format(datum, "yyyy-MM-dd"),
    hoeveelheid,
    omschrijving,
    notities,
  };
  const invoer: BoekInvoer =
    tab === "machine"
      ? { soort: "machine", machine, tarief, ...gedeeld }
      : { soort: "materiaal", product, ...gedeeld };

  const bedrag = tab === "arbeid" ? null : boekBedrag(invoer);

  function kiesTab(nieuw: Tab) {
    setTab(nieuw);
    setHoeveelheid(0);
    setOmschrijving("");
    setFout(null);
  }

  function kiesMachine(id: string) {
    setMachineId(id);
    const m = actieveMachines.find((x) => x._id === id);
    if (m) setTarief(m.tarief);
    setFout(null);
  }

  async function opslaan(e: React.FormEvent) {
    e.preventDefault();
    if (tab === "arbeid") return;
    const resultaat = naarCreateArgs(projectId, invoer);
    if (!resultaat.ok) {
      setFout(resultaat.fout);
      return;
    }
    setFout(null);
    await onSubmit(resultaat.args);
  }

  const vandaag = new Date();
  const snelkeuze = [
    { label: "Vandaag", datum: vandaag },
    { label: "Gisteren", datum: subDays(vandaag, 1) },
    { label: "Eergisteren", datum: subDays(vandaag, 2) },
  ];
  const datumSleutel = format(datum, "yyyy-MM-dd");
  const aantalLabel =
    tab === "machine" ? (machine?.tariefType === "dag" ? "Dagen" : "Uren") : "Hoeveelheid";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kosten boeken</DialogTitle>
          <DialogDescription>
            Materiaalverbruik of machine-inzet op dit project. Uren boek je bij Uitvoering.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={opslaan} className="grid gap-5 py-2">
          {/* Soort */}
          <div
            role="radiogroup"
            aria-label="Soort kosten"
            className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={tab === t.id}
                onClick={() => kiesTab(t.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-[background-color,color] duration-150",
                  tab === t.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "arbeid" ? (
            <div className="grid gap-3 rounded-lg bg-muted/60 p-4 text-sm">
              <p className="text-pretty">
                Arbeid telt mee via de urenregistratie: per medewerker, per dag, met het
                uurtarief erbij. Boek de uren bij Uitvoering, dan bewegen de kosten hier vanzelf mee.
              </p>
              <Button asChild className="justify-self-start">
                <Link href={`/projecten/${projectId}/uitvoering`}>
                  <Clock className="me-2 size-4" />
                  Uren registreren bij Uitvoering
                </Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Datum */}
              <div className="grid gap-2">
                <Label>Datum</Label>
                <div className="flex flex-wrap gap-2">
                  {snelkeuze.map((s) => {
                    const actief = format(s.datum, "yyyy-MM-dd") === datumSleutel;
                    return (
                      <Button
                        key={s.label}
                        type="button"
                        size="sm"
                        variant={actief ? "default" : "outline"}
                        onClick={() => setDatum(s.datum)}
                      >
                        {s.label}
                      </Button>
                    );
                  })}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" size="sm" variant="outline" className="font-normal">
                        <CalendarIcon className="me-2 size-4" />
                        {format(datum, "EEE d MMM", { locale: nl })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={datum}
                        onSelect={(d) => d && setDatum(d)}
                        locale={nl}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {tab === "materiaal" ? (
                <div className="grid gap-2">
                  <Label htmlFor="kosten-product">Artikel</Label>
                  {product ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{product.productnaam}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {product.inkoopprijs > 0
                            ? `${formatCurrency(product.inkoopprijs)} inkoop per ${product.eenheid}`
                            : "Geen vaste inkoopprijs"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setProduct(null);
                          setFout(null);
                        }}
                      >
                        Wijzigen
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="kosten-product"
                          value={zoekterm}
                          onChange={(e) => setZoekterm(e.target.value)}
                          placeholder="Zoek in de productenlijst…"
                          className="ps-9"
                          autoComplete="off"
                        />
                      </div>
                      <ProductResultaten
                        term={term}
                        resultaten={zoekResultaten}
                        onKies={(p) => {
                          setProduct(p);
                          setFout(null);
                        }}
                      />
                    </>
                  )}
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="kosten-machine">Machine</Label>
                  <Select value={machineId} onValueChange={kiesMachine}>
                    <SelectTrigger id="kosten-machine">
                      <SelectValue
                        placeholder={machines === undefined ? "Machines laden…" : "Kies een machine"}
                      />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {actieveMachines.map((m) => (
                        <SelectItem key={m._id} value={m._id}>
                          {m.naam} · {formatCurrency(m.tarief)} per {m.tariefType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {machines !== undefined && actieveMachines.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Er staan nog geen actieve machines in het overzicht.
                    </p>
                  )}
                </div>
              )}

              {/* Aantal en prijs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>{aantalLabel}</Label>
                  <NumberInput
                    value={hoeveelheid}
                    onChange={setHoeveelheid}
                    min={0}
                    step={tab === "machine" ? 0.5 : 1}
                    decimals={2}
                    suffix={tab === "materiaal" ? product?.eenheid : undefined}
                  />
                </div>
                {tab === "machine" && (
                  <div className="grid gap-2">
                    <Label>Tarief per {machine?.tariefType ?? "uur"}</Label>
                    <NumberInput
                      value={tarief}
                      onChange={setTarief}
                      min={0}
                      step={5}
                      decimals={2}
                      prefix="€"
                    />
                  </div>
                )}
              </div>

              {/* Omschrijving en notities */}
              <div className="grid gap-2">
                <Label htmlFor="kosten-omschrijving">Omschrijving (optioneel)</Label>
                <Input
                  id="kosten-omschrijving"
                  value={omschrijving}
                  onChange={(e) => setOmschrijving(e.target.value)}
                  placeholder={
                    (tab === "materiaal" ? product?.productnaam : machine?.naam) ??
                    "Standaard de naam van het artikel of de machine"
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="kosten-notities">Notities (optioneel)</Label>
                <Textarea
                  id="kosten-notities"
                  value={notities}
                  onChange={(e) => setNotities(e.target.value)}
                  placeholder="Bonnummer, leverancier, bijzonderheden…"
                  rows={2}
                />
              </div>

              {/* Uitkomst */}
              <div className="flex items-baseline justify-between gap-3 border-t pt-4">
                <span className="text-sm text-muted-foreground">Telt mee als kosten</span>
                <span className="font-display text-xl font-semibold tabular-nums">
                  {bedrag === null ? "—" : formatCurrency(bedrag)}
                </span>
              </div>
              {fout && (
                <p role="alert" className="text-pretty text-sm text-destructive">
                  {fout}
                </p>
              )}
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tab === "arbeid" ? "Sluiten" : "Annuleren"}
            </Button>
            {tab !== "arbeid" && (
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="me-2 size-4 animate-spin" />}
                Boeken
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductResultaten({
  term,
  resultaten,
  onKies,
}: {
  term: string;
  resultaten: (BoekProduct & { isActief: boolean })[] | undefined;
  onKies: (p: BoekProduct) => void;
}) {
  if (term.length < 2) {
    return <p className="text-xs text-muted-foreground">Typ minstens twee letters.</p>;
  }
  if (resultaten === undefined) {
    return <p className="text-xs text-muted-foreground">Zoeken…</p>;
  }
  const actief = resultaten.filter((p) => p.isActief).slice(0, 8);
  if (actief.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Geen artikel gevonden voor &ldquo;{term}&rdquo;.
      </p>
    );
  }
  return (
    <ul className="grid max-h-56 gap-0.5 overflow-y-auto rounded-lg border p-1">
      {actief.map((p) => (
        <li key={p._id}>
          <button
            type="button"
            onClick={() => onKies(p)}
            className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-start text-sm transition-colors duration-150 hover:bg-muted"
          >
            <span className="min-w-0 truncate">{p.productnaam}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {p.inkoopprijs > 0 ? `${formatCurrency(p.inkoopprijs)} / ${p.eenheid}` : "geen inkoopprijs"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
