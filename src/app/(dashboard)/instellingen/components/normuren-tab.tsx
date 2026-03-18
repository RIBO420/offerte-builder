"use client";

import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Plus, Edit, Trash2, Clock, Loader2 } from "lucide-react";
import { scopeLabels } from "./constants";
import type { Normuur } from "./types";

interface NormurenTabProps {
  filteredNormuren: Normuur[];
  scopes: string[];
  activeScope: string;
  setActiveScope: (scope: string) => void;
  isNormurenLoading: boolean | null | undefined;
  onOpenDialog: (normuur?: Normuur) => void;
  onDeleteNormuur: (normuur: Normuur) => void;
  reducedMotion: boolean;
}

export function NormurenTab({
  filteredNormuren,
  scopes,
  activeScope,
  setActiveScope,
  isNormurenLoading,
  onOpenDialog,
  onDeleteNormuur,
  reducedMotion,
}: NormurenTabProps) {
  return (
    <motion.div
      key="normuren"
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
    >
      <TabsContent value="normuren" className="space-y-4" forceMount>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Normuren</CardTitle>
                <CardDescription>
                  Standaard uren per activiteit voor berekeningen
                </CardDescription>
              </div>
              <Button onClick={() => onOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Normuur toevoegen
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Scope filter */}
            <div className="mb-4">
              <Select value={activeScope} onValueChange={setActiveScope}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter op scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle scopes</SelectItem>
                  {scopes.map((scope) => (
                    <SelectItem key={scope} value={scope}>
                      {scopeLabels[scope] || scope}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isNormurenLoading ? (
              <div className="flex items-center justify-center py-8">
                <motion.div
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
                </motion.div>
              </div>
            ) : filteredNormuren.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activiteit</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-right">Normuur</TableHead>
                    <TableHead>Eenheid</TableHead>
                    <TableHead>Omschrijving</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNormuren.map((normuur, index) => (
                    <motion.tr
                      key={normuur._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    >
                      <TableCell className="font-medium">
                        {normuur.activiteit}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {scopeLabels[normuur.scope] || normuur.scope}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {normuur.normuurPerEenheid}
                      </TableCell>
                      <TableCell>{normuur.eenheid}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate" title={normuur.omschrijving || undefined}>
                        {normuur.omschrijving || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 sm:h-8 sm:w-8"
                            aria-label="Bewerken"
                            onClick={() => onOpenDialog(normuur as Normuur)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 sm:h-8 sm:w-8"
                            aria-label="Verwijderen"
                            onClick={() => onDeleteNormuur(normuur as Normuur)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  Geen normuren gevonden
                </p>
                <Button
                  className="mt-4"
                  onClick={() => onOpenDialog()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Eerste normuur toevoegen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </motion.div>
  );
}
