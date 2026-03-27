# Error Handling Review

**Date:** 2026-03-26
**Reviewer:** Claude (automated code review)
**Scope:** Full project error handling audit across web app, API routes, Convex backend, and React components

## Summary

- **Critical: 3**
- **Warning: 8**
- **Info: 7**

Overall, the project has a **solid error handling foundation** with Sentry integration, custom error classes, specialized error boundaries, Dutch user-facing messages, and retry utilities. The critical issues are gaps that could cause data loss or silent failures in production.

---

## Findings

### [CRITICAL] No root-level not-found.tsx page

**Location:** `src/app/not-found.tsx` (missing)
**Issue:** There is no `not-found.tsx` at the root `src/app/` level. While `(dashboard)/not-found.tsx` and `(public)/not-found.tsx` exist, any 404 for routes outside these groups (or uncaught `notFound()` calls) will fall through to Next.js's default 404 page, which is in English and unstyled.
**Recommendation:** Create `src/app/not-found.tsx` with Dutch text and consistent branding as the ultimate fallback 404 page.

### [CRITICAL] Convex mutations use plain `throw new Error()` instead of `ConvexError`

**Location:** 459 occurrences of `throw new Error(...)` across 59 files in `convex/` (0 uses of `ConvexError`)
**Issue:** All Convex mutations throw plain `Error` objects. Convex's `ConvexError` class is designed specifically for user-facing errors and provides structured error data that the client can inspect programmatically (e.g., error codes, field-level errors). With plain `Error`, the client receives a generic error message and cannot distinguish between validation errors, not-found errors, and authorization errors without string matching. In production, Convex may even redact plain `Error` messages for security, showing only "Internal Server Error."
**Recommendation:** Migrate all user-facing mutation errors to `ConvexError` from `convex/values`:
```typescript
// Before
throw new Error("Klant niet gevonden");

// After
import { ConvexError } from "convex/values";
throw new ConvexError({ code: "NOT_FOUND", message: "Klant niet gevonden" });
```
Update `getMutationErrorMessage()` in `src/lib/error-handling.ts` to extract `ConvexError` data. This is a large but high-impact change.

### [CRITICAL] Missing not-found.tsx in (auth) route group

**Location:** `src/app/(auth)/not-found.tsx` (missing)
**Issue:** The `(auth)` route group has an `error.tsx` but no `not-found.tsx`. Invalid auth routes (e.g., `/sign-in/typo`) will show the default Next.js 404 or bubble up to a parent not-found, which may not have the auth-specific layout or messaging.
**Recommendation:** Create `src/app/(auth)/not-found.tsx` that redirects to `/sign-in` or shows a helpful Dutch message like "Deze pagina bestaat niet. Ga naar de inlogpagina."

---

### [WARNING] No loading.tsx for most dashboard sub-routes

**Location:** `src/app/(dashboard)/` -- only 5 of ~20 route directories have `loading.tsx`
**Issue:** Loading states exist for `offertes`, `projecten`, `klanten`, `uren`, and `instellingen`, but are missing for `dashboard`, `facturen`, `gebruikers`, `inkoop`, `leveranciers`, `medewerkers`, `planning`, `prijsboek`, `profiel`, `rapportages`, `toolbox`, `archief`, `verificatie`, `verlof`, `verzuim`, `voorraad`, and `wagenpark`. Users navigating to these pages see no loading skeleton, causing perceived lag.
**Recommendation:** Add `loading.tsx` files for all dashboard sub-routes, at minimum the high-traffic ones (`medewerkers`, `facturen`, `planning`, `wagenpark`). Consider a shared skeleton component to reduce boilerplate.

### [WARNING] No nested error.tsx in dashboard sub-routes

**Location:** `src/app/(dashboard)/*/error.tsx` (missing for all sub-routes)
**Issue:** Only the top-level `(dashboard)/error.tsx` exists. If a single page like `/offertes` throws, the entire dashboard content area is replaced by the error boundary. Sub-route error boundaries would allow the sidebar and header to remain visible while showing a localized error.
**Recommendation:** Add `error.tsx` to at least the most critical routes: `offertes`, `projecten`, `klanten`, `facturen`. These can be lightweight wrappers that show context-specific error messages (e.g., "Offertes konden niet worden geladen").

### [WARNING] Weather API returns 200 with error data on failure

