# Offerte-entree — code-inventaris (feitenbasis herstructurering)

Datum: 15 aug 2026. Alle paden relatief aan `offerte-builder/`. Doel: feitenbasis voor
de nieuwe dropdown met drie ingangen (Vrije offerte / Los scopes kiezen / Templates).

## 1. Huidige ingangen

### 1.1 Singleton-dialog
- `src/components/new-offerte-dialog.tsx` — de hele dialog (239 regels).
  - `START_OPTIES` (r53–131): de **8 tegels**, elk met sneltoetsletter en route:

    | Tegel | Toets | Route |
    |---|---|---|
    | Tuinaanleg (prominent) | A | `/offertes/nieuw/aanleg` |
    | Onderhoud (prominent) | O | `/offertes/nieuw/onderhoud` |
    | Tuinrenovatie | R | `/offertes/nieuw/aanleg?scope=grondwerk&scope=borders&scope=gras` |
    | Beregening | B | `/offertes/nieuw/aanleg?scope=beregening` |
    | Bestrating | S | `/offertes/nieuw/aanleg?scope=bestrating` |
    | Aanleg parkeerplaats | P | `/offertes/nieuw/aanleg?scope=parkeerplaats` |
    | Reiniging | G | `/offertes/nieuw/onderhoud?scope=reiniging` |
    | Overige diensten (breed) | V | `/offertes/nieuw/vrij` |
  - `routeMetKlant()` (r139–145): plakt `klantId` via `URLSearchParams` aan de tegel-route.
  - Sneltoetsen binnen de dialog: r167–175 (`useKeyboardShortcuts` over `START_OPTIES`).
- Gemonteerd als singleton in `src/app/(dashboard)/layout.tsx:47` (import r16).

### 1.2 Openers (allemaal via `setShowNewOfferteDialog`)
- `src/components/providers/shortcuts-provider.tsx` — context (r27–46), setter met
  klant-wisregel (r58–68): `nieuweOfferteKlantId` wordt bij elk sluiten/openen
  overschreven. ⌘N en ⌘⇧N: r116–129. `NieuweOfferteOpties { klantId }`: r22–25.
- `src/app/(dashboard)/offertes/components/offerte-toolbar.tsx:83` — knop "Nieuwe offerte".
- `src/app/(dashboard)/dashboard/page.tsx:364` — dashboard-knop.
- `src/app/(dashboard)/klanten/[id]/page.tsx:481` — klantdossier:
  `setShowNewOfferteDialog(true, { klantId: klant._id })` (comment r470–477: de twee
  eerdere losse wizard-links zijn hier bewust weggehaald).
- Extra ingang buiten de dialog om: `?leadId=` op beide wizards (leads/configurator).

## 2. Aanleg-wizard (`/offertes/nieuw/aanleg`)

- Pagina: `src/app/(dashboard)/offertes/nieuw/aanleg/page.tsx` (586 r).
- State-machine: `.../aanleg/hooks/useAanlegWizard.ts` (539 r) — géén formele machine,
  een `currentStep`-nummer (0–4, `totalSteps = 5` r283) + `WizardData` in
  localStorage-autosave via `useWizardAutosave({ key: "aanleg" })` (r298–299;
  storage-sleutel `offerte-wizard-aanleg`, zie `src/hooks/use-wizard-autosave.ts:96`).
  `RestoreDraftDialog` bij een bestaand concept (page.tsx r412–418).
- Stappen (page.tsx r151–221): 0 Snelstart · 1 Klantgegevens & Scopes · 2 Scope
  Details · 3 Garantie · 4 Bevestigen. Knoplabels ("Volgende: Scope Details" enz.):
  `.../aanleg/components/AanlegNavigation.tsx:28–40`.

### 2.1 Wat stap 0 "Snelstart" nu echt doet
- page.tsx r481–501: toont `PackageSelector`, of na klik "mijn sjablonen" de
  `TemplateSelector`.
- `src/components/offerte/package-selector.tsx`: haalt pakketten uit
  `src/lib/constants/packages.ts` — **beide lijsten zijn leeg** (`AANLEG_PACKAGES = []`,
  `ONDERHOUD_PACKAGES = []`, r31–33; de 15 verzonnen pakketten zijn bewust verwijderd).
  Bij 0 pakketten (r80–110) toont stap 0 dus alleen een **"Beginnen"-knop** plus een
  tekstlinkje "mijn sjablonen" (r103) → `TemplateSelector`.
- `src/components/offerte/template-selector.tsx`: laadt `standaardtuinen` via
  `useStandaardtuinen(type)`; keuze → `handleTemplateSelect` (page.tsx r309–337) zet
  scopes + scopeData in de wizard-state en springt naar stap 1. **Stap 0 is dus in de
  praktijk een lege tussenstap** zolang er geen pakketten/sjablonen bestaan.

