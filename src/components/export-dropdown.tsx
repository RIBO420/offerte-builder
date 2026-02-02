"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  exportToCSV,
  exportToExcel,
  type ExportColumn,
} from "@/lib/export-utils";

interface ExportDropdownProps<T extends Record<string, unknown>> {
  /**
   * Function to fetch export data (e.g., from Convex query)
   * Can be async for fetching from API
   */
  getData: () => T[] | Promise<T[]>;
  /**
   * Column definitions for export
   */
  columns: ExportColumn<T>[];
  /**
   * Base filename for export (without extension)
   */
  filename: string;
  /**
   * Optional label for the button (default: "Exporteren")
   */
  buttonLabel?: string;
  /**
   * Optional variant for the button
   */
  buttonVariant?: "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
  /**
   * Optional size for the button
   */
  buttonSize?: "default" | "sm" | "lg" | "icon";
  /**
   * Optional className for the button
   */
  className?: string;
  /**
   * Disable the export button
   */
  disabled?: boolean;
  /**
   * Sheet name for Excel export (default: "Data")
   */
  sheetName?: string;
}

export function ExportDropdown<T extends Record<string, unknown>>({
  getData,
  columns,
  filename,
  buttonLabel = "Exporteren",
  buttonVariant = "outline",
  buttonSize = "default",
  className,
  disabled = false,
  sheetName = "Data",
}: ExportDropdownProps<T>) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      const data = await getData();
      if (data.length === 0) {
        toast.warning("Geen data om te exporteren");
        return;
      }
      exportToCSV(data, columns, filename);
      toast.success(`${data.length} rij(en) geexporteerd naar CSV`);
    } catch (error) {
      console.error("Export CSV error:", error);
      toast.error("Fout bij exporteren naar CSV");
    } finally {
      setIsExporting(false);
    }
  }, [getData, columns, filename]);

  const handleExportExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      const data = await getData();
      if (data.length === 0) {
        toast.warning("Geen data om te exporteren");
        return;
      }
      await exportToExcel(data, columns, filename, sheetName);
      toast.success(`${data.length} rij(en) geexporteerd naar Excel`);
    } catch (error) {
      console.error("Export Excel error:", error);
      toast.error("Fout bij exporteren naar Excel");
    } finally {
      setIsExporting(false);
    }
  }, [getData, columns, filename, sheetName]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={buttonVariant}
          size={buttonSize}
          disabled={disabled || isExporting}
          className={className}
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {buttonLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV} disabled={isExporting}>
          <FileText className="mr-2 h-4 w-4" />
          CSV downloaden
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExportExcel} disabled={isExporting}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Excel downloaden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================
// Pre-configured export column definitions
// ============================================

import {
  formatExportDate,
  formatExportCurrency,
} from "@/lib/export-utils";

/**
 * Offerte export columns
 */
export const offerteExportColumns: ExportColumn<Record<string, unknown>>[] = [
  { key: "offerteNummer", header: "Offerte Nr." },
  { key: "type", header: "Type" },
  { key: "status", header: "Status" },
  { key: "klantNaam", header: "Klant" },
  { key: "klantAdres", header: "Adres" },
  { key: "klantPostcode", header: "Postcode" },
  { key: "klantPlaats", header: "Plaats" },
  { key: "klantEmail", header: "E-mail" },
  { key: "klantTelefoon", header: "Telefoon" },
  {
    key: "materiaalkosten",
    header: "Materiaalkosten",
    format: (v) => formatExportCurrency(v as number),
  },
  {
    key: "arbeidskosten",
    header: "Arbeidskosten",
    format: (v) => formatExportCurrency(v as number),
  },
  { key: "totaalUren", header: "Totaal Uren" },
  {
    key: "subtotaal",
    header: "Subtotaal",
    format: (v) => formatExportCurrency(v as number),
  },
  {
    key: "marge",
    header: "Marge",
    format: (v) => formatExportCurrency(v as number),
  },
  { key: "margePercentage", header: "Marge %" },
  {
    key: "totaalExBtw",
    header: "Totaal ex. BTW",
    format: (v) => formatExportCurrency(v as number),
  },
  {
    key: "btw",
    header: "BTW",
    format: (v) => formatExportCurrency(v as number),
  },
  {
    key: "totaalInclBtw",
    header: "Totaal incl. BTW",
    format: (v) => formatExportCurrency(v as number),
  },
  {
    key: "aangemaakt",
    header: "Aangemaakt",
    format: (v) => formatExportDate(v as number),
  },
  {
    key: "bijgewerkt",
    header: "Bijgewerkt",
    format: (v) => formatExportDate(v as number),
  },
  {
    key: "verzonden",
    header: "Verzonden",
    format: (v) => formatExportDate(v as number | null),
  },
];

/**
 * Klanten export columns
 */
