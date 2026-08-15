# Schouw offerte-entree — "Nieuwe offerte" van klik tot regel

*UX-schouw 15 aug 2026, dev-omgeving met demodata, desktop 1280×800, ingelogd als staf.*
*Aangemaakt tijdens de schouw (concepten, mogen weg): OFF-2026-011 (aanleg), OFF-2026-012 (vrij, leeg), OFF-2026-013 (onderhoud).*

## 1. Kliktelling en tijdpad

### (a) Aanleg — tot offerte met regels: **14 klikken, 7 schermen**

| # | Handeling | Scherm |
|---|---|---|
| 1 | Klik "Nieuwe offerte" | Dashboard |
| 2 | Klik tegel "Tuinaanleg" (of toets A) | Tegel-modal (8 tegels) |
| 3 | Klik "Beginnen" | **Stap 1 Snelstart — voegt niets toe** |
| 4–5 | Dropdown openen + klant kiezen | Stap 2 Klant & Scopes |
| 6 | Scope "Bestrating" aanvinken | idem |
| 7 | "Volgende: Scope Details" | idem |
| 8–9 | Type "Pad" + oppervlakte typen | Stap 3 Details |
| 10 | "Volgende: Garantie" | idem |
| 11–12 | "Geen garantiepakket kiezen" + "Volgende" | **Stap 4 Garantie — 2 klikken om níéts te kiezen** |
| 13 | "Offerte Aanmaken" | Stap 5 Bevestigen |
| 14 | "Bekijk offerte" | Succesmodal |

Resultaat is wel goed: 5 automatisch berekende regels (arbeid + materiaal uit normuren, €1.067,84 incl.) zonder één regel handmatig in te voeren.

### (b) Onderhoud — **14 klikken, 7 schermen**
Zelfde patroon (stappen: Start, Klant & Scopes, Details, **Bouwstenen**, Bevestigen): tegel O → Beginnen → klant (2) → werkzaamheid "Gras" → Volgende → grasoppervlakte typen → Volgende → toggle "Gazon maaien" → **prijs per beurt handmatig typen (default €0, geen normuur)** → Verder → Offerte Aanmaken → succesmodal.

### (c) Ter vergelijking: het bestaande vrije pad — **6 klikken, 3 schermen**
`/offertes/nieuw/vrij` ("Overige diensten", toets V) bestaat al: intake (klant + soort werk) → "Naar de regel-editor" → offerte krijgt direct een OFF-nummer → "Vrije regel" = regel in beeld. Dit ís in feite de gevraagde "Vrije offerte"-ingang; hij zit alleen verstopt als 8e tegel.

### Wat dubbel wordt gevraagd
- **Werkzaamheid 2×**: de modal vraagt "kies de werkzaamheid", maar bij de hoofdtegel "Tuinaanleg" is in stap 2 níéts voorgeselecteerd — je kiest de werkzaamheden daar opnieuw. Alleen de sub-tegels (Bestrating, Beregening…) selecteren echt voor.
- **Snelstart-copy liegt bij voorselectie**: met `?scope=bestrating` zegt stap 1 nog steeds "Je begint blanco en kiest in de volgende stap zelf de werkzaamheden" — terwijl Bestrating al aangevinkt klaarstaat.
- **Oppervlakte 2× (onderhoud)**: stap 2 vraagt "Totale tuinoppervlakte" (default 150), stap 3 opnieuw "Grasoppervlakte" (default 0); de bevestiging toont Tuinoppervlakte "—".
- **Maaien 2× (onderhoud)**: stap 3 "Werkzaamheden: Maaien" (toggle) en stap 4 nogmaals "Gazon maaien" als bouwsteen — twee lagen voor hetzelfde begrip.
- **"Concept opgeslagen" vs "Offerte Aanmaken"**: auto-save maakt al een concept bij de éérste scope-klik (onderhoud zelfs al vóór er een klant is), maar stap 5 heet "Offerte Aanmaken". Toasts stapelen zich op (4+ tegelijk gezien).

## 2. Per scherm

**Tegel-modal** — 8 tegels, Tuinaanleg/Onderhoud terecht prominent, lettertoets-badge per tegel, footer legt de toetsen uit. Functioneel dicht. Botst met Loof & Leem: tegeliconen in losse Tailwind-paletkleuren (sky/lime/amber/zinc/cyan), geen thematokens.

**Stap 1 Snelstart** — het pijnpunt klopt: bij 0 pakketten is dit een leeg drempelscherm (sparkle-icoon, 2 regels tekst, 1 knop, verder witruimte). De code (`package-selector.tsx`) toont hier pakket-tegels zodra die bestaan, maar zolang dat niet zo is, is de stap 100% overbodig. Kop in Geist 30px — Fraunces is als `--font-display` geladen maar wordt hier nergens gebruikt.