**Location:** `src/app/api/weather/route.ts:112-115`
**Issue:** When the OpenWeatherMap API call fails, the route returns `status: 200` with mock data and an error field. While the intent is to prevent UI breakage, this masks real failures from monitoring tools and makes debugging difficult. Sentry will not capture this as an error.
**Recommendation:** Return a proper error status code (e.g., 502) and let the client handle fallback to mock data. Alternatively, keep the 200 response but add explicit Sentry logging:
```typescript
Sentry.captureMessage("Weather API fallback to mock data", { level: "warning" });
```

### [WARNING] Email route has bare `catch {}` losing error context

**Location:** `src/app/api/email/route.ts:317`
**Issue:** The outer catch block uses `catch {}` without capturing the error variable. The error message "Fout bij verzenden email" is returned but the actual error is neither logged nor sent to Sentry. This makes debugging email failures in production very difficult.
**Recommendation:** Change to `catch (error) { console.error("[email] Error:", error); ... }` and add Sentry capture.

### [WARNING] Inconsistent error handling in form components

**Location:** Multiple form components across `src/components/`
**Issue:** Of the ~48 form components with try/catch, only 10 use the standardized `showErrorToast` + `getMutationErrorMessage` pattern. The remaining use direct `toast.error()` with ad-hoc error messages or raw `error.message`. Examples:
- `src/components/leads/nieuwe-lead-dialog.tsx` uses `toast.error(error instanceof Error ? error.message : "...")`
- `src/components/betaling-button.tsx` uses direct toast calls
- `src/components/offerte/send-email-dialog.tsx` has its own error message logic

This leads to inconsistent user-facing error messages.
**Recommendation:** Standardize all form error handling to use `showErrorToast` + `getMutationErrorMessage`. Consider a shared `useMutationWithToast` hook that wraps Convex mutations with consistent error handling.

### [WARNING] OfflineIndicator not present in (public) or (auth) layouts

**Location:** `src/app/(public)/layout.tsx`, `src/app/(auth)/layout.tsx`
**Issue:** The `OfflineIndicator` component is only included in the `(dashboard)` layout. Public-facing pages (e.g., the customer-facing offerte view) and auth pages have no offline indication. A customer viewing their quote offline gets no feedback.
**Recommendation:** Add `OfflineIndicator` to the `(public)` layout at minimum, since customers may be viewing quotes on mobile with intermittent connectivity.

### [WARNING] Sentry client config filters out "Failed to fetch" errors

**Location:** `sentry.client.config.ts:46`
**Issue:** The `ignoreErrors` array includes `"Failed to fetch"`, which is the exact error message for network failures during API calls. This means genuine API failures due to server downtime or CORS issues will be silently dropped from Sentry. While this reduces noise from transient network issues, it also hides real problems.
**Recommendation:** Instead of ignoring all "Failed to fetch" errors, use `beforeSend` to add more nuanced filtering (e.g., only ignore if the user is offline based on `navigator.onLine`).

### [WARNING] `withRetry` utility not used in API routes

**Location:** `src/lib/error-handling.ts:154-197` (the `withRetry` function)
**Issue:** The `withRetry` utility with exponential backoff exists and is well-tested, but none of the 8 API routes use it for external API calls (FleetGo, Mollie, OpenWeatherMap, OpenAI, Anthropic). These external calls are prone to transient failures that would benefit from automatic retry.
**Recommendation:** Apply `withRetry` to external API calls in route handlers, particularly for non-idempotent-safe services. At minimum, use it for the weather API and FleetGo vehicle data reads.

---

### [INFO] Excellent error boundary architecture

**Location:** `src/components/error-boundary.tsx`, `src/app/global-error.tsx`, `src/app/(dashboard)/error.tsx`, `src/app/(public)/error.tsx`, `src/app/(auth)/error.tsx`
**Issue:** None -- this is positive feedback.
**Details:** The project has a well-structured error boundary hierarchy:
- `global-error.tsx` at root with inline styles (no dependency on CSS framework)
- Route group error boundaries (`dashboard`, `public`, `auth`) with context-specific UIs
- `ErrorBoundary` class component in root layout wrapping all children
- Specialized boundaries: `ChartErrorBoundary`, `PDFErrorBoundary`, `DataFetchErrorBoundary`
- HOC wrappers: `withChartErrorBoundary`, `withPDFErrorBoundary`, `withDataFetchErrorBoundary`
- `useErrorHandler` hook for functional components

All error boundaries integrate with Sentry and show Dutch-language messages.

### [INFO] Comprehensive error handling library with tests

