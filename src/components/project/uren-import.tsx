"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader2,
  Download,
  AlertTriangle,
} from "lucide-react";
import {
  parseUrenFile,
  getSampleCSVContent,
  ParsedUrenEntry,
} from "@/lib/uren-import-parser";

interface UrenImportProps {
  onImport: (entries: ParsedUrenEntry[]) => Promise<void>;
  isImporting?: boolean;
}

export function UrenImport({ onImport, isImporting = false }: UrenImportProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [entries, setEntries] = useState<ParsedUrenEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsParsing(true);
      setErrors([]);
      setWarnings([]);
      setEntries([]);

      try {
        const result = await parseUrenFile(file);
        setEntries(result.entries);
        setErrors(result.errors);
        setWarnings(result.warnings);

        if (result.entries.length > 0) {
          setShowPreview(true);
        }
      } catch (error) {
        setErrors([`Fout bij verwerken bestand: ${error}`]);
      } finally {
        setIsParsing(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    []
  );

  const handleImport = useCallback(async () => {
    if (entries.length === 0) return;
    await onImport(entries);
    setShowPreview(false);
    setEntries([]);
    setErrors([]);
    setWarnings([]);
  }, [entries, onImport]);

  const handleClose = useCallback(() => {
    setShowPreview(false);
    setEntries([]);
    setErrors([]);
    setWarnings([]);
  }, []);

  const handleDownloadSample = useCallback(() => {
    const content = getSampleCSVContent();
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "uren_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Calculate totals for preview
  const totaalUren = entries.reduce((sum, e) => sum + e.uren, 0);
  const uniqueMedewerkers = [...new Set(entries.map((e) => e.medewerker))];

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isParsing}
        >
          {isParsing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Import CSV/Excel
        </Button>
        <Button variant="ghost" size="icon" onClick={handleDownloadSample}>
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Preview - Urenregistratie
            </DialogTitle>
            <DialogDescription>
              Controleer de te importeren uren
            </DialogDescription>
          </DialogHeader>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Fouten gevonden:</span>
              </div>
              <ul className="mt-2 text-sm text-destructive list-disc list-inside">
                {errors.slice(0, 5).map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
                {errors.length > 5 && (
                  <li>...en {errors.length - 5} meer fouten</li>
                )}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-3">
              <div className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Waarschuwingen:</span>
              </div>
              <ul className="mt-2 text-sm text-orange-600 list-disc list-inside">
                {warnings.slice(0, 5).map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
                {warnings.length > 5 && (
                  <li>...en {warnings.length - 5} meer waarschuwingen</li>
                )}
              </ul>
            </div>
          )}

          {/* Summary */}
          {entries.length > 0 && (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Totaal uren:</span>
                <span className="font-medium">{totaalUren.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Medewerkers:</span>
                <span className="font-medium">{uniqueMedewerkers.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Registraties:</span>
                <span className="font-medium">{entries.length}</span>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Medewerker</TableHead>
                  <TableHead className="text-right">Uren</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Notities</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.slice(0, 100).map((entry, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{entry.datum}</TableCell>
                    <TableCell>{entry.medewerker}</TableCell>
                    <TableCell className="text-right">
                      {entry.uren.toFixed(1)}
                    </TableCell>
                    <TableCell>
                      {entry.scope || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {entry.notities || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {entries.length > 100 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                ...en {entries.length - 100} meer registraties
              </p>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-600" />
              {entries.length} registraties klaar om te importeren
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Annuleren
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || entries.length === 0}
              >
                {isImporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Importeren
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
