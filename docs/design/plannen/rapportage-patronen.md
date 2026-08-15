# Rapportage-patronen — onderzoek & advies

*Patronen-onderzoek voor het herontwerp van /rapportages · Loof & Leem · aug 2026*

**Huidige situatie** (`src/app/(dashboard)/rapportages/page.tsx`): één pagina met 8 tabs
(Overzicht, Pipeline, Omzet & Forecast, Klanten, Winstgevendheid, Calculatie, Medewerkers,
Projecten) en ±15 chartcomponenten in `src/components/analytics/`. Dit is het klassieke
"grafiekenmuseum": data-soorten als navigatie, grafieken als vulling. De hovenier moet zelf
het verhaal uit de grafieken destilleren — precies wat topproducten *niet* doen.

---

## 1. Wie doet dit goed — en wat is hun kerntruc

| Product | Kerntruc | Les voor ons |
|---|---|---|
| **Stripe** (revenue reports) | Eén heldcijfer per rapport ("Gross volume €X"), daaronder één grote lijngrafiek als *bewijs*, daaronder de transacties die het cijfer maken. Grafiek is nooit decoratie. | Cijfer → grafiek → onderliggende lijst is één onlosmakelijke drie-eenheid. |
| **Linear Insights** | Insights leven *in* de werk-view (naast de issuelijst), niet op een aparte analytics-pagina. Eén vraag per insight, één grafiektype, gedempte kleuren. | Rapportage dichter bij offertes/facturen brengen; klik-door is heilig. |
| **Mercury** (bank) | Rust als designprincipe: één gigantisch saldo, één kalme lijn, veel wit, typografie doet het werk. Geen enkele "KPI-card-rij met 8 tegels". | Groot cijfer in Fraunces kan een hele grafiek vervangen. |
| **Moneybird** (NL!) | Vermijdt boekhoudjargon, rapportages zijn *tabellen met periodes naast elkaar* + een samenvattend dashboard met doorklik. Amper grafieken — en niemand mist ze. | Ons publiek (hoveniers) is Moneybird-publiek. Vergelijkingstabel > grafiek voor "hoe sta ik ervoor". |
| **Runway / Causal** | Finance als *verhaal*: narratieve samenvattingen, hover-uitleg op termen ("wat is marge?"), Budget-vs-Actual verschillen worden in taal benoemd, niet alleen getoond. | Genereer één zin conclusie boven elke grafiek: "Je scoort 12% meer offertes dan vorige maand." |
| **Amie / Cron** | Data gepresenteerd als kalme, typografische compositie; hiërarchie door grootte en witruimte, niet door borders en cards. | Geen card-in-card; secties scheiden met witruimte en Fraunces-koppen. |

**Rode draad**: één verhaal per scherm · grote cijfers eerst · grafiek als bewijsstuk ·
altijd doorklikken naar de brondata · taal (een geschreven conclusie) boven visualisatie.

## 2. Antwoord-gedreven rapportage i.p.v. grafiekengrid

Het klassieke grid ordent op **datasoort** (omzet, klanten, marges…) — de mentale kaart van
een analist. De ondernemer denkt in **vragen**. Het patroon: elke sectie is één vraag met
één antwoord, en de navigatie bestaat uit die vragen zelf.

De vier vragen van de hovenier-ondernemer (dekken alle 8 huidige tabs):

1. **Hoe loopt deze maand?** → omzet, gefactureerd, uren; vergelijking met vorige maand/jaar. *(nu: Overzicht + Omzet)*
2. **Wat zit er in de pipeline?** → openstaande offertes, waarde, conversie, wat verloopt er. *(nu: Pipeline)*
3. **Waar blijft geld liggen?** → openstaande facturen, nacalculatie-verschillen, verlieslatende scopes. *(nu: Winstgevendheid + Calculatie)*
4. **Wat is mijn beste werk?** → topklanten, best renderende scopes/projecten, productiefste medewerkers. *(nu: Klanten + Medewerkers + Projecten)*

**Navigatie**: geen tabs per datasoort maar de vragen als sectiekoppen. Bij één pagina:
ankernavigatie (sticky, scroll-spy). Vragen zijn zelfverklarend — een tab "Winstgevendheid"
zegt een hovenier niets, "Waar blijft geld liggen?" alles.

