# Garantiebeheer & Servicemeldingen — Technisch Ontwerp

## 1. Overzicht

**Scope referentie:** 3.10 Garantiebeheer & Servicemeldingen
**Prioriteit:** P2
**Status:** NOT STARTED (zie scope-compliance.md MOD-010)

Na oplevering van een aanlegproject loopt een garantieperiode (standaard 1 jaar). Tijdens deze periode kunnen klanten klachten indienen die kosteloos worden afgehandeld. Na de garantieperiode worden serviceverzoeken doorbelast. Het systeem registreert alle meldingen, koppelt ze aan het oorspronkelijke project, en plant servicebezoeken in.

**Verschil met bestaand `garantiePakketten`:**
De bestaande `garantiePakketten` tabel in het schema is bedoeld voor offerte-niveau garantietiers (bijv. "Basis 1 jaar", "Premium 3 jaar") die als upsell op de offerte worden aangeboden. Dit ontwerp gaat over de operationele garantie-tracking na projectoplevering: wanneer gaat de garantie in, wanneer verloopt deze, en hoe worden servicemeldingen afgehandeld.

**Afhankelijkheden op bestaande modules:**
- `projecten` — garantie wordt automatisch aangemaakt bij status "afgerond"/"nacalculatie_compleet"
- `klanten` — servicemeldingen zijn gekoppeld aan klanten
- `facturen` — betaalde serviceverzoeken (buiten garantie) worden gefactureerd
- `planningTaken` / `weekPlanning` — serviceafspraken worden ingepland
- `notifications` — meldingen bij verlopen garanties en nieuwe meldingen
- `fotoStorage` — foto's bij servicemeldingen
- `onderhoudscontracten` (nieuw) — onderhoudscontracten kunnen ook servicemeldingen genereren

---

## 2. Schema Design

### 2.1 Tabel: `garanties`

Garantieregistratie per opgeleverd project. Wordt automatisch aangemaakt wanneer een project de status "afgerond" of "nacalculatie_compleet" bereikt.

```typescript
garanties: defineTable({
  userId: v.id("users"),
  projectId: v.id("projecten"),
  klantId: v.id("klanten"),
  offerteId: v.optional(v.id("offertes")), // Link naar oorspronkelijke offerte

  // Garantieperiode
  startDatum: v.string(), // YYYY-MM-DD (= opleverdatum project)
  eindDatum: v.string(),  // YYYY-MM-DD (= startDatum + garantiePeriode)
  garantiePeriodeInMaanden: v.number(), // Standaard 12, kan afwijken per garantiepakket

  // Status
  status: v.union(
    v.literal("actief"),    // Binnen garantieperiode
    v.literal("verlopen"),  // Garantieperiode verstreken
    v.literal("vervallen")  // Voortijdig be&euml;indigd (bijv. door klantactie)
  ),

  // Garantievoorwaarden
  voorwaarden: v.optional(v.string()), // Specifieke voorwaarden/beperkingen
  garantiePakketId: v.optional(v.id("garantiePakketten")), // Link naar garantiepakket van offerte

  // Scope van garantie (welke werkzaamheden vallen eronder)
  dekkingScopes: v.optional(v.array(v.string())), // ["bestrating", "gras", "borders", ...]

  // Tracking
  laatsteMeldingAt: v.optional(v.number()), // Timestamp van laatste servicemelding
  aantalMeldingen: v.optional(v.number()), // Totaal aantal meldingen

  // Soft delete
  deletedAt: v.optional(v.number()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_project", ["projectId"])
  .index("by_klant", ["klantId"])
  .index("by_status", ["status"])
  .index("by_user_status", ["userId", "status"])
  .index("by_einddatum", ["eindDatum"]) // Voor expiring garanties queries
```

### 2.2 Tabel: `servicemeldingen`

Klachten en serviceverzoeken van klanten, al dan niet gekoppeld aan een garantie.

