// Re-export voor achterwaartse compatibiliteit. De vroegere statische
// `styles` (Helvetica, felgroen) zijn vervallen: alle PDF's lopen via
// createPdfTheme in pdf-theme.ts (huisstijl okt 2026). Nieuwe code importeert
// rechtstreeks uit pdf-theme.ts.
export { formatCurrency, formatDate } from "./pdf-theme";
