"use client";

/**
 * De twee stille invulrijen van het werkblad.
 *
 * **Omstandigheden** (bereikbaarheid, achterstalligheid) stonden in de wizard
 * als "Algemene Parameters" met calculatiejargon in de keuzelijst
 * ("Goed (factor 1.0)"). Hier staan ze samengevat op één regel en klappen ze
 * pas open als je ze nodig hebt — negen van de tien offertes zijn "goed".
 *
 * **Garantie** was een hele stap met drie pricing-cards, waarna de keuze werd
 * weggegooid. Nu: één rij pillen, "Geen" is de standaard (nul klikken), en de
 * keuze landt als echte offerteregel.
 */

import { useState, type ReactNode } from "react";
import { ChevronDown, ShieldCheck, SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { GARANTIE_OPTIES, garantieOptie } from "@/lib/werkbank";
import type { Achterstalligheid, Bereikbaarheid } from "@/types/offerte";

const BEREIKBAARHEID_LABEL: Record<Bereikbaarheid, string> = {
  goed: "Goed bereikbaar",
  beperkt: "Beperkt bereikbaar",
  slecht: "Slecht bereikbaar",
};

const ACHTERSTALLIGHEID_LABEL: Record<Achterstalligheid, string> = {
  laag: "niet achterstallig",
  gemiddeld: "deels achterstallig",
  hoog: "sterk achterstallig",
};

function Rij({
  icoon,
  titel,
  samenvatting,
  open,
  onToggle,
  children,
}: {
  icoon: ReactNode;
  titel: string;
  samenvatting: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="@container/rij overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="shrink-0 text-muted-foreground [&>svg]:size-3.5">
          {icoon}
        </span>
        <span className="shrink-0 text-xs leading-4 font-medium tracking-wide text-muted-foreground uppercase">
          {titel}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs leading-4 text-foreground">
          {samenvatting}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {/* grid-template-rows i.p.v. height: animeert zonder de layout te meten. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t px-3 py-3">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function WerkbankOmstandigheden({
  type,
  bereikbaarheid,
  achterstalligheid,
  onBereikbaarheid,
  onAchterstalligheid,
}: {
  type: "aanleg" | "onderhoud";
  bereikbaarheid: Bereikbaarheid;
  achterstalligheid: Achterstalligheid;
  onBereikbaarheid: (waarde: Bereikbaarheid) => void;
  onAchterstalligheid: (waarde: Achterstalligheid) => void;
}) {
  const [open, setOpen] = useState(false);

  const samenvatting =
    type === "onderhoud"
      ? `${BEREIKBAARHEID_LABEL[bereikbaarheid]}, ${ACHTERSTALLIGHEID_LABEL[achterstalligheid]}`
      : BEREIKBAARHEID_LABEL[bereikbaarheid];

  return (
    <Rij
      icoon={<SlidersHorizontal />}
      titel="Omstandigheden"
      samenvatting={samenvatting}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <div className="grid gap-3 @min-[34rem]/rij:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="werkbank-bereikbaarheid" className="text-xs">
            Bereikbaarheid van de tuin
          </Label>
          <Select
            value={bereikbaarheid}
            onValueChange={(v) => onBereikbaarheid(v as Bereikbaarheid)}
          >
            <SelectTrigger id="werkbank-bereikbaarheid" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="goed">Goed — kruiwagen kan erlangs</SelectItem>
              <SelectItem value="beperkt">
                Beperkt — smalle doorgang of trap
              </SelectItem>
              <SelectItem value="slecht">
                Slecht — alles met de hand naar binnen
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] leading-4 text-muted-foreground">
            Slechter bereikbaar betekent meer arbeidsuren op elke regel.
          </p>
        </div>

        {type === "onderhoud" && (
          <div className="space-y-1.5">
            <Label htmlFor="werkbank-achterstalligheid" className="text-xs">
              Staat van de tuin
            </Label>
            <Select
              value={achterstalligheid}
              onValueChange={(v) => onAchterstalligheid(v as Achterstalligheid)}
            >
              <SelectTrigger id="werkbank-achterstalligheid" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="laag">Bijgehouden</SelectItem>
                <SelectItem value="gemiddeld">Deels achterstallig</SelectItem>
                <SelectItem value="hoog">Sterk achterstallig</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Achterstallig onderhoud kost meer tijd per beurt.
            </p>
          </div>
        )}
      </div>
    </Rij>
  );
}

export function WerkbankGarantie({
  waarde,
  onKies,
}: {
  waarde: string | null;
  onKies: (id: string | null) => void;
}) {
  const gekozen = garantieOptie(waarde);

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2">
        <span className="flex shrink-0 items-center gap-2 text-xs leading-4 font-medium tracking-wide text-muted-foreground uppercase">
          <ShieldCheck aria-hidden className="size-3.5" />
          Garantie
        </span>

        <div
          role="radiogroup"
          aria-label="Garantiepakket"
          className="flex min-w-0 flex-wrap items-center gap-1"
        >
          <Pil
            actief={!gekozen}
            onClick={() => onKies(null)}
            label="Geen"
            titel="Geen garantiepakket op deze offerte"
          />
          {GARANTIE_OPTIES.map((optie) => (
            <Pil
              key={optie.id}
              actief={gekozen?.id === optie.id}
              onClick={() => onKies(optie.id)}
              label={optie.naam}
              extra={formatCurrency(optie.prijs)}
              titel={`${optie.jaren} jaar garantie, ${
                optie.callbacks === -1
                  ? "onbeperkt callbacks"
                  : `${optie.callbacks} callback${optie.callbacks === 1 ? "" : "s"} per jaar`
              }`}
            />
          ))}
        </div>

        <p className="ml-auto shrink-0 text-[11px] leading-4 text-muted-foreground">
          {gekozen
            ? `${gekozen.jaren} jaar · staat als regel op de offerte`
            : "Standaard: geen pakket"}
        </p>
      </div>
    </section>
  );
}

function Pil({
  actief,
  onClick,
  label,
  extra,
  titel,
}: {
  actief: boolean;
  onClick: () => void;
  label: string;
  extra?: string;
  titel: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={actief}
      title={titel}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs leading-4 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        actief
          ? "border-primary/40 bg-primary/10 font-medium text-foreground"
          : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {label}
      {extra && (
        <span className="ml-1.5 tabular-nums opacity-70">{extra}</span>
      )}
    </button>
  );
}