```typescript
servicemeldingen: defineTable({
  userId: v.id("users"),
  klantId: v.id("klanten"),
  projectId: v.optional(v.id("projecten")), // Link naar oorspronkelijk project
  garantieId: v.optional(v.id("garanties")), // Alleen als binnen garantieperiode
  contractId: v.optional(v.id("onderhoudscontracten")), // Als melding via onderhoudscontract

  // Meldingnummer
  meldingNummer: v.string(), // Bijv. "SVM-2026-001"

  // Inhoud
  onderwerp: v.string(), // Korte beschrijving
  beschrijving: v.string(), // Uitgebreide beschrijving van het probleem
  categorie: v.optional(v.union(
    v.literal("bestrating"),    // Verzakte tegels, losse klinkers
    v.literal("beplanting"),    // Dode planten, ziekte
    v.literal("gazon"),         // Kale plekken, onkruid
    v.literal("houtwerk"),      // Rotte planken, losse schutting
    v.literal("waterafvoer"),   // Drainage problemen
    v.literal("verlichting"),   // Defecte tuinverlichting
    v.literal("overig")
  )),

  // Garantie of betaald
  isGarantie: v.boolean(), // true = kosteloos, false = doorbelasten
  garantieBeoordeeld: v.optional(v.boolean()), // Of beoordeling is gedaan
  garantieAfwijzingsReden: v.optional(v.string()), // Als isGarantie=false maar klant claimt garantie

  // Status workflow: nieuw -> in_behandeling -> ingepland -> afgehandeld
  status: v.union(
    v.literal("nieuw"),           // Zojuist binnengekomen
    v.literal("in_behandeling"),  // Wordt beoordeeld
    v.literal("ingepland"),       // Servicebezoek is ingepland
    v.literal("in_uitvoering"),   // Medewerker is bezig
    v.literal("afgehandeld"),     // Klacht is opgelost
    v.literal("afgewezen")        // Melding afgewezen (bijv. geen garantie, eigen schuld)
  ),

  // Prioriteit
  prioriteit: v.union(
    v.literal("laag"),     // Kan wachten
    v.literal("normaal"),  // Standaard
    v.literal("hoog"),     // Snel oppakken
    v.literal("spoed")     // Directe actie vereist
  ),

  // Foto's
  fotoIds: v.optional(v.array(v.id("_storage"))), // Convex file storage IDs

  // Afhandeling
  oplossing: v.optional(v.string()), // Beschrijving van uitgevoerde werkzaamheden
  afgehandeldDoor: v.optional(v.string()), // Naam medewerker
  afgehandeldAt: v.optional(v.number()),

  // Kosten (bij niet-garantie serviceverzoeken)
  geschatteKosten: v.optional(v.number()), // Inschatting vooraf
  werkelijkeKosten: v.optional(v.number()), // Na afhandeling
  factuurId: v.optional(v.id("facturen")), // Link naar gegenereerde factuur

  // Contact info (wie heeft gemeld)
  gemeldDoor: v.optional(v.string()), // Naam persoon
  gemeldVia: v.optional(v.union(
    v.literal("telefoon"),
    v.literal("email"),
    v.literal("app"),       // Toekomstig klantportaal
    v.literal("persoonlijk")
  )),

  // Soft delete
  deletedAt: v.optional(v.number()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_klant", ["klantId"])
  .index("by_project", ["projectId"])
  .index("by_garantie", ["garantieId"])
  .index("by_contract", ["contractId"])
  .index("by_status", ["status"])
  .index("by_user_status", ["userId", "status"])
  .index("by_prioriteit", ["userId", "prioriteit"])
  .index("by_meldingnummer", ["meldingNummer"])
  .searchIndex("search_meldingen", {
    searchField: "onderwerp",
    filterFields: ["userId", "status", "klantId"],
  })
```

### 2.3 Tabel: `serviceAfspraken`

Ingeplande servicebezoeken gekoppeld aan een melding.

```typescript
serviceAfspraken: defineTable({
  meldingId: v.id("servicemeldingen"),
  userId: v.id("users"),

  // Planning
  datum: v.string(), // YYYY-MM-DD
  tijdVan: v.optional(v.string()), // HH:MM (optioneel tijdslot)
  tijdTot: v.optional(v.string()),

  // Toegewezen medewerkers
  medewerkerIds: v.array(v.id("medewerkers")),

  // Details
  notities: v.optional(v.string()), // Instructies voor het team
  benodigdMateriaal: v.optional(v.array(v.string())), // Wat meenemen

  // Status
  status: v.union(
    v.literal("gepland"),
    v.literal("bevestigd"),  // Klant is ge&iuml;nformeerd
    v.literal("uitgevoerd"),
    v.literal("geannuleerd")
  ),

  // Na uitvoering
  resultaat: v.optional(v.string()), // Wat is er gedaan
  bestedeUren: v.optional(v.number()),
  fotoIds: v.optional(v.array(v.id("_storage"))), // Na-foto's

  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
})
  .index("by_melding", ["meldingId"])
  .index("by_user", ["userId"])
  .index("by_datum", ["datum"])
  .index("by_status", ["status"])
```

