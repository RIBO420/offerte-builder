"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trees } from "lucide-react";
import type { GrasData } from "@/types/offerte";

interface GrasFormProps {
  data: GrasData;
  onChange: (data: GrasData) => void;
}

export function GrasForm({ data, onChange }: GrasFormProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trees className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Gras / Gazon</CardTitle>
        </div>
        <CardDescription>
          Zaaien of graszoden en ondergrondbewerking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gras-oppervlakte">Oppervlakte (m²) *</Label>
            <Input
              id="gras-oppervlakte"
              type="number"
              min="0"
              step="0.1"
              value={data.oppervlakte || ""}
              onChange={(e) => onChange({ ...data, oppervlakte: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gras-type">Type aanleg *</Label>
            <Select
              value={data.type}
              onValueChange={(v) => onChange({ ...data, type: v as GrasData["type"] })}
            >
              <SelectTrigger id="gras-type">
                <SelectValue placeholder="Selecteer type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zaaien">Zaaien</SelectItem>
                <SelectItem value="graszoden">Graszoden</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {data.type === "graszoden"
                ? "Direct resultaat, hogere kosten"
                : "Goedkoper, langer wachten op resultaat"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gras-ondergrond">Ondergrond *</Label>
          <Select
            value={data.ondergrond}
            onValueChange={(v) => onChange({ ...data, ondergrond: v as GrasData["ondergrond"] })}
          >
            <SelectTrigger id="gras-ondergrond">
              <SelectValue placeholder="Selecteer ondergrond" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bestaand">Bestaande ondergrond (opfrissen)</SelectItem>
              <SelectItem value="nieuw">Nieuwe ondergrond (egaliseren + bezanden)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {data.ondergrond === "nieuw"
              ? "Inclusief grondbewerking en egaliseren"
              : "Bestaande grond wordt licht bewerkt"}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="gras-afwatering">Afwatering nodig</Label>
            <p className="text-sm text-muted-foreground">
              Drainage aanleggen voor waterafvoer
            </p>
          </div>
          <Switch
            id="gras-afwatering"
            checked={data.afwateringNodig}
            onCheckedChange={(checked) => onChange({ ...data, afwateringNodig: checked })}
          />
        </div>

        {data.oppervlakte > 0 && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <div className="font-medium mb-1">Indicatie:</div>
            <ul className="list-disc list-inside space-y-1">
              {data.type === "zaaien" ? (
                <li>Graszaad: ~{(data.oppervlakte * 0.035).toFixed(1)} kg</li>
              ) : (
                <li>Graszoden: ~{data.oppervlakte} m² (+ 5% snijverlies)</li>
              )}
              {data.ondergrond === "nieuw" && (
                <li>Zand voor egaliseren: ~{(data.oppervlakte * 0.05).toFixed(1)} m³</li>
              )}
              {data.afwateringNodig && (
                <li>Drainageslangen: ~{Math.ceil(data.oppervlakte / 4)} m</li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
