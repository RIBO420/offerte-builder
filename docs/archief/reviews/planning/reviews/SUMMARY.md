# Code Review Summary — Top Tuinen Offerte Calculator

**Datum:** 2026-03-26
**Reviewers:** 12 parallel AI agents
**Scope:** Volledige codebase (web + mobile + Convex backend)

---

## Totaal Bevindingen per Agent

| # | Agent | Critical | Warning | Info | Rapport |
|---|-------|----------|---------|------|---------|
| 1 | schema-review | 5 | 12 | 8 | [schema-review.md](schema-review.md) |
| 2 | security-audit | 3 | 8 | 5 | [security-audit.md](security-audit.md) |
| 3 | typescript-quality | 5 | 12 | 6 | [typescript-quality.md](typescript-quality.md) |
| 4 | react-patterns | 5 | 12 | 6 | [react-patterns.md](react-patterns.md) |
| 5 | convex-functions | 7 | 18 | 8 | [convex-functions.md](convex-functions.md) |
| 6 | ui-ux-consistency | 3 | 9 | 5 | [ui-ux-consistency.md](ui-ux-consistency.md) |
| 7 | error-handling | 3 | 8 | 7 | [error-handling.md](error-handling.md) |
| 8 | performance | 2 | 6 | 4 | [performance.md](performance.md) |
| 9 | test-coverage | 7 | 0 | 0 | [test-coverage.md](test-coverage.md) |
| 10 | dead-code | 5 | 18 | 14 | [dead-code.md](dead-code.md) |
| 11 | mobile-review | 3 | 12 | 8 | [mobile-review.md](mobile-review.md) |
| 12 | scope-compliance | 8 | 12 | 0 | [scope-compliance.md](scope-compliance.md) |
| | **TOTAAL** | **56** | **127** | **71** | |

---

## Top 10 Meest Kritieke Issues

### 1. SECURITY — Privilege Escalation via `makeCurrentUserAdmin`
**Bron:** security-audit | **Locatie:** `convex/users.ts:1019`
**Impact:** Elke geauthenticeerde gebruiker kan zichzelf admin maken via `makeCurrentUserAdmin({ force: true })`. Dit geeft volledige toegang tot alle data en functies.
**Actie:** Verwijder de `force` parameter of beperk tot een server-side seed script. **Onmiddellijk fixen.**

### 2. SECURITY — Hardcoded Clerk Secret Key in Mobile App
**Bron:** mobile-review | **Locatie:** `mobile/app/(auth)/login.tsx`
**Impact:** `sk_test_...` secret key staat in client-side code. Kan gebruikt worden om Clerk API aan te roepen, gebruikers aan te maken/verwijderen, en tokens te forgen.
**Actie:** Verwijder de key uit de code, roteer de key in Clerk dashboard, gebruik environment variables. **Onmiddellijk fixen.**

### 3. SECURITY — Email API Route Zonder Authenticatie
**Bron:** security-audit | **Locatie:** `src/app/api/email/route.ts`
**Impact:** Iedereen kan emails versturen vanaf het bedrijfsdomein. Phishing-risico en SSRF via attachment URL.
**Actie:** Voeg Clerk auth middleware toe aan deze route. **Onmiddellijk fixen.**

### 4. SECURITY — Broken Admin Check in Mobile Backend
**Bron:** security-audit | **Locatie:** `convex/mobile.ts:1052,1103,1144,1174`
**Impact:** Het patroon `user.role && user.role !== "admin"` evalueert `undefined` role als falsy, waardoor users zonder role admin-acties kunnen uitvoeren.
**Actie:** Fix de conditional naar `user.role !== "admin"` met expliciete role check. **Onmiddellijk fixen.**

