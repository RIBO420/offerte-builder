# Rapportage-schouw — bewijs voor het herontwerp

Geschouwd 15 aug 2026, desktop 1440×900, ingelogd als staf, demodata (seed) aanwezig.
Route: `/rapportages` (`src/app/(dashboard)/rapportages/page.tsx`), één pagina met
8 KPI-kaarten + 8 tabs. Alle bevindingen zijn in de browser gemeten en/of in de bron
geverifieerd. De klacht van de eigenaar ("veel te veel onduidelijke, niet mooie,
onoverzichtelijke grafieken en info") is meetbaar terecht — de vijf hoofdoorzaken
staan hieronder, daarna de schouw per tab.

## Vijf structurele oorzaken (paginabreed)

### 1. Álle token-grafieken renderen zwart — kapotte kleurformule
Elke recharts-grafiek kleurt met `hsl(var(--chart-N))`, maar de tokens zijn
`oklch(...)`-kleuren (`globals.css:300`). `hsl(oklch(…))` is ongeldige CSS → SVG-fallback
**zwart**. Gemeten in de browser: strokes/gradients verwijzen naar `hsl(var(--chart-1))`,
computed tokens zijn `lab(...)`. Gevolg: area-, bar- en funnel-grafieken zijn grijs/zwarte
blobs; de legenda "Aanleg / Onderhoud" toont twee kleuren-chips maar de grafiek één grijze
vlek; "Nacalculatie vs Voorcalculatie" heeft twee **identiek zwarte** series. Patroon zit
in 9 bestanden onder `src/components/analytics/` (o.a. `revenue-chart.tsx`,
`offerte-trend-chart.tsx`, `scope-margin-chart.tsx`, `trend-forecast-chart.tsx`).

### 2. Drie van de acht tabs tonen verzonnen cijfers naast echte
`page.tsx:52-93`: hardcoded sample-arrays ("in production, this would come from the API")
voeden Calculatie Analyse, Medewerkers en Projecten volledig of grotendeels. Fictieve
medewerkers (Jan de Vries, Henk Visser), fictieve projecten (Acme BV), fictieve scopes
die niet in het domein bestaan (Beplanting, Schutting, Verlichting) en fictieve totalen
(€336.000 omzet, €103.000 voorcalculatie) staan **zonder enige markering** naast de echte
€50.531 uit de header. Ook de sparklines op alle 8 KPI-kaarten zijn nep:
`kpi-cards.tsx:22-24` genereert ze met `generateTrendData(value, "up")` — de trendlijn
wijst dus altijd omhoog, wat de data ook doet.

### 3. De periode-filter liegt
11 opties in de dropdown (Deze Week … Vorig Jaar, Laatste 30/90 dagen, Aangepast), maar
`page.tsx:130-147` mapt ze op slechts 4 echte presets: **"Vorig Jaar" → "dit-jaar"**,
"Vorige Maand" → "deze-maand", "Deze Week" → "deze-maand", "Aangepast" → "alles".
Gemeten: filter op "Vorig Jaar" gezet → alle KPI's identiek aan "Dit Jaar" (63%, €9.113,
€50.531, 22). De vergelijk-toggle "vs Vorige Periode" voedt alleen de sample-tabs met
hardcoded "previous"-waarden (72, 720, 78 …) — pure fictie.

### 4. Dubbelingen en elkaar tegensprekende cijfers
Binnen /rapportages: `RevenueChart` staat 2× (Overzicht + Omzet & Forecast),
`ScopeMarginChart` 2× (Overzicht + Winstgevendheid), `TopKlantenTable` 2× (Pipeline +
Klanten, identiek). Tussen schermen spreken de getallen elkaar tegen:

| Begrip | /dashboard | /rapportages |
|---|---|---|
| Totale omzet | € 33.095 (t/m aug) | € 50.531 header · €45,6K Winstgevendheid-tab · €336.000 Projecten-tab |
| Pipeline voorcalculatie / verzonden | 4 / 4 | 16 / 12 |
| Conversie | 36% (4/11) | 31% · win rate 63% (5/8) |
| Gem. offertewaarde | € 8.274 | € 9.113 |
| Gem. doorlooptijd | — | 2 dagen (header) én 14 dagen (Projecten-tab) |

Vier "waarheden" voor omzet op één scherm; niemand kan hier op sturen.

