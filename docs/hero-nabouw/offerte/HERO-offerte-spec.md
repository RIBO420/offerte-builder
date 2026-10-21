# HERO offerte-editor: reverse engineering (Top Tuinen)

> **Uitgangspunten:** zie `../README.md`. toptuinen.app bestaat al en staat gedeeltelijk (onder andere een offerte- en factuurprogramma); de huidige stack van toptuinen.app is leidend; Ricardo beslist alles. Dit bestand beschrijft wat er in HERO te zien was. De adviezen erin (MVP, datamodel) zijn suggesties.

- **Datum:** 20-10-2026
- **Bron:** het live HERO-account van Top Tuinen (login.hero-software.de), documenttype "Offerte-aanleg"
- **Methode:**
  - de editor doorgeklikt, zonder iets op te slaan of te versturen
  - verstuurde offertes alleen gelezen, via HERO's eigen JSON-endpoint (`/partner/Documents/ajax_get_document/{id}`)
  - de code van de editor (een Vue-bundle) doorzocht op labels en veldnamen

**Hoe zeker is wat hier staat**

| Onderdeel | Zekerheid | Waarop het rust |
|---|---|---|
| Opbouw van het document, rekenregels, velden van een artikelregel, instellingen, stamdata | Hoog | Gezien in de schermen én in echte offerte-data |
| Een post bewerken in de editor (pop-up, contextmenu, soorten post) | Middel | Afgeleid uit labels in de code; niet zelf aangeklikt, omdat dat het concept zou veranderen |
| Beheerscherm loongroepen, factuurflow vanuit de offerte, e-mailverzending | Niet gezien | n.v.t. |

---

## 1. Kernbevindingen (lees dit eerst)

1. **Top Tuinen gebruikt ongeveer 15% van de editor.** Ik heb 16 recente documenten bekeken (offerte-aanleg, offerte-onderhoud, factuur). Allemaal hebben ze dezelfde vorm: `tekst → één tabel met alleen artikelregels → tekst`. Er zitten 0 titels, 0 diensten en 0 optionele of afroepposten in.
2. **De artikellijst wordt als kladblok gebruikt.** Per offerte worden nieuwe artikelen aangemaakt; voor offerte 01399 zijn dat 1911 t/m 1917, elk "1x gebruikt". In totaal zijn er 910 artikelen.
3. **Een regel in een document is een kopie, geen verwijzing.** De naam in het document kan afwijken van het artikel in de lijst (artikel 1916 heet in de lijst anders dan in de offerte). Met "Prijzen bijwerken" haal je de prijzen opnieuw op.
4. **Prijs per regel = inkoopprijs (`base_price`) plus een opslag (`marge`).** In de praktijk wordt de verkoopprijs ingetypt en rekent HERO de opslag terug: 6326 / 4590 = +37,82%.
5. **Wat HERO "marge%" noemt, is een opslag op de inkoopprijs, geen brutomarge.** 100% "marge" betekent 50% brutomarge. Kies in de eigen tool expliciet welke van de twee je bedoelt.
6. **Gemengde btw in één offerte:** werk 21%, planten 9%. Totalen worden per tarief opgeteld.
7. **Een concept heeft als nummer `0xxxx`.** Het echte nummer komt pas bij "Document afronden", uit de nummerreeks van het documenttype.
8. **Het PDF-voorbeeld slaat automatisch een nieuwe versie op.** Het concept heeft versies die je kunt terugzetten.

---

## 2. Opbouw van de offerte (PDF)

**Pagina 1, van boven naar beneden**

- Logo rechtsboven (positie boven 10, links 150, 45 × 30)
- Afzenderregel in klein lettertype, een "eigen adresregel" (positie boven 45, links 25)
- Links het adresblok van de klant
- Rechts een infoblok: Offertenummer, Klantnummer, Datum, Contactpersoon, E-mail
- Onderwerpregel: `{subject_prefix}{nr}` → "Offerte nr. 01399" (Arial 13pt, vet)
- Inleidingstekst (een tekstblok)
- Tabel met de posten
- Afsluitingstekst (een tekstblok). Bij Top Tuinen is die lang: geldigheid, betaling 50/30/20, planning en weer, bereikbaarheid, aansprakelijkheid.
- Voettekst (7pt): `Offerte {nr} | {bedrijf} | {adres} | Directeur: … | Bladzijde x/y`
- Vouwlijntjes links (alleen op pagina 1)

**Volgende pagina's:** het logo en de kop van de tabel worden herhaald.

