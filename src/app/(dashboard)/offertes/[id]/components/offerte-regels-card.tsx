"use client";

import React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Edit } from "lucide-react";
import { formatCurrency, scopeLabels } from "./utils";

// Regels gegroepeerd per scope (volgorde van eerste voorkomen) — de
// scope-chip per regel is vervangen door één kopregel per scope.
function groupRegelsByScope(regels: Regel[]): { scope: string; regels: Regel[] }[] {
  const groups: { scope: string; regels: Regel[] }[] = [];
  const byScope = new Map<string, Regel[]>();
  for (const regel of regels) {
    let group = byScope.get(regel.scope);
    if (!group) {
      group = [];
      byScope.set(regel.scope, group);
      groups.push({ scope: regel.scope, regels: group });
    }
    group.push(regel);
  }
  return groups;
}

interface Regel {
  id: string;
  omschrijving: string;
  type: string;
  scope: string;
  hoeveelheid: number;
  eenheid: string;
  prijsPerEenheid: number;
  totaal: number;
}

interface OfferteRegelsCardProps {
  regels: Regel[];
  id: string;
  /** Bepaalt welke editor de knop opent — zie `/offertes/[id]/bewerken`. */
  bron?: "wizard" | "vrij";
  /** Bewerken kan alleen zolang de offerte niet naar de klant is. */
  status?: string;
}

export function OfferteRegelsCard({
  regels,
  id,
  bron,
  status,
}: OfferteRegelsCardProps) {
  const magBewerken =
    status === undefined || status === "concept" || status === "voorcalculatie";
  const bewerkPad =
    bron === "vrij" ? `/offertes/${id}/vrij` : `/offertes/${id}/bewerken`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Offerteregels</CardTitle>
        <CardDescription>
          {regels.length > 0
            ? `${regels.length} regel${regels.length === 1 ? "" : "s"}`
            : "Nog geen regels toegevoegd"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {regels.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Omschrijving</TableHead>
                <TableHead className="text-right">Hoeveelheid</TableHead>
                <TableHead className="text-right">Prijs</TableHead>
                <TableHead className="text-right">Totaal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupRegelsByScope(regels).map((groep) => (
                <React.Fragment key={groep.scope}>
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={4}
                      className="py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {scopeLabels[groep.scope] || groep.scope}
                    </TableCell>
                  </TableRow>
                  {groep.regels.map((regel) => (
                    <TableRow key={regel.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{regel.omschrijving}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {regel.type}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {regel.hoeveelheid} {regel.eenheid}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(regel.prijsPerEenheid)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(regel.totaal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">
              Er zijn nog geen regels toegevoegd aan deze offerte.
            </p>
            {magBewerken && (
              <Button asChild className="mt-4">
                <Link href={bewerkPad}>
                  <Edit className="mr-2 h-4 w-4" />
                  Regels toevoegen
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
