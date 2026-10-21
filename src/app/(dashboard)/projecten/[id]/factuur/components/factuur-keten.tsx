"use client";

/**
 * Factuurketen op de factuurpagina (HERO-nabouw fase 3):
 * - ProjectFacturenWissel: alle facturen van dit project (termijnen,
 *   eindfactuur, creditfacturen) om tussen te wisselen.
 * - BtwVerlegdKaart: btw verlegd (NL of EU) op een conceptfactuur, met het
 *   btw-nummer van de klant.
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format/currency";

export function ProjectFacturenWissel({
  projectId,
  huidigId,
  facturen,
}: {
  projectId: string;
  huidigId?: Id<"facturen">;
  facturen: {
    _id: Id<"facturen">;
    factuurnummer: string;
    soort: string;
    status: string;
    totaalInclBtw: number;
  }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Facturen bij dit project</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="-mx-2 grid gap-1">
          {facturen.map((f) => {
            const actief = f._id === huidigId;
            return (
              <li key={f._id}>
                <Link
                  href={`/projecten/${projectId}/factuur?factuur=${f._id}`}
                  aria-current={actief ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted ${actief ? "bg-muted font-medium" : ""}`}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {f.soort} · {f.factuurnummer}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatCurrency(f.totaalInclBtw)}
                  </span>
                  <StatusBadge status={f.status} domain="factuur" size="sm" showIcon={false} />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

const GEEN = "geen";

export function BtwVerlegdKaart({ factuur }: { factuur: Doc<"facturen"> }) {
  const zet = useMutation(api.facturen.setBtwVerlegd);
  const isConcept = (factuur.documentStatus ?? factuur.status) === "concept";
  const [btwNummer, setBtwNummer] = useState(factuur.klantBtwNummer ?? "");
  const [bezig, setBezig] = useState(false);

  if (!isConcept && !factuur.btwVerlegd) return null;

  const opslaan = async (waarde: "nl" | "eu" | null, nummer = btwNummer) => {
    setBezig(true);
    try {
      await zet({ id: factuur._id, btwVerlegd: waarde, klantBtwNummer: nummer });
    } catch (fout) {
      toast.error(
        fout instanceof Error && "data" in fout
          ? String((fout as { data: unknown }).data)
          : "Opslaan mislukt"
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Btw
          {bezig && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isConcept ? (
          <>
            <Select
              value={factuur.btwVerlegd ?? GEEN}
              onValueChange={(w) => opslaan(w === GEEN ? null : (w as "nl" | "eu"))}
            >
              <SelectTrigger aria-label="Btw-regeling" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GEEN}>Normaal (btw per regel)</SelectItem>
                <SelectItem value="nl">Btw verlegd (Nederland)</SelectItem>
                <SelectItem value="eu">Btw verlegd (EU-bedrijf)</SelectItem>
              </SelectContent>
            </Select>
            {factuur.btwVerlegd && (
              <div className="grid gap-1.5">
                <Label htmlFor="klant-btw">Btw-nummer van de klant</Label>
                <div className="flex gap-2">
                  <Input
                    id="klant-btw"
                    value={btwNummer}
                    placeholder="bijv. BE0123456789"
                    onChange={(e) => setBtwNummer(e.target.value)}
                    aria-invalid={!btwNummer.trim()}
                  />
                  <Button
                    variant="outline"
                    onClick={() => opslaan(factuur.btwVerlegd ?? null)}
                    disabled={bezig || btwNummer === (factuur.klantBtwNummer ?? "")}
                  >
                    Opslaan
                  </Button>
                </div>
                {!factuur.klantBtwNummer && (
                  <p className="text-xs text-destructive">
                    Verplicht: zonder btw-nummer kan de factuur niet definitief.
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="whitespace-pre-wrap text-sm">
            {factuur.btwVerlegdVermelding}
            {factuur.klantBtwNummer ? `\nBtw-nummer afnemer: ${factuur.klantBtwNummer}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
