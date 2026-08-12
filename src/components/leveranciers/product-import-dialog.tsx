"use client";

/**
 * Productbestand-import via kolommapping (PRD §2.5c) — kantoor-only,
 * onder de Leveranciers-module.
 *
 * Drie stappen:
 * 1. Bestand (CSV/Excel) uploaden + kolommen mappen op velden
 *    (naam verplicht; inkoopprijs, eenheid, btw, omschrijving optioneel);
 * 2. Validatie-preview: near-duplicate-waarschuwingen (tegen bestaande
 *    producten én binnen het bestand), €0-prijzen → prijs-op-regel-vlag,
 *    rijen individueel aan/uit te vinken;
 * 3. Import met resultaatrapport. Her-import van hetzelfde bestand maakt
 *    geen duplicaten (match op genormaliseerde naam + leverancier).
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useLeveranciers } from "@/hooks/use-leveranciers";
import {
  IMPORT_VELDEN,
  IMPORT_VELD_LABELS,
  bouwImportRijen,
  raadMapping,
  type GemapteImportRij,
  type ImportVeld,
  type KolomMapping,
} from "@/lib/product-import";
import { logger } from "@/lib/logger";

type Stap = "mapping" | "preview" | "resultaat";

const GEEN_KOLOM = "__geen__";
const GEEN_LEVERANCIER = "__geen__";

interface ImportRapport {
  totaal: number;
  aangemaakt: number;
  bijgewerkt: number;
  overgeslagen: number;
}

interface ProductImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function parseBestand(file: File): Promise<string[][]> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const werkblad = workbook.worksheets[0];
    if (!werkblad) return [];
    const rijen: string[][] = [];
    werkblad.eachRow((rij) => {
      const cellen: string[] = [];
      rij.eachCell({ includeEmpty: true }, (cel, kolomNummer) => {
        cellen[kolomNummer - 1] = cel.text ?? "";
      });
      rijen.push(cellen);
    });
    return rijen;
  }

  const Papa = (await import("papaparse")).default;
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (result) => resolve(result.data as string[][]),
      error: (error) => reject(error),
    });
  });
}

export function ProductImportDialog({
  open,
  onOpenChange,
}: ProductImportDialogProps) {
  const { leveranciers } = useLeveranciers();
  const importeer = useMutation(api.productenImport.importeer);

  const [stap, setStap] = useState<Stap>("mapping");
  const [bestandsnaam, setBestandsnaam] = useState<string | null>(null);
  const [kopregel, setKopregel] = useState<string[]>([]);
  const [dataRijen, setDataRijen] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<KolomMapping>({});
  const [leverancierId, setLeverancierId] = useState<string>(GEEN_LEVERANCIER);
  const [geselecteerd, setGeselecteerd] = useState<Set<number>>(new Set());
  const [isImporteren, setIsImporteren] = useState(false);
  const [rapport, setRapport] = useState<ImportRapport | null>(null);

  const reset = useCallback(() => {
    setStap("mapping");
    setBestandsnaam(null);
    setKopregel([]);
    setDataRijen([]);
    setMapping({});
    setLeverancierId(GEEN_LEVERANCIER);
    setGeselecteerd(new Set());
    setRapport(null);
  }, []);

  const handleOpenChange = useCallback(
    (nieuwOpen: boolean) => {
      if (!nieuwOpen) reset();
      onOpenChange(nieuwOpen);
    },
    [onOpenChange, reset]
  );

  const handleBestand = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const rijen = await parseBestand(file);
        if (rijen.length < 2) {
          toast.error(
            "Bestand bevat geen datarijen (kopregel + minimaal 1 rij verwacht)"
          );
          return;
        }
        setBestandsnaam(file.name);
        setKopregel(rijen[0].map((kop, i) => kop?.trim() || `Kolom ${i + 1}`));
        setDataRijen(rijen.slice(1));
        setMapping(raadMapping(rijen[0]));
      } catch (error) {
        logger.error("Inlezen importbestand mislukt", error, {
          module: "leveranciers/product-import",
        });
        toast.error("Bestand kon niet gelezen worden");
      }
    },
    []
  );

  // Gemapte rijen voor preview/import (stabiel via useMemo → stabiele query-args)
  const importRijen: GemapteImportRij[] = useMemo(() => {
    if (mapping.naam === undefined || dataRijen.length === 0) return [];
    try {
      return bouwImportRijen(dataRijen, mapping);
    } catch {
      return [];
    }
  }, [dataRijen, mapping]);

  const validatie = useQuery(
    api.productenImport.previewImport,
    stap === "preview" && importRijen.length > 0
      ? { rijen: importRijen }
      : "skip"
  );

  const naarPreview = useCallback(() => {
    if (mapping.naam === undefined) {
      toast.error("Kies eerst welke kolom de productnaam bevat");
      return;
    }
    setGeselecteerd(new Set());
    setStap("preview");
  }, [mapping.naam]);

  // Default-selectie zodra de validatie binnen is: geldige rijen aan,
  // exacte duplicaten binnen het bestand uit
  const effectieveSelectie = useMemo(() => {
    if (!validatie) return geselecteerd;
    if (geselecteerd.size > 0) return geselecteerd;
    const standaard = new Set<number>();
    for (const rij of validatie) {
      if (rij.geldig && rij.inBestand?.soort !== "exact") {
        standaard.add(rij.index);
      }
    }
    return standaard;
  }, [validatie, geselecteerd]);

  const toggleRij = useCallback(
    (index: number, aan: boolean) => {
      const nieuw = new Set(effectieveSelectie);
      if (aan) {
        nieuw.add(index);
      } else {
        nieuw.delete(index);
      }
      setGeselecteerd(nieuw);
    },
    [effectieveSelectie]
  );

  const handleImport = useCallback(async () => {
    const rijen = importRijen.filter((_, i) => effectieveSelectie.has(i));
    if (rijen.length === 0) {
      toast.error("Geen rijen geselecteerd");
      return;
    }
    setIsImporteren(true);
    try {
      const resultaat = await importeer({
        rijen,
        leverancierId:
          leverancierId === GEEN_LEVERANCIER
            ? undefined
            : (leverancierId as Id<"leveranciers">),
      });
      setRapport(resultaat);
      setStap("resultaat");
    } catch (error) {
      const bericht =
        error instanceof Error && "data" in error
          ? String((error as { data: unknown }).data)
          : "Import mislukt";
      toast.error(bericht);
      logger.error("Importeren leveranciersproducten mislukt", error, {
        module: "leveranciers/product-import",
      });
    } finally {
      setIsImporteren(false);
    }
  }, [importRijen, effectieveSelectie, importeer, leverancierId]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Producten importeren</DialogTitle>
          <DialogDescription>
            {stap === "mapping" &&
              "Stap 1 van 3 — upload een leverancierslijst (CSV of Excel) en wijs de kolommen toe."}
            {stap === "preview" &&
              "Stap 2 van 3 — controleer de waarschuwingen en vink rijen aan of uit."}
            {stap === "resultaat" && "Stap 3 van 3 — resultaat van de import."}
          </DialogDescription>
        </DialogHeader>

        {stap === "mapping" && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="import-bestand">Bestand (CSV of Excel)</Label>
              <Input
                id="import-bestand"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleBestand}
              />
              {bestandsnaam && (
                <p className="text-sm text-muted-foreground">
                  <FileUp className="mr-1 inline size-4" />
                  {bestandsnaam} — {dataRijen.length} rijen
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="import-leverancier">Leverancier</Label>
              <Select value={leverancierId} onValueChange={setLeverancierId}>
                <SelectTrigger id="import-leverancier">
                  <SelectValue placeholder="Kies leverancier (optioneel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GEEN_LEVERANCIER}>
                    Geen leverancier
                  </SelectItem>
                  {leveranciers.map((l: { _id: string; naam: string }) => (
                    <SelectItem key={l._id} value={l._id}>
                      {l.naam}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {kopregel.length > 0 && (
              <div className="grid gap-3">
                <p className="text-sm font-medium">Kolommen toewijzen</p>
                {IMPORT_VELDEN.map((veld: ImportVeld) => (
                  <div
                    key={veld}
                    className="grid grid-cols-2 items-center gap-2"
                  >
                    <Label htmlFor={`mapping-${veld}`}>
                      {IMPORT_VELD_LABELS[veld]}
                    </Label>
                    <Select
                      value={
                        mapping[veld] !== undefined
                          ? String(mapping[veld])
                          : GEEN_KOLOM
                      }
                      onValueChange={(value) =>
                        setMapping((m) => ({
                          ...m,
                          [veld]:
                            value === GEEN_KOLOM ? undefined : Number(value),
                        }))
                      }
                    >
                      <SelectTrigger id={`mapping-${veld}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={GEEN_KOLOM}>
                          — niet importeren —
                        </SelectItem>
                        {kopregel.map((kop, index) => (
                          <SelectItem key={index} value={String(index)}>
                            {kop}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {stap === "preview" && (
          <div className="grid gap-3">
            {validatie === undefined ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {effectieveSelectie.size} van {validatie.length} rijen
                  geselecteerd. Rijen die al bestaan worden bijgewerkt, niet
                  gedupliceerd.
                </p>
                <div className="max-h-96 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Naam</TableHead>
                        <TableHead className="text-right">
                          Inkoopprijs
                        </TableHead>
                        <TableHead>Waarschuwingen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validatie.map((rij) => (
                        <TableRow
                          key={rij.index}
                          className={rij.geldig ? "" : "opacity-60"}
                        >
                          <TableCell>
                            <Checkbox
                              checked={effectieveSelectie.has(rij.index)}
                              disabled={!rij.geldig}
                              onCheckedChange={(aan) =>
                                toggleRij(rij.index, aan === true)
                              }
                              aria-label={`Rij ${rij.index + 1} importeren`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {rij.naam || <em>(leeg)</em>}
                          </TableCell>
                          <TableCell className="text-right">
                            {rij.prijsOpRegel ? (
                              <Badge variant="outline">prijs op regel</Badge>
                            ) : (
                              importRijen[rij.index]?.inkoopprijs?.toLocaleString(
                                "nl-NL",
                                { style: "currency", currency: "EUR" }
                              )
                            )}
                          </TableCell>
                          <TableCell>
                            {rij.waarschuwingen.length === 0 ? (
                              <CheckCircle2 className="size-4 text-muted-foreground" />
                            ) : (
                              <ul className="space-y-1">
                                {rij.waarschuwingen.map((w, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-500"
                                  >
                                    <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                                    {w}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        )}

        {stap === "resultaat" && rapport && (
          <div className="grid gap-2 py-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-5 text-green-600" />
              Import afgerond
            </p>
            <ul className="ml-7 list-disc space-y-1 text-muted-foreground">
              <li>{rapport.aangemaakt} nieuwe producten aangemaakt</li>
              <li>{rapport.bijgewerkt} bestaande producten bijgewerkt</li>
              <li>{rapport.overgeslagen} rijen overgeslagen (duplicaat/leeg)</li>
            </ul>
          </div>
        )}

        <DialogFooter>
          {stap === "mapping" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Annuleren
              </Button>
              <Button
                onClick={naarPreview}
                disabled={dataRijen.length === 0 || mapping.naam === undefined}
              >
                <Upload className="size-4" />
                Controleren
              </Button>
            </>
          )}
          {stap === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStap("mapping")}>
                Terug
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporteren || effectieveSelectie.size === 0}
              >
                {isImporteren && <Loader2 className="size-4 animate-spin" />}
                {effectieveSelectie.size} rijen importeren
              </Button>
            </>
          )}
          {stap === "resultaat" && (
            <Button onClick={() => handleOpenChange(false)}>Sluiten</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
