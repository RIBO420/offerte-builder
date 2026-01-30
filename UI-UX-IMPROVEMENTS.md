# Offerte Builder - UI/UX Verbeterplan

> **Versie:** 1.0  
> **Datum:** Januari 2026  
> **Doel:** Professionele UI/UX audit met concrete verbeterpunten voor Top Tuinen Offerte Builder

---

## 1. Overzicht

Dit document bevat een professionele UI/UX analyse van de Offerte Builder applicatie. De analyse richt zich op visueel design, interactiepatronen, informatiearchitectuur en gebruikersworkflows die nog niet zijn behandeld in `IMPROVEMENTS-v1.md`.

### Huidige Sterke Punten
- ✅ Goede basis component library (shadcn/ui)
- ✅ Consistente kleuren en typografie
- ✅ Functionele wizard met stappenindicatie
- ✅ Responsive layouts
- ✅ Dark mode support
- ✅ Skeleton loading states

---

## 2. Visueel Design & Branding

### 2.1 Kleurstrategie

**Probleem:**
- Primary color (zwart/OKLCH 0.205) is te generiek en mist merkidentiteit
- Geen accentkleuren voor Tuin/Aanleg thematiek
- Charts gebruiken generieke kleuren zonder semantische betekenis

**Verbeteringen:**

| Element | Huidig | Voorgesteld | Ratio |
|---------|--------|-------------|-------|
| Primary | Zwart OKLCH | Bosgroen `#2D5A3D` | - |
| Accent | - | Aardebruin `#8B6914` | 10% |
| Success | Groen | Natuurlijk groen `#3D8B5A` | - |
| Charts | 5 generiek | Scope-gekoppeld | - |

**Scope-kleur Mapping:**
```css
--scope-grondwerk: #8B6914;    /* Aarde */
--scope-bestrating: #6B7280;    /* Steen */
--scope-borders: #2D5A3D;       /* Groen */
--scope-gras: #65A30D;          /* Gras */
--scope-houtwerk: #92400E;      /* Hout */
--scope-water: #0369A1;         /* Water */
--scope-specials: #7C3AED;      /* Special */
```

### 2.2 Typografie

**Probleem:**
- Te veel font-sizes door het hele applicatie (8+ verschillende)
- Geen duidelijke hierarchie in data-dense schermen
- Line-height te strak in cards

**Voorgestelde Schaal:**
```
--text-2xl: 1.5rem    (pagina titels)
--text-xl: 1.25rem    (sectie headers)
--text-lg: 1.125rem   (card titels)
--text-base: 1rem     (body)
--text-sm: 0.875rem   (labels, meta)
--text-xs: 0.75rem    (tags, hints)
```

**Implementatie:**
- [ ] Line-height voor cards: `1.6` (nu impliciet ~1.4)
- [ ] Font-weight consistentie: labels `font-medium`, values `font-normal`
- [ ] Tabular nums voor bedragen: `font-variant-numeric: tabular-nums`

### 2.3 Visuele Hiërarchie

**Probleem:**
- Cards hebben gelijke visuele gewicht ondanks verschillende importantie
- Primary actions niet duidelijk genoeg onderscheiden
- Te veel borders creëren "border soup"

**Oplossingen:**

```
Prioriteit A (Hoog):
- Main action cards: Subtiele schaduw + primary border
- Totalen card: Uitgelichte achtergrond primary/5

Prioriteit B (Medium):
- Content cards: Enkel border
- Form sections: Subtiele achtergrond tint

Prioriteit C (Laag):
- Info cards: Geen border, lichte achtergrond
- Meta data: Verkleurde tekst
```

---

## 3. Interactie & Micro-interacties

### 3.1 Feedback System

**Missende Feedback:**
- Geen loading state bij scope calculaties
- Geen visuele confirmatie bij auto-save
- Geen progress indication bij PDF generatie

**Implementatie:**

```typescript
// Calculatie loading indicator
interface CalculationFeedbackProps {
  isCalculating: boolean;
  affectedScopes: string[];
}

// Toast met actie
interface ActionToastProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  undo?: () => void;
}
```

**Micro-interacties Checklist:**
- [ ] Scope checkbox: Spring animatie + kleur transitie
- [ ] Prijs velden: Count-up animatie bij wijziging
- [ ] Cards: Subtiele lift effect on hover (`translateY(-2px)`)
- [ ] Buttons: Scale down on press (`scale(0.98)`)
- [ ] Tab switch: Content fade in (`opacity 0→1, 150ms`)

