# UI/UX Consistency Review

**Date:** 2026-03-26
**Scope:** `src/components/` and `src/app/` (web app only)
**Reviewer:** Claude Opus 4.6

## Summary

- Critical: 3
- Warning: 9
- Info: 5

---

## Findings

### [CRITICAL] Toast notification pattern is split between raw `toast()` and `showSuccessToast()`/`showErrorToast()`

**Location:** Multiple files across `src/components/`
**Issue:** The codebase has two parallel toast patterns:
1. **Raw sonner API** (`toast.success()`, `toast.error()`) -- used in ~20+ files including `leveranciers/leverancier-form.tsx`, `leads/nieuwe-lead-dialog.tsx`, `leads/kanban-board.tsx`, `leads/lead-detail-modal.tsx`, `inkoop/inkooporder-form.tsx`, `project/project-kosten-dashboard.tsx`, `project/werklocatie-form.tsx`, `project/werklocatie-foto-gallery.tsx`, `project/voertuig-selector.tsx`, `wagenpark/kilometer-log.tsx`, `wagenpark/schade-lijst.tsx`, `wagenpark/fleetgo-sync.tsx`, `wagenpark/fleetgo-settings.tsx`, `pdf/pdf-download-button.tsx`, `export-dropdown.tsx`, `klant-reminder-banner.tsx`
2. **Utility wrappers** (`showSuccessToast()`, `showErrorToast()` from `@/lib/toast-utils`) -- used in ~10 files including `verzuim/ziekmelding-form.tsx`, `verlof/verlof-form.tsx`, `medewerkers/medewerker-form.tsx`, `toolbox/toolbox-form.tsx`, `wagenpark/voertuig-form.tsx`

The utility wrappers provide consistent duration (4s success, 6s error), Dutch "Ongedaan maken"/"Opnieuw proberen" action labels, and undo support. Raw `toast()` calls skip all of this, leading to inconsistent toast behavior (e.g., no retry buttons on errors, inconsistent durations).

**Recommendation:** Migrate all raw `toast()` calls to use the utility functions from `@/lib/toast-utils`. The wrappers already handle all use cases (success, error, warning, info, promise, undo, saving).

---

### [CRITICAL] Hardcoded colors in chart/analytics components bypass the design system

**Location:** Multiple files in `src/components/analytics/` and `src/app/(dashboard)/dashboard/page.tsx`
**Issue:** Chart components use hardcoded `rgb()` and `hsl()` values instead of CSS variables:
- `src/components/analytics/medewerker-productiviteit.tsx` -- `rgb(34, 197, 94)`, `rgb(148, 163, 184)`, etc.
- `src/components/analytics/offerte-trend-chart.tsx` -- `rgb(59, 130, 246)`, `rgb(34, 197, 94)`
- `src/components/analytics/calculatie-vergelijking.tsx` -- `rgb(59, 130, 246)`, `rgb(37, 99, 235)`
- `src/components/analytics/scope-margin-chart.tsx` -- `rgb(34, 197, 94)`, `rgb(245, 158, 11)`, `rgb(239, 68, 68)`, and 4 more
- `src/components/analytics/kpi-cards.tsx:150` -- `rgb(34, 197, 94)`
- `src/app/(dashboard)/dashboard/page.tsx:650-654` -- DonutChart uses `hsl(220, 70%, 50%)`, `hsl(25, 95%, 53%)`, `hsl(142, 76%, 36%)`, `hsl(280, 65%, 55%)`, `hsl(160, 60%, 45%)`

The CSS already defines `--chart-1` through `--chart-5`, `--scope-*`, and `--status-*` variables for exactly this purpose. Hardcoded colors will break in dark mode and make theme changes impossible.

**Recommendation:** Replace all hardcoded chart colors with the CSS custom properties defined in `globals.css`. For the DonutChart in dashboard, use the `--status-gepland`, `--status-in-uitvoering`, `--status-afgerond`, `--status-nacalculatie`, and `--status-gefactureerd` variables.

---

### [CRITICAL] Forms inconsistently use React Hook Form vs raw useState

