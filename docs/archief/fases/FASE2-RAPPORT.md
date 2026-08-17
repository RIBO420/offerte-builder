# FASE 2 — Overdrachtsrapport (QA-eindronde)

*Datum: 11 juli 2026 — branch `fase-2` (gestapeld op `fase-1-catalogus`, niets gepusht).*

## 1. Wat er staat, per module

### §3.2 Debiteurenladder
- **Cron** `debiteurenladder verwerken` (dagelijks 08:00 UTC, `convex/crons.ts`): per openstaande verzonden factuur hooguit één vervallen trede. Mail-tredes (dag 14/21) maken een **concept**-herinnering in de goedkeuringswachtrij (§2.7); trede 3 (dag 28) maakt een interne kantoortaak (taaksoort `debiteurentaak`) op het cases-bord. Idempotent per factuur+trede; gepauzeerd = overgeslagen; alles logt op de klanttijdlijn.
- **UI**: `/facturen` → tab **Openstaand** (`src/components/facturen/openstaand-overzicht.tsx`): totalen + ouderdomsbuckets (0–14 / 14–30 / 30–60 / 60+ dagen), per post aanmaanniveau, pauzeren (met verplichte reden), hervatten en trede overslaan. Instellingen: `/instellingen` → tab **Herinneringen** (DebiteurenladderCard: tredes aan/uit, dagen, modus).
- **Testen**: rooktest-stap "facturen tab Openstaand"; handmatig: verzonden factuur laten verlopen, cron afwachten of `debiteuren.verwerkLadder` op dev draaien, daarna concept-wachtrij + meldingen-bord (filter Debiteurentaken) controleren. Mailtriggers `betalingsherinnering_1..4` staan op **concept** — er verstuurt niets zolang kantoor niet goedkeurt én `EMAIL_VERZENDEN_ACTIEF=false`.

### §3.1 Klantenportaal-uitbreiding
- Portaalroutes onder `src/app/portaal/(portal)/`: overzicht, projecten, offertes, facturen, meldingen (met trigger-event `melding_ontvangen`), berichten/chat, documenten, profiel.
- **Afscherming**: proxy (`src/proxy.ts`) stuurt staf op basis van de Clerk-claim weg; **nieuw in deze QA-ronde** is de spiegel-guard op Convex-rol in de portaal-layout (zie §4, fix 2).
- **Testen**: rooktest verifieert alleen de afscherming (stafaccount → `/dashboard`). De ingelogde klant-flow vergt een **klant-testaccount** (invitation-flow) — actiepunt, zie §5.

### §3.3 Machinepark + vervallogica-engine
- **UI** `/machinepark` (`src/app/(dashboard)/machinepark/page.tsx`): machines + bussen in één overzicht (status, teamkleur, schaars, eerstvolgende vervaldatum), banner "Verloopt binnenkort", tab Teams & bussen, detail-/beheerdialoog (`middel-detail-dialog.tsx`) met vervalitems (APK, keuring, verzekering, certificaat).
- **Engine**: cron `vervalitems verwerken` (05:15 UTC), gedeelde kern in `convex/vervalLogica.ts`; idempotente bord-taken via sleutel `verval:{id}:{vervaldatum}`. Mailt nooit. De engine is generiek — HR-certificeringen (fase 3) haken hierop aan.
- **Testen**: rooktest-stap machinepark; handmatig: vervalitem met datum binnen de waarschuwtermijn zetten → banner + onderhoudstaak op het cases-bord.

### §3.4 Beurt-nacalculatie + normuur-suggesties
- `convex/beurtNacalculatie.ts`: vergelijkt bevestigde urensegmenten met de norm per bouwsteen; vanaf de drempel (aantal uitgevoerde beurten) ontstaat een suggestie.
- **UI**: `/instellingen/catalogus` → kaart "Normuur-suggesties uit nacalculatie" (`src/components/catalogus/normuur-suggesties.tsx`, rendert nu ook in lege staat — fix 1) met knop Overnemen (werkt de bouwsteennorm bij; prijs per beurt volgt het uurtarief). Plus `normuur-suggestie-card.tsx` op Calculatie Analyse.
- **Testen**: rooktest-stap catalogus; unit-suite dekt de rekenlogica (`beurt-nacalculatie.test.ts`).

