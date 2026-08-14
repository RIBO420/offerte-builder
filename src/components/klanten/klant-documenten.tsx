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
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { AlertTriangle, FileText, Receipt, Shovel, Trees } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { SectieLegeStaat, SectiePaneel } from "@/components/ui/sectie-paneel";
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
}: {
  offertes: KlantOfferte[];
}) {
  return (
    <SectiePaneel
      titel="Offertes"
      icoon={<FileText />}
      telling={offertes.length}
      uitleg="Alle offertes voor deze klant, nieuwste eerst. Klik een regel om de offerte te openen."
    >
      {offertes.length === 0 ? (
        <SectieLegeStaat tekst="Nog geen offertes." />
      ) : (
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

export function KlantFacturenSectie({ klantId }: { klantId: Id<"klanten"> }) {
  const facturen = useQuery(api.facturen.listVoorKlant, { klantId });

  const openstaand = (facturen ?? [])
    .filter((f) => f.betaalStatus !== "betaald" && f.documentStatus !== "concept")
    .reduce((som, f) => som + f.totaalInclBtw, 0);

  return (
    <SectiePaneel
      titel="Facturen"
      icoon={<Receipt />}
      telling={facturen?.length ?? 0}
      uitleg="Facturen die aan deze klant gekoppeld zijn. Een factuur telt als te laat zodra hij verstuurd is, nog niet betaald en de vervaldatum voorbij is."
      acties={
        openstaand > 0 ? (
          <span className="truncate text-[11px] tabular-nums text-muted-foreground">
            {formatCurrency(openstaand)} open
          </span>
        ) : undefined
      }
    >
      {facturen === undefined ? (
        <LaadRegels />
      ) : facturen.length === 0 ? (
        <SectieLegeStaat tekst="Nog geen facturen." />
      ) : (
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
      )}
    </SectiePaneel>
  );
}
