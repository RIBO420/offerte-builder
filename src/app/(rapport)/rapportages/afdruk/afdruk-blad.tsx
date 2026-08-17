"use client";

/**
 * R7 — het maandrapport als opgemaakt document.
 *
 * Dezelfde vier vragen als op /rapportages, maar dan als leesbaar blad dat je
 * naar de boekhouder stuurt: Outfit-koppen, groot cijferwerk, tabellen met
 * periodes naast elkaar, geen enkel interactie-element.
 *
 * Bewust géén recharts. Een afdruk heeft geen tooltips en geen hover, en een
 * accountant leest liever twaalf regels met bedragen dan twaalf staafjes.
 * Precies de les van Moneybird: tabellen naast elkaar, en niemand mist de
 * grafiek. De horizontale staaf blijft wél — die is pure CSS en drukt af zoals
 * hij op het scherm staat.
 */

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { formatCurrency } from "@/lib/format/currency";
import {
  formatPercentage,
  isPeriodePreset,
  ouderdomLabel,
  scopeLabel,
  telwoord,
  urenTekst,
  verschilTekst,
  type PeriodePreset,
} from "@/lib/rapportage-labels";
import { RangStaven, type StaafRegel } from "@/components/analytics/staafwerk";
import { cn } from "@/lib/utils";

const BUCKETS = [
  "ouder_dan_60_dagen",
  "31_60_dagen",
  "1_30_dagen",
  "nog_niet_vervallen",
] as const;

const euro = (bedrag: number) => formatCurrency(bedrag, "nl-NL", false);