### Bijlage B: lijstweergave + volgorde-voorstel dagkaart
- `/planning/lijst` (`Afsprakenlijst`): zelfde planbord-data als lijst; tabs Mijn/Alle, filters team/status/periode, sorteren per kolomkop.
- `/planning/dagkaart`: knop **"Stel volgorde voor"** (bij ≥2 stops) → nearest-neighbour-voorstel vanaf de loods (`getVolgordeVoorstel`, unit-getest in `volgorde-voorstel.test.ts`) als preview; planner beslist (overnemen/verwerpen), handmatig vastgezette starttijden blijven staan. Zonder Maps-key: standaard-reistijden.
- **Testen**: rooktest-stappen lijst + dagkaart; unit-suite voor de sorteer-/filterhelpers en het volgorde-algoritme.

## 2. QA-uitslag

### Rooktest fase 2 (`e2e/fase2-rooktest.spec.ts`) — GROEN
| Scherm | Uitslag |
|---|---|
| /facturen tab Openstaand | ✅ buckets + kaart "Openstaande posten"; geen actieve posten op dev → lege staat geasserteerd, pauzeer-dialoog niet te openen |
| /instellingen → Herinneringen | ✅ DebiteurenladderCard rendert |
| /machinepark | ✅ kop + tabs; geen materieel op dev → lege staat; vervalbanner terecht afwezig |
| /planning/lijst | ✅ kop, tabs, alle filters; geen afspraken op dev (venster 2020–2030) → lege staat, sortering niet klikbaar |
| /planning/dagkaart | ✅ kop; geen actieve teams op dev → lege staat (knop vergt ≥2 stops) |
| /instellingen/catalogus | ✅ NormuurSuggesties rendert in lege staat (na fix 1) |
| /meldingen | ✅ filter Debiteurentaken bestaat en filtert zonder crash |
| /portaal/* | ✅ stafaccount → redirect `/dashboard` (na fix 2); ingelogde klant-flow niet getest (klant-account nodig) |
| Console-errors | ✅ geen op alle bezochte schermen |

**Let op:** de dev-database is grotendeels leeg, dus de data-afhankelijke takken liepen door de lege staten (expliciet geasserteerd en per run geannoteerd — geen stille overslagen). Zodra dev teams/materieel/afspraken heeft, testen dezelfde stappen automatisch de gevulde takken (dialoog openen, sorteren, volgorde-knop).

### Regressie — GROEN
- E2e: `fase1-offerte-rooktest`, `fase1-modules-rooktest`, `fase2-rooktest` — **3/3 groen** (config `playwright.fase1.config.ts`, testMatch verbreed naar fase 2).
- Unit-suite: **2751/2751** (88 bestanden) — baseline gehaald.
- Typecheck: web **0**, mobile **0**. ESLint: web **0**, mobile **0**.
- `npx convex dev --once`: groen ("Convex functions ready").

### Seeds & crons (dev)
- `mailTriggers.seedDefaults` gedraaid via de beheer-knop op `/instellingen/mailtriggers` (ingelogd als e2e-kantooraccount): **10 standaardtriggers toegevoegd**, waaronder `melding_ontvangen` en `betalingsherinnering_1..4` — allemaal concept-modus, er is niets gemaild. Idempotent (sleutel = event).
- Cron-registraties geverifieerd in `convex/crons.ts`: debiteurenladder **08:00**, vervalitems **05:15**, plus bestaande (cleanup 03:00, beurtenhorizon 02:30, planningsattendering 05:00, concept-mails 06:00, offerte-opvolging 06:15, contracttermijnen 04:00, maandverzamelfacturen maandelijks 04:30).

## 3. Gevonden en gefixte issues
1. **NormuurSuggesties verdween in lege staat** (`src/components/catalogus/normuur-suggesties.tsx`): de kaart returnde `null` zonder suggesties, waardoor kantoor niet kon zien dat de nacalculatie-loop bestaat. Fix: kaart blijft staan met lege-staat-tekst (incl. drempel); `data-testid="normuur-suggesties-leeg"`.
2. **Staf niet weggestuurd van het klantenportaal** (`src/app/portaal/(portal)/layout.tsx`): de proxy redirect alleen op de Clerk-sessieclaim; ontbreekt/laggt die (zoals bij het e2e-account), dan landde een stafaccount op het portaal (lege shell, klant-queries faalden met requireKlant-errors). Fix: spiegel-guard op de **Convex-rol** (zoals de dashboard-layout klanten weert): staf → `router.replace("/dashboard")`; klant-queries pas na rolcheck. Gebruikers zónder rol (invitation-flow) blijven ongemoeid.
3. Klein: strict-mode-selector in de rooktest ("Openstaande posten" matchte ook de lege-staat-kop) — testfix.

## 4. Actiepunten voor mensen

### Ricardo (lead)
- **Branch-review + push**: `main..fase-1-catalogus` = **121 commits**, `fase-1-catalogus..fase-2` = **19 commits** (incl. deze QA-commit) — samen 140, **niets gepusht**. Review en merge-strategie bepalen.
- **Prod-actiepunten (stapelen zich op bij deploy):**
  - `EMAIL_VERZENDEN_ACTIEF` staat "false" — bewust; pas omzetten na expliciete go.
  - Google **Maps-key** op prod zetten (dagkaart-reistijden; zonder key vallen we op standaard-reistijden terug).
  - **seedDefaults-knop op prod** klikken (mailtriggers + e-mailtemplates) na eerste deploy.
  - **Migraties draaien op prod** bij deploy: `backfillWerkitemType`, `saneerLeadsKlanten`, `splitsFactuurStatus`, `migreerWeekPlanning`, tijdlijn-notities.
  - **Klant-testaccount** aanmaken (invitation-flow) zodat de ingelogde portaal-flow e2e-getest kan worden.
- Dev-database vullen (teams, materieel, afspraken, openstaande factuur) zodat de rooktest de gevulde takken doorloopt.

### Mickey
- Bestaande lijst uit fase 1 blijft staan.
- Nieuw: **nacalculatie-drempel** beoordelen — vanaf hoeveel bevestigde beurten mag een normuur-suggestie verschijnen, en wanneer is een afwijking groot genoeg? (Zie ook restje "drempel-instelveld" hieronder.)

### Yannick / Hans
- **Boekhoudpakket kiezen (§7.6)** blijft de poort naar de bankkoppeling/bankreconciliatie — zonder die keuze kan fase 3-bankwerk niet starten.

## 5. Doorgeschoven naar fase 3
- HR-certificeringen op de generieke verval-engine (§3.3 is er klaar voor).
- Gmail-integratie; WhatsApp Business API; bankreconciliatie (na §7.6-keuze).
- AI-intake, SOP-module, planbord-AI.

### Kleine restjes uit de fase 2-stappen
- Thumbnails voor portaal-foto's (nu originelen).
- Reserveer-UI (machines/bussen) op de werkitem-dialoog.
- Instelveld voor de nacalculatie-drempel (nu vaste waarde uit de backend).
- Sampledata/lege staat voor CalculatieVergelijking.

## 6. Hoe deze QA te herhalen
```bash
# preview-server draait via de preview-tooling (dev-lock: geen eigen next dev)
FASE1_BASE_URL=http://localhost:<poort> npx playwright test \
  --config playwright.fase1.config.ts --global-timeout=480000
npm run test:run && npm run typecheck && npm run lint
cd mobile && npx tsc --noEmit && npx eslint .
npx convex dev --once   # NOOIT convex deploy vanaf deze branch
```

## 7. Eindoordeel
**Fase 2 is klaar voor review.** Alle poorten groen (e2e 3/3, unit 2751, typecheck/lint 0, Convex-sync groen), seeds en crons geverifieerd, twee echte bevindingen direct gefixt. Kanttekeningen: de rooktest liep op een lege dev-dataset (lege staten getest, gevulde takken volgen zodra dev data heeft) en de ingelogde portaal-flow wacht op een klant-testaccount.
