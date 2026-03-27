# TypeScript Quality Review

**Date:** 2026-03-26
**Scope:** `src/` and `convex/` directories
**Reviewer:** Automated analysis

## Summary
- Critical: 5
- Warning: 12
- Info: 6

## Statistics
- `any` types found: 10 (8 in src/, 2 in convex/)
- Type assertions (`as`): ~479 in src/, ~40 in convex/
- `@ts-ignore`/`@ts-expect-error`: 0
- `eslint-disable @typescript-eslint/*` comments: 14 (12 in src/, 2 in convex/)
- Double-cast (`as unknown as`): 5
- `interface` declarations: ~456 in src/, ~5 in convex/
- `type` alias declarations: ~192 in src/, ~17 in convex/
- Strict mode: **enabled** in tsconfig.json

## Configuration Assessment

The project has `"strict": true` in `tsconfig.json`, which is excellent. This enables:
- `strictNullChecks`
- `noImplicitAny`
- `strictFunctionTypes`
- `strictBindCallApply`
- `strictPropertyInitialization`

However, there is no `noUncheckedIndexedAccess` enabled, which would catch additional null-safety issues with indexed access patterns.

---

## Findings

### CRITICAL

### [CRITICAL] Explicit `any` props in OfferteHeader interface
**Location:** `src/app/(dashboard)/offertes/[id]/components/offerte-header.tsx:61,67`
**Issue:** The `OfferteHeaderProps` interface uses `any` for both `offerte` and `instellingen` props, with eslint-disable comments to suppress the warning. These are core business objects passed through a component that renders offerte details and triggers PDF generation.
```typescript
offerte: any;
instellingen: any;
```
**Recommendation:** Define proper types for these props. The offerte type should come from Convex's generated types (`Doc<"offertes">`), and `instellingen` should use `Doc<"instellingen">`. If the PDF component requires a looser type, create an adapter/mapper instead of degrading the entire prop chain.

### [CRITICAL] Explicit `any` for Convex context in notification helpers
**Location:** `convex/notifications.ts:1150,1168`
**Issue:** Two internal helper functions (`getOfferteNotificationRecipients` and `shouldSendOfferteNotification`) type their `ctx` parameter as `any` instead of using Convex's proper context types. This disables all type checking for database operations within these functions.
```typescript
async function getOfferteNotificationRecipients(ctx: any, offerteId: Id<"offertes">)
async function shouldSendOfferteNotification(ctx: any, userId: Id<"users">, ...)
```
**Recommendation:** Use the proper Convex context types: `QueryCtx` or `MutationCtx` from `convex/_generated/server`. These helpers are called from internal mutations, so `MutationCtx` would be appropriate.

### [CRITICAL] Double-cast pattern in notification-center
**Location:** `src/components/notification-center.tsx:195,203`
**Issue:** Uses `as unknown as Parameters<typeof markAsRead>[0]` -- a double cast through `unknown` to force a string into an expected argument type. This completely bypasses type safety and could cause runtime errors if the mutation signature changes.
```typescript
await markAsRead(notificationId as unknown as Parameters<typeof markAsRead>[0]);
await dismiss(notificationId as unknown as Parameters<typeof dismiss>[0]);
```
**Recommendation:** Accept `Id<"notifications">` directly instead of `string`, or use a proper type conversion. The double cast hides a genuine type mismatch between the component's string-based ID and Convex's typed ID system.

### [CRITICAL] Chained `Record<string, unknown>` casts in projectKosten
**Location:** `convex/projectKosten.ts:1241-1242,1265,1299-1300,1315`
**Issue:** The `getBudgetStatus` and `getBudgetAlerts` queries cast `offerte` and `instellingen` documents through multiple chained `Record<string, unknown>` assertions to access nested properties. This completely removes type safety for critical financial calculations.
```typescript
const budget = (offerte as Record<string, unknown>).totalen
  ? ((offerte as Record<string, unknown>).totalen as Record<string, number>).totaalExBtw ?? 0
  : 0;
const standaardUurtarief = (instellingen as Record<string, unknown>)?.uurtarief as number ?? 45;
```
**Recommendation:** Define proper types for the `offerte.totalen` structure and the `instellingen` table schema. These are financial calculations where incorrect types could lead to wrong budget calculations.

### [CRITICAL] `any` types in generic hook factory
**Location:** `src/lib/hooks/use-resource-factory.ts:28-30,67,112,147,271,354`
**Issue:** The resource factory defines `AnyConvexQuery` and `AnyConvexMutation` type aliases that use `any` for function arguments and return types. These `any` types then cascade through 6 `useQuery` calls where query references are cast `as any`. While the factory pattern is architecturally sound, the `any` types mean consumers get no type checking on query arguments.
```typescript
type AnyConvexQuery = FunctionReference<"query", "public", any, any>;
const data = useQuery(getQuery as any, id ? { id } : "skip") as GetData | undefined;
```
**Recommendation:** Investigate if Convex provides generic utilities to type the `useQuery` call with dynamic function references. If not, at minimum add runtime validation of arguments. The eslint-disable comments are acknowledged, indicating awareness, but the underlying issue remains.

