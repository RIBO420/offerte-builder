# React Patterns Review

**Date:** 2026-03-26
**Scope:** `src/components/` and `src/app/`
**Reviewed by:** Claude Opus 4.6

## Summary

- Critical: 5
- Warning: 12
- Info: 6

---

## Findings

### [CRITICAL] CommandProvider context value not memoized
**Location:** `src/components/providers/command-provider.tsx:102`
**Issue:** The `value` prop passed to `CommandContext.Provider` is an inline object literal (`value={{ open, setOpen, recentItems, addRecentItem, clearRecentItems }}`). This creates a new object reference on every render of `CommandProvider`, causing all consumers of `useCommand()` to re-render whenever *any* state in the provider changes -- even if the specific value they consume has not changed. This is particularly impactful because `CommandProvider` wraps the entire dashboard layout.
**Recommendation:** Wrap the value in `useMemo`:
```ts
const value = useMemo(() => ({ open, setOpen, recentItems, addRecentItem, clearRecentItems }), [open, recentItems, addRecentItem, clearRecentItems]);
```

### [CRITICAL] Giant page files with no component extraction (1600+ lines)
**Location:** `src/app/(public)/configurator/gazon/page.tsx` (1611 lines), `src/app/(dashboard)/projecten/[id]/factuur/page.tsx` (1536 lines)
**Issue:** These page files contain multiple sub-components, helper functions, formatting utilities, validation logic, and the main page component all in one file. The gazon configurator has 9 `useState` calls and defines 15+ functions/components inline. The factuur page has 12 `useState` calls and no `useMemo`/`useCallback` usage at all. This makes the code hard to reason about, test, and maintain, and prevents any code-splitting benefits.
**Recommendation:** Extract sub-components, helper functions, and types into separate files. Move validation logic (`validateStap1`, `validateStap2`) into a shared validation module. Extract step components (`Stap1Klantgegevens`, `Stap2GazonSpecs`, etc.) into their own files under a `components/` directory.

### [CRITICAL] useEffect with setTimeout missing cleanup in multiple locations
**Location:** `src/app/(dashboard)/offertes/components/status-tabs.tsx:109-111`, `src/components/app-sidebar.tsx:~220`, `src/components/app-sidebar.tsx:~236`
**Issue:** Multiple `useEffect` hooks use `setTimeout` without returning a cleanup function to clear the timeout. For example in `status-tabs.tsx`:
```ts
useEffect(() => {
  setTimeout(() => setViewMode(getDefaultViewMode()), 0);
}, []);
```
If the component unmounts before the timeout fires, it will attempt to set state on an unmounted component. The same pattern appears in `app-sidebar.tsx` for `setMounted(true)` and `setOpenSection(...)`.
**Recommendation:** Always clear timeouts in cleanup:
```ts
useEffect(() => {
  const id = setTimeout(() => setViewMode(getDefaultViewMode()), 0);
  return () => clearTimeout(id);
}, []);
```

### [CRITICAL] Systematic eslint-disable for exhaustive-deps across all scope/onderhoud forms (14+ suppressions)
**Location:** `src/components/offerte/scope-forms/grondwerk-form.tsx:80`, `src/components/offerte/scope-forms/borders-form.tsx:128,142`, `src/components/offerte/onderhoud-forms/gazonanalyse-form.tsx:335`, `src/components/offerte/onderhoud-forms/bemesting-form.tsx:242`, `src/components/offerte/onderhoud-forms/reiniging-form.tsx:297`, `src/components/offerte/onderhoud-forms/mollenbestrijding-form.tsx:223`, `src/components/offerte/onderhoud-forms/heggen-form.tsx:107,130`, `src/components/offerte/onderhoud-forms/bomen-form.tsx:162`, `src/components/offerte/onderhoud-forms/gras-onderhoud-form.tsx:65`, `src/components/offerte/onderhoud-forms/borders-onderhoud-form.tsx:72`, `src/components/offerte/onderhoud-forms/overig-form.tsx:66`
**Issue:** There is a systemic pattern across all scope forms where `useEffect` hooks suppress the exhaustive-deps rule. Two recurring patterns:
1. Validation sync effect uses `JSON.stringify(errors)` in the dependency array instead of proper deps (e.g., `grondwerk-form.tsx:81`). This is fragile -- `JSON.stringify` on each render is wasteful and the approach masks missing `onValidationChange` in the dependency array.
2. Optional-field sync effects intentionally omit `onChange` and `buildCompleteData` from deps (e.g., `borders-form.tsx:128`).
**Recommendation:** Refactor the validation sync pattern into a shared custom hook (e.g., `useFormValidationSync`) that properly handles deps. For the optional-field sync, use `useCallback`-wrapped `onChange` from parents and include it in deps, or use a ref to hold the latest callback.

