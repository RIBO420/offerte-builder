# Dode-code & koppelrapport — TOP Offerte Calculator

_Gegenereerd 2026-06-15 · bron: `knip` (statische analyse) + handmatige verificatie per cluster_

## Hoe lezen

- **Scope:** alleen de **Next.js-app (`src/`, `convex/`)**. De Expo-app `mobile/` is **niet** betrouwbaar geanalyseerd (knip draaide buiten die workspace → ~100 valspositieven). Mobile apart laten analyseren.
- **Sterkste signaal = hele ongebruikte bestanden** (46 in `src/`). Geverifieerd: 0 statische imports in de hele app (`src` + `convex`).
- **"Koppelen vs weggooien" is een productbeslissing.** Hieronder staat mijn onderbouwde *lean*, niet een definitief oordeel. **Verifieer per cluster vóór verwijderen** — sommige features zijn bewust nog niet ingehangen.
- Niet meegenomen als "dood": de 364 ongebruikte *exports* zijn grotendeels shadcn/ui- en util-API-volledigheid (zie §3) — lage prioriteit.

---

## 1. Features gebouwd maar niet gekoppeld (hoofdsignaal)

| Cluster | Bestanden | Refs | Lean | Actie |
|---|---|---|---|---|
| 🚗 **Wagenpark** | `wagenpark/`: fleetgo-sync, schade-form, schade-lijst, uitrusting-form, uitrusting-lijst, index | 0 | **Koppelen** als materieel/wagenpark in scope staat; anders weggooien | Beslis: is de wagenpark-module nog gepland? Zo ja → route + menu-item toevoegen. `src/lib/fleetgo.ts` is al wél gekoppeld (FleetGo-API). |
| 📊 **Rol-dashboards** | `dashboard/`: directie-dashboard, materiaalman-dashboard, qc-status-card, voorraad-alert-card, quick-actions, inkooporders-card, index | 0 (alleen via dode barrel) | **Koppelen** | Inhangen op het dashboard per rol (directie / materiaalman). Lijkt af, mist alleen wiring. |
| 📧 **E-mailtemplates** | `emails/`: aanmaning, factuur, portaal-bericht, portaal-factuur, portaal-offerte, portaal-project, portaal-uitnodiging | 0 | **Koppelen (hoge prio)** | Verzendlogica (Convex/Resend) rendert deze templates niet. Controleer de e-mail-actie en koppel de juiste template per type. |
| 📄 **PDF's** | `pdf/`: aanmaning-pdf, creditnota-pdf | 0 | **Koppelen** | Aanmaning- en creditnota-flow roept deze niet aan. (`OffertePDF`/`ContractPDF` bestaan wél, via `pdf/index.ts`.) |
| 🪝 **Feature-hooks** | `hooks/`: use-betalingen, use-email, use-foto-upload | 0 | **Koppelen of weggooien** | Horen bij betalingen / e-mail / foto-upload. Als die UI bestaat → koppelen; zo niet → weg. |
| 🧮 **Offerte-extra's** | `offerte/`: pakket-vergelijking, tuintypologie-selector | 0 | **Review** | Mogelijk experimenteel. Beslis of dit nog op de offerte-pagina moet. |

---

## 2. Waarschijnlijk weggooien (los, niet in scope herkenbaar)

Hele bestanden, 0 echte verwijzingen (of alleen via een óók-dode barrel):

- `src/components/project/` — `factuur-preview.tsx`, `dynamic-components.tsx`, `index.ts` → keten hangt alleen aan elkaar, nergens in een pagina. **Review/weggooien** (factuur-preview evt. koppelen aan factuurpagina).
- `src/components/medewerkers/` — `dynamic-dialogs.tsx`, `index.ts` → verweesde `next/dynamic`-wrapper. **Weggooien-kandidaat.**
- `src/components/workflow/` — `workflow-navigation.tsx`, `index.ts` → alleen via dode barrel. **Review.**
- `src/lib/styles.ts` → 0 refs. **Weggooien-kandidaat** (check eerst of het CSS-in-JS constants zijn).
- Dode barrel-`index.ts`'s: `app/(dashboard)/projecten/[id]/uitvoering/components/`, `lib/hooks/`. Laag risico — opruimen mag.

## 2b. UI-primitieven gebouwd, nog niet gebruikt (lage prio)

`src/components/ui/`: `breadcrumb`, `chart-loading-skeleton`, `data-card`, `form-field-feedback`, `form-section`, `trend-indicator`, `typography`, `index`. Herbruikbare componenten zonder huidige afnemer. **Laten staan** (goedkoop, mogelijk binnenkort nodig) **of opruimen** als je strak wilt houden.

---

## 3. Ongebruikte exports (364) — grotendeels géén dode code

De meeste zitten in **API-volledige** bestanden waar het normaal is dat niet elke export wordt gebruikt:

- `components/ui/sidebar.tsx`, `dropdown-menu.tsx`, `select.tsx` → shadcn-component-API.
- `lib/motion-config.ts` (29), `lib/format/index.ts` (13), `lib/validations/index.ts` (8), `lib/toast-utils.ts` → util-libs.
- `components/skeletons/`, `components/analytics/`, `components/error-boundary.tsx` → herbruikbare sets.

👉 **Niet automatisch verwijderen.** Optioneel later trimmen met `knip --fix` per bestand. Volledige lijst: `graphify-out/.knip_next.json`.

---

## 4. Mobile-app (apart analyseren)

De ~100 mobile-"hits" van knip zijn **valspositief** (Expo Router-pagina's in `mobile/app/`, `theme/`, generated Convex). Voor een betrouwbaar beeld: knip opnieuw draaien **binnen `mobile/`** met een Expo-bewuste config, of een gedeelde `knip.json` met `mobile/` als aparte workspace.

---

## 5. Aanbevolen werkwijze

1. **Beslis per cluster in §1** of het gekoppeld of verwijderd wordt (productkeuze).
2. Voor "koppelen": rol-dashboards en e-mailtemplates leveren de meeste waarde (af, alleen wiring).
3. **Voorkom herhaling:** voeg `knip` toe als dev-dependency + script, met config die `mobile/` apart zet en de §3-valspositieven onderdrukt. Dan zie je dit voortaan in CI.
4. Verwijder pas na een `npm run typecheck` + bestaande tests groen.

---

_Ruwe data: `graphify-out/.knip_next.json` (Next.js), `graphify-out/.knip.json` (volledig). Kennisgraaf voor navigatie: `graphify-out/graph.html`._