### 3.2 Form Interacties

**Probleem:**
- Geen "dirty state" indicatie (veld is gewijzigd)
- Geen inline validatie bij paste/acties
- Tab navigatie niet geoptimaliseerd

**Verbeteringen:**

| Interactie | Huidig | Verbeterd |
|------------|--------|-----------|
| Veldfocus | Ring | Ring + subtle glow |
| Dirty state | Geen | Gele/oranje border |
| Valid | Groen check | Groen border + check |
| Invalid | Rode border | Rode border + shake |
| Berekening | Instant | 300ms debounce + spinner |

---

## 4. Informatie Architectuur

### 4.1 Dashboard Herstructurering

**Huidig:**
```
Dashboard
├── Welkom
├── Quick Actions (2 cards)
├── Stats (4 cards)
└── Recent Activity
```

**Voorgesteld:**
```
Dashboard
├── Header
│   ├── Welkom + Datum
│   └── Snelle stats (inline)
├── Priority Queue [NIEUW]
│   ├── Offertes die actie nodig hebben
│   └── Overdue/offerte reminders
├── Quick Actions
│   ├── 2x Primary buttons (uitgelicht)
│   └── 2x Secundaire shortcuts
├── Analytics Preview [NIEUW]
│   ├── Mini grafiek: Offertes per maand
│   └── Win rate indicator
└── Recent Activity (compact)
```

### 4.2 Offerte Detail Pagina

**Huidige Problemen:**
- Timeline card verplaatst te veel focus van totalen
- Regels tabel breekt op mobile
- Klant info verdeeld over meerdere cards

**Herstructurering:**

```
Offerte Detail
├── Header
│   ├── Back + Titel + Status
│   └── Action bar (icons + dropdown)
├── Split View
│   ├── Left (60%)
│   │   ├── Klant Card [condensed]
│   │   ├── Scopes Tags
│   │   └── Regels Accordion [NIEUW]
│   └── Right (40%)
│       ├── Totalen Card [sticky]
│       │   ├── Breakdown
│       │   ├── Marge indicator [NIEUW]
│       │   └── Snelle acties
│       └── Timeline [compact]
└── Chat/Communicatie [tabblad]
```

**Regels Accordion:**
- Scope-groepering inplaats van flat list
- Expand/collapse per scope
- Inline edit mogelijkheid
- Subtotalen per scope

### 4.3 Wizard Flow Optimalisatie

**Huidig:** Stappen 0-3 lineair

**Voorgesteld:**
```
Step 0: Template/Pakket Selectie
        ↓
Step 1: Klant & Locatie
        ├── Klant selector
        ├── Locatie kaart [NIEUW]
        └── Bereikbaarheid foto upload [NIEUW]
        ↓
Step 2: Scope Configuratie
        ├── Scope selector (grid)
        └── Dependency graph [NIEUW]
        ↓
Step 3: Scope Details
        ├── Per scope: Form card
        └── Running total sidebar [NIEUW]
        ↓
Step 4: Review & Finalize [NIEUW]
        ├── Samenvatting per scope
        ├── Marge aanpassing
        └── Voorbeeld PDF
```

---

## 5. Data Visualisatie

### 5.1 Prijs & Marge Visualisatie

**Nieuwe Componenten:**

```typescript
// Prijs breakdown chart
interface PriceBreakdownChartProps {
  materialen: number;
  arbeid: number;
  marge: number;
  btw: number;
}

// Marge indicator
interface MargeIndicatorProps {
  percentage: number;
  industryAverage: number; // 15-20%
}

// Scope kosten verdeling
interface ScopeCostDistributionProps {
  scopes: Array<{
    name: string;
    cost: number;
    percentage: number;
  }>;
}
```

**Visualisaties:**
- [ ] Donut chart voor kosten verdeling
- [ ] Progress bar voor marge vs target
- [ ] Bar chart voor scope kosten vergelijking
- [ ] Sparkline voor offerte history (bij edit)

### 5.2 Status & Workflow Visualisatie

**Pipeline View [NIEUW]:**
```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Concept │ → │Definitief│ → │Verzonden │ → │Geaccepteerd│
│   (3)   │    │   (5)   │    │   (2)   │    │   (8)   │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     ↓
┌─────────┐
│Afgewezen│
│   (1)   │
└─────────┘
```

---

## 6. Mobile & Touch Optimalisatie

### 6.1 Touch Targets

**Huidige Problemen:**
- Checkboxen te klein (24px, moet 44px zijn)
- Dropdown triggers te smal
- Table rows niet swipeable

