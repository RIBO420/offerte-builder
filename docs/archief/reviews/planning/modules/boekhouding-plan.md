# Boekhoudkoppeling — Technisch Ontwerp

## 1. Overzicht

**Scope referentie:** 3.14 Boekhoudkoppeling
**Prioriteit:** P1
**Status:** NOT STARTED (zie scope-compliance.md MOD-014)

Integratie met externe boekhoudpakketten zodat facturen, betalingen en inkoopfacturen automatisch worden gesynchroniseerd. Geen dubbele invoer meer. Het systeem begint met Moneybird als eerste provider (meest gebruikte pakket onder Nederlandse MKB/hoveniersbedrijven), met een adapter-architectuur die later Exact Online en Twinfield ondersteunt.

**Afhankelijkheden op bestaande modules:**
- `facturen` — facturen worden gesynchroniseerd naar boekhouding
- `betalingen` (via Mollie) — betalingsstatussen worden doorgezet
- `instellingen` — bedrijfsgegevens en configuratie
- `inkooporders` — inkoopfacturen koppelen aan projecten

**Huidige situatie:**
- De `koppelingen-tab.tsx` in instellingen toont "Binnenkort beschikbaar" placeholder
- Geen API-integratiecode voor enig boekhoudpakket aanwezig
- Geen grootboekmapping, sync-logging of betalingssync

---

## 2. Schema Design

### 2.1 Tabel: `boekhoudInstellingen`

Configuratie per gebruiker/bedrijf voor de boekhoudkoppeling. Bevat provider credentials en mappingconfiguratie.

```typescript
boekhoudInstellingen: defineTable({
  userId: v.id("users"),

  // Provider selectie
  provider: v.union(
    v.literal("moneybird"),
    v.literal("exact_online"),
    v.literal("twinfield"),
    v.literal("geen") // Niet gekoppeld
  ),

  // OAuth / API credentials (encrypted at rest)
  // Moneybird: administrationId + accessToken
  // Exact: divisionCode + accessToken + refreshToken
  administrationId: v.optional(v.string()), // Moneybird administration ID
  accessToken: v.optional(v.string()),      // OAuth access token
  refreshToken: v.optional(v.string()),     // OAuth refresh token
  tokenExpiresAt: v.optional(v.number()),   // Token expiry timestamp

  // Bedrijfs-ID bij provider
  externalBedrijfsId: v.optional(v.string()), // Division/administration ID

  // Synchronisatie-instellingen
  autoSync: v.boolean(), // Automatisch facturen pushen bij verzenden
  syncRichting: v.union(
    v.literal("push"),        // Alleen van ons naar boekhouding
    v.literal("pull"),        // Alleen van boekhouding naar ons
    v.literal("bidirectioneel") // Beide richtingen
  ),

  // Grootboekrekening mappings
  // Map interne categorien naar externe grootboekrekeningen
  grootboekMappings: v.optional(v.array(v.object({
    interneCategorie: v.string(), // "omzet_aanleg", "omzet_onderhoud", "materialen", etc.
    externGrootboekId: v.string(), // ID bij provider
    externGrootboekNaam: v.string(), // Naam voor weergave
    externGrootboekNummer: v.optional(v.string()), // Rekeningnummer
  }))),

  // BTW-codes mapping
  btwMappings: v.optional(v.array(v.object({
    internPercentage: v.number(), // 21, 9, 0
    externBtwId: v.string(), // BTW-code ID bij provider
    externBtwNaam: v.string(),
  }))),

  // Status
  isActief: v.boolean(),
  laatsteSyncAt: v.optional(v.number()),
  laatsteSyncStatus: v.optional(v.union(
    v.literal("success"),
    v.literal("error"),
    v.literal("partial")
  )),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_provider", ["provider"])
```

### 2.2 Tabel: `boekhoudSync`

Synchronisatielogboek per factuur/transactie. Audit trail voor alle sync-operaties.

