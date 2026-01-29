"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Leaf } from "lucide-react";
import type { OverigeOnderhoudData } from "@/types/offerte";

interface OverigFormProps {
  data: OverigeOnderhoudData;
  onChange: (data: OverigeOnderhoudData) => void;
}

export function OverigForm({ data, onChange }: OverigFormProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Leaf className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Overige Werkzaamheden</CardTitle>
        </div>
        <CardDescription>
          Bladruimen, terras reinigen en overig onderhoud
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bladruimen */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="overig-bladruimen">Bladruimen</Label>
            <p className="text-sm text-muted-foreground">
              Seizoensgebonden bladverwijdering
            </p>
          </div>
          <Switch
            id="overig-bladruimen"
            checked={data.bladruimen}
            onCheckedChange={(checked: boolean) => onChange({ ...data, bladruimen: checked })}
          />
        </div>

        {/* Terras reinigen */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="overig-terras">Terras reinigen</Label>
              <p className="text-sm text-muted-foreground">
                Hogedruk reiniging van terras/bestrating
              </p>
            </div>
            <Switch
              id="overig-terras"
              checked={data.terrasReinigen}
              onCheckedChange={(checked: boolean) => onChange({ ...data, terrasReinigen: checked })}
            />
          </div>

          {data.terrasReinigen && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="overig-terras-opp">Terras oppervlakte (m²)</Label>
              <Input
                id="overig-terras-opp"
                type="number"
                min="0"
                step="0.1"
                value={data.terrasOppervlakte || ""}
                onChange={(e) => onChange({ ...data, terrasOppervlakte: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
          )}
        </div>

        {/* Onkruid bestrating */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="overig-onkruid">Onkruid tussen bestrating</Label>
              <p className="text-sm text-muted-foreground">
                Onkruid uit voegen verwijderen
              </p>
            </div>
            <Switch
              id="overig-onkruid"
              checked={data.onkruidBestrating}
              onCheckedChange={(checked: boolean) => onChange({ ...data, onkruidBestrating: checked })}
            />
          </div>

          {data.onkruidBestrating && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="overig-bestrating-opp">Bestrating oppervlakte (m²)</Label>
              <Input
                id="overig-bestrating-opp"
                type="number"
                min="0"
                step="0.1"
                value={data.bestratingOppervlakte || ""}
                onChange={(e) => onChange({ ...data, bestratingOppervlakte: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
          )}
        </div>

        {/* Afwatering controleren */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="overig-afwatering">Afwatering controleren</Label>
              <p className="text-sm text-muted-foreground">
                Controle en reiniging afvoerpunten
              </p>
            </div>
            <Switch
              id="overig-afwatering"
              checked={data.afwateringControleren}
              onCheckedChange={(checked: boolean) => onChange({ ...data, afwateringControleren: checked })}
            />
          </div>

          {data.afwateringControleren && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="overig-afwatering-punten">Aantal afwateringspunten</Label>
              <Input
                id="overig-afwatering-punten"
                type="number"
                min="0"
                step="1"
                value={data.aantalAfwateringspunten || ""}
                onChange={(e) => onChange({ ...data, aantalAfwateringspunten: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
          )}
        </div>

        {/* Overig vrij veld */}
        <div className="space-y-4 rounded-lg border p-4">
          <Label className="text-base font-medium">Overige werkzaamheden</Label>
          <div className="space-y-2">
            <Label htmlFor="overig-notities">Omschrijving</Label>
            <Textarea
              id="overig-notities"
              value={data.overigNotities || ""}
              onChange={(e) => onChange({ ...data, overigNotities: e.target.value })}
              placeholder="Beschrijf eventuele extra werkzaamheden..."
              rows={3}
            />
          </div>

          {data.overigNotities && (
            <div className="space-y-2">
              <Label htmlFor="overig-uren">Geschatte uren</Label>
              <Input
                id="overig-uren"
                type="number"
                min="0"
                step="0.25"
                value={data.overigUren || ""}
                onChange={(e) => onChange({ ...data, overigUren: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
          )}
        </div>

        {/* Indicatie */}
        {(data.bladruimen || data.terrasReinigen || data.onkruidBestrating || data.afwateringControleren) && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <div className="font-medium mb-1">Indicatie per beurt:</div>
            <ul className="list-disc list-inside space-y-1">
              {data.bladruimen && (
                <li>Bladruimen: afhankelijk van tuingrootte en seizoen</li>
              )}
              {data.terrasReinigen && data.terrasOppervlakte && data.terrasOppervlakte > 0 && (
                <li>Terras reinigen: ~{(data.terrasOppervlakte * 0.05).toFixed(1)} uur</li>
              )}
              {data.onkruidBestrating && data.bestratingOppervlakte && data.bestratingOppervlakte > 0 && (
                <li>Onkruid bestrating: ~{(data.bestratingOppervlakte * 0.03).toFixed(1)} uur</li>
              )}
              {data.afwateringControleren && data.aantalAfwateringspunten && data.aantalAfwateringspunten > 0 && (
                <li>Afwatering: ~{(0.25 + data.aantalAfwateringspunten * 0.1).toFixed(2)} uur</li>
              )}
              {data.overigUren && data.overigUren > 0 && (
                <li>Overig: {data.overigUren} uur</li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