export const klantenExportColumns: ExportColumn<Record<string, unknown>>[] = [
  { key: "naam", header: "Naam" },
  { key: "adres", header: "Adres" },
  { key: "postcode", header: "Postcode" },
  { key: "plaats", header: "Plaats" },
  { key: "email", header: "E-mail" },
  { key: "telefoon", header: "Telefoon" },
  { key: "notities", header: "Notities" },
  { key: "aantalOffertes", header: "Aantal Offertes" },
  {
    key: "totaleOmzet",
    header: "Totale Omzet",
    format: (v) => formatExportCurrency(v as number),
  },
  {
    key: "aangemaakt",
    header: "Aangemaakt",
    format: (v) => formatExportDate(v as number),
  },
  {
    key: "bijgewerkt",
    header: "Bijgewerkt",
    format: (v) => formatExportDate(v as number),
  },
];

/**
 * Projecten export columns
 */
export const projectenExportColumns: ExportColumn<Record<string, unknown>>[] = [
  { key: "projectNaam", header: "Project" },
  { key: "status", header: "Status" },
  { key: "offerteNummer", header: "Offerte Nr." },
  { key: "klantNaam", header: "Klant" },
  { key: "klantPlaats", header: "Plaats" },
  {
    key: "offerteBedrag",
    header: "Offerte Bedrag",
    format: (v) => formatExportCurrency(v as number),
  },
  { key: "begroteUren", header: "Begrote Uren" },
  { key: "geregistreerdeUren", header: "Geregistreerde Uren" },
  { key: "geschatteDagen", header: "Geschatte Dagen" },
  { key: "teamGrootte", header: "Team Grootte" },
  {
    key: "aangemaakt",
    header: "Aangemaakt",
    format: (v) => formatExportDate(v as number),
  },
  {
    key: "bijgewerkt",
    header: "Bijgewerkt",
    format: (v) => formatExportDate(v as number),
  },
];

/**
 * Facturen export columns
 */
export const facturenExportColumns: ExportColumn<Record<string, unknown>>[] = [
  { key: "factuurnummer", header: "Factuurnummer" },
  { key: "status", header: "Status" },
  { key: "klantNaam", header: "Klant" },
  { key: "klantAdres", header: "Adres" },
  { key: "klantPostcode", header: "Postcode" },
  { key: "klantPlaats", header: "Plaats" },
  { key: "klantEmail", header: "E-mail" },
  {
    key: "subtotaal",
    header: "Subtotaal",
    format: (v) => formatExportCurrency(v as number),
  },
  { key: "btwPercentage", header: "BTW %" },
  {
    key: "btwBedrag",
    header: "BTW Bedrag",
    format: (v) => formatExportCurrency(v as number),
  },
  {
    key: "totaalInclBtw",
    header: "Totaal incl. BTW",
    format: (v) => formatExportCurrency(v as number),
  },
  {
    key: "factuurdatum",
    header: "Factuurdatum",
    format: (v) => formatExportDate(v as number),
  },
  {
    key: "vervaldatum",
    header: "Vervaldatum",
    format: (v) => formatExportDate(v as number),
  },
  { key: "betalingstermijnDagen", header: "Betalingstermijn (dagen)" },
  {
    key: "verzondenOp",
    header: "Verzonden Op",
    format: (v) => formatExportDate(v as number | null),
  },
  {
    key: "betaaldOp",
    header: "Betaald Op",
    format: (v) => formatExportDate(v as number | null),
  },
  {
    key: "aangemaakt",
    header: "Aangemaakt",
    format: (v) => formatExportDate(v as number),
  },
];

/**
 * Uren export columns
 */
export const urenExportColumns: ExportColumn<Record<string, unknown>>[] = [
  { key: "datum", header: "Datum" },
  { key: "medewerker", header: "Medewerker" },
  { key: "projectNaam", header: "Project" },
  { key: "scope", header: "Scope" },
  { key: "uren", header: "Uren" },
  { key: "notities", header: "Notities" },
  { key: "bron", header: "Bron" },
];

/**
 * Medewerkers export columns
 */
export const medewerkersExportColumns: ExportColumn<Record<string, unknown>>[] = [
  { key: "naam", header: "Naam" },
  { key: "email", header: "E-mail" },
  { key: "telefoon", header: "Telefoon" },
  { key: "functie", header: "Functie" },
  { key: "contractType", header: "Contract Type" },
  {
    key: "uurtarief",
    header: "Uurtarief",
    format: (v) => formatExportCurrency(v as number),
  },
  { key: "isActief", header: "Actief" },
  { key: "totaalUren", header: "Totaal Uren" },
  { key: "aantalRegistraties", header: "Aantal Registraties" },
  {
    key: "aangemaakt",
    header: "Aangemaakt",
    format: (v) => formatExportDate(v as number),
  },
  {
    key: "bijgewerkt",
    header: "Bijgewerkt",
    format: (v) => formatExportDate(v as number),
  },
];