---

## 3. API Design

### 3.1 Garantie Queries & Mutations

```typescript
// convex/garanties.ts

// === QUERIES ===

// Lijst alle actieve garanties
export const getActiveGaranties = query({
  args: {},
  handler: async (ctx) => {
    // Filter op status "actief"
    // Verrijkt met klant- en projectnaam
  }
});

// Garanties die binnenkort verlopen (30/60/90 dagen)
export const getExpiringGaranties = query({
  args: {
    dagenVooruit: v.optional(v.number()), // Default 90
  },
  handler: async (ctx, args) => {
    // Filter actieve garanties met eindDatum < now + dagenVooruit
    // Sorteer op eindDatum ascending
    // Groepeer per tijdvenster: <30 dagen, 30-60 dagen, 60-90 dagen
  }
});

// Garantie detail met alle servicemeldingen
export const getById = query({
  args: { id: v.id("garanties") },
  handler: async (ctx, args) => {
    // Haal garantie + project + klant + offerte op
    // Haal servicemeldingen gekoppeld aan deze garantie
    // Bereken resterende garantieperiode
  }
});

// Garantie opzoeken voor een project
export const getByProject = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => { /* ... */ }
});

// Dashboard statistieken
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    // Totaal actieve garanties
    // Verlopend deze maand
    // Openstaande servicemeldingen
    // Gemiddelde afhandeltijd meldingen
  }
});

// === MUTATIONS ===

// Automatisch garantie aanmaken bij projectoplevering
// Wordt aangeroepen vanuit projecten.updateStatus als status -> "afgerond"
export const createFromProject = mutation({
  args: {
    projectId: v.id("projecten"),
    garantiePeriodeInMaanden: v.optional(v.number()), // Default 12
  },
  handler: async (ctx, args) => {
    // Haal project en offerte op
    // Bepaal garantieperiode (uit garantiepakket of default 12 maanden)
    // Bereken eindDatum
    // Insert garantie
    // Upgrade klant pipelineStatus naar "opgeleverd"
  }
});

// Garantie handmatig aanpassen (bijv. verlenging als goodwill)
export const update = mutation({
  args: {
    id: v.id("garanties"),
    eindDatum: v.optional(v.string()),
    voorwaarden: v.optional(v.string()),
    dekkingScopes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => { /* ... */ }
});
```

### 3.2 Servicemelding Queries & Mutations

```typescript
// convex/servicemeldingen.ts

// === QUERIES ===

// Lijst meldingen met filters (voor kanban board)
export const list = query({
  args: {
    status: v.optional(v.string()),
    klantId: v.optional(v.id("klanten")),
    projectId: v.optional(v.id("projecten")),
    prioriteit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Filter op status/klant/project/prioriteit
    // Verrijkt met klant- en projectnaam
  }
});

// Meldingen per klant (voor klant detail pagina)
export const getByKlant = query({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => { /* ... */ }
});

// Meldingen per project
export const getByProject = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => { /* ... */ }
});

// Melding detail met afspraken en foto's
export const getById = query({
  args: { id: v.id("servicemeldingen") },
  handler: async (ctx, args) => {
    // Haal melding + serviceAfspraken + klant + project + garantie op
    // Haal foto URLs op via storage
  }
});

// Paginated list
export const listPaginated = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => { /* ... */ }
});

// === MUTATIONS ===

// Nieuwe servicemelding registreren
export const createMelding = mutation({
  args: {
    klantId: v.id("klanten"),
    projectId: v.optional(v.id("projecten")),
    onderwerp: v.string(),
    beschrijving: v.string(),
    categorie: v.optional(v.string()),
    prioriteit: v.union(v.literal("laag"), v.literal("normaal"), v.literal("hoog"), v.literal("spoed")),
    fotoIds: v.optional(v.array(v.id("_storage"))),
    gemeldDoor: v.optional(v.string()),
    gemeldVia: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // requireNotViewer
    // Genereer meldingNummer (SVM-YYYY-NNN)
    // Check of actieve garantie bestaat voor project
    //   Ja -> isGarantie = true, koppel garantieId
    //   Nee -> isGarantie = false
    // Als garantie verlopen: toon waarschuwing "Garantie verlopen — doorbelasten?"
    // Insert melding met status "nieuw"
    // Update garantie.aantalMeldingen en laatsteMeldingAt
  }
});

// Status bijwerken (voor kanban drag-and-drop)
export const updateMeldingStatus = mutation({
  args: {
    id: v.id("servicemeldingen"),
    status: v.union(/* alle statussen */),
  },
  handler: async (ctx, args) => {
    // Valideer status transitie
    // Bij "afgehandeld": vereist oplossing (beschrijving)
    // Update status + updatedAt
  }
});

// Melding bijwerken
export const updateMelding = mutation({
  args: {
    id: v.id("servicemeldingen"),
    // Updateable velden
    onderwerp: v.optional(v.string()),
    beschrijving: v.optional(v.string()),
    prioriteit: v.optional(v.string()),
    isGarantie: v.optional(v.boolean()),
    oplossing: v.optional(v.string()),
    werkelijkeKosten: v.optional(v.number()),
  },
  handler: async (ctx, args) => { /* ... */ }
});

// Serviceafspraak inplannen
export const planServiceAfspraak = mutation({
  args: {
    meldingId: v.id("servicemeldingen"),
    datum: v.string(),
    tijdVan: v.optional(v.string()),
    tijdTot: v.optional(v.string()),
    medewerkerIds: v.array(v.id("medewerkers")),
    notities: v.optional(v.string()),
    benodigdMateriaal: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Insert serviceAfspraak
    // Update melding status naar "ingepland"
    // Optioneel: maak weekPlanning entries aan voor medewerkers
  }
});

// Afspraak afronden
export const completeAfspraak = mutation({
  args: {
    afspraakId: v.id("serviceAfspraken"),
    resultaat: v.string(),
    bestedeUren: v.number(),
    fotoIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    // Update afspraak met resultaat
    // Update melding: oplossing, afgehandeldDoor, afgehandeldAt
    // Zet melding status naar "afgehandeld"
  }
});
```

