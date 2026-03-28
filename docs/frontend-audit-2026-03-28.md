# Frontend Audit Rapport — Top Tuinen Offerte Calculator

**Datum:** 2026-03-28
**Scope:** UI, UX, Tests, Error Handling, Accessibility (alleen frontend)
**Methode:** 12 parallelle research agents, elk gefocust op een specifiek aspect

---

## Samenvatting per Categorie

| Categorie | Score | Status |
|-----------|-------|--------|
| Navigatie & Routing | 8.5/10 | Uitstekend |
| Formulieren & Validatie | 9/10 | Uitstekend |
| Loading States | 7.5/10 | Goed |
| Empty States | 8.5/10 | Uitstekend |
| Design Consistentie | 9/10 | Uitstekend |
| Responsive Design | 8.5/10 | Uitstekend |
| Accessibility (a11y) | 7.5/10 | Goed |
| Component Kwaliteit | 8.5/10 | Uitstekend |
| Test Coverage | **2.5/10** | **Kritiek** |
| E2E Tests | **2/10** | **Kritiek** |
| Error Handling | 8.5/10 | Uitstekend |
| Toast & User Feedback | 9/10 | Uitstekend |

**Totaal: 7.3/10** — Sterke UI/UX fundamenten, maar test coverage is een groot risico.

---

## KRITIEKE PROBLEMEN

### 1. Test Coverage: 2.4% (15 van 630 bestanden)

- Slechts 15 test files, 8.7K regels testcode
- Core calculators goed getest (offerte-calculator, voorcalculatie, nacalculatie)
- **0 component tests**, **0 hook tests**, **0 Convex backend tests**
- Geen CI/CD pipeline — tests draaien alleen handmatig
- Slechts 2 Playwright E2E tests (home + public offerte)
- Geen visual regression, geen snapshot tests

**Geteste bestanden (8 lib files):**
- offerte-calculator.ts (3,106 regels tests, 339 assertions)
- voorcalculatie-calculator.ts (1,294 regels, 144 assertions)
- nacalculatie-calculator.ts (1,224 regels, 189 assertions)
- validation-schemas.ts (1,903 regels, 262 assertions)
- status-transitions.ts (365 regels, 70 assertions)
- currency.ts (242 regels, 61 assertions)
- date-format.ts (314 regels, 67 assertions)
- number-format.ts (273 regels, 73 assertions)

**Niet geteste kritieke bestanden:**
- Alle 87+ Convex functies (offertes.ts, projecten.ts, klanten.ts, facturen.ts, betalingen.ts)
- Alle 47 custom hooks
- Alle 272 React componenten
- Import/export logica (klant-import-parser.ts, excel-export.ts)
- Externe integraties (fleetgo.ts, calendly.ts)

### 2. Geen `lang="nl"` op document root

- Beinvloedt screen reader uitspraak en woordafbreking
- Fix in `src/app/layout.tsx`

---

## HOGE PRIORITEIT

### 3. Ontbrekende alt-tekst op afbeeldingen

- `src/components/pdf/offerte-pdf.tsx:263` — Logo image
- `src/components/project/qc-foto-upload.tsx` — QC foto's
- `src/components/project/werklocatie-foto-gallery.tsx` — Galerij foto's
- `src/components/app-sidebar.tsx:588` — Sidebar afbeelding

### 4. Geen optimistic updates

- Geen `useOptimistic` hook gebruik gevonden
- Mutations wachten op server response voordat UI update
- Vooral merkbaar bij: status wijzigingen, regel toevoegen/verwijderen, form saves

### 5. Portaal routes missen loading states

- `/src/app/portaal/(portal)/` pagina's hebben geen `loading.tsx` bestanden
- Dynamische `[id]` pagina's (projecten, offertes) missen ook dedicated skeletons
- Contrast met dashboard routes die 22 loading.tsx bestanden hebben

### 6. Geen page leave warning bij unsaved changes

- Geen `beforeunload` event listener actief in wizard forms
- Auto-save helpt maar multi-stap wizards kunnen data verliezen bij navigatie
- `useWizardAutosave` slaat op in localStorage maar waarschuwt niet bij verlaten

### 7. Kleur contrast niet geaudit

- 1078+ instances van `text-muted-foreground` en `opacity-50`/`opacity-40`
- Geen geautomatiseerde contrast checker (axe-core, Lighthouse CI)
- Potentieel WCAG AA non-compliant op sommige tekst elementen

---

## MEDIUM PRIORITEIT

### 8. Grote componenten (>800 regels)

| Component | Regels | Aanbeveling |
|-----------|--------|-------------|
| `src/components/medewerkers/medewerker-form.tsx` | 871 | Split: BasicInfo, Skills, Certificates, Experience sections |
| `src/components/offerte/onderhoud-forms/reiniging-form.tsx` | 848 | Extract: FaseCard, OpbrengstCalculator |
| `src/components/offerte/onderhoud-forms/bemesting-form.tsx` | 792 | Extract: TypeSelector, DosageCalculator |
| `src/components/offerte/scope-forms/bestrating-form.tsx` | 789 | Extract: FunderingsVisualisatie, TypeSelector |
| `src/components/beschikbaarheids-kalender.tsx` | 722 | Extract: CalendarGrid, TimeSlotSelector |

### 9. Scope form code duplicatie

- Aanleg scope forms (bestrating, grondwerk, houtwerk, water-elektra) hebben ~70% identieke structuur
- Onderhoud forms (bemesting, reiniging, mollenbestrijding) idem
- Aanbeveling: abstract `ScopeFormTemplate` component voor gedeelde layout/logica

