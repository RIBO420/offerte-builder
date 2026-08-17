# PDF Template System — Design Spec

## Overzicht

Een template- en brandingsysteem voor alle PDF-documenten in de offerte-builder. Gebruikers kunnen hun logo, kleuren en voorwaardenteksten instellen, en kiezen uit 3 professionele template-stijlen. Alle documenttypen (offerte, factuur, contract, aanmaning, creditnota) gebruiken dezelfde theme engine.

## Scope

### In scope
- Branding-instellingen (logo, kleuren) opslaan in bedrijfsgegevens
- 3 template-stijlen: Klassiek, Minimalistisch, Bold
- PDF theme engine die branding + stijl vertaalt naar concrete styles
- Contract PDF (nieuw) op basis van bestaande onderhoudscontracten data
- Refactoring van 4 bestaande PDF-templates naar theme-based rendering
- Settings UI tab "Huisstijl & PDF" met live preview
- Voorwaardenteksten per documenttype

### Buiten scope
- Drag-and-drop template editor (WYSIWYG)
- Gebruikers uploaden eigen PDF templates
- Meertalige PDF's
- Digitale handtekeningen

## Architectuur

```
bedrijfsgegevens (Convex)
  ├── pdfLogoStorageId        → Logo bestand in Convex Storage
  ├── pdfPrimaireKleur        → Hex kleurcode (default: #16a34a)
  ├── pdfSecundaireKleur      → Hex kleurcode (default: #1a1a1a)
  ├── pdfTemplateStijl        → "klassiek" | "minimalistisch" | "bold"
  └── pdfVoorwaarden          → { offerte, factuur, contract } teksten
           │
           ▼
  src/components/pdf/pdf-theme.ts
  createPdfTheme(branding, stijl) → PdfTheme object
           │
           ▼
  PDF componenten (accepteren PdfTheme als prop)
  ├── offerte-pdf.tsx
  ├── factuur-pdf.tsx
  ├── contract-pdf.tsx (NIEUW)
  ├── aanmaning-pdf.tsx
  └── creditnota-pdf.tsx
```

Geen nieuwe Convex tabellen. Alle instellingen worden opgeslagen als extra velden op de bestaande `bedrijfsgegevens` tabel.

## Schema-uitbreiding

Nieuwe velden op `bedrijfsgegevens` in `convex/schema.ts`:

```typescript
// PDF Branding
pdfLogoStorageId: v.optional(v.id("_storage")),
pdfPrimaireKleur: v.optional(v.string()),      // hex, default "#16a34a"
pdfSecundaireKleur: v.optional(v.string()),     // hex, default "#1a1a1a"

// Template stijl
pdfTemplateStijl: v.optional(v.union(
  v.literal("klassiek"),
  v.literal("minimalistisch"),
  v.literal("bold")
)),

// Voorwaardenteksten per documenttype
pdfVoorwaarden: v.optional(v.object({
  offerte: v.optional(v.string()),
  factuur: v.optional(v.string()),
  contract: v.optional(v.string()),
})),
```

Alle velden zijn `v.optional()` — backward compatible. Bij ontbrekende waarden worden de huidige hardcoded defaults gebruikt (= "klassiek" stijl met groen).

## PDF Theme Engine

### Bestand: `src/components/pdf/pdf-theme.ts`

Vervangt de huidige `pdf-styles.ts` als de primaire styling-bron.

### Interface

```typescript
interface PdfBranding {
  logoUrl: string | null;           // Convex storage URL of null
  primaireKleur: string;            // hex
  secundaireKleur: string;          // hex
  bedrijfsnaam: string;
  bedrijfsgegevens: {               // bestaande bedrijfsgegevens data
    kvkNummer?: string;
    btwNummer?: string;
    iban?: string;
    adres?: string;
    telefoon?: string;
    email?: string;
  };
}

type TemplateStijl = "klassiek" | "minimalistisch" | "bold";

interface PdfTheme {
  stijl: TemplateStijl;
  branding: PdfBranding;
  colors: {
    primary: string;
    secondary: string;
    text: string;
    muted: string;
    background: string;
    tableHeaderBg: string;
    tableHeaderText: string;
    tableAltRowBg: string;
    border: string;
  };
  spacing: {
    pagePadding: number;
    sectionGap: number;
    itemGap: number;
  };
  typography: {
    headerSize: number;
    titleSize: number;
    bodySize: number;
    smallSize: number;
    fontFamily: string;
  };
  header: {
    showColorBar: boolean;
    colorBarHeight: number;
    logoSize: number;
    layout: "side-by-side" | "stacked" | "banner";
  };
  table: {
    headerStyle: "filled" | "underlined" | "dark";
    showBorders: boolean;
    alternateRows: boolean;
  };
  footer: {
    showLine: boolean;
    style: "compact" | "spacious" | "banner";
  };
  styles: ReturnType<typeof StyleSheet.create>;  // @react-pdf StyleSheet
}
```

