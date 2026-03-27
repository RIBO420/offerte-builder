# Dead Code & Cleanup Review

**Date:** 2026-03-26
**Scope:** src/, convex/, mobile/ (excluding node_modules)

## Summary

- Critical: 5
- Warning: 18
- Info: 14

## Statistics

- Unused components: 18 (6 top-level + 12 UI)
- Unused hooks: 11
- Unused lib files: 3
- Unused Convex modules (no frontend callers): 5
- Unused API routes: 4
- Console.log statements: 3 in src/ (production), 1 in convex/ (non-README), ~35 in mobile/
- TODO/FIXME/HACK comments: 12
- Commented-out code blocks: 7
- Empty/placeholder files: 2
- Duplicate code patterns: 3

---

## Findings

### 1. Unused Components

#### [CRITICAL] 6 Top-Level Components Never Imported

**Location:** `src/components/`
**Issue:** These components are never imported by any page, layout, or other component:

| File | Lines | Description |
|------|-------|-------------|
| `src/components/akkoord-formulier.tsx` | 485 | Acceptance form component |
| `src/components/algemene-voorwaarden.tsx` | 421 | Terms & conditions display |
| `src/components/betaling-button.tsx` | 169 | Payment button |
| `src/components/calendly-embed.tsx` | 165 | Calendly scheduling embed |
| `src/components/configurator-foto-upload.tsx` | 493 | Photo upload for configurator |
| `src/components/instructie-videos.tsx` | 232 | Instructional videos component |

**Total dead code:** ~1,965 lines
**Recommendation:** Verify these are not planned for future use, then remove. If planned, move to a `_drafts/` folder.

#### [WARNING] 12 UI Components Never Used Outside Barrel Export

**Location:** `src/components/ui/`
**Issue:** These components are exported from `src/components/ui/index.ts` but never actually imported by any consuming component or page:

| File | Description |
|------|-------------|
| `src/components/ui/enhanced-empty-state.tsx` | **Empty file (0 lines)** |
| `src/components/ui/price-anomaly-alert.tsx` | Price anomaly warning |
| `src/components/ui/realtime-indicator.tsx` | Real-time status indicator |
| `src/components/ui/scope-checkbox.tsx` | Scope selection checkbox |
| `src/components/ui/touch-target.tsx` | Touch target wrapper |
| `src/components/ui/swipeable-row.tsx` | Swipeable table row |
| `src/components/ui/long-press-menu.tsx` | Long-press context menu |
| `src/components/ui/stats-grid.tsx` | Statistics grid layout |
| `src/components/ui/scope-cost-distribution.tsx` | Scope cost chart |
| `src/components/ui/floating-action-bar.tsx` | Floating action bar |
| `src/components/ui/pipeline-view.tsx` | Pipeline visualization |
| `src/components/ui/motion-button.tsx` | Animated button variants |
| `src/components/ui/motion-card.tsx` | Animated card variants |
| `src/components/ui/highlight-on-change.tsx` | Value change highlight |
| `src/components/ui/input-with-feedback.tsx` | Input with validation feedback |
| `src/components/ui/smart-input.tsx` | Enhanced input component |
| `src/components/ui/wizard-stepper.tsx` | Multi-step wizard nav |
| `src/components/ui/pdf-progress-modal.tsx` | PDF generation progress |
| `src/components/ui/skeleton-card.tsx` | Skeleton loading card |
| `src/components/ui/drag-handle.tsx` | Drag handle icon |

**Recommendation:** Remove unused UI components from index.ts barrel export and delete the files. The `enhanced-empty-state.tsx` is a 0-byte empty file and should be deleted immediately.

#### [INFO] `src/components/theme-toggle.tsx` Completely Unreferenced

**Location:** `src/components/theme-toggle.tsx`
**Issue:** Not imported anywhere in the entire codebase. No reference to `ThemeToggle` or `theme-toggle` exists.
**Recommendation:** Delete.

---

### 2. Unused Hooks

#### [WARNING] 11 Hooks Never Imported

**Location:** `src/hooks/`
**Issue:** These hooks are defined but never imported by any component or page:

