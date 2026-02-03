# Codebase Audit Plan - Offerte Builder

**Datum:** 2026-02-03
**Gebaseerd op:** 5 parallelle code-analyse agents (bugs, performance, security, quality, architecture)

---

## Executive Summary

Er zijn **67 issues** gevonden verdeeld over 5 categorieën:
- **CRITICAL:** 2 security issues (geheimen in versiecontrole)
- **HIGH:** 14 issues (bugs, security, performance)
- **MEDIUM:** 35 issues (code quality, architecture)
- **LOW:** 16 issues (optimalisaties, cleanup)

---

## PRIORITEIT 1: KRITIEKE SECURITY ISSUES (Direct Actie Nodig)

### 1.1 [CRITICAL] Exposed Production Secrets in .env.local

**Probleem:** Productie API keys zijn gecommit in git:
- Clerk Secret Key (`sk_live_...`)
- Clerk Publishable Key (`pk_live_...`)
- Convex Deployment URL

**Bestanden:**
- `.env.local` (lines 4-6)

**Impact:** Volledige compromis van authenticatie systeem mogelijk

**Oplossing:**
```bash
# 1. Revoke keys in Clerk dashboard DIRECT
# 2. Verwijder uit git history:
git filter-branch --tree-filter 'rm -f .env.local' HEAD
# 3. Force push (na overleg met team):
git push origin +main
# 4. Genereer nieuwe keys in Clerk
```

---

### 1.2 [CRITICAL] Exposed Secrets in Documentation

**Probleem:** API key voorbeelden in documentatie bestanden

**Bestanden:**
- `PROJECT-DOCUMENTATION.md` (line 503-505)
- `PLAN.md` (line 578-579)

**Oplossing:** Verwijder of vervang met `sk_test_xxxxx` placeholder format

---

## PRIORITEIT 2: HIGH SEVERITY BUGS

### 2.1 Division by Zero Error

**Bestand:** `src/app/(dashboard)/projecten/[id]/planning/page.tsx:346`

**Probleem:**
```typescript
const checklistProgress = Math.round((completedChecklistItems / checklistItems.length) * 100);
```

**Fix:**
```typescript
const checklistProgress = checklistItems.length > 0
  ? Math.round((completedChecklistItems / checklistItems.length) * 100)
  : 0;
```

---

### 2.2 Missing Dependency in useCallback

**Bestand:** `src/components/wagenpark/fleetgo-sync.tsx:72-83`

**Probleem:** `checkConnection` ontbreekt in dependency array

**Fix:**
```typescript
}, [isApiKeyConfigured, connectionStatus, checkConnection]);
```

---

### 2.3 Potential Null Reference in Array Access

**Bestand:** `src/app/monitoring/route.ts:15`

**Probleem:** `pieces[0]` kan undefined zijn

**Fix:**
```typescript
if (!pieces.length) {
  return NextResponse.json(
    { error: "Invalid Sentry envelope format" },
    { status: 400 }
  );
}
const header = JSON.parse(pieces[0]);
```

---

### 2.4 Race Condition in useEffect

**Bestand:** `src/app/(public)/offerte/[token]/page.tsx:297-323`

**Probleem:** `markMessagesAsRead` wordt meerdere keren concurrent aangeroepen

**Fix:** Consolideer in één useEffect met proper flag management

---

### 2.5 Unsafe Type Assertion Without Validation

**Bestand:** `src/lib/voorcalculatie-calculator.ts:76-79`

**Fix:**
```typescript
const oppervlakte = typeof data?.oppervlakte === 'number' ? data.oppervlakte : 0;
const diepte = typeof data?.diepte === 'string' ? data.diepte : "standaard";
const afvoerGrond = typeof data?.afvoerGrond === 'boolean' ? data.afvoerGrond : false;
```

---

### 2.6 Missing Error Handling in Email Dispatch

**Bestand:** `src/app/api/email/route.ts:95-109`

**Fix:**
```typescript
if (error) {
  return NextResponse.json(
    { error: error?.message || "Email delivery failed", status: "mislukt" },
    { status: 500 }
  );
}
```

---

### 2.7 Optional Property Access Without Null Check

**Bestand:** `src/app/(public)/offerte/[token]/page.tsx:538`

**Fix:**
```typescript
{(offerte.regels && Array.isArray(offerte.regels)
  ? summarizeRegelsByScope(offerte.regels as RegelInput[])
  : []
).map((summary) => (
```

---

### 2.8 Potential Infinite Recursion in FleetGo Client

**Bestand:** `src/lib/fleetgo.ts:485-487`

**Fix:**
```typescript
if (error instanceof FleetGoError && error.code === 'MOCK_MODE' && !this.useMockData) {
  this.initializeMockData();
  return this.getVehicles();
}
throw error;
```

