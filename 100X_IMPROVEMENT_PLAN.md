# TOP Offerte Calculator - 100x Improvement Plan

> Uitgebreide analyse door 15 AI-agents die elk een specifiek aspect van de applicatie hebben geanalyseerd.

---

## Executive Summary

De TOP Offerte Calculator is een **functioneel complete, professionele applicatie** met sterke fundamenten:
- 82 UI componenten met goede accessibility
- Goed gestructureerde Convex backend
- Proper role-based access control
- Solide animatie-infrastructuur

**Echter**, er zijn significante verbetermogelijkheden op het gebied van:
- UX flow en navigatie
- Mobile responsiveness
- Performance optimalisaties
- Design system consistentie
- Error handling en user feedback

---

## Overzicht Scores per Gebied

| Gebied | Score | Status |
|--------|-------|--------|
| UI Components | 8.5/10 | Excellent |
| Accessibility | 8/10 | Goed |
| Animation System | 8/10 | Goed |
| Design System | 5.3/10 | Matig |
| Mobile Responsiveness | 6/10 | Verbeterbaar |
| Navigation & Routing | 5/10 | Verbeterbaar |
| Error Handling | 5/10 | Verbeterbaar |
| Forms & Validation | 5/10 | Verbeterbaar |
| Search & Filtering | 5/10 | Verbeterbaar |
| Loading States | 6/10 | Verbeterbaar |
| Data Tables | 5/10 | Verbeterbaar |

---

## Deel 1: Quick Wins (1-2 weken)

### 1.1 Touch Targets Fixen (WCAG Compliance)

**Probleem**: SidebarTrigger is 28px (moet 44px zijn)

```tsx
// src/components/app-sidebar.tsx
// Current:
<SidebarTrigger className="-ml-1" />

// Fix:
<SidebarTrigger className="-ml-1 size-11 sm:size-9" />
```

**Impact**: Voldoet aan WCAG 2.1 Level AA

### 1.2 Number Input Touch Targets

```tsx
// src/components/ui/number-input.tsx
// Current:
className="h-10 w-10 sm:h-9 sm:w-9"

// Fix:
className="h-11 w-11 sm:h-10 sm:w-10"
```

### 1.3 Search Debouncing

**Probleem**: Search viert op elke keystroke

```tsx
// Voeg 300ms debounce toe aan alle search inputs
const debouncedSearch = useMemo(
  () => debounce((value: string) => setSearchTerm(value), 300),
  []
);
```

### 1.4 Loading Skeletons Toevoegen

**Probleem**: Pagina's tonen spinners ipv skeletons

```tsx
// Dashboard, Offertes, Projecten pagina's
// Vervang:
<Loader2 className="animate-spin" />

// Door:
<DashboardSkeleton /> // of ListSkeleton, TableSkeleton
```

### 1.5 Auto-Close Mobile Sidebar

```tsx
// src/components/app-sidebar.tsx
useEffect(() => {
  setOpenMobile(false);
}, [pathname]);
```

---

## Deel 2: UX Flow Verbeteringen (2-4 weken)

### 2.1 Dashboard Simplificatie

**Huidige situatie**: 8 secties, cognitive overload

**Nieuw design**:
```
┌─────────────────────────────────────────────┐
│ Welkom + 2-3 Key Metrics                     │
├─────────────────────────────────────────────┤
│ ACTION REQUIRED (prominent, clickable)       │
├─────────────────────────────────────────────┤
│ Jouw Focus Vandaag:                          │
│ - Offertes wachtend op reactie               │
│ - Projecten met deadline                     │
│ - Te registreren uren                        │
├─────────────────────────────────────────────┤
│ Quick Start (nieuwe offerte, etc.)           │
├─────────────────────────────────────────────┤
│ Recente Activiteit (compact)                 │
└─────────────────────────────────────────────┘
```

**Te verwijderen**:
- Pipeline visualization (redundant met Offertes lijst)
- Excessive KPI cards (houd 2-3)
- Aparte Facturen sectie

### 2.2 Offerte→Project Flow Verbeteren

**Huidige flow**: 5 clicks nodig
```
Accept Offerte → Alert → Click → Form → Create
```