### [CRITICAL] useEffect used for data sync that should be derived state (configurator/status/page.tsx)
**Location:** `src/app/(public)/configurator/status/page.tsx:535-542`
**Issue:** A `useEffect` with `setTimeout(..., 0)` is used to sync a URL search param into component state:
```ts
useEffect(() => {
  if (refParam) {
    setTimeout(() => {
      setInputWaarde(refParam);
      setZoekReferentie(refParam);
    }, 0);
  }
}, [refParam]);
```
Using setTimeout(0) to defer state updates is a code smell. The search param value should initialize state directly via `useState(refParam)` or be derived.
**Recommendation:** Initialize state from the param: `const [inputWaarde, setInputWaarde] = useState(refParam)` and `const [zoekReferentie, setZoekReferentie] = useState(refParam)`. Remove the effect entirely.

---

### [WARNING] Index used as key in dynamic/reorderable lists
**Location:** `src/app/(dashboard)/instellingen/components/deelfactuur-templates-tab.tsx:260` (stappen list with add/remove), `src/app/(dashboard)/projecten/[id]/factuur/page.tsx:1152` (correcties list), `src/app/(dashboard)/projecten/[id]/nacalculatie/page.tsx:592`, `src/app/(dashboard)/prijsboek/page.tsx:925` (CSV preview rows), `src/components/ui/swipeable-row.tsx:228,258` (action items), `src/components/ui/long-press-menu.tsx:263`
**Issue:** These components use array index as the `key` prop on lists that can be dynamically modified (items added, removed, or reordered). In `deelfactuur-templates-tab.tsx:260`, stappen can be added and removed via buttons -- using index keys here will cause React to incorrectly reuse DOM nodes and potentially show stale input values.
**Recommendation:** Use a stable unique identifier for each item. For the stappen, generate a unique ID when adding items (e.g., `crypto.randomUUID()` or a counter). For correcties, use a combination of `omschrijving` + `bedrag` or add an `id` field.

### [WARNING] 17 dashboard routes missing loading.tsx
**Location:** `src/app/(dashboard)/archief/`, `src/app/(dashboard)/dashboard/`, `src/app/(dashboard)/facturen/`, `src/app/(dashboard)/gebruikers/`, `src/app/(dashboard)/inkoop/`, `src/app/(dashboard)/leveranciers/`, `src/app/(dashboard)/medewerkers/`, `src/app/(dashboard)/planning/`, `src/app/(dashboard)/prijsboek/`, `src/app/(dashboard)/profiel/`, `src/app/(dashboard)/rapportages/`, `src/app/(dashboard)/toolbox/`, `src/app/(dashboard)/verificatie/`, `src/app/(dashboard)/verlof/`, `src/app/(dashboard)/verzuim/`, `src/app/(dashboard)/voorraad/`, `src/app/(dashboard)/wagenpark/`
**Issue:** Only 6 out of 23 dashboard routes have a `loading.tsx` file. Without `loading.tsx`, Next.js cannot show an instant loading UI while the page's data is being fetched, resulting in the user staring at the previous page or a blank screen during navigation.
**Recommendation:** Add `loading.tsx` files with appropriate skeleton components for each route. The project already has a `src/components/skeletons/` directory with reusable skeletons.

### [WARNING] Inline reduce computations repeated in JSX render
**Location:** `src/components/analytics/financieel-overzicht.tsx:609-622`
**Issue:** The totals row calls `.reduce()` five separate times on `maandelijksOverzicht` directly inside the JSX return:
```tsx
{formatCurrencyNoDecimals(maandelijksOverzicht.reduce((sum, m) => sum + m.omzet, 0))}
{formatCurrencyNoDecimals(maandelijksOverzicht.reduce((sum, m) => sum + m.kosten, 0))}
{formatCurrencyNoDecimals(maandelijksOverzicht.reduce((sum, m) => sum + m.winst, 0))}
// ... and two more for the percentage calculation
```
These recompute on every render even though `maandelijksOverzicht` is a prop. The array is iterated 5 times unnecessarily.
**Recommendation:** Compute totals once with `useMemo` at the top of the component and reference the cached values in JSX.

### [WARNING] Factuur page (1536 lines) has zero useMemo/useCallback
**Location:** `src/app/(dashboard)/projecten/[id]/factuur/page.tsx`
**Issue:** This 1536-line page component with 12 `useState` calls and multiple async handler functions (`handleGenerateFactuur`, `handleMakeDefinitief`, `handleSendFactuur`, `handleMarkAsPaid`, `handleSendReminder`, `handleSendAanmaning`, `handleCreateCreditnota`, etc.) defines all handlers as plain `async` functions inside the component body. Every state change recreates all these functions, which will cause unnecessary re-renders of any child components receiving them as props.
**Recommendation:** Wrap handlers with `useCallback`. More importantly, extract the page into smaller sub-components with their own state and logic.

