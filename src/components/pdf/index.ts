// Regular exports (use sparingly - react-pdf is ~500KB)
export { OffertePDF } from "./offerte-pdf";
export { ContractPDF } from "./contract-pdf";
export { PDFDownloadButton } from "./pdf-download-button";
export { styles, formatCurrency, formatDate } from "./pdf-styles";
export { createPdfTheme, getDefaultTheme } from "./pdf-theme";
export type { PdfBranding, PdfTheme, TemplateStijl } from "./pdf-theme";

// Dynamic exports for code-splitting (preferred)
export { DynamicPDFDownloadButton, loadPDFGeneration } from "./dynamic";
