"use client";

import { memo } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Bedrijfsgegevens, Klant } from "@/types/offerte";

// Factuur status types
export type FactuurStatus = "concept" | "verzonden" | "betaald" | "vervallen";

// Factuur regel (line item)
export interface FactuurRegel {
  id: string;
  omschrijving: string;
  hoeveelheid: number;
  eenheid: string;
  prijsPerEenheid: number;
  totaal: number;
}

// Correctie (adjustment)
export interface FactuurCorrectie {
  id: string;
  omschrijving: string;
  bedrag: number;
  type: "toeslag" | "korting";
}

// Full factuur data
export interface FactuurData {
  factuurnummer: string;
  status: FactuurStatus;
  factuurdatum: number; // timestamp
  vervaldatum: number; // timestamp
  klant: Klant;
  regels: FactuurRegel[];
  correcties?: FactuurCorrectie[];
  subtotaal: number;
  btwPercentage: number;
  btw: number;
  totaal: number;
  betalingstermijn?: number; // days
  notities?: string;
}

interface FactuurPreviewProps {
  factuur: FactuurData;
  bedrijfsgegevens?: Bedrijfsgegevens;
  className?: string;
}

// Format number in Dutch style (1.234,56)
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

// Format number without currency symbol
function formatNumber(amount: number, decimals: number = 2): string {
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

// Format date in Dutch
function formatDate(timestamp: number): string {
  return format(new Date(timestamp), "d MMMM yyyy", { locale: nl });
}

// Get status badge variant and label
function getStatusInfo(status: FactuurStatus): {
  variant: "default" | "secondary" | "destructive" | "outline";
  label: string;
} {
  switch (status) {
    case "concept":
      return { variant: "secondary", label: "Concept" };
    case "verzonden":
      return { variant: "outline", label: "Verzonden" };
    case "betaald":
      return { variant: "default", label: "Betaald" };
    case "vervallen":
      return { variant: "destructive", label: "Vervallen" };
    default:
      return { variant: "outline", label: status };
  }
}

export const FactuurPreview = memo(function FactuurPreview({
  factuur,
  bedrijfsgegevens,
  className,
}: FactuurPreviewProps) {
  const statusInfo = getStatusInfo(factuur.status);
  const isConcept = factuur.status === "concept";

  // Calculate correcties totals
  const correctiesTotaal = factuur.correcties?.reduce((sum, c) => {
    return sum + (c.type === "korting" ? -c.bedrag : c.bedrag);
  }, 0) ?? 0;

  return (
    <Card className={className}>
      {/* CONCEPT Watermark overlay */}
      {isConcept && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="text-6xl font-bold text-muted-foreground/10 rotate-[-30deg] select-none">
            CONCEPT
          </span>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          {/* Company Info */}
          <div className="space-y-1">
            <CardTitle className="text-xl text-primary">
              {bedrijfsgegevens?.naam || "Uw Bedrijf"}
            </CardTitle>
            {bedrijfsgegevens && (
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>{bedrijfsgegevens.adres}</p>
                <p>
                  {bedrijfsgegevens.postcode} {bedrijfsgegevens.plaats}
                </p>
                {bedrijfsgegevens.telefoon && (
                  <p>Tel: {bedrijfsgegevens.telefoon}</p>
                )}
                {bedrijfsgegevens.email && <p>{bedrijfsgegevens.email}</p>}
                {bedrijfsgegevens.kvk && <p>KvK: {bedrijfsgegevens.kvk}</p>}
                {bedrijfsgegevens.btw && <p>BTW: {bedrijfsgegevens.btw}</p>}
              </div>
            )}
          </div>

          {/* Factuur Info */}
          <div className="text-right space-y-1">
            <div className="flex items-center justify-end gap-2">
              <h2 className="text-2xl font-bold">FACTUUR</h2>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <p className="text-lg font-semibold">{factuur.factuurnummer}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Klant Address & Factuur Details */}
        <div className="grid grid-cols-2 gap-8">
          {/* Klant Address Block */}
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Factuuradres
            </h3>
            <p className="font-medium">{factuur.klant.naam}</p>
            <p className="text-sm">{factuur.klant.adres}</p>
            <p className="text-sm">
              {factuur.klant.postcode} {factuur.klant.plaats}
            </p>
            {factuur.klant.email && (
              <p className="text-sm text-muted-foreground">
                {factuur.klant.email}
              </p>
            )}
          </div>

          {/* Factuur Details */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Factuurnummer:</span>
              <span className="font-medium">{factuur.factuurnummer}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Factuurdatum:</span>
              <span>{formatDate(factuur.factuurdatum)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vervaldatum:</span>
              <span>{formatDate(factuur.vervaldatum)}</span>
            </div>
            {factuur.betalingstermijn && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Betalingstermijn:</span>
                <span>{factuur.betalingstermijn} dagen</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Regels Table */}
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50%]">Omschrijving</TableHead>
                <TableHead className="text-right">Aantal</TableHead>
                <TableHead>Eenheid</TableHead>
                <TableHead className="text-right">Prijs</TableHead>
                <TableHead className="text-right">Totaal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factuur.regels.map((regel) => (
                <TableRow key={regel.id}>
                  <TableCell className="font-medium">
                    {regel.omschrijving}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(regel.hoeveelheid, 2)}
                  </TableCell>
                  <TableCell>{regel.eenheid}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(regel.prijsPerEenheid)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(regel.totaal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Correcties Section */}
        {factuur.correcties && factuur.correcties.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Correcties
            </h3>
            <Table>
              <TableBody>
                {factuur.correcties.map((correctie) => (
                  <TableRow key={correctie.id}>
                    <TableCell className="w-[80%]">
                      {correctie.omschrijving}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        correctie.type === "korting"
                          ? "text-destructive"
                          : "text-primary"
                      }`}
                    >
                      {correctie.type === "korting" ? "-" : "+"}
                      {formatCurrency(correctie.bedrag)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Separator />

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotaal:</span>
              <span>{formatCurrency(factuur.subtotaal)}</span>
            </div>
            {correctiesTotaal !== 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Correcties:</span>
                <span
                  className={
                    correctiesTotaal < 0 ? "text-destructive" : "text-primary"
                  }
                >
                  {correctiesTotaal > 0 ? "+" : ""}
                  {formatCurrency(correctiesTotaal)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                BTW ({factuur.btwPercentage}%):
              </span>
              <span>{formatCurrency(factuur.btw)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Totaal:</span>
              <span className="text-primary">
                {formatCurrency(factuur.totaal)}
              </span>
            </div>
          </div>
        </div>

        {/* Notities */}
        {factuur.notities && (
          <>
            <Separator />
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Opmerkingen
              </h3>
              <p className="text-sm whitespace-pre-wrap">{factuur.notities}</p>
            </div>
          </>
        )}

        <Separator />

        {/* Footer with Payment Info */}
        <div className="bg-muted/20 rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-medium">Betalingsgegevens</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">IBAN:</span>{" "}
              <span className="font-mono">
                {bedrijfsgegevens?.iban || "NL00 BANK 0000 0000 00"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">T.n.v.:</span>{" "}
              <span>{bedrijfsgegevens?.naam || "Uw Bedrijf"}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Gelieve het factuurnummer{" "}
            <span className="font-medium">{factuur.factuurnummer}</span> te
            vermelden bij uw betaling.
            {factuur.betalingstermijn && (
              <>
                {" "}
                Betalingstermijn: {factuur.betalingstermijn} dagen na
                factuurdatum.
              </>
            )}
          </p>
        </div>

        {/* Company Footer */}
        {bedrijfsgegevens && (
          <div className="text-center text-xs text-muted-foreground pt-4 border-t">
            <p>
              {bedrijfsgegevens.naam}
              {bedrijfsgegevens.kvk && ` | KvK: ${bedrijfsgegevens.kvk}`}
              {bedrijfsgegevens.btw && ` | BTW: ${bedrijfsgegevens.btw}`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default FactuurPreview;