---

## PRIORITEIT 3: HIGH SEVERITY SECURITY

### 3.1 Missing CSP Headers

**Bestand:** `next.config.ts`

**Fix:** Voeg toe:
```typescript
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.sentry-cdn.com; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self' https://affable-rook-669.convex.cloud; frame-ancestors 'none';"
        },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
      ]
    }
  ];
}
```

---

### 3.2 Sentry Tunnel CORS te Open

**Bestand:** `src/app/monitoring/route.ts:31-33`

**Fix:**
```typescript
headers: {
  "Access-Control-Allow-Origin": "https://toptuinen.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}
```

---

### 3.3 In-Memory Rate Limiting (Distributed Environment)

**Bestanden:**
- `src/lib/rate-limiter.ts`
- `convex/security.ts`

**Probleem:** In serverless/distributed omgeving ineffectief

**Oplossing:** Implementeer Redis-based rate limiting (Upstash)

---

### 3.4 XLSX Dependency Vulnerability

**Package:** `xlsx@0.18.5`

**Vulnerabilities:**
- GHSA-4r6h-8v6p-xvw6 (Prototype Pollution)
- GHSA-5pgg-2g8v-p4x9 (ReDoS)

**Fix:**
```bash
npm uninstall xlsx
npm install exceljs
```
Dan refactor `src/lib/export-utils.ts` en `src/lib/excel-export.ts`

---

## PRIORITEIT 4: PERFORMANCE OPTIMALISATIES

### 4.1 Inefficient Set/Array Comparison

**Bestand:** `src/hooks/use-realtime.ts:263-277`

**Fix:**
```typescript
const currentIds = new Set(data.messages.map((m) => m._id.toString()));
const prevIds = new Set(prevMessagesRef.current);
const hasNew = Array.from(currentIds).some((id) => !prevIds.has(id));
```

---

### 4.2 Repeated Intl.NumberFormat Instantiation

**Bestanden:** (131 occurrences)
- `src/app/(dashboard)/offertes/page.tsx`
- `src/app/(dashboard)/voorraad/page.tsx`
- `src/app/(public)/offerte/[token]/page.tsx`
- etc.

**Fix:** Maak shared utility:
```typescript
// src/lib/formatters.ts
export const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export const formatCurrency = (amount: number) => currencyFormatter.format(amount);
```

---

### 4.3 Missing useMemo for JSON.stringify

**Bestand:** `src/hooks/use-auto-save.ts:48`

**Fix:**
```typescript
const serializedData = useMemo(() => JSON.stringify(data), [data]);
```

---

## PRIORITEIT 5: CODE QUALITY

### 5.1 Debug console.log Statements

**Bestand:** `src/app/(dashboard)/instellingen/page.tsx:986, 991`

**Fix:** Verwijder:
```typescript
// DELETE these lines:
console.log("Saving FleetGo API key:", apiKey);
console.log("Testing FleetGo connection with key:", apiKey);
```

---

### 5.2 Unsafe `as any` Type Casts (102 instances)

**Bestanden:**
- `src/app/(dashboard)/instellingen/machines/page.tsx:134, 157`
- `src/app/(dashboard)/instellingen/page.tsx:287, 307, 745, 755, 933, 943`
- `src/app/(dashboard)/projecten/[id]/planning/page.tsx:145-146`
- `src/app/(dashboard)/projecten/[id]/factuur/page.tsx:360-362`
- `src/app/(dashboard)/medewerkers/teams/page.tsx:59-62`

**Fix:** Vervang met proper types:
```typescript
// From:
id: selectedMachine._id as any
// To:
id: selectedMachine._id as Id<"machines">
```

---

### 5.3 Duplicated Tailwind Gradient Classes (131 occurrences)

**Pattern:** `bg-gradient-to-br from-emerald-500 to-green-600`

**Fix:** Voeg toe aan `tailwind.config.ts`:
```typescript
theme: {
  extend: {
    backgroundImage: {
      'brand-gradient': 'linear-gradient(to bottom right, var(--tw-gradient-stops))',
    },
  }
}
```

Of maak component:
```typescript
// src/components/ui/brand-gradient.tsx
export const brandGradientClass = "bg-gradient-to-br from-emerald-500 to-green-600";
```

---

### 5.4 Inconsistent Import Paths (159 imports)

**Probleem:** Relatieve paden naar convex/_generated/

**Fix:** Voeg path alias toe aan `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/convex/*": ["./convex/*"]
    }
  }
}
```

---

### 5.5 Monolithic Page Components (>1000 lines)

