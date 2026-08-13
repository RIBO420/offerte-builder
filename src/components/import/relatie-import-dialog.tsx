"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import {
  getSampleKlantCSV,
  parseKlantenFile,
  type KlantParseResult,
  type ParsedKlantEntry,
  type RelatieSoort,
} from "@/lib/klant-import-parser";
import { api } from "../../../convex/_generated/api";

const KLANT_TYPE_LABELS: Record<string, string> = {
  particulier: "Particulier",
  zakelijk: "Zakelijk",
  vve: "VvE",
  gemeente: "Gemeente",
  overig: "Overig",
};

/** Hoeveel meldingen we standaard tonen voordat we inklappen. */
const MELDING_LIMIET = 5;
/** Hoeveel rijen we in de preview renderen — meer maakt de tabel traag. */
const PREVIEW_LIMIET = 100;

interface RelatieImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  soort: RelatieSoort;
  /** Aangeroepen na een geslaagde import, bijv. om de lijst te verversen. */
  onImported?: () => void;
}

interface ImportResultaat {
  imported: number;
  skipped: number;
  errors: string[];
}

/** Inklapbare lijst met meldingen — voorkomt dat 100 regels de dialog vullen. */
function MeldingenLijst({
  titel,
  meldingen,
  variant,
}: {
  titel: string;
  meldingen: string[];
  variant: "fout" | "waarschuwing";
}) {
  const [uitgeklapt, setUitgeklapt] = useState(false);
  if (meldingen.length === 0) return null;

  const isFout = variant === "fout";
  const zichtbaar = uitgeklapt ? meldingen : meldingen.slice(0, MELDING_LIMIET);
  const rest = meldingen.length - zichtbaar.length;

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        isFout
          ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
          : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
      )}
    >
      <p
        className={cn(
          "mb-1.5 flex items-center gap-1.5 text-sm font-medium",
          isFout
            ? "text-red-700 dark:text-red-400"
            : "text-amber-700 dark:text-amber-400"
        )}
      >
        {isFout ? (
          <XCircle className="h-4 w-4 shrink-0" />
        ) : (
          <AlertCircle className="h-4 w-4 shrink-0" />
        )}
        {titel} ({meldingen.length})
      </p>
      <ul
        className={cn(
          "space-y-0.5 text-xs",
          isFout
            ? "text-red-600 dark:text-red-400"
            : "text-amber-700 dark:text-amber-300"
        )}
      >
        {zichtbaar.map((melding, i) => (
          <li key={i} className="break-words">
            {melding}
          </li>
        ))}
      </ul>
      {(rest > 0 || uitgeklapt) && (
        <Button
          variant="link"
          size="sm"
          className={cn(
            "mt-1 h-auto p-0 text-xs",
            isFout ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
          )}
          onClick={() => setUitgeklapt((v) => !v)}
        >
          {uitgeklapt ? "Minder tonen" : `Nog ${rest} tonen`}
        </Button>
      )}
    </div>
  );
}

/**
 * Eén import-dialog voor klanten én leveranciers.
 *
 * De dialog is bewust opgebouwd als vaste kop + scrollend midden + vaste voet:
 * bij een bestand met honderden rijen scrollde eerder de knoppenbalk uit beeld
 * en liep de brede voorbeeldtabel buiten de dialog.
 */