---

### WARNING

### [WARNING] Pervasive `as Id<"tableName">` casts from route params
**Location:** Multiple files (~40 occurrences), including:
- `src/app/(dashboard)/klanten/[id]/page.tsx:138` (`id as Id<"klanten">`)
- `src/app/(dashboard)/offertes/[id]/page.tsx:64` (`id as Id<"offertes">`)
- `src/app/(dashboard)/projecten/[id]/page.tsx:82` (`id as Id<"projecten">`)
- `src/app/(dashboard)/planning/weekplanner/page.tsx:157-181`
- `src/app/(dashboard)/verlof/page.tsx:147,462,480,506`
- `src/app/(dashboard)/verzuim/page.tsx:72,155,156`
- And ~30 more files
**Issue:** Route parameters from Next.js `params` are strings, but Convex expects typed `Id<T>` values. Every page component casts `params.id as Id<"tableName">`, which is unsafe -- any arbitrary string would pass the type check but fail at runtime.
**Recommendation:** Create a utility function like `asConvexId<T>(param: string): Id<T>` that validates the ID format, or create a custom hook `useConvexParam<T>(paramName)` that handles the conversion with validation. This centralizes the pattern and adds runtime safety.

### [WARNING] Unsafe `as Record<string, unknown>` casts for scopeData
**Location:** Multiple files:
- `convex/smartAnalytics.ts:135,340,443`
- `convex/voorcalculaties.ts:249`
- `src/app/(dashboard)/offertes/[id]/page.tsx:408`
- `src/app/(dashboard)/offertes/nieuw/aanleg/page.tsx:302,311,333,342`
- `src/app/(dashboard)/offertes/nieuw/onderhoud/components/use-onderhoud-wizard.ts:303,312,335,344`
**Issue:** `scopeData` is repeatedly cast to `Record<string, unknown>` or `Record<string, Record<string, unknown>>` across multiple files. This is a core domain object (scope configuration data for quotes) that lacks a proper unified type.
**Recommendation:** Define a discriminated union type `ScopeData` that maps scope names to their respective data types. The `src/types/offerte.ts` file already has individual scope types -- combine them into a proper union that the schema can reference.

### [WARNING] Unsafe status string casts throughout the UI
**Location:** Multiple files (~20 occurrences):
- `src/app/(dashboard)/offertes/components/offerte-row.tsx:304` (`offerte.status as OfferteStatus`)
- `src/app/(dashboard)/facturen/page.tsx:248,701` (`factuur.status as FactuurStatus`)
- `src/app/(dashboard)/inkoop/[id]/page.tsx:239,318` (`status as InkooporderStatus`)
- `src/app/(dashboard)/projecten/page.tsx:519` (`project.status as ProjectStatus`)
- `src/components/leads/lead-detail-modal.tsx:167` (`lead.pipelineStatus as PipelineStatus`)
**Issue:** Status fields from the database are treated as `string` and cast to specific union types. If the database contains an unexpected value (e.g., from a schema migration), this would silently bypass type checking.
**Recommendation:** Create type guard functions like `isOfferteStatus(s: string): s is OfferteStatus` and use them with fallback handling. The `getStatusConfig` functions in constants already handle unknown values with fallbacks, but the components still use raw casts.

### [WARNING] Unsafe `as Id<"tableName">` casts from form field values
**Location:** Multiple files:
- `src/components/inkoop/inkooporder-form.tsx:199,209,210,220,221`
- `src/components/verlof/verlof-form.tsx:156`
- `src/components/toolbox/toolbox-form.tsx:120`
- `src/components/verzuim/ziekmelding-form.tsx:38`
- `src/components/medewerkers/team-form.tsx:128`
**Issue:** Form field values (strings from select dropdowns, etc.) are cast directly to Convex `Id<T>` types without validation. If a form has an empty/invalid selection, the cast would produce an invalid ID that only fails at the Convex layer.
**Recommendation:** Use Zod schemas to validate form data before casting to Convex types. Many forms already use React Hook Form + Zod, so adding `.refine()` validators for ID fields would be straightforward.