**Location:** Multiple form components
**Issue:** CLAUDE.md states "Forms: React Hook Form + Zod validation" as the standard, but several forms use raw `useState` for form state:
- `src/components/leveranciers/leverancier-form.tsx` -- Manual `useState` + `updateField` pattern, no Zod validation
- `src/components/leads/nieuwe-lead-dialog.tsx` -- Manual `useState` + `updateField`, no Zod schema
- `src/components/verzuim/ziekmelding-form.tsx` -- Individual `useState` per field, no Zod schema
- `src/components/verzuim/ziekmelding-form.tsx` (HerstelmeldingForm) -- Same pattern
- `src/components/verlof/verlof-form.tsx` -- Uses `showErrorToast` for validation instead of schema
- `src/components/offerte/save-as-template-dialog.tsx` -- Raw state management

Meanwhile, 31 forms properly use `useForm` + `zodResolver`, including all scope forms, wagenpark forms, medewerker forms, and inkooporder forms.

**Recommendation:** Migrate the remaining ~6 forms to use React Hook Form + Zod for consistent validation UX (inline error messages via `<FormMessage>` instead of toast-based validation alerts).

---

### [WARNING] Missing `loading.tsx` for 17 of 22 dashboard routes

**Location:** `src/app/(dashboard)/*/`
**Issue:** Only 5 dashboard routes have `loading.tsx` files:
- `offertes/loading.tsx`
- `projecten/loading.tsx`
- `klanten/loading.tsx`
- `uren/loading.tsx`
- `instellingen/loading.tsx`

The following 17 routes have NO loading skeleton:
`dashboard`, `planning`, `profiel`, `wagenpark`, `medewerkers`, `gebruikers`, `leveranciers`, `rapportages`, `verificatie`, `verzuim`, `archief`, `inkoop`, `voorraad`, `facturen`, `prijsboek`, `toolbox`, `verlof`

Several of these pages do handle loading inline (e.g., `verlof/page.tsx` has an `animate-pulse` loading state), but without a `loading.tsx` file, Next.js Suspense boundaries are not leveraged, causing full-page blocking on navigation.

**Recommendation:** Add `loading.tsx` files for all dashboard routes. Use the existing skeleton components from `src/components/skeletons/` (which provides `dashboard-skeletons.tsx`, `page-skeletons.tsx`, `table-skeletons.tsx`, `form-skeletons.tsx`, `detail-skeletons.tsx`).

---

### [WARNING] Loading state padding mismatch between `loading.tsx` and actual pages

**Location:** All 5 existing `loading.tsx` files
**Issue:** Loading skeletons use `p-4 md:p-6` while actual pages use `p-4 md:gap-8 md:p-8`. This causes a visible layout shift when the page finishes loading:
- `klanten/loading.tsx:18` -- `className="flex flex-1 flex-col gap-6 p-4 md:p-6"`
- `klanten/page.tsx:1024` -- `className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"`
- Same mismatch in `instellingen/`, `projecten/`, `uren/`, `offertes/`

**Recommendation:** Update all `loading.tsx` files to use `p-4 md:gap-8 md:p-8` to match their corresponding pages.

---

### [WARNING] Dialogs missing `DialogDescription` for screen readers

**Location:** Multiple dialog components
**Issue:** Several dialogs have `<DialogHeader><DialogTitle>` but no `<DialogDescription>`, which triggers accessibility warnings because screen readers expect a description:
- `src/components/toolbox/toolbox-form.tsx:152-154`
- `src/components/verzuim/ziekmelding-form.tsx:48` (ZiekmeldingForm)
- `src/components/verzuim/ziekmelding-form.tsx:95` (HerstelmeldingForm)
- `src/components/verlof/verlof-form.tsx:178-182`

Other dialog components (e.g., `leverancier-form.tsx`, `nieuwe-lead-dialog.tsx`, `medewerker-form.tsx`) correctly include `<DialogDescription>`.

**Recommendation:** Add `<DialogDescription>` to all dialogs. If no visible description is desired, use `<DialogDescription className="sr-only">` for screen-reader-only text.

---

### [WARNING] Dashboard page title uses `font-semibold` while all other pages use `font-bold`

**Location:** `src/app/(dashboard)/dashboard/page.tsx:163`
**Issue:** The dashboard page heading uses:
```
<h1 className="text-2xl font-semibold tracking-tight">
```
While all other 19+ dashboard pages consistently use:
```
<h1 className="text-2xl font-bold tracking-tight md:text-3xl">
```
Also, `rapportages/page.tsx:185` is missing the responsive `md:text-3xl` size.

