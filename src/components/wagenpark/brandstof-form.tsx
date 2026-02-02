"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2, Fuel, TrendingDown, Euro, Droplets } from "lucide-react";
import { showSuccessToast, showErrorToast, showWarningToast } from "@/lib/toast-utils";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { cn } from "@/lib/utils";
import { Id } from "../../../convex/_generated/dataModel";
import type { BrandstofRecord, BrandstofStats } from "@/hooks/use-voertuig-details";

interface BrandstofFormProps {
  voertuigId: Id<"voertuigen">;
  records: BrandstofRecord[];
  stats: BrandstofStats | null;
  currentKmStand?: number;
  isLoading?: boolean;
  onCreate: (data: {
    voertuigId: Id<"voertuigen">;
    datum: number;
    liters: number;
    kosten: number;
    kilometerstand: number;
    locatie?: string;
  }) => Promise<unknown>;
  onRemove: (id: Id<"brandstofRegistratie">) => Promise<unknown>;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatKm(km: number): string {
  return new Intl.NumberFormat("nl-NL").format(km);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatLiters(liters: number): string {
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(liters);
}

export function BrandstofForm({
  voertuigId,
  records,
  stats,
  currentKmStand,
  isLoading,
  onCreate,
  onRemove,
}: BrandstofFormProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [liters, setLiters] = useState("");
  const [kosten, setKosten] = useState("");
  const [kilometerstand, setKilometerstand] = useState("");
  const [locatie, setLocatie] = useState("");
  const [datum, setDatum] = useState(() => new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<Id<"brandstofRegistratie"> | null>(null);

  // Calculate price per liter for display
  const prijsPerLiter = useMemo(() => {
    const l = parseFloat(liters);
    const k = parseFloat(kosten);
    if (l > 0 && k > 0) {
      return k / l;
    }
    return null;
  }, [liters, kosten]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const litersValue = parseFloat(liters);
    const kostenValue = parseFloat(kosten);
    const kmValue = parseInt(kilometerstand);

    if (isNaN(litersValue) || litersValue <= 0) {
      showWarningToast("Voer een geldig aantal liters in");
      return;
    }

    if (isNaN(kostenValue) || kostenValue <= 0) {
      showWarningToast("Voer geldige kosten in");
      return;
    }

    if (isNaN(kmValue) || kmValue < 0) {
      showWarningToast("Voer een geldige kilometerstand in");
      return;
    }

    // Validate that new reading is higher than current
    if (currentKmStand && kmValue < currentKmStand) {
      showWarningToast(
        `Kilometerstand moet hoger zijn dan de huidige stand (${formatKm(currentKmStand)} km)`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        voertuigId,
        datum: new Date(datum).getTime(),
        liters: litersValue,
        kosten: kostenValue,
        kilometerstand: kmValue,
        locatie: locatie.trim() || undefined,
      });
      showSuccessToast("Tankbeurt toegevoegd");
      setLiters("");
      setKosten("");
      setKilometerstand("");
      setLocatie("");
      setDatum(new Date().toISOString().split("T")[0]);
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding fuel:", error);
      showErrorToast("Fout bij toevoegen tankbeurt", {
        description: getMutationErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await onRemove(deleteId);
      showSuccessToast("Tankbeurt verwijderd");
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting fuel:", error);
      showErrorToast("Fout bij verwijderen", {
        description: getMutationErrorMessage(error),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {stats && stats.aantalTankbeurten > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 sm:grid-cols-4"
        >
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Tankbeurten</p>
                  <p className="text-lg font-bold">{stats.aantalTankbeurten}</p>
                </div>
                <Fuel className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Totaal liters</p>
                  <p className="text-lg font-bold">{formatLiters(stats.totaalLiters)} L</p>
                </div>
                <Droplets className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Totaal kosten</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.totaalKosten)}</p>
                </div>
                <Euro className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Verbruik</p>
                  <p className="text-lg font-bold">
                    {stats.gemiddeldVerbruik > 0
                      ? `${stats.gemiddeldVerbruik} L/100km`
                      : "-"}
                  </p>
                </div>
                <TrendingDown className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Entry Form & Records */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Brandstof</CardTitle>
              <CardDescription>
                Registreer tankbeurten en bekijk verbruik
              </CardDescription>
            </div>
            {!isAdding && (
              <Button onClick={() => setIsAdding(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Tankbeurt
              </Button>
            )}
          </div>
        </CardHeader>

        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="border-t pt-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="datum">Datum</Label>
                      <Input
                        id="datum"
                        type="date"
                        value={datum}
                        onChange={(e) => setDatum(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kilometerstand">Kilometerstand</Label>
                      <Input
                        id="kilometerstand"
                        type="number"
                        min={currentKmStand || 0}
                        value={kilometerstand}
                        onChange={(e) => setKilometerstand(e.target.value)}
                        placeholder={
                          currentKmStand
                            ? `Min. ${formatKm(currentKmStand)}`
                            : "Bijv. 125000"
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="liters">Liters</Label>
                      <Input
                        id="liters"
                        type="number"
                        min="0"
                        step="0.01"
                        value={liters}
                        onChange={(e) => setLiters(e.target.value)}
                        placeholder="Bijv. 45.5"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kosten">Kosten (EUR)</Label>
                      <Input
                        id="kosten"
                        type="number"
                        min="0"
                        step="0.01"
                        value={kosten}
                        onChange={(e) => setKosten(e.target.value)}
                        placeholder="Bijv. 85.00"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Prijs/liter</Label>
                      <div className="flex h-9 items-center px-3 border rounded-md bg-muted text-muted-foreground">
                        {prijsPerLiter !== null
                          ? formatCurrency(prijsPerLiter)
                          : "-"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="locatie">Tankstation (optioneel)</Label>
                    <Input
                      id="locatie"
                      value={locatie}
                      onChange={(e) => setLocatie(e.target.value)}
                      placeholder="Bijv. Shell A2 Breukelen"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAdding(false)}
                    >
                      Annuleren
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Opslaan
                    </Button>
                  </div>
                </form>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Records Table */}
        <CardContent className={cn(isAdding && "border-t")}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Fuel className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Nog geen tankbeurten geregistreerd
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">KM Stand</TableHead>
                  <TableHead className="text-right">Liters</TableHead>
                  <TableHead className="text-right">Kosten</TableHead>
                  <TableHead className="text-right">Per liter</TableHead>
                  <TableHead className="hidden sm:table-cell">Locatie</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record._id}>
                    <TableCell>{formatDate(record.datum)}</TableCell>
                    <TableCell className="text-right">
                      {formatKm(record.kilometerstand)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatLiters(record.liters)} L
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(record.kosten)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(record.kosten / record.liters)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell max-w-[150px] truncate text-muted-foreground" title={record.locatie || undefined}>
                      {record.locatie || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(record._id)}
                        className="h-9 w-9 sm:h-8 sm:w-8"
                        aria-label="Verwijderen"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tankbeurt verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze tankbeurt wilt verwijderen? Deze actie
              kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
