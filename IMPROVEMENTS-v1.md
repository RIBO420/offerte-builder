# Offerte Builder - Verbeterplan v1

> **Doel:** Gebruiksgemak en efficiëntie verhogen voor dagelijks gebruik door Top Tuinen medewerkers.

---

## Fase 1: Kritieke Verbeteringen (Must-Have)

### 1.1 Auto-Save Wizard met LocalStorage
**Prioriteit:** Kritiek | **Geschatte complexiteit:** Medium

**Probleem:**
- Wizard data gaat verloren bij browser sluiten of navigeren
- Lange offertes (7 scopes) kosten 10-15 minuten - grote frustratie bij dataverlies

**Oplossing:**
- [ ] LocalStorage opslag bij elke stap-wijziging
- [ ] "Concept herstellen?" dialog bij openen wizard met bestaande draft
- [ ] Automatische cleanup na succesvolle offerte aanmaak
- [ ] Visuele indicator "Concept opgeslagen" in wizard header

**Bestanden:**
- `src/app/(dashboard)/offertes/nieuw/aanleg/page.tsx`
- `src/app/(dashboard)/offertes/nieuw/onderhoud/page.tsx`
- `src/hooks/use-wizard-autosave.ts` (nieuw)

---

### 1.2 Klantenbeheer Systeem
**Prioriteit:** Kritiek | **Geschatte complexiteit:** Groot

**Probleem:**
- Geen klantendatabase - herhaaldelijk invoeren van zelfde klantgegevens
- Geen klanthistorie of overzicht van alle offertes per klant

**Oplossing:**
- [ ] Nieuwe Convex tabel `klanten` met:
  - Naam, adres, telefoon, email
  - Notities veld
  - Aanmaakdatum, laatst gewijzigd
- [ ] Klanten overzichtspagina (`/klanten`)
- [ ] Klant zoeken/selecteren in wizard (stap 2)
- [ ] "Recente klanten" dropdown met laatste 5 klanten
- [ ] Automatisch klant aanmaken bij nieuwe offerte
- [ ] Klant detail pagina met alle gekoppelde offertes

**Bestanden:**
- `convex/schema.ts` - klanten tabel toevoegen
- `convex/klanten.ts` (nieuw)
- `src/app/(dashboard)/klanten/page.tsx` (nieuw)
- `src/app/(dashboard)/klanten/[id]/page.tsx` (nieuw)
- `src/components/offerte/klant-selector.tsx` (nieuw)

---

### 1.3 Herbereken Functionaliteit
**Prioriteit:** Kritiek | **Geschatte complexiteit:** Klein

**Probleem:**
- Handmatig bewerken van regels kan totalen inconsistent maken
- Geen manier om opnieuw te berekenen vanuit scope data

**Oplossing:**
- [ ] "Herbereken" knop op bewerken pagina
- [ ] Waarschuwing tonen wanneer totalen niet kloppen met regels
- [ ] Bevestigingsdialog: "Dit overschrijft handmatige wijzigingen"
- [ ] Optie om alleen totalen te herberekenen (behoud regels)

**Bestanden:**
- `src/app/(dashboard)/offertes/[id]/bewerken/page.tsx`
- `src/lib/offerte-calculator.ts`

---

### 1.4 Database Query Optimalisatie
**Prioriteit:** Hoog | **Geschatte complexiteit:** Klein

**Probleem:**
- Dashboard laadt 3 aparte queries (list, stats, recent)
- Geen paginering bij grote datasets

**Oplossing:**
- [ ] Gecombineerde query voor dashboard data
- [ ] Paginering voor offertes lijst (25 per pagina)
- [ ] Cursor-based pagination voor betere performance
- [ ] Loading skeletons tijdens data ophalen

**Bestanden:**
- `convex/offertes.ts`
- `src/app/(dashboard)/page.tsx`
- `src/app/(dashboard)/offertes/page.tsx`

---

## Fase 2: Gebruiksgemak Verbeteringen

### 2.1 Geavanceerd Zoeken & Filteren
**Prioriteit:** Hoog | **Geschatte complexiteit:** Medium

**Huidige staat:**
- Alleen zoeken op klantnaam en offertenummer
- 5 status tabs zonder combinatie mogelijkheid

