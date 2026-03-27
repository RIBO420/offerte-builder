"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Euro,
  CalendarDays,
  Clock,
  User,
  Building2,
} from "lucide-react";
import { formatCurrency, formatDateShort } from "./types";

// ---------------------------------------------------------------------------
// Quick Stats
// ---------------------------------------------------------------------------

interface FactuurQuickStatsProps {
  totaalInclBtw: number;
  factuurdatum: number;
  vervaldatum: number;
  betalingstermijnDagen: number;
  klantNaam: string;
  klantPlaats: string;
}

export function FactuurQuickStats({
  totaalInclBtw,
  factuurdatum,
  vervaldatum,
  betalingstermijnDagen,
  klantNaam,
  klantPlaats,
}: FactuurQuickStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <Euro className="h-4 w-4" />
            Totaal incl. BTW
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatCurrency(totaalInclBtw)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <CalendarDays className="h-4 w-4" />
            Factuurdatum
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatDateShort(factuurdatum)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Vervaldatum
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatDateShort(vervaldatum)}
          </p>
          <p className="text-xs text-muted-foreground">
            {betalingstermijnDagen} dagen betalingstermijn
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <User className="h-4 w-4" />
            Klant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-bold truncate" title={klantNaam}>
            {klantNaam}
          </p>
          <p className="text-xs text-muted-foreground truncate" title={klantPlaats}>
            {klantPlaats}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gegevens (Client & Company Info)
// ---------------------------------------------------------------------------

interface FactuurGegevensProps {
  klant: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
  };
  bedrijf: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
  };
}

export function FactuurGegevens({ klant, bedrijf }: FactuurGegevensProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gegevens</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="h-4 w-4" />
              Factuuradres
            </div>
            <div>
              <p className="font-medium">{klant.naam}</p>
              <p className="text-sm text-muted-foreground">{klant.adres}</p>
              <p className="text-sm text-muted-foreground">
                {klant.postcode} {klant.plaats}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Van
            </div>
            <div>
              <p className="font-medium">{bedrijf.naam}</p>
              <p className="text-sm text-muted-foreground">{bedrijf.adres}</p>
              <p className="text-sm text-muted-foreground">
                {bedrijf.postcode} {bedrijf.plaats}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Factuur Regels (Invoice Lines + Correcties)
// ---------------------------------------------------------------------------

interface Regel {
  id?: string;
  omschrijving: string;
  hoeveelheid: number;
  eenheid: string;
  prijsPerEenheid: number;
  totaal: number;
}

interface Correctie {
  omschrijving: string;
  bedrag: number;
}

interface FactuurRegelsProps {
  regels: Regel[];
  correcties?: Correctie[] | null;
}

const FactuurRegelRij = React.memo(function FactuurRegelRij({
  regel,
  index,
}: {
  regel: Regel;
  index: number;
}) {
  return (
    <tr key={regel.id || index} className="border-b last:border-0">
      <td className="p-3">{regel.omschrijving}</td>
      <td className="p-3 text-right">
        {regel.hoeveelheid} {regel.eenheid}
      </td>
      <td className="p-3 text-right">{formatCurrency(regel.prijsPerEenheid)}</td>
      <td className="p-3 text-right font-medium">{formatCurrency(regel.totaal)}</td>
    </tr>
  );
});

export function FactuurRegels({ regels, correcties }: FactuurRegelsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Factuurregels</CardTitle>
        <CardDescription>
          {regels.length} regel(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Omschrijving</th>
                <th className="text-right p-3 font-medium">Aantal</th>
                <th className="text-right p-3 font-medium">Prijs</th>
                <th className="text-right p-3 font-medium">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {regels.map((regel, index) => (
                <FactuurRegelRij key={regel.id || index} regel={regel} index={index} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Correcties section */}
        {correcties && correcties.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Correcties</h4>
            <div className="space-y-2">
              {correcties.map((correctie, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{correctie.omschrijving}</span>
                  <span className={correctie.bedrag >= 0 ? "text-green-600" : "text-red-600"}>
                    {correctie.bedrag >= 0 ? "+" : ""}{formatCurrency(correctie.bedrag)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