### 5. SECURITY — SQL Injection in Mobile Sync Engine
**Bron:** mobile-review | **Locatie:** `mobile/lib/storage/` sync engine
**Impact:** Unsanitized table name interpolatie in SQLite queries. Malformed sync data kan willekeurige SQL uitvoeren.
**Actie:** Whitelist table names, gebruik parameterized queries. **Onmiddellijk fixen.**

### 6. TEST — Core Calculator (2.027 regels) Heeft Nul Tests
**Bron:** test-coverage | **Locatie:** `src/lib/offerte-calculator.ts`
**Impact:** Alle prijsberekeningen, BTW, marges, en scope-calculaties zijn ongetest. Een fout hier betekent foutieve offertes naar klanten. Geschatte totale test coverage: <2%.
**Actie:** Schrijf unit tests voor `calculateTotals()`, currency parsing, en per-scope calculaties. **Hoge prioriteit.**

### 7. SCOPE — Rollenmodel Heeft Slechts 3 van 7 Vereiste Rollen
**Bron:** scope-compliance | **Locatie:** `convex/schema.ts`, `convex/users.ts`
**Impact:** Het scope document vereist 7 rollen (Directie, Projectleider, Voorman, Medewerker, Klant, Onderaannemer/ZZP, Materiaalman) maar er zijn er slechts 3 (admin, medewerker, viewer). Dit ondermijnt het volledige permissiemodel.
**Actie:** Uitbreiden naar het vereiste rollenmodel met granulaire permissies. **Hoge prioriteit.**

### 8. PERFORMANCE — Full Table Scans op Dashboards
**Bron:** convex-functions + schema-review | **Locatie:** `convex/voormanDashboard.ts`, `convex/directieDashboard.ts`, `convex/medewerkerAnalytics.ts`, `convex/mobile.ts`
**Impact:** Dashboards laden ALLE records uit tabellen zonder indexes en filteren in JavaScript. Dit vertraagt lineair naarmate data groeit — nu al merkbaar bij duizenden records.
**Actie:** Voeg indexes toe (minimaal `offertes.klantId`, `urenRegistraties` op datum/medewerker) en herschrijf queries. **Hoge prioriteit.**

### 9. CONVEX — Betalingen Lekken Data + Ontbrekende Ownership Checks
**Bron:** convex-functions | **Locatie:** `convex/betalingen.ts`, `convex/toolboxMeetings.ts`, `convex/leadActiviteiten.ts`
**Impact:** `betalingen.list` retourneert alle betalingen van alle gebruikers. `toolboxMeetings.update` en `leadActiviteiten.listByLead` missen ownership verificatie — elke geauthenticeerde user kan andermans data lezen/wijzigen.
**Actie:** Voeg userId filtering en ownership checks toe. **Hoge prioriteit.**

### 10. MOBILE — Biometric Login Fundamenteel Broken
**Bron:** mobile-review | **Locatie:** `mobile/app/(auth)/login.tsx`
**Impact:** Biometric tokens worden opgeslagen maar nooit gebruikt om Clerk sessies te herstellen. Face ID/Touch ID flow eindigt altijd in "sessie verlopen" — de feature werkt niet.
**Actie:** Implementeer token restore flow na biometric verificatie. **Medium prioriteit.**

---

## Aanbevolen Volgorde van Fixes

### Fase 1: Security Hotfixes (DIRECT — deze week)
1. Verwijder hardcoded Clerk secret key + roteer key
2. Fix `makeCurrentUserAdmin` privilege escalation
3. Fix broken admin check in `mobile.ts`
4. Voeg auth toe aan email API route
5. Fix SQL injection in mobile sync engine
6. Fix betalingen data leak + ownership checks

### Fase 2: Data Integriteit (Week 1-2)
7. Voeg ontbrekende Convex indexes toe (klantId, urenRegistraties)
8. Herschrijf full table scan queries op dashboards
9. Migreer `urenRegistraties.medewerker` van string naar `v.id("medewerkers")`
10. Vervang `v.any()` door specifieke validators (7 locaties)
11. Fix offset-based pagination naar cursor-based

