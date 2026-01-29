"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TreeDeciduous } from "lucide-react";
import type { BomenOnderhoudData } from "@/types/offerte";

interface BomenFormProps {
  data: BomenOnderhoudData;
  onChange: (data: BomenOnderhoudData) => void;
}

export function BomenForm({ data, onChange }: BomenFormProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TreeDeciduous className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Bomen Onderhoud</CardTitle>
        </div>
        <CardDescription>
          Snoei van bomen per hoogteklasse
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="bomen-aantal">Aantal bomen *</Label>
          <Input
            id="bomen-aantal"
            type="number"
            min="0"
            step="1"
            value={data.aantalBomen || ""}
            onChange={(e) => onChange({ ...data, aantalBomen: parseInt(e.target.value) || 0 })}
            placeholder="0"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bomen-snoei">Snoei type *</Label>
            <Select
              value={data.snoei}
              onValueChange={(v) => onChange({ ...data, snoei: v as BomenOnderhoudData["snoei"] })}
            >
              <SelectTrigger id="bomen-snoei">
                <SelectValue placeholder="Selecteer snoei type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="licht">Licht (onderhoudssnoei)</SelectItem>
                <SelectItem value="zwaar">Zwaar (vormsnoei/verjonging)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {data.snoei === "zwaar"
                ? "Intensieve snoei voor vorm of verjonging"
                : "Regulier onderhoud en dood hout verwijderen"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bomen-hoogte">Hoogteklasse *</Label>
            <Select
              value={data.hoogteklasse}
              onValueChange={(v) => onChange({ ...data, hoogteklasse: v as BomenOnderhoudData["hoogteklasse"] })}
            >
              <SelectTrigger id="bomen-hoogte">
                <SelectValue placeholder="Selecteer hoogteklasse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="laag">Laag (&lt;4m, vanaf grond)</SelectItem>
                <SelectItem value="middel">Middel (4-8m, korte ladder)</SelectItem>
                <SelectItem value="hoog">Hoog (&gt;8m, hoogwerker/klimmen)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {data.hoogteklasse === "hoog"
                ? "Specialistisch werk, extra tijd en materieel"
                : data.hoogteklasse === "middel"
                  ? "Ladder nodig, matige toeslag"
                  : "Vanaf grond bereikbaar"}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="bomen-afvoer">Afvoer snoeihout</Label>
            <p className="text-sm text-muted-foreground">
              Takken en snoeihout afvoeren
            </p>
          </div>
          <Switch
            id="bomen-afvoer"
            checked={data.afvoer}
            onCheckedChange={(checked: boolean) => onChange({ ...data, afvoer: checked })}
          />
        </div>

        {data.aantalBomen > 0 && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <div className="font-medium mb-1">Indicatie per beurt:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Snoeitijd: ~{(data.aantalBomen * (
                  data.snoei === "zwaar" ? 1.5 : 0.75
                ) * (
                  data.hoogteklasse === "hoog" ? 2.0 :
                  data.hoogteklasse === "middel" ? 1.3 : 1.0
                )).toFixed(1)} uur
              </li>
              {data.afvoer && (
                <li>
                  Geschat snoeihout: ~{(data.aantalBomen * (data.snoei === "zwaar" ? 0.3 : 0.1)).toFixed(1)} m³
                </li>
              )}
              {data.hoogteklasse === "hoog" && (
                <li className="text-orange-600">
                  Hoogwerker of klimuitrusting nodig
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