export function AfdrukBlad({
  periode,
  van,
  tot,
  direct,
}: {
  periode: string | null;
  van?: number;
  tot?: number;
  direct: boolean;
}) {
  const preset: PeriodePreset = isPeriodePreset(periode) ? periode : "dit-jaar";
  const data = useQuery(api.rapportage.getRapportage, {
    preset,
    startDate: van,
    endDate: tot,
  });

  // Alleen automatisch afdrukken als de knop erom vroeg (`?direct=1`). Wie de
  // URL zelf opent krijgt eerst het blad te zien.
  useEffect(() => {
    if (!direct || data === undefined) return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [direct, data]);

  if (data === undefined) {
    return (
      <p className="p-10 text-sm text-muted-foreground" aria-busy="true">
        Maandrapport wordt opgebouwd…
      </p>
    );
  }

  const { periode: p, hoeLoopt, pipeline, geldLigt, besteWerk, meta } = data;
  const h = hoeLoopt.huidig;
  const gegenereerd = new Date(meta.gegenereerdOp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const scopeRegels: StaafRegel[] = besteWerk.scopeMarges
    .filter((rij) => rij.omzetExclBtw > 0)
    .slice(0, 8)
    .map((rij) => ({
      sleutel: rij.scope,
      label: scopeLabel(rij.scope),
      waarde: rij.omzetExclBtw,
      waardeTekst: euro(rij.omzetExclBtw),
      bijschrift: `${formatPercentage(rij.margePercentage)} marge`,
    }));

  return (
    <article className="mx-auto max-w-[46rem] px-6 py-10 print:max-w-none print:px-0 print:py-0">
      <AfdrukStijl />

      <div className="mb-8 flex items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-muted-foreground">
          Klaar om af te drukken of als pdf op te slaan.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Afdrukken
        </button>
      </div>

      <header className="border-b-2 border-foreground/80 pb-4">
        <p className="text-[11px] font-medium tracking-[0.16em] uppercase">
          Top Tuinen · Rapportage
        </p>
        <h1 className="mt-2 font-display text-[42px] leading-none font-semibold tracking-tight">
          {p.label}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Opgemaakt op {gegenereerd}
          {p.isLopend && " · deze periode loopt nog"}
        </p>
      </header>

      {/* ── 1. Hoe loopt deze periode? ─────────────────────────────────── */}
      <Blad vraag="Hoe loopt deze periode?" reikwijdte={p.label}>
        <Cijferpaar
          hoofd={{
            label: "Getekend werk, excl. btw",
            waarde: euro(h.getekendeOmzetExclBtw),
          }}
          neven={[
            { label: "Incl. btw", waarde: euro(h.getekendeOmzetInclBtw) },
            {
              label: "Getekende opdrachten",
              waarde: String(h.aantalGetekend),
            },
            { label: "Gefactureerd", waarde: euro(h.gefactureerdInclBtw) },
            { label: "Daarvan ontvangen", waarde: euro(h.ontvangen) },
            {
              label: "Marge",
              waarde: `${euro(h.getekendeMarge)} (${formatPercentage(
                h.getekendeMargePercentage
              )})`,
            },
          ]}
        />

        <Tabel
          kop={["Vergelijking", "Getekend werk", "Verschil"]}
          rijen={[
            [
              p.label,
              euro(h.getekendeOmzetExclBtw),
              "—",
            ],
            [
              p.vorigePeriode?.label ?? "Vorige periode",
              hoeLoopt.vorigePeriode
                ? euro(hoeLoopt.vorigePeriode.getekendeOmzetExclBtw)
                : "geen gegevens",
              verschilTekst(hoeLoopt.verschil.getekendeOmzetVsVorigePeriode)
                .tekst,
            ],
            [
              p.zelfdePeriodeVorigJaar?.label ?? "Vorig jaar",
              hoeLoopt.zelfdePeriodeVorigJaar
                ? euro(
                    hoeLoopt.zelfdePeriodeVorigJaar.getekendeOmzetExclBtw
                  )
                : "geen gegevens",
              verschilTekst(hoeLoopt.verschil.getekendeOmzetVsVorigJaar).tekst,
            ],
          ]}
        />

        {hoeLoopt.maandReeks.length > 0 && (
          <Tabel
            titel="Per maand"
            kop={["Maand", "Getekend (excl. btw)", "Gefactureerd (incl. btw)"]}
            rijen={hoeLoopt.maandReeks.map((maand) => [
              maand.label,
              euro(maand.getekendeOmzetExclBtw),
              euro(maand.gefactureerdInclBtw),
            ])}
          />
        )}
      </Blad>

      {/* ── 2. Pipeline ────────────────────────────────────────────────── */}
      <Blad
        vraag="Wat zit er in de pipeline?"
        reikwijdte="Open werk op het moment van opmaken"
      >
        <Cijferpaar
          hoofd={{
            label: "Open werk, incl. btw",
            waarde: euro(pipeline.openWaardeInclBtw),
          }}
          neven={[
            {
              label: "Open offertes",
              waarde: String(pipeline.openStatussen.pipelineTotaal),
            },
            {
              label: "In voorcalculatie",
              waarde: String(pipeline.openStatussen.voorcalculatie),
            },
            {
              label: "Bij de klant",
              waarde: String(pipeline.openStatussen.verzonden),
            },
            {
              label: `Langer dan ${pipeline.drempelDagen} dagen stil`,
              waarde: String(pipeline.aantalBlijftLiggen),
            },
          ]}
        />

        <Tabel
          titel="Van voorcalculatie tot handtekening"
          kop={["Stap", "Aantal", "Conversie"]}
          rijen={[
            [
              "Voorcalculatie gemaakt",
              String(pipeline.funnel.voorcalculatie),
              "—",
            ],
            [
              "Naar de klant verstuurd",
              String(pipeline.funnel.verzonden),
              formatPercentage(pipeline.conversie.voorcalculatieToVerzonden, 0),
            ],
            [
              "Beantwoord door de klant",
              String(pipeline.funnel.afgehandeld),
              formatPercentage(pipeline.conversie.verzondenToAfgehandeld, 0),
            ],
            [
              "Getekend",
              String(pipeline.funnel.geaccepteerd),
              formatPercentage(pipeline.conversie.afgehandeldToWon, 0),
            ],
          ]}
        />
      </Blad>

      {/* ── 3. Waar blijft geld liggen? ────────────────────────────────── */}
      <Blad
        vraag="Waar blijft geld liggen?"
        reikwijdte="Openstaand geld nu · calculatie over de periode"
      >
        <Cijferpaar
          hoofd={{
            label: "Openstaand, incl. btw",
            waarde: euro(geldLigt.openstaand.totaalOpenstaand),
          }}
          neven={[
            {
              label: "Gemiddeld te laat",
              waarde: `${geldLigt.openstaand.gemiddeldeOuderdomDagen.toLocaleString(
                "nl-NL"
              )} dagen`,
            },
            {
              label: "Nagecalculeerde projecten",
              waarde: String(geldLigt.voorNacalculatie.aantalProjecten),
            },
            {
              label:
                geldLigt.voorNacalculatie.afwijkingUren > 0
                  ? "Niet begroot, wel gewerkt"
                  : "Onder de begroting",
              waarde: euro(
                Math.abs(geldLigt.voorNacalculatie.afwijkingEuro)
              ),
            },
          ]}
        />

        <Tabel
          titel="Openstaand geld naar ouderdom"
          kop={["Ouderdom", "Facturen", "Bedrag"]}
          rijen={BUCKETS.map((bucket) => [
            ouderdomLabel(bucket),
            String(geldLigt.openstaand.perBucket[bucket]?.aantal ?? 0),
            euro(geldLigt.openstaand.perBucket[bucket]?.bedrag ?? 0),
          ])}
        />

        {geldLigt.voorNacalculatie.aantalProjecten > 0 ? (
          <Tabel
            titel="Begroot tegenover werkelijk"
            kop={["Onderdeel", "Begroot", "Werkelijk", "Verschil"]}
            rijen={geldLigt.voorNacalculatie.scopes
              .slice(0, 8)
              .map((rij) => [
                scopeLabel(rij.scope),
                urenTekst(rij.geplandeUren),
                urenTekst(rij.werkelijkeUren),
                `${rij.afwijkingEuro > 0 ? "+" : ""}${euro(rij.afwijkingEuro)}`,
              ])}
          />
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">
            In {p.label} is nog geen project nagecalculeerd.
          </p>
        )}

        {geldLigt.voorNacalculatie.projectenZonderNacalculatie > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Let op: dit beeld is onvolledig —{" "}
            {telwoord(
              geldLigt.voorNacalculatie.projectenZonderNacalculatie,
              "afgerond project heeft",
              "afgeronde projecten hebben"
            )}{" "}
            nog geen nacalculatie.
          </p>
        )}
      </Blad>

      {/* ── 4. Beste werk ──────────────────────────────────────────────── */}
      <Blad vraag="Wat is mijn beste werk?" reikwijdte={p.label}>
        {scopeRegels.length > 0 ? (
          <>
            <div className="mt-1 mb-6">
              <RangStaven regels={scopeRegels} />
            </div>
            <Tabel
              titel="Grootste klanten"
              kop={["Klant", "Opdrachten", "Getekend (excl. btw)", "Marge"]}
              rijen={besteWerk.topKlanten
                .filter((klant) => klant.getekendeOmzetExclBtw > 0)
                .slice(0, 8)
                .map((klant) => [
                  klant.klantNaam,
                  String(klant.aantalGetekend),
                  euro(klant.getekendeOmzetExclBtw),
                  formatPercentage(klant.margePercentage),
                ])}
            />
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            In {p.label} is nog geen werk getekend.
          </p>
        )}
      </Blad>

      <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
        Getekende omzet = offertes met status ‘geaccepteerd’, geteld op het
        moment van tekenen. Gefactureerd = facturen waarvan het document
        verstuurd is, geteld op factuurdatum. Archief en prullenbak tellen
        nergens mee.
      </footer>
    </article>
  );
}

function Blad({
  vraag,
  reikwijdte,
  children,
}: {
  vraag: string;
  reikwijdte: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 break-inside-avoid border-t pt-6 first-of-type:border-t-0">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {reikwijdte}
      </p>
      <h2 className="mt-1 font-display text-[26px] leading-tight font-semibold tracking-tight">
        {vraag}
      </h2>
      {children}
    </section>
  );
}

function Cijferpaar({
  hoofd,
  neven,
}: {
  hoofd: { label: string; waarde: string };
  neven: Array<{ label: string; waarde: string }>;
}) {
  return (
    <div className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {hoofd.label}
        </p>
        <p className="mt-1 font-display text-[40px] leading-none font-semibold tracking-tight tabular-nums">
          {hoofd.waarde}
        </p>
      </div>
      <dl className="grid gap-y-1.5 self-end">
        {neven.map((neef) => (
          <div
            key={neef.label}
            className="flex items-baseline justify-between gap-4 text-sm"
          >
            <dt className="text-muted-foreground">{neef.label}</dt>
            <dd className="font-medium tabular-nums">{neef.waarde}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Tabel({
  titel,
  kop,
  rijen,
}: {
  titel?: string;
  kop: string[];
  rijen: string[][];
}) {
  return (
    <div className="mt-6 break-inside-avoid">
      {titel && (
        <h3 className="mb-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {titel}
        </h3>
      )}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            {kop.map((cel, i) => (
              <th
                key={cel}
                className={cn(
                  "py-1.5 text-left font-medium text-muted-foreground",
                  i > 0 && "text-right"
                )}
              >
                {cel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rijen.map((rij, index) => (
            <tr key={index} className="border-b border-border/60">
              {rij.map((cel, i) => (
                <td
                  key={i}
                  className={cn(
                    "py-1.5",
                    i === 0
                      ? "pr-4"
                      : "text-right tabular-nums whitespace-nowrap"
                  )}
                >
                  {cel}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Afdrukregels. Op papier bestaat geen donker thema en geen schermbreedte:
 * forceer wit papier met zwarte tekst, houd secties bij elkaar en zet marges
 * in millimeters in plaats van in pixels.
 */
function AfdrukStijl() {
  return (
    <style>{`
      @media print {
        @page { size: A4; margin: 16mm 14mm; }
        html, body {
          background: #fff !important;
          color: #111 !important;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        h1, h2, h3 { break-after: avoid; }
        table { break-inside: auto; }
        tr { break-inside: avoid; }
      }
    `}</style>
  );
}