**Oplossing:**
- [ ] Datum range filter (van - tot)
- [ ] Bedrag range filter (min - max)
- [ ] Type filter (aanleg / onderhoud)
- [ ] Combineerbare filters (status + datum + bedrag)
- [ ] Filter presets opslaan ("Mijn filters")
- [ ] URL-based filters (deelbaar)

**Bestanden:**
- `src/app/(dashboard)/offertes/page.tsx`
- `src/components/offerte/filters.tsx` (nieuw)
- `convex/offertes.ts` - query uitbreiden

---

### 2.2 Bulk Acties
**Prioriteit:** Medium | **Geschatte complexiteit:** Medium

**Oplossing:**
- [ ] Checkbox selectie in offertes tabel
- [ ] "Selecteer alle" optie
- [ ] Bulk status wijzigen
- [ ] Bulk verwijderen (met bevestiging)
- [ ] Bulk exporteren naar Excel/CSV

**Bestanden:**
- `src/app/(dashboard)/offertes/page.tsx`
- `convex/offertes.ts` - bulk mutations

---

### 2.3 Real-time Formulier Validatie
**Prioriteit:** Hoog | **Geschatte complexiteit:** Medium

**Huidige staat:**
- Validatie alleen bij "Volgende" klik
- Geen veld-specifieke foutmeldingen
- Onduidelijk welke sub-velden verplicht zijn

**Oplossing:**
- [ ] React Hook Form + Zod integratie
- [ ] Real-time validatie bij blur/change
- [ ] Inline foutmeldingen per veld
- [ ] Visuele markering verplichte velden (*)
- [ ] Afhankelijke validatie (bijv. opsluitbanden verplicht bij bestrating)
- [ ] Validatie samenvatting in sidebar

**Bestanden:**
- `src/components/offerte/scope-forms/*.tsx`
- `src/components/offerte/onderhoud-forms/*.tsx`
- `src/lib/validations/` (nieuw - Zod schemas)

---

### 2.4 Input Optimalisaties
**Prioriteit:** Medium | **Geschatte complexiteit:** Klein

**Probleem:**
- Geen debouncing op numerieke inputs (elke toets triggert herberekening)
- Geen min/max constraints
- Inconsistente decimalen

**Oplossing:**
- [ ] Debounced number input component (300ms delay)
- [ ] Min/max/step configuratie per veld
- [ ] Consistent afronding (2 decimalen voor prijzen, 1 voor m²)
- [ ] Stepper buttons (+/-) voor kleine aanpassingen

**Bestanden:**
- `src/components/ui/number-input.tsx` (nieuw)
- Alle scope-forms updaten

---

## Fase 3: UI/UX Verbeteringen

### 3.1 Consistente Status Kleuren & Icons
**Prioriteit:** Medium | **Geschatte complexiteit:** Klein

**Huidige staat:**
- Hard-coded kleuren per status
- Geen iconen voor status
- Moeilijk te onderscheiden voor kleurenblinden

**Oplossing:**
- [ ] Centraal kleurensysteem voor statussen:
  ```
  concept:     gray   + PencilIcon
  definitief:  blue   + CheckCircleIcon
  verzonden:   amber  + SendIcon
  geaccepteerd: green + ThumbsUpIcon
  afgewezen:   red    + XCircleIcon
  ```
- [ ] Badge component met icon + tekst
- [ ] Tooltip met status beschrijving

**Bestanden:**
- `src/components/ui/status-badge.tsx` (nieuw)
- `src/lib/constants/statuses.ts` (nieuw)

---

### 3.2 Verbeterde Sidebar Navigatie
**Prioriteit:** Medium | **Geschatte complexiteit:** Medium

**Huidige staat:**
- Statische navigatie op alle pagina's
- Geen recente items
- Geen context-aware acties

**Oplossing:**
- [ ] "Recente Offertes" sectie (laatste 5)
- [ ] Context-aware quick actions:
  - Dashboard: "Nieuwe Offerte" prominent
  - Offerte detail: "Dupliceren", "Bewerken"
  - Klant detail: "Nieuwe Offerte voor [Klant]"
- [ ] Inklapbare secties
- [ ] Keyboard shortcuts (Cmd+N = nieuwe offerte)

**Bestanden:**
- `src/components/app-sidebar.tsx`
- `src/hooks/use-keyboard-shortcuts.ts` (nieuw)

