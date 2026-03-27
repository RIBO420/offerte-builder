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
  reducedMotion: boolean;
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
  reducedMotion,
}: FactorenTabProps) {
  return (
    <m.div
      key="factoren"
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
    >
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
                <m.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                  </div>
                  <p className="text-muted-foreground animate-pulse">Laden...</p>
                </m.div>
              </div>
            ) : filteredFactoren.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Waarde</TableHead>
                    <TableHead className="text-right">Factor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[150px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFactoren.map((factor, index) => (
                    <m.tr
                      key={factor._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    >
                      <TableCell className="font-medium">
                        {typeLabels[factor.type] || factor.type}
                      </TableCell>
                      <TableCell>
                        {waardeLabels[factor.waarde] || factor.waarde}
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
                            className={
                              factor.factor !== 1
                                ? factor.factor > 1
                                  ? "text-orange-600 font-medium"
                                  : "text-green-600 font-medium"
                                : ""
                            }
                          >
                            {factor.factor.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {factor.userId ? (
                          <Badge variant="secondary">Aangepast</Badge>
                        ) : (
                          <Badge variant="outline">Standaard</Badge>
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
                                  <Save className="h-4 w-4 text-green-600" />
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
                    </m.tr>
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
    </m.div>
  );
}
