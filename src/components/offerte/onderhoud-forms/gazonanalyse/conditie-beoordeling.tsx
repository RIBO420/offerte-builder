"use client";

import type { UseFormReturn } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Sprout } from "lucide-react";
import type { GazonanalyseFormData, ScoreInfo } from "./schema";
import { SCORE_INFO } from "./schema";

// Score-gradient track
function ScoreColorBar({ score }: { score: number }) {
  const percentage = ((score - 1) / 4) * 100;
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-500">
      <div
        className="h-full rounded-full bg-transparent outline outline-2 outline-white"
        style={{ width: `${percentage}%`, minWidth: "0.5rem" }}
      />
    </div>
  );
}

interface ConditieBeoordelingProps {
  form: UseFormReturn<GazonanalyseFormData>;
  score: number;
  scoreInfo: ScoreInfo;
}

export function ConditieBeoordeling({ form, score, scoreInfo }: ConditieBeoordelingProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sprout className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Gazonbeoordeling</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Beoordeel de huidige conditie van het gazon (1-5)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <FormField
          control={form.control}
          name="conditieScore"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between mb-1">
                <FormLabel className="text-sm font-medium">
                  Algehele conditie
                </FormLabel>
                <div className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden>
                    {scoreInfo.emoji}
                  </span>
                  <Badge
                    variant="outline"
                    className={`${scoreInfo.colorClass} border-current font-bold`}
                  >
                    {field.value} / 5
                  </Badge>
                </div>
              </div>

              {/* Score indicator */}
              <div
                className={`rounded-lg border p-3 ${scoreInfo.bgClass} ${scoreInfo.borderClass}`}
              >
                <p className={`text-sm font-medium ${scoreInfo.colorClass}`}>
                  {scoreInfo.label}
                </p>
                <ScoreColorBar score={field.value} />
              </div>

              {/* Slider */}
              <FormControl>
                <div className="px-1 pt-3">
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    value={[field.value]}
                    onValueChange={(vals) => field.onChange(vals[0])}
                    aria-label="Conditiescore gazon"
                  />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>1 — Zeer slecht</span>
                    <span>5 — Uitstekend</span>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