**Bestanden:**
- `src/app/(dashboard)/offertes/nieuw/aanleg/page.tsx` (1546 lines)
- `src/app/(dashboard)/projecten/[id]/factuur/page.tsx` (1536 lines)
- `src/app/(dashboard)/offertes/nieuw/onderhoud/page.tsx` (1490 lines)
- `src/app/(dashboard)/offertes/[id]/page.tsx` (1203 lines)
- `src/app/(dashboard)/instellingen/page.tsx` (1166 lines)

**Fix:** Extract components:
```
offertes/nieuw/aanleg/
├── page.tsx (main orchestrator)
├── components/
│   ├── AanlegWizardStepper.tsx
│   ├── GrondwerkForm.tsx
│   ├── BestratingForm.tsx
│   └── ReviewSection.tsx
└── hooks/
    └── useAanlegWizard.ts
```

---

## PRIORITEIT 6: ARCHITECTURAL IMPROVEMENTS

### 6.1 Duplicate Validation Schemas

**Probleem:** Validatie duplicatie:
- `src/lib/validations/aanleg-scopes.ts` (Zod)
- `src/lib/validations/onderhoud-scopes.ts` (Zod)
- `convex/validators.ts` (Convex validators)

**Fix:** Single source of truth - genereer Convex validators van Zod schemas

---

### 6.2 Missing Data Abstraction Layer

**Probleem:** Components direct gekoppeld aan Convex API

**Fix:** Maak data access layer:
```typescript
// src/lib/data-access/queries.ts
export const queries = {
  offertes: {
    getDashboard: () => api.offertes.getDashboardData,
    getById: (id: Id<"offertes">) => api.offertes.getById,
  }
}
```

---

### 6.3 Large Convex Mutation Functions

**Bestanden:**
- `convex/offertes.ts`
- `convex/medewerkers.ts`
- `convex/facturen.ts`

**Fix:** Extract auth helpers:
```typescript
// convex/auth-helpers.ts
export async function checkMedewerkerAccess(ctx: QueryCtx, id: Id<"medewerkers">, userId: string) {
  // Centralized access check
}
```

---

## IMPLEMENTATIE TIJDLIJN

### Week 1 (Urgent)
- [ ] **1.1** Revoke en roteer Clerk keys
- [ ] **1.2** Verwijder secrets uit documentatie
- [ ] **3.1** Voeg CSP headers toe
- [ ] **3.2** Fix Sentry CORS

### Week 2 (High Priority Bugs)
- [ ] **2.1** Fix division by zero
- [ ] **2.2** Fix useCallback dependency
- [ ] **2.3** Fix null reference in monitoring
- [ ] **2.4** Fix race condition
- [ ] **2.5** Fix unsafe type assertions
- [ ] **2.6** Fix email error handling
- [ ] **2.7** Fix optional property access
- [ ] **2.8** Fix infinite recursion risk

### Week 3 (Security & Performance)
- [ ] **3.3** Implementeer Redis rate limiting
- [ ] **3.4** Vervang xlsx met exceljs
- [ ] **4.1** Fix Set/Array comparison
- [ ] **4.2** Centraliseer formatters
- [ ] **4.3** Add useMemo for JSON.stringify

### Week 4 (Code Quality)
- [ ] **5.1** Verwijder console.logs
- [ ] **5.2** Fix `as any` casts (top 20)
- [ ] **5.3** Centraliseer gradient classes
- [ ] **5.4** Fix import paths

### Maand 2 (Architecture)
- [ ] **5.5** Refactor monolithic pages (1 per week)
- [ ] **6.1** Unify validation schemas
- [ ] **6.2** Data abstraction layer
- [ ] **6.3** Refactor Convex mutations

---

## SAMENVATTING PER CATEGORIE

| Categorie | Critical | High | Medium | Low | Totaal |
|-----------|----------|------|--------|-----|--------|
| Security | 2 | 4 | 4 | 2 | 12 |
| Bugs | 0 | 8 | 4 | 0 | 12 |
| Performance | 0 | 1 | 3 | 3 | 7 |
| Code Quality | 0 | 1 | 13 | 8 | 22 |
| Architecture | 0 | 0 | 11 | 3 | 14 |
| **Totaal** | **2** | **14** | **35** | **16** | **67** |

---

## NOTITIES

### Positieve Observaties
- Goede N+1 query preventie via batched queries
- Proper code splitting voor PDF en Charts
- Goede cleanup en memory management in meeste hooks
- Gebruik van useMemo/useCallback op kritieke plekken
- Goed gebruik van TypeScript in nieuwe code

### Aandachtspunten
- Security headers ontbreken volledig
- Rate limiting werkt niet in distributed omgeving
- Veel type suppressions (`any`, `@ts-ignore`)
- Sommige pagina's zijn te groot (>1000 lines)
- Validatie is gedupliceerd tussen frontend en backend
