"use client";

/**
 * Instellingen-tab "Nummering": nummerreeksen voor offertes en facturen
 * (HERO-nabouw). Bij de overstap gaat de nummering verder waar HERO stopt:
 * kies "doorlopend", vul het voorvoegsel en het volgende nummer in.
 * Creditnota's lopen mee in de factuurreeks. Alleen directie mag opslaan
 * (server: instellingen.updateNummerreeksen).
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import {
  formatteerDocumentNummer,
  type NummerFormaat,
} from "@convex/lib/documentNummer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { LaadIndicator } from "@/components/ui/laad-indicator";

interface ReeksWaarden {
  prefix: string;
  formaat: NummerFormaat;
  cijfers: number;
  volgendNummer: number;
}

interface ReeksMetStand extends ReeksWaarden {
  laatsteNummer: number;
}

function ReeksKaart({
  id,
  titel,
  omschrijving,
  huidig,
}: {
  id: "offerte" | "factuur";
  titel: string;
  omschrijving: string;
  huidig: ReeksMetStand;
}) {
  const opslaan = useMutation(api.instellingen.updateNummerreeksen);
  const [isSaving, setIsSaving] = useState(false);
  const [waarden, setWaarden] = useState<ReeksWaarden>({
    prefix: huidig.prefix,
    formaat: huidig.formaat,
    cijfers: huidig.cijfers,
    volgendNummer: huidig.volgendNummer,
  });

  const voorbeeld = Number.isInteger(waarden.volgendNummer)
    ? formatteerDocumentNummer(
        waarden,
        waarden.volgendNummer,
        new Date().getFullYear()
      )
    : "—";
  const teLaag = waarden.volgendNummer <= huidig.laatsteNummer;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await opslaan({ [id]: waarden });
      toast.success(`${titel} opgeslagen`);
    } catch (fout) {
      toast.error(fout instanceof Error ? fout.message : "Opslaan mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titel}</CardTitle>
        <CardDescription>{omschrijving}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-formaat`}>Formaat</Label>
            <Select
              value={waarden.formaat}
              onValueChange={(formaat) =>
                setWaarden((w) => ({ ...w, formaat: formaat as NummerFormaat }))
              }
            >
              <SelectTrigger id={`${id}-formaat`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="doorlopend">Doorlopend (01399)</SelectItem>
                <SelectItem value="jaar">Met jaartal (2026-001)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-prefix`}>Voorvoegsel</Label>
            <Input
              id={`${id}-prefix`}
              value={waarden.prefix}
              placeholder="Geen"
              maxLength={10}
              onChange={(e) =>
                setWaarden((w) => ({ ...w, prefix: e.target.value.trim() }))
              }
            />
          </div>
          {waarden.formaat === "doorlopend" && (
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-cijfers`}>Aantal cijfers</Label>
              <Input
                id={`${id}-cijfers`}
                type="number"
                min={3}
                max={8}
                value={waarden.cijfers}
                onChange={(e) =>
                  setWaarden((w) => ({ ...w, cijfers: Number(e.target.value) }))
                }
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-volgend`}>Volgende nummer</Label>
            <Input
              id={`${id}-volgend`}
              type="number"
              min={huidig.laatsteNummer + 1}
              value={waarden.volgendNummer}
              aria-invalid={teLaag}
              onChange={(e) =>
                setWaarden((w) => ({
                  ...w,
                  volgendNummer: Number(e.target.value),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              {teLaag
                ? `Minimaal ${huidig.laatsteNummer + 1}: lagere nummers zijn al uitgegeven.`
                : "Kan alleen omhoog."}
            </p>
          </div>
        </div>
        <p className="text-sm">
          Volgende {id === "offerte" ? "offerte" : "factuur"}:{" "}
          <span className="font-medium tabular-nums">{voorbeeld}</span>
        </p>
        <Button onClick={handleSave} disabled={isSaving || teLaag}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Opslaan
        </Button>
      </CardContent>
    </Card>
  );
}

export function NummeringTab() {
  const reeksen = useQuery(api.instellingen.getNummerreeksen);

  if (reeksen === undefined) return <LaadIndicator />;
  if (reeksen === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Nog geen instellingen voor dit bedrijf.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ReeksKaart
        id="offerte"
        titel="Offertenummers"
        omschrijving="Een nieuw nummer wordt uitgegeven bij elke nieuwe offerte. Komt u van een ander pakket, vul dan het eerstvolgende nummer van dat pakket in."
        huidig={reeksen.offerte}
      />
      <ReeksKaart
        id="factuur"
        titel="Factuurnummers"
        omschrijving="Geldt voor alle facturen, ook termijn-, eind- en creditfacturen. Facturen moeten doorlopend genummerd zijn; het volgende nummer kan daarom nooit terug."
        huidig={reeksen.factuur}
      />
    </div>
  );
}
