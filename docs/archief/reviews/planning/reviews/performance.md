# Performance Review

**Date:** 2026-03-26
**Reviewer:** Claude Opus 4.6 (automated)
**Scope:** Web app (src/), Convex backend (convex/), configuration files

## Summary

- Critical: 2
- Warning: 6
- Info: 4

---

## Findings

### [CRITICAL] Framer Motion imported directly in 107+ files — not tree-shaken effectively

**Location:** 107 files across `src/` importing `from "framer-motion"` directly
**Issue:** Despite having `LazyMotion` with `domAnimation` in `motion-provider.tsx` and `framer-motion` listed in `optimizePackageImports`, nearly every page and component imports `motion` directly from `"framer-motion"` (e.g., `import { motion } from "framer-motion"`). This means the framer-motion bundle (~50-80KB gzipped) is included in virtually every route's client bundle. The `LazyMotion` provider with `domAnimation` feature set is bypassed when components use the `motion` export directly instead of `m` from `LazyMotion`.
**Impact:** Adds 50-80KB gzipped to the initial JS payload on every page load, including the public landing page (`src/app/page.tsx`), public offerte page, and every dashboard page. This is one of the largest unnecessary bundle costs.
**Recommendation:**
1. Replace `import { motion } from "framer-motion"` with `import { m } from "framer-motion"` across all files that are children of the `LazyMotion` provider (dashboard pages). The `m` component uses the features loaded by `LazyMotion` instead of bundling its own.
2. For pages outside the `LazyMotion` provider (landing page, public pages), consider whether animations are worth the bundle cost. If so, dynamically import them.
3. Consider removing framer-motion from non-essential pages entirely (forms, settings, skeletons) where CSS animations or `@starting-style` would suffice.

### [CRITICAL] Convex full table scans without indexes in analytics and dashboard queries

**Location:** Multiple files in `convex/`:
- `convex/medewerkerAnalytics.ts` — `urenRegistraties.collect()`, `voorcalculaties.collect()` (3 occurrences)
- `convex/users.ts` — `facturen.collect()` (5 occurrences), `users.collect()` (3 occurrences), `urenRegistraties.collect()`, `voorcalculaties.collect()`, `nacalculaties.collect()`, `offerte_versions.collect()`
- `convex/voormanDashboard.ts` — `urenRegistraties.collect()`
- `convex/softDelete.ts` — `offertes.collect()`, `projecten.collect()`, `notifications.collect()`, `notification_log.collect()` (multiple)
- `convex/weekPlanning.ts` — `projecten.collect()`, `voertuigen.collect()`, `machines.collect()`
- `convex/configuratorAanvragen.ts` — full table collect without index
- `convex/analytics.ts` — fetches ALL offertes then filters in JS for date range

**Issue:** These queries call `.collect()` on entire tables without using `.withIndex()`, performing full table scans. As data grows, these will become increasingly slow and consume more Convex bandwidth/compute. The analytics query is particularly concerning: it fetches all offertes for a user, then filters by date in JavaScript, rather than using an index with date range filtering.
**Impact:** Linear degradation as data grows. For a company with 1000+ offertes, 5000+ uren registrations, and hundreds of facturen, these queries will become noticeably slow and expensive. Convex charges per document read.
**Recommendation:**
1. Add composite indexes for common query patterns: `offertes: by_user_createdAt ["userId", "createdAt"]`, `urenRegistraties: by_project_datum` (already exists), `facturen: by_user_status ["userId", "status"]`.
2. Refactor `convex/analytics.ts` to use `withIndex("by_user", ...)` with `.filter()` for date range, or add a `by_user_createdAt` index.
3. For `medewerkerAnalytics.ts` and `users.ts`, filter by userId using indexes instead of collecting all documents and filtering in JS.
4. Consider pagination (`.paginate()`) for soft-delete cleanup queries.

---

### [WARNING] Sentry Replay integration loaded for all users — adds ~70KB to client bundle

