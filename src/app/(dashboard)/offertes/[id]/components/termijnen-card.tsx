"use client";

/**
 * Termijnen van de offerte (HERO-nabouw fase 3). Vóór versturen: het
 * termijnschema bekijken en aanpassen. Na acceptatie: per termijn de factuur
 * maken ("Factureer termijn 1"), de laatste is de eindfactuur, met het
 * overzicht gefactureerd / betaald / openstaand.
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Edit, Loader2, Plus, Receipt, Trash2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format/currency";

interface Stap {
  percentage: number;
  label: string;
}

interface TermijnenCardProps {
  id: string;
  type: "aanleg" | "onderhoud";
  status: string;
  termijnschema?: Stap[];
}

function factuurStatus(f: { documentStatus: string; betaalStatus: string }): string {
  if (f.betaalStatus === "betaald" || f.betaalStatus === "gedeeltelijk_betaald" || f.betaalStatus === "vervallen") {
    return f.betaalStatus;
  }
  return f.documentStatus;
}

function foutTekst(fout: unknown, standaard: string): string {
  return fout instanceof Error && "data" in fout
    ? String((fout as { data: unknown }).data)
    : standaard;
}

export function TermijnenCard({ id, type, status, termijnschema }: TermijnenCardProps) {
  const offerteId = id as Id<"offertes">;
  const geaccepteerd = status === "geaccepteerd";
  const magSchemaBewerken = status === "concept" || status === "voorcalculatie";
  const overzicht = useQuery(api.factuurKeten.overzicht, geaccepteerd ? { offerteId } : "skip");
  const factureer = useMutation(api.factuurKeten.factureerTermijn);
  const eindfactuur = useMutation(api.factuurKeten.maakEindfactuur);
  const [bezig, setBezig] = useState<number | "eind" | null>(null);
  const [bewerken, setBewerken] = useState(false);

  const schema = termijnschema ?? [];
  if (!geaccepteerd && schema.length === 0 && !magSchemaBewerken) return null;

  const factuurLink = (projectId: string | undefined | null, factuurId: string) =>
    projectId ? `/projecten/${projectId}/factuur?factuur=${factuurId}` : "/facturen";

  const maak = async (nummer: number, isEind: boolean) => {
    setBezig(isEind ? "eind" : nummer);
    try {
      if (isEind) await eindfactuur({ offerteId });
      else await factureer({ offerteId, nummer });
      toast.success(isEind ? "Factuur aangemaakt als concept" : `Termijn ${nummer} aangemaakt als concept`);
    } catch (fout) {
      toast.error(foutTekst(fout, "Factuur maken mislukt"));
    } finally {
      setBezig(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>{geaccepteerd ? "Facturatie" : "Termijnen"}</CardTitle>
        {magSchemaBewerken && (
          <Button variant="outline" size="sm" onClick={() => setBewerken(true)}>
            <Edit className="size-4" />
            Bewerken
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!geaccepteerd && (
          <p className="text-sm text-muted-foreground">
            {schema.length === 0
              ? type === "onderhoud"
                ? "Geen termijnen: na acceptatie volgt één factuur."
                : "Geen termijnen: na acceptatie volgt één factuur. Voeg termijnen toe voor aanbetaling en tussentijdse facturen."
              : schema.map((s) => `${s.percentage}% ${s.label}`).join(" · ")}
          </p>
        )}

        {geaccepteerd && overzicht && (
          <>
            <ul className="divide-y">
              {(overzicht.zonderSchema
                ? [{ nummer: 1, percentage: 100, label: "volledige factuur", isEindfactuur: true, prognose: overzicht.totaal, factuur: overzicht.eindfactuur }]
                : overzicht.termijnen
              ).map((t) => {
                const isVolgende =
                  overzicht.zonderSchema ? !t.factuur : overzicht.volgendeNummer === t.nummer;
                return (
                  <li key={t.nummer} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {overzicht.zonderSchema
                          ? "Factuur"
                          : t.isEindfactuur
                            ? `Eindfactuur – ${t.percentage}% ${t.label}`
                            : `Termijn ${t.nummer} – ${t.percentage}% ${t.label}`}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {t.factuur
                          ? `${t.factuur.factuurnummer} · ${formatCurrency(t.factuur.totaalInclBtw)}`
                          : `ca. ${formatCurrency(t.prognose)} incl. btw`}
                      </p>
                    </div>
                    {t.factuur ? (
                      <div className="flex items-center gap-2">
                        <StatusBadge status={factuurStatus(t.factuur)} domain="factuur" size="sm" showIcon={false} />
                        <Button asChild variant="ghost" size="sm">
                          <Link href={factuurLink(overzicht.projectId ?? t.factuur.projectId, t.factuur._id)}>
                            Openen
                          </Link>
                        </Button>
                      </div>
                    ) : isVolgende ? (
                      <Button
                        size="sm"
                        onClick={() => maak(t.nummer, t.isEindfactuur)}
                        disabled={bezig !== null}
                      >
                        {bezig === (t.isEindfactuur ? "eind" : t.nummer) ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Receipt className="size-4" />
                        )}
                        {overzicht.zonderSchema
                          ? "Factuur maken"
                          : t.isEindfactuur
                            ? "Eindfactuur maken"
                            : `Factureer termijn ${t.nummer}`}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nog niet</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Gefactureerd</dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(overzicht.gefactureerd)}
                  <span className="text-xs font-normal text-muted-foreground"> van {formatCurrency(overzicht.totaal)}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Betaald</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(overzicht.betaald)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Openstaand</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(overzicht.openstaand)}</dd>
              </div>
            </dl>
            {overzicht.losseFacturen.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Ook gekoppeld: {overzicht.losseFacturen.map((f) => f.factuurnummer).join(", ")}
              </p>
            )}
          </>
        )}
      </CardContent>
      {bewerken && (
        <SchemaDialog
          offerteId={offerteId}
          beginWaarde={schema}
          onClose={() => setBewerken(false)}
        />
      )}
    </Card>
  );
}

function SchemaDialog({
  offerteId,
  beginWaarde,
  onClose,
}: {
  offerteId: Id<"offertes">;
  beginWaarde: Stap[];
  onClose: () => void;
}) {
  const opslaan = useMutation(api.offertes.updateTermijnschema);
  const [stappen, setStappen] = useState<Stap[]>(beginWaarde);
  const [isSaving, setIsSaving] = useState(false);
  const som = Math.round(stappen.reduce((t, s) => t + (s.percentage || 0), 0) * 100) / 100;
  const klopt = stappen.length === 0 || som === 100;

  const zet = (i: number, deel: Partial<Stap>) =>
    setStappen((huidig) => huidig.map((s, j) => (j === i ? { ...s, ...deel } : s)));

  const handleOpslaan = async () => {
    setIsSaving(true);
    try {
      await opslaan({ id: offerteId, termijnschema: stappen });
      toast.success("Termijnschema opgeslagen");
      onClose();
    } catch (fout) {
      toast.error(foutTekst(fout, "Opslaan mislukt"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Termijnschema</DialogTitle>
          <DialogDescription>
            De termijnen tellen op tot 100%. De laatste termijn wordt de
            eindfactuur. Zonder termijnen volgt één factuur.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {stappen.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                aria-label={`Percentage termijn ${i + 1}`}
                className="w-20"
                value={Number.isNaN(s.percentage) ? "" : s.percentage}
                onChange={(e) => zet(i, { percentage: Number(e.target.value) })}
              />
              <span className="text-sm text-muted-foreground">%</span>
              <Input
                aria-label={`Omschrijving termijn ${i + 1}`}
                value={s.label}
                placeholder="bijv. na gunning"
                onChange={(e) => zet(i, { label: e.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Verwijder termijn ${i + 1}`}
                onClick={() => setStappen((h) => h.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStappen((h) => [...h, { percentage: Math.max(0, 100 - som), label: "" }])}
              disabled={stappen.length >= 10}
            >
              <Plus className="size-4" />
              Termijn
            </Button>
            <span className={`text-sm tabular-nums ${klopt ? "text-muted-foreground" : "text-destructive"}`}>
              Totaal {som}%
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Annuleren
          </Button>
          <Button onClick={handleOpslaan} disabled={isSaving || !klopt}>
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
