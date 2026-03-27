# Test Coverage Analysis

**Date:** 2026-03-26
**Analyzer:** Claude Opus 4.6

## Summary

| Severity | Count |
|----------|-------|
| Critical | 7     |
| Warning  | 6     |
| Info     | 4     |

**Overall assessment:** The project has dangerously low test coverage. Only 3 unit test files exist covering peripheral utilities, while ALL core business logic (offerte calculations, BTW, pricing, status transitions, Zod validations) is completely untested. The 2 E2E tests are trivial smoke tests. For a financial calculation tool generating quotes worth thousands of euros, this is a critical risk.

---

## Test Configuration

| Item | Status |
|------|--------|
| `vitest.config.ts` | Present, properly configured (jsdom, React plugin, path aliases, coverage reporters) |
| Test setup | `src/__tests__/setup.ts` -- minimal, only imports `@testing-library/jest-dom` |
| Coverage reporters | text, json, html |
| Test runner | Vitest 4.x with `@vitejs/plugin-react` |
| E2E runner | Playwright 1.58.x (installed as devDep) |
| `@testing-library/react` | Installed but never used in any test file |

---

## Current Test Files

### Unit Tests (Vitest) -- 3 files

| File | What it tests | Test count | Quality |
|------|--------------|------------|---------|
| `src/__tests__/time-utils.test.ts` | `roundToQuarter`, `formatHours`, `formatDuration` from `@/lib/time-utils` | 9 | Good -- tests edge cases (zero, small, large values), Dutch formatting |
| `src/__tests__/error-handling.test.ts` | Custom error classes (`AppError`, `ValidationError`, `NotFoundError`, `AuthenticationError`, `AuthorizationError`), `getUserFriendlyMessage`, `getMutationErrorMessage`, `withRetry` | 14 | Good -- tests defaults, retry logic, shouldRetry option, Dutch messages |
| `src/__tests__/accessibility.test.ts` | `generateAriaId`, `prefersReducedMotion`, `KEYBOARD_KEYS`, `ARIA_MESSAGES` | 9 | Adequate -- tests uniqueness, Dutch messages, mocks `matchMedia` |

**Total unit tests: ~32 assertions across 3 files.**

### E2E Tests (Playwright) -- 2 files

| File | What it tests | Test count | Quality |
|------|--------------|------------|---------|
| `e2e/home.spec.ts` | Redirect to sign-in when unauthenticated, sign-in page loads | 2 | Trivial smoke test |
| `e2e/public-offerte.spec.ts` | Error display for invalid offerte token | 1 | Trivial smoke test |

**Total E2E tests: 3 assertions across 2 files.**

---

## Missing Test Coverage

### Critical Business Logic -- ZERO tests

| Module | Lines | Purpose | Risk |
|--------|-------|---------|------|
| `src/lib/offerte-calculator.ts` | 2,027 | **Core pricing engine**: 18+ scope calculation functions, `calculateOfferteRegels`, `calculateTotals` (BTW, marge, subtotals), material quantity calculations, correction factors | **EXTREME** -- financial calculations directly determine quote amounts sent to customers |
| `src/lib/voorcalculatie-calculator.ts` | 435 | Pre-calculation: normuren per scope, correction factors, project duration estimation | **HIGH** -- drives project planning estimates |
| `src/lib/nacalculatie-calculator.ts` | 423 | Post-calculation: deviation analysis, scope breakdowns, insights generation | **HIGH** -- used for financial comparison and learning |
| `src/lib/leerfeedback-analyzer.ts` | 351 | Normuur adjustment suggestions based on historical data, confidence levels | **MEDIUM** -- influences future pricing |

### Financial Formatting -- ZERO tests

| Module | Lines | Purpose |
|--------|-------|---------|
| `src/lib/format/currency.ts` | 148 | `formatCurrency`, `parseCurrency`, `formatCurrencyCompact`, `formatCurrencyNumeric` -- Dutch locale EUR formatting |
| `src/lib/format/number.ts` | 193 | `formatPercentage`, `formatDecimal`, `formatCompact`, `parseNumber` -- Dutch number formatting |
| `src/lib/format/date.ts` | 274 | `formatDate`, `formatRelativeTime`, `formatDateRange` -- Dutch date formatting |

### Validation Schemas -- ZERO tests