```typescript
boekhoudSync: defineTable({
  userId: v.id("users"),

  // Interne referentie
  factuurId: v.optional(v.id("facturen")),
  inkooporderId: v.optional(v.id("inkooporders")),
  entityType: v.union(
    v.literal("factuur"),
    v.literal("creditnota"),
    v.literal("betaling"),
    v.literal("inkoopfactuur"),
    v.literal("contact")    // Klant sync
  ),

  // Externe referentie
  externalId: v.optional(v.string()), // ID bij de boekhouding provider
  externalUrl: v.optional(v.string()), // Deep link naar de provider UI

  // Sync status
  syncStatus: v.union(
    v.literal("pending"),     // Wacht op sync
    v.literal("syncing"),     // Bezig met synchroniseren
    v.literal("synced"),      // Succesvol gesynchroniseerd
    v.literal("error"),       // Fout bij synchronisatie
    v.literal("conflict"),    // Conflict tussen systemen
    v.literal("skipped")      // Overgeslagen (bijv. manueel overruled)
  ),
  syncRichting: v.union(v.literal("push"), v.literal("pull")),

  // Error tracking
  errorMessage: v.optional(v.string()),
  errorCode: v.optional(v.string()),
  retryCount: v.optional(v.number()),
  nextRetryAt: v.optional(v.number()),

  // Timestamps
  lastSyncAt: v.optional(v.number()),
  lastSuccessAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_factuur", ["factuurId"])
  .index("by_external", ["externalId"])
  .index("by_status", ["syncStatus"])
  .index("by_user_status", ["userId", "syncStatus"])
  .index("by_entity_type", ["userId", "entityType"])
```

### 2.3 Uitbreiding bestaand schema

De `facturen` tabel krijgt extra velden voor sync tracking:

```typescript
// Toevoegen aan facturen tabel:
externalBookkeepingId: v.optional(v.string()), // ID in boekhoudsysteem
boekhoudSyncStatus: v.optional(v.union(
  v.literal("not_synced"),
  v.literal("synced"),
  v.literal("error"),
  v.literal("pending")
)),
boekhoudSyncAt: v.optional(v.number()),
```

---

## 3. API Design

### 3.1 Provider Adapter Pattern

Een abstracte interface die door elke provider wordt ge&iuml;mplementeerd. Dit leeft als intern TypeScript pattern in `convex/boekhouding/`:

```
convex/boekhouding/
  index.ts              — exports, factory function
  types.ts              — IBoekhoudProvider interface definitie
  moneybird.ts          — Moneybird implementatie
  exact-online.ts       — Exact Online implementatie (fase 2)
  twinfield.ts          — Twinfield implementatie (fase 3)
```

```typescript
// convex/boekhouding/types.ts
interface IBoekhoudProvider {
  // Authenticatie
  getAuthUrl(redirectUri: string): string;
  exchangeCode(code: string): Promise<TokenPair>;
  refreshAccessToken(refreshToken: string): Promise<TokenPair>;

  // Contacten (klanten)
  syncContact(klant: KlantData): Promise<ExternalContact>;
  getContact(externalId: string): Promise<ExternalContact | null>;

  // Facturen
  pushFactuur(factuur: FactuurData): Promise<ExternalInvoice>;
  getFactuurStatus(externalId: string): Promise<InvoiceStatus>;

  // Betalingen
  pushBetaling(factuurExternalId: string, bedrag: number, datum: string): Promise<void>;

  // Grootboekrekeningen
  getGrootboekrekeningen(): Promise<GrootboekRekening[]>;

  // BTW-tarieven
  getBtwTarieven(): Promise<BtwTarief[]>;
}
```

### 3.2 Queries

```typescript
// convex/boekhoudingen.ts

// Haal huidige koppeling configuratie op
export const getInstellingen = query({
  args: {},
  handler: async (ctx) => {
    // Return boekhoudInstellingen voor huidige user
    // Maskeert accessToken/refreshToken (geeft alleen "is_configured" boolean)
  }
});

// Sync status per factuur
export const getSyncStatus = query({
  args: { factuurId: v.id("facturen") },
  handler: async (ctx, args) => {
    // Return laatste boekhoudSync entry voor deze factuur
  }
});

// Alle sync errors (voor foutafhandeling UI)
export const getErrors = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Return boekhoudSync entries met status "error"
    // Geordend op datum, meest recent eerst
  }
});

// Grootboekmapping ophalen
export const getGrootboekMapping = query({
  args: {},
  handler: async (ctx) => {
    // Return de huidige grootboekMappings uit boekhoudInstellingen
  }
});

// Sync logboek (audit trail)
export const getSyncLog = query({
  args: {
    entityType: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Paginated sync log, gefilterd op entityType
  }
});

// BTW overzicht voor kwartaalaangifte
export const getBtwOverzicht = query({
  args: {
    startDatum: v.string(), // YYYY-MM-DD
    eindDatum: v.string(),
  },
  handler: async (ctx, args) => {
    // Groepeer facturen per BTW-percentage
    // Bereken totaal omzet en BTW per tarief
    // Return data geschikt voor BTW-aangifte
  }
});
```

