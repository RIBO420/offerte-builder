"use client";

import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/format/currency";
import { formatDate } from "./types";
import { FACTUUR_STAPPEN } from "./factuur-stappen";

const DL = "grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]";

/** Vóór genereren: wat er uit de offerte op de factuur komt. */
export function UitDeOfferte({
  klantNaam,
  email,
  totaal,
}: {
  klantNaam: string;
  email?: string;
  totaal: number;
}) {
  return (
    <SectiePaneel titel="Uit de offerte" kopbalk>
      <div className="flex flex-col gap-3 p-4">
        <dl className={DL}>
          <dt className="text-muted-foreground">Klant</dt>
          <dd className="min-w-0 truncate">{klantNaam}</dd>
          {email && (
            <>
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="min-w-0 truncate" title={email}>
                {email}
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Totaal</dt>
          <dd className="font-semibold tabular-nums">{formatCurrency(totaal)}</dd>
        </dl>
        <p className="text-xs text-muted-foreground">
          De factuur volgt de getekende offerte. Na genereren bekijk je de PDF en maak je hem definitief; regels aanpassen kan dan niet meer.
        </p>
      </div>
    </SectiePaneel>
  );
}

/** Na genereren: status en data van de factuur. */
export function FactuurInfo({
  status,
  nummer,
  factuurdatum,
  vervaldatum,
  betalingstermijnDagen,
  verzondenAt,
  betaaldAt,
  email,
}: {
  status: string;
  nummer: string;
  factuurdatum: number;
  vervaldatum: number;
  betalingstermijnDagen: number;
  verzondenAt?: number;
  betaaldAt?: number;
  email?: string;
}) {
  return (
    <SectiePaneel
      titel="Factuur"
      kopbalk
      acties={<StatusBadge status={status} domain="factuur" size="sm" showIcon={false} />}
    >
      <dl className={`${DL} p-4`}>
        <dt className="text-muted-foreground">Nummer</dt>
        <dd className="font-mono text-[13px]">{nummer}</dd>
        <dt className="text-muted-foreground">Datum</dt>
        <dd className="tabular-nums">{formatDate(factuurdatum)}</dd>
        <dt className="text-muted-foreground">Vervalt</dt>
        <dd className={status === "vervallen" ? "font-medium text-destructive" : undefined}>
          <span className="tabular-nums">{formatDate(vervaldatum)}</span>
          <span className="text-muted-foreground"> · {betalingstermijnDagen} dagen</span>
        </dd>
        {verzondenAt && (
          <>
            <dt className="text-muted-foreground">Verzonden</dt>
            <dd className="tabular-nums">{formatDate(verzondenAt)}</dd>
          </>
        )}
        {betaaldAt && status === "betaald" && (
          <>
            <dt className="text-muted-foreground">Betaald</dt>
            <dd className="tabular-nums">{formatDate(betaaldAt)}</dd>
          </>
        )}
        {email && (
          <>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="min-w-0 truncate" title={email}>
              {email}
            </dd>
          </>
        )}
      </dl>
    </SectiePaneel>
  );
}

/** De stappen ná de huidige; verdwijnt als alles klaar is. */
export function Daarna({ huidige }: { huidige: number }) {
  const resterend = FACTUUR_STAPPEN.slice(huidige + 1);
  if (resterend.length === 0) return null;
  return (
    <SectiePaneel titel="Daarna" kopbalk>
      <ol className="flex list-decimal flex-col gap-1.5 py-4 pl-[2.1rem] pr-4 text-[13px] text-muted-foreground marker:tabular-nums">
        {resterend.map((stap) => (
          <li key={stap.label}>
            <span className="text-foreground">{stap.label}</span> — {stap.wat}
          </li>
        ))}
      </ol>
    </SectiePaneel>
  );
}
