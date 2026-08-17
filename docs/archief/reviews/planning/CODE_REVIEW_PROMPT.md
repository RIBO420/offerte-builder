# Code Review Mega Prompt — 12 Parallel Agents

Kopieer het volgende in een nieuwe Claude Code terminal:

---

```
Je bent de lead code reviewer voor het Top Tuinen project. Dit is een Next.js 16 + Convex + React app in /Users/ricardobos/Projects/Client Work/Top-Tuinen/TOP Offerte Calculator/offerte-builder.

Lees eerst CLAUDE.md en .planning/feature_list.json voor context.

Maak een team met 12 agents die PARALLEL de volgende reviews doen. Elke agent schrijft zijn bevindingen naar .planning/reviews/{agent-naam}.md. Geen code wijzigen — alleen rapporteren.

## Agent 1: "schema-review"
Review convex/schema.ts grondig:
- Zijn alle tabellen genormaliseerd? Redundante data?
- Ontbrekende indexes voor veelgebruikte queries?
- Type consistentie (string vs v.union voor enums)
- Relaties tussen tabellen (foreign keys logisch?)
- Soft delete consistentie
- Schrijf bevindingen naar .planning/reviews/schema-review.md

## Agent 2: "security-audit"
Security review van de hele app:
- Auth checks op ALLE Convex mutations/queries (grep naar functies zonder auth)
- Input validatie (zijn alle user inputs gevalideerd met Zod?)
- XSS mogelijkheden in React componenten (dangerouslySetInnerHTML?)
- CSRF bescherming
- Sensitive data exposure (geen secrets in client code?)
- API routes (/src/app/api/*) — auth middleware aanwezig?
- Schrijf bevindingen naar .planning/reviews/security-audit.md

## Agent 3: "typescript-quality"
TypeScript strictness review:
- Zoek alle `any` types (grep -r ": any" --include="*.ts" --include="*.tsx" src/)
- Zoek alle `as` type assertions
- Zoek alle @ts-ignore / @ts-expect-error
- Ontbrekende return types op functies
- Ongebruikte imports en variabelen
- Consistent gebruik van interfaces vs types
- Schrijf bevindingen naar .planning/reviews/typescript-quality.md

## Agent 4: "react-patterns"
React best practices review in src/components/ en src/app/:
- Onnodige re-renders (missing useMemo/useCallback waar nodig)
- Correct gebruik van useEffect (missing deps, cleanup functions)
- Key prop gebruik in lists (index als key = slecht)
- Client vs Server component grens (onnodige 'use client'?)
- Error boundaries aanwezig?
- Loading states en Suspense boundaries
- Schrijf bevindingen naar .planning/reviews/react-patterns.md

## Agent 5: "convex-functions"
Review alle Convex functions in convex/*.ts:
- Query vs mutation correct gebruik
- Pagination implementatie correct?
- Error handling (try/catch, user-friendly errors)
- N+1 query problemen
- Transactie consistentie (mutations die meerdere tabellen updaten)
- Ongebruikte queries/mutations
- Schrijf bevindingen naar .planning/reviews/convex-functions.md

## Agent 6: "ui-ux-consistency"
UI/UX consistentie review:
- Consistent gebruik van shadcn/ui componenten
- Kleurgebruik consistent (geen hardcoded hex, altijd CSS vars?)
- Responsive design (mobile breakpoints aanwezig?)
- Loading skeletons vs spinners (consistent?)
- Toast/notification patronen consistent?
- Formulier validatie feedback consistent?
- Dark mode support consistent?
- Schrijf bevindingen naar .planning/reviews/ui-ux-consistency.md

## Agent 7: "error-handling"
Error handling review over de hele codebase:
- Try/catch in alle API routes
- Error boundaries in React
- Convex mutation error handling
- User-facing error messages (Nederlands, duidelijk?)
- Network error handling (offline states?)
- Form submission error recovery
- 404/500 pagina's aanwezig?
- Schrijf bevindingen naar .planning/reviews/error-handling.md

## Agent 8: "performance"
Performance review:
- Bundle size (onnodige grote dependencies?)
- Image optimization (next/image gebruikt?)
- Lazy loading (dynamic imports waar nodig?)
- Database query optimalisatie (indexes matchen met queries?)
- Onnodig grote client-side state
- Memo/caching strategieën
- Schrijf bevindingen naar .planning/reviews/performance.md

## Agent 9: "test-coverage"
Test coverage analyse:
- Welke modules hebben tests? Welke niet?
- Zijn kritieke business logic functies getest? (offerte berekeningen, facturatie, BTW)
- Zijn er integration tests?
- Test kwaliteit (testen ze het juiste?)
- Ontbrekende edge cases
- Schrijf bevindingen naar .planning/reviews/test-coverage.md

## Agent 10: "dead-code"
Dead code en cleanup:
- Ongebruikte componenten (niet geimporteerd ergens)
- Ongebruikte Convex functies (niet aangeroepen)
- Commented-out code blokken
- Console.log statements die er nog in zitten
- Duplicate code (copy-paste patronen)
- Lege bestanden of placeholder bestanden
- TODO/FIXME/HACK comments catalogiseren
- Schrijf bevindingen naar .planning/reviews/dead-code.md

## Agent 11: "mobile-review"
Mobile app review (mobile/ directory):
- Expo/React Native best practices
- Offline-first patronen correct geimplementeerd?
- SQLite sync logica robuust?
- Push notification setup compleet?
- Deep linking configuratie
- Performance op mobile (FlatList vs ScrollView?)
- Schrijf bevindingen naar .planning/reviews/mobile-review.md

## Agent 12: "scope-compliance"
Scope document compliance check:
- Lees ../TOP_TUINEN_SCOPE_DOCUMENT.md
- Vergelijk ELKE requirement met de daadwerkelijke implementatie
- Zijn er requirements die gemist zijn?
- Zijn er features die afwijken van de scope?
- Zijn alle user roles correct geimplementeerd? (directie, voorman, materiaalman, admin)
- Zijn alle integratie-eisen gedekt?
- Schrijf bevindingen naar .planning/reviews/scope-compliance.md

---

## Na afloop
Wanneer alle 12 agents klaar zijn, maak een samenvattend rapport .planning/reviews/SUMMARY.md met:
1. Totaal bevindingen per agent (critical/warning/info)
2. Top 10 meest kritieke issues
3. Aanbevolen volgorde van fixes
4. Overall code health score (A-F)

Ga nu aan de slag. Maak eerst de .planning/reviews/ directory aan en start alle 12 agents parallel.
```