### 3.3 Mutations

```typescript
// Koppeling configureren (na OAuth flow)
export const configureerKoppeling = mutation({
  args: {
    provider: v.union(v.literal("moneybird"), v.literal("exact_online"), v.literal("twinfield")),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    administrationId: v.optional(v.string()),
    externalBedrijfsId: v.optional(v.string()),
    autoSync: v.boolean(),
  },
  handler: async (ctx, args) => {
    // requireNotViewer + admin check
    // Upsert boekhoudInstellingen
    // Test connectie (basic validation)
  }
});

// Koppeling verwijderen
export const verwijderKoppeling = mutation({
  args: {},
  handler: async (ctx) => {
    // Verwijder tokens, zet provider naar "geen"
    // Behoud sync history (audit trail)
  }
});

// Grootboekmapping opslaan
export const mapGrootboek = mutation({
  args: {
    mappings: v.array(v.object({
      interneCategorie: v.string(),
      externGrootboekId: v.string(),
      externGrootboekNaam: v.string(),
      externGrootboekNummer: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    // Update grootboekMappings in boekhoudInstellingen
  }
});

// BTW mapping opslaan
export const mapBtw = mutation({
  args: {
    mappings: v.array(v.object({
      internPercentage: v.number(),
      externBtwId: v.string(),
      externBtwNaam: v.string(),
    })),
  },
  handler: async (ctx, args) => { /* ... */ }
});

// Handmatige sync trigger voor een factuur
export const triggerSync = mutation({
  args: {
    factuurId: v.id("facturen"),
  },
  handler: async (ctx, args) => {
    // Maak boekhoudSync entry met status "pending"
    // Schedule action voor daadwerkelijke sync
  }
});

// Manueel sync resultaat overrulen (bij conflicten)
export const overrideSync = mutation({
  args: {
    syncId: v.id("boekhoudSync"),
    actie: v.union(v.literal("retry"), v.literal("skip"), v.literal("manual")),
  },
  handler: async (ctx, args) => { /* ... */ }
});
```

### 3.4 Actions (HTTP calls naar externe APIs)

```typescript
// Synchroniseer een enkele factuur naar boekhouding
export const syncFactuur = action({
  args: { factuurId: v.id("facturen") },
  handler: async (ctx, args) => {
    // 1. Haal factuur + instellingen + mappings op
    // 2. Instantieer juiste provider adapter
    // 3. Sync klant eerst (als contact nog niet bestaat)
    // 4. Push factuur naar provider
    // 5. Update boekhoudSync record met resultaat
    // 6. Update factuur.externalBookkeepingId
    // Error handling: retry met exponential backoff (max 3x)
  }
});

// Synchroniseer betaling (aangeroepen vanuit Mollie webhook)
export const syncBetaling = action({
  args: {
    factuurId: v.id("facturen"),
    bedrag: v.number(),
    datum: v.string(),
  },
  handler: async (ctx, args) => {
    // Push betalingsregistratie naar boekhoudsysteem
    // Alleen als factuur al gesynchroniseerd is
  }
});

// Bulk synchronisatie (alle ongesynchroniseerde facturen)
export const fullSync = action({
  args: {},
  handler: async (ctx) => {
    // Haal alle facturen met boekhoudSyncStatus != "synced"
    // Sync per factuur (met rate limiting)
    // Report resultaten
  }
});

// OAuth callback handler
export const handleOAuthCallback = action({
  args: {
    provider: v.string(),
    code: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
    // Exchange authorization code for tokens
    // Store tokens via configureerKoppeling mutation
  }
});

// Haal grootboekrekeningen op van provider (voor mapping UI)
export const fetchGrootboekrekeningen = action({
  args: {},
  handler: async (ctx) => {
    // Call provider API
    // Return lijst van beschikbare grootboekrekeningen
  }
});

// Webhook handler: ontvang betalingsupdates van boekhouding
export const webhookHandler = action({
  args: {
    provider: v.string(),
    payload: v.any(), // Raw webhook payload
  },
  handler: async (ctx, args) => {
    // Verify webhook signature
    // Parse payload per provider
    // Update factuur betalingsstatus als betaling is ontvangen
  }
});
```