### [WARNING] Convex query return types cast in hooks
**Location:**
- `src/hooks/use-users.ts:61,62,95`
- `src/hooks/use-voertuig-details.ts:131-134`
- `src/hooks/use-offerte-calculation.ts:33-35,102-104`
- `src/hooks/use-planning.ts:45,50`
- `src/components/project/team-selector.tsx:51`
- `src/components/project/voertuig-selector.tsx:44,205`
**Issue:** Multiple custom hooks cast `useQuery` return values to specific types. This indicates that Convex's type inference is not fully propagating to the hook layer. Examples:
```typescript
const users = (users ?? []) as UserWithDetails[];
const data = (data.normuren || []) as Normuur[];
```
**Recommendation:** Investigate if the Convex queries have properly typed return types. If the query handlers use proper return type annotations, `useQuery` should infer the correct types. The casts may be hiding mismatches between query return types and expected UI types.

### [WARNING] `as Transition` and `as Variants` casts in motion config
**Location:** `src/lib/motion-config.ts:42,50,56,62,68,262,269`
**Issue:** Multiple Framer Motion configuration objects are cast `as Transition` or `as Variants`. This happens 7 times in the file.
**Recommendation:** Use the `satisfies` operator instead: `{ ... } satisfies Transition`. This validates the object shape while preserving the literal types, which is strictly better than `as` casts that can hide errors.

### [WARNING] `as ArrayBuffer` casts for Excel export
**Location:**
- `src/lib/excel-export.ts:187,544`
- `src/app/(dashboard)/projecten/[id]/nacalculatie/export.ts:183`
- `src/app/(dashboard)/prijsboek/page.tsx:113`
**Issue:** Excel buffer results are cast to `ArrayBuffer` without type narrowing. The ExcelJS `writeBuffer()` returns a `Buffer` type that may not perfectly align with `ArrayBuffer`.
**Recommendation:** Use proper type guards or the correct ExcelJS buffer type. Consider: `const buffer: ArrayBuffer = await workbook.xlsx.writeBuffer() as ArrayBuffer;` is acceptable if ExcelJS documentation guarantees ArrayBuffer compatibility, but a utility wrapper would be cleaner.

### [WARNING] Unsafe event target casts
**Location:**
- `src/components/ui/long-press-menu.tsx:92` (`e.target as Node`)
- `src/components/ui/swipeable-row.tsx:197` (`e.target as Node`)
- `src/components/ui/tag-input.tsx:87` (`event.target as Node`)
- `src/components/offerte/offerte-card.tsx:113` (`e.target as HTMLElement`)
- `src/app/(dashboard)/inkoop/page.tsx:153` (`e.target as HTMLElement`)
- `src/components/wagenpark/fleetgo-settings.tsx:192` (`document.getElementById(...) as HTMLInputElement`)
**Issue:** DOM event targets are cast to specific element types without null/type checking. `event.target` can be `null` in some edge cases, and `document.getElementById` returns `HTMLElement | null`.
**Recommendation:** Use `instanceof` checks before accessing type-specific properties: `if (e.target instanceof HTMLElement) { ... }`. For `getElementById`, add a null check.

### [WARNING] `as UserRole` casts without validation in roles module
**Location:** `convex/roles.ts:38,325,345`
**Issue:** User roles from the database are cast to `UserRole` without validation:
```typescript
return (user.role as UserRole) ?? "medewerker";
```
**Recommendation:** Use a validation function: `function parseUserRole(role: unknown): UserRole`. This is security-sensitive since roles determine access control.

### [WARNING] Broad `as Record<string, unknown>` in weekly planning
**Location:** `convex/weekPlanning.ts:220`
**Issue:** Uurregistratie records are cast to `Record<string, unknown>` to access an optional field:
```typescript
const uurtype = (u as Record<string, unknown>).uurtype as string | undefined;
```
**Recommendation:** Update the Convex schema to include the `uurtype` field, or use a proper type that includes it.

### [WARNING] `as Id<T>` casts in convex/projectKosten.ts CRUD operations
**Location:** `convex/projectKosten.ts:133,205,317,345,364,534,546,551,567,572,598,624,628,633,637,642,656` (17 occurrences)
**Issue:** The `projectKosten` module has 17 instances of casting generic IDs to specific table IDs. The mutation handlers accept a generic `id` argument and cast it based on a `type` discriminator at runtime, but the casts bypass type safety:
```typescript
const uren = await ctx.db.get(args.id as Id<"urenRegistraties">);
```
**Recommendation:** Use separate mutation endpoints per type, or use Convex's `v.union()` validator to create type-safe discriminated args. The current pattern relies on runtime `type` checking but uses type-level casts to bypass the compiler.

### [WARNING] JSON.parse results cast without validation
**Location:**
- `src/hooks/use-filter-presets.ts:162` (`JSON.parse(stored) as FilterPreset<T>[]`)
- `src/app/api/calendly/route.ts:103` (`JSON.parse(rawBody) as CalendlyWebhookEvent`)
- `src/app/api/summarize/route.ts:229` (`JSON.parse(cleanedText) as SummaryResult`)
**Issue:** Results from `JSON.parse` are cast directly to expected types without runtime validation. Malformed data (from localStorage, webhooks, or API responses) could produce objects that don't match the expected shape.
**Recommendation:** Use Zod schemas to validate parsed JSON: `const parsed = filterPresetSchema.parse(JSON.parse(stored))`. This is especially important for external data (webhooks, API responses).

