# CRM Leads Kanban — Design Spec

## Doel

De Leads-tab binnen de Klanten-pagina omvormen van een statische kaartjes-view naar een volwaardig CRM-kanban-board met drag & drop, activiteitenlog, en een volledige sales pipeline: Lead → Klant → Offerte → Project.

## Pipeline Kolommen

| Kolom | Kleur | Betekenis |
|-------|-------|-----------|
| Nieuw | Blauw (#3b82f6) | Zojuist binnengekomen, nog geen contact |
| Contact gehad | Geel (#f59e0b) | Eerste contact gelegd (gebeld, gemaild, afspraak) |
| Offerte verstuurd | Paars (#8b5cf6) | Offerte is aangemaakt en verzonden |
| Gewonnen | Groen (#10b981) | Klant akkoord, automatisch klant aangemaakt |
| Verloren | Rood (#ef4444) | Afgewezen of geen interesse, visueel gedempt |

## Datamodel

### Tabel: `leads` (hernoemt en breidt `configuratorAanvragen` uit)

Bestaande velden behouden, plus:

| Veld | Type | Beschrijving |
|------|------|-------------|
| `pipelineStatus` | `nieuw \| contact_gehad \| offerte_verstuurd \| gewonnen \| verloren` | Vervangt het oude `status`-veld |
| `bron` | `configurator_gazon \| configurator_boomschors \| configurator_verticuteren \| handmatig \| telefoon \| email \| doorverwijzing` | Hoe de lead is binnengekomen |
| `verliesReden` | `string?` | Reden bij status "verloren" (verplicht bij die transitie) |
| `gekoppeldKlantId` | `Id<"klanten">?` | Ingevuld bij "Gewonnen" — link naar klanten-tabel |
| `geschatteWaarde` | `number?` | Geschatte waarde voor handmatige leads |
| `omschrijving` | `string?` | Vrije tekst voor handmatige leads |

Bestaande velden die behouden blijven:
- `klantNaam`, `klantEmail`, `klantTelefoon`, `klantAdres`, `klantPostcode`, `klantPlaats`
- `type` (gazon/boomschors/verticuteren) — wordt optioneel voor handmatige leads
- `specificaties`, `indicatiePrijs`, `definitievePrijs`
- `referentie`, `toegewezenAan`, `verificatieNotities`, `notities`
- `betalingId`, `betalingStatus`, `fotoIds`
- `createdAt`, `updatedAt`

Nieuwe indexes:
- `by_pipeline_status` — voor kanban-kolommen
- `by_gekoppeld_klant` — voor klant-detail pagina
- `by_referentie` — voor publieke status-lookup (behouden van bestaande index)

Opmerkingen:
- `referentie` blijft behouden voor publieke status-lookup en betalingen-koppeling
- `toegewezenAan` blijft `Id<"users">` (consistent met huidig schema)
- `type` wordt optioneel (`v.optional`) voor handmatige leads
- Tabel heeft geen `userId` — leads zijn globaal (configurator is unauthenticated). Queries filteren op admin-rol, niet op userId.

### Nieuwe tabel: `leadActiviteiten`

| Veld | Type | Beschrijving |
|------|------|-------------|
| `leadId` | `Id<"leads">` | Referentie naar lead |
| `type` | `status_wijziging \| notitie \| toewijzing \| offerte_gekoppeld \| aangemaakt` | Type activiteit |
| `beschrijving` | `string` | Leesbare beschrijving |
| `gebruikerId` | `Id<"users">` | Wie de actie heeft uitgevoerd |
| `metadata` | `object?` | Extra data (bijv. `{ van: "nieuw", naar: "contact_gehad" }` of `{ offerteId: "..." }`) |
| `createdAt` | `number` | Timestamp |

Index: `by_lead: ["leadId", "createdAt"]` — query gebruikt `.order("desc")` voor nieuwste eerst

### Wijziging in `offertes`-tabel

| Veld | Type | Beschrijving |
|------|------|-------------|
| `leadId` | `Id<"leads">?` | Optionele koppeling aan lead |

Nieuwe index op offertes: `by_leadId: ["leadId"]` — voor efficiënt ophalen van gekoppelde offertes in lead-modal

## Kanban Board UI

### Kaart (compact)

Toont per lead:
- Naam
- Type badge (Gazon/Boomschors/Verticuteren/Handmatig)
- Indicatieprijs of geschatte waarde
- Relatieve datum (2 uur geleden, gisteren, 3 dagen)

Visuele kenmerken:
- Handmatige leads: paarse linkerborder
- Snelknoppen verschijnen bij hover (→ volgende status)
- Kaarten zijn sleepbaar (drag & drop tussen kolommen)
- "Verloren" kolom is visueel gedempt (opacity)

### Pipeline Stats Balk

Onderin het kanban-board, toont:
- Totaal actieve leads
- Totale pipeline waarde (som van indicatieprijzen/geschatte waarden van actieve leads)
- Gewonnen waarde deze maand
- Conversieratio (gewonnen / (gewonnen + verloren) × 100%)

### Drag & Drop Gedrag

- Sleep kaart naar andere kolom → statuswijziging + activiteitenlog entry
- Drag naar "Verloren" → popup voor verliesreden (verplicht)
- Drag naar "Gewonnen" → automatisch klant aanmaken of koppelen aan bestaand e-mailadres

### Transitieregels

| Van | Toegestaan naar | Opmerkingen |
|-----|----------------|-------------|
| Nieuw | Contact gehad, Verloren | Standaard voorwaartse flow |
| Contact gehad | Offerte verstuurd, Nieuw, Verloren | Terug naar Nieuw = heroverweging |
| Offerte verstuurd | Gewonnen, Contact gehad, Verloren | Terug = offerte ingetrokken |
| Gewonnen | — | Niet terug te zetten. Klant is al aangemaakt. |
| Verloren | Nieuw | "Heropenen" — wist `verliesReden`, logt reopen-activiteit |

**Offertes bij "Verloren":** Gekoppelde offertes behouden hun eigen status (geen cascade). Er verschijnt een waarschuwing als er actieve offertes zijn ("Let op: er zijn X openstaande offertes gekoppeld aan deze lead").

## Lead Detail Modal

Twee-kolommen layout die opent bij klik op een kaart.

### Linkerkolom — Lead Informatie

Secties van boven naar beneden:

1. **Header**: Naam, status badge, type badge, snelknop naar volgende status
2. **Contactgegevens**: Email (mailto link), telefoon (tel link), adres + Google Maps link
3. **Specificaties**: Grid met key-value pairs uit configurator data
4. **Prijzen**: Indicatieprijs en definitieve prijs naast elkaar
5. **Offertes**: Lijst van gekoppelde offertes met status, of "Offerte aanmaken" knop
6. **Toewijzing**: Huidige medewerker met avatar/initialen, "Wijzig" knop

### Rechterkolom — Activiteitenlog

- **Notitie invoerveld** bovenaan met "Opslaan" knop
- **Tijdlijn** met gekleurde dots per type:
  - Groen: aangemaakt
  - Blauw: notitie
  - Geel: statuswijziging
  - Paars: toewijzing
  - Indigo: offerte gekoppeld
- Elke entry: wie, wanneer, en eventueel inhoud (notitietekst, oude→nieuwe status)

## Convex Functies

### Queries

| Functie | Beschrijving |
|---------|-------------|
| `leads.listByPipeline` | Alle actieve leads gegroepeerd per pipelineStatus (voor kanban) |
| `leads.get` | Enkele lead met alle details |
| `leads.pipelineStats` | Totalen voor stats balk (counts, waarden, conversieratio) |
| `leads.countNieuw` | Aantal leads met status "nieuw" (voor sidebar badge) |
| `leadActiviteiten.listByLead` | Activiteiten voor een lead (nieuwste eerst) |

### Mutations

| Functie | Beschrijving |
|---------|-------------|
| `leads.createFromConfigurator` | Nieuwe lead vanuit configurator (publiek, geen auth) |
| `leads.create` | Nieuwe lead handmatig (authenticated, admin) |
| `leads.updatePipelineStatus` | Status wijzigen + activiteitenlog entry aanmaken |
| `leads.updateDetails` | Contactgegevens/specificaties bijwerken |
| `leads.toewijzen` | Medewerker toewijzen + activiteitenlog |
| `leads.markGewonnen` | Status → gewonnen, klant aanmaken/koppelen, activiteitenlog |
| `leads.markVerloren` | Status → verloren met verplichte reden, activiteitenlog |
| `leadActiviteiten.addNotitie` | Notitie toevoegen + activiteitenlog entry |

## Nieuwe Lead Formulier (Handmatig)

Modal met velden:
- Naam (verplicht)
- Email
- Telefoon
- Adres, postcode, plaats
- Type werk (vrije tekst of dropdown)
- Geschatte waarde (number)
- Omschrijving (textarea)
- Bron (dropdown: handmatig, telefoon, email, doorverwijzing)

## Navigatie & Integratie

### Pagina-structuur

`/klanten` pagina met twee tabs:
- **Klanten** — bestaande klantentabel
- **Leads** — kanban-board (vervangt huidige kaartjes-view)

### Sidebar

- "Klanten" in primaire navigatie (altijd zichtbaar)
- Badge toont aantal leads met status `nieuw`

### Offerte-koppeling

- "Offerte aanmaken" in lead-modal navigeert naar offerte-wizard met `?leadId=xxx`
- Offerte-wizard vult klantgegevens automatisch in vanuit lead data
- Na aanmaken: offerte `leadId` wordt ingevuld, lead krijgt activiteitenlog entry, pipelineStatus → `offerte_verstuurd`

### Klant-conversie (bij "Gewonnen")

1. Controleer of `klantEmail` aanwezig is
2. Indien email aanwezig: zoek bestaande klant op e-mailadres
3. Indien klant gevonden: koppel via `gekoppeldKlantId`
4. Indien niet gevonden (of geen email): maak nieuwe klant aan met lead-gegevens
5. Activiteitenlog entry: "Klant aangemaakt" of "Gekoppeld aan bestaande klant"

Validatie: `klantNaam` is verplicht voor de "Gewonnen" transitie. Als naam ontbreekt (onwaarschijnlijk maar mogelijk bij handmatige leads), blokkeer de transitie met een melding.

## Migratie

Bestaande `configuratorAanvragen` records worden gemapt:

| Oud (`status`) | Nieuw (`pipelineStatus`) |
|----------------|--------------------------|
| `nieuw` | `nieuw` |
| `in_behandeling` | `contact_gehad` |
| `goedgekeurd` | `gewonnen` |
| `afgekeurd` | `verloren` |
| `voltooid` | `gewonnen` |

Het `type`-veld wordt gemapt naar `bron`:
- `gazon` → `configurator_gazon`
- `boomschors` → `configurator_boomschors`
- `verticuteren` → `configurator_verticuteren`

### Betalingen en publieke status

- De `betalingen`-tabel linkt aan leads via het `referentie`-veld. Dit veld blijft behouden, dus betalingskoppelingen blijven werken.
- Records met `betalingStatus: "open"` worden gemigreerd naar `pipelineStatus: "nieuw"` ongeacht hun oude status. Het betalingsproces loopt onafhankelijk.
- De publieke configurator-statuspagina (`/configurator/status`) gebruikt `getByReferentie`. Deze query wordt behouden op de `leads`-tabel. De statuspagina toont klantgerichte labels (mapping: `nieuw`→"Ontvangen", `contact_gehad`→"In behandeling", `offerte_verstuurd`→"Offerte verstuurd", `gewonnen`→"Geaccepteerd", `verloren`→"Afgewezen").

## Buiten scope (YAGNI)

- Geen aparte analytics/rapportage pagina
- Geen bulk-acties op leads
- Geen automatische e-mail/sms vanuit de app
- Geen lead-scoring of prioritering
- Geen Gantt/timeline view
- Geen integratie met externe CRM tools

## Technische keuzes

- **Drag & drop**: `@dnd-kit/core` + `@dnd-kit/sortable` (reeds geïnstalleerd in project: core@6.x, sortable@10.x)
- **Kanban rendering**: Virtualized kolommen zijn niet nodig bij verwacht volume (< 100 actieve leads)
- **Activiteitenlog**: Aparte tabel ipv array-in-document (schaalbaarder, makkelijker te queryen)
- **Optimistic updates**: Drag & drop past UI direct aan, rollback bij fout
