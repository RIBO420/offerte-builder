"use client";

/**
 * Uurtarief-beheer op het catalogus-beheerscherm (PRD §2.5f, §8.7).
 *
 * Toont het huidige tarief + de volledige historie en een formulier
 * "nieuw tarief per [datum]". Historie blijft bestaan: documenten met een
 * eerdere datum behouden het tarief dat op hun datum gold.
 */

import { useState } from "react";
import { Euro, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/format/currency";

export interface UurtariefRecord {
  _id: string;
  bedrag: number;
  ingangsdatum: string; // "YYYY-MM-DD"
  opmerking?: string;
}

interface UurtariefBeheerProps {
  huidig: { bedrag: number; ingangsdatum: string } | null | undefined;
  historie: UurtariefRecord[] | undefined;
  onNieuwTarief: (data: {
    bedrag: number;
    ingangsdatum: string;
  }) => Promise<void>;
}

function formatDatum(iso: string): string {
  const [jaar, maand, dag] = iso.split("-");
  return `${dag}-${maand}-${jaar}`;
}

export function UurtariefBeheer({
  huidig,
  historie,
  onNieuwTarief,
}: UurtariefBeheerProps) {
  const vandaag = new Date().toISOString().slice(0, 10);
  const [bedrag, setBedrag] = useState("");
  const [ingangsdatum, setIngangsdatum] = useState(vandaag);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    const parsed = Number(bedrag.trim().replace(",", "."));
    if (!bedrag.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Vul een geldig uurtarief groter dan 0 in");
      return;
    }
    if (!ingangsdatum) {
      toast.error("Kies een ingangsdatum");
      return;
    }
    setIsSaving(true);
    try {
      await onNieuwTarief({ bedrag: parsed, ingangsdatum });
      toast.success(
        `Nieuw uurtarief ${formatCurrency(parsed)} per ${formatDatum(ingangsdatum)} opgeslagen`
      );
      setBedrag("");
    } catch (error) {
      toast.error("Fout bij opslaan uurtarief");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Euro className="size-5" />
          Uurtarief
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Toelichting uurtarief"
                className="inline-flex text-muted-foreground hover:text-foreground"
              >
                <Info className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-sm">
              Een nieuw tarief geldt vanaf de ingangsdatum. Offertes en
              contracten met een eerdere datum behouden hun oude tarief.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <CardDescription>
          Uurtarief ex btw voor bouwstenen op uurbasis (instelling met
          ingangsdatum, geen hardcoded getal)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div data-testid="huidig-uurtarief">
          {huidig ? (
            <p className="text-2xl font-semibold">
              {formatCurrency(huidig.bedrag)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ex btw per uur · geldig sinds {formatDatum(huidig.ingangsdatum)}
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground">
              Nog geen uurtarief ingesteld.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="nieuw-tarief-bedrag">Nieuw tarief (ex btw)</Label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-muted-foreground">
                &euro;
              </span>
              <Input
                id="nieuw-tarief-bedrag"
                type="text"
                inputMode="decimal"
                className="w-32 pl-7"
                placeholder="65"
                value={bedrag}
                onChange={(e) => setBedrag(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nieuw-tarief-datum">Ingangsdatum</Label>
            <Input
              id="nieuw-tarief-datum"
              type="date"
              className="w-44"
              value={ingangsdatum}
              onChange={(e) => setIngangsdatum(e.target.value)}
            />
          </div>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Nieuw tarief per {formatDatum(ingangsdatum)}
          </Button>
        </div>

        {historie && historie.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Historie</p>
            <ul className="space-y-1 text-sm">
              {historie.map((t) => (
                <li
                  key={t._id}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <span className="w-24 font-medium text-foreground">
                    {formatCurrency(t.bedrag)}
                  </span>
                  <span>per {formatDatum(t.ingangsdatum)}</span>
                  {huidig && t.ingangsdatum === huidig.ingangsdatum && (
                    <Badge variant="secondary">huidig</Badge>
                  )}
                  {t.ingangsdatum > vandaag && (
                    <Badge variant="outline">gepland</Badge>
                  )}
                  {t.opmerking && (
                    <span className="truncate text-xs">— {t.opmerking}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
