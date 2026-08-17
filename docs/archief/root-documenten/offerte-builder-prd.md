# Offerte Builder PRD

> **Versie:** 1.0  
> **Datum:** Januari 2026  
> **Status:** Definitief  
> **Klant:** Top Tuinen

---

## 1. Executive Summary

### 1.1 Productvisie

De Offerte Builder is een gespecialiseerde softwaremodule voor hoveniersbedrijven, ontworpen om aanleg- en onderhoudsoffertes te maken op een manier waarbij niets vergeten kan worden. Het systeem werkt scope-gedreven en zorgt ervoor dat alle noodzakelijke werkzaamheden, materialen en uren automatisch worden meegenomen of verplicht worden uitgevraagd.

### 1.2 Kernprincipe

> **"Als iets nodig is om het werk uit te voeren, mag het nooit stilzwijgend ontbreken in de offerte."**

Dit is de absolute kernregel die door het gehele systeem wordt gehandhaafd.

### 1.3 Wat het systeem WEL is

- Een offerte-tool voor aanleg- en onderhoudsprojecten
- Een systeem dat voorkomt dat essentiële onderdelen worden vergeten
- Een calculator met normuren en correctiefactoren
- Een prijsboek met import van leveranciersprijzen

### 1.4 Wat het systeem NIET is

- Geen CRM-systeem
- Geen marketingtool
- Geen ERP-systeem
- Geen AI-optimalisatietool
- Geen juridische automatisering

---

## 2. Tech Stack

### 2.1 Core Technologies

| Component | Technologie | Doel |
|-----------|-------------|------|
| Frontend | Next.js 14+ (App Router) | React framework met SSR/SSG |
| Styling | Tailwind CSS + shadcn/ui | UI componenten |
| Database | Convex | Realtime database & backend functions |
| Auth | Clerk | Authenticatie & gebruikersbeheer |
| PDF Generation | @react-pdf/renderer of jsPDF | Offerte PDF's genereren |
| File Import | Papa Parse (CSV) / SheetJS (XLS) | Prijslijst imports |

### 2.2 Project Structuur

```
offerte-builder/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── offertes/
│   │   │   ├── page.tsx
│   │   │   ├── nieuw/
│   │   │   │   ├── aanleg/
│   │   │   │   └── onderhoud/
│   │   │   └── [id]/
│   │   ├── prijsboek/
│   │   └── instellingen/
│   └── layout.tsx
├── components/
│   ├── ui/                    # shadcn components
│   ├── offerte/
│   │   ├── scope-selector.tsx
│   │   ├── grondwerk-form.tsx
│   │   ├── bestrating-form.tsx
│   │   ├── borders-form.tsx
│   │   ├── gras-form.tsx
│   │   ├── houtwerk-form.tsx
│   │   ├── water-elektra-form.tsx
│   │   ├── specials-form.tsx
│   │   └── onderhoud/
│   │       ├── gras-onderhoud-form.tsx
│   │       ├── borders-onderhoud-form.tsx
│   │       ├── heggen-form.tsx
│   │       └── bomen-form.tsx
│   ├── pdf/
│   │   ├── aanleg-offerte-pdf.tsx
│   │   └── onderhoud-offerte-pdf.tsx
│   └── import/
│       └── prijslijst-import.tsx
├── convex/
│   ├── schema.ts
│   ├── offertes.ts
│   ├── prijsboek.ts
│   ├── normuren.ts
│   ├── correctiefactoren.ts
│   └── berekeningen.ts
├── lib/
│   ├── calculations/
│   │   ├── grondwerk.ts
│   │   ├── bestrating.ts
│   │   ├── borders.ts
│   │   ├── gras.ts
│   │   ├── houtwerk.ts
│   │   ├── water-elektra.ts
│   │   └── onderhoud.ts
│   ├── validations/
│   │   └── offerte-rules.ts
│   └── utils.ts
└── types/
    └── offerte.ts
```

---

## 3. Systeemarchitectuur

### 3.1 Modulaire opzet

De Offerte Builder bestaat uit één centrale module met twee hoofdflows:

| Flow | Beschrijving |
|------|--------------|
| Aanlegofferte | Voor nieuwe tuinprojecten en renovaties |
| Onderhoudsofferte | Voor periodiek tuinonderhoud |

### 3.2 Scope-gedreven werking