---

### 3.3 Wizard Progress Verbetering
**Prioriteit:** Hoog | **Geschatte complexiteit:** Medium

**Huidige staat:**
- Stappen indicator zonder detail
- Geen overzicht van ingevulde data
- Geen mogelijkheid om terug te springen naar specifieke scope

**Oplossing:**
- [ ] Stappen met checkmarks voor voltooide stappen
- [ ] Klikbare stappen om terug te navigeren
- [ ] Mini-samenvatting per voltooide stap
- [ ] Floating "Samenvatting" panel (optioneel zichtbaar)
- [ ] Progress percentage indicator

**Bestanden:**
- `src/components/offerte/wizard-steps.tsx` (nieuw)
- `src/app/(dashboard)/offertes/nieuw/aanleg/page.tsx`
- `src/app/(dashboard)/offertes/nieuw/onderhoud/page.tsx`

---

### 3.4 Responsive & Mobile Verbeteringen
**Prioriteit:** Medium | **Geschatte complexiteit:** Medium

**Huidige staat:**
- Wizard 3-kolom layout breekt op tablet
- Tabel scrollt horizontaal op mobiel
- Inputs te klein op desktop

**Oplossing:**
- [ ] Responsive breakpoints voor wizard:
  - Desktop: 3 kolommen
  - Tablet: 2 kolommen
  - Mobiel: 1 kolom (gestapeld)
- [ ] Swipeable tabs op mobiel
- [ ] Touch-friendly input sizes (min 44px)
- [ ] Collapsible sidebar op mobiel
- [ ] Sticky header met belangrijke acties

**Bestanden:**
- Alle page layouts
- `src/components/ui/responsive-table.tsx` (nieuw)

---

### 3.5 Loading States & Skeletons
**Prioriteit:** Medium | **Geschatte complexiteit:** Klein

**Huidige staat:**
- Simpele spinner tijdens laden
- Alles laadt tegelijk

**Oplossing:**
- [ ] Skeleton loaders voor:
  - Offertes tabel
  - Dashboard stats cards
  - Offerte detail
- [ ] Staggered loading (stats eerst, dan lijst)
- [ ] Optimistic updates bij mutations

**Bestanden:**
- `src/components/ui/skeleton.tsx` (uitbreiden)
- `src/components/skeletons/` (nieuw)

---

### 3.6 Improved Cards & Spacing
**Prioriteit:** Laag | **Geschatte complexiteit:** Klein

**Huidige staat:**
- Te veel cards met borders
- Inconsistente spacing (gap-4, gap-6, gap-8)

**Oplossing:**
- [ ] Subtiele achtergrondkleuren i.p.v. borders
- [ ] Consistent `gap-6` overal
- [ ] Groeperen van gerelateerde velden
- [ ] Sectie headers voor visuele scheiding

**Bestanden:**
- Alle form components
- Tailwind config aanpassen

---

## Fase 4: Geavanceerde Features

### 4.1 Offerte Versie Geschiedenis
**Prioriteit:** Medium | **Geschatte complexiteit:** Groot

**Oplossing:**
- [ ] `offerte_versions` tabel in Convex
- [ ] Automatisch versie opslaan bij wijziging
- [ ] Versie vergelijking (diff view)
- [ ] Terugdraaien naar vorige versie
- [ ] Audit log (wie, wat, wanneer)

**Bestanden:**
- `convex/schema.ts`
- `convex/offerte-versions.ts` (nieuw)
- `src/app/(dashboard)/offertes/[id]/history/page.tsx` (nieuw)

---

### 4.2 Email Integratie
**Prioriteit:** Medium | **Geschatte complexiteit:** Groot

**Oplossing:**
- [ ] Email templates (Offerte verzenden, Herinnering, Bedankt)
- [ ] "Verzend per email" knop op offerte
- [ ] PDF als bijlage
- [ ] Email tracking (verzonden/geopend)
- [ ] Resend/Mailgun integratie

**Bestanden:**
- `src/app/api/email/route.ts` (nieuw)
- `src/components/email/templates/` (nieuw)
- `convex/schema.ts` - email_logs tabel

---

### 4.3 Klant Portaal
**Prioriteit:** Laag | **Geschatte complexiteit:** Groot