### 3.3 Actions

```typescript
// Scheduled: check dagelijks op verlopen garanties
export const checkGarantieDeadlines = action({
  handler: async (ctx) => {
    // Garanties waar eindDatum < vandaag en status = "actief" -> status "verlopen"
    // Meldingen bij 30, 7, 1 dag voor verloop
    // Notificaties naar admin/directie
  }
});

// Stuur bevestigingsmail naar klant bij servicemelding
export const sendMeldingBevestiging = action({
  args: { meldingId: v.id("servicemeldingen") },
  handler: async (ctx, args) => {
    // Haal melding + klant op
    // Stuur bevestigingsmail via Resend (bestaand email patroon)
    // "Uw melding SVM-2026-001 is ontvangen en wordt in behandeling genomen"
  }
});

// Stuur garantie-verloop notificatie aan klant
export const sendGarantieExpiryNotification = action({
  args: { garantieId: v.id("garanties") },
  handler: async (ctx, args) => {
    // Informeer klant dat garantie binnenkort verloopt
    // Bied eventueel verlengd onderhoudscontract aan
  }
});
```

---

## 4. UI Design

### 4.1 Routes

| Route | Component | Beschrijving |
|-------|-----------|--------------|
| `/garanties` | `GarantiesPage` | Overzicht alle garanties met expiry timeline |
| `/garanties/[id]` | `GarantieDetailPage` | Detail met servicemeldingen |
| `/servicemeldingen` | `ServicemeldingenPage` | Kanban board voor meldingen |
| `/servicemeldingen/[id]` | `MeldingDetailPage` | Melding detail met afspraken |

### 4.2 `/garanties` — Overzichtspagina

**Layout:** Vergelijkbaar met `projecten/page.tsx`:

**Header sectie:**
- `PageHeader` "Garanties" met knop "Melding registreren"
- 3-4 KPI cards:
  - Actieve garanties (totaal)
  - Verloopt binnen 30 dagen (oranje als > 0)
  - Openstaande meldingen (rood als > 0)
  - Gem. afhandeltijd (dagen)

**Garantie timeline:**
- Horizontale timeline visualisatie gegroepeerd per maand
- Elke garantie als horizontale balk van start tot eind
- Kleurcodering: groen = >3 maanden resterend, oranje = <3 maanden, rood = <1 maand
- Huidige datum als verticale lijn
- Click op balk -> navigeer naar detail

**Alternatief: tabelweergave** (toggle)
- Kolommen: Project, Klant, Start, Einde, Resterend, Meldingen, Status
- Sorteerbaar op elke kolom
- Filter op status (actief/verlopen)

### 4.3 `/garanties/[id]` — Detailpagina

**Layout:** Twee-koloms:

