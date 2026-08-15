"use client";

/**
 * Het urenblad: hoeveel tijd staat er op deze offerte, en waar zit die tijd.
 *
 * Bewust hetzelfde meubilair als het werkblad — dezelfde haarlijnen, dezelfde
 * `bg-surface-primair/60`-regelstrook, dezelfde kolomritmes. Dit ís immers
 * hetzelfde document, één stap verder: de uren die hier staan zijn letterlijk
 * de arbeidsregels van de offerte (zie `convex/lib/normuren.ts`). Er wordt hier
 * niets herrekend, dus er kan hier ook niets uiteenlopen.
 */

import { REVEAL_KLASSE } from "@/components/pagina-reveal";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUren, getScopeLabel } from "@/lib/voorcalculatie-calculator";

/**
 * Eén tint per scope, uit de scope-tokens. Alleen de scopes die een eigen
 * token hebben krijgen kleur; de rest leunt op de rand — een verzonnen kleur
 * is erger dan geen kleur.
 */
const SCOPE_STREEP: Record<string, string> = {
  grondwerk: "bg-scope-grondwerk",
  bestrating: "bg-scope-bestrating",
  parkeerplaats: "bg-scope-bestrating",
  borders: "bg-scope-borders",
  borders_onderhoud: "bg-scope-borders",
  gras: "bg-scope-gras",
  gras_onderhoud: "bg-scope-gras",
  heggen: "bg-scope-gras",
  bomen: "bg-scope-gras",
  houtwerk: "bg-scope-houtwerk",
  water_elektra: "bg-scope-water",
  beregening: "bg-scope-water",
  specials: "bg-scope-specials",
};

interface VoorcalculatieUrenbladProps {
  normUrenPerScope: Record<string, number>;
  normUrenTotaal: number;
  bereikbaarheidFactor?: number;
  achterstallijkheidFactor?: number;
}

export function VoorcalculatieUrenblad({
  normUrenPerScope,
  normUrenTotaal,
  bereikbaarheidFactor,
  achterstallijkheidFactor,
}: VoorcalculatieUrenbladProps) {
  const rijen = Object.entries(normUrenPerScope)
    .filter(([, uren]) => uren > 0)
    .sort(([, a], [, b]) => b - a);

  const grootste = rijen.length > 0 ? rijen[0][1] : 1;

  const factoren = [
    { label: "Bereikbaarheid", waarde: bereikbaarheidFactor },
    { label: "Achterstalligheid", waarde: achterstallijkheidFactor },
  ].filter((f) => typeof f.waarde === "number" && f.waarde !== 1);

  return (
    <section className="@container/urenblad overflow-hidden rounded-lg border bg-card">
      <header className="flex items-baseline gap-2 border-b bg-muted/40 px-3 py-2">
        <Clock aria-hidden className="size-3.5 shrink-0 self-center text-muted-foreground" />
        <h2 className="shrink-0 text-xs leading-4 font-medium tracking-wide text-muted-foreground uppercase">
          Uren op deze offerte
        </h2>
        <p className="ml-auto shrink-0 text-[11px] leading-4 text-muted-foreground">
          {rijen.length > 0
            ? `${rijen.length} werkzaamhe${rijen.length === 1 ? "id" : "den"}`
            : "Nog niets berekend"}
        </p>
      </header>

      {rijen.length > 0 ? (
        <ul className="divide-y divide-border/60">
          {rijen.map(([scope, uren]) => (
            <li
              key={scope}
              className={cn(
                "flex items-baseline gap-3 px-3 py-2",
                REVEAL_KLASSE
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1 h-3.5 w-0.5 shrink-0 self-start rounded-full",
                  SCOPE_STREEP[scope] ?? "bg-border"
                )}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] leading-5 font-medium">
                {getScopeLabel(scope)}
              </span>
              {/* Verhoudingsstreep: hoe zwaar weegt deze scope in het geheel?
                  Verdwijnt op smalle kolommen in plaats van te knellen. */}
              <span
                aria-hidden
                className="hidden h-1 w-24 shrink-0 self-center overflow-hidden rounded-full bg-muted @min-[26rem]/urenblad:block"
              >
                <span
                  className="block h-full rounded-full bg-primary/45"
                  style={{ width: `${Math.max(4, (uren / grootste) * 100)}%` }}
                />
              </span>
              <span className="w-[5.5rem] shrink-0 text-right text-[13px] leading-5 font-medium tabular-nums">
                {formatUren(uren)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            Nog geen arbeidsuren op deze offerte.
          </span>
          <span className="mt-0.5 block">
            Uren ontstaan in het werkblad, zodra een werkzaamheid maatvoering
            heeft. Vul die aan en ze staan hier.
          </span>
        </p>
      )}

      <div className="flex items-baseline gap-3 border-t bg-surface-primair/60 px-3 py-2">
        <span className="min-w-0 flex-1 text-xs leading-5 font-medium tracking-wide text-muted-foreground uppercase">
          Totaal
        </span>
        <span className="shrink-0 font-display text-base leading-5 font-semibold tabular-nums">
          {formatUren(normUrenTotaal)}
        </span>
      </div>

      <p className="border-t px-3 py-2 text-[11px] leading-4 text-muted-foreground">
        Dit zijn de arbeidsregels van de offerte zelf — hetzelfde aantal uren
        dat het werkblad toont.
        {factoren.length > 0 && (
          <>
            {" "}
            {factoren
              .map((f) => `${f.label} ×${f.waarde!.toFixed(2).replace(".", ",")}`)
              .join(" en ")}{" "}
            {factoren.length === 1 ? "is" : "zijn"} er al in verwerkt.
          </>
        )}
      </p>
    </section>
  );
}
