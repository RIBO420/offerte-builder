"use client";

/**
 * Termijnen en facturatie van de offerte (HERO-nabouw fase 3), compact voor
 * de zijkolom. Vóór versturen: het termijnschema bekijken en aanpassen. Na
 * acceptatie: een balk gefactureerd/betaald, het openstaande bedrag, per
 * termijn de factuur (openen of "Factureer termijn n"; de laatste is de
 * eindfactuur) en de orderbevestiging. Vervangt de TermijnenCard; getoond in
 * dezelfde gevallen.
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format/currency";
import { DocumentPdfKnop } from "@/components/pdf/document-pdf-knop";

interface Stap {
  percentage: number;
  label: string;
}

interface FacturatiePaneelProps {
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

export function FacturatiePaneel({ id, type, status, termijnschema }: FacturatiePaneelProps) {
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

  const geheelBetaald =
    !!overzicht && overzicht.totaal > 0 && overzicht.openstaand <= 0 && overzicht.betaald >= overzicht.totaal;
  const deel = (n: number) =>
    overzicht && overzicht.totaal > 0 ? `${Math.min(100, Math.max(0, (n / overzicht.totaal) * 100))}%` : "0%";

  return (
    <SectiePaneel
      titel={geaccepteerd ? "Facturatie" : "Termijnen"}
      kopbalk
      acties={
        <>
          {geaccepteerd && geheelBetaald && (
            <span className="rounded-full bg-status-geaccepteerd px-2 py-0.5 text-xs font-semibold text-status-geaccepteerd-text">
              Betaald
            </span>
          )}
          {magSchemaBewerken && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setBewerken(true)}
            >
              <Pencil />
              Bewerken
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-2.5 px-4 py-3">
        {!geaccepteerd && (
          <p className="text-[13px] text-muted-foreground">
            {schema.length === 0
              ? type === "onderhoud"
                ? "Geen termijnen: na acceptatie volgt één factuur."
                : "Geen termijnen: na acceptatie volgt één factuur. Voeg termijnen toe voor aanbetaling en tussentijdse facturen."
              : schema.map((s) => `${s.percentage}% ${s.label}`).join(" · ")}
          </p>
        )}

        {geaccepteerd && overzicht === undefined && (
          <div className="h-12 animate-pulse rounded-md bg-muted" aria-hidden="true" />
        )}

        {geaccepteerd && overzicht && (
          <>
            {/* Balk: gefactureerd (licht) met betaald (vol) erover */}
            <div
              role="img"
              aria-label={`${formatCurrency(overzicht.gefactureerd)} gefactureerd en ${formatCurrency(overzicht.betaald)} betaald van ${formatCurrency(overzicht.totaal)}`}
              className="relative h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-status-geaccepteerd-dot/35"
                style={{ width: deel(overzicht.gefactureerd) }}
              />
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-status-geaccepteerd-dot"
                style={{ width: deel(overzicht.betaald) }}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-x-3 text-[13px] tabular-nums">
              <span>
                <b className="font-semibold">{formatCurrency(overzicht.gefactureerd)}</b>{" "}
                <span className="text-muted-foreground">gefactureerd</span>
              </span>
              <span className="text-muted-foreground">
                {formatCurrency(Math.max(0, overzicht.openstaand))} open
              </span>
            </div>

            <ul className="divide-y border-t">
              {(overzicht.zonderSchema
                ? [{ nummer: 1, percentage: 100, label: "volledige factuur", isEindfactuur: true, prognose: overzicht.totaal, factuur: overzicht.eindfactuur }]
                : overzicht.termijnen
              ).map((t) => {
                const isVolgende =
                  overzicht.zonderSchema ? !t.factuur : overzicht.volgendeNummer === t.nummer;
                const titel = overzicht.zonderSchema
                  ? "Factuur"
                  : t.isEindfactuur
                    ? `Eind · ${t.percentage}%`
                    : `Termijn ${t.nummer} · ${t.percentage}%`;
                return (
                  <li key={t.nummer} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-[13px]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium" title={t.label}>{titel}</p>
                      {!t.factuur && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          ca. {formatCurrency(t.prognose)}
                        </p>
                      )}
                    </div>
                    {t.factuur ? (
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={factuurLink(overzicht.projectId ?? t.factuur.projectId, t.factuur._id)}
                          className="text-primary tabular-nums transition-colors hover:text-primary/80"
                        >
                          {t.factuur.factuurnummer}
                        </Link>
                        <StatusBadge status={factuurStatus(t.factuur)} domain="factuur" size="sm" showIcon={false} />
                      </div>
                    ) : isVolgende ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => maak(t.nummer, t.isEindfactuur)}
                        disabled={bezig !== null}
                      >
                        {bezig === (t.isEindfactuur ? "eind" : t.nummer) ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Receipt />
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

            {overzicht.losseFacturen.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Ook gekoppeld: {overzicht.losseFacturen.map((f) => f.factuurnummer).join(", ")}
              </p>
            )}
            <div className="-mx-2.5 -mb-1">
              <DocumentPdfKnop bron={{ soort: "orderbevestiging", offerteId }} variant="ghost" />
            </div>
          </>
        )}
      </div>
      {bewerken && (
        <SchemaDialog
          offerteId={offerteId}
          beginWaarde={schema}
          onClose={() => setBewerken(false)}
        />
      )}
    </SectiePaneel>
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
