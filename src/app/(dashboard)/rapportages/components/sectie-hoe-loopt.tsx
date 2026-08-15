"use client";

/**
 * Sectie 1 — "Hoe loopt deze periode?"
 *
 * Eén heldcijfer (getekende omzet ex btw), één bewijsgrafiek (de maandreeks) en
 * twee echte vergelijkingen: de vorige periode en dezelfde periode vorig jaar.
 *
 * De vergelijkingen komen uit `hoeLoopt.verschil` en zijn `null` zodra er geen
 * basis is. Dat gebeurt nú voortdurend — de demodata begint in 2026, dus "vorig
 * jaar" ís leeg. De UI zegt dat met zoveel woorden in plaats van er "+100%" van
 * te maken; dat was precies de leugen die de schouw aantrof.
 */

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/format/currency";
import {
  formatPercentage,
  telwoord,
  verschilTekst,
  type VerschilToon,
} from "@/lib/rapportage-labels";
import { cn } from "@/lib/utils";
import {
  DynamicLangeTrendChart,
  DynamicMaandStavenChart,
} from "@/components/analytics/dynamic";
import { BEWIJS_HOOGTE } from "@/components/analytics/maten";
import {
  Antwoordzin,
  Bewijs,
  Doorklik,
  Heldcijfer,
  LegeSectie,
  Nadruk,
} from "./antwoord-blok";
import type { HoeLoopt, Periode } from "./types";

/** Vanaf hier is een reeks te lang voor staven en wordt het een lijn (R3). */
const STAVEN_GRENS = 14;

function VerschilRegel({
  label,
  verschil,
  basisLabel,
}: {
  label: string;
  verschil: number | null;
  basisLabel?: string;
}) {
  const { toon, tekst } = verschilTekst(verschil);
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="min-w-0 text-sm text-muted-foreground">
        {label}{" "}
        {basisLabel && <span className="text-foreground/70">{basisLabel}</span>}
      </dt>
      <dd
        className={cn(
          "flex shrink-0 items-center gap-1 text-sm",
          toon === "geen-basis"
            ? "text-muted-foreground"
            : "font-medium text-foreground"
        )}
      >
        <ToonIcoon toon={toon} />
        {tekst}
      </dd>
    </div>
  );
}

function ToonIcoon({ toon }: { toon: VerschilToon }) {
  if (toon === "vooruit") {
    return <ArrowUpRight className="size-3.5 text-primary" aria-hidden />;
  }
  if (toon === "achteruit") {
    return (
      <ArrowDownRight
        className="size-3.5 text-[var(--chart-2)]"
        aria-hidden
      />
    );
  }
  if (toon === "gelijk") {
    return <Minus className="size-3.5 text-muted-foreground" aria-hidden />;
  }
  return null;
}