**Nieuwe flow**: 2 clicks
```
Accept Offerte → "Start Project" Button → Confirm Modal
```

**Implementatie**:
- Inline "Start Project" actie button op geaccepteerde offertes
- Pre-filled confirmation modal
- Auto-redirect naar planning

### 2.3 Wizard Step Navigation

**Probleem**: Kan niet terug naar Step 0 in offerte wizard

**Fix**:
- Clickable breadcrumb-style step indicators
- Behoud context bij terug navigeren
- "Edit previous step" zonder reset

### 2.4 Project Workflow Verduidelijking

**Toevoegen per fase**:
- "Aanbevolen Volgende Stappen" sectie
- Duidelijke "je bent hier" indicator
- Requirements voor volgende fase
- Help tooltips

---

## Deel 3: Navigation & Routing (2-3 weken)

### 3.1 Activeer useBreadcrumb Hook

**Probleem**: Hook bestaat maar wordt niet gebruikt (20+ pagina's handmatig)

```tsx
// Vervang handmatige breadcrumbs:
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
    </BreadcrumbItem>
    // ...
  </BreadcrumbList>
</Breadcrumb>

// Door:
const breadcrumbs = useBreadcrumb();
<SmartBreadcrumb items={breadcrumbs} />
```

**Impact**: -500 regels code, automatische responsive breadcrumbs

### 3.2 URL-Based Tab State

```tsx
// Tabs moeten URL parameters gebruiken
const searchParams = useSearchParams();
const activeTab = searchParams.get('tab') || 'all';

const handleTabChange = (tab: string) => {
  router.push(`?tab=${tab}`);
};
```

**Toepassen op**:
- /medewerkers (tabs)
- /rapportages (tabs)
- /wagenpark (tabs)
- /archief (tabs)

### 3.3 Deep Linking voor Modals

```tsx
// Maak edit states shareable
// /klanten/[id]?edit=true
// /offertes/[id]?modal=voorcalculatie
```

### 3.4 Back Navigation

```tsx
// Voeg functionele back button toe
<Button variant="ghost" onClick={() => router.back()}>
  <ArrowLeft className="h-4 w-4 mr-2" />
  Terug
</Button>
```

---

## Deel 4: Forms & Validation (3-4 weken)

### 4.1 Unify Form Architecture

**Huidige situatie**:
- Scope forms: react-hook-form + Zod
- Modal forms: useState (geen schema validation)

**Migreer alle modals naar react-hook-form + Zod**:
- medewerker-form
- voertuig-form
- machine-form
- klant-form

### 4.2 Activeer FormFieldFeedback

```tsx
// Voeg toe aan alle form inputs:
<FormFieldFeedback
  state={errors.email ? "invalid" : "idle"}
  message={errors.email?.message}
/>
```

### 4.3 Real-time Validation

```tsx
// Verander validation mode
const form = useForm({
  resolver: zodResolver(schema),
  mode: "onChange", // ipv "onBlur"
});
```

### 4.4 Implementeer Input Patterns

**Bestaande patterns niet gebruikt** (`/src/lib/input-patterns.ts`):
- postcode
- telefoon
- email
- oppervlakte
- bedrag

```tsx
// Activeer in forms:
import { patterns } from "@/lib/input-patterns";

<Input
  {...field}
  pattern={patterns.postcode.regex}
  onChange={(e) => {
    const formatted = patterns.postcode.format(e.target.value);
    field.onChange(formatted);
  }}
/>
```

### 4.5 ValidationSummary Implementeren

```tsx
// Voeg toe boven forms met meerdere velden:
<ValidationSummary errors={form.formState.errors} />
```

---

## Deel 5: Data Tables & Lists (2-3 weken)

### 5.1 Sorting Implementeren

**Geen enkele tabel heeft sorting**

```tsx
// Voeg toe aan alle tabellen:
<TableHead
  sortable
  sortDirection={sortConfig.key === "naam" ? sortConfig.direction : null}
  onClick={() => handleSort("naam")}
>
  Naam
</TableHead>
```

### 5.2 Pagination Toevoegen

**Alle tabellen laden complete dataset**

```tsx
// Implementeer cursor-based pagination
const [cursor, setCursor] = useState<string | null>(null);
const { data, hasMore } = useQuery(api.offertes.list, {
  limit: 25,
  cursor
});
```

### 5.3 Bulk Actions Uitbreiden

**Alleen Offertes heeft bulk actions**

Toevoegen aan:
- Projecten (bulk archive, bulk assign)
- Klanten (bulk delete, bulk export)
- Medewerkers (bulk status change)
- Wagenpark (bulk status change)

### 5.4 Table Virtualization

**Voor 100+ rows**:
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
```

---

## Deel 6: Performance Optimalisaties (2-3 weken)

### 6.1 Query Batching

**Probleem**: Dashboard heeft 6 separate queries

```tsx
// Combineer in 1 query:
export const getDashboardData = query({
  handler: async (ctx) => {
    const [stats, projects, revenue, facturen] = await Promise.all([
      getStats(ctx),
      getActiveProjects(ctx),
      getRevenueStats(ctx),
      getFacturenStats(ctx),
    ]);
    return { stats, projects, revenue, facturen };
  },
});
```

### 6.2 Remove Unnecessary useMemo

```tsx
// Dashboard line 99-109 - simple array doesn't need memoization
// Remove useMemo for simple object/array literals
```

### 6.3 Lazy Load Sidebar Icons

```tsx
// Huidige: 23 lucide icons imported at top
// Beter: Dynamic import per icon
const DynamicIcon = dynamic(() =>
  import('lucide-react').then(mod => mod[iconName])
);
```

### 6.4 Activeer Prefetch Hooks

**Prefetch hooks bestaan maar worden niet gebruikt**:
- `usePrefetchCalculationData`
- `usePrefetchKlantenData`

```tsx
// Gebruik op list pages voor snellere detail page loads
usePrefetchCalculationData(offerteId);
```

---

## Deel 7: Error Handling (2-3 weken)

### 7.1 Extract Error Details

```tsx
// Huidige situatie:
catch (error) {
  toast.error("Fout bij opslaan");
}

// Verbeterd:
catch (error) {
  const message = getMutationErrorMessage(error);
  showErrorToast("Kon niet opslaan", { description: message });
}
```

### 7.2 Error Codes in Backend

```tsx
// Convex mutations:
if (!medewerker) {
  throw new AppError("MEDEWERKER_NOT_FOUND", "Medewerker niet gevonden", 404);
}

// Frontend:
if (error.code === "MEDEWERKER_NOT_FOUND") {
  showErrorToast("Medewerker bestaat niet meer");
}
```

### 7.3 Implement Promise Toasts

```tsx
// Vervang try/catch + loading state door:
showPromiseToast(mutation(), {
  loading: "Opslaan...",
  success: "Opgeslagen!",
  error: (err) => getMutationErrorMessage(err)
});
```

### 7.4 Error Boundaries per Feature

```tsx
// Wrap major sections:
<ErrorBoundary fallback={<OffertesError />}>
  <OffertesSection />
</ErrorBoundary>
```

### 7.5 Offline Indicator Integreren

```tsx
// Voeg toe aan dashboard layout:
<OfflineIndicator position="bottom-center" />
```

---

## Deel 8: Design System Consistentie (3-4 weken)

### 8.1 Status Colors Centraliseren

**Probleem**: Tailwind classes ipv design tokens

```css
/* globals.css */
--color-status-concept: oklch(0.97 0 0);
--color-status-voorcalculatie: oklch(0.55 0.15 230);
--color-status-verzonden: oklch(0.7 0.2 90);
--color-status-geaccepteerd: oklch(0.6 0.2 145);
--color-status-afgewezen: oklch(0.6 0.2 25);
```

```tsx
// constants/statuses.ts
concept: {
  bg: "bg-[var(--color-status-concept)]",
  // ipv: "bg-gray-100 dark:bg-gray-800"
}
```

### 8.2 Chart Colors Consolideren

```tsx
// src/lib/tokens/colors.ts
export const chartColors = {
  1: 'hsl(var(--chart-1))',
  2: 'hsl(var(--chart-2))',
  3: 'hsl(var(--chart-3))',
  4: 'hsl(var(--chart-4))',
  5: 'hsl(var(--chart-5))',
};

// Vervang alle hardcoded rgb() en hsl() in analytics components
```

### 8.3 Typography Component System

```tsx
// src/components/ui/typography.tsx
export const Heading = ({ level, children }) => { ... }
export const Body = ({ size, children }) => { ... }
export const Caption = ({ children }) => { ... }
export const Label = ({ children }) => { ... }
```

### 8.4 Spacing Scale Documentatie

```md
# Spacing Scale
| Token | Tailwind | Pixels | Rem |
|-------|----------|--------|-----|
| xs    | gap-1    | 4px    | 0.25rem |
| sm    | gap-2    | 8px    | 0.5rem |
| md    | gap-4    | 16px   | 1rem |
| lg    | gap-6    | 24px   | 1.5rem |
| xl    | gap-8    | 32px   | 2rem |
| 2xl   | gap-12   | 48px   | 3rem |
```

---

## Deel 9: Mobile Verbeteringen (2-3 weken)

### 9.1 Responsive Grid Breakpoints

```tsx
// Projecten page stats grid
// Huidige: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
// Verbeterd: "grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
```

### 9.2 Replace Basic Tables with ResponsiveTable

```tsx
// Alle data-heavy pages:
<ResponsiveTable
  data={items}
  columns={columns}
  keyExtractor={(item) => item.id}
  mobileBreakpoint="sm"
/>
```

### 9.3 Mobile-First Wizard

- Single-column layout
- Sticky header met progress
- Grotere touch targets
- Accordion voor scope summaries

### 9.4 Swipe Gestures

```tsx
// Voeg swipe-to-action toe op mobile cards
<SwipeableRow
  onSwipeLeft={() => handleDelete(item.id)}
  onSwipeRight={() => handleEdit(item.id)}
>
  <ItemCard item={item} />
</SwipeableRow>
```

---

## Deel 10: Accessibility Verbeteringen (2-3 weken)

### 10.1 Color Contrast Audit

**Prioriteit**: Voer WCAG AA contrast check uit op:
- `text-muted-foreground` op alle backgrounds
- `disabled:opacity-50` elements
- Status badges
- Placeholders

### 10.2 Pipeline View Keyboard Support

```tsx
// Voeg keyboard navigation toe:
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') onClick();
  }}
  aria-label={`${stage.label}: ${stage.count} items`}
