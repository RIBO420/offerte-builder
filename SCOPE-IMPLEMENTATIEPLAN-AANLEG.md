# Scope & Implementatieplan — Offertebuilder Aanlegmodule

> Gebaseerd op: Meeting aanleg Yannick (22 feb 2026) + Codebase-analyse

---

## 1. Huidige Staat vs. Gewenste Staat

### Wat al gebouwd is

| Feature | Status | Toelichting |
|---------|--------|-------------|
| Google Maps adresverificatie | ✅ Klaar | Geïntegreerd in klantgegevens |
| Aanleg wizard (7 scopes) | ✅ Klaar | Grondwerk, bestrating, borders, gras, houtwerk, water/elektra, specials |
| Onderhoud wizard (5 scopes) | ✅ Klaar | Gras, borders, heggen, bomen, overig |
| Automatische prijsberekening | ✅ Klaar | Calculator met normuren, correctiefactoren, marges |
| Klantenbeheer | ✅ Klaar | CRUD + koppeling aan offertes |
| Prijsboek | ✅ Klaar | Producten met inkoop/verkoopprijs |
| PDF generatie & email | ✅ Klaar | React-PDF + Resend |
| Publieke deellinks | ✅ Klaar | Token-based met handtekening |
| Versiegeschiedenis | ✅ Klaar | Volledige audit trail |
| Projectbeheer + voorcalculatie | ✅ Klaar | Team planning, uren, nacalculatie |
| Facturatie | ✅ Klaar | Factuur genereren vanuit project |
| Wagenpark & medewerkers | ✅ Klaar | Voertuigen, certificeringen |
| Analytics & rapportages | ✅ Klaar | Dashboard met charts |

### Wat nieuw gebouwd moet worden

Hieronder alle wensen uit de meeting, gegroepeerd in werkpakketten.

---

## 2. Werkpakketten

### WP1: Verbeterde Algemene Parameters

**Prioriteit: Hoog** | **Geschatte effort: 3-5 dagen**

De huidige `algemeenParams` bevat tuinOppervlakte, bereikbaarheid, achterstalligheid en complexiteit. De meeting vraagt om uitbreidingen:

**Nieuwe parameters:**
- **Klantvriendelijkheid** — Score/beoordeling communicatie (makkelijk ↔ moeilijk). Beïnvloedt marge-advies ("bruine klant" vs. risico-klant).
- **Afstand van loods** — Afstand in km van bedrijfspand naar klantlocatie. Automatisch berekenen via Google Maps Distance Matrix API op basis van klantadres.
- **Tuintypologie** — Categorisatie: kleine stadstuin (20-50m²), normale huistuin (50-200m²), middensegment (200-500m²), luxe tuin (500-1000m²), landgoed (1000m²+). Wordt afgeleid van tuinOppervlakte maar kan handmatig worden overschreven.
- **Type werkzaamheden** — Filter die bepaalt welke scopes beschikbaar zijn (bijv. "alleen aanleg, geen keramische tegels").

**Technisch:**
- Convex schema uitbreiden: `algemeenParams` in `convex/validators.ts` + `convex/schema.ts`
- Frontend: uitbreiden `AanlegKlantScopesStep.tsx` met nieuwe velden
- Calculator: correctiefactoren koppelen aan klantvriendelijkheid en afstand
- Google Maps Distance Matrix integratie voor automatische afstandsberekening

---

### WP2: Bestrating — Automatische Funderingsberekening

**Prioriteit: Hoog** | **Geschatte effort: 5-8 dagen**

Kernwens: het bestratingtype (pad / oprit / terrein) bepaalt automatisch de funderingsopbouw.

**Nieuw systeem:**

```
Bestratingtype  →  Gebroken Puin  →  Zand/Straatzand  →  Brekerszand  →  Stabiliser
─────────────────────────────────────────────────────────────────────────────────────
Pad             →  10 cm          →  5 cm straatzand   →  —            →  —
Oprit           →  20 cm          →  Brekerszand        →  Optioneel    →  —
Terrein/Loods   →  30-40 cm       →  Brekerszand        →  Ja           →  Ja (cement)
```