### `createPdfTheme(branding, stijl): PdfTheme`

Neemt branding-waarden + stijlnaam en retourneert een compleet PdfTheme object met alle concrete stijlwaarden. Bevat ook het `@react-pdf/renderer` StyleSheet zodat componenten `theme.styles.xxx` kunnen gebruiken.

### Stijl-definities

| Token | Klassiek | Minimalistisch | Bold |
|-------|----------|----------------|------|
| **Header layout** | Logo + naam naast elkaar, kleur-balk onder | Logo links, tekst rechts, dunne lijn | Grote gekleurde header-band met witte tekst |
| **Tabel headers** | Gekleurde achtergrond, witte tekst | Geen achtergrond, dikke onderlijn | Donkere achtergrond, witte tekst |
| **Alternerende rijen** | Ja (licht grijs) | Nee | Ja (licht gekleurd) |
| **Sectiescheidingen** | Gekleurde lijn + titel | Extra witruimte, kleine caps titel | Gekleurde badge-stijl titel |
| **Footer** | Horizontale lijn + bedrijfsgegevens centraal | Kleine tekst rechtsonder | Gekleurde band met contactinfo |
| **Page padding** | 40px | 48px | 36px |
| **Body font size** | 10pt | 9pt | 10pt |
| **Header font size** | 18pt | 16pt | 22pt |

De bestaande `pdf-styles.ts` wordt behouden als de "klassiek" baseline en gerefactord naar de theme engine. De functies `formatCurrency()` en `formatDate()` verhuizen naar `pdf-theme.ts`.

## Contract PDF (nieuw)

### Bestand: `src/components/pdf/contract-pdf.tsx`

### Data-bronnen (uit Convex schema)
- `onderhoudscontracten` — contractdetails, klant, locatie, looptijd
- `contractWerkzaamheden` — werk per seizoen met hoeveelheden en prijzen
- `contractFacturen` — betalingsschema (optioneel tonen)

### Secties
1. **Header** — bedrijfslogo, contractnummer, datum (via theme)
2. **Klantgegevens** — naam, adres, contactinfo
3. **Contractdetails** — looptijd, locatie (indien afwijkend van klantadres), bereikbaarheid
4. **Werkzaamheden per seizoen** — tabel met omschrijving, eenheid, hoeveelheid, prijs per seizoen (voorjaar, zomer, herfst, winter)
5. **Prijsoverzicht** — subtotaal per seizoen, jaartotaal excl. BTW, BTW, totaal incl. BTW
6. **Betalingsvoorwaarden** — termijnen, factureringsmomenten
7. **Voorwaarden** — uit pdfVoorwaarden.contract of default tekst
8. **Handtekeningblok** — twee kolommen: bedrijf en klant met datumregel en handtekeninglijn
9. **Footer** — bedrijfsgegevens (via theme)

### Props

```typescript
interface ContractPdfProps {
  contract: ContractData;
  werkzaamheden: ContractWerkzaamheid[];
  theme: PdfTheme;
}
```

### Convex query

Nieuwe query `contracten.getForPdf` die contract + werkzaamheden + klantgegevens in één call retourneert.

## Refactoring bestaande PDFs

Alle 4 bestaande PDF-componenten worden aangepast:

### Wijzigingen per component

**Alle componenten:**
- Nieuwe prop: `theme: PdfTheme`
- Hardcoded kleuren (`#16a34a`, `#1a1a1a`, etc.) → `theme.colors.xxx`
- Hardcoded spacing → `theme.spacing.xxx`
- Hardcoded font sizes → `theme.typography.xxx`
- Logo rendering: `theme.branding.logoUrl ? <Image src={logoUrl} /> : <LogoPlaceholder />`
- Footer: bedrijfsgegevens uit `theme.branding.bedrijfsgegevens`
- Header layout switch op `theme.header.layout`
- Tabel styling switch op `theme.table.headerStyle`

**offerte-pdf.tsx:**
- Voeg voorwaardentekst toe uit `theme` (pdfVoorwaarden.offerte)
- Bestaande scopebadge-kleuren → theme.colors.primary

**factuur-pdf.tsx:**
- Voeg voorwaardentekst toe uit `theme` (pdfVoorwaarden.factuur)
- Betalingsgegevens sectie krijgt theme styling

**aanmaning-pdf.tsx & creditnota-pdf.tsx:**
- Theme-kleuren en styling
- Geen aparte voorwaardentekst (gebruiken factuur-voorwaarden)

### Backward compatibility

De `bedrijfsgegevens` prop die nu al aan PDF-componenten wordt meegegeven blijft werken. De `PdfTheme` wropt hier omheen. Als er geen theme beschikbaar is, wordt een default "klassiek" theme met bestaande bedrijfsgegevens gebruikt.

