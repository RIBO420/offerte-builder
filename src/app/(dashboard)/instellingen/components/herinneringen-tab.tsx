"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Save, Bell, Scale, Info } from "lucide-react";

interface HerinneringenInstellingen {
  herinneringDagen?: number[];
  aanmaningDagen?: number[];
  automatischVersturen?: boolean;
}

interface HerinneringenTabProps {
  reducedMotion: boolean;
  herinneringInstellingen?: HerinneringenInstellingen;
}

export function HerinneringenTab({
  reducedMotion,
  herinneringInstellingen,
}: HerinneringenTabProps) {
  const updateHerinneringen = useMutation(
    api.instellingen.updateHerinneringInstellingen
  );

  const [isSaving, setIsSaving] = useState(false);
  const [automatisch, setAutomatisch] = useState(false);
  const [herinnering1, setHerinnering1] = useState(7);
  const [herinnering2, setHerinnering2] = useState(14);
  const [herinnering3, setHerinnering3] = useState(21);
  const [aanmaning1, setAanmaning1] = useState(30);
  const [aanmaning2, setAanmaning2] = useState(45);
  const [aanmaning3, setAanmaning3] = useState(60);

  // Load existing settings
  useEffect(() => {
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
  }, [herinneringInstellingen]);

  const handleSave = useCallback(async () => {
    // Validate: days must be in ascending order
    const herinneringDagen = [herinnering1, herinnering2, herinnering3];
    const aanmaningDagen = [aanmaning1, aanmaning2, aanmaning3];

    for (let i = 1; i < herinneringDagen.length; i++) {
      if (herinneringDagen[i] <= herinneringDagen[i - 1]) {
        toast.error("Herinneringsdagen moeten in oplopende volgorde staan");
        return;
      }
    }
    for (let i = 1; i < aanmaningDagen.length; i++) {
      if (aanmaningDagen[i] <= aanmaningDagen[i - 1]) {
        toast.error("Aanmaningsdagen moeten in oplopende volgorde staan");
        return;
      }
    }
    if (aanmaningDagen[0] <= herinneringDagen[2]) {
      toast.error(
        "Eerste aanmaning moet na de laatste herinnering komen"
      );
      return;
    }

    setIsSaving(true);
    try {
      await updateHerinneringen({
        herinneringDagen,
        aanmaningDagen,
        automatischVersturen: automatisch,
      });
      toast.success("Herinneringsinstellingen opgeslagen");
    } catch {
      toast.error("Fout bij opslaan herinneringsinstellingen");
    } finally {
      setIsSaving(false);
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

  return (
    <motion.div
      key="herinneringen"
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: -20 }}
      transition={{ duration: reducedMotion ? 0 : 0.3 }}
      className="space-y-6"
    >
      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            Over betalingsherinneringen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Configureer wanneer betalingsherinneringen en aanmaningen worden verstuurd
            voor onbetaalde facturen. De dagen worden geteld vanaf de vervaldatum van de factuur.
            Herinneringen zijn vriendelijke betalingsverzoeken, aanmaningen zijn formele
            ingebrekestellingen.
          </p>
        </CardContent>
      </Card>

      {/* Automatisch Versturen Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Automatisch versturen
          </CardTitle>
          <CardDescription>
            Schakel in om herinneringen automatisch te laten versturen via de dagelijkse controle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-send">Automatische herinneringen</Label>
              <p className="text-sm text-muted-foreground">
                {automatisch
                  ? "Herinneringen worden automatisch verstuurd"
                  : "Alleen handmatig versturen via de factuurpagina"}
              </p>
            </div>
            <Switch
              id="auto-send"
              checked={automatisch}
              onCheckedChange={setAutomatisch}
            />
          </div>
        </CardContent>
      </Card>

      {/* Herinnering Dagen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            Betalingsherinneringen
          </CardTitle>
          <CardDescription>
            Vriendelijke herinneringen na het verstrijken van de betalingstermijn
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="herinnering-1">
                1e herinnering
                <Badge variant="outline" className="ml-2 text-xs">
                  dagen na vervaldatum
                </Badge>
              </Label>
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
              <Label htmlFor="herinnering-2">
                2e herinnering
              </Label>
              <Input
                id="herinnering-2"
                type="number"
                min={1}
                max={90}
                value={herinnering2}
                onChange={(e) =>
                  setHerinnering2(parseInt(e.target.value) || 14)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="herinnering-3">
                3e herinnering
              </Label>
              <Input
                id="herinnering-3"
                type="number"
                min={1}
                max={90}
                value={herinnering3}
                onChange={(e) =>
                  setHerinnering3(parseInt(e.target.value) || 21)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aanmaning Dagen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-red-500" />
            Aanmaningen
          </CardTitle>
          <CardDescription>
            Formele aanmaningen bij langdurig uitblijven van betaling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="aanmaning-1">
                1e aanmaning
                <Badge variant="outline" className="ml-2 text-xs">
                  dagen na vervaldatum
                </Badge>
              </Label>
              <Input
                id="aanmaning-1"
                type="number"
                min={1}
                max={180}
                value={aanmaning1}
                onChange={(e) =>
                  setAanmaning1(parseInt(e.target.value) || 30)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aanmaning-2">
                2e aanmaning
              </Label>
              <Input
                id="aanmaning-2"
                type="number"
                min={1}
                max={180}
                value={aanmaning2}
                onChange={(e) =>
                  setAanmaning2(parseInt(e.target.value) || 45)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aanmaning-3">
                Ingebrekestelling
              </Label>
              <Input
                id="aanmaning-3"
                type="number"
                min={1}
                max={180}
                value={aanmaning3}
                onChange={(e) =>
                  setAanmaning3(parseInt(e.target.value) || 60)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Tijdlijn voorbeeld</CardTitle>
          <CardDescription>
            Zo ziet het herinneringsschema eruit voor een onbetaalde factuur
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-3">
            {[
              { dag: 0, label: "Vervaldatum", color: "bg-amber-500" },
              {
                dag: herinnering1,
                label: "1e herinnering",
                color: "bg-amber-400",
              },
              {
                dag: herinnering2,
                label: "2e herinnering",
                color: "bg-amber-500",
              },
              {
                dag: herinnering3,
                label: "3e herinnering",
                color: "bg-orange-500",
              },
              {
                dag: aanmaning1,
                label: "1e aanmaning",
                color: "bg-red-400",
              },
              {
                dag: aanmaning2,
                label: "2e aanmaning",
                color: "bg-red-500",
              },
              {
                dag: aanmaning3,
                label: "Ingebrekestelling",
                color: "bg-red-700",
              },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <div
                  className={`h-3 w-3 rounded-full ${item.color} shrink-0`}
                />
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium min-w-[140px]">
                    {item.label}
                  </span>
                  <span className="text-muted-foreground">
                    {item.dag === 0
                      ? "dag 0"
                      : `na ${item.dag} dagen`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Opslaan
        </Button>
      </div>
    </motion.div>
  );
}