**Nieuw: "Add Border" knop**
- Meerdere bestratingtypen in één project combineren (bijv. voorkant klinkers + achterkant tegels + rand waaltjes)
- Elke "zone" heeft eigen type, oppervlakte en funderingsberekening

**Voorbouw-pakketten:**
- Standaard combinaties met foto's (bijv. "Tegels + waaltjes rand")
- Klant kiest visueel uit voorgedefinieerde combinaties

**Technisch:**
- Bestrating scope-form uitbreiden met bestratingtype-selector (pad/oprit/terrein)
- Automatische funderingslaagberekening als afgeleide van type
- Multi-zone bestrating: `zones: Array<{ type, oppervlakte, materiaal }>` in scopeData
- Calculator aanpassen: materiaalkosten per laag berekenen (puin, zand, brekerszand, stabiliser)
- Foto-upload systeem voor pakketten via Convex file storage
- UI: visuele pakket-selector met afbeeldingen

---

### WP3: Afvoerkosten — Leverancier-gekoppelde Berekening

**Prioriteit: Hoog** | **Geschatte effort: 5-7 dagen**

Automatische berekening van grondafvoer op basis van locatie.

**Systeem:**
1. Klantlocatie (Google Maps) → bepaal dichtstbijzijnde afvalverwerker
2. Bepaal dichtstbijzijnde transportbedrijf
3. Kies goedkoopste combinatie: kosten per ton + transportafstand
4. Standaard marge: +€75 op klikmelding

**Technisch:**
- Nieuwe Convex tabel: `afvalverwerkers` (naam, adres, lat/lng, tariefPerTon, contactinfo)
- Nieuwe Convex tabel: `transportbedrijven` (naam, adres, lat/lng, kmTarief)
- Google Maps Distance Matrix API voor routeberekening
- Calculator: automatisch goedkoopste optie selecteren
- Klikmelding-tracking: €50 basis + €75 marge als standaard offerte-opstartkost
- Leverancier-beheer pagina uitbreiden (bestaande `/leveranciers` route)

---

### WP4: Borders & Beplanting — Uitbreiding met Oriëntatie

**Prioriteit: Middel** | **Geschatte effort: 5-7 dagen**

**Nieuw:**
- Per border: oppervlakte, planttype, bodemsoort invoeren
- Google Earth / Maps integratie: automatisch noord/zuid/oost/west bepalen op basis van adres
- Zonlicht-informatie → aanbevolen plantsoorten (schaduwminnend vs. zonminnend)
- Bodemverbetering: bestaande grond verbeteren vs. volledig nieuw (mix zand + compost + teelaard)
- Bemestingsschema: 150 dagen basis, daarna upsell-mogelijkheid

**Technisch:**
- Border scope-form uitbreiden met oriëntatie-selector (auto + handmatig override)
- Nieuwe Convex tabel: `plantsoorten` (naam, type, lichtbehoefte, bodemvoorkeur, prijs)
- Bodemverbetering als sub-module in borders met materiaalberekening
- Bemestingsschema als add-on optie met automatische herinnering-setup

---

### WP5: Gras — Uitgebreide Opties

**Prioriteit: Middel** | **Geschatte effort: 3-5 dagen**

**Nieuwe opties naast bestaand:**
- Grassoden (duur, direct effect) — al in calculator
- Zaaien (goedkoper, groeifase) — al in calculator
- Kunstgras (premium) — **nieuw**
- Opsluitbanden (ja/nee)
- Drainage: PVC-buizen met kokos — **nieuw**
- Bestaand gras verticuteren (ja/nee) — **nieuw**
- Before/after foto's per optie — **nieuw**