| Module | Purpose |
|--------|---------|
| `src/lib/validations/klant.ts` | Customer validation (postcode, phone, email with Dutch formats) |
| `src/lib/validations/aanleg-scopes.ts` | Aanleg scope data validation |
| `src/lib/validations/onderhoud-scopes.ts` | Onderhoud scope data validation |
| `src/lib/validations/inkooporder.ts` | Purchase order validation |
| `src/lib/validations/leverancier.ts` | Supplier validation |
| `src/lib/validations/voorraad.ts` | Inventory validation |
| `src/lib/validations/project-kosten.ts` | Project costs validation |
| `src/lib/validations/kwaliteits-controle.ts` | Quality control validation |

### Infrastructure -- ZERO tests

| Module | Purpose |
|--------|---------|
| `src/lib/rate-limiter.ts` | Rate limiting with sliding window (email, API, strict limiters) |
| `src/lib/uren-import-parser.ts` | CSV/Excel parser for time registration imports |
| `src/lib/export-utils.ts` | CSV/Excel export with Dutch formatting |
| `src/lib/upstash-rate-limiter.ts` | Production rate limiter |

### Convex Backend -- ZERO tests

| Module | Functions | Purpose |
|--------|-----------|---------|
| `convex/offertes.ts` | 18+ exports | CRUD, status transitions, bulk operations, stats |
| `convex/berekeningen.ts` | 7 exports | Server-side calculation actions |
| `convex/klanten.ts` | Customer management |
| `convex/projecten.ts` | Project management |
| `convex/nacalculaties.ts` | Post-calculation management |
| `convex/facturen.ts` | Invoice management |
| `convex/betalingen.ts` | Payment management |
| 60+ other Convex files | Various | Full backend untested |

### React Hooks -- ZERO tests

55+ custom hooks in `src/hooks/` including `use-offerte-calculation.ts`, `use-nacalculatie.ts`, `use-voorcalculatie.ts` -- none tested despite `@testing-library/react` being installed.

### UI Components -- ZERO tests

100+ components in `src/components/` -- none tested despite `@testing-library/react` being installed.

### API Routes -- ZERO tests

8 API route handlers (`fleetgo`, `mollie`, `mollie/webhook`, `calendly`, `transcribe`, `summarize`, `email`, `weather`) -- none tested.

### Pages -- ZERO tests

55+ page components -- none tested.

---

## Findings

### [CRITICAL] Offerte Calculator Has Zero Tests

**Issue:** `src/lib/offerte-calculator.ts` (2,027 lines) is the financial heart of the application. It calculates quote line items for 18+ scope types (grondwerk, bestrating, borders, gras, houtwerk, water_elektra, specials, plus 11 onderhoud scopes), applies correction factors, material quantities with loss percentages, labor hours with rounding, and computes final totals including BTW (VAT) and per-scope margins. Not a single function has a test.

**Recommendation:** Write comprehensive unit tests for:
- `calculateOfferteRegels()` -- each scope type with representative inputs
- `calculateTotals()` -- BTW calculation, margin cascading (per-regel > per-scope > standaard), rounding behavior
- `createMateriaalRegel()` -- loss percentage (verliespercentage) application
- `createArbeidsRegel()` -- quarter-hour rounding
- Helper functions: `getCorrectionFactor()`, `findNormuur()`, `findProduct()`
- Edge cases: zero quantities, missing normuren, empty scopes, negative values

---

### [CRITICAL] BTW (VAT) Calculation Untested

**Issue:** The `calculateTotals()` function computes BTW as `totaalExBtw * (btwPercentage / 100)` and adds it to get `totaalInclBtw`. This is the amount customers see on quotes. A rounding error or incorrect calculation here means sending incorrect invoices. There are no tests verifying:
- Standard 21% BTW rate produces correct amounts
- Rounding to cents works correctly
- Edge cases with very small or very large amounts
- The margin cascade (regel-level > scope-level > global default) correctly feeds into BTW base

**Recommendation:** Write parametrized tests with known input/output pairs for BTW calculations. Include edge cases like: totals of exactly 0, single-cent amounts, very large projects (> 100K EUR), mixed scope margins.

---

### [CRITICAL] Status Transition Logic Untested

**Issue:** `convex/offertes.ts` contains a `validTransitions` map enforcing the workflow `concept -> voorcalculatie -> verzonden -> geaccepteerd/afgewezen` with some backward transitions. This state machine is critical for business process integrity but has zero tests. An incorrect transition could allow quotes to skip approval or revert from accepted to draft.