**Linkerkolom (2/3):**
- Garantie header: project naam, klant, status badge, resterende periode
- Voorwaarden card (indien aanwezig)
- Dekking: lijst van gedekte scopes met checkmarks
- **Servicemeldingen tabel:** Alle meldingen gekoppeld aan deze garantie
  - Kolommen: nummer, onderwerp, status, datum, prioriteit
  - Knop "Nieuwe melding" -> dialog of navigatie naar melding formulier

**Rechterkolom (1/3):**
- Projectinformatie card (link naar project)
- Klantinformatie card (link naar klant)
- Garantie countdown: grote weergave van resterende dagen/maanden
- Acties: "Garantie verlengen", "Melding registreren"

### 4.4 `/servicemeldingen` — Kanban board

**Layout:** Volgt het bestaande kanban patroon uit `leads/kanban-board.tsx`:

**Kolommen (drag-and-drop):**
1. **Nieuw** — Zojuist binnengekomen meldingen
2. **In behandeling** — Worden beoordeeld/onderzocht
3. **Ingepland** — Servicebezoek staat gepland
4. **Afgehandeld** — Opgelost

**Per melding kaart:**
- Meldingnummer + onderwerp
- Klantnaam
- Prioriteit badge (kleurgecodeerd)
- Garantie/betaald label
- Datum gemeld
- Toegewezen medewerker(s) als avatar(s)

**Filters boven kanban:**
- Zoekbalk
- Prioriteit filter
- Garantie/betaald filter
- Klant filter
- Datumbereik

### 4.5 `/servicemeldingen/[id]` — Melding detail

**Layout:**
- Melding header: nummer, onderwerp, status, prioriteit
- Klant & project informatie
- Beschrijving (volledige tekst)
- Foto gallery (voor/na)
- Garantie indicator: "Valt onder garantie (kosteloos)" of "Buiten garantie (doorbelasten EUR XX)"
- **Serviceafspraken:** Timeline van geplande en uitgevoerde bezoeken
  - Per afspraak: datum, medewerkers, notities, resultaat
- **Acties:**
  - "Afspraak inplannen" -> dialog met datumkiezer en medewerker selectie
  - "Beoordeling garantie" -> toggle isGarantie + reden
  - "Afhandelen" -> vereist oplossing beschrijving
  - "Factuur aanmaken" (bij niet-garantie, na afhandeling)

### 4.6 Quick-add melding dialog

Bereikbaar vanuit:
- `/klanten/[id]` detail pagina -> knop "Servicemelding"
- `/garanties/[id]` detail pagina -> knop "Nieuwe melding"
- `/servicemeldingen` kanban -> knop "Nieuwe melding"

**Dialog velden:**
- Klant (auto-ingevuld als vanuit klant detail)
- Project (dropdown van projecten van deze klant)
- Onderwerp
- Beschrijving
- Categorie (dropdown)
- Prioriteit
- Foto's (upload via bestaande fotoStorage)
- Gemeld door / gemeld via

---

## 5. Integratiepunten

### 5.1 Projecten module
- **Auto-create garantie:** Wanneer project status -> "afgerond" of "nacalculatie_compleet":
  ```typescript
  // In convex/projecten.ts updateStatus mutation:
  if (newStatus === "afgerond" || newStatus === "nacalculatie_compleet") {
    await ctx.runMutation(internal.garanties.createFromProject, {
      projectId: args.id,
    });
  }
  ```
- Project detail pagina toont garantie-status card
- Project detail pagina toont servicemeldingen sectie

### 5.2 Klanten module
- Klant detail pagina toont:
  - Actieve garanties (met resterende periode)
  - Servicemeldingen historie
  - Knop "Servicemelding registreren"
- Klant pipelineStatus: bij oplevering -> "opgeleverd"

### 5.3 Planning module
- Serviceafspraken kunnen weekPlanning entries genereren
- In de weekplanning: servicemeldingen als speciale taken (rode kleur = spoed)

### 5.4 Facturatie module
- Na afhandeling van een niet-garantie melding: knop "Factuur aanmaken"
- Genereert factuur met werkelijke kosten en uren
- Factuur referentie: `servicemeldingId` (nieuw veld op facturen tabel)

### 5.5 Onderhoudscontracten (nieuw)
- Servicemeldingen kunnen ook ontstaan vanuit een onderhoudscontract
- Veld `contractId` op servicemeldingen koppelt aan het contract
- Meldingen vanuit een contract volgen hetzelfde afhandelingsproces
- Kosten van contractgerelateerde meldingen kunnen tegen het contract worden geboekt