**Technisch:**
- Gras scope-form uitbreiden met kunstgras-optie + bijbehorende prijzen
- Drainage sub-module met PVC-berekening (meters + materiaal)
- Opsluitbanden berekening (lopende meters)
- Foto-galerij component voor visuele vergelijking

---

### WP6: Houtwerk — Leverancierskoppeling & Configurator

**Prioriteit: Middel** | **Geschatte effort: 5-7 dagen**

**Per type houtwerk (schutting, vlonder, pergola, tuinhuisje):**
- Directe links naar leveranciers-websites
- Configurator: breedte, lengte, hoogte, daktype, etc.
- Eigen brochure/pakketten met foto's
- Marge-focus: alleen standaard types waar marge goed is

**Technisch:**
- Houtwerk scope-form uitbreiden met configurator per type
- Leverancier-koppeling: URL + product-ID per houtwerk-item
- Product-pakketten systeem: voorgedefinieerde houtwerk-bundels
- Foto-upload voor eigen brochure/catalogus

---

### WP7: Garantie- & Verzekeringspakketten

**Prioriteit: Middel** | **Geschatte effort: 3-4 dagen**

**3-tier model:**
- **Basis:** 5 jaar standaard garantie
- **Premium:** Uitgebreide garantie + nazorg
- **Premium Plus:** Extended garantie + callbacks (bijv. 3x per jaar)

**Technisch:**
- Nieuwe Convex tabel: `garantiePakketten` (naam, duur, callbacks, prijs, beschrijving)
- Garantieselectie toevoegen als stap in aanleg-wizard (na scope details, voor review)
- Garantiekosten integreren in offerte-totalen
- Garantievoorwaarden als PDF-bijlage bij offerte

---

### WP8: Standaard Tuinpakketten (3-tier)

**Prioriteit: Hoog** | **Geschatte effort: 4-6 dagen**

**Concept:** Klant kiest uit voorgedefinieerde pakketten in plaats van alles zelf samen te stellen.

```
BASIS (lokprijs)          COMFORT (mid-range)       PREMIUM (all-in)
─────────────────────     ─────────────────────     ─────────────────────
20m² gras                 30m² gras + verlichting   40m² gras + premium
40m² bestrating           40m² bestrating           50m² bestrating
40m² border               50m² border + betere      60m² border + premium
                          planten                    planten
                                                    Jacuzzi + extended
                                                    nazorg
```

**Strategie:** Basis laag geprijsd (lokken), add-ons met hoge marge.

**Technisch:**
- Uitbreiding bestaande `standaardtuinen` tabel met tier-systeem
- Pakket-selector component met visuele vergelijking (3 kolommen)
- Automatisch scopes en scopeData vullen bij pakketselectie
- Per tuintypologie (WP1) andere pakket-presets tonen

---

### WP9: Online Klant-Configurator (Self-Service)

**Prioriteit: Laag (Fase 2)** | **Geschatte effort: 15-20 dagen**

**Concept:** Klanten vullen zelf online in en betalen een aanbetaling.

**Voor gazonleggen:**
- Klantgegevens, adres (voorrijkosten), foto upload, poortbreedte, geschatte m²
- Directe prijs + boekingsmogelijkheid + aanbetaling

**Voor boomschors:**
- Adres, soort boomschors, levering op basis van afstand, online prijs

**Voor verticuteren:**
- Zelfde principe, inclusief beschikbaarheidscontrole

**Verificatie-systeem:**
1. Klant vult calculator in + aanbetaling
2. Ons team controleert via Google Maps + foto's
3. Na goedkeuring → definitieve boeking

**Technisch:**
- Nieuwe publieke routes: `/configurator/gazon`, `/configurator/boomschors`, `/configurator/verticuteren`
- Betalingsintegratie (Mollie/Stripe voor aanbetaling)
- Foto-upload door klant (Convex file storage)
- Beschikbaarheidscheck tegen planning-systeem
- Verificatie-workflow in admin dashboard
- Instructievideo-links voor correcte metingen
- Algemene voorwaarden acceptatie met checkbox

