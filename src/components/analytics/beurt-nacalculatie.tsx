"use client";

/**
 * Beurt-nacalculatie in het Calculatie Analyse-tabblad (PRD §3.4).
 *
 * Echte data uit de nacalculatie-keten: per onderhoudsbeurt de werkelijke
 * tijd uit bevestigde/ingediende urensegmenten (werken; reistijd apart; BES
 * apart — de werkelijke afvoertijd naast de gefactureerde afvoerkosten,
 * §2.6) tegenover de geplande uren (geschatteUren/bouwsteen-normtijden).
 * Kantoor-only, zelfde query-keten als de normuur-suggesties op het
 * catalogusbeheer-scherm.
 */

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ClipboardCheck } from "lucide-react";
import { api } from "@convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsKantoor } from "@/hooks/use-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatUren } from "@/components/catalogus/normuur-suggesties";

const STATUS_LABELS: Record<string, string> = {
  uitgevoerd: "Uitgevoerd",
  gefactureerd: "Gefactureerd",
  deels_uitgevoerd: "Deels uitgevoerd",
};

export function BeurtNacalculatie() {
  const { user } = useCurrentUser();
  const isKantoor = useIsKantoor();
  const magLezen = Boolean(user?._id) && isKantoor;

  const [vanDatum, setVanDatum] = useState("");
  const [totDatum, setTotDatum] = useState("");

  const args = useMemo(
    () => ({
      ...(vanDatum ? { vanDatum } : {}),
      ...(totDatum ? { totDatum } : {}),
    }),
    [vanDatum, totDatum]
  );
  const data = useQuery(
    api.beurtNacalculatie.getBeurtNacalculatie,
    magLezen ? args : "skip"
  );

  if (!magLezen) return null;

  return (
    <Card data-testid="beurt-nacalculatie">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-5" />
          Nacalculatie onderhoudsbeurten
        </CardTitle>
        <CardDescription>
          Werkelijke tijd uit bevestigde urensegmenten per beurt — reistijd en
          afvalverwerker (BES) apart naast de werktijd. Voedt de
          normuur-suggesties in het catalogusbeheer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="beurt-nacalc-van">Van</Label>
            <Input
              id="beurt-nacalc-van"
              type="date"
              value={vanDatum}
              onChange={(e) => setVanDatum(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="beurt-nacalc-tot">Tot en met</Label>
            <Input
              id="beurt-nacalc-tot"
              type="date"
              value={totDatum}
              onChange={(e) => setTotDatum(e.target.value)}
              className="w-40"
            />
          </div>
        </div>

        {data === undefined ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : data.beurten.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nog geen uitgevoerde beurten met bevestigde uren in deze periode.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Beurt</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Gepland</TableHead>
                  <TableHead className="text-right">Werkelijk</TableHead>
                  <TableHead className="text-right">Afwijking</TableHead>
                  <TableHead className="text-right">Reistijd</TableHead>
                  <TableHead className="text-right">BES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.beurten.map((beurt) => (
                  <TableRow key={beurt.werkitemId}>
                    <TableCell>{beurt.datum ?? "—"}</TableCell>
                    <TableCell className="font-medium">{beurt.naam}</TableCell>
                    <TableCell>{beurt.klantNaam ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {STATUS_LABELS[beurt.status] ?? beurt.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {beurt.geplandeUren !== null
                        ? `${formatUren(beurt.geplandeUren)} u`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUren(beurt.werkelijkeUren)} u
                    </TableCell>
                    <TableCell
                      className={
                        beurt.afwijkingUren !== null && beurt.afwijkingUren > 0
                          ? "text-right text-trend-negative"
                          : "text-right text-muted-foreground"
                      }
                    >
                      {beurt.afwijkingUren !== null
                        ? `${beurt.afwijkingUren > 0 ? "+" : ""}${formatUren(
                            beurt.afwijkingUren
                          )} u`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUren(beurt.reistijdUren)} u
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUren(beurt.besUren)} u
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
