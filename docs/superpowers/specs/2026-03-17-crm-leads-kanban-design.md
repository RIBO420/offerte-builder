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

### Nieuwe tabel: `leadActiviteiten`

| Veld | Type | Beschrijving |
|------|------|-------------|
| `leadId` | `Id<"leads">` | Referentie naar lead |
| `type` | `status_wijziging \| notitie \| toewijzing \| offerte_gekoppeld \| aangemaakt` | Type activiteit |
| `beschrijving` | `string` | Leesbare beschrijving |
| `gebruikerId` | `Id<"users">` | Wie de actie heeft uitgevoerd |
| `metadata` | `object?` | Extra data (bijv. `{ van: "nieuw", naar: "contact_gehad" }` of `{ offerteId: "..." }`) |
| `createdAt` | `number` | Timestamp |

Index: `by_lead` op `leadId` (gesorteerd op `createdAt` desc)

### Wijziging in `offertes`-tabel

| Veld | Type | Beschrijving |
|------|------|-------------|
| `leadId` | `Id<"leads">?` | Optionele koppeling aan lead |

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
| `leads.create` | Nieuwe lead (handmatig of configurator) |
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

1. Zoek bestaande klant op e-mailadres
2. Indien gevonden: koppel via `gekoppeldKlantId`
3. Indien niet gevonden: maak nieuwe klant aan met lead-gegevens
4. Activiteitenlog entry: "Klant aangemaakt" of "Gekoppeld aan bestaande klant"

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

## Buiten scope (YAGNI)

- Geen aparte analytics/rapportage pagina
- Geen bulk-acties op leads
- Geen automatische e-mail/sms vanuit de app
- Geen lead-scoring of prioritering
- Geen Gantt/timeline view
- Geen integratie met externe CRM tools

## Technische keuzes

- **Drag & drop**: `@dnd-kit/core` + `@dnd-kit/sortable` (lightweight, React-native, accessible)
- **Kanban rendering**: Virtualized kolommen zijn niet nodig bij verwacht volume (< 100 actieve leads)
- **Activiteitenlog**: Aparte tabel ipv array-in-document (schaalbaarder, makkelijker te queryen)
- **Optimistic updates**: Drag & drop past UI direct aan, rollback bij fout
