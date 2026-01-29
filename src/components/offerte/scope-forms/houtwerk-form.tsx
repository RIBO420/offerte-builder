"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Hammer, AlertTriangle } from "lucide-react";
import type { HoutwerkData } from "@/types/offerte";

interface HoutwerkFormProps {
  data: HoutwerkData;
  onChange: (data: HoutwerkData) => void;
}

export function HoutwerkForm({ data, onChange }: HoutwerkFormProps) {
  const getAfmetingLabel = () => {
    switch (data.typeHoutwerk) {
      case "schutting":
        return "Lengte (m) *";
      case "vlonder":
        return "Oppervlakte (m²) *";
      case "pergola":
        return "Oppervlakte (m²) *";
      default:
        return "Afmeting *";
    }
  };

  const getAfmetingPlaceholder = () => {
    switch (data.typeHoutwerk) {
      case "schutting":
        return "Lengte in meters";
      case "vlonder":
      case "pergola":
        return "Oppervlakte in m²";
      default:
        return "0";
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Hammer className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Houtwerk</CardTitle>
          </div>
          <CardDescription>
            Schutting, vlonder of pergola
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="houtwerk-type">Type houtwerk *</Label>
              <Select
                value={data.typeHoutwerk}
                onValueChange={(v) => onChange({ ...data, typeHoutwerk: v as HoutwerkData["typeHoutwerk"] })}
              >
                <SelectTrigger id="houtwerk-type">
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="schutting">Schutting</SelectItem>
                  <SelectItem value="vlonder">Vlonder</SelectItem>
                  <SelectItem value="pergola">Pergola</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="houtwerk-afmeting">{getAfmetingLabel()}</Label>
              <Input
                id="houtwerk-afmeting"
                type="number"
                min="0"
                step="0.1"
                value={data.afmeting || ""}
                onChange={(e) => onChange({ ...data, afmeting: parseFloat(e.target.value) || 0 })}
                placeholder={getAfmetingPlaceholder()}
              />
              <p className="text-xs text-muted-foreground">
                {data.typeHoutwerk === "schutting"
                  ? "Totale lengte van de schutting"
                  : "Totale oppervlakte"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verplichte fundering sectie */}
      <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-orange-900 dark:text-orange-100">Fundering (Verplicht)</CardTitle>
          </div>
          <CardDescription className="text-orange-700 dark:text-orange-300">
            Houtwerk zonder fundering is niet toegestaan in het systeem
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="default" className="border-orange-300 bg-orange-100/50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-900">Verplicht onderdeel</AlertTitle>
            <AlertDescription className="text-orange-700">
              De fundering wordt automatisch meegenomen in de offerte voor stabiel en duurzaam houtwerk.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="houtwerk-fundering">Fundering type *</Label>
            <Select
              value={data.fundering}
              onValueChange={(v) => onChange({ ...data, fundering: v as HoutwerkData["fundering"] })}
            >
              <SelectTrigger id="houtwerk-fundering">
                <SelectValue placeholder="Selecteer fundering" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standaard">Standaard (betonpoeren/paalvoeten)</SelectItem>
                <SelectItem value="zwaar">Zwaar (betonpoeren in beton gegoten)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {data.fundering === "zwaar"
                ? "Aanbevolen voor hoge schuttingen of slappe grond"
                : "Geschikt voor standaard constructies"}
            </p>
          </div>

          {data.afmeting > 0 && (
            <div className="rounded-lg bg-white p-3 text-sm text-muted-foreground dark:bg-orange-950/30">
              <div className="font-medium mb-1">Indicatie funderingswerk:</div>
              <ul className="list-disc list-inside space-y-1">
                {data.typeHoutwerk === "schutting" ? (
                  <>
                    <li>Aantal palen: ~{Math.ceil(data.afmeting / 1.8)} stuks</li>
                    <li>Betonpoeren: ~{Math.ceil(data.afmeting / 1.8)} stuks</li>
                  </>
                ) : data.typeHoutwerk === "vlonder" ? (
                  <>
                    <li>Regelwerk/balken: ~{(data.afmeting * 3).toFixed(0)} m</li>
                    <li>Ondersteunende poeren: ~{Math.ceil(data.afmeting / 0.6)} stuks</li>
                  </>
                ) : (
                  <>
                    <li>Staanders: ~4 stuks</li>
                    <li>Betonpoeren: ~4 stuks</li>
                  </>
                )}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
