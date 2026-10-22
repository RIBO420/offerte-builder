"use client";

/**
 * Inleiding en afsluiting van één document (offerte of factuur, HERO-nabouw
 * fase 2). Toont de tekst zoals hij op de PDF komt en welke gegevens het
 * versturen nog tegenhouden. Bewerken geldt alleen voor dit document; de
 * bibliotheek (Instellingen → Tekstblokken) blijft ongemoeid.
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { AlertTriangle, Edit, Loader2, Lock } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { DocumentSoort } from "@convex/lib/documentTekst";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentTekstEditor } from "@/components/teksten/document-tekst-editor";

export interface GetoondeTeksten {
  teksten: { inleiding?: string; afsluiting?: string };
  ontbrekend: string[];
  vastgelegd: boolean;
  waarden: Record<string, string | undefined>;
}

interface DocumentTekstenCardProps {
  /** "offerte" of "factuur", voor de teksten in de dialoog */
  documentNaam: string;
  soort: DocumentSoort;
  getoond: GetoondeTeksten | undefined;
  magBewerken: boolean;
  /** Ruwe teksten met placeholders, als beginwaarde in de dialoog */
  beginWaarde?: { inleiding?: string; afsluiting?: string };
  onOpslaan: (teksten: { inleiding: string; afsluiting: string }) => Promise<void>;
}

export function DocumentTekstenCard({
  documentNaam,
  soort,
  getoond,
  magBewerken,
  beginWaarde,
  onOpslaan,
}: DocumentTekstenCardProps) {
  const [open, setOpen] = useState(false);

  if (getoond === undefined) return null;
  const { teksten, ontbrekend, vastgelegd } = getoond;
  const leeg = !teksten.inleiding && !teksten.afsluiting;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          Teksten
          {vastgelegd && (
            <Badge variant="outline" className="gap-1 font-normal">
              <Lock className="size-3" />
              Vastgelegd
            </Badge>
          )}
        </CardTitle>
        {magBewerken && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Edit className="size-4" />
            Bewerken
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {ontbrekend.length > 0 && (
          <p className="flex gap-2 rounded-md border border-status-in-uitvoering-border bg-status-in-uitvoering p-3 text-sm text-status-in-uitvoering-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Nog in te vullen voordat u kunt versturen: {ontbrekend.join(", ")}.
              Bedrijfsgegevens vult u in onder{" "}
              <Link href="/profiel" className="underline">
                Profiel
              </Link>
              .
            </span>
          </p>
        )}
        {leeg ? (
          <p className="text-sm text-muted-foreground">
            Geen inleiding of afsluiting. Standaardteksten stelt u in onder{" "}
            <Link href="/instellingen/tekstblokken" className="underline">
              Instellingen → Tekstblokken
            </Link>
            .
          </p>
        ) : (
          <>
            <TekstVoorbeeld titel="Inleiding" tekst={teksten.inleiding} />
            <TekstVoorbeeld titel="Afsluiting" tekst={teksten.afsluiting} />
          </>
        )}
      </CardContent>
      {magBewerken && open && (
        <TekstenDialog
          open={open}
          onOpenChange={setOpen}
          documentNaam={documentNaam}
          soort={soort}
          beginWaarde={beginWaarde}
          waarden={getoond.waarden}
          onOpslaan={onOpslaan}
        />
      )}
    </Card>
  );
}

function TekstVoorbeeld({ titel, tekst }: { titel: string; tekst?: string }) {
  const [uitgeklapt, setUitgeklapt] = useState(false);
  if (!tekst) return null;
  const lang = tekst.split("\n").length > 6;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{titel}</p>
      <p
        className={`whitespace-pre-wrap text-sm ${lang && !uitgeklapt ? "line-clamp-6" : ""}`}
      >
        {tekst}
      </p>
      {lang && (
        <button
          type="button"
          className="text-sm text-muted-foreground underline"
          onClick={() => setUitgeklapt((u) => !u)}
        >
          {uitgeklapt ? "Minder tonen" : "Alles tonen"}
        </button>
      )}
    </div>
  );
}

function TekstenDialog({
  open,
  onOpenChange,
  documentNaam,
  soort,
  beginWaarde,
  waarden,
  onOpslaan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentNaam: string;
  soort: DocumentSoort;
  beginWaarde?: { inleiding?: string; afsluiting?: string };
  waarden: Record<string, string | undefined>;
  onOpslaan: (teksten: { inleiding: string; afsluiting: string }) => Promise<void>;
}) {
  const inleidingen = useQuery(api.tekstblokken.actief, {
    categorie: "aanhef",
    documentSoort: soort,
  });
  const afsluitingen = useQuery(api.tekstblokken.actief, {
    categorie: "voorwaarden",
    documentSoort: soort,
  });
  const [inleiding, setInleiding] = useState(beginWaarde?.inleiding ?? "");
  const [afsluiting, setAfsluiting] = useState(beginWaarde?.afsluiting ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleOpslaan = async () => {
    setIsSaving(true);
    try {
      await onOpslaan({ inleiding, afsluiting });
      toast.success("Teksten opgeslagen");
      onOpenChange(false);
    } catch (fout) {
      toast.error(fout instanceof Error ? fout.message : "Opslaan mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Teksten van deze {documentNaam}</DialogTitle>
          <DialogDescription>
            Alleen voor deze {documentNaam}. De velden worden bij het versturen
            ingevuld en vastgelegd.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6">
          <div className="grid gap-2">
            <BibliotheekKeuze
              label="Inleiding uit de bibliotheek"
              blokken={inleidingen}
              onKies={setInleiding}
            />
            <DocumentTekstEditor
              id="document-inleiding"
              label="Inleiding"
              value={inleiding}
              onChange={setInleiding}
              documentSoort={soort}
              waarden={waarden}
              rows={5}
            />
          </div>
          <div className="grid gap-2">
            <BibliotheekKeuze
              label="Afsluiting uit de bibliotheek"
              blokken={afsluitingen}
              onKies={setAfsluiting}
            />
            <DocumentTekstEditor
              id="document-afsluiting"
              label="Afsluiting"
              value={afsluiting}
              onChange={setAfsluiting}
              documentSoort={soort}
              waarden={waarden}
              rows={8}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annuleren
          </Button>
          <Button onClick={handleOpslaan} disabled={isSaving}>
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BibliotheekKeuze({
  label,
  blokken,
  onKies,
}: {
  label: string;
  blokken: Array<{ _id: string; naam: string; inhoud: string }> | undefined;
  onKies: (inhoud: string) => void;
}) {
  if (!blokken || blokken.length < 2) return null;
  return (
    <Select
      value=""
      onValueChange={(id) => {
        const blok = blokken.find((b) => b._id === id);
        if (blok) onKies(blok.inhoud);
      }}
    >
      <SelectTrigger aria-label={label} className="w-full sm:w-72">
        <SelectValue placeholder="Andere tekst uit de bibliotheek…" />
      </SelectTrigger>
      <SelectContent>
        {blokken.map((b) => (
          <SelectItem key={b._id} value={b._id}>
            {b.naam}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
