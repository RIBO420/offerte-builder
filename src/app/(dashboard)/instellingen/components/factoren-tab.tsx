"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Save, Loader2, RotateCcw, Sliders } from "lucide-react";
import { typeLabels, waardeLabels } from "./constants";
import type { Correctiefactor } from "./types";
import { LaadIndicator } from "@/components/ui/laad-indicator";

interface FactorenTabProps {
  filteredFactoren: Correctiefactor[];
  types: string[];
  activeType: string;
  setActiveType: (type: string) => void;
  isFactorenLoading: boolean | null | undefined;
  editingFactor: Correctiefactor | null;
  factorValue: number;
  setFactorValue: (value: number) => void;
  isSaving: boolean;
  onEditFactor: (factor: Correctiefactor) => void;
  onSaveFactor: () => void;
  onCancelEdit: () => void;
  onResetFactor: (factor: Correctiefactor) => void;
}

export function FactorenTab({
  filteredFactoren,
  types,
  activeType,
  setActiveType,
  isFactorenLoading,
  editingFactor,
  factorValue,
  setFactorValue,
  isSaving,
  onEditFactor,
  onSaveFactor,
  onCancelEdit,
  onResetFactor,
}: FactorenTabProps) {
  return (
    <div>
      <TabsContent value="factoren" className="space-y-4" forceMount>
        <Card>
          <CardHeader>
            <CardTitle>Correctiefactoren</CardTitle>
            <CardDescription>
              Factoren die normuren aanpassen op basis van omstandigheden
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Type filter */}
            <div className="mb-4">
              <Select value={activeType} onValueChange={setActiveType}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter op type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle types</SelectItem>
                  {types.map((type) => (
                    <SelectItem key={type} value={type}>
                      {typeLabels[type] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isFactorenLoading ? (
              <div className="flex items-center justify-center py-8">
                <LaadIndicator formaat="sectie" tekst="Laden…" />
              </div>
            ) : filteredFactoren.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Waarde</TableHead>
                    <TableHead className="text-right">Factor</TableHead>
                    <TableHead className="w-[150px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFactoren.map((factor) => (
                    <TableRow key={factor._id}>
                      <TableCell className="font-medium">
                        {typeLabels[factor.type] || factor.type}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          {waardeLabels[factor.waarde] || factor.waarde}
                          {/* Status-kolom vervallen (WS6): alléén markeren
                              wat afwijkt van standaard */}
                          {factor.userId && (
                            <Badge variant="secondary">Aangepast</Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {editingFactor?._id === factor._id ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-20 text-right"
                            value={factorValue}
                            onChange={(e) =>
                              setFactorValue(parseFloat(e.target.value) || 0)
                            }
                          />
                        ) : (
                          <span
                            // Opslag (>1) en korting (<1) zijn statuskleuren
                            // zonder token; in dark mode een lichtere tint,
                            // anders is het getal in de tabel niet leesbaar.
                            className={
                              factor.factor !== 1
                                ? factor.factor > 1
                                  ? "text-orange-600 dark:text-orange-400 font-medium"
                                  : "text-green-600 dark:text-green-400 font-medium"
                                : ""
                            }
                          >
                            {factor.factor.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {editingFactor?._id === factor._id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 sm:h-8 sm:w-8"
                                aria-label="Opslaan"
                                onClick={onSaveFactor}
                                disabled={isSaving}
                              >
                                {isSaving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4 text-green-600 dark:text-green-400" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 sm:h-8 sm:w-8"
                                aria-label="Annuleren"
                                onClick={onCancelEdit}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 sm:h-8 sm:w-8"
                                aria-label="Bewerken"
                                onClick={() => onEditFactor(factor as Correctiefactor)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {factor.userId && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 sm:h-8 sm:w-8"
                                  aria-label="Reset naar standaard"
                                  onClick={() => onResetFactor(factor as Correctiefactor)}
                                >
                                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Sliders className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  Geen correctiefactoren gevonden
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </div>
  );
}