**Recommendation:** Standardize all page titles to `text-2xl font-bold tracking-tight md:text-3xl`.

---

### [WARNING] Inconsistent responsive grid patterns in forms

**Location:** `src/components/leads/nieuwe-lead-dialog.tsx`, `src/components/offerte/filters.tsx`
**Issue:** Several form components use `grid grid-cols-2 gap-4` without a responsive breakpoint, meaning the 2-column layout is forced even on small mobile screens. Examples:
- `nieuwe-lead-dialog.tsx:148` -- `<div className="grid grid-cols-2 gap-4">` (name + source fields)
- `nieuwe-lead-dialog.tsx:182` -- `<div className="grid grid-cols-2 gap-4">` (email + phone)
- `nieuwe-lead-dialog.tsx:217` -- `<div className="grid grid-cols-2 gap-4">` (postcode + city)

Meanwhile, forms that follow the standard pattern (e.g., `leverancier-form.tsx`) correctly use `grid gap-4 md:grid-cols-2`, which stacks on mobile. The form does use `sm:max-w-lg` on the DialogContent, but on smaller phones (320-375px) the grid-cols-2 still creates cramped fields.

Several other components also use `grid grid-cols-2` without responsive prefixes: `medewerker-form.tsx` (6 instances), `voertuig-form.tsx` (3 instances), `medewerker-detail-dialog.tsx` (2 instances), `team-card.tsx`, `uitrusting-form.tsx` (2 instances), `schade-form.tsx`.

**Recommendation:** Change `grid grid-cols-2` to `grid gap-4 md:grid-cols-2` (or `sm:grid-cols-2` for dialog contexts) across all form components to ensure single-column stacking on small screens.

---

### [WARNING] Hardcoded hex in `global-error.tsx` -- no dark mode support

