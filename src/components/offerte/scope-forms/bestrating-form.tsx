"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Layers, AlertTriangle } from "lucide-react";
import type { BestratingData, Snijwerk } from "@/types/offerte";

interface BestratingFormProps {
  data: BestratingData;
  onChange: (data: BestratingData) => void;
}

export function BestratingForm({ data, onChange }: BestratingFormProps) {
  const updateOnderbouw = (updates: Partial<BestratingData["onderbouw"]>) => {
    onChange({
      ...data,
      onderbouw: { ...data.onderbouw, ...updates },
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Bestrating</CardTitle>
          </div>
          <CardDescription>
            Tegels, klinkers of natuursteen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="bestrating-oppervlakte">Oppervlakte (m²) *</Label>
              <Input
                id="bestrating-oppervlakte"
                type="number"
                min="0"
                step="0.1"
                value={data.oppervlakte || ""}
                onChange={(e) => onChange({ ...data, oppervlakte: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bestrating-type">Type bestrating *</Label>
              <Select
                value={data.typeBestrating}
                onValueChange={(v) => onChange({ ...data, typeBestrating: v as BestratingData["typeBestrating"] })}
              >
                <SelectTrigger id="bestrating-type">
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tegel">Tegels</SelectItem>
                  <SelectItem value="klinker">Klinkers</SelectItem>
                  <SelectItem value="natuursteen">Natuursteen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bestrating-snijwerk">Snijwerk *</Label>
              <Select
                value={data.snijwerk}
                onValueChange={(v) => onChange({ ...data, snijwerk: v as Snijwerk })}
              >
                <SelectTrigger id="bestrating-snijwerk">
                  <SelectValue placeholder="Selecteer niveau" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="laag">Laag (weinig hoeken)</SelectItem>
                  <SelectItem value="gemiddeld">Gemiddeld</SelectItem>
                  <SelectItem value="hoog">Hoog (veel rondingen/hoeken)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Meer snijwerk = hogere arbeidsfactor
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verplichte onderbouw sectie */}
      <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-orange-900 dark:text-orange-100">Onderbouw (Verplicht)</CardTitle>
          </div>
          <CardDescription className="text-orange-700 dark:text-orange-300">
            Bestrating zonder onderbouw is niet toegestaan in het systeem
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="default" className="border-orange-300 bg-orange-100/50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-900">Verplicht onderdeel</AlertTitle>
            <AlertDescription className="text-orange-700">
              De onderbouw wordt automatisch meegenomen in de offerte om een professioneel resultaat te garanderen.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="onderbouw-type">Onderbouw type *</Label>
              <Select
                value={data.onderbouw.type}
                onValueChange={(v) => updateOnderbouw({ type: v as BestratingData["onderbouw"]["type"] })}
              >
                <SelectTrigger id="onderbouw-type">
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zandbed">Zandbed</SelectItem>
                  <SelectItem value="zand_fundering">Zand + fundering</SelectItem>
                  <SelectItem value="zware_fundering">Zware fundering</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="onderbouw-dikte">Dikte onderlaag (cm) *</Label>
              <Input
                id="onderbouw-dikte"
                type="number"
                min="0"
                max="50"
                step="1"
                value={data.onderbouw.dikteOnderlaag || ""}
                onChange={(e) => updateOnderbouw({ dikteOnderlaag: parseInt(e.target.value) || 0 })}
                placeholder="5"
              />
              <p className="text-xs text-muted-foreground">
                Standaard: 5cm zand
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-white p-4 dark:border-orange-800 dark:bg-orange-950/30">
            <div className="space-y-0.5">
              <Label htmlFor="onderbouw-opsluitbanden">Opsluitbanden</Label>
              <p className="text-sm text-muted-foreground">
                Randafwerking met betonnen opsluitbanden
              </p>
            </div>
            <Switch
              id="onderbouw-opsluitbanden"
              checked={data.onderbouw.opsluitbanden}
              onCheckedChange={(checked) => updateOnderbouw({ opsluitbanden: checked })}
            />
          </div>

          {data.oppervlakte > 0 && data.onderbouw.dikteOnderlaag > 0 && (
            <div className="rounded-lg bg-white p-3 text-sm text-muted-foreground dark:bg-orange-950/30">
              Geschat zandvolume: {(data.oppervlakte * (data.onderbouw.dikteOnderlaag / 100)).toFixed(2)} m³
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
