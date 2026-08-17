# Onderhoudscontracten & SLA-beheer — Technisch Ontwerp

## 1. Overzicht

**Scope referentie:** 3.9 Onderhoudscontracten & SLA-beheer
**Prioriteit:** P1
**Status:** NOT STARTED (zie scope-compliance.md MOD-009)

Beheer van terugkerende onderhoudscontracten voor klanten van Top Tuinen. Contracten defini&euml;ren werkzaamheden per seizoen (voorjaar, zomer, herfst, winter), genereren automatisch planningitems per seizoen, en worden per termijn (maandelijks/kwartaal/jaarlijks) gefactureerd. Contracten worden automatisch verlengd tenzij opgezegd, met jaarlijkse tariefindexatie.

**Afhankelijkheden op bestaande modules:**
- `klanten` — contracten worden gekoppeld aan een klant
- `facturen` — termijnfacturen worden gegenereerd via bestaande facturatielogica
- `planningTaken` / `weekPlanning` — seizoenswerk wordt ingepland via bestaande planning
- `instellingen` — bedrijfsgegevens en factuurinstellingen
- `notifications` — meldingen bij verlopen contracten en opzegtermijnen

---

## 2. Schema Design

### 2.1 Tabel: `onderhoudscontracten`

Hoofdtabel voor contractregistratie. Volgt het bestaande patroon met `userId` ownership en standaard timestamps.

```typescript
onderhoudscontracten: defineTable({
  userId: v.id("users"),
  klantId: v.id("klanten"),

  // Contractidentificatie
  contractNummer: v.string(), // Bijv. "OHC-2026-001"
  naam: v.string(), // Beschrijvende naam, bijv. "Jaaronderhoud Familie De Vries"

  // Locatiegegevens (kan afwijken van klantadres)
  locatie: v.object({
    adres: v.string(),
    postcode: v.string(),
    plaats: v.string(),
    notities: v.optional(v.string()), // Bijv. "Achterom links, hek code 1234"
  }),

  // Looptijd
  startDatum: v.string(), // YYYY-MM-DD (consistent met weekPlanning, urenRegistraties)
  eindDatum: v.string(), // YYYY-MM-DD
  opzegtermijnDagen: v.number(), // Bijv. 30 of 90 dagen

  // Financieel
  tariefPerTermijn: v.number(), // Bedrag excl. BTW per betalingstermijn
  betalingsfrequentie: v.union(
    v.literal("maandelijks"),
    v.literal("per_kwartaal"),
    v.literal("halfjaarlijks"),
    v.literal("jaarlijks")
  ),
  jaarlijksTarief: v.number(), // Berekend totaaltarief per jaar excl. BTW

  // Indexatie
  indexatiePercentage: v.optional(v.number()), // Bijv. 3.5 voor 3,5% jaarlijkse verhoging
  laatsteIndexatieDatum: v.optional(v.string()), // YYYY-MM-DD

  // Status
  status: v.union(
    v.literal("concept"),       // Nog niet actief
    v.literal("actief"),        // Lopend contract
    v.literal("verlopen"),      // Einddatum bereikt, niet verlengd
    v.literal("opgezegd"),      // Door klant of bedrijf opgezegd
    v.literal("verlengd")       // Automatisch verlengd (wordt weer "actief")
  ),

  // Verlenging
  autoVerlenging: v.boolean(), // Automatisch verlengen bij einddatum
  verlengingsPeriodeInMaanden: v.optional(v.number()), // Bijv. 12 maanden

  // Opmerkingen
  notities: v.optional(v.string()),
  voorwaarden: v.optional(v.string()), // Contractspecifieke voorwaarden

  // Soft delete & archiving (consistent met offertes/projecten)
  isArchived: v.optional(v.boolean()),
  archivedAt: v.optional(v.number()),
  deletedAt: v.optional(v.number()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_klant", ["klantId"])
  .index("by_status", ["status"])
  .index("by_user_status", ["userId", "status"])
  .index("by_einddatum", ["eindDatum"]) // Voor expiring contracts query
  .index("by_contractnummer", ["contractNummer"])
```

### 2.2 Tabel: `contractWerkzaamheden`