### 5.6 Notifications module
- Bij nieuwe servicemelding: notificatie naar admin/projectleider
- Bij spoed-melding: directe push notificatie
- Bij inplannen serviceafspraak: notificatie naar toegewezen medewerkers
- Garantie verloop meldingen: 30, 7, 1 dag vooraf

### 5.7 Email module
- Bevestigingsmail naar klant bij ontvangst melding
- Mail bij inplannen servicebezoek met datum/tijdstip
- Mail bij afhandeling met beschrijving werkzaamheden
- Garantie verloop-notificatie met optioneel aanbod onderhoudscontract

### 5.8 Sidebar navigatie
- Toevoeging in `app-sidebar.tsx`:
  - "Garanties" link met icoon `Shield` (lucide)
  - "Servicemeldingen" link met icoon `Wrench` of `MessageSquareWarning` (lucide)
  - Badge op servicemeldingen met aantal openstaande meldingen

---

## 6. Complexiteit

### Geschatte bestanden

| Categorie | Bestanden | Details |
|-----------|-----------|---------|
| **Convex** | 3-4 | `garanties.ts`, `servicemeldingen.ts`, uitbreiding `schema.ts`, uitbreiding `crons.ts` |
| **Pages** | 4 | `/garanties/page.tsx`, `/garanties/[id]/page.tsx`, `/servicemeldingen/page.tsx`, `/servicemeldingen/[id]/page.tsx` |
| **Components** | 10-12 | garantie-timeline, garantie-stats, garantie-detail-card, melding-kanban-board, melding-kanban-card, melding-form-dialog, melding-detail, service-afspraak-form, service-afspraak-timeline, garantie-indicator-badge, foto-upload-section |
| **Loading** | 3 | Skeleton loaders voor garanties, servicemeldingen, detail |
| **Hooks** | 1-2 | `useServicemeldingenKanban` (drag-and-drop state), `useGarantieStats` |
| **Email** | 2 | `melding-bevestiging-email.tsx`, `garantie-verloop-email.tsx` |
| **Sidebar** | 1 | Uitbreiding `app-sidebar.tsx` |
| **Totaal** | ~24-28 | |

### Geschatte ontwikkeltijd

- **Sprint 1 (week 1-2):** Schema + garanties Convex functies + auto-create bij projectoplevering
- **Sprint 2 (week 3-4):** Servicemeldingen CRUD + kanban board UI
- **Sprint 3 (week 5-6):** Garanties overzicht + detail + timeline visualisatie
- **Sprint 4 (week 7-8):** Serviceafspraken + planning integratie + facturatie link
- **Sprint 5 (week 9):** Email notificaties + cron jobs + testen

**Totaal: ~9 weken (4-5 sprints van 2 weken)**

### Afhankelijkheden
- Projecten module: status workflow moet "afgerond" ondersteunen (doet het al)
- Facturen module: voor service-facturatie (werkend)
- Planning module: voor serviceafspraken in weekPlanning (werkend)
- fotoStorage: voor foto's bij meldingen (werkend)
- Onderhoudscontracten module (nieuw): optionele afhankelijkheid, kan los worden gebouwd

### Risico's
- **Automatische garantie-aanmaak:** Moet robuust omgaan met projecten die meerdere keren van status wisselen (bijv. terug naar "in_uitvoering" en opnieuw "afgerond"). Idempotency check: als garantie al bestaat, niet opnieuw aanmaken.
- **Garantie/betaald beoordeling:** Subjectieve beslissing. UI moet duidelijk maken dat dit een handmatige beoordeling is, niet automatisch. Bij grensgevallen: mogelijkheid om gedeeltelijk door te belasten.
- **Kanban performance:** Bij veel meldingen kan de kanban board traag worden. Implementeer virtualisatie of paginatie per kolom.
- **Foto storage:** Foto's bij meldingen gebruiken Convex file storage. Bij veel meldingen met foto's kan dit opslag-intensief worden. Overweeg compressie of limiet op aantal foto's.
- **Koppeling met onderhoudscontracten:** Als de onderhoud module gelijktijdig wordt gebouwd, moeten schema-beslissingen worden afgestemd. Het `contractId` veld op servicemeldingen kan als optioneel worden toegevoegd en later worden gevuld.
- **Klantportaal (toekomst):** Scope sectie 3.11 noemt dat klanten in de toekomst zelf servicemeldingen kunnen indienen via een portaal. Het schema is hier al op voorbereid via het `gemeldVia: "app"` veld. De API's moeten later uitgebreid worden met publieke endpoints.