---

### WP10: Mobiele App — Opname & Auto-samenvatting

**Prioriteit: Laag (Fase 2)** | **Geschatte effort: 15-20 dagen**

**Concept:** Tablet-app die hoveniers meenemen naar klanten.

**Functionaliteiten:**
- Gekoppeld aan email/website (klantgegevens al ingevuld)
- Opname-functie: video of dictafoon van gesprek
- Auto-samenvatting van opname (AI-transcriptie)
- Bestaande situatie vastleggen: foto's van huidige tuin
- Privacy-melding aan klant

**Technisch:**
- Er bestaat al een `/mobile` directory met React Native basis
- Audio/video opname via device API
- AI transcriptie via Whisper API of Claude
- Auto-samenvatting naar scopeData mapping
- Foto-capture met geotagging
- Offline-modus met sync bij verbinding

---

### WP11: Automatische Bevestigingsmail & Planning

**Prioriteit: Middel** | **Geschatte effort: 3-5 dagen**

**Trigger:** Klant vult contactformulier in.

**Email bevat:**
- Datumvoorstellen (Calendly-integratie)
- Uitleg werkproces
- Link naar afspraak inplannen
- Checkbox: "Ik bevestig dat ik alle informatie heb gelezen"
- Disclaimer werkwijze

**Technisch:**
- Nieuwe email template in `src/components/email/`
- Calendly API integratie of embed-link
- Bevestigings-tracking in klant-record
- Webhook: contactformulier → auto-email → planning-koppeling

---

### WP12: Water & Elektra — Verlichting als Add-on

**Prioriteit: Laag** | **Geschatte effort: 2-3 dagen**

**Nieuw:**
- Verlichtingsplan als apart verkoopbaar add-on
- Waterleidingen/elektra: diepte-eis ≥60cm (vorstvrij)
- Garantie-voorwaarde: correct geïnstalleerd = garantie geldig
- Info-tips in app

**Technisch:**
- Water/elektra scope-form uitbreiden met verlichtingsplan-module
- Diepte-validatie toevoegen
- Info-tooltip component met waarschuwingen

---

### WP13: Onderhoud — Uitgebreide Calculators

**Prioriteit: Middel** | **Geschatte effort: 8-12 dagen**

Uitbreidingen van het bestaande onderhoudssysteem:

**A) Grasonderhoud verbetering:**
- Kantjes steken (als standaard aanbod)
- Verticuteren (1x/jaar aanbevolen, huurkosten machine ~€80/dag)
- Bijzaaien optie
- Wekelijks vs. 2-wekelijks
- Robotmaaier verkoopoptie

**B) Borderonderhoud verbetering:**
- Onkruid-factor schaal 1-5
- Onkruidsoorten specifiek

**C) Haagonderhoud (nieuw detailniveau):**
- Lengte × hoogte × breedte × diepte berekening
- Haagsoort (liguster/beuk = sneller; taxus/conifeer = moeilijker)
- Hoogte-bepaling: veiligheidsrisico's, hoogwerker nodig?
- Wat staat eronder? (bestrating, border, grind, etc.)

**D) Boomonderhoud (nieuw detailniveau):**
- Groottecategorieën: 0-4m, 4-10m, 10-20m
- Veiligheid per hoogte → hoogwerker nodig?
- Afstand tot straat (transport)
- Boominspectie (normaal vs. gecertificeerd)

**E) Reinigingswerkzaamheden (nieuw):**
- Terrasreiniging (keramisch, beton, klinkers)
- Bladruimen
- Onkruidbestrijding bestrating
- Hogedrukspuit-akkoord (digitaal formulier)

**F) Bemesting (apart):**
- 70% marge product
- Aparte selectie met upsell-focus

**G) Gazonanalyse & Herstel:**
- Beoordeling + moshoeveelheid + schaduw-analyse
- Herstelpad: verticuteren, nieuwe grasmat, of graszaai

