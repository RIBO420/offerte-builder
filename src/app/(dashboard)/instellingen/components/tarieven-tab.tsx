"use client";

import { m } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Save, Loader2 } from "lucide-react";
import type { TarievenState, ScopeMargesState } from "./types";

interface TarievenTabProps {
  tarieven: TarievenState;
  setTarieven: (tarieven: TarievenState) => void;
  scopeMarges: ScopeMargesState;
  setScopeMarges: (marges: ScopeMargesState) => void;
  isSaving: boolean;
  onSave: () => void;
  reducedMotion: boolean;
}

export function TarievenTab({
  tarieven,
  setTarieven,
  scopeMarges,
  setScopeMarges,
  isSaving,
  onSave,
  reducedMotion,
}: TarievenTabProps) {
  return (
    <m.div
      key="tarieven"
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
    >
      <TabsContent value="tarieven" className="space-y-4" forceMount>
        <Card>
          <CardHeader>
            <CardTitle>Tarieven</CardTitle>
            <CardDescription>
              Stel je uurtarieven en standaard marges in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="uurtarief">Uurtarief</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">
                    &euro;
                  </span>
                  <Input
                    id="uurtarief"
                    type="number"
                    step="0.01"
                    className="pl-7"
                    placeholder="45.00"
                    value={tarieven.uurtarief}
                    onChange={(e) =>
                      setTarieven({ ...tarieven, uurtarief: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Standaard uurtarief voor arbeid
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="marge">Standaard marge</Label>
                <div className="relative">
                  <Input
                    id="marge"
                    type="number"
                    step="1"
                    className="pr-7"
                    placeholder="15"
                    value={tarieven.standaardMargePercentage}
                    onChange={(e) =>
                      setTarieven({
                        ...tarieven,
                        standaardMargePercentage: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <span className="absolute right-3 top-2.5 text-muted-foreground">
                    %
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Marge bovenop kostenprijs
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="btw">BTW percentage</Label>
                <div className="relative">
                  <Input
                    id="btw"
                    type="number"
                    step="1"
                    className="pr-7"
                    placeholder="21"
                    value={tarieven.btwPercentage}
                    onChange={(e) =>
                      setTarieven({
                        ...tarieven,
                        btwPercentage: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <span className="absolute right-3 top-2.5 text-muted-foreground">
                    %
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Standaard BTW tarief
                </p>
              </div>
            </div>

            {/* Scope Marges Section */}
            <div className="pt-4 border-t">
              <div className="mb-3">
                <h4 className="text-sm font-medium">Marge per scope</h4>
                <p className="text-xs text-muted-foreground">
                  Optioneel: stel verschillende marges in per type werkzaamheid. Laat leeg voor standaard marge.
                </p>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-medium text-muted-foreground">Aanleg</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { key: "grondwerk", label: "Grondwerk" },
                    { key: "bestrating", label: "Bestrating" },
                    { key: "borders", label: "Borders" },
                    { key: "gras", label: "Gazon" },
                    { key: "houtwerk", label: "Houtwerk" },
                    { key: "water_elektra", label: "Verlichting" },
                    { key: "specials", label: "Specials" },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={`marge-${key}`} className="text-xs">{label}</Label>
                      <div className="relative">
                        <Input
                          id={`marge-${key}`}
                          type="number"
                          step="1"
                          className="h-8 text-sm pr-6"
                          placeholder={String(tarieven.standaardMargePercentage)}
                          value={scopeMarges[key as keyof ScopeMargesState] ?? ""}
                          onChange={(e) =>
                            setScopeMarges({
                              ...scopeMarges,
                              [key]: e.target.value ? parseInt(e.target.value) : undefined,
                            })
                          }
                        />
                        <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-xs font-medium text-muted-foreground pt-2">Onderhoud</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { key: "gras_onderhoud", label: "Gras" },
                    { key: "borders_onderhoud", label: "Borders" },
                    { key: "heggen", label: "Heggen" },
                    { key: "bomen", label: "Bomen" },
                    { key: "overig", label: "Overig" },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={`marge-${key}`} className="text-xs">{label}</Label>
                      <div className="relative">
                        <Input
                          id={`marge-${key}`}
                          type="number"
                          step="1"
                          className="h-8 text-sm pr-6"
                          placeholder={String(tarieven.standaardMargePercentage)}
                          value={scopeMarges[key as keyof ScopeMargesState] ?? ""}
                          onChange={(e) =>
                            setScopeMarges({
                              ...scopeMarges,
                              [key]: e.target.value ? parseInt(e.target.value) : undefined,
                            })
                          }
                        />
                        <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={onSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Opslaan
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </m.div>
  );
}
