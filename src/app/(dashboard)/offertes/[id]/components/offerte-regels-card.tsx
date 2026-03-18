"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
}

export function OfferteRegelsCard({ regels, id }: OfferteRegelsCardProps) {
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
                <TableHead>Scope</TableHead>
                <TableHead className="text-right">Hoeveelheid</TableHead>
                <TableHead className="text-right">Prijs</TableHead>
                <TableHead className="text-right">Totaal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regels.map((regel) => (
                <TableRow key={regel.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{regel.omschrijving}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {regel.type}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {scopeLabels[regel.scope] || regel.scope}
                    </Badge>
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
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">
              Er zijn nog geen regels toegevoegd aan deze offerte.
            </p>
            <Button asChild className="mt-4">
              <Link href={`/offertes/${id}/bewerken`}>
                <Edit className="mr-2 h-4 w-4" />
                Regels toevoegen
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