| File | Lines | Description |
|------|-------|-------------|
| `src/hooks/use-afvalverwerkers.ts` | 34 | Waste processor data hook |
| `src/hooks/use-garantie-pakketten.ts` | 33 | Warranty package hook |
| `src/hooks/use-inkooporders.ts` | 191 | Purchase order hook |
| `src/hooks/use-input-format.ts` | 241 | Input formatting hook |
| `src/hooks/use-kwaliteits-controles.ts` | 283 | Quality control hook |
| `src/hooks/use-optimistic.ts` | 258 | Optimistic update hook |
| `src/hooks/use-plantsoorten.ts` | 48 | Plant species hook |
| `src/hooks/use-project-kosten.ts` | 290 | Project costs hook |
| `src/hooks/use-realtime.ts` | 380 | Real-time updates hook |
| `src/hooks/use-transportbedrijven.ts` | 34 | Transport company hook |
| `src/hooks/use-verzuim.ts` | 73 | Sick leave hook |

**Total dead code:** ~1,865 lines
**Recommendation:** Delete unused hooks. If any are planned for future features, document in a tracking issue.

---

### 3. Unused Lib Files

#### [WARNING] 3 Library Files Never Imported

| File | Lines | Issue |
|------|-------|-------|
| `src/lib/register-sw.ts` | 7 | Registers `/sw.js` service worker but is never called. `public/sw.js` exists but the registration code is dead. |
| `src/lib/constants/project-statuses.ts` | ~105 | Comprehensive project status config with icons and colors, never imported anywhere. |
| `src/lib/date-locale.ts` | 3 | Re-exports `nl` locale from date-fns, never imported. |

**Recommendation:** Delete all three. If service worker is needed, wire up `register-sw.ts` properly or remove both it and `public/sw.js`.

---

### 4. Unused Convex Backend Modules

#### [CRITICAL] `convex/pushNotifications.ts` Duplicates `convex/notifications.ts`

**Location:** `convex/pushNotifications.ts` (985 lines) and `convex/notifications.ts`
**Issue:** Both files export overlapping functionality with duplicate function names:
- Both have: `logNotification`, `getUnreadCount`, `markAsRead`, `markAllAsRead`, `createNotification`/`createInAppNotification`
- Both manage push tokens: `savePushToken`/`registerPushToken`, `removePushToken`/`unregisterPushToken`
- Both have offerte status change notifiers
- `pushNotifications.ts` is NOT called from any frontend code or internal Convex function (only in `_generated/api.d.ts`)
- `notifications.ts` IS actively used by frontend and crons

**Recommendation:** Consolidate into `notifications.ts` and delete `pushNotifications.ts`. Migrate any unique functionality first.

#### [CRITICAL] `convex/brandstof.ts` Duplicates `convex/brandstofRegistratie.ts`

**Location:** `convex/brandstof.ts` (395 lines) and `convex/brandstofRegistratie.ts`
**Issue:** Both manage fuel data with overlapping functions:
- Both have: `listByVoertuig`, `create`, `remove`
- `brandstof.ts` has NO frontend callers and NO internal Convex references
- `brandstofRegistratie.ts` IS actively used (`src/hooks/use-voertuig-details.ts`, `src/components/wagenpark/brandstof-form.tsx`)

**Recommendation:** Delete `convex/brandstof.ts` after verifying no unique logic needs preserving.

#### [WARNING] `convex/medewerkerAnalytics.ts` — No Frontend or Internal Callers

**Location:** `convex/medewerkerAnalytics.ts` (622 lines)
**Issue:** Exports `getMedewerkerStats`, `getTeamPerformance`, `getProductiviteitTrend` — none called from frontend or other Convex modules. The rapportages page uses `convex/analytics.ts` instead.
**Recommendation:** Delete or integrate into `convex/analytics.ts`.

#### [WARNING] `convex/medewerkerRapportages.ts` — No Frontend or Internal Callers

**Location:** `convex/medewerkerRapportages.ts` (583 lines)
**Issue:** Exports `getMedewerkerProductiviteit`, `getMedewerkerVergelijking`, `getUrenPerScope` — none called anywhere.
**Recommendation:** Delete or integrate into existing analytics.

#### [WARNING] `convex/meerwerk.ts` — No Frontend Callers

**Location:** `convex/meerwerk.ts` (139 lines)
**Issue:** Exports `create`, `listByProject`, `get`, `approve`, `reject` — none called from any frontend component. The string `"meerwerk"` appears as a factuur type literal in the facturen page, but the API module itself is unused.
**Recommendation:** Verify if meerwerk feature is planned; if not, delete.

---

### 5. Unused API Routes

#### [WARNING] 4 API Routes Never Called from Frontend or Mobile

