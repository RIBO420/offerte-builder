"use client";

import type { UseFormReturn } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Info } from "lucide-react";
import type { GazonanalyseFormData } from "./schema";

interface AanbevelingenSectieProps {
  form: UseFormReturn<GazonanalyseFormData>;
  toonDrainage: boolean;
  toonBekalken: boolean;
  toonBeregeningsadvies: boolean;
  aanbevelingen: GazonanalyseFormData["aanbevelingen"];
}

export function AanbevelingenSectie({
  form,
  toonDrainage,
  toonBekalken,
  toonBeregeningsadvies,
  aanbevelingen,
}: AanbevelingenSectieProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Aanvullende aanbevelingen</CardTitle>
        <CardDescription className="text-xs">
          Optionele adviezen en aanvullende diensten
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Drainage — alleen tonen als wateroverlast is aangevinkt */}
        {toonDrainage && (
          <FormField
            control={form.control}
            name="aanbevelingen.drainageAanleggen"
            render={({ field }) => (
              <FormItem className="flex items-start justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 gap-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-medium">
                    Drainage aanleggen
                  </FormLabel>
                  <FormDescription className="text-xs">
                    Aanbevolen bij wateroverlast — afvoerpijpen of
                    drainagemat verbeteren afwatering.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        {/* Bekalken — alleen tonen als verzuring is aangevinkt */}
        {toonBekalken && (
          <FormField
            control={form.control}
            name="aanbevelingen.bekalken"
            render={({ field }) => (
              <FormItem className="flex items-start justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 gap-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-medium">
                    Bekalken
                  </FormLabel>
                  <FormDescription className="text-xs">
                    Aanbevolen bij verzuring — kalk neutraliseert de
                    bodemzuurgraad (pH verhogen).
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        {/* Beregeningsadvies — alleen tonen als verdroging is aangevinkt */}
        {toonBeregeningsadvies && (
          <FormField
            control={form.control}
            name="aanbevelingen.beregeningsadvies"
            render={({ field }) => (
              <FormItem className="flex items-start justify-between rounded-lg border border-cyan-200 bg-cyan-50 p-3 gap-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-medium">
                    Beregeningsadvies
                  </FormLabel>
                  <FormDescription className="text-xs">
                    Aanbevolen bij verdroging — advies over optimale
                    bevloeiingsfrequentie en hoeveelheid.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        {/* Robotmaaier advies — altijd zichtbaar (upsell) */}
        <FormField
          control={form.control}
          name="aanbevelingen.robotmaaierAdvies"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <div className="flex items-start justify-between rounded-lg border p-3 gap-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-medium">
                    Robotmaaier advies
                  </FormLabel>
                  <FormDescription className="text-xs">
                    Advies over aanschaf en installatie van een robotmaaier.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </div>

              {/* Info card wanneer robotmaaier advies actief is */}
              {aanbevelingen.robotmaaierAdvies && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex gap-2">
                  <Info className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-green-800">
                    <span className="font-semibold">Robotmaaier tip:</span>{" "}
                    Een robotmaaier maait dagelijks kleine stukjes — het
                    gazon wordt er beter van! Kort gras stimuleert
                    uitstoeling en houdt onkruid en mos op afstand.
                  </p>
                </div>
              )}
            </FormItem>
          )}
        />

        {/* Samenvatting actieve aanbevelingen */}
        {(aanbevelingen.drainageAanleggen ||
          aanbevelingen.bekalken ||
          aanbevelingen.beregeningsadvies ||
          aanbevelingen.robotmaaierAdvies) && (
          <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
            <span className="font-medium">Actieve aanbevelingen:</span>{" "}
            {[
              aanbevelingen.drainageAanleggen && "drainage",
              aanbevelingen.bekalken && "bekalken",
              aanbevelingen.beregeningsadvies && "beregeningsadvies",
              aanbevelingen.robotmaaierAdvies && "robotmaaier advies",
            ]
              .filter(Boolean)
              .join(", ")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
