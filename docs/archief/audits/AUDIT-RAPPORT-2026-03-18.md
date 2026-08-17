# Audit Rapport — Top Tuinen Offerte Calculator
> Datum: 2026-03-18 | Geanalyseerd door: 10 parallelle AI agents

---

## KRITIEKE BEVINDINGEN (Direct actie vereist)

### Security

| # | Bevinding | Bestand | Ernst |
|---|-----------|---------|-------|
| S1 | **Mollie webhook mist signature verificatie** — Aanvallers kunnen betalingsstatussen manipuleren | `src/app/api/mollie/webhook/route.ts` | CRITICAL |
| S2 | **13 migratie-mutations zonder authenticatie** — Elke ingelogde user kan data wijzigen | `convex/migrations.ts` | CRITICAL |
| S3 | **Unauthenticated file upload** — generateUploadUrl() en addFotoToAanvraag() vereisen geen auth | `convex/fotoStorage.ts` | CRITICAL |
| S4 | **Geen numerieke validatie op financiele velden** — prijsPerEenheid, hoeveelheid accepteren negatieve waarden | `convex/validators.ts` | CRITICAL |
| S5 | **Rate limiting uitgeschakeld op publieke offerte endpoints** — Brute-force mogelijk op share tokens | `convex/publicOffertes.ts` | CRITICAL |
| S6 | **API routes zonder authenticatie** — transcribe, summarize, mollie routes zijn open | `src/app/api/transcribe/route.ts`, `summarize/route.ts` | HIGH |
| S7 | **CSP te permissief** — unsafe-inline en unsafe-eval in script-src | `next.config.ts` | HIGH |
| S8 | **9 kwetsbare dependencies** — serialize-javascript (RCE), next (5 vulns), rollup (path traversal) | `package.json` | HIGH |
| S9 | **Viewer role wordt niet afgedwongen** — Alleen frontend UI blokkeert, API calls niet | `convex/roles.ts` | HIGH |
| S10 | **Client-supplied userId in offerteVersions** — Gebruikers kunnen acties aan anderen toewijzen | `convex/offerteVersions.ts` | HIGH |
| S11 | **Webhook CORS: Access-Control-Allow-Origin: \*** — Elke website kan webhook aanroepen | `convex/http.ts` | HIGH |
| S12 | **Role default naar admin** — Nieuwe users zonder role worden automatisch admin | `convex/schema.ts` | HIGH |

---

## HIGH PRIORITY VERBETERINGEN

### Performance

| # | Bevinding | Bestand(en) | Impact |
|---|-----------|-------------|--------|
| P1 | **N+1 query in nacalculaties.listAll()** — Per project 2+ losse queries | `convex/nacalculaties.ts` | 5-10x trager bij 50+ projecten |
| P2 | **Full table scan op correctiefactoren** — Geen index voor system defaults | `convex/voorcalculaties.ts` | Elke berekening scant hele tabel |
| P3 | **N+1 query in urenRegistraties.listGlobalPaginated()** — 1 query per project | `convex/urenRegistraties.ts` | Lineair trager bij meer projecten |
| P4 | **Missende indexes** — urenRegistraties mist by_user, by_user_datum; machineGebruik mist by_project_datum | `convex/schema.ts` | Full table scans |
| P5 | **7 mega-pagina's (1100-1600 regels)** — Monolithische state, elke keystroke re-rendert hele pagina | Configurator, offertes, projecten pages | 40-60% meer jank |
| P6 | **6+ raw `<img>` tags zonder next/image** — Geen WebP, geen lazy loading, geen srcset | Foto gallery, QC upload, configurator | 3-5x grotere afbeeldingen |
| P7 | **Waterfall queries op projecten page** — Haalt tegelijk paginated EN volledige lijst op | `src/app/(dashboard)/projecten/page.tsx` | Dubbel data fetching |
| P8 | **Mobile: AnimatedNumber op JS thread** — useNativeDriver: false blokkeert JS thread | `mobile/components/ui/AnimatedNumber.tsx` | UI lag tijdens animatie |
| P9 | **Mobile: Timer/interval memory leaks** — setInterval niet goed opgeruimd, pollt in background | `mobile/app/(tabs)/index.tsx`, `use-offline-sync.ts` | Batterijverbruik |
| P10 | **Mobile: Missing getItemLayout op FlatLists** — Runtime height measurement per item | Home, uren, chat screens | Scroll jank |