| Route | Issue |
|-------|-------|
| `src/app/api/calendly/route.ts` | Webhook handler, but no frontend code references `/api/calendly`. May be called externally by Calendly. |
| `src/app/api/summarize/route.ts` | AI summarization endpoint — not called from src/ or mobile/. |
| `src/app/api/transcribe/route.ts` | Audio transcription endpoint — not called from src/ or mobile/. |
| `src/app/api/weather/route.ts` | Weather data endpoint — not called from src/ or mobile/. |

**Recommendation:** The Calendly route is likely a webhook (external caller) — verify and keep if so. The summarize/transcribe/weather routes appear to be mobile-intended but mobile doesn't reference them either. Delete if unused or document the intended integration.

---

### 6. Console.log Statements

#### [WARNING] Console.log in Production Web Code

**Location:** `src/app/api/calendly/route.ts`
**Issue:** 3 console.log statements logging webhook events (lines 117, 139, 158)
**Recommendation:** Replace with structured logging or remove. These log to server console but add noise.

#### [WARNING] Console.log in Convex Migration

**Location:** `convex/migrations/consolidateNotificationLogs.ts:129`
**Issue:** console.log in migration code
**Recommendation:** Acceptable for one-time migration, but flag for cleanup after migration completes.

#### [INFO] ~35 Console.log Statements in Mobile Code

**Location:** Various files in `mobile/`
**Issue:** Extensive logging in auth flows, sync engine, push notifications, and callbacks. Key files:
- `mobile/lib/auth/hooks.ts` (4 statements)
- `mobile/lib/auth/biometric.ts` (7 statements)
- `mobile/lib/auth/clerk.tsx` (3 statements)
- `mobile/lib/storage/sync-engine.ts` (2 statements)
- `mobile/lib/storage/migrations.ts` (4 statements)
- `mobile/hooks/use-push-notifications.ts` (5 statements)
- `mobile/app/(auth)/login.tsx` (3 statements)
- `mobile/app/(auth)/callback.tsx` (2 statements)
- `mobile/app/(auth)/biometric-login.tsx` (1 statement)

**Recommendation:** Replace with a debug logger utility that can be silenced in production builds (e.g., `__DEV__` guard or a logging library).

---

### 7. Duplicate Code Patterns

#### [CRITICAL] Duplicate `kenteken-plaat` Components

**Location:** `src/components/ui/kenteken-plaat.tsx` and `src/components/wagenpark/kenteken-plaat.tsx`
**Issue:** Two license plate components exist. The UI version (~71 lines of format/validation logic) is more complete with pattern matching, formatting, and memoization. The wagenpark version is simpler. The wagenpark barrel export uses its local version.
**Recommendation:** Keep one canonical version in `ui/` and update the wagenpark barrel export to re-export from `ui/`.

#### [WARNING] Duplicate `validation-summary` Components

**Location:** `src/components/ui/validation-summary.tsx` (204 lines) and `src/components/offerte/validation-summary.tsx` (169 lines)
**Issue:** Two validation summary components with similar purpose.
**Recommendation:** Consolidate into a single version in `ui/` with configurable props for offerte-specific needs.

#### [CRITICAL] Duplicate Notification Modules in Convex

**Location:** `convex/notifications.ts` and `convex/pushNotifications.ts`
**Issue:** See finding #4 above. Massive overlap in push notification, in-app notification, and token management logic across 985 + ~1300 lines.
**Recommendation:** Consolidate immediately to prevent divergent behavior.

---

### 8. Empty/Placeholder Files

#### [WARNING] Empty Component File

**Location:** `src/components/ui/enhanced-empty-state.tsx` (0 lines)
**Issue:** Completely empty file — 0 bytes. Still exported from `ui/index.ts` (would cause import errors if anyone tried to use it).
**Recommendation:** Delete immediately and remove from barrel export.

#### [INFO] Minimal Files

| File | Lines | Content |
|------|-------|---------|
| `src/lib/date-locale.ts` | 3 | Only re-exports `nl` from date-fns — unused |
| `src/__tests__/setup.ts` | 1 | Minimal test setup file (acceptable) |
| `mobile/nativewind-env.d.ts` | 1 | Type declaration (acceptable) |

---

### 9. Commented-Out Code Blocks

#### [WARNING] Commented-Out Code in Production Files

