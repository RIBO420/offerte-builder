"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Plus, Trash2, Fuel, TrendingDown, Euro, Droplets } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { cn } from "@/lib/utils";
import { Id } from "../../../convex/_generated/dataModel";
import type { BrandstofRecord, BrandstofStats } from "@/hooks/use-voertuig-details";

// Zod schema for brandstof entry
const brandstofEntrySchema = z.object({
  datum: z.string().min(1, "Datum is verplicht"),
  liters: z.string().min(1, "Liters is verplicht").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    { message: "Voer een geldig aantal liters in" }
  ),
  kosten: z.string().min(1, "Kosten is verplicht").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    { message: "Voer geldige kosten in" }
  ),
  kilometerstand: z.string().min(1, "Kilometerstand is verplicht").refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) >= 0,
    { message: "Voer een geldige kilometerstand in" }
  ),
  locatie: z.string().optional(),
});

type BrandstofEntryData = z.infer<typeof brandstofEntrySchema>;

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<Id<"brandstofRegistratie"> | null>(null);

  const form = useForm<BrandstofEntryData>({
    resolver: zodResolver(brandstofEntrySchema),
    defaultValues: {
      datum: new Date().toISOString().split("T")[0],
      liters: "",
      kosten: "",
      kilometerstand: "",
      locatie: "",
    },
  });

  const litersValue = form.watch("liters");
  const kostenValue = form.watch("kosten");

  // Calculate price per liter for display
  const prijsPerLiter = useMemo(() => {
    const l = parseFloat(litersValue);
    const k = parseFloat(kostenValue);
    if (l > 0 && k > 0) {
      return k / l;
    }
    return null;
  }, [litersValue, kostenValue]);

  const handleFormSubmit = async (data: BrandstofEntryData) => {
    const kmValue = parseInt(data.kilometerstand);

    // Validate that new reading is higher than current
    if (currentKmStand && kmValue < currentKmStand) {
      form.setError("kilometerstand", {
        message: `Kilometerstand moet hoger zijn dan de huidige stand (${formatKm(currentKmStand)} km)`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        voertuigId,
        datum: new Date(data.datum).getTime(),
        liters: parseFloat(data.liters),
        kosten: parseFloat(data.kosten),
        kilometerstand: kmValue,
        locatie: data.locatie?.trim() || undefined,
      });
      showSuccessToast("Tankbeurt toegevoegd");
      form.reset({
        datum: new Date().toISOString().split("T")[0],
        liters: "",
        kosten: "",
        kilometerstand: "",
        locatie: "",
      });
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
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="datum"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Datum</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="kilometerstand"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Kilometerstand</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                min={currentKmStand || 0}
                                placeholder={
                                  currentKmStand
                                    ? `Min. ${formatKm(currentKmStand)}`
                                    : "Bijv. 125000"
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="liters"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Liters</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Bijv. 45.5"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="kosten"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Kosten (EUR)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Bijv. 85.00"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-2">
                        <FormLabel>Prijs/liter</FormLabel>
                        <div className="flex h-9 items-center px-3 border rounded-md bg-muted text-muted-foreground">
                          {prijsPerLiter !== null
                            ? formatCurrency(prijsPerLiter)
                            : "-"}
                        </div>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="locatie"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tankstation (optioneel)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Bijv. Shell A2 Breukelen"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                </Form>
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