Werkzaamheden per contract, gegroepeerd per seizoen. Elke rij beschrijft een type werk dat in een bepaald seizoen moet worden uitgevoerd.

```typescript
contractWerkzaamheden: defineTable({
  contractId: v.id("onderhoudscontracten"),

  // Werkzaamheid
  omschrijving: v.string(), // Bijv. "Gazon maaien", "Hagen snoeien"
  scope: v.optional(v.string()), // Link naar onderhoud scope type: "gras_onderhoud", "heggen", etc.

  // Seizoen & frequentie
  seizoen: v.union(
    v.literal("voorjaar"),  // maart - mei
    v.literal("zomer"),     // juni - augustus
    v.literal("herfst"),    // september - november
    v.literal("winter")     // december - februari
  ),
  frequentie: v.number(), // Aantal keer per seizoen, bijv. 6x maaien in zomer
  frequentieEenheid: v.optional(v.union(
    v.literal("per_seizoen"),
    v.literal("per_maand"),
    v.literal("per_week")
  )),

  // Ureninschatting
  geschatteUrenPerBeurt: v.number(), // Uren per uitvoering
  geschatteUrenTotaal: v.number(),   // geschatteUrenPerBeurt * frequentie

  // Volgorde voor planning
  volgorde: v.number(),

  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
})
  .index("by_contract", ["contractId"])
  .index("by_contract_seizoen", ["contractId", "seizoen"])
```

### 2.3 Tabel: `contractFacturen`

Koppeltabel tussen contracten en de gegenereerde facturen per termijn.

```typescript
contractFacturen: defineTable({
  contractId: v.id("onderhoudscontracten"),
  factuurId: v.optional(v.id("facturen")), // Kan null zijn als factuur nog niet gegenereerd
  userId: v.id("users"),

  // Termijninformatie
  termijnNummer: v.number(), // 1, 2, 3, ... volgnummer
  periodeStart: v.string(), // YYYY-MM-DD
  periodeEinde: v.string(), // YYYY-MM-DD
  bedrag: v.number(), // Bedrag excl. BTW voor deze termijn

  // Status
  status: v.union(
    v.literal("gepland"),      // Termijn staat klaar, factuur nog niet gemaakt
    v.literal("gefactureerd"), // Factuur is aangemaakt
    v.literal("betaald")       // Factuur is betaald
  ),

  createdAt: v.number(),
})
  .index("by_contract", ["contractId"])
  .index("by_factuur", ["factuurId"])
  .index("by_user", ["userId"])
  .index("by_status", ["status"])
  .index("by_contract_status", ["contractId", "status"])
```

### 2.4 Uitbreiding bestaand schema

De `facturen` tabel krijgt een optioneel veld voor contractkoppeling:

```typescript
// Toevoegen aan facturen tabel:
contractId: v.optional(v.id("onderhoudscontracten")),
contractTermijnId: v.optional(v.id("contractFacturen")),
```

De `klanten` tabel `pipelineStatus` union krijgt "onderhoud" (bestaat al).

---

## 3. API Design

### 3.1 Queries

```typescript
// convex/onderhoudscontracten.ts

// Lijst alle contracten voor ingelogde gebruiker
export const list = query({
  args: {
    status: v.optional(v.union(
      v.literal("concept"), v.literal("actief"),
      v.literal("verlopen"), v.literal("opgezegd")
    )),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => { /* ... */ }
});

// Haal contract op met alle werkzaamheden en factuurhistorie
export const getById = query({
  args: { id: v.id("onderhoudscontracten") },
  handler: async (ctx, args) => {
    // Haalt contract + contractWerkzaamheden + contractFacturen op
    // Verrijkt met klantgegevens via klantId
  }
});

// Alle contracten voor een specifieke klant
export const getByKlant = query({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => { /* ... */ }
});

// Werkzaamheden die in de komende 30 dagen moeten worden ingepland
export const getUpcomingWork = query({
  args: {
    dagenVooruit: v.optional(v.number()), // default 30
  },
  handler: async (ctx, args) => {
    // Filter actieve contracten
    // Bepaal huidig seizoen
    // Return werkzaamheden die nog niet zijn ingepland
  }
});

// Contracten die binnen X dagen verlopen
export const getExpiringContracts = query({
  args: {
    dagenVooruit: v.optional(v.number()), // default 90
  },
  handler: async (ctx, args) => {
    // Filter op eindDatum < now + dagenVooruit
    // Sorteer op eindDatum ascending
  }
});

// Dashboard statistieken
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    // Totaal actieve contracten
    // Totale jaarlijkse contractwaarde
    // Contracten die binnenkort verlopen (30/60/90 dagen)
    // Openstaande termijnfacturen
  }
});

// Paginated list voor grote datasets
export const listPaginated = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => { /* cursor-based pagination */ }
});
```