**Stap 2 Klant & Scopes** — drie Cards + rechterrail. Sterk: de klant-dropdown (recente klanten mét laatste offertenummer, status en ouderdom). Zwak: "Bereikbaarheid: Goed (factor 1.0)" is calculatiejargon in een keuzeveld; de samenwerking-slider (1–5, "Huidige inschatting: 3 - Normaal") is een tweede abstracte parameter vóórdat je iets concreets hebt gekozen — beide horen eerder bij calculatie-fijnslijpen dan bij de entree. Scope-checkboxes hebben geen programmatisch label (a11y; automation/screenreaders zien 9 naamloze checkboxes). "Verplichte onderdelen"-melding is vaag ("Sommige geselecteerde scopes hebben…").

**Stap 3 Scope Details** — het beste scherm: Pad/Oprit/Terrein-keuze tovert een "Berekende fundering"-lagendiagram (straatzand 5 cm, puin 10 cm) met uitleg, validatie per scope in de rail. Kanttekening: validatiestatus ("0/1 compleet") ververst pas bij blur van het veld.

**Stap 4 Garantie** — drie pricing-cards (€299/€599/€999, "Meest gekozen"-badge). Oogt als een SaaS-landingspagina, niet als vakwerk-software; bedragen hardcoded. Een hele stap voor één keuze, en "geen garantie" kost 2 klikken (grijze tekstlink + aparte Volgende-knop).

**Stap 5 Bevestigen** — nette samenvatting + checklist rechts, maar herhaalt vooral wat je net zelf invulde. De "Let op"-uitleg (berekening op normuren) is goed.

**Succesmodal** — sterk: "Voorcalculatie invullen (Aanbevolen)" / "Offerte bewerken" / "Bekijk offerte" / "Naar overzicht" — duidelijke vervolgstappen.

**Stepper (1–5)** — nummers + labels, na stap 1 terugklikbaar. Functioneel maar generiek grijs/groen, Geist, geen enkel Loof & Leem-signatuur. De stapnamen verspringen per type (aanleg: Garantie op 4; onderhoud: Bouwstenen op 4).

## 3. Sneltoetsen
A/O/R/B/S/P/G/V werken (A getest: direct door naar de wizard) en zijn **goed ontdekbaar**: badge in elke tegelhoek + footer "Druk op de letter in de hoek om direct te kiezen". Ook "n" opent de modal. Minpunt: de letters zijn niet mnemonisch consistent (S = bestrating, G = reiniging, B = beregening) — bij een dropdown met 3 ingangen kan dit simpeler.

## 4. De tegenhangers: offertedetail en regels-editor
- **Detail (OFF-2026-011)**: rustig en volwassen — workflow-stepper (Concept → Voorcalculatie → Verzonden → Geaccepteerd), totaal in de header, "Volgende stap"-banner, regels gegroepeerd per scope, marge/BTW-blok, tijdlijn, project-kaart. Dit scherm draagt een lege offerte prima.
- **Bewerken (`/offertes/[id]/bewerken`)**: volwaardige regels-editor — regel toevoegen (met sneltoets-hint), scope-badge per regel, drag-handles, herbereken, live "Totalen (preview)", notities. **Klaar als landingspunt voor "Vrije offerte"** — vereist alleen dat er al een offerte-record is.
- **Vrije builder (`/offertes/nieuw/vrij`)**: lost precies dat op — maakt bij binnenkomst direct een offerte aan (OFF-2026-012) en biedt hoofdstukken, "Artikel uit bestand", vrije regels met marge per regel, korting, tekstblokken, live overzicht. De dropdown-ingang "Vrije offerte" kan hier vrijwel 1-op-1 op landen; overweeg alleen de klant-verplichting te verzachten (nu blokkeert "Kies eerst een klant" de editor).

## 5. Template-pad ("mijn sjablonen")
Klik op "mijn sjablonen" (stap 1) → scherm met kop **"Pakketten"** (naam klopt al niet met de link) dat opnieuw meldt: "Er zijn nog geen pakketten samengesteld… Je kunt een offerte bewaren met Opslaan als sjabloon." Zelfde boodschap als het scherm ervoor, 2 klikken verder, doodlopend. `TemplateSelector` bestaat (leest `standaardtuinen`), maar zonder data is dit pad een lus terug naar "Beginnen".

## 6. Conclusie richting de dropdown (Vrij / Scopes / Templates)
1. **Stap 1 Snelstart kan weg** zolang er geen pakketten zijn; de wizard kan direct op Klant & Scopes openen (–1 scherm, –1 klik, en de "blanco"-copy die bij voorselectie onjuist is verdwijnt vanzelf).
2. **"Vrije offerte" bestaat al** als route en is met 6 klikken de snelste weg naar een regel — alleen de ingang (8e tegel, toets V) verkoopt hem niet.
3. **"Templates" verdient een eigen ingang** met een echte lege staat (uitleg + voorbeeldsjabloon), niet een linkje met de verkeerde naam.
4. Garantie kan een kaart binnen Bevestigen worden i.p.v. een eigen stap (–1 scherm, –1 klik bij "geen").
5. Vormtaal: overal Card + standaard-Tailwindkleuren + Geist-koppen; geen Fraunces, geen Loof & Leem-tokens, pricing-card-esthetiek in stap 4 — de flow oogt als een generieke SaaS-wizard, niet als de kers op de taart.
