"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Scissors, AlertTriangle } from "lucide-react";
import type { HeggenOnderhoudData } from "@/types/offerte";

interface HeggenFormProps {
  data: HeggenOnderhoudData;
  onChange: (data: HeggenOnderhoudData) => void;
}

export function HeggenForm({ data, onChange }: HeggenFormProps) {
  const volume = data.lengte * data.hoogte * data.breedte;
  const isVolumeComplete = data.lengte > 0 && data.hoogte > 0 && data.breedte > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Heggen Onderhoud</CardTitle>
        </div>
        <CardDescription>
          Snoei van heggen met volumeberekening
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="default" className="border-orange-300 bg-orange-50/50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-900">Verplichte velden</AlertTitle>
          <AlertDescription className="text-orange-700">
            Lengte, hoogte en breedte zijn alle drie verplicht voor een correcte volumeberekening.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="heg-lengte" className="flex items-center gap-2">
              Lengte (m) *
              <span className="text-xs text-orange-600 font-normal">(verplicht)</span>
            </Label>
            <Input
              id="heg-lengte"
              type="number"
              min="0"
              step="0.1"
              value={data.lengte || ""}
              onChange={(e) => onChange({ ...data, lengte: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="border-orange-300"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="heg-hoogte" className="flex items-center gap-2">
              Hoogte (m) *
              <span className="text-xs text-orange-600 font-normal">(verplicht)</span>
            </Label>
            <Input
              id="heg-hoogte"
              type="number"
              min="0"
              step="0.1"
              value={data.hoogte || ""}
              onChange={(e) => onChange({ ...data, hoogte: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="border-orange-300"
            />
            {data.hoogte > 2 && (
              <p className="text-xs text-orange-600">
                Hoogte &gt;2m: toeslag voor ladder/hoogwerker
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="heg-breedte" className="flex items-center gap-2">
              Breedte (m) *
              <span className="text-xs text-orange-600 font-normal">(verplicht)</span>
            </Label>
            <Input
              id="heg-breedte"
              type="number"
              min="0"
              step="0.1"
              value={data.breedte || ""}
              onChange={(e) => onChange({ ...data, breedte: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="border-orange-300"
            />
          </div>
        </div>

        {isVolumeComplete && (
          <div className="rounded-lg bg-primary/10 p-4 text-center">
            <p className="text-sm text-muted-foreground">Berekend volume</p>
            <p className="text-2xl font-bold">{volume.toFixed(1)} m³</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="heg-snoei">Snoei type *</Label>
          <Select
            value={data.snoei}
            onValueChange={(v) => onChange({ ...data, snoei: v as HeggenOnderhoudData["snoei"] })}
          >
            <SelectTrigger id="heg-snoei">
              <SelectValue placeholder="Selecteer snoei type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zijkanten">Alleen zijkanten</SelectItem>
              <SelectItem value="bovenkant">Alleen bovenkant</SelectItem>
              <SelectItem value="beide">Zijkanten én bovenkant</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {data.snoei === "beide"
              ? "Volledige snoei rondom"
              : data.snoei === "zijkanten"
                ? "Alleen de zijkanten bijwerken"
                : "Alleen de bovenkant egaliseren"}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="heg-afvoer">Afvoer snoeisel</Label>
            <p className="text-sm text-muted-foreground">
              Snoeiafval afvoeren naar depot
            </p>
          </div>
          <Switch
            id="heg-afvoer"
            checked={data.afvoerSnoeisel}
            onCheckedChange={(checked: boolean) => onChange({ ...data, afvoerSnoeisel: checked })}
          />
        </div>

        {isVolumeComplete && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <div className="font-medium mb-1">Indicatie per beurt:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Snoeitijd: ~{(volume * (
                  data.snoei === "beide" ? 0.5 :
                  data.snoei === "zijkanten" ? 0.35 : 0.25
                ) * (data.hoogte > 2 ? 1.3 : 1.0)).toFixed(1)} uur
              </li>
              {data.afvoerSnoeisel && (
                <li>
                  Geschat snoeiafval: ~{(volume * 0.1).toFixed(2)} m³
                </li>
              )}
              {data.hoogte > 2 && (
                <li className="text-orange-600">
                  Hoogte toeslag: +30% (ladder/hoogwerker nodig)
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