**Anatomie van één antwoordblok** (Stripe-drieluik):
kop = de vraag → antwoordzin met heldcijfer ("**€ 48.200** gefactureerd, 12% meer dan juli")
→ hooguit één grafiek als bewijs → doorklik "Bekijk de 14 facturen →" naar de bestaande lijstpagina met filter.

## 3. Grafiekkeuze-discipline

Tufte's data-ink-principe en Observable Plot-filosofie: elke pixel die geen data codeert
moet weg; kies de *default*-vorm, versier niets.

**Beslisregels:**
- **Alleen een getal** — als de vraag "hoeveel?" is. Groot cijfer (Fraunces, `tabular-nums`),
  vergelijkingsdelta in tekst eronder ("+12% t.o.v. juli", groen/terracotta). Géén sparkline
  erbij — expliciet verboden door de frontend-design skill, en terecht: 60px trend zegt niets.
- **Staafgrafiek (horizontaal)** — als de vraag "wie/wat is de grootste?" is: topklanten,
  scopes, medewerkers. Horizontaal zodat Nederlandse namen leesbaar blijven zonder rotatie.
- **Staafgrafiek (verticaal, per maand)** — als de vraag "hoe verliep het per periode?" is
  bij ≤ 12 discrete periodes. Omzet per maand is staven, geen lijn (maanden zijn discreet).
- **Lijn/vlak** — alleen voor echte continue trends over langere tijd (12+ punten), max 2
  reeksen. Forecast als gestippelde voortzetting in hetzelfde chart, niet als apart chart.
- **Funnel → genummerde staafjes of stappenlijst** — een echte funnel-chart (trechtervorm)
  is decoratie; conversie is beter als "34 verstuurd → 21 geaccepteerd (62%)" met kleine staafjes.
- **Nooit**: pie/donut (vervang door staaf of percentagetekst), radar, dubbele y-assen,
  gauge-meters, 3D.

**Kleursysteem**: 1 hoofdkleur (Loof-groen, OKLCH hue 152) voor "de hoofdreeks / goed";
1 accent (terracotta) voor "aandacht nodig / vergelijking / verlies"; alle andere reeksen
in getinte neutralen (muted met groene ondertoon). shadcn charts ondersteunt dit direct via
`ChartContainer` + CSS-variabelen (`--chart-1`…): definieer er maar 2-3, niet 5.
Grid-lijnen bijna onzichtbaar, geen assen-borders, legenda alleen bij 2+ reeksen.

**Resultaat**: 3 grafiekvormen (staaf-h, staaf-v, lijn) + grote getallen + tabellen dekken
alles. De huidige ±15 chartcomponenten kunnen naar ±6.

## 4. Out-of-the-box richtingen

### A. "Maandrapport als leesbaar verhaal"
Een opgemaakte, artikel-achtige pagina per maand: Fraunces-kop ("Augustus 2026"), intro-zin
met de conclusie van de maand, daarna de vier vragen als hoofdstukken met grote cijfers en
grafieken als illustratie. Print-/PDF-vriendelijk: zo door te sturen naar de boekhouder.
- **Voor**: maximaal onderscheidend ("hoe is dit gemaakt?"-effect); perfect bij Loof & Leem
  (licht, editorial, Fraunces); deelbaar artefact met echte bedrijfswaarde; dwingt tot verhaal.
- **Tegen**: minder geschikt voor ad-hoc "even snel kijken"; periodekeuze (kwartaal/jaar/
  custom) breekt de maand-metafoor; geschreven conclusies vragen goede tekstregels per situatie.
- **Risico**: middel. Layout is eenvoudig (typografie-werk), maar de zinsgeneratie
  (NL, correct bij randgevallen: geen data, negatieve marge) vergt zorg. PDF-export bestaat al deels (`src/components/pdf`).

### B. "Eén scherm, vier vragen" (scrollverhaal met ankernavigatie)
Geen tabs, geen subpagina's: één verticale pagina met de vier vraagsecties, sticky
ankernavigatie links of bovenaan, scroll-spy markeert waar je bent. Periodefilter globaal en sticky.
- **Voor**: laagste leerdrempel; alles vindbaar door te scrollen; tabs met `forceMount`
  (huidige oplossing) verdwijnen; één gedeelde data-load; motion-choreografie per sectie mogelijk.