### 3.2 Mutations

```typescript
// Contract aanmaken
export const create = mutation({
  args: {
    klantId: v.id("klanten"),
    naam: v.string(),
    locatie: v.object({ adres: v.string(), postcode: v.string(), plaats: v.string(), notities: v.optional(v.string()) }),
    startDatum: v.string(),
    eindDatum: v.string(),
    opzegtermijnDagen: v.number(),
    tariefPerTermijn: v.number(),
    betalingsfrequentie: v.union(/* ... */),
    indexatiePercentage: v.optional(v.number()),
    autoVerlenging: v.boolean(),
    verlengingsPeriodeInMaanden: v.optional(v.number()),
    werkzaamheden: v.array(v.object({
      omschrijving: v.string(),
      scope: v.optional(v.string()),
      seizoen: v.union(/* ... */),
      frequentie: v.number(),
      geschatteUrenPerBeurt: v.number(),
    })),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // requireNotViewer(ctx)
    // Genereer contractNummer (OHC-YYYY-NNN)
    // Insert contract + werkzaamheden
    // Genereer termijnfactuur-planning (contractFacturen met status "gepland")
    // Upgrade klant pipelineStatus naar "onderhoud"
  }
});

// Contract bijwerken (alleen concept/actief)
export const update = mutation({
  args: { id: v.id("onderhoudscontracten"), /* updateable fields */ },
  handler: async (ctx, args) => { /* ... */ }
});

// Contract verlengen
export const renewContract = mutation({
  args: {
    id: v.id("onderhoudscontracten"),
    nieuwEindDatum: v.string(),
    nieuwTarief: v.optional(v.number()), // Optioneel aangepast tarief
  },
  handler: async (ctx, args) => {
    // Zet status naar "actief"
    // Update eindDatum
    // Genereer nieuwe termijnfacturen
  }
});

// Contract opzeggen
export const cancelContract = mutation({
  args: {
    id: v.id("onderhoudscontracten"),
    opzegDatum: v.string(),
    reden: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Valideer opzegtermijn
    // Zet status naar "opgezegd"
    // Annuleer nog niet-gefactureerde termijnen
  }
});

// Jaarlijkse tariefindexatie doorvoeren
export const indexTarieven = mutation({
  args: {
    contractIds: v.optional(v.array(v.id("onderhoudscontracten"))), // Leeg = alle actieve
    percentage: v.number(),
  },
  handler: async (ctx, args) => {
    // Verhoog tariefPerTermijn en jaarlijksTarief
    // Registreer indexatieDatum
    // Update toekomstige geplande termijnen
  }
});

// Werkzaamheden toevoegen/wijzigen/verwijderen
export const addWerkzaamheid = mutation({ /* ... */ });
export const updateWerkzaamheid = mutation({ /* ... */ });
export const removeWerkzaamheid = mutation({ /* ... */ });
```

### 3.3 Actions (scheduled / complex)

```typescript
// Genereer seizoensplanning: maakt planningTaken aan voor elk seizoen
export const generateSeizoenPlanning = action({
  args: {
    contractId: v.id("onderhoudscontracten"),
    seizoen: v.union(v.literal("voorjaar"), v.literal("zomer"), v.literal("herfst"), v.literal("winter")),
  },
  handler: async (ctx, args) => {
    // Haal contractWerkzaamheden voor dit seizoen
    // Maak planningTaken aan (via ctx.runMutation)
    // Elke werkzaamheid wordt een taak die in weekPlanning kan worden ingepland
  }
});

// Genereer termijnfactuur voor komende periode
export const generateTermijnFactuur = action({
  args: {
    contractFactuurId: v.id("contractFacturen"),
  },
  handler: async (ctx, args) => {
    // Haal contractFactuur + contract + klant op
    // Genereer factuur via facturen.generate patroon
    // Update contractFactuur met factuurId en status "gefactureerd"
  }
});

// Scheduled: check dagelijks op verlopen contracten en opzegtermijnen
// Registreer als cron in convex/crons.ts
export const checkContractDeadlines = action({
  handler: async (ctx) => {
    // Contracten die vandaag verlopen -> status "verlopen" (of auto-verlengen)
    // Opzegtermijn-meldingen: 90, 30, 7 dagen voor einddatum
    // Notificaties via bestaande notifications module
  }
});
```

