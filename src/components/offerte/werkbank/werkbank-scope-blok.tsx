"use client";

/**
 * Eén scope in het werkblad: kopstrip, het bestaande scope-formulier, en
 * daaronder de regels die de engine er live van maakt.
 *
 * De kopstrip herhaalt de scopenaam bewust níét (die staat in de kaart van het
 * formulier zelf): hij draagt de lettertoets — dezelfde als in het palet — en
 * de twee dingen die je van buitenaf wilt kunnen: "is dit al compleet?" en
 * "haal maar weg".
 */

import { m } from "framer-motion";
import { X } from "lucide-react";
import { formatCurrency, formatDecimal } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { OfferteRegel } from "@/lib/offerte-calculator";
import {
  scopeVanId,
  type WerkbankScopeId,
  type WerkbankType,
} from "@/lib/werkbank";
import { WerkbankScopeFormulier } from "./werkbank-scope-formulier";

const REGEL_SOORT: Record<OfferteRegel["type"], string> = {
  materiaal: "Materiaal",
  arbeid: "Arbeid",
  machine: "Machine",
};

interface WerkbankScopeBlokProps {
  type: WerkbankType;
  scope: WerkbankScopeId;
  data: unknown;
  compleet: boolean;
  regels: OfferteRegel[];
  onChange: (data: unknown) => void;
  onValidationChange: (isValid: boolean, errors: Record<string, string>) => void;
  onVerwijder: () => void;
}

export function WerkbankScopeBlok({
  type,
  scope,
  data,
  compleet,
  regels,
  onChange,
  onValidationChange,
  onVerwijder,
}: WerkbankScopeBlokProps) {
  const definitie = scopeVanId(type, scope);
  const regeltotaal = regels.reduce((som, regel) => som + regel.totaal, 0);

  return (
    <m.article
      id={`werkbank-scope-${scope}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="scroll-mt-4"
    >
      {/* Kopstrip: letter, haarlijn, staat, weghalen. */}
      <div className="flex items-center gap-2.5 pb-2">
        <kbd
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded border border-primary/35 bg-primary/10 font-display text-[11px] leading-none font-semibold text-primary uppercase"
        >
          {definitie?.toets}
        </kbd>
        <span className="h-px min-w-4 flex-1 bg-border" />
        <span
          className={cn(
            "shrink-0 text-[11px] leading-4",
            compleet ? "text-muted-foreground" : "text-scope-houtwerk"
          )}
        >
          {compleet
            ? regels.length > 0
              ? `${regels.length} regel${regels.length === 1 ? "" : "s"} · ${formatCurrency(regeltotaal)}`
              : "Ingevuld"
            : "Nog gegevens nodig"}
        </span>
        <button
          type="button"
          onClick={onVerwijder}
          aria-label={`${definitie?.naam ?? scope} uit de offerte halen`}
          title={`${definitie?.naam ?? scope} uit de offerte halen`}
          className="-m-1 shrink-0 rounded p-1 text-muted-foreground/70 transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <WerkbankScopeFormulier
        type={type}
        scope={scope}
        data={data}
        onChange={onChange}
        onValidationChange={onValidationChange}
      />

      {regels.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-lg border border-border/70 bg-surface-primair/60">
          <p className="border-b border-border/70 px-3 py-1.5 text-[11px] leading-4 font-medium tracking-wide text-muted-foreground uppercase">
            Berekend uit normuren
          </p>
          <ul className="divide-y divide-border/60">
            {regels.map((regel, i) => (
              <li
                key={regel.id}
                style={{ animationDelay: `${Math.min(i, 6) * 35}ms` }}
                className="flex animate-in items-baseline gap-3 px-3 py-1.5 text-xs fade-in slide-in-from-bottom-1"
              >
                <span className="w-[4.5rem] shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
                  {REGEL_SOORT[regel.type]}
                </span>
                <span className="min-w-0 flex-1 truncate" title={regel.omschrijving}>
                  {regel.omschrijving}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatDecimal(regel.hoeveelheid)} {regel.eenheid}
                </span>
                <span className="w-[5.5rem] shrink-0 text-right font-medium tabular-nums">
                  {formatCurrency(regel.totaal)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </m.article>
  );
}