export function RelatieImportDialog({
  open,
  onOpenChange,
  soort,
  onImported,
}: RelatieImportDialogProps) {
  const importKlanten = useMutation(api.klanten.importKlanten);
  const importLeveranciers = useMutation(api.leveranciers.importLeveranciers);

  const [parseResult, setParseResult] = useState<KlantParseResult | null>(null);
  const [bestandsnaam, setBestandsnaam] = useState<string | null>(null);
  const [resultaat, setResultaat] = useState<ImportResultaat | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const meervoud = soort === "klant" ? "klanten" : "leveranciers";
  const enkelvoud = soort === "klant" ? "klant" : "leverancier";

  // Een relatiebestand kan beide soorten bevatten; we importeren alleen wat op
  // deze pagina thuishoort en melden de rest, zodat er niets stilletjes verdwijnt.
  const eigenEntries = useMemo(
    () => (parseResult?.entries ?? []).filter((e) => e.soort === soort),
    [parseResult, soort]
  );
  const andereEntries = useMemo(
    () => (parseResult?.entries ?? []).filter((e) => e.soort !== soort),
    [parseResult, soort]
  );

  const sluit = useCallback(
    (volgende: boolean) => {
      if (!volgende) {
        setParseResult(null);
        setResultaat(null);
        setBestandsnaam(null);
        setIsDragOver(false);
      }
      onOpenChange(volgende);
    },
    [onOpenChange]
  );

  const verwerkBestand = useCallback(async (file: File) => {
    setIsParsing(true);
    setResultaat(null);
    try {
      const result = await parseKlantenFile(file);
      setParseResult(result);
      setBestandsnaam(file.name);
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Kon het bestand niet lezen"
      );
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void verwerkBestand(file);
    },
    [verwerkBestand]
  );

  const handleSubmit = useCallback(async () => {
    if (eigenEntries.length === 0) return;
    setIsImporting(true);
    try {
      const uitkomst =
        soort === "klant"
          ? await importKlanten({
              klanten: eigenEntries.map((e) => ({
                naam: e.naam,
                email: e.email,
                telefoon: e.telefoon,
                adres: e.adres,
                postcode: e.postcode,
                plaats: e.plaats,
                contactpersoon: e.contactpersoon,
                klantType: e.klantType,
              })),
            })
          : await importLeveranciers({
              leveranciers: eigenEntries.map((e) => ({
                naam: e.naam,
                contactpersoon: e.contactpersoon,
                email: e.email,
                telefoon: e.telefoon,
                adres: e.adres,
                postcode: e.postcode,
                plaats: e.plaats,
              })),
            });

      setResultaat(uitkomst);
      if (uitkomst.imported > 0) {
        showSuccessToast(
          `${uitkomst.imported} ${uitkomst.imported === 1 ? enkelvoud : meervoud} geïmporteerd`
        );
        onImported?.();
      }
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Import mislukt"
      );
    } finally {
      setIsImporting(false);
    }
  }, [
    eigenEntries,
    soort,
    importKlanten,
    importLeveranciers,
    enkelvoud,
    meervoud,
    onImported,
  ]);

  const downloadVoorbeeld = useCallback(() => {
    const blob = new Blob([getSampleKlantCSV()], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `voorbeeld-${meervoud}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [meervoud]);

  const aantalMetOpmerking = eigenEntries.filter(
    (e) => e.opmerkingen.length > 0
  ).length;

  return (
    <Dialog open={open} onOpenChange={sluit}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {soort === "klant" ? "Klanten" : "Leveranciers"} importeren
          </DialogTitle>
          <DialogDescription>
            Upload een CSV. Alleen een naam is verplicht — ontbrekende of
            buitenlandse postcodes houden de import niet tegen. Duplicaten
            worden overgeslagen.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {resultaat ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Import voltooid
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border border-green-200 bg-green-50 p-3 text-center dark:border-green-800 dark:bg-green-950/30">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {resultaat.imported}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-500">
                    Geïmporteerd
                  </p>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-800 dark:bg-amber-950/30">
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                    {resultaat.skipped}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    Overgeslagen (duplicaat)
                  </p>
                </div>
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-center dark:border-red-800 dark:bg-red-950/30">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {resultaat.errors.length}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-500">Fouten</p>
                </div>
              </div>
              <MeldingenLijst
                titel="Fouten"
                meldingen={resultaat.errors}
                variant="fout"
              />
            </div>
          ) : (
            <>
              {/* Bestandskiezer */}
              <div
                className={cn(
                  "relative rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
              >
                {isParsing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Bestand verwerken…
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <FileUp className="h-8 w-8 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-medium">
                        {bestandsnaam ?? "Sleep een CSV-bestand hierheen"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {bestandsnaam
                          ? "Klik om een ander bestand te kiezen"
                          : "of klik om een bestand te selecteren"}
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      aria-label="CSV-bestand selecteren"
                      className="absolute inset-0 cursor-pointer opacity-0"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void verwerkBestand(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}
              </div>

              {!parseResult && (
                <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                  <div className="text-sm">
                    <p className="font-medium">Voorbeeld-CSV</p>
                    <p className="text-xs text-muted-foreground">
                      Download een bestand met het verwachte formaat
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadVoorbeeld}>
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Download
                  </Button>
                </div>
              )}

              <MeldingenLijst
                titel="Rijen die niet ingelezen konden worden"
                meldingen={parseResult?.errors ?? []}
                variant="fout"
              />
              <MeldingenLijst
                titel="Let op"
                meldingen={parseResult?.warnings ?? []}
                variant="waarschuwing"
              />

              {andereEntries.length > 0 && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                  Dit bestand bevat ook {andereEntries.length}{" "}
                  {soort === "klant" ? "leveranciers" : "klanten"}. Die worden
                  hier niet meegenomen — importeer ze via de{" "}
                  {soort === "klant" ? "Leveranciers" : "Klanten"}-pagina.
                </div>
              )}

              {/* Voorbeeldtabel */}
              {eigenEntries.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                      Voorbeeld — {eigenEntries.length}{" "}
                      {eigenEntries.length === 1 ? enkelvoud : meervoud} klaar om
                      te importeren
                    </p>
                    {aantalMetOpmerking > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {aantalMetOpmerking} met een aandachtspunt (worden wel
                        geïmporteerd)
                      </p>
                    )}
                  </div>
                  <div className="max-h-[300px] overflow-auto rounded-md border">
                    <table className="w-full min-w-[820px] text-xs">
                      <thead className="sticky top-0 z-10 bg-muted">
                        <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                          <th className="w-10">#</th>
                          <th className="min-w-[160px]">Naam</th>
                          <th className="min-w-[180px]">E-mail</th>
                          <th className="min-w-[180px]">Adres</th>
                          <th className="w-24">Postcode</th>
                          <th className="min-w-[110px]">Plaats</th>
                          {soort === "klant" ? (
                            <th className="w-24">Type</th>
                          ) : (
                            <th className="min-w-[130px]">Contactpersoon</th>
                          )}
                          <th className="min-w-[150px]">Aandachtspunten</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {eigenEntries.slice(0, PREVIEW_LIMIET).map((entry, i) => (
                          <PreviewRij
                            key={`${entry.naam}-${i}`}
                            index={i}
                            entry={entry}
                            soort={soort}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {eigenEntries.length > PREVIEW_LIMIET && (
                    <p className="text-center text-xs text-muted-foreground">
                      Eerste {PREVIEW_LIMIET} van {eigenEntries.length} getoond —
                      alle {eigenEntries.length} worden geïmporteerd.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4">
          {resultaat ? (
            <Button onClick={() => sluit(false)}>Sluiten</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => sluit(false)}>
                Annuleren
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={eigenEntries.length === 0 || isImporting}
              >
                {isImporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {isImporting
                  ? "Bezig met importeren…"
                  : `${eigenEntries.length} ${eigenEntries.length === 1 ? enkelvoud : meervoud} importeren`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewRij({
  index,
  entry,
  soort,
}: {
  index: number;
  entry: ParsedKlantEntry;
  soort: RelatieSoort;
}) {
  return (
    <tr className="hover:bg-muted/30 [&>td]:px-3 [&>td]:py-1.5">
      <td className="text-muted-foreground">{index + 1}</td>
      <td className="font-medium">
        <span className="block max-w-[220px] truncate" title={entry.naam}>
          {entry.naam}
        </span>
      </td>
      <td className="text-muted-foreground">
        <span className="block max-w-[220px] truncate" title={entry.email ?? ""}>
          {entry.email || "—"}
        </span>
      </td>
      <td className="text-muted-foreground">
        <span className="block max-w-[260px] truncate" title={entry.adres}>
          {entry.adres || "—"}
        </span>
      </td>
      <td className={cn(!entry.postcode && "text-muted-foreground")}>
        {entry.postcode || "—"}
      </td>
      <td>
        <span className="block max-w-[150px] truncate" title={entry.plaats}>
          {entry.plaats || "—"}
        </span>
      </td>
      <td>
        {soort === "klant" ? (
          <Badge variant="secondary" className="text-[10px]">
            {KLANT_TYPE_LABELS[entry.klantType] ?? entry.klantType}
          </Badge>
        ) : (
          <span
            className="block max-w-[170px] truncate text-muted-foreground"
            title={entry.contactpersoon ?? ""}
          >
            {entry.contactpersoon || "—"}
          </span>
        )}
      </td>
      <td>
        {entry.opmerkingen.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {entry.opmerkingen.map((opmerking) => (
              <Badge
                key={opmerking}
                variant="outline"
                className="border-amber-300 text-[10px] text-amber-700 dark:border-amber-800 dark:text-amber-400"
              >
                {opmerking}
              </Badge>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}