**H) Vaste planten snoeien (voorjaarsbeurt):**
- Afzetten hortensia's, hosta's, siergrassen
- Als onderdeel van voorjaarsbeurt-pakket

**I) Mollenbestrijding:**
- 3-tier pakketten (basis/premium/premium plus)
- Geen garantie-communicatie
- Marketing-hoek: "X mollen dit jaar verplaatst"

**Technisch:**
- Onderhoud scope-forms uitbreiden per categorie
- Nieuwe scopes toevoegen: reiniging, bemesting, gazonanalyse, mollenbestrijding
- Calculator aanpassen voor nieuwe parameters
- Seizoensbeurt-pakket als bundel-optie
- Kortingslogica: 15% voor compleet onderhoudspakket

---

## 3. Fasering & Roadmap

### Fase 1: Foundation (Week 1-4)
Focus op uitbreidingen van bestaande functionaliteit.

| Week | Werkpakket | Wat |
|------|-----------|-----|
| 1 | WP1 | Verbeterde algemene parameters + tuintypologie |
| 1-2 | WP2 | Bestrating funderingsberekening + multi-zone |
| 2-3 | WP3 | Afvoerkosten leverancierskoppeling |
| 3-4 | WP8 | Standaard tuinpakketten (3-tier) |

**Deliverable Fase 1:** Aanleg-wizard met intelligentere berekeningen, automatische fundering, en kant-en-klare pakketten.

### Fase 2: Enrichment (Week 5-8)
Verrijking van scope-modules.

| Week | Werkpakket | Wat |
|------|-----------|-----|
| 5 | WP4 | Borders + oriëntatie + bodemverbetering |
| 5-6 | WP5 | Gras uitbreidingen (kunstgras, drainage) |
| 6-7 | WP6 | Houtwerk configurator + leveranciers |
| 7-8 | WP7 | Garantiepakketten |

**Deliverable Fase 2:** Volledige aanleg-module met alle scope-uitbreidingen en garantiesysteem.

### Fase 3: Onderhoud & Workflow (Week 9-14)
Onderhoudscalculators + communicatie-workflow.

| Week | Werkpakket | Wat |
|------|-----------|-----|
| 9-11 | WP13 | Onderhoud uitgebreide calculators |
| 11-12 | WP11 | Bevestigingsmail + Calendly |
| 12-13 | WP12 | Water/elektra add-on |
| 13-14 | Testing + bugfixes | Integratie-testen |

**Deliverable Fase 3:** Compleet onderhoudssysteem + geautomatiseerde klant-communicatie.

### Fase 4: Self-Service & Mobiel (Week 15-22)
Klant-facing tools en mobiele app.

| Week | Werkpakket | Wat |
|------|-----------|-----|
| 15-18 | WP9 | Online klant-configurator + betaling |
| 19-22 | WP10 | Mobiele app opname & samenvatting |

**Deliverable Fase 4:** Klanten kunnen zelf boeken en betalen; hoveniers hebben een tablet-app voor ter plaatse.

---

## 4. Technische Architectuur — Impact

### Database uitbreidingen (Convex)

**Nieuwe tabellen:**
- `afvalverwerkers` — locatie, tarieven afvalverwerkers
- `transportbedrijven` — locatie, km-tarieven
- `plantsoorten` — planten met licht/bodem-voorkeur
- `garantiePakketten` — garantie tiers met voorwaarden
- `configuratorAanvragen` — self-service aanvragen met status
- `betalingen` — aanbetaling tracking (Mollie/Stripe)