>
```

### 10.3 Dynamic Content Announcements

```tsx
// Gebruik LiveRegion voor status updates:
const { announce } = useLiveRegion();

useEffect(() => {
  if (saveSuccess) {
    announce("Wijzigingen opgeslagen");
  }
}, [saveSuccess]);
```

### 10.4 Table Accessibility

```tsx
// Voeg captions toe:
<Table>
  <caption className="sr-only">Overzicht van alle offertes</caption>
  ...
</Table>
```

---

## Deel 11: Search & Filtering (3-4 weken)

### 11.1 Global Search Uitbreiden

```tsx
// Command palette moet alle entities doorzoeken:
const searchResults = {
  offertes: searchOffertes(query),
  klanten: searchKlanten(query),
  projecten: searchProjecten(query),
};
```

### 11.2 Multi-Field Search

```tsx
// Convex search indexes uitbreiden:
export default defineSchema({
  klanten: defineTable({...})
    .searchIndex("search_all", {
      searchField: "naam",
      // Voeg toe: plaats, postcode, email
    }),
});
```

### 11.3 Filter Presets

```tsx
// Quick filter buttons:
const filterPresets = [
  { label: "Laatste 30 dagen", filters: { dateFrom: subDays(new Date(), 30) } },
  { label: "Pending", filters: { status: ["concept", "verzonden"] } },
  { label: "High Value", filters: { minAmount: 5000 } },
];
```

### 11.4 Saved Filters

```tsx
// Sla custom filter combinaties op:
const saveFilter = (name: string, filters: FilterState) => {
  localStorage.setItem(`filter_${name}`, JSON.stringify(filters));
};
```

---

## Deel 12: Animation & Transitions (2-3 weken)

### 12.1 Page Transitions

```tsx
// app/(dashboard)/layout.tsx
<AnimatePresence mode="wait">
  <motion.div
    key={pathname}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
  >
    {children}
  </motion.div>
