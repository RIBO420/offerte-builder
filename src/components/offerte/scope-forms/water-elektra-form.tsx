"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Zap, AlertTriangle } from "lucide-react";
import type { WaterElektraData } from "@/types/offerte";

interface WaterElektraFormProps {
  data: WaterElektraData;
  onChange: (data: WaterElektraData) => void;
}

export function WaterElektraForm({ data, onChange }: WaterElektraFormProps) {
  const heeftElektra = data.verlichting !== "geen" || data.aantalPunten > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Water / Elektra</CardTitle>
          </div>
          <CardDescription>
            Tuinverlichting, aansluitpunten en bekabeling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="elektra-verlichting">Verlichting *</Label>
              <Select
                value={data.verlichting}
                onValueChange={(v) => onChange({ ...data, verlichting: v as WaterElektraData["verlichting"] })}
              >
                <SelectTrigger id="elektra-verlichting">
                  <SelectValue placeholder="Selecteer niveau" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geen">Geen verlichting</SelectItem>
                  <SelectItem value="basis">Basis (1-3 armaturen)</SelectItem>
                  <SelectItem value="uitgebreid">Uitgebreid (4+ armaturen)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sfeer- en functionele verlichting
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="elektra-punten">Aantal aansluitpunten</Label>
              <Input
                id="elektra-punten"
                type="number"
                min="0"
                max="20"
                step="1"
                value={data.aantalPunten || ""}
                onChange={(e) => onChange({ ...data, aantalPunten: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Stopcontacten, waterpunten, etc.
              </p>
            </div>
          </div>

          {!heeftElektra && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              Selecteer verlichting of voeg aansluitpunten toe om elektra-werkzaamheden toe te voegen aan de offerte.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verplichte sleuven sectie - alleen tonen als er elektra is */}
      {heeftElektra && (
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-orange-900 dark:text-orange-100">Sleuven & Herstel (Verplicht)</CardTitle>
            </div>
            <CardDescription className="text-orange-700 dark:text-orange-300">
              Elektra zonder sleufwerk en herstel is niet toegestaan in het systeem
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="default" className="border-orange-300 bg-orange-100/50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-900">Automatisch inbegrepen</AlertTitle>
              <AlertDescription className="text-orange-700">
                Sleufwerk voor bekabeling en herstel van bestrating/grond worden automatisch meegenomen in de offerte.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-white p-4 dark:border-orange-800 dark:bg-orange-950/30">
                <div className="space-y-0.5">
                  <Label className="text-base">Sleuven graven</Label>
                  <p className="text-sm text-muted-foreground">
                    Verplicht voor veilige bekabeling
                  </p>
                </div>
                <span className="text-sm font-medium text-orange-600">Inbegrepen</span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-white p-4 dark:border-orange-800 dark:bg-orange-950/30">
                <div className="space-y-0.5">
                  <Label className="text-base">Herstelwerk</Label>
                  <p className="text-sm text-muted-foreground">
                    Dichten sleuven, herstel bestrating/gras
                  </p>
                </div>
                <span className="text-sm font-medium text-orange-600">Inbegrepen</span>
              </div>
            </div>

            <div className="rounded-lg bg-white p-3 text-sm text-muted-foreground dark:bg-orange-950/30">
              <div className="font-medium mb-1">Automatisch berekend:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Sleuven: geschat op basis van {data.aantalPunten + (data.verlichting === "basis" ? 2 : data.verlichting === "uitgebreid" ? 5 : 0)} punten
                </li>
                <li>Bekabeling: ~{(data.aantalPunten + (data.verlichting === "basis" ? 2 : data.verlichting === "uitgebreid" ? 5 : 0)) * 8} m (schatting)</li>
                <li>Herstelwerk: afhankelijk van ondergrond</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
