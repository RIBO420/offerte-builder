"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, Trash2 } from "lucide-react";
import type { SpecialsData } from "@/types/offerte";

interface SpecialsFormProps {
  data: SpecialsData;
  onChange: (data: SpecialsData) => void;
}

type SpecialItemType = "jacuzzi" | "sauna" | "prefab";

export function SpecialsForm({ data, onChange }: SpecialsFormProps) {
  const [newItemType, setNewItemType] = useState<SpecialItemType>("prefab");
  const [newItemOmschrijving, setNewItemOmschrijving] = useState("");

  const addItem = () => {
    if (!newItemOmschrijving.trim()) return;

    onChange({
      items: [
        ...data.items,
        {
          type: newItemType,
          omschrijving: newItemOmschrijving.trim(),
        },
      ],
    });
    setNewItemOmschrijving("");
  };

  const removeItem = (index: number) => {
    onChange({
      items: data.items.filter((_, i) => i !== index),
    });
  };

  const getTypeLabel = (type: SpecialItemType) => {
    switch (type) {
      case "jacuzzi":
        return "Jacuzzi";
      case "sauna":
        return "Sauna";
      case "prefab":
        return "Prefab element";
      default:
        return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Specials</CardTitle>
        </div>
        <CardDescription>
          Bijzondere elementen zoals jacuzzi, sauna of prefab constructies
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bestaande items */}
        {data.items.length > 0 && (
          <div className="space-y-3">
            <Label>Toegevoegde items</Label>
            <div className="space-y-2">
              {data.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-muted px-2 py-1 text-xs font-medium">
                      {getTypeLabel(item.type)}
                    </span>
                    <span className="text-sm">{item.omschrijving}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nieuw item toevoegen */}
        <div className="space-y-4 rounded-lg border border-dashed p-4">
          <Label className="text-base font-medium">Nieuw item toevoegen</Label>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="special-type">Type</Label>
              <Select
                value={newItemType}
                onValueChange={(v) => setNewItemType(v as SpecialItemType)}
              >
                <SelectTrigger id="special-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jacuzzi">Jacuzzi</SelectItem>
                  <SelectItem value="sauna">Sauna</SelectItem>
                  <SelectItem value="prefab">Prefab element</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="special-omschrijving">Omschrijving</Label>
              <Input
                id="special-omschrijving"
                value={newItemOmschrijving}
                onChange={(e) => setNewItemOmschrijving(e.target.value)}
                placeholder="Bijv. 'Lay-Z-Spa Helsinki'"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={addItem}
            disabled={!newItemOmschrijving.trim()}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Item toevoegen
          </Button>
        </div>

        {data.items.length === 0 && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            Voeg bijzondere elementen toe die alleen plaatsing en voorbereiding vereisen.
            De kosten voor materiaal/aanschaf worden apart gespecificeerd.
          </div>
        )}

        {data.items.length > 0 && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <div className="font-medium mb-1">Inbegrepen per item:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>Voorbereiding ondergrond</li>
              <li>Plaatsingsuren</li>
              <li>Aansluiten (indien van toepassing)</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