**Location:** `src/app/global-error.tsx:37-125`
**Issue:** The global error page uses 15+ inline hardcoded hex colors (e.g., `#fafafa`, `#dc2626`, `#111827`, `#6b7280`). There is no dark mode variant. This is partially justified (global error can't rely on CSS framework), but no `prefers-color-scheme: dark` media query is present either.

**Recommendation:** Add a `@media (prefers-color-scheme: dark)` section to the inline styles with dark-appropriate colors. Since this is the last-resort error boundary, inline styles are correct but should still support both themes.

---

### [WARNING] Kenteken plaat uses hardcoded background color

**Location:** `src/components/wagenpark/kenteken-plaat.tsx:45,58`
**Issue:** The Dutch license plate component uses `bg-[#F7B500]` and `bg-[#003399]` as hardcoded Tailwind arbitrary values. While these are the official Dutch plate colors (yellow plate + EU blue strip), they bypass the design system.

**Recommendation:** This is acceptable for real-world accuracy of the Dutch license plate design, but consider defining these as CSS variables (e.g., `--kenteken-bg`, `--kenteken-eu`) in `globals.css` for maintainability. Low priority since these are regulatory colors that should not change with themes.

---

### [WARNING] Email templates use hardcoded hex colors (no CSS variable support)

**Location:** `src/emails/factuur-email.tsx`, `src/emails/aanmaning-email.tsx`
**Issue:** Both email templates use 50+ hardcoded hex colors. Every color is a raw value like `#16a34a`, `#dc2626`, `#f6f9fc`, etc.

**Recommendation:** This is inherent to HTML email constraints (CSS variables are not supported in email clients). Consider creating a shared email color constants file (e.g., `src/emails/theme.ts`) to at least centralize the values and make bulk updates possible. Low priority since email clients require inline styles.

---

### [INFO] `text-[10px]` and `text-[11px]` arbitrary sizes used extensively

**Location:** 25+ instances across `src/components/`
**Issue:** Many components use Tailwind arbitrary text sizes like `text-[10px]` and `text-[11px]` instead of the standard scale (`text-xs` = 12px). Used in badges, timestamps, sub-labels, and compact UI elements.

Key locations: `leads/kanban-column.tsx`, `leads/lead-card.tsx`, `dashboard/voorman-dashboard.tsx` (6 instances), `dashboard/materiaalman-dashboard.tsx` (4 instances), `offerte/wizard-steps.tsx`, `offerte/sortable-regels-table.tsx`, `notification-center.tsx`, `beschikbaarheids-kalender.tsx`.

**Recommendation:** Consider defining custom font size tokens (`--text-2xs: 0.625rem` / 10px) in the Tailwind config to replace arbitrary values. This makes the scale explicit and discoverable.

---

### [INFO] Icon usage is fully consistent with lucide-react

**Location:** All of `src/`
**Issue:** No issue found. All 50+ files importing icons use `lucide-react` exclusively. No `react-icons`, `@heroicons`, or `@fortawesome` imports detected.

**Recommendation:** None. This is well-maintained.

---

### [INFO] Dark mode support is comprehensive in analytics components

**Location:** `src/components/analytics/`
**Issue:** No issue found. All analytics components properly use `dark:` variants for colors (e.g., `text-emerald-600 dark:text-emerald-400`, `bg-blue-100 dark:bg-blue-900/50`). The `border-white/10 dark:border-white/5` pattern is used consistently across all analytics cards.

**Recommendation:** None. This is a good pattern.

---

### [INFO] Dutch language is consistent in all user-facing text

**Location:** All of `src/components/` and `src/app/`
**Issue:** All user-facing text is in Dutch as required. Button labels ("Annuleren", "Opslaan", "Toevoegen"), form labels, toast messages, error messages, placeholder text, page titles, empty states -- all consistently Dutch. No English user-facing strings were found.

Code comments and variable names are in English, which is the intended convention per CLAUDE.md memory notes.

**Recommendation:** None. This is well-maintained.

---

### [INFO] shadcn/ui component usage is consistent

**Location:** All form components
**Issue:** All form inputs use shadcn/ui components (`<Input>`, `<Button>`, `<Select>`, `<Textarea>`, `<Label>`, `<Dialog>`, `<Card>`, `<Table>`, etc.). No raw HTML `<input>`, `<button>`, or `<select>` elements were found in component files. The only raw HTML table elements appear in `calendar.tsx` (shadcn component itself), `table-skeletons.tsx`, and `planning-overzicht.tsx`.

**Recommendation:** None. This is well-maintained.

---

### [WARNING] Inconsistent `Loader2` spinner sizing across components

**Location:** Multiple files
**Issue:** While all loading spinners consistently use the `Loader2` icon from lucide-react with `animate-spin`, the sizing varies:
- Inline button spinners: `h-4 w-4` (consistent, good)
- Page-level loading: `h-6 w-6` in some (`directie-dashboard.tsx`, `voorman-dashboard.tsx`, `materiaalman-dashboard.tsx`), `h-8 w-8` in others (`inkooporder-form.tsx:242`)
- Component loading: `h-3 w-3` in `offerte-chat.tsx:199`

**Recommendation:** Standardize page-level spinners to `h-6 w-6` and inline/button spinners to `h-4 w-4`. Consider the existing skeleton system as the preferred pattern for page-level loading instead of spinners.

---

## Prioritized Action Plan

1. **Toast consolidation** (Critical) -- ~2h work. Grep for `from "sonner"` in component files and replace with `from "@/lib/toast-utils"`. Mechanical change.
2. **Chart color tokens** (Critical) -- ~3h work. Replace hardcoded rgb/hsl in analytics components with CSS variable references. Requires testing chart rendering.
3. **Form standardization** (Critical) -- ~4h work. Migrate 6 remaining forms to RHF + Zod. Most are simple forms (leverancier, lead, ziekmelding, herstelmelding, verlof, save-template).
4. **Loading skeletons** (Warning) -- ~3h work. Create loading.tsx for 17 routes using existing skeleton components. Fix padding mismatch in existing 5.
5. **Dialog descriptions** (Warning) -- ~30min. Add `<DialogDescription>` to 4 dialogs.
6. **Page title consistency** (Warning) -- ~15min. Fix dashboard h1 and rapportages h1.
7. **Responsive grids** (Warning) -- ~1h. Add `md:` prefix to `grid-cols-2` in ~15 form locations.
8. **Global error dark mode** (Warning) -- ~30min. Add dark color scheme media query.