**Recommendation:** Extract the transition validation into a pure function and unit test all valid/invalid transition combinations. Also test the Convex mutation with mock context if Convex testing tools are available.

---

### [CRITICAL] Zod Validation Schemas Untested

**Issue:** 9 Zod validation schema files in `src/lib/validations/` handle Dutch-specific formats (postcodes like "1234 AB", phone numbers with +31 prefix, currency parsing). These validations gate all data entry in the application. The `klantSchema` has complex transforms (postcode normalization, phone stripping). None are tested.

**Recommendation:** Test each schema with valid inputs, invalid inputs, and edge cases. For `klantSchema` specifically: test postcode normalization ("1234ab" -> "1234 AB"), phone stripping ("06 12 34 56 78" -> "0612345678"), optional email handling (empty string -> undefined).

---

### [CRITICAL] Currency Formatting/Parsing Untested

**Issue:** `src/lib/format/currency.ts` handles `formatCurrency()` (EUR display), `parseCurrency()` (Dutch format "1.234,56" -> 1234.56), and `formatCurrencyCompact()`. These appear throughout the UI and in exports. The `parseCurrency()` function manipulates dots and commas for Dutch locale -- a single regex error would silently corrupt all parsed currency values.

**Recommendation:** Test with representative Dutch currency strings including edge cases: "0,00", negative amounts "-1.234,56", amounts without thousands separator, amounts with only commas, empty/null inputs.

---

### [CRITICAL] Voorcalculatie Calculator Untested

**Issue:** `src/lib/voorcalculatie-calculator.ts` (435 lines) calculates normuren per scope using complex formulas for 10 scope types, applies bereikbaarheid and achterstalligheid correction factors, and estimates project duration with team sizes. This directly determines how many days/workers a project needs. Zero tests exist.

**Recommendation:** Write tests for `calculateNormuren()` with each scope type, `calculateProjectDuration()`, and `calculateProjectDurationWithBuffer()`. Test correction factor application and the fallback to arbeid regels when normuren produce zero.

---

### [CRITICAL] Nacalculatie Calculator Untested

**Issue:** `src/lib/nacalculatie-calculator.ts` (423 lines) compares planned vs actual hours/costs, generates deviation percentages, classifies status as good/warning/critical, and produces business insights. Financial comparison logic with zero tests.

**Recommendation:** Test `calculateNacalculatie()` with scenarios: on-budget project, over-budget project, under-budget project, missing scopes, zero registrations. Test `getDeviationStatus()` at exact threshold boundaries (5%, 15%).

---

### [WARNING] E2E Tests Are Trivial

**Issue:** Only 2 E2E test files exist with 3 assertions total. They only verify that the sign-in page loads and that an invalid offerte token shows an error. No authenticated user flows, no form submissions, no calculation workflows, no PDF generation flows are tested.

**Recommendation:** Add E2E tests for critical user journeys:
1. Create new offerte (aanleg) -> fill scope forms -> see calculated totals
2. Send offerte -> accept offerte -> create project
3. Public offerte view with valid token
4. Nacalculatie flow
5. Uren import from CSV

---

### [WARNING] @testing-library/react Installed But Never Used

**Issue:** `@testing-library/react` v16.3.2 is installed as a devDependency but no component test uses it. This suggests component testing was planned but never implemented.

**Recommendation:** Start component testing with the most business-critical components: offerte wizard steps, scope forms, price display components, the calculation hook `use-offerte-calculation.ts`.

---

### [WARNING] Import Parser Has Complex Logic But No Tests

**Issue:** `src/lib/uren-import-parser.ts` contains date parsing (Dutch format, US format, Excel serial dates), hours parsing (comma decimals, HH:MM format), column detection by Dutch/English name variants, and validation logic. This handles external file uploads from customers -- errors would silently import wrong data.

**Recommendation:** Test `processUrenImportData()` with mock CSV rows covering all date formats, hour formats, missing columns, and edge cases (empty rows, > 24 hour values).

---

### [WARNING] Rate Limiter Logic Untested

**Issue:** `src/lib/rate-limiter.ts` implements a sliding window rate limiter used for email, API, and sensitive operations. The `checkRateLimit()` function manages an in-memory store with expiration. Bugs here could either lock out legitimate users or fail to rate-limit abusive requests.

**Recommendation:** Test `checkRateLimit()`: allow within limit, reject at limit, window expiration/reset, concurrent identifiers.