---

### INFO

### [INFO] Consistent use of `type` aliases vs `interface` -- well-balanced
**Location:** Project-wide
**Issue:** The project uses ~192 `type` aliases and ~456 `interface` declarations in `src/`. The usage pattern is appropriate: `interface` for object shapes (props, data structures) and `type` for unions, intersections, and aliases. This is a good pattern.
**Recommendation:** No action needed. The project follows the recommended convention of using `interface` for extensible object types and `type` for unions/literals.

### [INFO] Zero `@ts-ignore` / `@ts-expect-error` directives
**Location:** N/A
**Issue:** The project has zero `@ts-ignore` or `@ts-expect-error` comments in both `src/` and `convex/`. This is excellent and indicates disciplined TypeScript usage.
**Recommendation:** Maintain this standard.

### [INFO] eslint-disable comments are well-documented
**Location:** 14 total occurrences (12 in src/, 2 in convex/)
**Issue:** All 14 `eslint-disable @typescript-eslint/*` comments are inline (not file-wide) and target specific rules (`no-explicit-any`, `no-unused-vars`). Most are in the resource factory where they are architecturally justified by the generic hook pattern.
**Recommendation:** Consider adding brief comments explaining *why* the disable is needed (the resource factory already does this well).

### [INFO] `import * as React` pattern in UI components
**Location:** ~50+ files in `src/components/ui/`
**Issue:** Many UI components use `import * as React from "react"` (namespace import). This is valid but slightly outdated -- with React 19 and the new JSX transform, the `React` namespace import is unnecessary unless accessing React APIs like `React.CSSProperties`, `React.Ref`, etc.
**Recommendation:** Low priority. The pattern works correctly. Could be cleaned up by importing only needed items (`import { forwardRef, useRef } from "react"`), but this is cosmetic.

### [INFO] `as const` satisfies pattern opportunity in scope/status constants
**Location:**
- `src/app/(dashboard)/offertes/nieuw/aanleg/hooks/useAanlegWizard.ts:133-172`
- `src/app/(dashboard)/offertes/nieuw/onderhoud/components/constants.ts:22-75`
**Issue:** Scope definitions use `as AanlegScope` / `as OnderhoudScope` on each item's `id` field. These could use `as const satisfies` on the whole array to infer literal types automatically.
**Recommendation:** Refactor arrays to use `satisfies` pattern:
```typescript
const SCOPES = [{ id: "grondwerk", ... }, ...] as const satisfies readonly { id: AanlegScope; ... }[];
```

### [INFO] Offerte calculator scope casts are structurally sound
**Location:** `src/lib/offerte-calculator.ts:1861-1916` (18 casts)
**Issue:** The `calculateOfferteRegels` function uses a switch-case that casts `data` to specific scope data types (e.g., `data as GrondwerkData`). While these are type assertions, the switch-case structure with scope name discriminator makes them structurally safe -- each branch only processes the correct scope type.
**Recommendation:** Could be improved with a discriminated union approach, but the current pattern is acceptable given the switch-case guard. Low priority refactor.

---

## Priority Recommendations

### High Priority (address soon)
1. **Type the notification helper `ctx` parameters** -- Easy fix, import `MutationCtx` from Convex generated types
2. **Type `offerte` and `instellingen` props in OfferteHeader** -- Use `Doc<"offertes">` and `Doc<"instellingen">`
3. **Fix double-casts in notification-center** -- Accept `Id<"notifications">` instead of `string`
4. **Type `offerte.totalen` in projectKosten** -- Define a proper `OfferteTotalen` interface

### Medium Priority (plan for next sprint)
5. **Create `useConvexParam<T>()` hook** -- Centralizes the ~40 route param to Convex ID casts
6. **Add Zod validation for JSON.parse results** -- Especially for webhook/API data
7. **Define a proper `ScopeData` discriminated union** -- Eliminates ~15 `Record<string, unknown>` casts
8. **Add type guards for status enums** -- `isOfferteStatus()`, `isProjectStatus()`, etc.

### Low Priority (backlog)
9. **Use `satisfies` instead of `as` for config objects** -- Motion config, scope constants
10. **Add `noUncheckedIndexedAccess` to tsconfig** -- Catches additional null-safety issues
11. **Clean up `import * as React` patterns** -- Cosmetic improvement for React 19
12. **Investigate Convex generic typing for resource factory** -- May reduce the need for `any` in hook factory