Het systeem werkt op basis van scopes. Wanneer een scope wordt geselecteerd:

1. Worden bijbehorende vragen automatisch actief
2. Worden bijbehorende berekeningen verplicht
3. Worden afhankelijke onderdelen automatisch meegenomen
4. Is vergeten niet mogelijk

### 3.3 Dataflow

```
Input → Verwerking → Output

- Input: Scopeselectie, oppervlaktes, volumes, keuzes
- Verwerking: Normuren × correctiefactoren + materialen + marge
- Output: PDF-offerte met alle posten
```

---

## 4. Database Schema (Convex)

### 4.1 Schema Definitie

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Gebruikers (via Clerk, alleen referentie)
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    bedrijfsnaam: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  // Offertes
  offertes: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("aanleg"), v.literal("onderhoud")),
    status: v.union(
      v.literal("concept"),
      v.literal("definitief"),
      v.literal("verzonden"),
      v.literal("geaccepteerd"),
      v.literal("afgewezen")
    ),
    offerteNummer: v.string(),
    
    // Klantgegevens
    klant: v.object({
      naam: v.string(),
      adres: v.string(),
      postcode: v.string(),
      plaats: v.string(),
      email: v.optional(v.string()),
      telefoon: v.optional(v.string()),
    }),
    
    // Algemene parameters
    algemeenParams: v.object({
      bereikbaarheid: v.union(
        v.literal("goed"),
        v.literal("beperkt"),
        v.literal("slecht")
      ),
      achterstalligheid: v.optional(v.union(
        v.literal("laag"),
        v.literal("gemiddeld"),
        v.literal("hoog")
      )),
    }),
    
    // Geselecteerde scopes (voor aanleg)
    scopes: v.optional(v.array(v.string())),
    
    // Scope data per type
    scopeData: v.optional(v.any()), // Flexible object voor scope-specifieke data
    
    // Berekende totalen
    totalen: v.object({
      materiaalkosten: v.number(),
      arbeidskosten: v.number(),
      totaalUren: v.number(),
      subtotaal: v.number(),
      marge: v.number(),
      margePercentage: v.number(),
      totaalExBtw: v.number(),
      btw: v.number(),
      totaalInclBtw: v.number(),
    }),
    
    // Regels/posten
    regels: v.array(v.object({
      id: v.string(),
      scope: v.string(),
      omschrijving: v.string(),
      eenheid: v.string(),
      hoeveelheid: v.number(),
      prijsPerEenheid: v.number(),
      totaal: v.number(),
      type: v.union(v.literal("materiaal"), v.literal("arbeid"), v.literal("machine")),
    })),
    
    // Notities
    notities: v.optional(v.string()),
    
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    verzondenAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_nummer", ["offerteNummer"]),

  // Prijsboek
  producten: defineTable({
    userId: v.id("users"),
    productnaam: v.string(),
    categorie: v.string(),
    inkoopprijs: v.number(),
    verkoopprijs: v.number(),
    eenheid: v.string(),
    leverancier: v.optional(v.string()),
    verliespercentage: v.number(), // Default per categorie
    isActief: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_categorie", ["userId", "categorie"])
    .searchIndex("search_producten", {
      searchField: "productnaam",
      filterFields: ["userId", "categorie"],
    }),

  // Normuren
  normuren: defineTable({
    userId: v.id("users"),
    activiteit: v.string(),
    scope: v.string(),
    normuurPerEenheid: v.number(),
    eenheid: v.string(),
    omschrijving: v.optional(v.string()),
  }).index("by_user_scope", ["userId", "scope"]),

  // Correctiefactoren (systeem defaults + user overrides)
  correctiefactoren: defineTable({
    userId: v.optional(v.id("users")), // null = systeem default
    type: v.string(), // bereikbaarheid, complexiteit, hoogteverschil, etc.
    waarde: v.string(), // goed, beperkt, slecht, laag, gemiddeld, hoog
    factor: v.number(),
  }).index("by_user_type", ["userId", "type"]),

  // Instellingen
  instellingen: defineTable({
    userId: v.id("users"),
    uurtarief: v.number(),
    standaardMargePercentage: v.number(),
    btwPercentage: v.number(),
    bedrijfsgegevens: v.object({
      naam: v.string(),
      adres: v.string(),
      postcode: v.string(),
      plaats: v.string(),
      kvk: v.optional(v.string()),
      btw: v.optional(v.string()),
      iban: v.optional(v.string()),
      email: v.optional(v.string()),
      telefoon: v.optional(v.string()),
      logo: v.optional(v.string()),
    }),
    offerteNummerPrefix: v.string(),
    laatsteOfferteNummer: v.number(),
  }).index("by_user", ["userId"]),

  // Standaardtuinen (templates)
  standaardtuinen: defineTable({
    userId: v.optional(v.id("users")), // null = systeem templates
    naam: v.string(),
    omschrijving: v.optional(v.string()),
    type: v.union(v.literal("aanleg"), v.literal("onderhoud")),
    scopes: v.array(v.string()),
    defaultWaarden: v.any(), // Pre-filled scope data
  }).index("by_user", ["userId"]),
});
```

---

## 5. Aanleg Offertes

### 5.1 Startmethodes

| Methode | Beschrijving | Toepassing |
|---------|--------------|------------|
| Standaardtuin | Vooraf gedefinieerde tuin met standaardhoeveelheden | Referentie/startpunt |
| Zelf aanmaken | Gebruiker bouwt tuin zelf op | Maatwerk (hoofdflow) |

### 5.2 Beschikbare scopes

| Scope | Omvat |
|-------|-------|
| Grondwerk | Ontgraven, afvoer, machine-uren |
| Bestrating | Tegels/klinkers/natuursteen + verplichte onderbouw |
| Borders/beplanting | Grondbewerking, planten, afwerking |
| Gras/gazon | Zaaien of graszoden, ondergrondbewerking |
| Houtwerk | Schutting/vlonder/pergola + verplichte fundering |
| Water/elektra | Verlichting, sleuven, bekabeling |
| Specials | Jacuzzi, sauna, prefab elementen |

### 5.3 Scope: Grondwerk

**Input parameters:**

| Parameter | Type | Opties |
|-----------|------|--------|
| Oppervlakte | Numeriek | m² |
| Diepte | Selectie | Licht / Standaard / Zwaar |
| Afvoer grond | Boolean | Ja / Nee |
| Bereikbaarheid | Selectie | Goed / Beperkt / Slecht |

**Automatische berekeningen:**
- Ontgraafwerk (uren gebaseerd op m² × dieptefactor)
- Afvoerkosten (indien ja: m³ × tarief)
- Machine-uren (gebaseerd op oppervlakte en diepte)
- Bereikbaarheidscorrectie (toeslag bij beperkt/slecht)

### 5.4 Scope: Bestrating

> ⚠️ **Bestrating zonder onderbouw is NIET toegestaan in het systeem.**

**Input parameters - Bestrating:**

| Parameter | Type | Opties |
|-----------|------|--------|
| Oppervlakte | Numeriek | m² |
| Type bestrating | Selectie | Tegel / Klinker / Natuursteen |
| Snijwerk | Selectie | Laag / Gemiddeld / Hoog |

**Input parameters - Onderbouw (VERPLICHT):**

| Parameter | Type | Opties |
|-----------|------|--------|
| Onderbouwtype | Selectie | Zandbed / Zand+fundering / Zware fundering |
| Dikte onderlaag | Numeriek | cm |
| Opsluitbanden | Boolean | Ja / Nee |

**Automatische berekeningen:**
- Hoeveelheid zand (m² × dikte)
- Hoeveelheid puin/fundering (indien van toepassing)
- Arbeid leggen (m² × normuur × snijwerkcorrectie)
- Machine-uren
- Opsluitbanden (indien ja: strekkende meters × tarief)
- Afvoer oude onderlaag (indien renovatie)

### 5.5 Scope: Borders & Beplanting

**Input parameters:**

| Parameter | Type | Opties |
|-----------|------|--------|
| Borderoppervlakte | Numeriek | m² |
| Beplantingsintensiteit | Selectie | Laag / Gemiddeld / Hoog |
| Bodemverbetering | Boolean | Ja / Nee |
| Afwerking | Selectie | Geen / Schors / Grind |

**Automatische berekeningen:**
- Grondbewerking (m² × normuur)
- Bodemverbeteraar (indien ja: m² × kg/m²)
- Plantkosten (stuks gebaseerd op intensiteit)
- Aanplantarbeid (uren gebaseerd op intensiteit)
- Afwerking materiaal + arbeid (indien niet 'geen')

### 5.6 Scope: Gras / Gazon

**Input parameters:**

| Parameter | Type | Opties |
|-----------|------|--------|
| Oppervlakte | Numeriek | m² |
| Type | Selectie | Zaaien / Graszoden |
| Ondergrond | Selectie | Bestaand / Nieuw |
| Afwatering nodig | Boolean | Ja / Nee |

**Automatische berekeningen:**
- Ondergrondbewerking (indien nieuw: m² × normuur)
- Materiaal (zaad of graszoden × m²)
- Arbeid leggen/zaaien
- Drainage (indien afwatering ja)

### 5.7 Scope: Houtwerk

> ⚠️ **Houtwerk zonder fundering is NIET toegestaan in het systeem.**

**Input parameters:**

| Parameter | Type | Opties |
|-----------|------|--------|
| Type houtwerk | Selectie | Schutting / Vlonder / Pergola |
| Afmeting | Numeriek | Lengte (m) of m² |
| Fundering | Selectie | Standaard / Zwaar |

**Automatische berekeningen:**
- Funderingswerk (aantal palen/voeten × type)
- Houtmateriaal (gebaseerd op type en afmeting)
- Montage-uren
- Bevestigingsmateriaal

### 5.8 Scope: Water / Elektra

> ⚠️ **Elektra zonder sleuf/herstel is NIET toegestaan in het systeem.**

**Input parameters:**

| Parameter | Type | Opties |
|-----------|------|--------|
| Verlichting | Selectie | Geen / Basis / Uitgebreid |
| Aantal punten | Numeriek | Stuks |
| Sleuven nodig | Boolean | Ja / Nee |

**Automatische berekeningen:**
- Sleuven graven (strekkende meters)
- Bekabeling (meters + type)
- Aansluitpunten/armaturen
- Herstel grond/bestrating na aanleg

### 5.9 Scope: Specials

Specials omvatten bijzondere elementen die alleen plaatsing en voorbereiding vereisen:
- Jacuzzi plaatsen
- Sauna plaatsen
- Prefab elementen

Voor deze items worden alleen plaatsings- en voorbereidingsuren berekend.

---

## 6. Onderhoud Offertes

### 6.1 Algemeen

Een onderhoudsofferte wordt gemaakt per tuin, zonder pakketten of scenario's. Berekeningen zijn gebaseerd op oppervlaktes, volumes, intensiteit en tijd.

### 6.2 Algemene parameters

| Parameter | Type | Opties |
|-----------|------|--------|
| Totale tuinoppervlakte | Numeriek | m² |
| Bereikbaarheid | Selectie | Goed / Beperkt / Slecht |
| Achterstalligheid | Selectie | Laag / Gemiddeld / Hoog |

### 6.3 Gras onderhoud

**Input parameters:**

| Parameter | Type | Opties |
|-----------|------|--------|
| Gras aanwezig | Boolean | Ja / Nee |
| Grasoppervlakte | Numeriek | m² |
| Maaien | Boolean | Ja / Nee |
| Kanten steken | Boolean | Ja / Nee |
| Verticuteren | Boolean | Ja / Nee (optioneel) |
| Afvoer gras | Boolean | Ja / Nee |

**Automatische berekeningen:**
- Maaien (m² × normuur × bereikbaarheidscorrectie)
- Kanten steken (strekkende meters × normuur)
- Verticuteren (indien ja: m² × normuur)
- Afvoer (indien ja: volume × tarief)

### 6.4 Borders onderhoud

> ⚠️ **Border zonder intensiteit is NIET toegestaan in het systeem.**

**Input parameters:**

| Parameter | Type | Opties |
|-----------|------|--------|
| Borderoppervlakte | Numeriek | m² |
| Onderhoudsintensiteit | Selectie | Weinig / Gemiddeld / Veel |
| Onkruid verwijderen | Boolean | Ja / Nee |
| Snoei in borders | Selectie | Geen / Licht / Zwaar |
| Bodem | Selectie | Open / Bedekt (schors/grind) |
| Afvoer groenafval | Boolean | Ja / Nee |

**Automatische berekeningen:**
- Wieden (m² × intensiteitsfactor × achterstalligheid)
- Snoei (uren gebaseerd op type en volume)
- Bodemcorrectie (open = meer uren, bedekt = minder)
- Afvoer (indien ja: volume × tarief)

### 6.5 Heggen onderhoud

> ⚠️ **Alleen lengte zonder hoogte/breedte is NIET toegestaan.**

**Input parameters:**

| Parameter | Type | Opties |
|-----------|------|--------|
| Lengte heg | Numeriek | meter |
| Hoogte heg | Numeriek | meter |
| Breedte heg | Numeriek | meter |
| Snoei | Selectie | Zijkanten / Bovenkant / Beide |
| Afvoer snoeisel | Boolean | Ja / Nee |

**Automatische berekeningen:**

Volume = Lengte × Hoogte × Breedte (m³)

- Snoeitijd (volume × normuur × snoeitype-factor)
- Hoogtecorrectie (>2m = toeslag voor ladder/hoogwerker)
- Afvoer snoeisel (indien ja: volume × percentage × tarief)

### 6.6 Bomen onderhoud

**Input parameters:**

| Parameter | Type | Opties |
|-----------|------|--------|
| Aantal bomen | Numeriek | Stuks |
| Snoei | Selectie | Licht / Zwaar |
| Hoogteklasse | Selectie | Laag / Middel / Hoog |
| Afvoer | Boolean | Ja / Nee |

**Automatische berekeningen:**
- Snoeitijd (aantal × normuur × snoeitype)
- Hoogtecorrectie (middel/hoog = toeslag)
- Afvoer (indien ja: geschat volume × tarief)

### 6.7 Overige werkzaamheden

| Werkzaamheid | Berekening |
|--------------|------------|
| Bladruimen | Tuinoppervlakte × seizoensfactor |
| Terras reinigen | m² × normuur reiniging |
| Onkruid tussen bestrating | m² bestrating × normuur |
| Afwatering controleren | Vaste tijd + aantal punten |
| Overig | Vrij notitieveld + handmatige uren |

---

## 7. Prijzen & Berekeningen

### 7.1 Prijsimport

Leveranciersprijzen worden geïmporteerd via CSV, XLS of Google Sheets:

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| productnaam | Text | Naam van het product |
| categorie | Text | Productcategorie |
| prijs | Numeriek | Inkoopprijs leverancier |
| eenheid | Text | m², m³, stuk, meter, etc. |
| leverancier | Text | Naam leverancier |

### 7.2 Prijsberekening

> ⚠️ **Leveranciersprijs ≠ Offerteprijs**

| Component | Beschrijving |
|-----------|--------------|
| Verliespercentage | Snijverlies, breuk, etc. (instelbaar per categorie) |
| Onderlagen | Automatisch meegenomen op basis van scope |
| Arbeid | Normuren × uurtarief |
| Marge | Instelbaar percentage bovenop totaal |

### 7.3 Correctiefactoren

| Factor | Toepassing | Effect |
|--------|------------|--------|
| Bereikbaarheid | Alle scopes | Goed: 1.0 / Beperkt: 1.2 / Slecht: 1.5 |
| Complexiteit | Bestrating, houtwerk | Laag: 1.0 / Gemiddeld: 1.15 / Hoog: 1.3 |
| Hoogteverschil | Grondwerk, heggen, bomen | Variabel op basis van meters |
| Intensiteit | Borders, beplanting | Weinig: 0.8 / Gemiddeld: 1.0 / Veel: 1.3 |
| Snijwerk | Bestrating | Laag: 1.0 / Gemiddeld: 1.2 / Hoog: 1.4 |
| Achterstalligheid | Onderhoud | Laag: 1.0 / Gemiddeld: 1.3 / Hoog: 1.6 |

---

## 8. Validatieregels

### 8.1 Verplichte afhankelijkheden

Een offerte kan NIET worden gegenereerd als deze regels worden geschonden:

| Scope/Item | Verplicht onderdeel |
|------------|---------------------|
| Bestrating | Onderbouw (type + dikte) |
| Houtwerk | Fundering |
| Elektra | Sleuven + herstel |
| Border (onderhoud) | Intensiteit |
| Heg (onderhoud) | Lengte + hoogte + breedte (alle drie) |

### 8.2 Automatische toevoegingen

Het systeem voegt automatisch onderdelen toe:
- Machine-uren bij grondwerk > bepaalde omvang
- Afvoerkosten bij ontgraven met afvoer = ja
- Zand en fundering bij bestrating
- Bereikbaarheidstoeslag bij slechte toegang
- Hoogtecorrectie bij heggen/bomen boven bepaalde hoogte

---

## 9. Output / PDF Generatie

### 9.1 Aanlegofferte (PDF)

- Klantgegevens
- Projectomschrijving
- Gekozen scopes met specificaties
- Materialen met hoeveelheden
- Arbeidsuren
- Totaalprijs met BTW

### 9.2 Onderhoudsofferte (PDF)

- Klantgegevens
- Tuinomschrijving
- Werkzaamheden per categorie
- Geschatte uren
- Frequentie
- Totaalprijs per beurt/jaar

### 9.3 Factuur (optioneel)

Simpele factuur op basis van geoffreerde bedragen.

---

## 10. Functionele Requirements

| ID | Requirement |
|----|-------------|
| FR-01 | Systeem moet scope-selectie ondersteunen met automatische vraagactivering |
| FR-02 | Systeem moet verplichte afhankelijkheden afdwingen |
| FR-03 | Systeem moet CSV/XLS/Google Sheets import ondersteunen voor prijsdata |
| FR-04 | Systeem moet automatisch verliespercentages, onderlagen en marge doorrekenen |
| FR-05 | Systeem moet normuren met correctiefactoren berekenen |
| FR-06 | Systeem moet PDF-offertes genereren |
| FR-07 | Systeem moet standaardtuinen als template ondersteunen |
| FR-08 | Systeem moet volume-berekening voor heggen uitvoeren (L×H×B) |
| FR-09 | Authenticatie via Clerk met multi-user ondersteuning |
| FR-10 | Database in Convex met realtime sync |

## 11. Non-Functionele Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | Geen gebruik van AI of machine learning voor prijsoptimalisatie |
| NFR-02 | Geen gebruik van historische data voor urenberekening |
| NFR-03 | Berekeningen moeten consistent en reproduceerbaar zijn |
| NFR-04 | Systeem moet offline kunnen werken na initiële data-import |
| NFR-05 | Prijsboek moet lokaal opgeslagen worden |
| NFR-06 | Responsive design voor tablet gebruik in het veld |

---

## 12. Woordenlijst

| Term | Definitie |
|------|-----------|
| Scope | Hoofdcategorie van werkzaamheden (bijv. grondwerk, bestrating) |
| Normuur | Standaard tijdseenheid voor een bepaalde activiteit |
| Correctiefactor | Vermenigvuldigingsfactor om normuren aan te passen |
| Verliespercentage | Percentage extra materiaal voor snijverlies/breuk |
| Onderbouw | Funderings-/stabilisatielaag onder bestrating |
| Prijsboek | Interne database met producten en verkoopprijzen |

---

## 13. Implementatie Roadmap

### Fase 1: Foundation (Week 1-2)
- [ ] Project setup (Next.js, Tailwind, shadcn/ui)
- [ ] Clerk authenticatie integratie
- [ ] Convex database setup + schema
- [ ] Basis layout en navigatie

### Fase 2: Core Data (Week 3-4)
- [ ] Prijsboek CRUD + import functionaliteit
- [ ] Normuren beheer
- [ ] Correctiefactoren beheer
- [ ] Instellingen pagina

### Fase 3: Aanleg Offertes (Week 5-7)
- [ ] Scope selector component
- [ ] Formulieren voor alle 7 scopes
- [ ] Validatielogica (verplichte afhankelijkheden)
- [ ] Berekeningsengine
- [ ] Offerte overzicht/review

### Fase 4: Onderhoud Offertes (Week 8-9)
- [ ] Onderhoud formulieren (gras, borders, heggen, bomen)
- [ ] Overige werkzaamheden
- [ ] Berekeningsengine onderhoud

### Fase 5: Output & Polish (Week 10-11)
- [ ] PDF generatie aanleg
- [ ] PDF generatie onderhoud
- [ ] Standaardtuinen/templates
- [ ] Dashboard met offerteoverzicht

### Fase 6: Testing & Launch (Week 12)
- [ ] Validatiepilot (10 aanleg, 10 onderhoud offertes)
- [ ] Bugfixes en optimalisaties
- [ ] Documentatie
- [ ] Go-live

---

*— Einde PRD —*