### [WARNING] Multiple large component files (700-1000+ lines)
**Location:** `src/components/offerte/onderhoud-forms/gazonanalyse-form.tsx` (1077 lines), `src/components/project/project-kosten-dashboard.tsx` (881 lines), `src/components/medewerkers/medewerker-form.tsx` (871 lines), `src/components/offerte/onderhoud-forms/reiniging-form.tsx` (859 lines), `src/components/offerte/onderhoud-forms/bemesting-form.tsx` (807 lines), `src/components/offerte/scope-forms/bestrating-form.tsx` (805 lines), `src/components/beschikbaarheids-kalender.tsx` (722 lines)
**Issue:** These components exceed reasonable size limits. While some are unavoidably complex (form components with many fields), they would benefit from extracting reusable sections, field groups, and helper functions into separate modules.
**Recommendation:** Target a max of ~400 lines per component file. Extract field groups into sub-components (e.g., `GazonanalyseBodemSection`, `GazonanalyseBemestingSection`). Move Zod schemas and types to co-located `types.ts` or `schema.ts` files.

### [WARNING] useEffect to sync external data into form state (settings page)
**Location:** `src/app/(dashboard)/instellingen/page.tsx:88-99`
**Issue:** An `useEffect` copies Convex query results into local `useState`:
```ts
useEffect(() => {
  if (instellingen) {
    setTarieven({ uurtarief: instellingen.uurtarief, ... });
    if (instellingen.scopeMarges) setScopeMarges(instellingen.scopeMarges);
  }
}, [instellingen]);
```
This creates two sources of truth -- the Convex query result and the local state copy. If the query updates (real-time sync), the effect re-runs and silently overwrites any pending local edits.
**Recommendation:** Use the query data as the initial value and track only user edits as a diff/dirty state. Or use React Hook Form's `reset()` with a dirty-field check to avoid overwriting in-progress edits.

### [WARNING] Similarly, herinneringen-tab syncs data via useEffect
**Location:** `src/app/(dashboard)/instellingen/components/herinneringen-tab.tsx:52-64`
**Issue:** Same pattern as above -- `useEffect` copies `herinneringInstellingen` query data into 6 separate `useState` calls. This is fragile and creates a dual source of truth.
**Recommendation:** Initialize state from props/query once, or use React Hook Form for the entire form with `defaultValues` derived from the query result and a `reset()` call when the data changes.

### [WARNING] `use client` on public layout creates client-side Convex provider
**Location:** `src/app/(public)/layout.tsx:1`
**Issue:** The public layout has `"use client"` and instantiates a separate `ConvexReactClient` at module scope. While `"use client"` is required because it renders `ConvexProvider` (a client component), there are two separate `ConvexReactClient` instances in the app -- one in `src/app/(public)/layout.tsx` and another in `src/components/providers/convex-client-provider.tsx`. This means public pages and dashboard pages have completely separate Convex subscription caches with no sharing.
**Recommendation:** If cache sharing between public and dashboard routes is desired, consider a shared Convex client instance. If isolation is intentional (public routes are unauthenticated), document this architectural decision.

### [WARNING] Dashboard layout is a client component (`"use client"`)
**Location:** `src/app/(dashboard)/layout.tsx:1`
**Issue:** The entire dashboard layout is marked as a client component. This means the layout shell (sidebar, page transitions, command palette, etc.) cannot benefit from server-side rendering. All children page components are also forced into the client boundary. While many dashboard pages legitimately need client-side interactivity (Convex real-time subscriptions), having the layout as a client component prevents any future optimization where parts of the page could be server-rendered.
**Recommendation:** This is a known trade-off with Convex (which requires client-side providers). Consider whether the SidebarProvider and other context providers could be isolated into a smaller client boundary, keeping the outer layout as a server component. Low priority given the Convex architecture.

### [WARNING] app-sidebar.tsx has hydration-avoidance workaround
**Location:** `src/components/app-sidebar.tsx:~220`
**Issue:** The sidebar uses `setTimeout(() => setMounted(true), 0)` in a `useEffect` to prevent hydration mismatches. This is a symptom of SSR/CSR mismatch (likely from `localStorage` or `window` access during render). The setTimeout(0) pattern also lacks cleanup.
**Recommendation:** Use a simpler `useEffect(() => { setMounted(true); }, [])` pattern without setTimeout. If the issue is localStorage-dependent content, conditionally render that content only when `mounted` is true rather than using a deferred state update.