## PDF Download & Preview

### Bestaand (blijft werken)
- `PDFDownloadButton` — download knop op offerte/factuur pagina's
- `PdfPreviewModal` — preview modal voor offertes
- `usePDFGeneration` hook — PDF generatie met progress tracking

### Uitbreidingen
- `PDFDownloadButton` krijgt `theme` prop (haalt uit bedrijfsgegevens query)
- `PdfPreviewModal` wordt generiek: werkt voor alle documenttypen
- Contract pagina krijgt dezelfde download/preview knoppen

### Nieuwe generieke preview component

```typescript
interface DocumentPdfPreviewProps {
  documentType: "offerte" | "factuur" | "contract" | "aanmaning" | "creditnota";
  data: OfferteData | FactuurData | ContractData | AanmaningData | CreditnotaData;
  theme: PdfTheme;
}
```

Rendert het juiste PDF-component op basis van `documentType` in een preview modal.

## Settings UI

### Nieuwe tab: "Huisstijl & PDF"

Locatie: `src/app/(dashboard)/instellingen/components/huisstijl-tab.tsx`

### Sectie 1: Branding

- **Logo upload**: Drag-and-drop zone, accepteert PNG/JPG/SVG, max 2MB. Preview van huidig logo. Upload naar Convex Storage, sla storageId op. Verwijder-knop.
- **Primaire kleur**: Kleurenpicker (hex input + visuele picker). Default: #16a34a. Live preview van kleur naast picker.
- **Secundaire kleur**: Zelfde als primaire. Default: #1a1a1a.

### Sectie 2: Template stijl

3 visuele kaarten naast elkaar:

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  [preview]  │  │  [preview]  │  │  [preview]  │
│             │  │             │  │             │  
│  Klassiek   │  │Minimalistisch│ │    Bold     │
│  ○ Select   │  │  ○ Select   │  │  ○ Select   │
└─────────────┘  └─────────────┘  └─────────────┘
```

Elke kaart toont een statische mini-preview afbeelding die de stijl illustreert. Radio-selectie — één actief tegelijk.

### Sectie 3: Voorwaardenteksten

Accordion met 3 secties:
- **Offerte voorwaarden** — textarea, placeholder met default tekst
- **Factuur voorwaarden** — textarea
- **Contract voorwaarden** — textarea

### Sectie 4: Preview

"Bekijk voorbeeld-PDF" knop die een dummy offerte genereert met de huidige instellingen en toont in de preview modal.

### Convex mutations

Nieuwe mutation `instellingen.updatePdfBranding`:
```typescript
args: {
  pdfLogoStorageId: v.optional(v.id("_storage")),
  pdfPrimaireKleur: v.optional(v.string()),
  pdfSecundaireKleur: v.optional(v.string()),
  pdfTemplateStijl: v.optional(v.union(...)),
  pdfVoorwaarden: v.optional(v.object({...})),
}
```

Logo upload gebruikt bestaande `fotoStorage.generateUploadUrl` pattern.

## Implementatievolgorde

### Fase 1: Foundation (theme engine + schema)
1. Schema uitbreiden met PDF branding velden
2. `pdf-theme.ts` bouwen met createPdfTheme functie
3. 3 stijl-definities implementeren
4. Convex mutation voor branding opslaan

### Fase 2: Bestaande PDFs refactoren
5. `offerte-pdf.tsx` refactoren naar theme-based
6. `factuur-pdf.tsx` refactoren naar theme-based
7. `aanmaning-pdf.tsx` refactoren naar theme-based
8. `creditnota-pdf.tsx` refactoren naar theme-based
9. `pdf-styles.ts` functies migreren naar `pdf-theme.ts`

### Fase 3: Contract PDF
10. Convex query `contracten.getForPdf`
11. `contract-pdf.tsx` bouwen
12. Download/preview knoppen op contract pagina

### Fase 4: Settings UI
13. `huisstijl-tab.tsx` — branding sectie (logo, kleuren)
14. Template stijl selector
15. Voorwaardenteksten editor
16. Live preview functionaliteit
17. Tab toevoegen aan instellingen pagina

### Fase 5: Integratie
18. PDFDownloadButton theme prop doorvoeren
19. Preview modals generiek maken
20. Alle pagina's (offerte, factuur, contract) voorzien van preview/download

## Risico's en mitigatie

| Risico | Mitigatie |
|--------|----------|
| @react-pdf ondersteunt beperkte CSS | Theme engine genereert alleen ondersteunde properties. Testen per stijl. |
| Logo aspect ratio varieert | Vaste max-hoogte (60px), breedte auto-scale |
| Bestaande PDFs breken na refactor | Backward compatible: geen theme = default klassiek theme |
| Performance bij live preview | Preview genereert maar 1 pagina, lazy load @react-pdf |
