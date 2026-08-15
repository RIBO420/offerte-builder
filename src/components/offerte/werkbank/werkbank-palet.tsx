"use client";

/**
 * Het scope-palet: de gereedschapsrail naast het werkblad.
 *
 * Eén klik (of één letter) zet een scope in het document; nog een klik haalt
 * hem er weer uit. Daaronder telt het totaal live mee — dat blok nam de rol
 * over van de oude stap "Bevestigen".
 *
 * Smal scherm: het palet zakt niet weg maar klimt naar bóven het document en
 * de rijen leggen zich in twee of drie kolommen. Niets wordt geamputeerd en er
 * wordt nooit zijwaarts gescrold.
 */

import { m } from "framer-motion";
import { Check, Loader2, Lock, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import {
  RENOVATIE_COMBI,
  scopesVoorType,
  type WerkbankScopeId,
  type WerkbankType,
} from "@/lib/werkbank";

interface WerkbankPaletProps {
  type: WerkbankType;
  scopes: WerkbankScopeId[];
  onvolledig: WerkbankScopeId[];
  onWissel: (scope: WerkbankScopeId) => void;
  onRenovatie: () => void;
  totalen: {
    subtotaal: number;
    marge: number;
    btw: number;
    totaalInclBtw: number;
    totaalUren: number;
  };
  aantalRegels: number;
  calculatieLaadt: boolean;
  klantCompleet: boolean;
  heeftRegels: boolean;
  kanDefinitief: boolean;
  afronden: boolean;
  onDefinitief: () => void;
  onBekijk: () => void;
}

export function WerkbankPalet({
  type,
  scopes,
  onvolledig,
  onWissel,
  onRenovatie,
  totalen,
  aantalRegels,
  calculatieLaadt,
  klantCompleet,
  heeftRegels,
  kanDefinitief,
  afronden,
  onDefinitief,
  onBekijk,
}: WerkbankPaletProps) {
  const lijst = scopesVoorType(type);

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-lg border bg-card">
        <header className="flex items-baseline gap-2 border-b bg-muted/40 px-3 py-2">
          <h2 className="text-xs leading-4 font-medium tracking-wide text-muted-foreground uppercase">
            Palet
          </h2>
          <p className="ml-auto text-[11px] leading-4 text-muted-foreground">
            Toets de letter
          </p>
        </header>

        <div className="grid gap-0.5 p-1.5 @min-[30rem]/werkbank:grid-cols-2 @min-[48rem]/werkbank:grid-cols-3 @min-[68rem]/werkbank:grid-cols-1">
          {lijst.map((scope) => {
            const actief = scopes.includes(scope.id);
            const mist = actief && onvolledig.includes(scope.id);
            return (
              <button
                key={scope.id}
                type="button"
                onClick={() => onWissel(scope.id)}
                aria-pressed={actief}
                className={cn(
                  "group flex items-start gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  actief
                    ? "border-primary/35 bg-primary/10"
                    : "border-transparent hover:border-border hover:bg-muted/60"
                )}
              >
                <kbd
                  aria-hidden
                  className={cn(
                    "mt-px flex size-5 shrink-0 items-center justify-center rounded border font-display text-[11px] leading-none font-semibold uppercase transition-colors",
                    actief
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {scope.toets}
                </kbd>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] leading-4 font-medium">
                      {scope.naam}
                    </span>
                    {mist && (
                      <span
                        title="Nog gegevens nodig"
                        className="size-1.5 shrink-0 rounded-full bg-scope-houtwerk"
                      />
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground">
                    {scope.beschrijving}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="mt-0.5 shrink-0 text-muted-foreground/60"
                >
                  {actief ? (
                    <Check className="size-3.5 text-primary" />
                  ) : (
                    <Plus className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {type === "aanleg" && (
          <div className="border-t p-1.5">
            <button
              type="button"
              onClick={onRenovatie}
              className="group flex w-full items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <kbd
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center rounded border border-border bg-background font-display text-[11px] leading-none font-semibold uppercase text-muted-foreground group-hover:text-foreground"
              >
                {RENOVATIE_COMBI.toets}
              </kbd>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13px] leading-4 font-medium">
                  <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                  {RENOVATIE_COMBI.naam}
                </span>
                <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground">
                  {RENOVATIE_COMBI.beschrijving}
                </span>
              </span>
            </button>
          </div>
        )}
      </section>

      {/* Levende samenvatting — dit blok verving de stap "Bevestigen". */}
      <section className="rounded-lg border bg-surface-primair shadow-xs">
        <div className="space-y-1.5 px-3 pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs leading-4 font-medium tracking-wide text-muted-foreground uppercase">
              Totaal
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {calculatieLaadt ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <>
                  {aantalRegels} regel{aantalRegels === 1 ? "" : "s"}
                  {totalen.totaalUren > 0 && ` · ${totalen.totaalUren} uur`}
                </>
              )}
            </span>
          </div>

          <m.p
            key={totalen.totaalInclBtw}
            initial={{ opacity: 0.35 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-[28px] leading-none font-semibold tracking-tight tabular-nums"
          >
            {formatCurrency(totalen.totaalInclBtw)}
          </m.p>

          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 pt-1 text-[11px] leading-5 text-muted-foreground">
            <dt>Subtotaal</dt>
            <dd className="text-right tabular-nums">
              {formatCurrency(totalen.subtotaal)}
            </dd>
            <dt>Marge</dt>
            <dd className="text-right tabular-nums">
              {formatCurrency(totalen.marge)}
            </dd>
            <dt>Btw</dt>
            <dd className="text-right tabular-nums">
              {formatCurrency(totalen.btw)}
            </dd>
          </dl>
        </div>

        <div className="mt-3 space-y-2 border-t border-border/70 p-3">
          {/* Bewust niet uitgeschakeld bij een ontbrekende klant: de harde
              guard zit in Convex, en die melding benoemt precies welk veld
              ontbreekt. Een grijze knop zou dat verzwijgen. Zonder regels valt
              er niets vast te leggen — dáár klopt uitschakelen wel. */}
          <Button
            className="w-full"
            disabled={!heeftRegels || afronden}
            onClick={onDefinitief}
          >
            {afronden ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Offerte definitief maken
          </Button>

          {/* Stille staat i.p.v. een rood alarm: de knop legt zelf uit
              waaróm hij nog niet kan. */}
          <p className="flex items-start gap-1.5 text-[11px] leading-4 text-muted-foreground">
            {!klantCompleet ? (
              <>
                <Lock className="mt-px size-3 shrink-0" />
                Een klant is verplicht vóór versturen — het concept mag zonder.
              </>
            ) : !kanDefinitief ? (
              <>
                <Lock className="mt-px size-3 shrink-0" />
                Vul minstens één werkzaamheid in, dan staan er regels op de
                offerte.
              </>
            ) : (
              <>Concept gaat naar voorcalculatie en verlaat de conceptfase.</>
            )}
          </p>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={onBekijk}
          >
            Bekijk de offerte
          </Button>
        </div>
      </section>
    </div>
  );
}
