"use client";

/**
 * Instellingen voor de debiteurenladder (PRD §3.2): instelbare treden
 * (max 4, dagen na verzending + escalatietype), aan/uit-schakelaar en de
 * eigenaar-kiezer voor trede-taken (default: bedrijfseigenaar — bewust
 * een instelling, geen hardcoded naam).
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Plus, Trash2, ListOrdered } from "lucide-react";

interface TredeInvoer {
  trede: number;
  dagenNaVerzending: number;
  escalatie: "mail" | "interne_taak";
  actief?: boolean;
}

const MAX_TREDEN = 4;

export function DebiteurenladderCard() {
  const config = useQuery(api.debiteuren.getLadderInstellingen, {});
  const kantoorGebruikers = useQuery(api.debiteuren.listKantoorGebruikers, {});
  const update = useMutation(api.debiteuren.updateLadderInstellingen);

  const [actief, setActief] = useState(true);
  const [taakEigenaarId, setTaakEigenaarId] = useState<string>("default");
  const [treden, setTreden] = useState<TredeInvoer[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setActief(config.actief);
      setTaakEigenaarId(config.taakEigenaarId ?? "default");
      setTreden(
        config.treden.map((t) => ({
          trede: t.trede,
          dagenNaVerzending: t.dagenNaVerzending,
          escalatie: t.escalatie,
          actief: t.actief ?? true,
        }))
      );
    }
  }, [config]);

  const wijzigTrede = (index: number, patch: Partial<TredeInvoer>) => {
    setTreden((huidig) =>
      huidig.map((t, i) => (i === index ? { ...t, ...patch } : t))
    );
  };

  const voegTredeToe = () => {
    if (treden.length >= MAX_TREDEN) return;
    const laatste = treden[treden.length - 1];
    setTreden([
      ...treden,
      {
        trede: treden.length + 1,
        dagenNaVerzending: (laatste?.dagenNaVerzending ?? 7) + 7,
        escalatie: "mail",
        actief: true,
      },
    ]);
  };

  const verwijderTrede = (index: number) => {
    setTreden((huidig) =>
      huidig
        .filter((_, i) => i !== index)
        .map((t, i) => ({ ...t, trede: i + 1 }))
    );
  };

  const handleSave = async () => {
    for (let i = 1; i < treden.length; i++) {
      if (treden[i].dagenNaVerzending <= treden[i - 1].dagenNaVerzending) {
        toast.error("Elke volgende trede moet later vallen dan de vorige");
        return;
      }
    }
    setIsSaving(true);
    try {
      await update({
        actief,
        taakEigenaarId:
          taakEigenaarId === "default"
            ? undefined
            : (taakEigenaarId as Id<"users">),
        treden: treden.map((t, i) => ({
          trede: i + 1,
          dagenNaVerzending: t.dagenNaVerzending,
          escalatie: t.escalatie,
          actief: t.actief ?? true,
        })),
      });
      toast.success("Debiteurenladder opgeslagen");
    } catch {
      toast.error("Fout bij opslaan van de debiteurenladder");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListOrdered className="h-5 w-5 text-emerald-600" />
          Debiteurenladder
        </CardTitle>
        <CardDescription>
          De ladder draait automatisch elke dag: per trede gaat er een
          herinneringsmail als concept in de wachtrij, of er wordt een
          interne taak (bellen/aanmaning) aangemaakt op het cases-bord. De
          dagen tellen vanaf de verzenddatum van de factuur (dag 0).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="ladder-actief">Ladder actief</Label>
            <p className="text-sm text-muted-foreground">
              {actief
                ? "De dagelijkse controle verwerkt openstaande facturen"
                : "De ladder staat uit — geen automatische herinneringen of taken"}
            </p>
          </div>
          <Switch
            id="ladder-actief"
            checked={actief}
            onCheckedChange={setActief}
          />
        </div>

        <div className="space-y-3">
          {treden.map((trede, index) => (
            <div
              key={index}
              className="flex flex-wrap items-end gap-3 rounded-lg border p-3"
            >
              <Badge variant="secondary" className="mb-2">
                Trede {index + 1}
              </Badge>
              <div className="space-y-1">
                <Label htmlFor={`trede-dagen-${index}`} className="text-xs">
                  Dagen na verzending
                </Label>
                <Input
                  id={`trede-dagen-${index}`}
                  type="number"
                  min={1}
                  max={365}
                  className="w-28"
                  value={trede.dagenNaVerzending}
                  onChange={(e) =>
                    wijzigTrede(index, {
                      dagenNaVerzending: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Actie</Label>
                <Select
                  value={trede.escalatie}
                  onValueChange={(waarde) =>
                    wijzigTrede(index, {
                      escalatie: waarde as "mail" | "interne_taak",
                    })
                  }
                >
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mail">
                      Herinneringsmail (concept)
                    </SelectItem>
                    <SelectItem value="interne_taak">
                      Interne taak (bellen/aanmaning)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  id={`trede-actief-${index}`}
                  checked={trede.actief ?? true}
                  onCheckedChange={(checked) =>
                    wijzigTrede(index, { actief: checked })
                  }
                />
                <Label htmlFor={`trede-actief-${index}`} className="text-xs">
                  Actief
                </Label>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={() => verwijderTrede(index)}
                disabled={treden.length <= 1}
                title="Trede verwijderen"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={voegTredeToe}
            disabled={treden.length >= MAX_TREDEN}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Trede toevoegen (max {MAX_TREDEN})
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Eigenaar van interne taken</Label>
          <Select value={taakEigenaarId} onValueChange={setTaakEigenaarId}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder="Kies een kantoor-gebruiker" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                Standaard (bedrijfseigenaar)
              </SelectItem>
              {(kantoorGebruikers ?? []).map((gebruiker) => (
                <SelectItem key={gebruiker._id} value={gebruiker._id}>
                  {gebruiker.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Taak-treden (bijv. dag 28: bellen/aanmaning) komen op het
            cases-bord te staan met deze eigenaar.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Ladder opslaan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
