/**
 * PDF-barrel — bevat BEWUST alleen de dynamic-varianten (optimize O3).
 *
 * De statische componenten (OffertePDF, ContractPDF, PDFDownloadButton,
 * FactuurPDF) importeren `@react-pdf/renderer` (~500 KB) statisch. Toen de
 * barrel die náást de dynamic-variant re-exporteerde, kwam die hele keten mee
 * in elke bundle die iets uit deze barrel importeerde — de code-splitting van
 * "Dynamic" was daarmee theater. Statische exports hier dus niet terugzetten;
 * consumenten importeren ze rechtstreeks uit het bronbestand, bij voorkeur
 * via `await import(...)` in een handler:
 *
 *   import { OffertePDF } from "@/components/pdf/offerte-pdf";
 *   import { createPdfTheme } from "@/components/pdf/pdf-theme";
 */
export { DynamicPDFDownloadButton, loadPDFGeneration } from "./dynamic";