- **Tegen**: lange pagina — discipline nodig (max ~2 blokken per vraag), anders wordt het
  alsnog een museum; diepere analyses (calculatie-vergelijking per beurt) passen niet inline.
- **Risico**: laag. Grootste risico is inhoudelijke verleiding om alles te tonen; op te
  vangen met progressive disclosure ("Toon details" klapt tabel uit).

### C. "Vraag-en-antwoord-blokken met klik-door"
De vier vragen als grote, klikbare antwoordblokken (antwoordzin + heldcijfer + mini-bewijs).
Klik opent geen nieuwe grafiekpagina maar de *onderliggende lijst*: de offertes, facturen of
projecten die het cijfer maken, voorgefilterd op de bestaande lijstpagina's.
- **Voor**: hergebruikt bestaande lijstpagina's als "detail-laag" — minst nieuwbouw; cijfers
  zijn verifieerbaar (vertrouwen!); rapportage wordt actie-startpunt ("3 offertes verlopen
  bijna → klik → opvolgen").
- **Tegen**: minst "wow" als losse richting; trends krijgen weinig ruimte; zonder B erbij
  blijft het een (mooiere) tegel-grid.
- **Risico**: laag; vooral filter-parameters op lijstpagina's nodig.

### D. (eigen idee) "Seizoensdimensie"
Hoveniers denken in seizoenen, niet in kwartalen. Jaarvergelijking als "dit voorjaar vs.
vorig voorjaar"; de verhaalpagina krijgt een subtiele seizoensmarkering in de tijdas.
Klein toe te voegen aan elke richting; groot effect op herkenbaarheid ("dit is voor óns gemaakt").

## 5. Aanbeveling

**Hoofdrichting: B als skelet, C als bouwsteen, A als export.** Concreet:

1. **/rapportages wordt één scrollverhaal** met vier vraagsecties en sticky ankernavigatie
   (richting B). De 8 tabs verdwijnen; hun inhoud gaat op in de vier vragen volgens de
   mapping in §2. Calculatie-detail (beurt-nacalculatie, calculatie-vergelijking) wordt
   progressive disclosure binnen "Waar blijft geld liggen?" — uitklapbaar, niet standaard zichtbaar.
2. **Elk blok is een antwoordblok** (richting C): antwoordzin + Fraunces-heldcijfer +
   hooguit één grafiek + doorklik naar de voorgefilterde lijstpagina (offertes/facturen/projecten).
3. **"Verstuur maandrapport" / "Download PDF"** bovenaan genereert de leesbare
   verhaalversie (richting A) van de gekozen periode — de editorial kers, geen aparte view
   om te onderhouden maar een print-opmaak van dezelfde vier secties.
4. **Grafiekdieet** (§3): 3 vormen, 2 kleuren, geen pie/funnel/sparkline; van ±15 naar ±6
   chartcomponenten.
5. **Seizoenslabels** (D) in periodekiezer en jaarvergelijking.

**Motion & laad-choreografie:**
- Shell eerst: vier sectiekoppen + ankernav + skeletons met exacte eindafmetingen renderen
  direct — **nul layout-shift**, ook niet bij chart-hydratie (recharts blijft dynamic import;
  reserveer hoogte met `aspect-ratio`/vaste `min-h`).
- Eén load-choreografie: secties faden gestaggerd in (translate-y 8px → 0, opacity, ~80ms
  stagger, `ease-out-quint`), heldcijfers tellen kort op (≤ 400ms, alleen bij eerste load,
  respecteer `prefers-reduced-motion`).
- Periodewissel: geen skeleton-flits maar cross-fade van waarden; grafieken animeren via
  recharts' ingebouwde transitie, max 300ms.
- Ankernavigatie: `scroll-behavior: smooth` + scroll-spy; geen parallax of scroll-triggered
  effecten — rust is het merk.

**Bronnen**: Stripe Dashboard/docs (reporting charts), Linear Insights, Mercury,
moneybird.nl/rapporten (rapportagefilosofie NL-mkb), Runway (ambient intelligence /
narratieve BvA-uitleg, prnewswire 2024), ui.shadcn.com/charts, Observable Plot-docs,
Tufte *The Visual Display of Quantitative Information* (data-ink ratio).