**Location:** `sentry.client.config.ts`
**Issue:** `Sentry.replayIntegration()` is included in the integrations array unconditionally. This loads the Sentry Replay SDK (~70KB gzipped) for every user, even though `replaysSessionSampleRate` is only 0.05 (5%) in production. The replay code is bundled and parsed regardless of whether a session is actually recorded.
**Impact:** Adds ~70KB gzipped to the client JS bundle for all users. Only 5% of sessions actually use it.
**Recommendation:** Use `Sentry.replayIntegration` with lazy loading:
```ts
integrations: (defaultIntegrations) => [
  ...defaultIntegrations,
  Sentry.replayIntegration({
    maskAllText: true,
    blockAllMedia: true,
  }),
],
// Or use lazyLoadIntegration for on-demand loading
```
Alternatively, only add the replay integration conditionally based on a sampling decision made before Sentry init, or use Sentry's built-in lazy loading for replay (`Sentry.lazyLoadIntegration("replayIntegration")`).

### [WARNING] `@react-email/components` included in client bundle

**Location:** `package.json` (dependency), used in `src/emails/`, `src/components/email/`, `src/app/api/email/route.ts`
**Issue:** `@react-email/components` is listed as a production dependency and imported in files under `src/`. While the email templates are only rendered server-side (in API routes), the package is still available for client-side bundling. If any client component transitively imports email-related code, the ~40KB react-email package enters the client bundle.
**Impact:** Potential 40KB added to client bundle if tree-shaking fails to eliminate email components.
**Recommendation:** Move email templates to a server-only path. Add `import "server-only"` at the top of email template files to guarantee they never leak into client bundles. Consider moving email templates to `convex/` or a dedicated server-only directory.

### [WARNING] `date-fns` full library potentially bundled

**Location:** `package.json` — `date-fns: ^4.1.0`
**Issue:** While `date-fns` is listed in `optimizePackageImports` in next.config.ts (good), date-fns v4 is an ESM-first package. If any import paths use the barrel export (`from "date-fns"`) without proper tree-shaking, unused functions may be bundled. The `src/lib/format.ts` and `src/lib/excel-export.ts` files import from date-fns.
**Impact:** date-fns full bundle is ~70KB. With proper tree-shaking only used functions are included (~5-10KB). The `optimizePackageImports` config should handle this, but worth verifying with a bundle analysis.
**Recommendation:** Run `npx @next/bundle-analyzer` to verify date-fns is properly tree-shaken. If not, switch to direct subpath imports: `from "date-fns/format"` instead of `from "date-fns"`.

### [WARNING] Landing page loads framer-motion, demo-calculator, and multiple heavy components eagerly

**Location:** `src/app/page.tsx`
**Issue:** The public landing page directly imports:
- `motion` from `"framer-motion"` (50-80KB)
- `DemoCalculator` component (interactive calculator with state)
- `AnimatedHero`, `ScrollProgress`, `GlassCard`, `BeforeAfterComparison`, `FAQSection`, `StoryCard` — all animation-heavy
- 20+ Lucide icons

All are loaded eagerly on the initial page load. This is the entry point for marketing/SEO and should have minimal JS.
**Impact:** First load JS on the landing page is likely 300KB+ gzipped. This hurts Core Web Vitals (LCP, FID/INP) and SEO scores.
**Recommendation:**
1. Use `next/dynamic` to lazy-load below-the-fold sections: `DemoCalculator`, `BeforeAfterComparison`, `FAQSection`, `StoryCard`.
2. Consider making the landing page a Server Component with only small interactive islands using `"use client"` boundaries.
3. Use CSS animations for hero section instead of framer-motion.

### [WARNING] PDF generation happens entirely client-side

**Location:** `src/components/pdf/pdf-download-button.tsx`, `src/hooks/use-pdf-generation.ts`
**Issue:** `@react-pdf/renderer` (~500KB) generates PDFs entirely in the browser. While the button is dynamically imported (good), the actual PDF generation runs on the main thread when clicked, potentially blocking the UI for several seconds on complex offertes with many line items.
**Impact:** UI freezes during PDF generation. On low-powered devices, generating a complex offerte PDF can take 3-5 seconds.
**Recommendation:**
1. Move PDF generation to a Web Worker using `pdf().toBlob()` in a worker thread.
2. Alternatively, move PDF generation server-side to a Convex action or Next.js API route, returning a download URL.
3. The dynamic import pattern in `src/components/pdf/dynamic.tsx` is already good — keep it.

### [WARNING] `convex/analytics.ts` fetches all data in a single monolithic query

