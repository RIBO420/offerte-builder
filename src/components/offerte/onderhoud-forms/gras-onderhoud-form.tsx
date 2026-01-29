"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trees } from "lucide-react";
import type { GrasOnderhoudData } from "@/types/offerte";

interface GrasOnderhoudFormProps {
  data: GrasOnderhoudData;
  onChange: (data: GrasOnderhoudData) => void;
}

export function GrasOnderhoudForm({ data, onChange }: GrasOnderhoudFormProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trees className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Gras Onderhoud</CardTitle>
        </div>
        <CardDescription>
          Maaien, kanten steken en verticuteren
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="gras-aanwezig">Gras aanwezig</Label>
            <p className="text-sm text-muted-foreground">
              Is er gazon in de tuin?
            </p>
          </div>
          <Switch
            id="gras-aanwezig"
            checked={data.grasAanwezig}
            onCheckedChange={(checked: boolean) => onChange({ ...data, grasAanwezig: checked })}
          />
        </div>

        {data.grasAanwezig && (
          <>
            <div className="space-y-2">
              <Label htmlFor="gras-oppervlakte">Grasoppervlakte (m²) *</Label>
              <Input
                id="gras-oppervlakte"
                type="number"
                min="0"
                step="0.1"
                value={data.grasOppervlakte || ""}
                onChange={(e) => onChange({ ...data, grasOppervlakte: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">Werkzaamheden</Label>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="gras-maaien">Maaien</Label>
                  <p className="text-sm text-muted-foreground">
                    Regelmatig gazon maaien
                  </p>
                </div>
                <Switch
                  id="gras-maaien"
                  checked={data.maaien}
                  onCheckedChange={(checked: boolean) => onChange({ ...data, maaien: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="gras-kanten">Kanten steken</Label>
                  <p className="text-sm text-muted-foreground">
                    Randen van het gazon bijwerken
                  </p>
                </div>
                <Switch
                  id="gras-kanten"
                  checked={data.kantenSteken}
                  onCheckedChange={(checked: boolean) => onChange({ ...data, kantenSteken: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="gras-verticuteren">Verticuteren</Label>
                  <p className="text-sm text-muted-foreground">
                    Mos en vilt verwijderen (optioneel, 1-2x per jaar)
                  </p>
                </div>
                <Switch
                  id="gras-verticuteren"
                  checked={data.verticuteren}
                  onCheckedChange={(checked: boolean) => onChange({ ...data, verticuteren: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="gras-afvoer">Afvoer gras</Label>
                  <p className="text-sm text-muted-foreground">
                    Maaisel afvoeren (anders mulchen)
                  </p>
                </div>
                <Switch
                  id="gras-afvoer"
                  checked={data.afvoerGras}
                  onCheckedChange={(checked: boolean) => onChange({ ...data, afvoerGras: checked })}
                />
              </div>
            </div>

            {data.grasOppervlakte > 0 && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <div className="font-medium mb-1">Indicatie per beurt:</div>
                <ul className="list-disc list-inside space-y-1">
                  {data.maaien && (
                    <li>Maaien: ~{(data.grasOppervlakte * 0.02).toFixed(1)} uur</li>
                  )}
                  {data.kantenSteken && (
                    <li>Kanten steken: ~{(Math.sqrt(data.grasOppervlakte) * 4 * 0.01).toFixed(1)} uur</li>
                  )}
                  {data.verticuteren && (
                    <li>Verticuteren: ~{(data.grasOppervlakte * 0.03).toFixed(1)} uur</li>
                  )}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