| File | Line(s) | Description |
|------|---------|-------------|
| `src/lib/hooks/use-resource-factory.ts` | 17-21 | Commented-out example usage of factory hook |
| `convex/notifications.ts` | 1266 | Commented-out push notification dispatch: `// if (shouldSend.push) { ... }` |
| `src/components/wagenpark/fleetgo-sync.tsx` | 92-93 | Commented-out API connection code |
| `src/app/api/mollie/webhook/route.ts` | 165 | Commented-out Convex mutation call |
| `src/app/api/calendly/route.ts` | 127, 147 | Commented-out Convex mutation calls (afspraken.aanmaken, afspraken.annuleren) |

**Recommendation:** Remove commented-out code. If it represents planned work, replace with a TODO comment referencing an issue/ticket.

#### [INFO] Files with Heavy Comment Density

Top files by comment-line count (may contain excessive documentation or disabled code):

| File | Comment Lines | Total Context |
|------|--------------|---------------|
| `convex/schema.ts` | 240 | Schema file with extensive field documentation |
| `convex/users.ts` | 178 | Auth/role management with security comments |
| `src/lib/offerte-calculator.ts` | 143 | Complex calculation logic with explanations |

These are mostly documentation comments and are acceptable, but worth reviewing for stale comments.

---

### 10. TODO/FIXME/HACK Catalog

| File | Line | Type | Comment |
|------|------|------|---------|
| `src/app/api/calendly/route.ts` | 13 | TODO | Sla afspraakinformatie op in Convex in plaats van alleen te loggen |
| `src/app/api/calendly/route.ts` | 126 | TODO | Sla de afspraak op in Convex |
| `src/app/api/calendly/route.ts` | 146 | TODO | Markeer de afspraak als geannuleerd in Convex |
| `src/app/api/mollie/webhook/route.ts` | 162 | TODO | Update betalingsstatus in Convex via een server-side action |
| `src/app/(dashboard)/instellingen/components/koppelingen-tab.tsx` | 39 | TODO | Save API key to backend |
| `src/app/(dashboard)/instellingen/components/koppelingen-tab.tsx` | 43 | TODO | Test actual connection |
| `src/app/(dashboard)/projecten/[id]/factuur/page.tsx` | 361 | TODO | Implement PDF generation/download |
| `src/app/(dashboard)/projecten/[id]/factuur/page.tsx` | 367 | TODO | Implement PDF preview |
| `src/components/wagenpark/fleetgo-sync.tsx` | 91 | TODO | Replace with actual FleetGo API connection check |
| `src/components/wagenpark/fleetgo-sync.tsx` | 120 | TODO | Replace with actual FleetGo API sync |
| `convex/notifications.ts` | 1265 | TODO | Add push notification support when needed |
| `convex/schema.ts` | 22 | TODO | Standardize these in a future migration |

**Total:** 12 TODO comments across the codebase. No FIXME or HACK comments found.

---

## Estimated Cleanup Impact

| Category | Files | Lines (approx) |
|----------|-------|-----------------|
| Unused top-level components | 6 | ~1,965 |
| Unused UI components | 20 | ~2,000 (est.) |
| Unused hooks | 11 | ~1,865 |
| Unused lib files | 3 | ~115 |
| Unused Convex modules | 5 | ~2,724 |
| Duplicate Convex module (pushNotifications) | 1 | ~985 |
| Duplicate component (kenteken-plaat) | 1 | ~70 |
| **Total removable dead code** | **47 files** | **~9,724 lines** |

## Priority Actions

1. **Immediate** (CRITICAL):
   - Delete `src/components/ui/enhanced-empty-state.tsx` (empty file causing potential import errors)
   - Consolidate `convex/pushNotifications.ts` into `convex/notifications.ts`
   - Delete `convex/brandstof.ts` (duplicated by `brandstofRegistratie.ts`)
   - Consolidate duplicate `kenteken-plaat` components

2. **Short-term** (WARNING):
   - Remove 6 unused top-level components (~1,965 lines)
   - Remove 11 unused hooks (~1,865 lines)
   - Remove unused UI components from barrel exports and delete files
   - Delete unused Convex modules (`medewerkerAnalytics`, `medewerkerRapportages`, `meerwerk`)
   - Replace mobile console.log statements with conditional debug logging
   - Remove or implement the 4 unused API routes

3. **Ongoing** (INFO):
   - Address 12 TODO comments (create tracking issues)
   - Remove commented-out code blocks
   - Clean up after migration completes (`convex/migrations/`)