### 10. Filter state niet deep-linked op alle pagina's

- `/offertes` synct filters correct naar URL query params
- `/projecten` en `/klanten` doen dit NIET — filters verdwijnen bij back/forward navigatie
- Aanbeveling: `useSearchParams` toevoegen aan alle lijst pagina's

### 11. Geen copy-to-clipboard feedback

- Referentienummers, offerte codes, klant details missen kopieer functionaliteit
- Geen toast bevestiging bij kopieeracties
- Aanbeveling: `navigator.clipboard.writeText()` + `showSuccessToast("Gekopieerd")`

### 12. Ontbrekende `aria-expanded` op collapsible elementen

- Accordion/collapsible components gebruiken `aria-expanded` niet consistent
- Radix UI handelt dit deels af maar custom collapsibles missen het

### 13. Hardcoded kleuren in kanban-board.tsx

- `src/components/leads/kanban-board.tsx` gebruikt hex waarden (#3b82f6, #f59e0b, #8b5cf6, #10b981, #ef4444)
- Moet Tailwind semantic classes of CSS variables gebruiken

### 14. Portaal drawer fixed width

- `src/components/portaal/portaal-nav.tsx:74` — `w-72` zonder max-width safety
- Op schermen < 320px kan dit overflow veroorzaken
- Fix: `max-w-[calc(100vw-3rem)]` toevoegen

---

## LAGE PRIORITEIT

### 15. Geen globale navigation loading bar
- Geen NProgress of soortgelijk bij route transitions
- Breadcrumbs en skeletons helpen, maar een subtiele top bar geeft extra feedback

### 16. Character count op textarea's ontbreekt
- Notitie velden (overig-form, beschrijvingen) tonen geen max/huidige karakter telling

### 17. Inconsistente empty state implementatie
- Sommige pagina's gebruiken inline divs i.p.v. het centrale `EmptyState` component
- Betrokken: verzuim pagina, chat pagina, instellingen

### 18. Icon-only buttons missen `aria-label`
- 48 bestanden gebruiken aria-label, maar veel icon-only buttons zijn niet gelabeld
- Audit nodig van alle `<Button variant="ghost" size="icon">` instanties

### 19. Geen geautomatiseerde a11y testing
- Geen jest-axe of axe-core in test pipeline
- Accessibility test file bestaat maar dekt alleen utilities, niet componenten

### 20. Geen connection status indicator
- Geen offline/reconnecting indicator voor Convex real-time verbinding
- Gebruikers zien geen feedback als verbinding wegvalt

### 21. Bulk action feedback
- Bulk operaties tonen enkele toast maar geen per-item status
- Bij bulk delete van 10 offertes: alleen "X offertes verwijderd"

---

## WAT AL GOED IS

### Formulieren & Validatie
- React Hook Form + Zod met `mode: "onChange"` voor real-time validatie
- Alle foutmeldingen in het Nederlands met contextuele hints
- Auto-save met debounce (2 sec) + visuele save indicator
- Draft recovery voor wizards met localStorage (24 uur expiratie)
- Wizard stappen met progress bar en validatie per stap
- Required field indicators, tooltips met uitleg
- Bevestigingsdialogen voor alle destructieve acties

### Design System
- 67 shadcn/ui componenten met CVA variants
- Lucide React icons consistent in 185 bestanden (geen mixing)
- CSS variabelen voor status kleuren, scope kleuren, trend indicators
- Consistent border-radius (rounded-md standaard), shadows, spacing
- Geist Sans + Geist Mono fonts correct geconfigureerd
- Dark mode support (1078+ `dark:` classes)

### Error Handling
- 4 error boundaries: generic, chart, PDF, data-fetch (alle met Sentry)
- Route-specific error.tsx: global, public, auth, dashboard
- 3 not-found.tsx pagina's per route groep
- Custom error classes: AppError, ValidationError, NotFoundError, AuthenticationError, AuthorizationError
- Retry logic met exponential backoff + jitter
- `handleError()` centraal met Sentry context

### Toast & Feedback
- Sonner + custom utils: showSuccessToast, showErrorToast, showDeleteToast, showPromiseToast
- 100% Nederlands, consistent bottom-right positie
- Undo voor deletes (30 sec window)
- Save indicator (Opslaan... / Niet-opgeslagen / Opgeslagen om HH:mm)
- Notification center met bell icon, unread badge, per-type iconen

### Navigatie
- Smart breadcrumbs met mobile collapsing en entity-aware labels
- 7-staps workflow visualisatie (Offerte > Voorcalculatie > ... > Factuur)
- Skip link, keyboard shortcuts (Cmd+K), active state indicators
- Post-actie redirects met aanbevolen volgende stap
- Deep linking met query params op offertes pagina

### Responsive
- Sidebar → Sheet (offcanvas) op mobile met Cmd+B toggle
- Responsive tables met card view op mobile
- 44px minimum touch targets op interactieve elementen
- Print styles via @react-pdf/renderer
- Safe area insets voor notched devices

### Empty States
- Centraal EmptyState component met icon, title, description, actions
- Welkom flow voor eerste gebruik (NoOffertes met CTAs)
- Workflow uitleg bij lege projecten ("wordt aangemaakt vanuit geaccepteerde offertes")
- Search no-results met "Zoekopdracht wissen" CTA
- Portaal empty states consistent over 6 secties

### Accessibility
- Focus trap hooks, live regions, roving focus
- Reduced motion preference detection
- Screen reader announcements in het Nederlands
- Radix UI primitives als basis (Dialog, AlertDialog, etc.)
- Skip navigation link
- Keyboard shortcut systeem met platform-aware modifiers
