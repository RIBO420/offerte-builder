# Claude Code Kickoff Prompt — Offertebuilder Aanlegmodule

> Kopieer onderstaande prompt naar Claude Code om het project te starten met parallelle agent teams.

---

## De Prompt

```
Je bent de lead architect voor het offerte-builder project — een Next.js 16 + Convex applicatie voor een hoveniersbedrijf. Je taak is het implementeren van de aanlegmodule-uitbreidingen volgens het SCOPE-IMPLEMENTATIEPLAN-AANLEG.md.

## Context
Lees EERST deze bestanden om de codebase en het plan te begrijpen:
- SCOPE-IMPLEMENTATIEPLAN-AANLEG.md (het volledige implementatieplan)
- PROJECT-DOCUMENTATION.md (bestaande documentatie)
- convex/schema.ts (database schema)
- convex/validators.ts (data validators)
- src/lib/offerte-calculator.ts (calculator engine)
- src/app/(dashboard)/offertes/nieuw/aanleg/page.tsx (aanleg wizard)
- src/app/(dashboard)/offertes/nieuw/aanleg/hooks/useAanlegWizard.ts (wizard state)
- package.json (dependencies)

## Tech Stack
- Frontend: Next.js 16 (App Router) + React 19 + TypeScript
- Backend: Convex (serverless DB + functions)
- Auth: Clerk
- Styling: Tailwind CSS 4 + shadcn/ui
- Validation: Zod (frontend) + Convex validators (backend)
- State: React hooks + Convex real-time queries

## Architectuurregels
1. Convex schema wijzigingen altijd in convex/schema.ts + convex/validators.ts tegelijk
2. Nieuwe queries/mutations in eigen bestanden onder convex/ (bijv. convex/afvalverwerkers.ts)
3. Frontend hooks in src/hooks/ (bijv. use-afvalverwerkers.ts)
4. Scope forms in src/components/offerte/scope-forms/
5. Onderhoud forms in src/components/offerte/onderhoud-forms/
6. Zod schemas naast hun component OF in src/types/
7. Alle tekst in het Nederlands
8. shadcn/ui componenten gebruiken waar mogelijk
9. Calculator uitbreidingen in src/lib/offerte-calculator.ts
10. Bestaande code NIET breken — altijd backwards compatible

## FASE 1 — Start nu met 10 parallelle agents

Launch deze 10 agents TEGELIJK met de Task tool. Elke agent werkt onafhankelijk aan een eigen deeltaak. Alle agents zijn van type "general-purpose".

### Agent 1: Schema & Validators — Algemene Parameters
Taak: Breid convex/schema.ts en convex/validators.ts uit met:
- algemeenParams uitbreiden: klantvriendelijkheid (number 1-5), afstandVanLoods (number km), tuintypologie (string enum: "klein_stad"|"normaal"|"midden"|"luxe"|"landgoed"), typeWerkzaamheden (array of strings)
- Nieuwe tabel: afvalverwerkers (naam: string, adres: string, lat: number, lng: number, tariefPerTon: number, contactInfo: optional string)
- Nieuwe tabel: transportbedrijven (naam: string, adres: string, lat: number, lng: number, kmTarief: number)
- Nieuwe tabel: garantiePakketten (naam: string, tier: "basis"|"premium"|"premium_plus", duurJaren: number, maxCallbacks: number, prijs: number, beschrijving: string)
- Nieuwe tabel: plantsoorten (naam: string, type: string, lichtbehoefte: "zon"|"halfschaduw"|"schaduw", bodemvoorkeur: string, prijsIndicatie: number)
Lees eerst convex/schema.ts en convex/validators.ts om het bestaande patroon te volgen.

### Agent 2: Schema & Validators — Scope Data Uitbreidingen
Taak: Breid de scopeData validators en types uit in convex/validators.ts en src/types/offerte.ts:
- bestrating scope: voeg toe bestratingtype ("pad"|"oprit"|"terrein"), funderingslagen (auto-berekend object), zones (array van {type, oppervlakte, materiaal})
- borders scope: voeg toe orientatie ("noord"|"zuid"|"oost"|"west"|"nvt"), bodemverbetering (boolean), bodemMix (optional object), bemestingsschema (boolean)
- gras scope: voeg toe kunstgras (boolean), drainage (boolean, drainageMeters: number), opsluitbanden (boolean, opsluitbandenMeters: number), verticuteren (boolean)
- houtwerk scope: voeg toe leverancierUrl (optional string), configurator object per type
- water_elektra scope: voeg toe verlichtingsplan (boolean), diepteEis (number, default 60)
- offertes tabel: voeg toe garantiePakketId (optional Id<"garantiePakketten">)
Volg exact het bestaande patroon van aanlegScopeDataValidator.

### Agent 3: Convex Functions — Nieuwe Tabellen
Taak: Maak CRUD queries en mutations voor de nieuwe tabellen:
- convex/afvalverwerkers.ts (list, getById, create, update, remove + getNearest query die lat/lng accepteert en sorteert op afstand)
- convex/transportbedrijven.ts (list, getById, create, update, remove + getNearest)
- convex/garantiePakketten.ts (list, getByTier, getById, create, update, remove)
- convex/plantsoorten.ts (list, getByLichtbehoefte, search, create, update, remove)
Volg het patroon van bestaande convex/producten.ts en convex/klanten.ts.

### Agent 4: Frontend Hooks — Nieuwe Data
Taak: Maak React hooks voor de nieuwe tabellen:
- src/hooks/use-afvalverwerkers.ts (useAfvalverwerkers, useNearestAfvalverwerker, useCreateAfvalverwerker, etc.)
- src/hooks/use-transportbedrijven.ts (zelfde patroon)
- src/hooks/use-garantie-pakketten.ts (useGarantiePakketten, useGarantiePakketByTier)
- src/hooks/use-plantsoorten.ts (usePlantsoorten, usePlantSuggesties die filtert op licht/bodem)
Volg exact het patroon van src/hooks/use-producten.ts en src/hooks/use-klanten.ts.

### Agent 5: Bestrating Form — Multi-zone & Fundering
Taak: Verbeter src/components/offerte/scope-forms/bestrating-form.tsx:
- Voeg bestratingtype selector toe (pad/oprit/terrein) als EERSTE stap
- Automatische funderingsberekening die reageert op type:
  - Pad: 10cm puin, 5cm straatzand
  - Oprit: 20cm puin, brekerszand
  - Terrein: 30-40cm puin, brekerszand, stabiliser
- Toon funderingsvisualisatie (gestapelde lagen met kleuren en labels)
- "Zone toevoegen" knop: meerdere bestratingtypen per project
- Per zone: eigen type, oppervlakte, materiaal
- Info-tooltips bij elke laag ("Brekerszand is moeilijker te verwerken maar veel belastbaarder")
Lees eerst het bestaande bestrating-form.tsx om het formulier-patroon te begrijpen.

### Agent 6: Borders Form — Oriëntatie & Bodem
Taak: Verbeter src/components/offerte/scope-forms/borders-form.tsx:
- Voeg oriëntatie-selector toe (noord/zuid/oost/west) met visuele kompas-indicator
- Bodemverbetering sectie: toggle + opties (bestaande grond verbeteren / volledig nieuw)
- Bij "volledig nieuw": mix-configurator (zand %, compost %, teelaard %)
- Bemestingsschema toggle: 150 dagen basisbemesting, daarna upsell-melding
- Plant-suggesties panel: toon aanbevolen planten op basis van oriëntatie (gebruik shadcn Card)
Lees eerst borders-form.tsx voor het bestaande patroon.

### Agent 7: Gras Form — Uitbreidingen
Taak: Verbeter src/components/offerte/scope-forms/gras-form.tsx:
- Voeg kunstgras optie toe naast zaaien en grassoden (met eigen prijsberekening)
- Drainage sectie: toggle + meters PVC-buis berekening
- Opsluitbanden: toggle + lopende meters invoer
- Verticuteren bestaand gras: toggle (als voorbereiding)
- Before/after foto galerij component (placeholder afbeeldingen voor nu)
Lees eerst gras-form.tsx voor het bestaande patroon.

### Agent 8: Calculator — Uitbreidingen
Taak: Breid src/lib/offerte-calculator.ts uit:
- Funderingsberekening per bestratingtype: materiaalkosten per laag (puin, zand, brekerszand, stabiliser) op basis van m² en diepte
- Multi-zone bestrating: bereken totaal over alle zones
- Kunstgras materiaalkosten (prijs per m²)
- Drainage materiaalkosten (PVC + kokos per meter)
- Opsluitbanden kosten (per lopende meter)
- Bodemverbetering kosten (mix per m³)
- Offerte-overhead: vast bedrag €200 (instelbaar) als startkosten
- Garantiepakket kosten toevoegen aan totaal
Lees EERST het volledige bestaande offerte-calculator.ts om de structuur te begrijpen. Breek NIETS van de bestaande berekeningen.

### Agent 9: Standaard Tuinpakketten — 3-tier Component
Taak: Maak een nieuw pakket-selectie systeem:
- src/components/offerte/pakket-vergelijking.tsx — 3-koloms vergelijking (basis/comfort/premium)
  - Elke kolom toont: naam, prijs-indicatie, lijst van inclusief, "Kies dit pakket" knop
  - Highlight "Comfort" als aanbevolen (shadcn Badge)
  - Responsief: kolommen stapelen op mobiel
- src/components/offerte/tuintypologie-selector.tsx — visuele kaarten per tuintype
  - 5 types: klein stad, normaal, midden, luxe, landgoed
  - Elk met icoon, m² range, korte beschrijving
  - Selectie beïnvloedt welke pakketten getoond worden
- Integreer in de aanleg wizard als optionele "Snelstart" stap vóór handmatige scope-selectie
Gebruik shadcn/ui Card, Badge, Button componenten. Volg het design-patroon van bestaande src/components/offerte/package-selector.tsx.

### Agent 10: Garantiepakket Selector & Wizard Integratie
Taak: Maak garantie-selectie en integreer nieuwe stappen in de wizard:
- src/components/offerte/garantie-pakket-selector.tsx
  - 3 kaarten: Basis (5 jaar), Premium (uitgebreid), Premium Plus (all-in)
  - Per kaart: naam, prijs, duur, max callbacks, beschrijving, features lijst
  - Visuele highlight voor aanbevolen tier
- Pas src/app/(dashboard)/offertes/nieuw/aanleg/page.tsx aan:
  - Voeg "Garantie" als extra stap toe in de wizard (na scope details, voor review)
  - Voeg tuintypologie-selectie toe in stap 1 (klantgegevens)
  - Voeg klantvriendelijkheid-slider toe in stap 1
- Pas useAanlegWizard.ts aan voor de nieuwe stappen en data
Lees eerst page.tsx en useAanlegWizard.ts grondig.

## Merge-instructies na agents
Na alle agents: controleer of er schema-conflicten zijn in convex/schema.ts en convex/validators.ts (agents 1 en 2 werken op dezelfde bestanden). Merge handmatig als nodig. Run daarna `npx convex dev` om schema te valideren en `npm run build` om TypeScript errors te vinden.

## Kwaliteitseisen
- TypeScript strict mode — geen `any` types
- Alle form velden met Zod validatie
- Nederlandse labels en placeholders
- shadcn/ui componenten voor UI
- Responsive design (mobile-first)
- Loading states met Skeleton componenten
- Error boundaries voor elke scope-form
- Console.log statements verwijderen voor commit
```