---

## 4. UI Design

### 4.1 Routes

| Route | Component | Beschrijving |
|-------|-----------|--------------|
| `/contracten` | `ContractenPage` | Overzicht van alle contracten met tabs per status |
| `/contracten/[id]` | `ContractDetailPage` | Detailpagina met werkzaamheden, facturen, verlenging |
| `/contracten/nieuw` | `NieuwContractPage` | Wizard voor nieuw contract aanmaken |

### 4.2 `/contracten` — Overzichtspagina

**Layout:** Volgt het patroon van `projecten/page.tsx`:
- `PageHeader` met titel "Contracten" en actieknop "Nieuw Contract"
- `Tabs` component met tabs: Alle | Actief | Concept | Verlopen | Opgezegd
- Zoekbalk met `useDebounce` (300ms)
- `ScrollableTable` met kolommen:
  - Contractnummer
  - Klant (naam + locatie)
  - Looptijd (startDatum - eindDatum)
  - Tarief (jaarlijks)
  - Status (Badge met kleurcodering)
  - Volgende termijn (datum + bedrag)
- `FilterPresetSelector` voor snelfilters
- `ExportDropdown` voor Excel/PDF export
- Statistieken bovenaan:
  - Totaal actieve contracten
  - Totale jaarwaarde
  - Contracten die binnenkort verlopen
  - Openstaande termijnen

**Statuskleurcodes (WCAG AA):**
- concept: `bg-gray-200 text-gray-800`
- actief: `bg-green-200 text-green-800`
- verlopen: `bg-red-200 text-red-800`
- opgezegd: `bg-orange-200 text-orange-800`

### 4.3 `/contracten/[id]` — Detailpagina

**Layout:** Twee-koloms layout:

**Linkerkolom (2/3 breedte):**
- Contract header: contractnummer, klantnaam, status badge
- **Werkzaamheden per seizoen:** Accordion/tabs met 4 seizoenen
  - Per seizoen: tabel met werkzaamheden, frequentie, geschatte uren
  - Knop "Werkzaamheid toevoegen" per seizoen
  - Knop "Genereer seizoensplanning" -> maakt planningTaken aan
- **Factuurhistorie:** Tabel met alle termijnfacturen
  - Kolommen: termijn, periode, bedrag, status, factuurlink
  - Knop "Genereer volgende factuur" bij geplande termijnen

**Rechterkolom (1/3 breedte):**
- Contractinformatie card: looptijd, tarief, betalingsfrequentie
- Klantinformatie card: naam, adres, contactgegevens (link naar klant)
- Acties card:
  - "Contract verlengen" (bij actief/verlopen)
  - "Tarieven indexeren"
  - "Contract opzeggen" (met bevestigingsdialog)
  - "Bewerken" (bij concept)
- Timeline: recente wijzigingen

### 4.4 `/contracten/nieuw` — Wizard

**Stappen (vergelijkbaar met offerte wizard):**

1. **Klant selecteren** — Zoek bestaande klant of maak nieuwe aan
2. **Locatie** — Adresgegevens (prefill vanuit klant, aanpasbaar)
3. **Werkzaamheden per seizoen** — Voor elk seizoen werkzaamheden defini&euml;ren
   - Omschrijving, frequentie, geschatte uren per beurt
   - Mogelijkheid om onderhoudstemplates te laden (vanuit standaardtuinen type "onderhoud")
4. **Tarieven & betaling** — Tariefberekening, betalingsfrequentie, indexatie
   - Automatische berekening op basis van totale uren x uurtarief + materiaalkosten
   - Of handmatig tarief per termijn invoeren