### 5. Geen hiërarchie, geen vraag
8 identieke KPI-kaarten (zelfde maat, zelfde opbouw, elk met icoon-tegel in een eigen
willekeurige kleur: groen, blauw, oker, groen, paars, groen, groen, groen) schreeuwen
even hard — zelfde fout als het klantdossier vóór de gewichtsklassen. Twee ervan zijn
bovendien leeg ondanks demodata: "Reactietijd Klant 0 dagen" en "Terugkerende Klanten
0% (0 van 22)". Er is geen hoofdgetal, geen periode-vermelding per kaart ("Deze periode"
zegt niets), en de paginatitel belooft "offerte prestaties en omzet" terwijl 3 tabs over
projecten/medewerkers/nacalculatie gaan.

## Per tab

### Overzicht (3 grafieken)
Offertes per Maand (area, aanleg+onderhoud), Omzet (bar, Maand/Kwartaal-toggle),
Marge per Scope (h-bar). **Vraag-toets:** "hoe loopt mijn jaar?" — half beantwoord: de
area-grafiek toont aantallen, niet waarde; de vraag "waar sta ik nu t.o.v. doel" ontbreekt.
**Gebreken:** alle 3 grafieken zwart/grijs (oorzaak 1). Marge per Scope: **alle 9 balken
exact even lang (232 px gemeten)** — elke scope toont dezelfde 13%, de grafiek bevat nul
informatie en staat óók nog in Winstgevendheid. Scope-labels zijn rauwe enums met
wisselende kapitalisatie: "borders, Bestrating, gras, Grondwerk, water_elektra, specials".
X-as Omzet toont 4 maanden waarvan 2 leeg. **Interactie:** tooltip verschijnt niet bij
gewone hover (2× echt, 2× synthetisch getest) en bleef daarna juist **hangen** midden in
beeld terwijl de muis al op de tab-balk stond.

### Pipeline (funnel + tabel)
Sales-funnel Voorcalculatie 16 → Verzonden 12 → Afgehandeld 8 → Gewonnen 5, met
conversiepercentages ertussen; ernaast Top Klanten. **Vraag-toets:** "waar blijven mijn
offertes steken?" — dit is de duidelijkste tab, maar de funnel telt 16 waar de header
22 offertes claimt, en /dashboard zegt 4. **Gebreken:** Engels jargon ("Sales Pipeline",
"win rate") in een verder Nederlandse app; "Inzichten" is één regel gratuite tekst
("Sterke win rate bij verzonden offertes"). Geen klik-door van een funnel-trede naar de
betreffende offertes.

### Omzet & Forecast (2 grafieken + 3 kaartjes)
Trend & Forecast (historie + 3-maands voorspelling, toggles "Voortschrijdend gemiddelde"
en "Forecast") en daaronder **dezelfde** Omzet-grafiek als Overzicht. **Vraag-toets:**
"wat komt eraan?" — onleesbaar beantwoord. **Gebreken:** historie rendert als losse zwarte
puntjes zónder lijn, de forecast als één massieve donkergrijze berg — het belangrijkste
(historische trend) is onzichtbaar, de onzekerste data (voorspelling) domineert. Legenda
"Aanleg / Forecast / Gem. (3mnd) / Onderhoud" heeft geen zichtbare kleurkoppeling (alles
zwart). Forecast-samenvatting (10/11/13 offertes) dupliceert de grafiek in tekst.

### Klanten (1 tabel)
Exact dezelfde Top Klanten-tabel als in Pipeline, nu paginabreed. **Vraag-toets:** "wie
zijn mijn beste klanten?" — mager: 5 van 10 rijen staan op €0 (ruis in een "top"), de
kolommen "Totaal Omzet" en "Gem. Waarde" zijn identiek omdat elke klant 1 offerte heeft,
en de bedragen worden in dezelfde rij verschillend geformatteerd ("€17.436" naast
"€ 17.436"). Klantnaam linkt wél door naar het dossier (goed). Een hele tab voor een
gedupliceerde tabel is geen rapportage.

### Winstgevendheid (1 grafiek + 3 kaartjes + duplicaat)
Scope Winstgevendheid (ranking, toggle Gecombineerd/Omzet/Marge) + nogmaals Marge per
Scope. **Vraag-toets:** "waar lekt marge?" — de juiste vraag, fout beantwoord: alle balken
zwart, de rechter-as toont "1% … 7%" (ranknummers als percentages geformatteerd — betekenisloos),
de voetnoot noemt 23/18/16/15/7% terwijl de marge-grafiek eronder overal 13% toont, en
"Totale Scope Omzet €45,6K" spreekt de header (€50.531) tegen — ook de notatie wisselt
(€45,6K vs €50.531). Gem. Marge 13% kleurt rood zonder uitleg wat "goed" zou zijn.