---

## Gebruik

1. Open Claude Code in de `/offerte-builder` directory
2. Plak bovenstaande prompt
3. Claude Code zal 10 Task agents parallel lanceren
4. Na voltooiing: merge conflicten oplossen → build → test

## Tips voor vervolg-prompts

**Fase 1 verificatie:**
```
Alle agents zijn klaar. Doe nu:
1. Check convex/schema.ts voor merge-conflicten tussen Agent 1 en 2
2. Run `npx convex dev` en fix eventuele schema errors
3. Run `npm run build` en fix TypeScript errors
4. Test de aanleg wizard flow end-to-end
```

**Fase 2 starten (na Fase 1 klaar):**
```
Fase 1 is compleet en getest. Start nu Fase 2 met 8 parallelle agents:

Agent 1: Haagonderhoud form (lengte×hoogte×breedte×diepte, haagsoort, hoogwerker-check)
Agent 2: Boomonderhoud form (groottecategorieën, veiligheid, inspectie-types)
Agent 3: Reinigingswerkzaamheden form (terras-types, hogedrukspuit-akkoord)
Agent 4: Bemesting module (70% marge product, upsell-focus)
Agent 5: Gazonanalyse form (beoordeling, mos, schaduw, herstelpad)
Agent 6: Mollenbestrijding pakketten (3-tier)
Agent 7: Onderhoud calculator uitbreidingen
Agent 8: Onderhoud scope validators + schema uitbreidingen

[Lees SCOPE-IMPLEMENTATIEPLAN-AANLEG.md WP13 voor alle details]
```

**Fase 3 starten:**
```
Start Fase 3 — Communicatie & Self-Service:

Agent 1: Email templates (bevestigingsmail met datumkeuze)
Agent 2: Calendly API integratie
Agent 3: Klant-configurator publieke route /configurator/gazon
Agent 4: Klant-configurator /configurator/boomschors
Agent 5: Betalingsintegratie Mollie
Agent 6: Verificatie-workflow admin dashboard
Agent 7: Beschikbaarheidskalender component
Agent 8: Algemene voorwaarden + akkoord-formulier

[Lees SCOPE-IMPLEMENTATIEPLAN-AANLEG.md WP9 + WP11 voor details]
```