5. **Contractgegevens** — Looptijd, opzegtermijn, automatische verlenging
6. **Overzicht & bevestiging** — Samenvatting met alle gegevens

**UI componenten:**
- Hergebruik `WizardStepper` patroon (custom hook `useContractWizard`)
- React Hook Form + Zod validatie per stap
- Werkzaamheden form hergebruikt deels de onderhoud scope forms

---

## 5. Integratiepunten

### 5.1 Klantmodule
- Contract wordt gekoppeld aan klant via `klantId`
- Klant detail pagina (`/klanten/[id]`) toont sectie "Onderhoudscontracten"
- Bij contract aanmaak: `upgradeKlantPipeline(ctx, klantId, "onderhoud")`

### 5.2 Planningmodule
- `generateSeizoenPlanning` maakt `planningTaken` aan met type "onderhoud"
- Onderhoudstaken verschijnen in weekPlanning als inplanbare items
- Kleurcodering in planning: onderhoud = blauw (conform scope 3.5)

### 5.3 Facturatiemodule
- `generateTermijnFactuur` maakt een factuur aan via het bestaande `facturen` patroon
- Factuur krijgt `contractId` en `contractTermijnId` als referentie
- Factuurtype: "regulier" met automatisch gegenereerde regels uit contract

### 5.4 Notificaties
- Cron job `checkContractDeadlines` stuurt meldingen via bestaande `notifications` module
- Meldingtypen: "contract_verloopt", "opzegtermijn_nadert", "termijn_factureren"

### 5.5 Rapportages
- Dashboard card: totale contractwaarde, groei t.o.v. vorig jaar
- Rapportages pagina: contractomzet per maand/kwartaal

### 5.6 Offerte onderhoud
- Mogelijkheid om een geaccepteerde onderhoud-offerte om te zetten naar een contract
- "Converteer naar contract" knop op offerte detail pagina (type=onderhoud, status=geaccepteerd)

---

## 6. Complexiteit

### Geschatte bestanden

| Categorie | Bestanden | Details |
|-----------|-----------|---------|
| **Convex** | 3 | `onderhoudscontracten.ts`, uitbreiding `schema.ts`, uitbreiding `crons.ts` |
| **Pages** | 3 | `/contracten/page.tsx`, `/contracten/[id]/page.tsx`, `/contracten/nieuw/page.tsx` |
| **Components** | 8-10 | Contract-table, contract-detail-tabs, werkzaamheden-form, seizoen-accordion, termijn-tabel, contract-wizard (stappen), contract-stats-cards, contract-status-badge |
| **Hooks** | 1-2 | `useContractWizard`, `useContractStats` |
| **Loading** | 2 | Skeleton loaders voor overzicht en detail |
| **Sidebar** | 1 | Uitbreiding `app-sidebar.tsx` met "Contracten" link |
| **Totaal** | ~18-21 | |

### Geschatte ontwikkeltijd

- **Sprint 1 (week 1-2):** Schema + Convex functies (queries, mutations) + basis CRUD
- **Sprint 2 (week 3-4):** Overzichtspagina + detailpagina + werkzaamheden per seizoen
- **Sprint 3 (week 5):** Wizard nieuw contract + seizoensplanning generatie
- **Sprint 4 (week 6):** Termijnfacturatie + cron jobs + integraties + testen

**Totaal: ~6 weken (3 sprints van 2 weken)**

### Afhankelijkheden
- Facturen module moet werkend zijn (is het al)
- Planning module moet werkend zijn (is het al)
- Notifications module moet meldingen kunnen versturen (is het al)

### Risico's
- **Seizoenslogica:** Het bepalen van welk seizoen "nu" is en welke werkzaamheden ingepland moeten worden vereist zorgvuldige datumlogica
- **Automatische verlenging:** Race conditions bij cron jobs die gelijktijdig contracten verlengen en facturen genereren
- **Tariefindexatie:** Bij bulkindexatie moeten alle gerelateerde termijnen correct herberekend worden
- **Migratie:** Als er bestaande onderhoud-offertes zijn die eigenlijk contracten hadden moeten zijn, is migratie nodig