**Location:** `convex/analytics.ts` `getAnalyticsData` query, `src/hooks/use-analytics.ts`
**Issue:** The `getAnalyticsData` query fetches ALL offertes for a user, computes KPIs, monthly trends, quarterly revenue, scope margins, top klanten, status distribution, pipeline funnel, forecasts, and export data — all in a single Convex query. Any parameter change (date range) re-fetches everything. The hook returns ~12 different data objects.
**Impact:** Slow initial load for the analytics/rapportages page. Any date filter change triggers a full recomputation. Convex queries have execution time limits.
**Recommendation:**
1. Split into smaller, focused queries: `getKpis`, `getMonthlyTrend`, `getScopeMarges`, `getTopKlanten`, etc.
2. Use Convex's reactive query system — each component subscribes only to the data it needs.
3. This also enables better Suspense boundaries — each chart can load independently.

---

### [INFO] Image optimization is well configured

**Location:** `next.config.ts`, `src/` components
**Issue:** No raw `<img>` tags found in source. `next/image` is used in `werklocatie-foto-gallery.tsx`, `app-sidebar.tsx`, `configurator-foto-upload.tsx`, and `qc-foto-upload.tsx`. The only `<img>` usage is for base64 data URLs (signatures), which is correctly documented with comments explaining why `next/image` is not suitable.
**Impact:** N/A — this is done correctly.
**Recommendation:** No action needed. Image config in next.config.ts includes AVIF/WebP formats, proper remote patterns, and cache TTL of 1 week.

### [INFO] Font loading follows best practices

**Location:** `src/app/layout.tsx`
**Issue:** Uses `next/font/google` with Geist and Geist_Mono fonts, specifying `subsets: ["latin"]` and CSS variable assignment. This is the recommended approach — fonts are self-hosted, preloaded, and applied via CSS variables.
**Impact:** N/A — this is done correctly.
**Recommendation:** No action needed.

### [INFO] Dynamic imports are well-structured for heavy components

**Location:**
- `src/components/analytics/dynamic.tsx` — 13 chart components lazy-loaded with skeletons
- `src/components/pdf/dynamic.tsx` — PDF button lazy-loaded with loading state
- `src/components/project/dynamic-components.tsx` — project charts and PDF lazy-loaded
- `src/components/medewerkers/dynamic-dialogs.tsx` — dialogs lazy-loaded
- `src/components/offerte/dynamic-dialogs.tsx` — offerte dialogs lazy-loaded
- `src/components/ui/signature-pad-dynamic.tsx` — signature pad lazy-loaded
- `src/lib/export-utils.ts` — ExcelJS dynamically imported on export click

**Impact:** Positive — this pattern keeps heavy libraries (recharts ~200KB, @react-pdf/renderer ~500KB, exceljs ~300KB, signature_pad ~50KB) out of the initial bundle.
**Recommendation:** This is a good pattern. Continue using it for any new heavy component additions. The rapportages page correctly uses the dynamic chart components.

### [INFO] CSS optimization is handled by Tailwind CSS v4

**Location:** `package.json` — `tailwindcss: ^4`, `@tailwindcss/postcss: ^4`
**Issue:** Tailwind CSS v4 uses a JIT compiler that only generates CSS for classes actually used in the codebase. Unused styles are automatically excluded.
**Impact:** N/A — automatic optimization.
**Recommendation:** No action needed. The `tw-animate-css` plugin is small. Verify no large custom CSS files exist outside of `globals.css`.

---

## Priority Action Items

1. **[CRITICAL] Fix framer-motion imports** — Switch from `motion` to `m` component in all dashboard files, or remove framer-motion from pages where CSS animations suffice. Estimated savings: 50-80KB per route.

2. **[CRITICAL] Add Convex indexes for full-table-scan queries** — Particularly `medewerkerAnalytics.ts`, `users.ts` dashboard queries, and `analytics.ts`. Add `by_user_createdAt` composite indexes.

3. **[WARNING] Lazy-load Sentry Replay** — Use `lazyLoadIntegration` to avoid bundling 70KB for all users.

4. **[WARNING] Optimize landing page** — Lazy-load below-fold sections and remove framer-motion dependency from critical rendering path.

5. **[WARNING] Split analytics query** — Break monolithic `getAnalyticsData` into focused queries for better reactivity and loading UX.

6. **[WARNING] Move PDF generation off main thread** — Use Web Worker or server-side generation.
