"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Shovel } from "lucide-react";
import type { GrondwerkData } from "@/types/offerte";

interface GrondwerkFormProps {
  data: GrondwerkData;
  onChange: (data: GrondwerkData) => void;
}

export function GrondwerkForm({ data, onChange }: GrondwerkFormProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shovel className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Grondwerk</CardTitle>
        </div>
        <CardDescription>
          Ontgraven, afvoer en machine-uren
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="grondwerk-oppervlakte">Oppervlakte (m²) *</Label>
            <Input
              id="grondwerk-oppervlakte"
              type="number"
              min="0"
              step="0.1"
              value={data.oppervlakte || ""}
              onChange={(e) => onChange({ ...data, oppervlakte: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="grondwerk-diepte">Diepte *</Label>
            <Select
              value={data.diepte}
              onValueChange={(v) => onChange({ ...data, diepte: v as GrondwerkData["diepte"] })}
            >
              <SelectTrigger id="grondwerk-diepte">
                <SelectValue placeholder="Selecteer diepte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="licht">Licht (0-15 cm)</SelectItem>
                <SelectItem value="standaard">Standaard (15-30 cm)</SelectItem>
                <SelectItem value="zwaar">Zwaar (30+ cm)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Diepte bepaalt de benodigde machine-uren en arbeid
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="grondwerk-afvoer">Afvoer grond</Label>
            <p className="text-sm text-muted-foreground">
              Grond afvoeren naar depot (extra kosten)
            </p>
          </div>
          <Switch
            id="grondwerk-afvoer"
            checked={data.afvoerGrond}
            onCheckedChange={(checked) => onChange({ ...data, afvoerGrond: checked })}
          />
        </div>

        {data.afvoerGrond && data.oppervlakte > 0 && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            Geschatte afvoer: {(data.oppervlakte * (data.diepte === "licht" ? 0.15 : data.diepte === "standaard" ? 0.25 : 0.40)).toFixed(1)} m³
          </div>
        )}
      </CardContent>
    </Card>
  );
}