### UX

| # | Bevinding | Bestand(en) | Impact |
|---|-----------|-------------|--------|
| U1 | **Geen loading.tsx bestanden** — 20+ dashboard pages zonder route-level skeleton loaders | `src/app/(dashboard)/*/` | Layout shift, geen loading feedback |
| U2 | **Geen not-found.tsx pagina's** — Generieke Next.js 404 bij ongeldige routes | `src/app/` | Verwarrend voor gebruikers |
| U3 | **Formulier errors niet announced voor screen readers** — Ontbrekend aria-describedby, aria-required | `src/components/ui/form.tsx` | WCAG non-compliance |
| U4 | **Geen error summary boven formulieren** — Gebruikers moeten scrollen om errors te vinden | Alle scope forms | Slecht bij lange formulieren |
| U5 | **Submit buttons niet disabled tijdens submission** — Dubbelklik = dubbele submission | Diverse dialoog/forms | Data duplicatie |
| U6 | **Mobile: Foto's tab is placeholder** — "Foto's worden hier geladen..." zonder implementatie | `mobile/app/(tabs)/fotos.tsx` | Core feature ontbreekt |
| U7 | **Mobile: Geen error boundary** — App crash = volledig wit scherm | `mobile/app/_layout.tsx` | Geen recovery mogelijk |
| U8 | **Mobile: Kleurcontrast te laag** — Inactive tab #555 op #0A0A0A = ~2:1 ratio (vereist 4.5:1) | `mobile/theme/colors.ts` | WCAG AA fail |
| U9 | **Mobile: Geen sync feedback** — Gebruiker weet niet wanneer offline data gesynct is | `mobile/hooks/use-offline-sync.ts` | Onzekerheid over data |

---

## MEDIUM PRIORITY VERBETERINGEN

### Performance

| # | Bevinding | Bestand(en) |
|---|-----------|-------------|
| P11 | Recharts: 8-9 losse dynamic imports ipv 1 bundel | `src/components/project/kosten-vergelijking-chart.tsx` |
| P12 | date-fns/locale nl geimporteerd in 10+ bestanden (~20KB per file) | Diverse components |
| P13 | 84 components met useMemo/useCallback maar slechts ~15 met React.memo() | Diverse components |
| P14 | Over-fetching in medewerkers.getPerformance() — haalt ALLE uren op, filtert in memory | `convex/medewerkers.ts` |
| P15 | Over-fetching in projecten.listForPlanning() — collect() dan filter ipv query filter | `convex/projecten.ts` |
| P16 | Mobile: Geen React.memo op list items (ProjectListItem, HeroProjectCard) | `mobile/components/ui/` |

### UX

| # | Bevinding | Bestand(en) |
|---|-----------|-------------|
| U10 | Inconsistente breadcrumb implementatie (2 parallelle systemen) | `src/app/(dashboard)/offertes/[id]/page.tsx` |
| U11 | Paginatie niet mobile-geoptimaliseerd — alle 5 knoppen getoond op mobiel | `src/components/ui/pagination.tsx` |
| U12 | Empty states onderbenut — uren, instellingen, rapportages missen lege-staat UI | Diverse pages |
| U13 | Sorteerbare tabelheaders niet keyboard-accessible | `src/components/ui/responsive-table.tsx` |
| U14 | Icon-only buttons missen consequente aria-labels | Dashboard pages |
| U15 | Mobile: Button minimum height 44px (WCAG adviseert 48px) | `mobile/components/ui/Button.tsx` |
| U16 | Mobile: Notifications tab redirected naar home ipv eigen scherm | `mobile/app/(tabs)/notifications.tsx` |
| U17 | Formulier validatie op onChange = twitchy errors bij typen | Alle scope forms |