**Kolommen van de tabel:** `Pos | Hoeveelheid | Omschrijving | Eenheidsprijs | Totaal`

- Een titelrij heeft een grijze achtergrond, bijvoorbeeld "Positie 1 | Posten". De posten eronder krijgen de nummers 1.001, 1.002 en zo verder.
- Zonder titels krijg je 001, 002 (de nummers zijn opgeslagen als `["0","001"]`).
- Een post bestaat uit:
  - een vetgedrukte naam
  - een omschrijving in opgemaakte tekst (opsommingen, nummering, onderstreping)
  - een hoeveelheid met eenheid, zoals "1 st", "10 m²" of "1 eenmalig bedrag"
- Optioneel onderaan: een "Samenvatting" met per titel het subtotaal.
- Daarna volgen de totalen: netto, btw per tarief, bruto.

---

## 3. De editor, scherm voor scherm

De indeling: links het document (tabbladen **Concept** | **PDF-voorbeeld**), rechts een paneel.

### 3.1 Werkbalk

| Knop | Functie |
|---|---|
| Naar het project | Terug naar het project waar het document bij hoort |
| € Prijzen bijwerken | Prijzen opnieuw ophalen "uit stamgegevens" (artikelen en loongroepen). In de code staan nog twee bronnen: de webshop van een leverancier (IDS Connect) en 2BA. Twee manieren: de verkoopprijs aanpassen terwijl de opslag gelijk blijft, of de opslag aanpassen terwijl de verkoopprijs gelijk blijft. |
| 🕒 Voeg tijden in | Pop-up "Selecteer opgenomen tijden": een tabel met de urenregistratie (Medewerker, Periode, Werkuren, Standaardvergoeding/uur, Categorie, Opmerking, Status). Groeperen kan per salarisgroep, per medewerker, per categorie of als één post. Optie: "Accepteer commentaar". |
| Posten | Een stappenplan "Uit welk ander document moeten artikelen worden overgenomen?": een tabel met documenten (#, type, klant, project, netto, datum), standaard gefilterd op de huidige klant. Daarna kies je de posten en klik je "Alles toepassen" of "Verder". Optie: hoeveelheden op nul zetten bij het toevoegen. |
| Sjablonen | Lijst van opgeslagen sjablonen (naam, datum, netto), met de knop Overnemen |
| ↶ ↷ | Ongedaan maken en opnieuw |
| 💾 Concept opslaan | Slaat het concept op |
| ✓ Document afronden | Kent het nummer toe. Daarna kies je "per e-mail versturen" of "alleen aanmaken", geef je het document een naam en kun je het "als sjabloon opslaan". Je krijgt een waarschuwing als het nummer al bestaat en het document overschreven wordt. |
| Meer ▾ | Instellingen · Btw (zet alle posten in één keer op een ander tarief) · Prijzen bijwerken · UGL-export · UGL-import · OpenTrans-import (in de code staat ook GAEB-import en -export) |

### 3.2 Instellingen (per document; de standaardwaarden komen van het documenttype)

Tabbladen: **Versies | Algemeen ontwerp | Eerste pagina | Volgende pagina's**

**Versies**

Een lijst van opgeslagen versies (datum en totaal), met per versie de knop Overnemen om die versie terug te zetten.

**Algemeen ontwerp**

- **Marges:** boven 40, onder 35, links 0, rechts 0
- **Hoofdblok:** boven 100, links 25, rechts 15
- **Lettergrootte:** 6pt t/m 18pt, standaard 11pt
- **Lettertype:** onder andere Arial, Calibri, Roboto Slab, Lato, Open Sans en Times New Roman (ongeveer 25 lettertypes; standaard Calibri)
- **Basisopmaak:** Klassiek of Modern
- **Voettekst:**
  - leeg
  - documentnummer + bladzijde
  - bedrijf + pagina
  - documentnummer + bedrijf + pagina
  - alleen bladzijde
- **Afstand van de voettekst tot het hoofdblok:** 20
- **Lettergrootte voettekst:** 7pt
- **Vinkjes:** Briefpapier tonen ☐, Vouwmarkeringen op de eerste pagina ✓

**Opties voor de posten** (✓ = staat aan bij Top Tuinen)

| Optie | | Optie | |
|---|---|---|---|
| Functiebeschrijving | ✓ | BTW tonen | ✓ |
| Positioneer afbeeldingen | ✓ | Btw-tarief weergeven | |
| Barcode | | Samenvatting van titels | ✓ |
| Toon artikelnummer | | Toon tracktotalen | |
| Verberg individuele prijzen | | Aparte lange beschrijvende teksten | |
| Bestelwaarde verbergen | | Toon maatvoering in PDF | |
| Toeslag tonen | ✓ | Toon posities met en zonder toeslag in PDF | |
| Artikel weergeven in Diensten | | Toon artikelprijzen in diensten | |
| Toon arbeids-/machinekosten in de dienstenbeschrijving | | Toon uurtarieven voor arbeids-/machinekosten in diensten | |
| Hoeveelheden optellen in dienstencomponenten | | | |

**Eerste pagina**

- **Adresregel:** eigen adresregel ✓ + tekst, positie boven 45, links 25
- **Logo en bedrijfsadres:** adres ☐, logo ✓; boven 10, links 150, breedte 45, hoogte 30
- **Onderwerpregel 1 (projectadres):** tonen ☐, vet ✓, Arial 13pt, voorvoegsel "Onderwerp:"
- **Onderwerpregel 2 (documentnummer):** tonen ✓, vet ✓, Arial 13pt

**Volgende pagina's**

Logo ✓, adres ☐; boven 10, links 150, breedte 45, hoogte 30.

Alle 123 instellingen staan in **bijlage A**.

### 3.3 Rechterpaneel

**Tabblad "Artikelen en diensten"**

- **Nieuw artikel toevoegen:** de knoppen `+ Artikel` en `+ Diensten` maken een losse regel.
- **Artikelen uit de artikelmaster:**
  - een zoekveld "Artikel of dienst" en een filter Leverancier
  - een lijst gesorteerd op hoe vaak een artikel gebruikt is
  - per rij: naam, prijs per eenheid, de eerste regel van de omschrijving, "Nx gebruikt" en een `[+]`-knop
- **Geavanceerde filters** opent de pop-up "Posten selectie":
  - tabbladen Artikel / Diensten / Winkelmand
  - een tabel met artikelnr, naam, categorie, omschrijving, leveranciersnr, gebruikt, CP VK1
  - per rij: een aantal, `[+]` en Details
  - een teller "N posities met € X" en de knop Overnemen

**Tabblad "Teksten & titels"**

- Een zoekveld en de knoppen `+ Tekst` en `+ Titel`.
- Een bibliotheek met tekstblokken (titel + voorbeeld). De invulvelden zijn in het voorbeeld al ingevuld met de gegevens van de klant.

**Blok "Overzicht"** (werkt live bij)

- Aantallen: Posten · Artikel · Diensten
- Ink.-materiaal
- Werkuren
- Totaal netto
- **Opbrengst** = netto − inkoop materiaal
- **Uurtarief** = opbrengst ÷ werkuren
- Totaal bruto
- PDF gemaakt (datum)

**Blok "Indeling"**

Een inhoudsopgave van de titels. Klik je op een titel, dan spring je naar die plek in het document.

### 3.4 Editor voor tekstblokken

Werkbalk: lettertype, grootte, kleur, vet/cursief/onderstreept, uitlijning. Uitgeklapt komen daar bij: opsomming, nummering, tabel, link, afbeelding, **pagina-einde afdwingen** en **placeholder invoegen**.

### 3.5 Posten in de editor (afgeleid uit de code)

**Contextmenu van een post**

- Prijs in de PDF verbergen of tonen
- Hoeveelheid tonen
- Als pauschaal verbergen (er staat dan "1 pauschaal" in de PDF)
- Omschrijving tonen of verbergen
- Omzetten naar dienst
- Post dupliceren
- Post verwijderen

**Contextmenu van een titel**

- Inspringen of uitspringen
- Pagina-einde
- Titel calculeren
- Titel + posten dupliceren of verwijderen
- Alleen de titel dupliceren of verwijderen

**Acties voor de hele tabel**

- Alle hoeveelheden tonen
- Alles als pauschaal tonen
- Alle prijzen tonen of verbergen
- Tabel verwijderen

**Soorten post**

- Normaal
- Alternatief: hoort bij een groep, aangeduid als `G1-A1`
- **Op afroep (Bedarfsposition):** met totaal (eenheidsprijs × hoeveelheid) of zonder totaal (alleen de eenheidsprijs)
- Pauschaal
- Tijdelijk

Optionele posten tellen op in `netOptional` en afroepposten in `netOnDemand`. Ze tellen niet mee in het netto en staan tussen haakjes in de samenvatting.

**Pop-up "Post bewerken"** (met knoppen naar de vorige en volgende post)

- Tabbladen:
  - Informatie
  - Calculatie
  - Hoeveelheid berekenen (Aufmaß): regels met een label en een formule, tot 4 decimalen, afgerond op 2; je kunt de berekening overnemen van een andere post
  - Aanvullende tekst
  - Geschiedenis: tijdstip, veld, gewijzigd door, oude waarde
- Velden op Calculatie:
  - Opslag %
  - VK netto
  - VK netto nieuw (met een knop om de prijs terug te zetten)
  - Materiaal
  - Loon/machinekosten
  - Korting % en Korting bedrag
  - VK nieuw netto
  - Btw %
  - Totaal VK bruto
- Acties: "overnemen in stamdata" en "toepassen op identieke artikelen in het document".
- Controles: minimale bestelhoeveelheid, en of de hoeveelheid een veelvoud is van de staffel.

**Op het niveau van de tabel**

- **Korting/Toeslag:**
  - omschrijving
  - type: vast bedrag (pauschaal) of procent
  - kortingsbedrag
  - netto zonder en met korting
  - totaal netto met toeslag
  - een negatieve korting kan niet
- **Grondstoftoeslag** (metaalprijs per kg): niet relevant voor hoveniers.

---

## 4. Stamdata

### 4.1 Artikel (`/SupplyProducts`)

**Tabblad Informatie**

- Artikelnaam, Artikelnummer, Categorie, Eenheid, Matchcode, EAN, Kostenplaats
- Leverancier, Leveranciersnummer
- Fabrikant, Fabrikantnummer, Typeaanduiding fabrikant
- Minimale bestelhoeveelheid, Staffelprijzen, Prijseenheid, Levertijd, Voorraadniveau
- Afbeelding
- Omschrijving (opgemaakte tekst)

**Eenheden**

vast tarief, baal, cm², dag, dm, g, st, uur, kg, km, kWh, kWp, lm, L, ml, maand, m², m³, m, %, paar, ton, wk, container, pallet, zak, doos, set, buis, min, en nog meer.

**Tabblad Calculatie**

- Inkoopprijs, Catalogusprijs, Btw %
- Een tabel **Verkoopprijzen**: per prijslijst de verkoopprijs per eenheid, met een vinkje "Standaard VP"

**Overzichtslijst**

Artikelnr, Naam, Categorie, Omschrijving, Leveranciersnr, Gebruikt, CP VK1.

### 4.2 Dienst (`/SupplyServices`)

**Tabblad Informatie**

Naam, Interne naam, Dienstnummer, Eenheid, EAN, Fabrikant, afbeelding, omschrijving (opgemaakte tekst).

**Tabblad Calculatie**

- **Materiaal:** regels met artikel, hoeveelheid, eenheid, IP/eenheid, CP/eenheid, VP, marge %, VP per eenheid, VP netto
- **Loon/materiaal:** regels met loongroep, beschrijving, minuten, uren, IP/eenheid, marge %, VP per eenheid, VP netto
- **Netto:** voor materiaal, loon en totaal: IP, marge %, VP netto, VP netto nieuw, marge % nieuw (met "Prijs opnieuw instellen")
- **Totaal:** VP nieuw netto, btw %, totale omzet bruto

**Voorbeeld: "Tuinonderhoud uurbasis" (1001)**

60 minuten loongroep Hovenier, IP €30 + 100% = VP €60, btw 21% → €72,60.

### 4.3 Verkoopprijzen (prijslijsten, `/SupplySalesPrices`)

Een prijslijst is een naam plus een formule "Aankoopprijs + x%":

| Prijslijst | Formule |
|---|---|
| VK1 (standaard) | +0% |
| Standaardmarge | +40% |
| Klantspecifiek (test) | +66,67% |

### 4.4 Loongroepen

Hovenier: kostprijs €30/u, opslag 100% → €60/u. Het beheerscherm heb ik niet gezien.

### 4.5 Teksten & titels (`/SupplyTexts/texts`)

- **Teksten:** 27 stuks, elk een titel plus opgemaakte tekst. Per documentsoort is er een "Inleiding" en een "Afsluiting".
- **Titels:** 1 stuk ("Tussentitels").
- **Vorm van een placeholder:** `{{Object.veld}}`

**Groepen in de placeholder-kiezer**

Bedrijf, Klant, Klantadres, Tak, Medewerkers, ProjectMatch, Project, Projectleider, Document, Opdracht, Opdrachtadres, Referentiedocument.

**Placeholders die ik heb gezien**

| Groep | Placeholders |
|---|---|
| Bedrijf | `Company.name` · `Company.legal_form` · `Company.address.street` · `Company.address.city` · `Company.address.zipcode` · `Company.address.full_address` · `Company.default_phone` · `Company.default_mobile` · `Company.default_fax` · `Company.website` · `Company.image_logo` · `Company.ust_id_number` · `Company.hrb_number` |
| Klant | `Customer.title` · `Customer.title_informal` · `Customer.first_name` · `Customer.last_name` · `Customer.full_name` · `Customer.title_full_name` · `Customer.initial_name` · `Customer.nr` · `Customer.company_name` · `Customer.company_legal_form` · `Customer.phone_home` · `Customer.phone_mobile` · `Customer.email` · `Customer.accounting.ust_id_number` · `Customer.accounting.debitor_number` |
| Document | `CustomerDocument.nr` · `.brutto` · `.value` (netto) · `.remaining_amount` · `.discount` · `.value_after_discount` · `.discount_rate` · `.discount_time` · `.discount_date` · `.date` · `.sent_date` · `.paid_date` · `.due_time` · `.due_date` · `.current_date` · `.service_date_label` · `.service_date` · `.pay_data_qrcode` · `.pay_data_qrcode_with_bankinfo` · `.current_reminder_interval_end` |
| Project | `ProjectMatch.display_id` · `ProjectMatch.partner_notes` · `ProjectMatch.name` · `ProjectMatch.created` · `Address.street` · `Address.city` · `Address.zipcode` · `Address.full_address` · `Address.maps_link` · `Measure.name` · `Measure.short` |
| Medewerker | `Partner.full_name` |
| Referentiedocument | `ReferenceDocument.nr` · `ReferenceDocument.date` · `ReferenceDocument.brutto` · `ReferenceDocument.due_date` |

### 4.6 Documenttypes (de "Configurator", `/DocumentTypes`)

**De 17 types**

1e Herinnering, Aanbetaling, Algemeen, Bestelformulier, Bouwplaatsrapport, Brief, Calculatie, Creditfactuur, Factuur – Aanleg, Factuur – Onderhoud, Factuur BTW-verlegd, Jaarlijkse offerte, Leveringsbon, Meetdocument, Offerte-aanleg, Offerte-onderhoud, Orderbevestiging.

**Instellingen per type**

- **Algemene instellingen:**
  - basistype (offerte, factuur, …)
  - naam, status, standaardmap
  - nummerreeks (één per type, bijvoorbeeld de reeks "Offerte")
  - wat er na het aanmaken met het project gebeurt (bijvoorbeeld "Contracttoekenning")
- **Ontwerp:** algemeen, eerste pagina en volgende pagina's. Dit zijn dezelfde velden als in §3.2, hier als standaardwaarden voor het type.
- **Toegevoegde opties:** voorvoegsel van het onderwerp ("Offerte nr.").
- **Boeking:**
  - boekingsrelevant
  - boekingscategorie
  - boekingspagina ("Begroot")
  - standaard boekingsrekening
  - kostenplaats
  - documenttype voor annuleringsfacturen ("Creditfactuur")
  - relevantiestatus voor facturering
- **Live voorbeeld:** een voorbeeld-PDF (pagina 1 en de volgende pagina's) die meteen meeverandert met de instellingen.

### 4.7 Sjablonen (`/partner/DocumentTemplates`)

Een naam plus een opgeslagen set posten. Er zijn er 4, bijvoorbeeld "Haag aanplant/grondwerk gazon" en "Tuinonderhoud per uur met 10% korting".

---

## 5. Datamodel (afgeleid uit de JSON van HERO)

Een volledig voorbeeld zonder klantgegevens staat in `hero-datamodel.json`.

```ts
// Documentkop (CustomerDocument)
interface CustomerDocument {
  id: number; type: 'offer' | 'invoice' | ...; document_type_id: number;
  nr: string;                 // '0xxxx' zolang het een concept is
  contact_id: number; project_match_id: number;
  status_code: number;        // 0 = concept, 200 = verstuurd
  value: number; vat: number; currency: 'EUR'; date: string;
  published_customer_document_draft_id: number; // de draft die de PDF heeft opgeleverd
  file_upload_id: number;     // de PDF
}

// Concept met versies (CustomerDocumentDraft): de inhoud is één JSON-blob
interface Draft {
  id: number; customer_document_id: number; nr: string;
  data: {
    version: number; date: string; subject: string;   // 'Offerte nr. '
    receiver: Receiver;                                 // momentopname van de klant
    options: Record<string, any>;                       // 123 layout-instellingen (bijlage A)
    item_number_schema: { tiers: {numberLength:number}[]; skipNonExistingLevels: boolean; skippedTiersFiller: string };
    totals: Totals;
    items: Item[];                                      // de lijst van blokken
    suggested_items: Item[];
  }
}

type Item = TextItem | TableItem | TitleItem | ProductLine | ServiceLine;

interface TextItem  { type:'text'; uid; id?: number /* bron in de tekstbibliotheek */; title; text /* HTML */; pagebreak?: boolean }
interface TableItem { type:'table'; uid; items: (TitleItem|ProductLine|ServiceLine)[];
                      sales_type: ''|'percent'|'fixed'; sales_name; sales_value; sales_total; // korting of toeslag
                      metalPricePerKg; pagebreak; totals: Totals }
interface TitleItem { type:'title'; uid; title; text?; items: (TitleItem|ProductLine|ServiceLine)[]; totals: Totals }

interface ProductLine {
  type:'product'; uid; nr /* artikelnr */; name; description /* HTML */;
  quantity; unit_type /* 'Stk','m²',... */;
  base_price /* inkoop per eenheid */; marge /* opslag % */; net_price_per_unit /* VP */;
  list_price; vat_percent; time_minutes; sales /* korting */;
  optional: boolean|null; onDemand: boolean|null;
  measurements: { label; formula; result; unit_type }[];
  itemNumber: { identifiers: string[]; isFixed: boolean|null };
  sales_price_id; supplier_id; ean; manufacturer; hash /* om te zien of het afwijkt van de stamdata */;
}

interface ServiceLine extends Omit<ProductLine,'type'> {
  type:'service'; supply_service_id;
  components: {
    product_positions: ProductLine[];
    wage_positions: { wage_group; activity; time_minutes; wage_per_hour; wage_cost_price; quantity }[];
  };
  is_custom_price; custom_material_price; custom_wage_price; is_fixed_net_price; wage_costs;
}

interface Totals {
  base; net; netOptional; netOnDemand; time; wage; wage_base;
  material; material_base; sales; margin; marginPos;
  byVat: { vat:number; net:number; base:number; wage:number|null }[];
  vat;
}
```

---

## 6. Rekenregels

```
regel.VP           = base_price × (1 + marge/100)          // of handmatig ingetypt → marge = (VP/base − 1)×100, 2 decimalen
regel.totaal       = quantity × VP
tabel.netto        = Σ regel.totaal (zonder optioneel en op afroep) ± korting/toeslag van de tabel
netOptional        = Σ optionele regels       (apart tonen, telt niet mee)
netOnDemand        = Σ afroepregels           (apart tonen, telt niet mee)
byVat[t].net       = Σ regel.totaal waar vat_percent = t
btw                = Σ byVat[t].net × t/100   (afronden op 2 decimalen)
bruto              = netto + btw
opbrengst          = netto − material_base    ("Opbrengst" in het Overzicht)
uurtarief          = opbrengst ÷ werkuren     ("Uurtarief" in het Overzicht)
dienst.VP          = Σ(materiaal-VP) + Σ(minuten/60 × wage_per_hour)
```

**Acceptatietest: offerte 01399** (de echte cijfers staan in `hero-datamodel.json` → `fixture_01399`)

| | Bedrag |
|---|---|
| Inkoop totaal | € 18.733,35 |
| Netto | € 24.699,10 (gemiddeld +31,8%) |
| Btw 21% over € 24.027,10 | € 5.045,69 |
| Btw 9% over € 672,00 | € 60,48 |
| Btw totaal | € 5.106,17 |
| Bruto | € 29.805,27 |

---

## 7. HERO-endpoints (ter info, voor een eventuele koppeling of import)

Gezien in de code van de editor. Het gaat om sessie-endpoints, geen officiële API.

| Endpoint | Waarvoor |
|---|---|
| `GET /partner/Documents/ajax_get_document/{id}` | Document plus gepubliceerde draft, inclusief posten (alleen lezen) |
| `POST /partner/Documents/ajax_save/` | Concept opslaan |
| `POST /partner/Documents/ajax_publish/` | Document afronden |
| `/partner/Documents/ajax_texts` | Tekstbibliotheek |
| `/partner/Documents/ajax_options/` | Instellingen |
| `/partner/Documents/ajax_versions/` | Versies |
| `/DocumentElements/ajax_products` | Artikelen zoeken |
| `/SupplySalesPrices/api` | Prijslijsten |
| `/WageGroups/ajax_wage_groups` | Loongroepen (heeft parameters nodig) |
| `/partner/DocumentTemplates/api_get/` | Sjabloon ophalen |
| `/partner/DocumentTemplates/api_apply/` | Sjabloon toepassen |
| `/partner/DocumentImports/ugl_import` | UGL-import |
| `/partner/DocumentImports/open_trans_import` | OpenTrans-import |
| `/partner/DocumentExports/ugl_export/` | UGL-export |
| `/gaeb/Convert/import_editor/` | GAEB-import |
| `/employees/TimeTrackings/import_picker/` | Uren invoegen |
| `/DocumentsRenderer/view_pdf/{id}` | PDF bekijken |
| `/DocumentsRenderer/preview/{id}` | PDF-voorbeeld |
| `/Api/graphql` | GraphQL |

---

## 8. Aanbevolen MVP-scope

**MUST (wat Top Tuinen nu echt gebruikt)**

- Koppeling met wat toptuinen.app al heeft: klanten, projecten, bedrijfsgegevens en logo. Leg bij het afronden een momentopname van de klant vast in de offerte.
- Document: kop (klant, nummer, datum, contactpersoon) → tekstblok → tabel → tekstblok
- Artikelregel:
  - naam, omschrijving (opgemaakte tekst), hoeveelheid, eenheid
  - inkoopprijs, opslag ⇄ verkoopprijs (beide kunnen invoerveld zijn)
  - btw 21% of 9%
- Losse regels die **niet** automatisch in de artikellijst komen, plus een knop "opslaan in bibliotheek"
- Tekstbibliotheek met inleiding en afsluiting per soort, plus placeholders (klant, bedrijf, document)
- Totalen: netto, btw per tarief, bruto. Live overzicht: inkoop, opbrengst, opslag %.
- Nummerreeks per type; het nummer pas toekennen bij afronden
- PDF met één vaste opmaak die lijkt op de huidige (logo, infoblok, tabel, voettekst, paginanummers)
- Versies van het concept

**SHOULD**

- Titels/groepen met subtotaal en samenvatting
- Optionele posten
- Sjablonen
- Posten kopiëren uit een eerdere offerte
- Korting/toeslag per offerte

**WON'T (nu niet)**

- GAEB, UGL, OpenTrans, IDS Connect, 2BA, grondstoftoeslag
- 123 opmaakinstellingen
- Diensten met loongroep-calculatie (pas als er vraag naar is)

---

## 9. Beslissingen die eerst moeten

1. **Besloten: de module wordt ingebouwd in toptuinen.app.** Wat nog open staat: in HERO hangt de offerte aan het project, de klant, de facturen (deelfactuur, aanbetaling, eindfactuur), e-facturatie en de boekhouding. Koppel daarom aan de klanten, projecten en facturen die toptuinen.app al heeft, en bouw die niet opnieuw. Blijft HERO tijdens de overgang de facturen doen, regel dan hoe een geaccepteerde offerte daar terechtkomt (overtypen, of de UGL-import testen). Laat de nummering verdergaan waar HERO stopt. Het startnummer per reeks (offerte en factuur) wordt een instelling in de app, die we vlak voor livegang invullen.
2. **Wat is leidend: de verkoopprijs of de opslag?** HERO kan beide. Advies: sla de verkoopprijs op en reken de opslag af.
3. **"Marge" of "opslag"?** Kies er een en noem het in de interface ook zo.
4. **Regels als kopie (zoals HERO) of als verwijzing naar het artikel?** Advies: kopie, plus een expliciete knop "prijzen bijwerken".

## 10. Niet gezien / open vragen

- Hoe een post precies op het scherm staat in de concepteditor (kolommen, slepen, invoegpositie)
- Wat er gebeurt na "Document afronden" (e-mailtekst, bijlagen zoals de algemene voorwaarden)
- Van offerte naar factuur (de 50/30/20-termijnen)
- De velden van de loongroepen

---

## Bijlage A: alle 123 instellingen (`draft.data.options`)

font, debit, show_vat, font_size, logo_width, pdf_layout, cost_center, footer_text, infobox_fax, logo_heigth, text_prolog, book_account, number_range, subject_font, infobox_email, infobox_phone, infobox_width, number_prefix, text_preamble, infobox_mobile, infobox_number, show_title_sum, subject_prefix, custom_box_text, infobox_contact, infobox_display, infobox_project, main_price_type, page_margin_top, positions_markup_total, subject_display, booking_relevant, custom_box_width, footer_font_size, infobox_fax_text, page2_logo_width, page_margin_left, positions_number, template_chooser, footer_margin_top, page2_infobox_fax, page2_logo_heigth, page_margin_right, services_extended, subject_font_bold, subject_font_size, content_margin_top, custom_box_display, display_background, infobox_email_text, infobox_margin_top, infobox_phone_text, page_margin_bottom, positions_extended, content_margin_left, infobox_customer_nr, infobox_margin_left, infobox_mobile_text, page2_infobox_email, page2_infobox_phone, page2_infobox_width, positions_col_image, background_design_id, company_logo_display, content_margin_right, infobox_contact_text, page2_infobox_mobile, page2_infobox_number, project_address_font, custom_box_margin_top, display_partner_image, display_project_image, page2_infobox_contact, page2_infobox_project, company_custom_address, custom_box_margin_left, infobox_header_display, infobox_payment_method, project_address_prefix, company_address_display, positions_show_subtotal, project_address_display, validate_order_quantity, page2_infobox_margin_top, positions_order_quantity, page2_infobox_margin_left, project_address_font_bold, project_address_font_size, company_address_margin_top, page2_company_logo_display, company_address_margin_left, customer_address_margin_top, positions_split_description, customer_address_margin_left, page2_company_custom_address, page2_infobox_header_display, positions_disable_unit_prise, infobox_document_reference_nr, page2_company_address_display, page2_company_logo_margin_top, page2_company_logo_margin_left, customer_address_company_address, page2_company_address_margin_top, page2_company_address_margin_left, customer_address_company_address_display, folding_marks, infobox_service_date, reversal_invoice_type_id, show_measurements, show_positions_nr, project_subject_text_option, booking_category, show_vat_rate, infobox_uid, page2_custom_box_display, page2_infobox_uid, positions_hide_order_value, show_wages, show_wages_prices, services_extended_prices, summarize_service_positions, contact_partner_context, sales_price_id

Opvallende waarden bij Top Tuinen:

- `number_prefix: "ANG-"`, `number_range: "10000"` (dit zijn standaardwaarden van HERO in de JSON, niet de echte reeks; de echte offertes heten 01399 en zo verder)
- `pdf_layout: "modern"`, `font: "Calibri"`, `font_size: "11"`
- `text_prolog` en `text_preamble` verwijzen naar de id's van de standaard afsluitings- en inleidingstekst

## Bijlage B: functies die in de code van de editor staan

Uit de Duitse labels in de code, vertaald en gegroepeerd. Een vinkje betekent dat ik het ook in de interface heb gezien.

**Posten en titels**

- alternatieve post
- afroeppost met of zonder totaal
- pauschaalpost
- tijdelijke post
- inspringen of uitspringen
- titel calculeren
- pagina-einde
- nummering herstellen ("Nummerschema fout → repareren")
- meerwerk (Nachtragspositionen) hierheen slepen

**Prijs**

- opslag %
- korting % of bedrag op een regel
- korting/toeslag per tabel (vast bedrag of %)
- prijzen bijwerken uit de stamdata ✓, uit de webshop van een leverancier (IDS Connect) of uit 2BA
- inkoopprijzen vergelijken tussen leveranciers
- prijsaanvraag
- de prijs van de leverancier ligt hoger dan de catalogusprijs (waarschuwing)

**Hoeveelheid**

- hoeveelheid berekenen met formules (Aufmaß)
- minimale bestelhoeveelheid
- staffel
- voorraad (meldniveau, gewenste voorraad)

**Document**

- versies ✓
- sjablonen ✓
- posten uit een ander document ✓
- uren invoegen ✓
- btw voor alles tegelijk ✓
- informatie bewerken (vrije tekst, datum, welke velden in het infoblok staan)
- adres bewerken
- contactpersoon kiezen (de hoofdcontactpersoon of de maker van het document)

**Factuurflow**

- deelfactuur
- cumulatieve deelfactuur
- eindfactuur
- aanbetaling (vast bedrag of %), met het overzicht "berekend X van Y"
- overzicht van facturen en betalingen
- betaalblok met QR-code
- XRechnung-controle (e-factuur)

**Afronden**

- "per e-mail versturen" of "alleen aanmaken"
- naam van het document
- als sjabloon opslaan
- waarschuwing bij overschrijven van een document dat al verstuurd is

**Import en export**

- GAEB (81/83, offerteaanvraag of bestek)
- UGL
- OpenTrans
- bestelformulier per leverancier
- online bestellen