</AnimatePresence>
```

### 12.2 List Item Stagger

```tsx
// Bij laden van lists:
{items.map((item, i) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.05 }}
  >
    <ItemCard item={item} />
  </motion.div>
))}
```

### 12.3 Form Field Animations

```tsx
// Focus states:
<motion.div
  whileFocus={{ scale: 1.02 }}
  className="input-wrapper"
>
  <Input {...field} />
</motion.div>
```

### 12.4 Modal Transitions

```tsx
// Scale-up entrance:
<Dialog>
  <DialogContent
    as={motion.div}
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
  >
```

---

## Deel 13: Medewerker-Specifieke Features (2-3 weken)

### 13.1 Planning Pagina Uitbreiden

- Drag-and-drop taak herschikking
- Kalender view (week/maand)
- Conflict detectie (dubbele toewijzingen)
- Notificaties voor deadlines

### 13.2 Uren Pagina Verbeteren

- Quick entry form bovenaan
- Week totaal visualisatie
- Export naar Excel
- Goedkeurings workflow (admin review)

### 13.3 Project Detail voor Medewerkers

- Alleen relevante secties tonen
- Materiaal checklist
- Foto upload mogelijkheid
- Notities/opmerkingen

### 13.4 Push Notificaties Setup

- Planning updates
- Nieuw toegewezen projecten
- Deadline reminders
- Chat berichten

---

## Prioritering Roadmap

### Sprint 1 (Week 1-2): Quick Wins
- [ ] Touch targets fixen
- [ ] Search debouncing
- [ ] Loading skeletons
- [ ] Mobile sidebar auto-close

### Sprint 2 (Week 3-4): Navigation & Forms
- [ ] Activeer useBreadcrumb
- [ ] URL-based tab state
- [ ] Form validation mode
- [ ] ValidationSummary

### Sprint 3 (Week 5-6): Data & Performance
- [ ] Table sorting
- [ ] Pagination
- [ ] Query batching
- [ ] Prefetch hooks

### Sprint 4 (Week 7-8): UX Flow
- [ ] Dashboard simplificatie
- [ ] Offerte→Project flow
- [ ] Project workflow guidance
- [ ] Error handling

### Sprint 5 (Week 9-10): Design System
- [ ] Status colors centraliseren
- [ ] Chart colors consolideren
- [ ] Typography components
- [ ] Color contrast audit

### Sprint 6 (Week 11-12): Mobile & Accessibility
- [ ] Responsive grids
- [ ] ResponsiveTable implementatie
- [ ] Keyboard navigation
- [ ] Screen reader support

### Sprint 7 (Week 13-14): Search & Animation
- [ ] Global search
- [ ] Filter presets
- [ ] Page transitions
- [ ] List animations

### Sprint 8 (Week 15-16): Medewerker Features
- [ ] Planning improvements
- [ ] Uren verbeteringen
- [ ] Mobile-first views
- [ ] Push notificaties

---

## Metrics om te Tracken

### Performance
- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Bundle size < 500KB (initial)

### Accessibility
- [ ] WCAG 2.1 AA compliance
- [ ] 0 critical axe violations
- [ ] 100% keyboard navigable
- [ ] Screen reader tested

### UX
- [ ] Task completion rate > 95%
- [ ] Error rate < 2%
- [ ] Mobile bounce rate < 30%
- [ ] User satisfaction score > 4.5/5

### Code Quality
- [ ] TypeScript strict mode
- [ ] 0 ESLint errors
- [ ] Test coverage > 80%
- [ ] Bundle analyzer reports

---

## Conclusie

Deze 100x improvement roadmap transformeert de TOP Offerte Calculator van een **functioneel complete applicatie** naar een **world-class user experience**.

De belangrijkste thema's zijn:
1. **Simplificatie** - Minder cognitive load, duidelijkere flows
2. **Consistentie** - Design system, error handling, navigation
3. **Mobile-first** - Responsive, touch-friendly, offline-capable
4. **Performance** - Snellere loads, geoptimaliseerde queries
5. **Accessibility** - Inclusief voor alle gebruikers

Door deze verbeteringen systematisch te implementeren, wordt de app niet alleen beter voor eindgebruikers, maar ook makkelijker te onderhouden en uit te breiden voor het development team.

---

*Gegenereerd door 15 AI-agents op 2026-02-02*