**Uitbreidingen bestaande tabellen:**
- `offertes.algemeenParams` — klantvriendelijkheid, afstandVanLoods, tuintypologie, typeWerkzaamheden
- `offertes.scopeData.bestrating` — bestratingtype, funderingslagen, zones[]
- `offertes.scopeData.borders` — orientatie, bodemverbetering, bemestingsschema
- `offertes.scopeData.gras` — kunstgras, drainage, opsluitbanden, verticuteren
- `offertes.scopeData.houtwerk` — configurator data per type, leverancier-links
- `offertes.scopeData.water_elektra` — verlichtingsplan, diepte-eis
- `offertes.garantiePakket` — gekozen garantie-tier
- Onderhoud scopes: reiniging, bemesting, gazonanalyse, mollenbestrijding, vaste_planten

### API integraties

| Service | Doel | Werkpakket |
|---------|------|-----------|
| Google Maps Distance Matrix | Afstand loods ↔ klant | WP1 |
| Google Maps/Earth | Tuinoriëntatie (N/Z/O/W) | WP4 |
| Calendly API | Afspraak plannen | WP11 |
| Mollie of Stripe | Aanbetalingen | WP9 |
| Whisper API / Claude | Audio transcriptie | WP10 |

### Frontend componenten (nieuw)

- `BestratingZoneEditor` — multi-zone bestrating met add/remove
- `FunderingsVisualisatie` — visuele laagopbouw per bestratingtype
- `PakketVergelijking` — 3-koloms vergelijking (basis/comfort/premium)
- `TuintypologieSelector` — visuele selectie met indicatie-prijzen
- `GarantiePakketSelector` — tier-selectie met uitleg
- `OrientatieKaart` — mini-kaartje met N/Z/O/W aanduiding
- `PlantSuggesties` — aanbevelingen op basis van oriëntatie + bodem
- `KlantConfigurator` — publieke self-service wizard
- `BetalingsModule` — Mollie/Stripe checkout
- `BeschikbaarheidsKalender` — realtime capaciteit
- `OnderhoudsFactorSlider` — schaal 1-5 voor onkruid-factor etc.

---

## 5. Offertekostenstructuur

Zoals besproken in de meeting, elke offerte heeft een standaard opstartkost:

```
Administratie/Voorbereiding:
├─ Offertetime:           0,5 dag = €75 (bij €150/uur)
├─ Klikmelding:           €50 (standaard)
└─ Marge op klikmelding:  +€75
────────────────────────────────────────
TOTAAL STARTKOSTEN:       €200/offerte minimum
```

**Implementatie:** Toevoegen als vast offerte-overhead in instellingen, automatisch opgenomen in elke offerte-berekening.

---

## 6. Risico's & Aandachtspunten

1. **Google Maps API kosten** — Distance Matrix en Geocoding kosten per request. Rate limiting en caching implementeren.
2. **Leveranciersdata onderhoud** — Prijzen van afvalverwerkers en transportbedrijven veranderen. Regelmatige updates nodig.
3. **Self-service configurator** — Klant-verificatie is cruciaal om onjuiste bestellingen te voorkomen. Aanbetaling is goed, maar verificatie-workflow moet waterdicht.
4. **Mobiele app complexiteit** — Audio-opname + AI-transcriptie + offline-modus is technisch uitdagend. Minimaal viable product eerst.
5. **Onderhoud calculator scope** — 9 sub-categorieën is veel. Prioriteer de meest winstgevende eerst (bemesting = 70% marge).

---

## 7. Samenvatting Tijdlijn

| Fase | Periode | Werkpakketten | Focus |
|------|---------|--------------|-------|
| 1 | Week 1-4 | WP1, WP2, WP3, WP8 | Slimmere berekeningen + pakketten |
| 2 | Week 5-8 | WP4, WP5, WP6, WP7 | Scope-verrijking + garanties |
| 3 | Week 9-14 | WP13, WP11, WP12 | Onderhoud + communicatie |
| 4 | Week 15-22 | WP9, WP10 | Self-service + mobiel |

**Totale geschatte doorlooptijd:** ~22 weken (bij 1 developer)

---

*Gegenereerd op: 22 februari 2026*
*Bronnen: Meeting aanleg Yannick (Google Drive) + Codebase-analyse offerte-builder*