### Fase 3: Test Coverage (Week 2-4)
12. Unit tests voor `offerte-calculator.ts` — `calculateTotals()` eerst
13. Unit tests voor BTW/currency/marge berekeningen
14. Unit tests voor status transitie logica
15. Unit tests voor Zod validatie schemas
16. Integration tests voor kritieke Convex mutations

### Fase 4: Code Cleanup (Week 3-4)
17. Verwijder ~9.724 regels dead code (47 bestanden)
18. Consolideer duplicate modules (pushNotifications/notifications, brandstof/brandstofRegistratie)
19. Verwijder 20 ongebruikte UI componenten + 11 ongebruikte hooks
20. Verwijder console.log statements uit productie code

### Fase 5: Architecture & UX (Week 4-6)
21. Uitbreiden rollenmodel naar 7 rollen per scope document
22. Migreer Convex errors van `Error` naar `ConvexError`
23. Voeg ontbrekende `not-found.tsx` en `loading.tsx` pagina's toe
24. Fix unmemoized CommandProvider context
25. Standaardiseer toast patronen (kies 1 patroon)
26. Fix biometric login flow op mobile

### Fase 6: Performance (Week 5-6)
27. Migreer Framer Motion naar LazyMotion/`m` export (107+ bestanden)
28. Splitts 1500+ regel pagina-bestanden op
29. Optimaliseer Sentry Replay bundling
30. Lazy load landing page componenten

### Fase 7: Scope Compliance (Doorlopend)
31. Implementeer Onderhoudscontracten module (P1)
32. Implementeer Boekhoudkoppeling (P1)
33. Implementeer Garantiebeheer module (P2)
34. Fix false positives in feature_list.json
35. Implementeer ontbrekende sub-features per scope document

---

## Overall Code Health Score

### **Grade: C-**

| Categorie | Score | Toelichting |
|-----------|-------|-------------|
| Security | **D** | 5 kritieke kwetsbaarheden waarvan 1 privilege escalation en 1 hardcoded secret |
| Test Coverage | **F** | <2% coverage, kern business logic volledig ongetest |
| Architecture | **B-** | Goede basis (Convex + Clerk + Next.js), maar rollenmodel incompleet |
| Code Quality | **C+** | TypeScript strict mode aan, weinig `any`, maar veel type assertions |
| Performance | **C** | Goede image/font optimalisatie, maar Framer Motion bloat en full table scans |
| Error Handling | **B-** | Goede error boundary architectuur, maar Convex errors niet production-ready |
| UI/UX | **B** | Consistent shadcn/ui gebruik, maar toast/form inconsistenties |
| Dead Code | **D+** | ~9.700 regels verwijderbaar, duplicate modules |
| Mobile | **D** | Biometric broken, hardcoded secret, SQL injection risico |
| Scope Compliance | **C** | 66/75 features passing, maar 3 P1/P2 modules ontbreken en rollenmodel incompleet |

### Sterke Punten
- TypeScript strict mode is aan, nul `@ts-ignore` directives
- Goede error boundary architectuur met Sentry integratie
- Consistent gebruik van shadcn/ui en lucide-react
- Correcte next/image en next/font optimalisatie
- Convex transactioneel model goed benut voor atomische mutations
- Goed gestructureerde wizard hooks en form patterns

### Aandachtspunten
- Security moet **onmiddellijk** gefixt worden — privilege escalation en hardcoded secrets zijn showstoppers
- Test coverage van <2% is onacceptabel voor een financiele tool
- Dead code opruimen scheelt ~10K regels onderhoudslast
- Rollenmodel moet uitgebreid worden om aan scope te voldoen
- Full table scans worden een probleem zodra de dataset groeit

---

*Gegenereerd op 2026-03-26 door 12 parallelle review agents*
*Individuele rapporten beschikbaar in `.planning/reviews/`*