---

## 4. UI Design

### 4.1 Routes

Geen aparte pagina's nodig. De boekhoudkoppeling leeft in:
- **Instellingen -> Koppelingen tab** (bestaand, nu placeholder)
- **Factuur detail -> Sync status indicator** (uitbreiding)
- **Rapportages -> BTW overzicht** (nieuwe tab/sectie)

### 4.2 Instellingen -> Koppelingen tab (refactor `koppelingen-tab.tsx`)

**Stap 1: Provider selectie**
- 3 kaarten: Moneybird, Exact Online, Twinfield
- Elke kaart toont: logo, naam, "Meest gekozen" badge voor Moneybird
- Klik op kaart -> start OAuth flow (redirect naar provider login)
- Na terugkeer: toon "Verbonden" status met groene checkmark

**Stap 2: Grootboekmapping (na succesvolle verbinding)**
- Tabel met twee kolommen:
  - Links: interne categorie ("Omzet Aanleg", "Omzet Onderhoud", "Materiaalkosten", "BTW Hoog 21%", "BTW Laag 9%")
  - Rechts: dropdown met grootboekrekeningen opgehaald van provider
- "Opslaan" knop

**Stap 3: Sync-instellingen**
- Toggle: "Automatisch facturen synchroniseren bij verzenden"
- Dropdown: syncRichting (push/pull/bidirectioneel)
- Knop: "Volledige synchronisatie starten" (bulk sync)

**Stap 4: Sync log / overzicht**
- Tabel met recente synchronisaties: datum, type, status, foutmelding
- Filter op: factuur/betaling/contact
- "Herhaal" knop bij mislukte syncs

### 4.3 Factuur detail — Sync status indicator

Kleine component op de factuur detail pagina:
- **Niet gesynchroniseerd:** Grijs icoon + "Niet gekoppeld aan boekhouding"
- **Gesynchroniseerd:** Groen vinkje + "Gesynchroniseerd" + link naar provider
- **Fout:** Rood icoon + "Synchronisatie mislukt" + "Herhaal" knop
- **Pending:** Spinner + "Bezig met synchroniseren..."

### 4.4 Rapportages — BTW overzicht

Nieuwe sectie/tab op de rapportages pagina:
- Datumbereik selector (kwartaal presets: Q1, Q2, Q3, Q4)
- Tabel:
  - BTW-tarief | Omzet excl. BTW | BTW bedrag | Totaal incl. BTW
  - 21% | EUR xxx | EUR xxx | EUR xxx
  - 9% | EUR xxx | EUR xxx | EUR xxx
  - 0% | EUR xxx | - | EUR xxx
  - **Totaal** | EUR xxx | EUR xxx | EUR xxx
- Export naar Excel knop
- Disclaimer: "Dit overzicht is indicatief. Raadpleeg uw boekhouder voor de definitieve aangifte."

---

## 5. Integratiepunten

### 5.1 Facturen module
- Na factuur verzenden (status -> "verzonden"): als autoSync aan staat, trigger `syncFactuur` action
- Factuur detail pagina toont sync status component
- Factuur tabel optioneel kolom "Boekhouding" met sync status icoon

### 5.2 Mollie webhook
- Bestaande `src/app/api/mollie/webhook/route.ts` wordt uitgebreid
- Na betalingsbevestiging: trigger `syncBetaling` action als koppeling actief is

### 5.3 Inkooporders
- Inkoopfacturen kunnen ook gesynchroniseerd worden
- Fase 2: automatisch inkoopfacturen matchen met provider-data

### 5.4 Rapportages
- BTW-overzicht haalt data uit facturen tabel
- Optioneel: vergelijking met data uit boekhoudsysteem (reconciliatie)

### 5.5 Moneybird-specifieke integratie (fase 1)

**Moneybird API endpoints die we gebruiken:**

