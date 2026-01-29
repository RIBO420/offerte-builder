"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Flower2, AlertTriangle } from "lucide-react";
import type { BordersOnderhoudData, Intensiteit } from "@/types/offerte";

interface BordersOnderhoudFormProps {
  data: BordersOnderhoudData;
  onChange: (data: BordersOnderhoudData) => void;
}

export function BordersOnderhoudForm({ data, onChange }: BordersOnderhoudFormProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Flower2 className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Borders Onderhoud</CardTitle>
        </div>
        <CardDescription>
          Wieden, snoei in borders en bodemonderhoud
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="default" className="border-orange-300 bg-orange-50/50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-900">Verplicht veld</AlertTitle>
          <AlertDescription className="text-orange-700">
            Onderhoudsintensiteit is verplicht voor een correcte urenberekening.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="border-oppervlakte">Borderoppervlakte (m²) *</Label>
            <Input
              id="border-oppervlakte"
              type="number"
              min="0"
              step="0.1"
              value={data.borderOppervlakte || ""}
              onChange={(e) => onChange({ ...data, borderOppervlakte: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="border-intensiteit" className="flex items-center gap-2">
              Onderhoudsintensiteit *
              <span className="text-xs text-orange-600 font-normal">(verplicht)</span>
            </Label>
            <Select
              value={data.onderhoudsintensiteit}
              onValueChange={(v) => onChange({ ...data, onderhoudsintensiteit: v as Intensiteit })}
            >
              <SelectTrigger id="border-intensiteit" className="border-orange-300">
                <SelectValue placeholder="Selecteer intensiteit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weinig">Weinig (lage beplantingsdichtheid)</SelectItem>
                <SelectItem value="gemiddeld">Gemiddeld</SelectItem>
                <SelectItem value="veel">Veel (hoge beplantingsdichtheid)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Bepaalt de benodigde uren voor onderhoud
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="border-snoei">Snoei in borders</Label>
            <Select
              value={data.snoeiInBorders}
              onValueChange={(v) => onChange({ ...data, snoeiInBorders: v as BordersOnderhoudData["snoeiInBorders"] })}
            >
              <SelectTrigger id="border-snoei">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="geen">Geen snoei</SelectItem>
                <SelectItem value="licht">Licht (uitgebloeide bloemen)</SelectItem>
                <SelectItem value="zwaar">Zwaar (vormgeven struiken)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="border-bodem">Bodem type</Label>
            <Select
              value={data.bodem}
              onValueChange={(v) => onChange({ ...data, bodem: v as BordersOnderhoudData["bodem"] })}
            >
              <SelectTrigger id="border-bodem">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open grond (meer wieden)</SelectItem>
                <SelectItem value="bedekt">Bedekt (schors/grind)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {data.bodem === "open"
                ? "Open grond vereist meer wiedwerk"
                : "Bodembedekking vermindert onkruid"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="border-onkruid">Onkruid verwijderen</Label>
              <p className="text-sm text-muted-foreground">
                Wieden en onkruid bestrijden
              </p>
            </div>
            <Switch
              id="border-onkruid"
              checked={data.onkruidVerwijderen}
              onCheckedChange={(checked: boolean) => onChange({ ...data, onkruidVerwijderen: checked })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="border-afvoer">Afvoer groenafval</Label>
              <p className="text-sm text-muted-foreground">
                Snoeisel en onkruid afvoeren
              </p>
            </div>
            <Switch
              id="border-afvoer"
              checked={data.afvoerGroenafval}
              onCheckedChange={(checked: boolean) => onChange({ ...data, afvoerGroenafval: checked })}
            />
          </div>
        </div>

        {data.borderOppervlakte > 0 && data.onderhoudsintensiteit && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <div className="font-medium mb-1">Indicatie per beurt:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Onderhoud: ~{(data.borderOppervlakte * (
                  data.onderhoudsintensiteit === "weinig" ? 0.05 :
                  data.onderhoudsintensiteit === "gemiddeld" ? 0.08 : 0.12
                ) * (data.bodem === "open" ? 1.3 : 1.0)).toFixed(1)} uur
              </li>
              {data.snoeiInBorders !== "geen" && (
                <li>
                  Snoei: ~{(data.borderOppervlakte * (data.snoeiInBorders === "licht" ? 0.02 : 0.05)).toFixed(1)} uur
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