**Oplossing:**
- [ ] Publieke share link per offerte
- [ ] Klant kan offerte bekijken (read-only)
- [ ] Accepteren/Afwijzen knoppen
- [ ] Commentaar/vragen formulier
- [ ] Automatische status update

**Bestanden:**
- `src/app/(public)/offerte/[token]/page.tsx` (nieuw)
- `convex/public-offertes.ts` (nieuw)

---

### 4.4 Rapportages & Analytics
**Prioriteit:** Laag | **Geschatte complexiteit:** Medium

**Oplossing:**
- [ ] Dashboard met KPIs:
  - Win rate (geaccepteerd / verzonden)
  - Gemiddelde offerte waarde
  - Omzet per maand/kwartaal
  - Top klanten
- [ ] Grafiek: offertes over tijd
- [ ] Export naar Excel
- [ ] Marge analyse per scope type

**Bestanden:**
- `src/app/(dashboard)/rapportages/page.tsx` (nieuw)
- `convex/analytics.ts` (nieuw)

---

### 4.5 Offerte Templates & Pakketten
**Prioriteit:** Laag | **Geschatte complexiteit:** Medium

**Oplossing:**
- [ ] Voorgedefinieerde scope combinaties:
  - "Klein Terras Pakket" (grondwerk + bestrating)
  - "Complete Tuin Renovatie" (alle scopes)
  - "Basis Onderhoud" (gras + borders)
- [ ] Snel-prijzen voor standaard pakketten
- [ ] Eigen templates maken en opslaan

**Bestanden:**
- `convex/templates.ts` (uitbreiden)
- `src/components/offerte/package-selector.tsx` (nieuw)

---

## Fase 5: Technische Debt & Optimalisatie

### 5.1 Type Safety Verbeteren
**Prioriteit:** Medium | **Geschatte complexiteit:** Medium

**Huidige staat:**
- `scopeData: v.any()` in Convex schema
- Geen runtime validatie

**Oplossing:**
- [ ] Specifieke validators per scope type
- [ ] Zod schemas voor alle data types
- [ ] Runtime validatie bij mutations

**Bestanden:**
- `convex/schema.ts`
- `src/lib/validations/` (nieuw)

---

### 5.2 Error Handling
**Prioriteit:** Medium | **Geschatte complexiteit:** Klein

**Oplossing:**
- [ ] Error boundaries rond kritieke componenten
- [ ] Specifieke foutmeldingen per error type
- [ ] Retry mechanisme voor gefaalde mutations
- [ ] Error logging (Sentry integratie)

**Bestanden:**
- `src/components/error-boundary.tsx` (nieuw)
- Alle mutation calls

---

### 5.3 Accessibility (A11y)
**Prioriteit:** Laag | **Geschatte complexiteit:** Medium

**Oplossing:**
- [ ] ARIA labels voor alle interactieve elementen
- [ ] Keyboard navigatie (Tab, Enter, Escape)
- [ ] Focus management in modals
- [ ] Screen reader testing
- [ ] Color contrast check (WCAG AA)

**Bestanden:**
- Alle components

---

## Implementatie Volgorde

```
Fase 1 (Kritiek)          Fase 2 (Gemak)           Fase 3 (UI/UX)
─────────────────         ──────────────           ─────────────
1.1 Auto-save        →    2.1 Filters         →   3.1 Status badges
1.2 Klantenbeheer    →    2.2 Bulk acties     →   3.2 Sidebar
1.3 Herbereken       →    2.3 Validatie       →   3.3 Wizard progress
1.4 Query optim.     →    2.4 Input optim.    →   3.4 Responsive
                                                   3.5 Skeletons
                                                   3.6 Cards/spacing
```

---

## Metrics voor Succes

| Metric | Huidige Staat | Doel na v1 |
|--------|---------------|------------|
| Tijd om offerte aan te maken | 10-15 min | < 5 min |
| Klant hergebruik | 0% | > 80% |
| Data verlies door browser sluiten | Vaak | Nooit |
| Pagina laadtijd | 2-3 sec | < 1 sec |
| Mobiel bruikbaarheid | Matig | Goed |

---

## Changelog

| Versie | Datum | Wijzigingen |
|--------|-------|-------------|
| v1.0 | 2026-01-30 | Initieel verbeterplan |
