// Regular exports (use sparingly - react-pdf is ~500KB)
export { OffertePDF } from "./offerte-pdf";
export { PDFDownloadButton } from "./pdf-download-button";
export { styles, formatCurrency, formatDate } from "./pdf-styles";

// Dynamic exports for code-splitting (preferred)
export { DynamicPDFDownloadButton, loadPDFGeneration } from "./dynamic";
