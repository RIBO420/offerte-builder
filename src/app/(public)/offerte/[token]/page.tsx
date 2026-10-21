"use client";

/**
 * Openbare offertepagina (HERO-nabouw fase 6). Klanten zonder portaal krijgen
 * deze link in de offertemail. Alleen lezen: de offerte zoals verstuurd, de
 * PDF en de algemene voorwaarden. Akkoord geven gaat per e-mail of via het
 * klantportaal. Data: convex/publiekeOfferte.ts (alleen klantzichtbare velden).
 */

import { use, useState } from "react";
import { useQuery } from "convex/react";
import { Download, FileText, Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format/currency";

export default function PubliekeOffertePagina({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const data = useQuery(api.publiekeOfferte.getByToken, { token });
  const [bezig, setBezig] = useState(false);

  if (data === undefined) {
    return (
      <main className="mx-auto flex max-w-3xl items-center justify-center p-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Laden" />
      </main>
    );
  }
  if (data === null) {
    return (
      <main className="mx-auto max-w-xl space-y-2 p-8 text-center">
        <h1 className="text-xl font-semibold">Deze offerte is niet (meer) beschikbaar</h1>
        <p className="text-sm text-muted-foreground">
          De link is verlopen of klopt niet. Neem contact op met uw hovenier voor een nieuwe link.
        </p>
      </main>
    );
  }

  const { offerte, teksten, bedrijfsgegevens, branding, voorwaardenPdf } = data;
  const bedrijf = bedrijfsgegevens?.naam ?? "Top Tuinen";
  const hoofdstukken = [...new Set(offerte.regels.filter((r) => !r.optioneel).map((r) => r.scope))];

  const downloadPdf = async () => {
    setBezig(true);
    try {
      const [{ pdf }, { OffertePDF }, { createPdfTheme }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/pdf/offerte-pdf"),
        import("@/components/pdf/pdf-theme"),
      ]);
      const theme = createPdfTheme(
        {
          logoUrl: branding.logoUrl,
          primaireKleur: branding.primaireKleur ?? "#16a34a",
          secundaireKleur: branding.secundaireKleur ?? "#1a1a1a",
          bedrijfsnaam: bedrijf,
          bedrijfsgegevens: {
            kvkNummer: bedrijfsgegevens?.kvk,
            btwNummer: bedrijfsgegevens?.btw,
            iban: bedrijfsgegevens?.iban,
            adres: bedrijfsgegevens
              ? `${bedrijfsgegevens.adres}, ${bedrijfsgegevens.postcode} ${bedrijfsgegevens.plaats}`
              : undefined,
            telefoon: bedrijfsgegevens?.telefoon,
            email: bedrijfsgegevens?.email,
          },
        },
        branding.stijl ?? "klassiek"
      );
      const blob = await pdf(
        <OffertePDF
          offerte={offerte}
          bedrijfsgegevens={bedrijfsgegevens ?? undefined}
          theme={theme}
          voorwaarden={data.voorwaarden ?? undefined}
          teksten={teksten}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Offerte ${offerte.offerteNummer}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBezig(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- extern opslag-URL, klein logo
            <img src={branding.logoUrl} alt={bedrijf} className="h-12 w-auto" />
          ) : (
            <p className="text-lg font-semibold">{bedrijf}</p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">Offerte {offerte.offerteNummer}</h1>
          {offerte.klant && (
            <p className="text-sm text-muted-foreground">
              Voor {offerte.klant.naam}, {offerte.klant.adres}, {offerte.klant.plaats}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void downloadPdf()} disabled={bezig}>
            {bezig ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Download PDF
          </Button>
          {voorwaardenPdf && (
            <Button asChild variant="outline">
              <a href={voorwaardenPdf.url} target="_blank" rel="noopener noreferrer">
                <FileText className="size-4" />
                Algemene voorwaarden
              </a>
            </Button>
          )}
        </div>
      </header>

      {teksten.inleiding && <p className="whitespace-pre-wrap text-sm leading-6">{teksten.inleiding}</p>}

      <section aria-label="Werkzaamheden" className="overflow-hidden rounded-lg border bg-card">
        {hoofdstukken.map((h) => (
          <div key={h} className="border-b last:border-b-0">
            <p className="bg-muted/50 px-4 py-2 text-sm font-semibold">{h}</p>
            <ul className="divide-y">
              {offerte.regels
                .filter((r) => r.scope === h && !r.optioneel)
                .map((r) => (
                  <li key={r.id} className="flex gap-3 px-4 py-2 text-sm">
                    <span className="min-w-0 flex-1">{r.omschrijving}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {r.hoeveelheid.toLocaleString("nl-NL")} {r.eenheid}
                    </span>
                    <span className="w-24 shrink-0 text-right tabular-nums">{formatCurrency(r.totaal)}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
        <dl className="space-y-1 border-t bg-muted/30 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <dt>Totaal excl. btw</dt>
            <dd className="tabular-nums">{formatCurrency(offerte.totalen.totaalExBtw)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Btw</dt>
            <dd className="tabular-nums">{formatCurrency(offerte.totalen.btw)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Totaal incl. btw</dt>
            <dd className="tabular-nums">{formatCurrency(offerte.totalen.totaalInclBtw)}</dd>
          </div>
        </dl>
      </section>

      {teksten.afsluiting && <p className="whitespace-pre-wrap text-sm leading-6">{teksten.afsluiting}</p>}

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        {bedrijf}
        {bedrijfsgegevens?.email ? ` · ${bedrijfsgegevens.email}` : ""}
        {bedrijfsgegevens?.telefoon ? ` · ${bedrijfsgegevens.telefoon}` : ""}
      </footer>
    </main>
  );
}