### 2.2 Parameters en velden
- `?scope=` landt in page.tsx r50 (`searchParams.getAll("scope")`) en wordt éénmalig
  voorgeselecteerd in r128–143 (validatie tegen `SCOPES`). NB: de gebruiker start
  alsnog op stap 0 en moet zelf "Beginnen" klikken.
- `?klantId=` r46 → prop `initialKlantId` van `AanlegKlantScopesStep` (r518) →
  `KlantSelector`. `?leadId=` r42 + r517.
- **Bereikbaarheid** (goed/beperkt/slecht): stap 1,
  `.../components/AanlegKlantScopesStep.tsx:152–167`.
- **Samenwerking/klantvriendelijkheid** (slider 1–5): zelfde stap r178–193; leeft in
  `WizardData` (hook r125, default 3, r155) maar wordt in `handleSubmit`
  **niet gepersisteerd** — `create` krijgt alleen `algemeenParams.bereikbaarheid`
  (page.tsx r269–271). Puur UI dus.
- Scope-selectie: stap 1 (checkbox-lijst uit `SCOPES`, hook r160–221: 9 aanleg-scopes
  incl. verplicht-markeringen). "Volgende: Scope Details" → stap 2 =
  `AanlegScopeDetailsStep` met de formulieren uit `src/components/offerte/scope-forms/`.
- Submit (page.tsx r223–306): `getNextNummer()` → evt. klant aanmaken
  (`createKlantFromOfferte`) → `offertes.create` (type "aanleg", scopes, scopeData) →
  client-side `calculate()` (`use-offerte-calculation` / `src/lib/offerte-calculator.ts`)
  → `updateRegels` → succes-dialog.

## 3. Onderhoud-wizard (`/offertes/nieuw/onderhoud`)

- `src/app/(dashboard)/offertes/nieuw/onderhoud/page.tsx` (361 r), opgeknipt in
  `.../onderhoud/components/` (`use-onderhoud-wizard.ts`, `step-*.tsx`).
- Zelfde patroon: stap 0 Snelstart (`step-snelstart.tsx` — zelfde `PackageSelector`
  + `TemplateSelector`), 1 Klantgegevens & Werkzaamheden, 2 Details per Werkzaamheid,
  3 **Bouwstenen & Pakketten** (extra stap, PRD §2.5a: `berekenCatalogusTotalen` /
  `bouwOfferteBouwsteenRegels` uit `src/lib/bouwsteen-offerte`), 4 Bevestigen
  (page.tsx r119–201).
- `?scope=`/`?klantId=`/`?leadId=`: page.tsx r33–39, voorselectie r94–108.
- 9 onderhoud-scopes: `.../onderhoud/components/constants.ts` (gras, borders, heggen,
  bomen, overig, reiniging, bemesting, gazonanalyse, mollenbestrijding).
- Factoren: `bereikbaarheid` + `achterstalligheid` (laag/gemiddeld/hoog) +
  `tuinOppervlakte` (types.ts r35–36, defaults constants.ts r155–156).

## 4. Templates/sjablonen — wat bestaat al

- **Tabel** `standaardtuinen`: `convex/schema.ts:558–568` — `userId` (leeg = systeem),
  `naam`, `omschrijving`, `type` (aanleg|onderhoud), `scopes[]`, `defaultWaarden`.
- **Backend** `convex/standaardtuinen.ts` (222 r): `list` (systeem+eigen, r19–54),
  `get` (met eigendoms-guard, r57–79), `create` (r82–102), `update` (r105–133),
  `remove` (r136–151), `createOfferteFromTemplate` (r154–222 — maakt direct een
  offerte uit een sjabloon, incl. bereikbaarheid/achterstalligheid-args).
- **Hook** `src/hooks/use-standaardtuinen.ts`: wrapt alle vijf mutations/queries.
- **Opslaan**: `src/components/offerte/save-as-template-dialog.tsx` (172 r) — op het
  offertedetail (`src/app/(dashboard)/offertes/[id]/page.tsx:383`, import r13); slaat
  `offerte.scopes` + `offerte.scopeData` op als sjabloon (r72–73), regels niet.
- **Laden**: alleen via `TemplateSelector` in wizard-stap 0. Er is **geen beheer-UI**
  (lijst/bewerken/verwijderen) en `createOfferteFromTemplate` wordt **nergens in de UI
  aangeroepen** (alleen hook + guard-test `src/__tests__/unit/convex/publieke-functies-guards.test.ts`).

## 5. Regels-editor & minimaal pad "klik → lege offerte"