| Actie | Moneybird endpoint | Methode |
|-------|-------------------|---------|
| OAuth | `https://moneybird.com/oauth/authorize` | GET |
| Token exchange | `https://moneybird.com/oauth/token` | POST |
| Contacten | `/api/v2/{admin_id}/contacts` | POST/GET |
| Verkoopfacturen | `/api/v2/{admin_id}/sales_invoices` | POST/GET |
| Betalingen | `/api/v2/{admin_id}/sales_invoices/{id}/payments` | POST |
| Grootboekrekeningen | `/api/v2/{admin_id}/ledger_accounts` | GET |
| BTW-tarieven | `/api/v2/{admin_id}/tax_rates` | GET |
| Webhooks | `/api/v2/{admin_id}/webhooks` | POST |

**OAuth flow:**
1. Redirect user naar `https://moneybird.com/oauth/authorize?client_id=X&redirect_uri=Y&response_type=code`
2. User logt in bij Moneybird en geeft toestemming
3. Redirect terug naar `/api/boekhouding/callback?code=Z`
4. Server exchanged code voor access token + refresh token
5. Sla tokens op in `boekhoudInstellingen`

### 5.6 Next.js API routes

```
src/app/api/boekhouding/
  callback/route.ts    — OAuth callback handler
  webhook/route.ts     — Webhook ontvanger van provider
```

---

## 6. Complexiteit

### Geschatte bestanden

| Categorie | Bestanden | Details |
|-----------|-----------|---------|
| **Convex** | 5 | `boekhoudingen.ts` (queries/mutations), `boekhouding/index.ts`, `boekhouding/types.ts`, `boekhouding/moneybird.ts`, uitbreiding `schema.ts` |
| **API routes** | 2 | `api/boekhouding/callback/route.ts`, `api/boekhouding/webhook/route.ts` |
| **UI Components** | 5-7 | `koppelingen-tab.tsx` (refactor), `provider-card.tsx`, `grootboek-mapping-form.tsx`, `sync-status-indicator.tsx`, `sync-log-table.tsx`, `btw-overzicht.tsx` |
| **Totaal** | ~14-16 | |

### Geschatte ontwikkeltijd

- **Sprint 1 (week 1-2):** Schema + provider adapter interface + Moneybird OAuth flow
- **Sprint 2 (week 3-4):** Factuur sync (push) + contact sync + sync logging
- **Sprint 3 (week 5-6):** UI: koppelingen tab refactor + grootboekmapping + sync status
- **Sprint 4 (week 7):** Betaling sync + Mollie integratie + BTW overzicht
- **Sprint 5 (week 8):** Error handling + retry logic + bulk sync + testen

**Totaal: ~8 weken (4 sprints van 2 weken)**

### Aanbevolen volgorde providers

1. **Moneybird** (fase 1) — Meest gebruikte pakket bij Nederlandse hoveniersbedrijven en MKB. Goede API documentatie. OAuth 2.0. Webhooks beschikbaar.
2. **Exact Online** (fase 2) — Veel gebruikt bij grotere bedrijven met boekhouder. Complexere API. Vereist division-based access.
3. **Twinfield** (fase 3) — Accountancy-gericht. Complexe SOAP-achtige API. Alleen bouwen als klant hier specifiek om vraagt.

### Afhankelijkheden
- Facturen module moet volledig werkend zijn (is het al)
- Mollie webhook moet operationeel zijn (route bestaat)
- Moneybird developer account nodig (API key, OAuth app registratie)
- Vercel environment variables voor OAuth client_id / client_secret

### Risico's
- **Token expiry:** Moneybird tokens verlopen na ~2 uur. Refresh logic moet robuust zijn met retry.
- **Rate limiting:** Moneybird limiteert op 150 requests/5 min. Bulk sync moet pacing implementeren.
- **Data mapping:** Grootboekrekeningen en BTW-codes wijken per bedrijf af. UI moet flexibele mapping bieden.
- **Credential security:** OAuth tokens in Convex database. Convex encrypt data at rest, maar extra aandacht voor access control nodig. Tokens alleen zichtbaar voor admin users.
- **Webhook betrouwbaarheid:** Moneybird webhooks kunnen falen. Periodieke reconciliatie-check nodig als fallback.
- **API wijzigingen:** Externe API's kunnen wijzigen. Adapter pattern maakt impact beheersbaar.
