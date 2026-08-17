"use client";

/**
 * Documentsecties in het klantdossier: offertes en facturen.
 *
 * Bewust géén <Table>: vijf kolommen in de smalle hoofdkolom leveren of een
 * horizontale scrollbalk op, of kolommen die zo krimpen dat het bedrag afbreekt.
 * Een regel met "titel boven, meta eronder, bedrag rechts" leest bij elke
 * breedte hetzelfde en kan niet uit zijn jasje groeien.
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { AlertTriangle, FileText, Receipt, Shovel, Trees } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format/currency";
import { cn } from "@/lib/utils";

function formatDatum(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Eén documentregel. `toon` is de statusnoot rechtsonder; alleen wat afwijkt
 * krijgt kleur, de rest blijft grijs — anders valt niets meer op.
 */
function DocumentRegel({
  href,
  titel,
  icoon,
  meta,
  bedrag,
  status,
  statusOpvallend = false,
}: {
  /** Ontbreekt als er geen detailpagina is; de regel is dan geen link. */
  href?: string;
  titel: string;
  icoon: ReactNode;
  meta: string;
  bedrag: number;
  status: string;
  statusOpvallend?: boolean;
}) {
  const regelClasses = cn(
    "grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-2.5 px-3 py-2",
    href &&
      "transition-colors duration-100 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
  );

  const inhoud = (
    <>
        <span className="mt-0.5 flex size-5 items-center justify-center text-muted-foreground [&>svg]:size-3.5">
          {icoon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm leading-snug font-medium">
            {titel}
          </span>
          <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
            {meta}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-sm leading-snug font-medium tabular-nums">
            {formatCurrency(bedrag)}
          </span>
          <span
            className={cn(
              "mt-0.5 flex items-center justify-end gap-1 text-[11px] leading-tight",
              statusOpvallend
                ? "font-medium text-destructive"
                : "text-muted-foreground"
            )}
          >
            {statusOpvallend && <AlertTriangle className="size-3 shrink-0" />}
            {status}
          </span>
        </span>
    </>
  );

  return (
    <li>
      {href ? (
        <Link href={href} className={regelClasses}>
          {inhoud}
        </Link>
      ) : (
        // Zonder project is er geen detailpagina; dan geen link die nergens
        // heen gaat, maar een gewone regel.
        <div className={regelClasses}>{inhoud}</div>
      )}
    </li>
  );
}

function LaadRegels() {
  return (
    <div className="space-y-2 px-3 py-2.5">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  );
}

// ─── Offertes ────────────────────────────────────────────────────────────────

const OFFERTE_STATUS: Record<string, string> = {
  concept: "Concept",
  voorcalculatie: "Voorcalculatie",
  verzonden: "Verzonden",
  geaccepteerd: "Geaccepteerd",
  afgewezen: "Afgewezen",
};

export type KlantOfferte = {
  _id: Id<"offertes">;
  offerteNummer: string;
  type: string;
  status: string;
  createdAt: number;
  totalen?: { totaalInclBtw?: number } | null;
};

export function KlantOffertesSectie({
  offertes,
  className,
}: {
  offertes: KlantOfferte[];
  /** Zodat de sectie zich in het dossierpaneel als rij kan gedragen. */
  className?: string;
}) {
  return (
    <SectiePaneel
      titel="Offertes"
      icoon={<FileText />}
      className={className}
      telling={offertes.length}
      // Naslag, en zonder offertes valt er niets na te slaan.
      gewicht={offertes.length === 0 ? "voetnoot" : "secundair"}
      kopbalk={offertes.length > 0}
      legeRegel={
        offertes.length === 0
          ? {
              tekst: "Nog geen offertes.",
              hint: "Start er één met Nieuwe offerte rechtsboven.",
            }
          : undefined
      }
      uitleg="Alle offertes voor deze klant, nieuwste eerst. Klik een regel om de offerte te openen."
    >
      {offertes.length === 0 ? null : (
        <ul className="divide-y">
          {offertes.map((offerte) => (
            <DocumentRegel
              key={offerte._id}
              href={`/offertes/${offerte._id}`}
              titel={offerte.offerteNummer}
              icoon={offerte.type === "aanleg" ? <Shovel /> : <Trees />}
              meta={`${offerte.type === "aanleg" ? "Aanleg" : "Onderhoud"} · ${formatDatum(offerte.createdAt)}`}
              bedrag={offerte.totalen?.totaalInclBtw ?? 0}
              status={OFFERTE_STATUS[offerte.status] ?? offerte.status}
            />
          ))}
        </ul>
      )}
    </SectiePaneel>
  );
}

// ─── Facturen ────────────────────────────────────────────────────────────────

const DOCUMENT_STATUS: Record<string, string> = {
  concept: "Concept",
  definitief: "Definitief",
  verzonden: "Verzonden",
};

const BETAAL_STATUS: Record<string, string> = {
  open: "Openstaand",
  gedeeltelijk_betaald: "Deels betaald",
  betaald: "Betaald",
  vervallen: "Vervallen",
};

/** De drie chips boven de lijst; `alle` is de beginstand. */
type FactuurFilter = "alle" | "open" | "betaald";

const FILTER_LABELS: { waarde: FactuurFilter; label: string }[] = [
  { waarde: "alle", label: "Alle" },
  { waarde: "open", label: "Niet betaald" },
  { waarde: "betaald", label: "Betaald" },
];

function FilterChip({
  label,
  actief,
  aantal,
  onClick,
}: {
  label: string;
  actief: boolean;
  aantal: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={actief}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs leading-4 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        actief
          ? "border-primary/40 bg-primary/10 font-medium text-foreground"
          : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {label}
      <span className="ml-1.5 tabular-nums opacity-70">{aantal}</span>
    </button>
  );
}

export function KlantFacturenSectie({
  klantId,
  className,
}: {
  klantId: Id<"klanten">;
  /** Zodat de sectie zich in het dossierpaneel als rij kan gedragen. */
  className?: string;
}) {
  const facturen = useQuery(api.facturen.listVoorKlant, { klantId });
  const [filter, setFilter] = useState<FactuurFilter>("alle");

  const alle = facturen ?? [];
  // "Openstaand" = verstuurd en nog niet betaald; een concept is nog geen
  // vordering. Zelfde definitie als `klanten.dossierTellingen`, zodat de pil
  // in het submenu en deze balk niet uit elkaar kunnen lopen.
  const isOpenstaand = (f: (typeof alle)[number]) =>
    f.betaalStatus !== "betaald" && f.documentStatus !== "concept";

  const openstaand = alle
    .filter(isOpenstaand)
    .reduce((som, f) => som + f.totaalInclBtw, 0);
  // Gefactureerd = alles wat de deur uit is; concepten tellen niet mee.
  const gefactureerd = alle
    .filter((f) => f.documentStatus !== "concept")
    .reduce((som, f) => som + f.totaalInclBtw, 0);

  const aantallen: Record<FactuurFilter, number> = {
    alle: alle.length,
    open: alle.filter(isOpenstaand).length,
    betaald: alle.filter((f) => f.betaalStatus === "betaald").length,
  };

  const zichtbaar =
    filter === "alle"
      ? alle
      : filter === "open"
        ? alle.filter(isOpenstaand)
        : alle.filter((f) => f.betaalStatus === "betaald");

  const isLeeg = facturen !== undefined && facturen.length === 0;

  return (
    <SectiePaneel
      titel="Facturen"
      icoon={<Receipt />}
      className={className}
      telling={facturen?.length ?? 0}
      gewicht={isLeeg ? "voetnoot" : "secundair"}
      kopbalk={!isLeeg}
      legeRegel={
        isLeeg
          ? {
              tekst: "Nog geen facturen.",
              // Facturen máák je hier niet: dat de eerste vanzelf verschijnt
              // na de nacalculatie moet deze regel dus zelf uitleggen.
              hint: "Die ontstaan vanuit een project na de nacalculatie.",
            }
          : undefined
      }
      uitleg="Facturen die aan deze klant gekoppeld zijn. Een factuur telt als te laat zodra hij verstuurd is, nog niet betaald en de vervaldatum voorbij is."
    >
      {facturen === undefined ? (
        <LaadRegels />
      ) : facturen.length === 0 ? null : (
        <>
          {/* Chips onder de kop en niet erín: drie chips naast een titel
              passen niet in de smalle dossierkolom, en zijwaarts scrollen
              doet deze app nooit. Op een eigen regel wikkelen ze netjes. */}
          <div
            role="radiogroup"
            aria-label="Facturen filteren"
            className="flex flex-wrap gap-1.5 border-b px-3 py-2"
          >
            {FILTER_LABELS.map(({ waarde, label }) => (
              <FilterChip
                key={waarde}
                label={label}
                aantal={aantallen[waarde]}
                actief={filter === waarde}
                onClick={() => setFilter(waarde)}
              />
            ))}
          </div>
          {zichtbaar.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {filter === "open"
                ? "Alles is betaald."
                : "Nog geen betaalde facturen."}
            </p>
          ) : (
            <FactuurLijst facturen={zichtbaar} />
          )}
          {/* Totaalbalk: wat er in totaal de deur uit ging, en wat daarvan nog
              binnen moet komen. Openstaand in oker — het vraagt aandacht,
              maar alleen een té late factuur is rood (zie de regels zelf). */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            <span>
              Totaal gefactureerd{" "}
              <b className="font-semibold tabular-nums text-foreground">
                {formatCurrency(gefactureerd)}
              </b>
            </span>
            <span>
              Openstaand{" "}
              <b className="font-semibold tabular-nums text-status-herinnering-text">
                {formatCurrency(openstaand)}
              </b>
            </span>
          </div>
        </>
      )}
    </SectiePaneel>
  );
}

type KlantFactuur = NonNullable<
  ReturnType<typeof useQuery<typeof api.facturen.listVoorKlant>>
>[number];

function FactuurLijst({ facturen }: { facturen: KlantFactuur[] }) {
  return (
        <ul className="divide-y">
          {facturen.map((factuur) => {
            const betaald = factuur.betaalStatus === "betaald";
            // Concept heeft nog geen betaalstatus die iets zegt; toon dan de
            // documentstatus, anders wat er met het geld gebeurt.
            const status = factuur.isTeLaat
              ? "Te laat"
              : factuur.documentStatus === "concept"
                ? (DOCUMENT_STATUS[factuur.documentStatus] ?? "Concept")
                : (BETAAL_STATUS[factuur.betaalStatus] ??
                  DOCUMENT_STATUS[factuur.documentStatus] ??
                  factuur.betaalStatus);

            return (
              <DocumentRegel
                key={factuur._id}
                href={
                  factuur.projectId
                    ? `/projecten/${factuur.projectId}/factuur`
                    : undefined
                }
                titel={factuur.factuurnummer}
                icoon={<Receipt />}
                meta={
                  betaald || factuur.documentStatus === "concept"
                    ? formatDatum(factuur.factuurdatum)
                    : `${formatDatum(factuur.factuurdatum)} · vervalt ${formatDatum(factuur.vervaldatum)}`
                }
                bedrag={factuur.totaalInclBtw}
                status={status}
                statusOpvallend={factuur.isTeLaat}
              />
            );
          })}
        </ul>
  );
}
