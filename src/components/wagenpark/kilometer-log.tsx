"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Plus, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Id } from "../../../convex/_generated/dataModel";
import type { KilometerRecord } from "@/hooks/use-voertuig-details";

interface KilometerLogProps {
  voertuigId: Id<"voertuigen">;
  records: KilometerRecord[];
  currentKmStand?: number;
  isLoading?: boolean;
  onCreate: (data: {
    voertuigId: Id<"voertuigen">;
    datum: string;
    kilometerstand: number;
    notities?: string;
  }) => Promise<unknown>;
  onRemove: (id: Id<"kilometerStanden">) => Promise<unknown>;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatKm(km: number): string {
  return new Intl.NumberFormat("nl-NL").format(km);
}

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function KilometerLog({
  voertuigId,
  records,
  currentKmStand,
  isLoading,
  onCreate,
  onRemove,
}: KilometerLogProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [kilometerstand, setKilometerstand] = useState("");
  const [datum, setDatum] = useState(getTodayString());
  const [notities, setNotities] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<Id<"kilometerStanden"> | null>(null);

  // Calculate trend data
  const trendData = useMemo(() => {
    if (records.length < 2) return null;

    // Sort by date ascending
    const sorted = [...records].sort((a, b) =>
      new Date(a.datum).getTime() - new Date(b.datum).getTime()
    );

    // Calculate daily average over the period
    const firstRecord = sorted[0];
    const lastRecord = sorted[sorted.length - 1];
    const kmDiff = lastRecord.kilometerstand - firstRecord.kilometerstand;
    const daysDiff = Math.max(
      1,
      Math.ceil(
        (new Date(lastRecord.datum).getTime() - new Date(firstRecord.datum).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

    const dagGemiddelde = Math.round(kmDiff / daysDiff);
    const weekGemiddelde = dagGemiddelde * 7;
    const maandGemiddelde = dagGemiddelde * 30;

    return {
      dagGemiddelde,
      weekGemiddelde,
      maandGemiddelde,
      totaalPeriode: kmDiff,
      aantalDagen: daysDiff,
    };
  }, [records]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const kmValue = parseInt(kilometerstand);
    if (isNaN(kmValue) || kmValue < 0) {
      toast.error("Voer een geldige kilometerstand in");
      return;
    }

    // Validate that new reading is higher than current
    if (currentKmStand && kmValue < currentKmStand) {
      toast.error(
        `Kilometerstand moet hoger zijn dan de huidige stand (${formatKm(currentKmStand)} km)`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        voertuigId,
        datum,
        kilometerstand: kmValue,
        notities: notities.trim() || undefined,
      });
      toast.success("Kilometerstand toegevoegd");
      setKilometerstand("");
      setNotities("");
      setDatum(getTodayString());
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding km:", error);
      toast.error("Fout bij toevoegen kilometerstand");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await onRemove(deleteId);
      toast.success("Kilometerstand verwijderd");
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting km:", error);
      toast.error("Fout bij verwijderen");
    }
  };

  return (
    <div className="space-y-6">
      {/* Trend Statistics */}
      {trendData && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 sm:grid-cols-3"
        >
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Per dag</p>
                  <p className="text-lg font-bold">
                    {formatKm(trendData.dagGemiddelde)} km
                  </p>
                </div>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Per week</p>
                  <p className="text-lg font-bold">
                    {formatKm(trendData.weekGemiddelde)} km
                  </p>
                </div>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Per maand</p>
                  <p className="text-lg font-bold">
                    {formatKm(trendData.maandGemiddelde)} km
                  </p>
                </div>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Entry Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Kilometerstand</CardTitle>
              <CardDescription>
                {currentKmStand
                  ? `Huidige stand: ${formatKm(currentKmStand)} km`
                  : "Registreer de kilometerstand"}
              </CardDescription>
            </div>
            {!isAdding && (
              <Button onClick={() => setIsAdding(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Toevoegen
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

                  <div className="space-y-2">
                    <Label htmlFor="notities">Notities (optioneel)</Label>
                    <Textarea
                      id="notities"
                      value={notities}
                      onChange={(e) => setNotities(e.target.value)}
                      placeholder="Bijv. Na project klant X"
                      rows={2}
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
              <Minus className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Nog geen kilometerstanden geregistreerd
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">KM Stand</TableHead>
                  <TableHead className="text-right">Gereden</TableHead>
                  <TableHead>Notities</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record, index) => {
                  const previousRecord = records[index + 1];
                  const kmDiff = previousRecord
                    ? record.kilometerstand - previousRecord.kilometerstand
                    : null;

                  return (
                    <TableRow key={record._id}>
                      <TableCell>{formatDate(record.datum)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatKm(record.kilometerstand)}
                      </TableCell>
                      <TableCell className="text-right">
                        {kmDiff !== null ? (
                          <span className="text-muted-foreground">
                            +{formatKm(kmDiff)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground" title={record.notities || undefined}>
                        {record.notities || "-"}
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kilometerstand verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze kilometerstand wilt verwijderen? Deze
              actie kan niet ongedaan worden gemaakt.
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
