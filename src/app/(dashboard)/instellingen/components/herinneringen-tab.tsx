"use client";

/**
 * Herinneringen-tab (WS6: één systeem, één Opslaan).
 *
 * De debiteurenladder is hét herinneringssysteem; de handmatige
 * herinnering/aanmaning-velden (dagen vanaf de vervaldatum, gebruikt door de
 * knoppen op de factuurpagina) staan als sectie bínnen die card en slaan mee
 * op met dezelfde knop. Het aparte uitlegblok en de tweede Opslaan-knop zijn
 * daarmee vervallen.
 */

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell } from "lucide-react";
import { DebiteurenladderCard } from "./debiteurenladder-card";

interface HerinneringenInstellingen {
  herinneringDagen?: number[];
  aanmaningDagen?: number[];
  automatischVersturen?: boolean;
}

interface HerinneringenTabProps {
  herinneringInstellingen?: HerinneringenInstellingen;
}

export function HerinneringenTab({
  herinneringInstellingen,
}: HerinneringenTabProps) {
  const updateHerinneringen = useMutation(
    api.instellingen.updateHerinneringInstellingen
  );

  const [automatisch, setAutomatisch] = useState(false);
  const [herinnering1, setHerinnering1] = useState(7);
  const [herinnering2, setHerinnering2] = useState(14);
  const [herinnering3, setHerinnering3] = useState(21);
  const [aanmaning1, setAanmaning1] = useState(30);
  const [aanmaning2, setAanmaning2] = useState(45);
  const [aanmaning3, setAanmaning3] = useState(60);

  // Bestaande instellingen inladen zodra de prop (Convex-query) binnenkomt —
  // als render-tijd-aanpassing i.p.v. useEffect (react-hooks/set-state-in-effect).
  const [prevInstellingen, setPrevInstellingen] = useState<
    HerinneringenInstellingen | undefined
  >(undefined);
  if (herinneringInstellingen !== prevInstellingen) {
    setPrevInstellingen(herinneringInstellingen);
    if (herinneringInstellingen) {
      setAutomatisch(herinneringInstellingen.automatischVersturen ?? false);
      const hDagen = herinneringInstellingen.herinneringDagen ?? [7, 14, 21];
      setHerinnering1(hDagen[0] ?? 7);
      setHerinnering2(hDagen[1] ?? 14);
      setHerinnering3(hDagen[2] ?? 21);
      const aDagen = herinneringInstellingen.aanmaningDagen ?? [30, 45, 60];
      setAanmaning1(aDagen[0] ?? 30);
      setAanmaning2(aDagen[1] ?? 45);
      setAanmaning3(aDagen[2] ?? 60);
    }
  }

  // Valideert en bewaart de handmatige velden; draait mee met de ene
  // Opslaan-knop van de ladder-card (onSaveExtra). Retourneert false bij
  // een validatiefout zodat de ladder dan óók niet opslaat.
  const saveHandmatigeVelden = useCallback(async (): Promise<boolean> => {
    const herinneringDagen = [herinnering1, herinnering2, herinnering3];
    const aanmaningDagen = [aanmaning1, aanmaning2, aanmaning3];

    for (let i = 1; i < herinneringDagen.length; i++) {
      if (herinneringDagen[i] <= herinneringDagen[i - 1]) {
        toast.error("Herinneringsdagen moeten in oplopende volgorde staan");
        return false;
      }
    }
    for (let i = 1; i < aanmaningDagen.length; i++) {
      if (aanmaningDagen[i] <= aanmaningDagen[i - 1]) {
        toast.error("Aanmaningsdagen moeten in oplopende volgorde staan");
        return false;
      }
    }
    if (aanmaningDagen[0] <= herinneringDagen[2]) {
      toast.error("Eerste aanmaning moet na de laatste herinnering komen");
      return false;
    }

    try {
      await updateHerinneringen({
        herinneringDagen,
        aanmaningDagen,
        automatischVersturen: automatisch,
      });
      return true;
    } catch {
      toast.error("Fout bij opslaan herinneringsinstellingen");
      return false;
    }
  }, [
    herinnering1,
    herinnering2,
    herinnering3,
    aanmaning1,
    aanmaning2,
    aanmaning3,
    automatisch,
    updateHerinneringen,
  ]);

  const handmatigeSectie = (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">
          <Bell className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          Handmatig versturen vanaf de factuurpagina
        </p>
        <p className="text-sm text-muted-foreground">
          Deze dagen (geteld vanaf de vervaldatum) sturen de knoppen
          &ldquo;herinnering&rdquo; en &ldquo;aanmaning&rdquo; op de
          factuurpagina.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="herinnering-1">1e herinnering</Label>
          <Input
            id="herinnering-1"
            type="number"
            min={1}
            max={90}
            value={herinnering1}
            onChange={(e) => setHerinnering1(parseInt(e.target.value) || 7)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="herinnering-2">2e herinnering</Label>
          <Input
            id="herinnering-2"
            type="number"
            min={1}
            max={90}
            value={herinnering2}
            onChange={(e) => setHerinnering2(parseInt(e.target.value) || 14)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="herinnering-3">3e herinnering</Label>
          <Input
            id="herinnering-3"
            type="number"
            min={1}
            max={90}
            value={herinnering3}
            onChange={(e) => setHerinnering3(parseInt(e.target.value) || 21)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="aanmaning-1">1e aanmaning</Label>
          <Input
            id="aanmaning-1"
            type="number"
            min={1}
            max={180}
            value={aanmaning1}
            onChange={(e) => setAanmaning1(parseInt(e.target.value) || 30)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aanmaning-2">2e aanmaning</Label>
          <Input
            id="aanmaning-2"
            type="number"
            min={1}
            max={180}
            value={aanmaning2}
            onChange={(e) => setAanmaning2(parseInt(e.target.value) || 45)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aanmaning-3">Ingebrekestelling</Label>
          <Input
            id="aanmaning-3"
            type="number"
            min={1}
            max={180}
            value={aanmaning3}
            onChange={(e) => setAanmaning3(parseInt(e.target.value) || 60)}
          />
        </div>
      </div>

      {/* Compact schema-voorbeeld van het handmatige traject */}
      <div className="space-y-2">
        {[
          { dag: 0, label: "Vervaldatum", color: "bg-amber-500 dark:bg-amber-400" },
          { dag: herinnering1, label: "1e herinnering", color: "bg-amber-400 dark:bg-amber-300" },
          { dag: herinnering2, label: "2e herinnering", color: "bg-amber-500 dark:bg-amber-400" },
          { dag: herinnering3, label: "3e herinnering", color: "bg-orange-500 dark:bg-orange-400" },
          { dag: aanmaning1, label: "1e aanmaning", color: "bg-red-400 dark:bg-red-300" },
          { dag: aanmaning2, label: "2e aanmaning", color: "bg-red-500 dark:bg-red-400" },
          { dag: aanmaning3, label: "Ingebrekestelling", color: "bg-red-700 dark:bg-red-500" },
        ].map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${item.color} shrink-0`} />
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium min-w-[140px]">{item.label}</span>
              <span className="text-muted-foreground">
                {item.dag === 0 ? "dag 0" : `na ${item.dag} dagen`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Debiteurenladder (PRD §3.2) mét de handmatige velden als sectie:
          één systeem, één Opslaan (WS6). */}
      <DebiteurenladderCard
        extraSectie={handmatigeSectie}
        onSaveExtra={saveHandmatigeVelden}
      />
    </div>
  );
}