---

### [WARNING] Leerfeedback Analyzer Untested

**Issue:** `src/lib/leerfeedback-analyzer.ts` (351 lines) analyzes multiple nacalculaties to suggest normuur adjustments. It calculates confidence levels, adjustment factors, and validates suggestions. This influences future pricing. The `analyzeNacalculaties()` function has branching logic for minimum project thresholds, deviation thresholds, and suggestion sorting.

**Recommendation:** Test with mock nacalculatie data: enough projects to trigger suggestions, below threshold, exactly at threshold, mixed over/under-estimation.

---

### [WARNING] 60+ Convex Backend Functions Untested

**Issue:** The entire Convex backend (65+ function files) has zero tests. This includes mutations that modify financial data, queries that aggregate statistics, and actions that perform calculations. The `updateStatus` mutation in `convex/offertes.ts` enforces status transitions -- a regression here could break the entire workflow.

**Recommendation:** At minimum, extract pure business logic from Convex functions into testable utility modules. Consider Convex's testing utilities for integration tests of mutations and queries.

---

### [INFO] Test Setup Is Minimal But Functional

**Issue:** The test setup file (`src/__tests__/setup.ts`) only imports `@testing-library/jest-dom`. No global mocks for Convex, Clerk auth, or Next.js router are configured.

**Recommendation:** When adding component/hook tests, extend setup with: Convex client mock, Clerk auth mock, Next.js router mock, and `window.matchMedia` mock (currently handled per-test in accessibility.test.ts).

---

### [INFO] Existing Tests Are Well-Written

**Issue:** The 3 existing test files are well-structured: they use proper `describe` blocks, test edge cases, check Dutch localization strings, mock external APIs (`matchMedia`), and test async retry logic with `vi.fn()`. This is a good foundation to build on.

**Recommendation:** Use these as templates when writing new tests. The patterns are solid.

---

### [INFO] No Tests for 55+ Page Components

**Issue:** 55 Next.js page components exist across dashboard, public, and auth routes. None have rendering tests or integration tests. While page-level testing can be covered by E2E, at minimum the data-heavy pages (offerte detail, nacalculatie, voorcalculatie) should have smoke render tests.

**Recommendation:** Low priority -- focus on business logic first, then component tests, then page tests.

---

### [INFO] Mobile App Has Zero Tests

**Issue:** The `mobile/` directory (React Native Expo app) has no test files. While mobile testing has a different toolchain, the shared Convex backend logic affects both platforms.

**Recommendation:** Out of scope for this review, but worth noting. Testing the shared Convex backend benefits both platforms.

---

## Test Coverage Estimate

| Area | Files | Tested | Coverage |
|------|-------|--------|----------|
| Business Logic (`src/lib/`) | 30+ | 3 (peripheral) | ~5% |
| Validations (`src/lib/validations/`) | 9 | 0 | 0% |
| Format Utilities (`src/lib/format/`) | 4 | 0 | 0% |
| React Hooks (`src/hooks/`) | 55+ | 0 | 0% |
| UI Components (`src/components/`) | 100+ | 0 | 0% |
| Pages (`src/app/`) | 55+ | 0 | 0% |
| API Routes (`src/app/api/`) | 8 | 0 | 0% |
| Convex Backend (`convex/`) | 65+ | 0 | 0% |
| E2E Flows | ~20 critical | 3 trivial | ~2% |

**Estimated overall meaningful test coverage: < 2%**

---

## Priority Remediation Plan

1. **P0 (This week):** Test `offerte-calculator.ts` -- `calculateTotals()` and at least 3 scope calculators (grondwerk, bestrating, borders)
2. **P0 (This week):** Test `format/currency.ts` -- `formatCurrency`, `parseCurrency`
3. **P1 (Next week):** Test `voorcalculatie-calculator.ts`, `nacalculatie-calculator.ts`
4. **P1 (Next week):** Test all Zod validation schemas in `src/lib/validations/`
5. **P2 (Sprint):** Test `uren-import-parser.ts`, `rate-limiter.ts`, `leerfeedback-analyzer.ts`
6. **P2 (Sprint):** Test `format/number.ts`, `format/date.ts`
7. **P3 (Quarter):** Add component tests for offerte wizard and calculation hooks
8. **P3 (Quarter):** Expand E2E tests for critical user journeys
9. **P4 (Backlog):** Extract and test Convex backend business logic