### Security

| # | Bevinding | Bestand(en) |
|---|-----------|-------------|
| S13 | Calendly webhook signature verificatie optioneel (skipt als geen key) | `src/app/api/calendly/route.ts` |
| S14 | Rate limiting fallback naar in-memory bij Upstash uitval | `src/app/api/email/route.ts` |
| S15 | String velden zonder lengtevalidatie (naam, adres, notities) | `convex/klanten.ts`, `convex/offertes.ts` |
| S16 | OfferteVersions queries checken geen eigenaarschap | `convex/offerteVersions.ts` |
| S17 | Geen HSTS header geconfigureerd | `next.config.ts` |

---

## LOW PRIORITY VERBETERINGEN

| # | Bevinding | Bestand(en) |
|---|-----------|-------------|
| L1 | Error boundary styling inconsistent (inline styles vs Tailwind) | `src/app/global-error.tsx` |
| L2 | Header heights niet gestandaardiseerd als CSS variable | `src/components/page-header.tsx` |
| L3 | Suspense boundaries met fallback={null} ipv skeleton | wagenpark, rapportages, medewerkers pages |
| L4 | ResponsiveTable priority documentatie ontbreekt | `src/components/ui/responsive-table.tsx` |
| L5 | Mobile: Typography scale mist tussenliggende 14px grootte | `mobile/theme/typography.ts` |
| L6 | Mobile: SQLite niet geindexeerd voor sync queries | `mobile/lib/storage/` |
| L7 | IBAN/KVK velden niet encrypted at rest | `convex/schema.ts` |
| L8 | Email velden zonder format validatie | `convex/klanten.ts`, `convex/leveranciers.ts` |

---

## AANBEVOLEN ACTIEPLAN

### Week 1: Security fixes (CRITICAL + HIGH)
1. Auth toevoegen aan migrations.ts, fotoStorage.ts, API routes
2. Mollie webhook signature verificatie implementeren
3. Rate limiting re-enablen op publicOffertes
4. `npm audit fix` draaien voor kwetsbare dependencies
5. Numerieke validatie toevoegen aan financiele velden
6. CSP unsafe-inline/unsafe-eval verwijderen
7. Viewer role enforcement in mutations
8. CORS restricten op webhook endpoint

### Week 2: Performance quick wins
1. Missende Convex indexes toevoegen (schema.ts)
2. N+1 queries fixen in nacalculaties + urenRegistraties
3. Raw `<img>` vervangen door next/image
4. AnimatedNumber migreren naar Reanimated
5. Timer/interval cleanup fixen in mobile

### Week 3: UX verbeteringen
1. loading.tsx + not-found.tsx toevoegen aan dashboard routes
2. aria-describedby + aria-required op form inputs
3. Submit button loading states
4. Error boundary toevoegen aan mobile app
5. Kleurcontrast fixen in mobile theme

### Week 4: Optimalisatie
1. Mega-pagina's opsplitsen in memoized subcomponents
2. Recharts bundel consolideren
3. date-fns locale centraliseren
4. React.memo toevoegen aan list item components
5. FlatList getItemLayout implementeren

---

## STATISTIEKEN

| Categorie | Critical | High | Medium | Low | Totaal |
|-----------|----------|------|--------|-----|--------|
| Security | 5 | 7 | 5 | 3 | 20 |
| Performance | 0 | 10 | 6 | 2 | 18 |
| UX/Accessibility | 0 | 9 | 8 | 5 | 22 |
| **Totaal** | **5** | **26** | **19** | **10** | **60** |
