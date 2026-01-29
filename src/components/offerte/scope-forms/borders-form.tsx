"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Flower2 } from "lucide-react";
import type { BordersData, Intensiteit } from "@/types/offerte";

interface BordersFormProps {
  data: BordersData;
  onChange: (data: BordersData) => void;
}

export function BordersForm({ data, onChange }: BordersFormProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Flower2 className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Borders & Beplanting</CardTitle>
        </div>
        <CardDescription>
          Grondbewerking, planten en afwerking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="borders-oppervlakte">Borderoppervlakte (m²) *</Label>
            <Input
              id="borders-oppervlakte"
              type="number"
              min="0"
              step="0.1"
              value={data.oppervlakte || ""}
              onChange={(e) => onChange({ ...data, oppervlakte: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="borders-intensiteit">Beplantingsintensiteit *</Label>
            <Select
              value={data.beplantingsintensiteit}
              onValueChange={(v) => onChange({ ...data, beplantingsintensiteit: v as Intensiteit })}
            >
              <SelectTrigger id="borders-intensiteit">
                <SelectValue placeholder="Selecteer intensiteit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weinig">Weinig (3-5 planten/m²)</SelectItem>
                <SelectItem value="gemiddeld">Gemiddeld (5-8 planten/m²)</SelectItem>
                <SelectItem value="veel">Veel (8-12 planten/m²)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Bepaalt aantal planten en arbeidsuren
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="borders-afwerking">Afwerking *</Label>
          <Select
            value={data.afwerking}
            onValueChange={(v) => onChange({ ...data, afwerking: v as BordersData["afwerking"] })}
          >
            <SelectTrigger id="borders-afwerking">
              <SelectValue placeholder="Selecteer afwerking" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="geen">Geen afwerking</SelectItem>
              <SelectItem value="schors">Schors (boomschors)</SelectItem>
              <SelectItem value="grind">Siergrint</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="borders-bodemverbetering">Bodemverbetering</Label>
            <p className="text-sm text-muted-foreground">
              Compost/turfmolm toevoegen voor betere groei
            </p>
          </div>
          <Switch
            id="borders-bodemverbetering"
            checked={data.bodemverbetering}
            onCheckedChange={(checked) => onChange({ ...data, bodemverbetering: checked })}
          />
        </div>

        {data.oppervlakte > 0 && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <div className="font-medium mb-1">Indicatie:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Aantal planten: ~{Math.round(data.oppervlakte * (
                  data.beplantingsintensiteit === "weinig" ? 4 :
                  data.beplantingsintensiteit === "gemiddeld" ? 6.5 : 10
                ))} stuks
              </li>
              {data.afwerking !== "geen" && (
                <li>
                  {data.afwerking === "schors" ? "Schors" : "Siergrint"}: ~{(data.oppervlakte * 0.05).toFixed(1)} m³
                </li>
              )}
              {data.bodemverbetering && (
                <li>Bodemverbeteraar: ~{(data.oppervlakte * 0.03).toFixed(1)} m³</li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