- **Vrije-offerte-route bestaat al** (PRD §2.5b, "twee routes, één uitgang"):
  - Startscherm `src/app/(dashboard)/offertes/nieuw/vrij/page.tsx` (208 r): kies
    klant (+ `NieuweKlantDialog`) en type (aanleg|onderhoud) → `start()` r64–95:
    `instellingen.getNextOfferteNummer` → `offertes.create` met `bron: "vrij"`,
    `algemeenParams: { bereikbaarheid: "goed" }` → redirect `/offertes/{id}/vrij`.
    NB: leest **geen** `?klantId=` uit de URL — vanuit het klantdossier via tegel V
    gaat de meegegeven klant nu verloren.
  - Editor `src/app/(dashboard)/offertes/[id]/vrij/page.tsx` (157 r): `VrijeRegelEditor`
    + `TekstblokKiezer` + `Overzichtsblok` (`src/components/offerte/vrije-builder/`),
    opslaan via `convex/vrijeOfferte.ts` `updateVrijeRegels` (server-side herberekening,
    `convex/vrijeOfferteBerekening.ts`). Start prima leeg (`regels: []`). Guard r55–59:
    offertes met `bron !== "vrij"` worden teruggestuurd naar `/offertes/{id}`.
- **Wizard-offertes** hebben een eigen regels-editor: `/offertes/[id]/bewerken`
  (`page.tsx`, 464 r, `SortableRegelsTable`) + `offerte-regels-card.tsx` op het detail.
  `offerte-header.tsx:199–200` kiest per `bron` de juiste bewerk-link.
- **`offertes.create`** (`convex/offertes.ts:563–663`): verplicht zijn `type`,
  `offerteNummer`, `klant` (naam/adres/postcode/plaats), `algemeenParams`
  (bereikbaarheid). Optioneel: scopes, scopeData, klantId, leadId, `bron`
  (`wizard`|`vrij`, schema.ts:274–277). Maakt ook versie 1, notificatie en lead-patch
  aan. Offertenummer komt uit `instellingen.getNextOfferteNummer` (client haalt hem
  op vóór create; geen server-side reservering).
- Minimaal pad "klik → lege offerte in editor" is dus al 2 klikken + klantkeuze:
  tegel V → klant kiezen → "Naar de regel-editor". Zonder klantkeuze kan het niet:
  `klant.naam/adres/postcode/plaats` zijn verplicht in de mutation.

## 6. TT-004-randvoorwaarde (`offertes.type`)

- Schema: `convex/schema.ts:152` — exact `aanleg | onderhoud`; zelfde union in
  `offertes.create` (offertes.ts:565) en `standaardtuinen.type` (schema.ts:562).
- Gebruik: 22 bestanden met `type === "aanleg"/"onderhoud"` (o.a. filters
  `src/components/offerte/filters.tsx`, `offerte-row/card/header`, PDF
  `src/components/pdf/offerte-pdf.tsx`, excel-export, portaal-kaarten,
  `convex/analytics.ts`, `convex/projecten.ts`, `convex/acceptatieRegels.ts`,
  projectaanmaak `projecten/nieuw/page.tsx`).
- UI-vrij vs. datamodel: de 8 tegels, `?scope=`-prefill en de hele Snelstart-stap
  zijn puur UI en vrij herindeelbaar; `type`, `bron`, `scopes[]`/`scopeData` en de
  verplichte create-velden zitten aan het datamodel vast. Nieuwe ingangen moeten dus
  altijd op een van de twee types uitkomen (vrij-route vraagt dat expliciet, r156–173
  van nieuw/vrij/page.tsx).

## 7. Slopen vs. hergebruiken voor de drie nieuwe ingangen

**Kan weg / degraderen:**
- Wizard-stap 0 "Snelstart" in beide wizards (aanleg page.tsx r481–501 +
  `handleTemplateSelect/Skip/PackageSelect` r309–365; onderhoud `step-snelstart.tsx`)
  — dode tussenstap zolang `packages.ts` leeg is; ingang 2 ("Los scopes kiezen") kan
  direct op stap 1 starten.
- `PackageSelector` + `src/lib/constants/packages.ts` (hardcoded, leeg) — vervangen
  door db-sjablonen (`standaardtuinen`) in ingang 3.
- De 8-tegel-grid in `new-offerte-dialog.tsx` — vervangen door de dropdown; de
  `?scope=`-prefillroutes en `routeMetKlant` blijven bruikbaar als bestemmingen.

**Herbruikbaar:**
- Ingang 1 (Vrije offerte): `/offertes/nieuw/vrij` + `/offertes/[id]/vrij` +
  `vrije-builder/` + `convex/vrijeOfferte.ts` — compleet; alleen `?klantId=`-support
  toevoegen aan nieuw/vrij/page.tsx.
- Ingang 2 (Los scopes): beide wizards + `?scope=`-mechanisme (aanleg r128–143,
  onderhoud r94–108) — werkt al; scope-selectie-UI van stap 1 kan als losstaand
  keuzescherm dienen.
- Ingang 3 (Templates): `standaardtuinen`-tabel, alle 5 backend-functies,
  `use-standaardtuinen`, `TemplateSelector`, `SaveAsTemplateDialog` en het ongebruikte
  `createOfferteFromTemplate` — alleen een overzicht/beheer-pagina ontbreekt.
- Overal: `ShortcutsProvider`-patroon (klantId-doorgifte), `KlantSelector`,
  `NieuweKlantDialog`, `useWizardAutosave`, `WizardSteps`, `AanlegNavigation`.