**Fixes:**
| Element | Huidig | Doel |
|---------|--------|------|
| Checkbox | 24px | 44px touch area |
| Buttons | 36px | 44px min |
| Table rows | - | Swipe actions |
| Cards | Static | Long press menu |

### 6.2 Mobile-First Forms

**Wizard Mobile Layout:**
```
[Progress bar - compact]
[Step indicator - dots]
[Content - single column]
[Floating action bar - sticky bottom]
```

**Scope Forms Mobile:**
- Collapsible sections
- Full-width inputs
- Number pad voor numerieke velden
- Voice input ondersteuning [future]

### 6.3 Offline Indicator

**Nieuwe Component:**
```typescript
interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingChanges: number;
  lastSync: Date;
}
```

---

## 7. Toegankelijkheid (A11y)

### 7.1 Focus Management

**Verbeteringen:**
- [ ] Skip links voor wizard stappen
- [ ] Focus trap in modals
- [ ] Focus restore na actie
- [ ] Visibele focus indicators (niet alleen ring)

### 7.2 Screen Reader Support

**ARIA Enhancements:**
```html
<!-- Wizard stepper -->
<nav aria-label="Wizard voortgang">
  <ol>
    <li aria-current="step">Huidige stap</li>
    <li aria-disabled="true">Toekomstige stap</li>
  </ol>
</nav>

<!-- Scope cards -->
<div role="group" aria-label="Scope selectie">
  <label>
    <input type="checkbox" aria-describedby="scope-help">
    <span>Grondwerk</span>
  </label>
  <span id="scope-help">Inclusief afvoer</span>
</div>
```

### 7.3 Kleur & Contrast

**Checks:**
- [ ] Alle status kleuren: WCAG AA (4.5:1)
- [ ] Placeholder tekst: Niet te licht
- [ ] Error states: Niet alleen kleur (icon + text)
- [ ] Focus states: Duidelijk zichtbaar

---

## 8. Formulier UX

### 8.1 Input Patterns

**Smart Defaults:**
```typescript
// Context-aware defaults
const smartDefaults = {
  postcode: {
    pattern: "[0-9]{4}[ ]?[A-Z]{2}",
    inputMode: "numeric",
    autoComplete: "postal-code",
  },
  telefoon: {
    pattern: "[0-9]{2}-[0-9]{8}",
    inputMode: "tel",
    autoComplete: "tel",
  },
  oppervlakte: {
    suffix: "m²",
    step: 0.5,
    min: 0,
    max: 10000,
  },
};
```

### 8.2 Validatie UX

**Real-time Strategie:**
| Validatie type | Wanneer | Feedback |
|----------------|---------|----------|
| Format | onBlur | Inline error |
| Required | onSubmit | Summary |
| Range | onChange | Inline hint |
| Cross-field | onBlur | Field error |

### 8.3 Formulier Afbakening

**Field Grouping:**
```
[Persoonlijke gegevens]
├── Naam
├── Telefoon
└── Email

[Adresgegevens]
├── Straat
├── Nummer
├── Postcode
└── Plaats
```

---

## 9. Navigatie & Wayfinding

### 9.1 Breadcrumbs

**Verbeteringen:**
- [ ] Klikbare parent items
- [ ] Dropdown voor lange paden
- [ ] Mobile: Alleen parent + huidige

### 9.2 Zoek & Command Palette [NIEUW]

**Global Search:**
```typescript
interface CommandPaletteProps {
  items: Array<{
    type: "offerte" | "klant" | "actie";
    title: string;
    subtitle?: string;
    icon: IconType;
    action: () => void;
    shortcut?: string;
  }>;
}
```

**Shortcuts:**
- `Cmd/Ctrl + K` - Open zoeken
- `Cmd/Ctrl + N` - Nieuwe offerte
- `Cmd/Ctrl + O` - Offertes lijst
- `Cmd/Ctrl + /` - Keyboard shortcuts help

### 9.3 Contextual Navigation

**Secondary Actions:**
```
[Offerte Detail]
├── Primary: Bewerken
├── Secondary: 
│   ├── Dupliceren
│   ├── Email verzenden
│   ├── PDF downloaden
│   └── Delen
└── Tertiary:
    ├── Geschiedenis
    └── Verwijderen
```

---

## 10. Error Handling UX

### 10.1 Error Types & Responses

