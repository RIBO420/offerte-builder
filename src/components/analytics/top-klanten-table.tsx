"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink } from "lucide-react";

interface TopKlant {
  klantId: string | null;
  klantNaam: string;
  totaalOmzet: number;
  aantalOffertes: number;
  gemiddeldeWaarde: number;
}

interface TopKlantenTableProps {
  klanten: TopKlant[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function TopKlantenTable({ klanten }: TopKlantenTableProps) {
  if (klanten.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Klanten</CardTitle>
          <CardDescription>Klanten gesorteerd op omzet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            Geen klanten gevonden
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Klanten</CardTitle>
        <CardDescription>Klanten gesorteerd op omzet (geaccepteerde offertes)</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">#</TableHead>
              <TableHead>Klant</TableHead>
              <TableHead className="text-right">Totaal Omzet</TableHead>
              <TableHead className="text-right">Offertes</TableHead>
              <TableHead className="text-right">Gem. Waarde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {klanten.map((klant, index) => (
              <TableRow key={klant.klantId ?? klant.klantNaam}>
                <TableCell className="font-medium text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell>
                  {klant.klantId ? (
                    <Link
                      href={`/klanten/${klant.klantId}`}
                      className="flex items-center gap-1 font-medium hover:underline"
                    >
                      {klant.klantNaam}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  ) : (
                    <span className="font-medium">{klant.klantNaam}</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(klant.totaalOmzet)}
                </TableCell>
                <TableCell className="text-right">
                  {klant.aantalOffertes}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(klant.gemiddeldeWaarde)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