### [WARNING] No not-found.tsx in (auth) and (public) route groups
**Location:** `src/app/(auth)/`, `src/app/(public)/`
**Issue:** The `(auth)` and `(public)` route groups lack `not-found.tsx` files. While the root `not-found.tsx` may catch these, having group-specific not-found pages provides a better user experience with appropriate layout context.
**Recommendation:** Add `not-found.tsx` files in `(auth)` and `(public)` route groups with contextually appropriate UI.

---

### [INFO] Good: Error boundaries are comprehensive
**Location:** `src/app/global-error.tsx`, `src/app/(public)/error.tsx`, `src/app/(auth)/error.tsx`, `src/app/(dashboard)/error.tsx`, `src/components/error-boundary.tsx`
**Issue:** The project has error boundaries at all route group levels plus a global error handler and a reusable `ErrorBoundary` component with specialized variants (ChartErrorBoundary, PdfErrorBoundary, DataFetchErrorBoundary). This is thorough and well-structured.
**Recommendation:** No action needed. This is a strong pattern.

### [INFO] Good: memo() used effectively on table rows and repeated UI
**Location:** `src/app/(dashboard)/inkoop/page.tsx:143` (InkooporderRow), `src/app/(dashboard)/offertes/components/offerte-row.tsx:54` (OfferteRow), `src/components/project/project-kosten-dashboard.tsx:108` (SummaryCard), `src/components/analytics/financieel-overzicht.tsx:247`, plus 15+ UI primitives
**Issue:** The project correctly uses `React.memo()` on table row components and reusable UI elements that render in lists. Combined with `useCallback` for handlers passed to these rows, this prevents unnecessary re-renders of large lists.
**Recommendation:** No action needed. Continue this pattern.

### [INFO] Good: Context providers mostly well-memoized
**Location:** `src/components/providers/shortcuts-provider.tsx:209`
**Issue:** The `ShortcutsProvider` correctly wraps its context value in `useMemo` and memoizes all shortcut arrays with `useMemo`. This is the correct pattern.
**Recommendation:** Apply this same pattern to `CommandProvider` (see CRITICAL finding above).

### [INFO] Good: Custom hooks extract complex logic well
**Location:** `src/app/(dashboard)/offertes/nieuw/aanleg/hooks/useAanlegWizard.ts`, `src/app/(dashboard)/offertes/nieuw/onderhoud/components/use-onderhoud-wizard.ts`
**Issue:** Wizard logic is properly extracted into custom hooks with `useCallback`-wrapped setters and `useMemo` for derived state. The `useAanlegWizard` hook exposes a clean API with 15+ `useCallback`-wrapped functions.
**Recommendation:** No action needed. This is a good pattern to follow for other complex stateful components.

### [INFO] Good: Suspense boundaries used for useSearchParams
**Location:** `src/app/(public)/configurator/bedankt/page.tsx:332`, `src/app/(public)/configurator/status/page.tsx:658`, `src/app/(dashboard)/verzuim/page.tsx:170`, `src/app/(dashboard)/inkoop/page.tsx:232`
**Issue:** Pages using `useSearchParams` correctly wrap content in `<Suspense>` boundaries to prevent client-side rendering bailout, following Next.js best practices.
**Recommendation:** No action needed.

### [INFO] Index-as-key acceptable in static/skeleton lists
**Location:** `src/app/(dashboard)/instellingen/loading.tsx:29,41,56`, `src/app/(dashboard)/verzuim/page.tsx:53`
**Issue:** Some skeleton/loading components use index as key (e.g., `Array.from({ length: 4 }).map((_, i) => <div key={i} .../>)`). Since these are static, fixed-length arrays that never change order, index keys are acceptable here.
**Recommendation:** No action needed. Index keys are fine for static placeholder content.

---

## Priority Summary

**Immediate action (Critical):**
1. Memoize `CommandProvider` context value
2. Add setTimeout cleanup to all useEffect+setTimeout patterns
3. Refactor repeated eslint-disable exhaustive-deps pattern into a shared hook
4. Break up 1500+ line page files

**Short-term (Warning):**
5. Add `loading.tsx` to the 17 dashboard routes missing them
6. Fix index-as-key in dynamic lists (deelfactuur stappen, swipeable rows)
7. Add `useMemo` for inline reduce computations in financieel-overzicht
8. Add `useCallback` to factuur page handlers
9. Refactor useEffect-based data sync patterns to avoid dual sources of truth

**Track for later (Info):**
10. Continue the good patterns around `memo()`, Suspense boundaries, and custom hooks