**Location:** `src/lib/error-handling.ts`, `src/__tests__/error-handling.test.ts`
**Issue:** None -- positive feedback.
**Details:** The error handling library provides:
- Custom error classes: `AppError`, `ValidationError`, `NotFoundError`, `AuthenticationError`, `AuthorizationError`
- `withErrorHandling` wrapper for async operations with Sentry context
- `getUserFriendlyMessage` for converting errors to Dutch user messages
- `getMutationErrorMessage` for Convex mutation error translation
- `withRetry` with exponential backoff and jitter
- `handleBackgroundError` and `createBackgroundErrorHandler` for non-critical operations
- All tested with Vitest (16 tests)

### [INFO] ChunkReloadHandler prevents stale deployment errors

**Location:** `src/components/chunk-reload-handler.tsx`, mounted in `src/app/layout.tsx`
**Issue:** None -- positive feedback.
**Details:** Handles `ChunkLoadError` and failed dynamic imports (common after deployments) by auto-reloading with a 60-second cooldown to prevent infinite loops. Listens to both `error` and `unhandledrejection` events.

### [INFO] API routes have consistent error patterns

**Location:** All 8 files in `src/app/api/`
**Issue:** None -- mostly positive feedback.
**Details:** All API routes follow good patterns:
- Try/catch wrapping entire handler
- Input validation with Dutch error messages
- Rate limiting (FleetGo, email routes)
- Auth checks where needed (transcribe, summarize)
- Timeout handling (FleetGo has 30s abort controller)
- Specific error status codes (400, 401, 413, 429, 502, 503)
- API key existence checks with graceful fallbacks

### [INFO] Form data preserved on submission error

**Location:** All React Hook Form components (e.g., `src/components/medewerkers/medewerker-form.tsx`)
**Issue:** None -- positive feedback.
**Details:** Forms use React Hook Form which inherently preserves form data on submission errors. The `isLoading` state is properly managed in `finally` blocks, preventing stuck loading states. The form `reset()` is only called on dialog open/close, not on error, so user data is preserved after failed submissions.

### [INFO] Toast notification system is well-structured

**Location:** `src/lib/toast-utils.ts`
**Issue:** None -- positive feedback.
**Details:** Centralized toast utilities with `showSuccessToast`, `showErrorToast`, `showInfoToast`, `showWarningToast`, `showSavingToast` + `completeSavingToast`, undo support, and promise tracking. Uses Sonner with `richColors` and consistent Dutch messages.

### [INFO] Webhook routes handle Mollie's always-200 requirement correctly

**Location:** `src/app/api/mollie/webhook/route.ts`
**Issue:** None -- positive feedback.
**Details:** The Mollie webhook correctly returns 200 even on internal errors (lines 101-103, 133, 139), as Mollie will retry webhooks that don't receive a 200 response. Error cases are logged but the response remains 200.

---

## Architecture Assessment

### What's Working Well
1. **Layered error boundaries** -- global, route-group, and component-level
2. **Sentry integration** -- all error boundaries and the error handling library report to Sentry with context tags
3. **Dutch user messages** -- consistent across error boundaries, API routes, and toast notifications
4. **Form data preservation** -- React Hook Form prevents data loss on errors
5. **Offline detection** -- `OfflineIndicator` + `useOnlineStatus` hook in dashboard
6. **Chunk reload handling** -- prevents blank pages after deployments
7. **Rate limiting** -- on external API proxy routes
8. **Specialized error boundaries** -- for charts, PDFs, and data fetching

### What Needs Improvement
1. **ConvexError adoption** -- the single biggest gap; plain `Error` in 459 places across 59 Convex files
2. **Root not-found page** -- missing global 404 fallback
3. **Loading state coverage** -- only 5/20 dashboard routes have skeletons
4. **Error handling consistency** -- 38/48 form components use ad-hoc patterns instead of the standardized `showErrorToast` + `getMutationErrorMessage`
5. **Retry logic in API routes** -- the `withRetry` utility exists but is unused where it matters most

### Priority Recommendations (ordered by impact)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 | Create root `not-found.tsx` and `(auth)/not-found.tsx` | Low | High |
| P1 | Migrate Convex errors to `ConvexError` (start with critical flows) | High | High |
| P1 | Add `catch (error)` to email route's bare catch block | Low | Medium |
| P2 | Standardize form error handling with shared mutation hook | Medium | Medium |
| P2 | Add `loading.tsx` for remaining dashboard routes | Medium | Medium |
| P3 | Add nested `error.tsx` in critical dashboard sub-routes | Low | Low |
| P3 | Apply `withRetry` to external API calls | Low | Low |
| P3 | Add `OfflineIndicator` to public layout | Low | Low |
| P3 | Refine Sentry error filtering for "Failed to fetch" | Low | Low |