| Type | Voorbeeld | Response |
|------|-----------|----------|
| Validatie | Ongeldige postcode | Inline error |
| Berekening | Ontbrekende data | Warning banner |
| Network | API timeout | Retry option |
| Permission | Geen toegang | Redirect + toast |
| System | Crash | Error boundary |

### 10.2 Error Recovery

**Implementatie:**
```typescript
interface ErrorRecoveryProps {
  error: Error;
  type: "retryable" | "fatal" | "validation";
  actions: Array<{
    label: string;
    handler: () => void;
    primary?: boolean;
  }>;
}
```

### 10.3 Empty States

**Verbeterde Empty States:**
```
[Geen offertes]
├── Illustratie (tuin icon)
├── Titel: "Nog geen offertes"
├── Beschrijving: "Maak je eerste offerte..."
├── Primary CTA: "Nieuwe offerte"
└── Secondary: "Importeer bestaand"

[Zoekresultaten leeg]
├── Icon: Search
├── Titel: "Geen resultaten"
├── Beschrijving: "Probeer andere zoektermen"
└── Suggesties: [Recente klanten]
```

---

## 11. Implementatie Roadmap

### Fase 1: Quick Wins (Week 1)
- [ ] Touch targets vergroten
- [ ] Focus indicators verbeteren
- [ ] Empty states toevoegen
- [ ] Tabular nums voor bedragen

### Fase 2: Visual Polish (Week 2-3)
- [ ] Card hierarchie implementeren
- [ ] Scope kleuren toevoegen
- [ ] Micro-interacties (hover, focus)
- [ ] Prijs animaties

### Fase 3: Mobile Optimalisatie (Week 4)
- [ ] Mobile wizard layout
- [ ] Swipe actions voor tabellen
- [ ] Sticky action bars
- [ ] Bottom sheets voor modals

### Fase 4: Advanced Features (Week 5-6)
- [ ] Command palette
- [ ] Prijs visualisaties
- [ ] Pipeline view
- [ ] Enhanced error handling

### Fase 5: A11y & Polish (Week 7)
- [ ] Screen reader audit
- [ ] Keyboard navigatie test
- [ ] Contrast checks
- [ ] Focus management

---

## 12. Metrics & Succesindicatoren

### Te Meten KPIs

| Metric | Huidig | Doel | Meting |
|--------|--------|------|--------|
| Mobile conversie | ?% | +20% | Analytics |
| Form completion | ?% | +15% | Events |
| Error rate | ?% | -50% | Sentry |
| Time to complete | ?min | -25% | Analytics |
| A11y score | ? | 95+ | Lighthouse |

### User Testing Checklist
- [ ] Wizard flow test met 5 gebruikers
- [ ] Mobile usability test
- [ ] Screen reader test
- [ ] Keyboard-only navigatie test

---

## 13. Design System Updates

### Nieuwe Componenten

```typescript
// Prijs display
interface PriceProps {
  amount: number;
  currency?: string;
  showDecimals?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "success" | "warning";
}

// Scope tag
interface ScopeTagProps {
  scope: ScopeType;
  size?: "sm" | "md";
  showIcon?: boolean;
  clickable?: boolean;
}

// Data card
interface DataCardProps {
  title: string;
  value: React.ReactNode;
  trend?: {
    direction: "up" | "down" | "neutral";
    percentage: number;
  };
  icon?: IconType;
}
```

### Tokens Update

```css
/* Nieuwe tokens */
--color-scope-*: ...;        /* Scope kleuren */
--color-data-positive: ...;   /* Positieve trend */
--color-data-negative: ...;   /* Negatieve trend */
--shadow-card-hover: ...;     /* Hover state */
--shadow-card-elevated: ...;  /* Uitgelichte cards */
--animation-spring: ...;      /* Spring easing */
--animation-smooth: ...;      /* Smooth easing */
```

---

## 14. Conclusie

De Offerte Builder heeft een solide basis met goede functionele werking. De focus voor UI/UX verbeteringen ligt op:

1. **Visual Polish** - Scope kleuren, betere hierarchie, micro-interacties
2. **Mobile First** - Touch optimalisatie, responsive forms
3. **Data Clarity** - Visualisaties, prijs breakdown, status pipeline
4. **Accessibility** - Screen reader support, keyboard navigatie
5. **User Efficiency** - Command palette, smart defaults, error recovery

Deze verbeteringen zullen niet alleen de esthetiek verbeteren, maar ook de productiviteit van gebruikers aanzienlijk verhogen en de foutenkans verkleinen.

---

*— Einde UI/UX Verbeterplan —*