### Calculatie Analyse (score + grafiek + tabel + 2 echte secties)
"Calculatie Nauwkeurigheid 78% · Goed" (hardcoded prop), Voorcalculatie vs Nacalculatie
(sample, fictieve scopes, beide series zwart), Scope Breakdown-tabel (sample: totaal
€103.000 vs €109.500). Daaronder de twee **enige echte** componenten: Normuur-suggesties
en Nacalculatie onderhoudsbeurten — beide leeg ("Nog geen suggesties", "Nog geen
uitgevoerde beurten"), als tekstblokken onder het nepgeweld. **Vraag-toets:** "calculeer
ik scherp?" — de vraag is goud waard, maar het antwoord is verzonnen; de echte inhoud is
leeg en staat onderaan.

### Medewerkers (3 kaartjes + grafiek + ranglijst)
Totaal Uren 760, Gem. Efficiëntie 80% "Goed", Actieve Projecten 30; stacked bars
declarabel/niet-declarabel (zwart/grijs); Productiviteit Ranglijst. **Alles sample-data**
met fictieve namen, terwijl de seed échte uren en medewerkers bevat. "Actieve Projecten 30"
vs "5 projecten totaal" in de Projecten-tab. **Vraag-toets:** "wie is productief?" — niet
te beantwoorden met nepdata; bovendien staat er al een aparte Uren-module.

### Projecten (3 kaartjes + statusverdeling + tabel + financieel blok)
Op Tijd 85%, Budget Nauwkeurigheid 92%, Gem. Doorlooptijd 14 dagen; Status Verdeling
(5 projecten); Recente Projecten; dan een tweede rij KPI's (€336.000 / €248.900 / 25,9% /
€87.100), Kosten Breakdown-donut en Maandelijks Overzicht. **Alles sample.** De donut is
nota bene de enige kleurrijke grafiek van de hele pagina — met hardcoded hexkleuren
(`#10b981`, `#3b82f6` … `page.tsx:78-84`) buiten het tokensysteem, en een legenda die
5× letterlijk "bedrag" zegt (dataKey lekt naar de UI). **Vraag-toets:** "verdien ik op
mijn projecten?" — met fictieve cijfers onbeantwoordbaar.

## Laadgedrag
Drie fasen met verspringingen: (1) skeleton met 4 KPI-blokken, terwijl de echte pagina
er 8 in twee rijen heeft; (2) volledig lege contentzone met vervagende header (spinner-
fase); (3) gefaseerde fade-in van kaarten en daarna nog eens pop-in van de grafieken
zodra de recharts-chunk laadt. Tab-wissel reset de scrollpositie naar boven en animeert
oud-uit/nieuw-in (`AnimatePresence mode="wait"`), waardoor de pagina bij elke tab even
"leeg knippert".

## Telling (samenvatting)
- 8 KPI-kaarten header + 6 sub-KPI-kaarten in tabs = 14 kaarten, geen enkele met expliciete periode.
- 11 grafieken over 8 tabs; **9 renderen zwart/grijs** door de hsl/oklch-bug; 1 (donut) kleurt met hex buiten de tokens; sparklines ×8 zijn verzonnen.
- 3 exacte duplicaten binnen de pagina; 5 begrippen met tegenstrijdige waarden tussen /dashboard, header en tabs.
- 3 van 8 tabs (deels 4, incl. accuracy-score) draaien op hardcoded sample-data.
- 1 grafiek (Marge per Scope) met 9 identieke balken van 232 px, 2× getoond.
- Filter: 11 opties → 4 echte periodes; "Vorig Jaar" bewezen identiek aan "Dit Jaar".
- Tooltips: niet oproepbaar bij hover, wel blijven hangen na verlaten van de grafiek.

**Kern voor het herontwerp:** kies per scherm één ondernemersvraag (kwartaal, pipeline,
marge), toon uitsluitend echte data met één waarheid per getal, repareer de kleurformule
naar de tokens, en geef elk scherm één hoofdgetal met ondersteunend detail — de rest kan weg.