export function SectieHoeLoopt({
  hoeLoopt,
  periode,
}: {
  hoeLoopt: HoeLoopt;
  periode: Periode;
}) {
  const { huidig, verschil, maandReeks } = hoeLoopt;
  const euro = (bedrag: number) => formatCurrency(bedrag, "nl-NL", false);

  if (huidig.aantalGetekend === 0 && huidig.aantalFacturen === 0) {
    return (
      <LegeSectie
        tekst={`In ${periode.label} is er nog niets getekend of gefactureerd.`}
        hint="Zodra een offerte op ‘geaccepteerd’ staat of een factuur verstuurd is, verschijnt hier de omzet van deze periode — met de vergelijking t.o.v. de vorige periode en vorig jaar."
        actie={
          <Doorklik href="/offertes">Bekijk alle offertes</Doorklik>
        }
      />
    );
  }

  const lopendeMaandKey = periode.isLopend
    ? maandReeks[maandReeks.length - 1]?.maandKey
    : undefined;

  const vorigeTekst = verschilTekst(verschil.getekendeOmzetVsVorigePeriode);
  // Voor een jaarperiode vallen beide vergelijkingen samen: de vorige periode
  // ís hetzelfde jaar als "vorig jaar".
  const zelfdeVergelijking =
    periode.vorigePeriode?.label === periode.zelfdePeriodeVorigJaar?.label;

  return (
    <div className="grid gap-x-12 gap-y-9 @min-[54rem]/blok:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div>
        <Antwoordzin className="mb-7">
          Je tekende{" "}
          <Nadruk>
            {telwoord(huidig.aantalGetekend, "opdracht", "opdrachten")}
          </Nadruk>{" "}
          voor <Nadruk>{euro(huidig.getekendeOmzetExclBtw)}</Nadruk> excl. btw
          {periode.vorigePeriode && vorigeTekst.toon !== "geen-basis" && (
            <>
              {" "}
              — <Nadruk>{vorigeTekst.tekst}</Nadruk> dan in{" "}
              {periode.vorigePeriode.label.toLowerCase()}
            </>
          )}
          .
          {periode.isLopend && (
            <>
              {" "}
              {periode.label} is nu{" "}
              <Nadruk>
                {formatPercentage(periode.voortgangFractie * 100, 0)}
              </Nadruk>{" "}
              voorbij, dus de vergelijking loopt nog achter.
            </>
          )}
        </Antwoordzin>

        <Heldcijfer
          label="Getekend werk, excl. btw"
          waarde={euro(huidig.getekendeOmzetExclBtw)}
          onder={
            <>
              {euro(huidig.getekendeOmzetInclBtw)} incl. btw
              {huidig.aantalGetekend > 0 && (
                <> · gemiddeld {euro(huidig.gemiddeldeOpdrachtwaarde)} per opdracht</>
              )}
            </>
          }
        />

        <dl className="mt-7 divide-y divide-border/70 border-y border-border/70">
          <VerschilRegel
            label="Vergeleken met"
            basisLabel={periode.vorigePeriode?.label ?? "de vorige periode"}
            verschil={verschil.getekendeOmzetVsVorigePeriode}
          />
          {/* Bij een jaarperiode zijn "de vorige periode" en "dezelfde periode
              vorig jaar" hetzelfde jaar. Twee identieke regels naast elkaar
              leest als een fout; dan volstaat er één. */}
          {!zelfdeVergelijking && (
            <VerschilRegel
              label="Vergeleken met"
              basisLabel={
                periode.zelfdePeriodeVorigJaar?.label ?? "vorig jaar"
              }
              verschil={verschil.getekendeOmzetVsVorigJaar}
            />
          )}
        </dl>

        <dl className="mt-7 grid gap-x-8 gap-y-4 @min-[26rem]/blok:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Gefactureerd
            </dt>
            <dd className="mt-1 font-display text-xl font-semibold tabular-nums">
              {euro(huidig.gefactureerdInclBtw)}
            </dd>
            <dd className="text-sm text-muted-foreground">
              {telwoord(huidig.aantalFacturen, "factuur", "facturen")} ·{" "}
              {euro(huidig.ontvangen)} ontvangen
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Marge op getekend werk
            </dt>
            <dd className="mt-1 font-display text-xl font-semibold tabular-nums">
              {euro(huidig.getekendeMarge)}
            </dd>
            <dd className="text-sm text-muted-foreground">
              {formatPercentage(huidig.getekendeMargePercentage)} van de omzet
            </dd>
          </div>
        </dl>

        <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
          <Doorklik href="/offertes?status=geaccepteerd">
            {huidig.aantalGetekend === 1
              ? "Bekijk de getekende offerte"
              : `Bekijk de ${huidig.aantalGetekend} getekende offertes`}
          </Doorklik>
          {huidig.aantalFacturen > 0 && (
            <Doorklik href="/facturen">Bekijk de facturen</Doorklik>
          )}
        </div>
      </div>

      <Bewijs
        titel="Getekend werk per maand"
        toelichting={
          periode.isLopend ? "de lichte staaf loopt nog" : undefined
        }
      >
        {maandReeks.length === 0 ? (
          <p
            className="flex items-center text-sm text-muted-foreground"
            style={{ height: BEWIJS_HOOGTE }}
          >
            Deze periode beslaat nog geen volle maand.
          </p>
        ) : maandReeks.length > STAVEN_GRENS ? (
          <DynamicLangeTrendChart
            data={maandReeks}
            toonGefactureerd
            hoogte={BEWIJS_HOOGTE}
          />
        ) : (
          <DynamicMaandStavenChart
            data={maandReeks}
            lopendeMaandKey={lopendeMaandKey}
            hoogte={BEWIJS_HOOGTE}
          />
        )}
      </Bewijs>
    </div>
  );
}
