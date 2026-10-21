"use client";

/**
 * Instellingen-tab "Planning": standaardblokken van de route-dagkaart
 * (PRD §2.2, stap 5b) — vertrektijd loods, pauze, loods-afronding en de
 * standaard-reistijd per verplaatsing. Echte tijden levert Mickey (§7.1);
 * tot dan gelden de defaults. Dag-specifieke afwijkingen zet de planner op
 * de dagkaart zelf; hier staan de bedrijfsbrede standaarden.
 */

import { MateriaalRegelsPaneel } from "@/components/veld/materiaal-regels-paneel";
import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { DAGKAART_DEFAULTS } from "@convex/dagkaartLogica";
import { STANDAARD_WERKDAG, minutenNaarTijd } from "@convex/tijdbordLogica";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface DagkaartInstellingenWaarden {
  vertrekTijd?: string;
  pauzeStart?: string;
  pauzeEind?: string;
  loodsAfrondingMinuten?: number;
  standaardReistijdMinuten?: number;
  werkdagStart?: string;
  werkdagEind?: string;
  urenPerDag?: number;
}

export function DagkaartTab({
  dagkaartInstellingen,
}: {
  dagkaartInstellingen?: DagkaartInstellingenWaarden;
}) {
  const opslaan = useMutation(api.instellingen.updateDagkaartInstellingen);
  const [isSaving, setIsSaving] = useState(false);
  const [waarden, setWaarden] = useState<Required<DagkaartInstellingenWaarden>>({
    vertrekTijd: dagkaartInstellingen?.vertrekTijd ?? DAGKAART_DEFAULTS.vertrekTijd,
    pauzeStart: dagkaartInstellingen?.pauzeStart ?? DAGKAART_DEFAULTS.pauzeStart,
    pauzeEind: dagkaartInstellingen?.pauzeEind ?? DAGKAART_DEFAULTS.pauzeEind,
    loodsAfrondingMinuten:
      dagkaartInstellingen?.loodsAfrondingMinuten ??
      DAGKAART_DEFAULTS.loodsAfrondingMinuten,
    standaardReistijdMinuten:
      dagkaartInstellingen?.standaardReistijdMinuten ??
      DAGKAART_DEFAULTS.standaardReistijdMinuten,
    werkdagStart:
      dagkaartInstellingen?.werkdagStart ?? minutenNaarTijd(STANDAARD_WERKDAG.start),
    werkdagEind:
      dagkaartInstellingen?.werkdagEind ?? minutenNaarTijd(STANDAARD_WERKDAG.eind),
    urenPerDag: dagkaartInstellingen?.urenPerDag ?? STANDAARD_WERKDAG.urenPerDag,
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await opslaan(waarden);
      toast.success("Dagkaart-instellingen opgeslagen");
    } catch (fout) {
      toast.error(
        fout instanceof Error ? fout.message : "Opslaan mislukt"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <MateriaalRegelsPaneel />
      <Card>
        <CardHeader>
          <CardTitle>Dagkaart — standaardblokken</CardTitle>
          <CardDescription>
            Deze blokken worden automatisch op elke dagkaart geplaatst.
            Dag-specifieke afwijkingen stel je op de dagkaart zelf in; de
            standaard-reistijd geldt per verplaatsing zolang er geen berekende
            reistijd is.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="dagkaart-vertrek">Vertrektijd loods</Label>
              <Input
                id="dagkaart-vertrek"
                type="time"
                value={waarden.vertrekTijd}
                onChange={(e) =>
                  setWaarden((w) => ({ ...w, vertrekTijd: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dagkaart-pauze-start">Pauze van</Label>
              <Input
                id="dagkaart-pauze-start"
                type="time"
                value={waarden.pauzeStart}
                onChange={(e) =>
                  setWaarden((w) => ({ ...w, pauzeStart: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dagkaart-pauze-eind">Pauze tot</Label>
              <Input
                id="dagkaart-pauze-eind"
                type="time"
                value={waarden.pauzeEind}
                onChange={(e) =>
                  setWaarden((w) => ({ ...w, pauzeEind: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dagkaart-afronding">
                Loods-afronding (minuten)
              </Label>
              <Input
                id="dagkaart-afronding"
                type="number"
                min={0}
                max={1440}
                value={waarden.loodsAfrondingMinuten}
                onChange={(e) =>
                  setWaarden((w) => ({
                    ...w,
                    loodsAfrondingMinuten: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dagkaart-reistijd">
                Standaard-reistijd per verplaatsing (minuten)
              </Label>
              <Input
                id="dagkaart-reistijd"
                type="number"
                min={0}
                max={1440}
                value={waarden.standaardReistijdMinuten}
                onChange={(e) =>
                  setWaarden((w) => ({
                    ...w,
                    standaardReistijdMinuten: Number(e.target.value),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Gebruikt zolang er geen Google Maps-reistijd beschikbaar is.
              </p>
            </div>
          </div>
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="werkdag-start">Werkdag van</Label>
              <Input
                id="werkdag-start"
                type="time"
                step={900}
                value={waarden.werkdagStart}
                onChange={(e) => setWaarden((w) => ({ ...w, werkdagStart: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="werkdag-eind">Werkdag tot</Label>
              <Input
                id="werkdag-eind"
                type="time"
                step={900}
                value={waarden.werkdagEind}
                onChange={(e) => setWaarden((w) => ({ ...w, werkdagEind: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="werkdag-uren">Uren per persoon per dag</Label>
              <Input
                id="werkdag-uren"
                type="number"
                min={1}
                max={16}
                step={0.5}
                value={waarden.urenPerDag}
                onChange={(e) => setWaarden((w) => ({ ...w, urenPerDag: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground">
                Het tijdbord is grijs buiten de werkdag. Bij inplannen uit de
                bak stelt het bord zoveel dagen voor als de begrote uren nodig hebben.
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Opslaan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
