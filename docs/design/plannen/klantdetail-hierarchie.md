# Visuele hiërarchie klantdetailpagina — `/klanten/[id]`

*Fase 1: alleen onderzoek. Er is geen bronbestand gewijzigd en er is niets gecommit.
Schouw op 14 aug 2026, dev-server `localhost:3000`, ingelogd als staf, 1600×900,
licht én donker. Gemeten met `getBoundingClientRect()` en `getComputedStyle`, niet
geschat. Bouwt voort op [masterplan](masterplan.md), [distill §1.3](distill.md) en
[eindrapport](eindrapport.md) — niets daaruit wordt teruggedraaid.*

De klacht van de eigenaar, letterlijk: *"dit is nu moeilijk te overzien doordat alles
evengroot is enzovoorts."* Dat is geen smaakoordeel. Het is meetbaar, en de meting
valt harder uit dan de klacht.

---

## 1. Diagnose

### 1.1 Zeven panelen, één gewichtsklasse

Op elk dossier staan **zeven `section`-frames** (vijf links, twee rechts). Gemeten
computed styles, alle zeven identiek:

| Eigenschap | Waarde, alle 7 gelijk |
|---|---|
| Kopje | `12px / 500 / uppercase`, kleur `lab(36.4 -4.4 2.8)` |
| Rand | `1px`, radius `10px`, zelfde randkleur |
| Achtergrond | `bg-card`, zelfde waarde |

Er zijn dus **geen twee gewichtsklassen** op deze pagina — er is er één, zeven keer.
De hele typografische hiërarchie van het *frame* bestaat uit precies twee stappen:
`h1` 24px en 7× kopje 12px (verhouding 2,0). Daartussen zit niets. Alles wat 14px is,
is inhoud, geen structuur.

**Het frame draagt de hiërarchie ook niet mee.** Gemeten contrast:

| Meting | Licht | Donker |
|---|---|---|
| Paneelvlak vs. paginavlak | **1,05:1** | **1,09:1** |
| Rand vs. paneelvlak | 1,31:1 | 1,29:1 |

Het paneel is dus geen vlak — het is een haarlijn van 1,3:1 om lucht heen. In donker
is dat nog zwakker: daar valt de scheiding vrijwel weg en lees je vijf keer dezelfde
grijze omtrek op één egaal donker vlak. Wat overblijft aan kleur op de hele pagina is
de groene knop *Onderhoud* en de rode GDPR-regel — en dat zijn precies de twee dingen
die kantoor het minst nodig heeft.

### 1.2 Lege secties gedragen zich als hoofdstukken

Gemeten op **E2E Test Klant 1783647584038** (het bijna-lege dossier, 1600×900,
werkviewport 884px):

| Sectie | Hoogte | Inhoud |
|---|---|---|
| TAKEN | 116px | leeg |
| TIJDLIJN | **136px** | leeg |
| ONDERHOUD | 105px | leeg |
| OFFERTES | **91px** | 1 offerte, € 125,24 |
| FACTUREN | 93px | leeg |

- **Vier lege secties = 450px = 51% van de werkviewport.** De helft van het eerste
  scherm is de mededeling dat er niets is.
- Een **lege** TIJDLIJN (136px) is **1,5× zo hoog** als een **gevulde** OFFERTES (91px).
  De sectie zonder inhoud is letterlijk de grootste van de pagina.
- De eerste echte inhoud staat op **y = 573px**: 65% van het eerste scherm is verbruikt
  vóór het eerste feit.

### 1.3 Drie dossiers, één silhouet

Dit is de scherpste bevinding. Ik heb drie dossiers gemeten:

| Dossier | TAKEN | TIJDLIJN | ONDERHOUD | OFFERTES | FACTUREN |
|---|---|---|---|---|---|
| E2E Test Klant … (leeg) | 116 | 136 | 105 | 91 | 93 |
| Anouk Willems (middenmoot) | 116 | 136 | 105 | 91 | 93 |
| Bouwbedrijf Frissen B.V. (meest gevuld) | 116 | 136 | 105 | 91 | 91 |

**Pixelidentiek.** Een testklant zonder geschiedenis en een zakelijke klant met een
offerte van € 22.972 en een vervallen factuur van € 17.307 hebben exact hetzelfde
silhouet. De pagina kan niet vertellen of een klant heet of koud is.

Dat is geen toeval van de demodata-selectie; ik heb de hele dev-deployment nageteld:

```
klantTijdlijn        → 10 van de 12 entries horen bij twee inmiddels verwijderde klanten
klantTaken           → 2 rijen, beide bij een verwijderde klant
onderhoudscontracten → 1 rij, bij een verwijderde klant
offertes / facturen  → levende klanten hebben er maximaal 1 en 1
```

Van de **27 levende klanten heeft er geen enkele** een tijdlijnitem, een taak of een
onderhoudscontract. **Elk** dossier dat kantoor vandaag opent, heeft dus drie tot vier
lege secties die zich als hoofdstuk gedragen. De eigenaar kijkt niet naar een
randgeval — hij kijkt naar de standaardsituatie.

### 1.4 En bij een vólle klant kantelt het probleem, het verdwijnt niet

Omdat een vol dossier in de demodata niet bestaat, heb ik er één gesimuleerd
(client-side DOM-injectie op Bouwbedrijf Frissen, met de echte rijhoogtes van de
componenten: offerte-/factuurrij 51px gemeten): 5 taken, 8 tijdlijnitems, 2
onderhoudsregels, 12 offertes, 6 facturen.

| Sectie | Hoogte | Bovenkant in het document |
|---|---|---|
| TAKEN | 340px | 156 |
| TIJDLIJN | 552px | 516 |
| ONDERHOUD | 160px | 1088 |
| OFFERTES | 663px | 1268 |
| FACTUREN | 351px | 1950 |

- Totale pagina **2317px = 2,6 schermen**.
- De rechterkolom is op `y = 611` klaar. Daaronder staat **1690px (73%) leeg
  sticky-rail** naast een werkkolom die gewoon doorloopt.
- Nog steeds zeven identieke kopjes: bij vol wordt het niet overzichtelijker, het wordt
  een ononderbroken band van 2,6 schermen zonder één rustpunt of ankerpunt.

### 1.5 De zwaarste elementen bedienen niet waarvoor kantoor komt

Gemeten klikoppervlak op een gewoon dossier:

| Element | Afmeting | Oppervlak |
|---|---|---|
| Knop **GDPR-verwijderverzoek** (rood, volle railbreedte) | 320 × 36 | **11.520 px²** |
| Knop **Onderhoud** (gevuld merkgroen) | 123 × 36 | 4.428 px² |
| Knop **Aanleg** (outline) | 98 × 36 | 3.528 px² |
| **Telefoonnummer** (`tel:`-link) | 74 × 20 | **1.480 px²** |

Het telefoonnummer — de reden waarom kantoor deze pagina het vaakst opent — krijgt
**7,8× minder visueel oppervlak dan een onomkeerbare AVG-actie** die misschien twee
keer per jaar wordt gebruikt, en 3× minder dan een knop die een nieuwe offerte start.

Twee bijkomende constateringen uit dezelfde inventarisatie:

- De vijf sectiekoppen dragen elk hetzelfde icoon + dezelfde 26×26 `Wat is …?`-knop.
  Vijf keer dezelfde chrome versterkt precies het "alles is hetzelfde"-gevoel. *(De
  uitleg zelf is WS7-winst en moet blijven — het is de herhaling van de vórm die
  ruis is, niet de inhoud.)*
- **De twee grootste knoppen verliezen de klant.** `Aanleg` en `Onderhoud` linken naar
  `/offertes/nieuw/aanleg` respectievelijk `/offertes/nieuw/onderhoud` **zonder
  klant-parameter**, en die wizards lezen ook geen `klantId` uit de URL. Je staat in
  het dossier van Anouk Willems, klikt op de zwaarste knop van de pagina, en moet
  Anouk Willems opnieuw opzoeken. Ze omzeilen bovendien de `NewOfferteDialog` die in
  WS6 juist tot énige ingang is gemaakt. *(Aparte bug, zie §5/§7.)*

### 1.6 Onder 1280px valt het anker helemaal weg

De grid is `xl:grid-cols-[1fr_20rem]`. Onder 1280px stapelt de rechterkolom **onder**
alle vijf secties. Gemeten op 1200×900:

- Leeg dossier: telefoonnummer op **y = 846** — precies op de vouw.
- Vol dossier (zelfde simulatie): telefoonnummer op **y = 2345** — **2,6 schermen
  scrollen om te kunnen bellen.**

### 1.7 Samengevat

De pagina is niet lelijk en niet slecht gebouwd; het `SectiePaneel`-patroon is
verdiend en werkt. Het probleem is dat **één patroon zeven keer wordt ingezet zonder
gewichtsverschil**, en dat het enige middel dat het paneel heeft om zich te
onderscheiden — een rand van 1,3:1 — te zwak is om ooit hiërarchie te dragen. Er is
niets om je oog aan vast te maken, en de dingen die wél opvallen (rood, groen,
grootste knop) zijn de zeldzaamste acties.

---

## 2. Drie richtingen

Voor elke richting: wat het doet bij de **lege** klant (de huidige standaard) en bij de
**volle** klant (2,6 schermen).

### Richting A — Identiteitskop + gegroepeerde werkstroom

De kop wordt een echt ankerpunt: naam groot (Fraunces `--font-display` uit WS2), badges,
en daaronder de **contactregel** — telefoon groot en klikbaar, e-mail, adres, met de
bestaande `CopyButton`s. Contact verhuist dus uit de rail naar het anker.

Daaronder krijgt de linkerkolom **twee gewichtsklassen in plaats van vijf gelijke**:

- **Werkstroom (primair)** — TAKEN + TIJDLIJN, samen in één zichtbaar zwaardere band:
  echte vlakstap (paneel donkerder/lichter dan de pagina in plaats van 1,05:1), kopje
  13px `font-semibold` in `text-foreground` in plaats van 12px uppercase muted.
  *Structureel blijven het twee componenten* — de composers worden niet samengevoegd.
- **Dossier (secundair)** — ONDERHOUD, OFFERTES, FACTUREN: rand weg, alleen een
  scheidingslijn en het huidige kleine uppercase kopje. Referentie-materiaal, geen
  hoofdstuk.
- **Lege sectie (voetnoot)** — geen paneel meer, maar één regel: kopje + hint op
  dezelfde lijn, ±30px in plaats van 91–136px. De `uitleg`-tooltip (WS7) blijft in
  dat kopje staan.

**Bij leeg:** 450px lege panelen → ±90px voetnoten. Eerste echte inhoud van y=573 naar
±y=250. Het dossier past ruim op één scherm en het oog landt op naam + telefoon.
**Bij vol:** de werkstroomband is visueel het zwaarst en staat bovenaan; offertes en
facturen lezen als bijlage. De 2,6 schermen blijven, maar krijgen een leesvolgorde.

**Voor:** grootste effect voor de kleinste ingreep; raakt geen enkel getest patroon;
werkt identiek in licht en donker (de vlakstap is een token, geen randtruc); lost
§1.6 gratis op omdat contact in de kop zit, niet in de rail.
**Tegen:** de rail wordt magerder (alleen KvK/BTW/klant sinds/cijfers/instellingen) —
dat is een keuze die je bewust moet maken. `SectiePaneel` krijgt varianten, dus het
patroon wordt iets rijker in plaats van simpeler.

### Richting B — Twee koloms met dominante werkkolom

Kolomverhouding kantelen (bv. `[1fr_22rem]` → `[1.6fr_1fr]` of juist smaller), de
tijdlijn als één dominant vlak over bijna de volle hoogte, en de rail wordt een
volwaardige **contactkaart**: telefoonnummer op ±20px, knoppen Bellen / Mailen /
WhatsApp, daaronder de feiten.

**Bij leeg:** helpt maar half. Een dominant vlak dat leeg is, is een groot leeg vlak;
zonder de voetnoot-ingreep uit A blijft 51% van het scherm leegte — nu alleen
prominenter.
**Bij vol:** hier is het sterk: één duidelijke werkkolom, contact altijd binnen bereik,
de sticky rail wordt eindelijk benut in plaats van 73% lucht.

**Voor:** het beste antwoord op "waarvoor kom ik hier" bij een actieve klant.
**Tegen:** onder 1280px stort het in elkaar — de contactkaart valt terug naar positie
laatst, dus je moet alsnog een kop-variant bouwen (= A erbij). Zonder de
gewichtsvarianten van A blijft "alles evengroot" binnen de werkkolom bestaan. Het is
in de praktijk een deel-oplossing van A, geen alternatief.

### Richting C — Getabde secties

Kop met identiteit + contact vast; daaronder een tabstrip
`Werkstroom · Onderhoud (2) · Offertes (12) · Facturen (6)`, één sectie tegelijk in beeld.

**Bij leeg:** oogt opgeruimd — lege secties worden een tab met teller 0.
**Bij vol:** elke sectie krijgt de volle hoogte, geen 2,6 schermen meer.

**Voor:** maakt de vlakheid in één klap onmogelijk; past bij tabstrips die de app al
kent (offertes, projecten, instellingen).
**Tegen, en dat weegt zwaar:**
1. **Het dossier verliest zijn kernbelofte.** Kantoor komt hier voor "wat speelt er bij
   deze klant" — één blik. Tabs vervangen die blik door drie klikken en dwingen je
   te weten waar je moet zoeken.
2. **De vlakheid verhuist naar de tabbalk.** Vijf even grote tabs zijn hetzelfde
   probleem in kleiner formaat; alleen de tellers redden het, en die maken de tabbalk
   weer druk.
3. Botst met "één waarheid" uit PRD §2.3 (de tijdlijn ís het dossier) en met de
   compacte lege staten die WS7 net heeft opgeleverd — die zie je nooit meer.
4. Nieuw navigatieniveau + nieuwe staat (welke tab onthouden we? deeplinks?) voor een
   probleem dat gewicht heet, niet ruimte.

---

## 3. Aanbeveling

**Richting A, met de contactkaart-gedachte van B in de kop verwerkt. C afvoeren.**

Motivatie:

1. **Het echte probleem is gewicht, niet ruimte.** C lost ruimte op en maakt gewicht
   erger. A pakt gewicht aan en wint de ruimte er gratis bij (450px lege panelen → 90px).
2. **Wegnemen én versterken tegelijk.** Distill: vijf panelen worden drie randen minder
   en drie voetnoten. Bolder: het overblijvende primaire blok krijgt een échte vlakstap
   en een kop die niet gedempt is — met contrast dat 1,05:1 ver achter zich laat. Beide
   halve maatregelen falen: alleen randen weghalen maakt het vlakker, alleen één blok
   verzwaren maakt het drukker.
3. **Het bedient waar kantoor voor komt.** Uit de code afgeleid: bellen/mailen
   (`tel:`/`mailto:` + `CopyButton` + `KlantReminderBanner` die op telefoon en e-mail
   stuurt), zien wat er loopt (taken/tijdlijn/onderhoud), iets vastleggen (twee
   composers), een offerte of factuur terugzoeken, contract checken. Volgorde van de
   nieuwe hiërarchie: **wie is dit + hoe bereik ik hem** → **wat speelt er** → **wat
   ligt er vast**. De zeldzaamste actie (AVG) hoort onderaan en klein, niet als
   rodest element van de pagina.
4. **Het is de goedkoopste ingreep met het grootste effect** en raakt geen getest
   patroon: geen composer-wijziging, geen structuurwijziging in tijdlijn of taken,
   `SectiePaneel` krijgt alleen additieve props met de huidige weergave als default.

---

## 4. Uitvoering per bestand

### 4.1 `src/components/ui/sectie-paneel.tsx` — varianten, additief

Nieuwe prop `gewicht?: "primair" | "secundair" | "voetnoot"`, **default `"secundair"`
= exact de huidige weergave**. Dat is de harde eis: `src/__tests__/components/sectie-paneel.test.tsx`
(uitleg achter het info-icoon, geen infoknop zonder uitleg, telling alleen bij > 0) moet
groen blijven zonder één regel testwijziging.

| Gewicht | Frame | Kopje |
|---|---|---|
| `primair` | rand + **echte vlakstap** t.o.v. de paginakleur (mikpunt ≥ 1,25:1 in beide thema's, i.p.v. 1,05:1), `shadow-xs` | 13px `font-semibold` `text-foreground`, geen uppercase |
| `secundair` (default) | ongewijzigd | ongewijzigd (12px/500/uppercase/muted) |
| `voetnoot` | `border-0 bg-transparent`, geen radius, alleen `border-t` als scheiding, `py-1.5` | ongewijzigd, maar de lege regel schuift op dezelfde lijn achter de titel |

De vlakstap komt uit een token, niet uit een hardcoded kleur — WS2/WS10-regel: geen
ad-hoc chromatische klassen. Als `--card` te dicht op `--background` ligt om ≥1,25:1 te
halen, is de juiste plek `globals.css` (nieuw `--surface-primair`-token voor licht én
donker), niet een `bg-[#…]` in de component.

`SectieLegeStaat` krijgt een `inline`-modus: bij `gewicht="voetnoot"` rendert
`tekst` + `hint` als één regel achter het kopje in plaats van als blok eronder.
**De `hint`-teksten zelf blijven ongewijzigd** — WS7 heeft die net geschreven en ze
zijn de enige plek waar een lege sectie vertelt wat er komt te staan. Ze worden
compacter gepresenteerd, niet geschrapt. Wordt de regel te lang voor de kop, dan valt
hij terug op de huidige tweede regel; nooit horizontaal scrollen (harde regel 1).

Zolang `@container/sectie` blijft staan, blijven alle `@max-[34rem]/sectie:`-varianten
(o.a. de tijdlijn-toolbar) werken — container-queries blijven de norm, geen
viewport-breakpoints.

### 4.2 `src/app/(dashboard)/klanten/[id]/page.tsx` — de kop wordt het anker

1. **Identiteitskop.** `h1` naar `--font-display` (Fraunces, WS2) en ±30px. Badges
   blijven exact zoals ze zijn — de WS6-dedupe (`tags`-filter op klantType en
   contract-status) niet aanraken.
2. **Contactregel onder de naam.** Telefoon (groter, `tel:`, met `CopyButton`), e-mail
   (`mailto:`, `CopyButton`), plaats/adres. Dit is de belangrijkste ingreep uit §1.5 en
   §1.6 tegelijk: het telefoonnummer wordt het tweede dat je ziet en het staat óók
   onder 1280px bovenaan. De bestaande `CopyButton`-labels blijven ongewijzigd.
3. **Acties degraderen.** `Aanleg` + `Onderhoud` worden één knop `Nieuwe offerte` die
   de `NewOfferteDialog` opent — dat is de WS6-afspraak "één ingang", en deze pagina is
   de laatste plek die eromheen linkt. **TT-004 blijft ongemoeid**: geen nieuwe
   `offertes.type`-waarden, de acht tegels blijven wat ze zijn. Wil je twee knoppen
   houden, dan `variant="outline" size="sm"` — maar dan blijft de klantcontext-bug
   staan (§7).
4. **Groeperen in de linkerkolom.** Boven het dossierdeel een klein label of
   scheidingslijn (`Dossier`), zodat het oog ziet dat er twee soorten blokken zijn:
   werkstroom boven, archief onder. Geen nieuw component nodig.
5. **Lokale `Paneel` opheffen.** De `Paneel`-helper in dit bestand (r. 104–119) is een
   tweede implementatie van `SectiePaneel` zonder icoon/uitleg/telling. Vervangen door
   `SectiePaneel gewicht="voetnoot"` (of `"secundair"`): scheelt twee van de zeven
   identieke frames en volgt CLAUDE.md-regel 3. De `Feit`-helper blijft zoals hij is.
6. **GDPR-regel temmen.** Van een 320×36 rode volle-breedte-knop naar een kleine
   tekstlink onderaan de rail, of naar een `DropdownMenu` bij de kop (admin-only, zoals
   nu). Onomkeerbare acties horen bereikbaar en stil te zijn; nu is het het rodest
   gekleurde element van het scherm.
7. **CIJFERS-subregel laten staan** — die is in WS6 net van kaartblok naar één regel
   gebracht en is nu goed.

### 4.3 De vier sectiecomponenten — alleen `gewicht` doorgeven

Elk van deze componenten weet zelf al of hij leeg is; ze hoeven alleen die kennis in
de prop te vertalen:

- `src/components/klanten/klant-taken-card.tsx` → `gewicht="primair"`; bij 0 taken
  `"voetnoot"`. De composer, het openklap-gedrag en het klikvlak-op-de-hele-regel
  blijven **volledig ongewijzigd** (`composer-openklappen.test.tsx`).
- `src/components/tijdlijn/klant-tijdlijn.tsx` → `gewicht="primair"`; bij 0 entries
  `"voetnoot"`. Let op: alleen de `toonPaneel`-tak; de paneelloze variant voor de
  Chat-module niet aanraken. De WS7-regel "zoek/filter pas vanaf ±8 items" blijft.
- `src/components/klanten/onderhoud-sectie.tsx` → `"secundair"`, leeg `"voetnoot"`.
  De actie `Losse beurt` moet ook in de voetnoot-variant bereikbaar blijven (`acties`
  rendert al in de kop, dus dat werkt).
- `src/components/klanten/klant-documenten.tsx` (`KlantOffertesSectie`,
  `KlantFacturenSectie`) → `"secundair"`, leeg `"voetnoot"`. De factuur-actie
  ("€ … open") blijft in de kop.

### 4.4 `src/app/globals.css` — alleen als de vlakstap een token nodig heeft

Eén nieuw oppervlaktetoken voor licht én donker, in de Loof & Leem-as (groengetinte
neutralen, geen puur wit/zwart). Geen nieuwe kleuren, geen ad-hoc klassen.

### 4.5 Verificatie na uitvoering

Zelfde grondslag als het eindrapport, niet naar het oog:

- `getBoundingClientRect()` op alle secties in de drie dossiers uit §1.3 — de drie
  silhouetten moeten aantoonbaar uit elkaar lopen.
- Vlakstap primair vs. pagina met canvas/lab-meting in **beide** thema's.
- `scrollWidth === clientWidth` op 375 / 768 / 1600 (harde regel 1).
- Positie van het telefoonnummer op 1200px breed: moet ruim boven de vouw komen.
- `npm run typecheck && npm run lint && npm run test:run` — de ±2958 tests groen,
  zónder aanpassingen aan `sectie-paneel.test.tsx` of `composer-openklappen.test.tsx`.
- Beide thema's visueel na, met `navigate force:true` (harde regel 7).

---

## 5. Wat NIET verandert

1. **Het composer-patroon.** Openklappen bij focus, de portal-valkuil bij `onBlur`,
   klikvlak = hele regel. Getest in `composer-openklappen.test.tsx`. Ook de
   distill-afspraak "composers niet samenvoegen, alleen onderscheiden" blijft staan.
2. **Het defaultgedrag van `SectiePaneel`.** `gewicht` is additief; zonder prop is de
   uitvoer byte-voor-byte de huidige. `sectie-paneel.test.tsx` mag niet gewijzigd hoeven.
3. **De `uitleg`-tooltips en WS7-hints.** Blijven inhoudelijk gelijk; ze worden alleen
   compacter gepresenteerd. Uitleg blijft achter het info-icoon — nooit terug als
   alinea in beeld.
4. **TT-004.** `offertes.type` houdt exact twee waarden; de acht werkzaamheden-tegels
   in `NewOfferteDialog` blijven startpunten, geen types. Geen literals toevoegen.
5. **WS4-statuskleuren.** `KLANT_PIPELINE_CONFIG` / `statusClasses` uit
   `src/lib/constants/statuses.ts` blijven de enige bron; geen lokale kleurmap terug.
6. **WS6-winst.** Headerbadge-dedupe en de CIJFERS-subregel blijven zoals ze zijn.
7. **Secties verwijderen.** Geen enkele sectie verdwijnt — alleen indikken en
   herwegen (distill §3: "secties uit het klantdossier verwijderen: bewust niet doen").
8. **Container-queries.** `@container/sectie` blijft; geen viewport-breakpoints in
   sectie-interne varianten.
9. **Nooit horizontaal scrollen.** Ook niet in de nieuwe voetnoot-regel of de
   contactregel: inkorten gaat vóór uitwijken.
10. **`EmptyState compact`** blijft de norm op pagina's met meerdere secties.

---

## 6. Volgorde

1. `SectiePaneel` + `SectieLegeStaat` varianten (met de bestaande tests als vangnet).
2. De vier sectiecomponenten schakelen `gewicht` in — nog geen paginawijziging, zodat
   je de winst op lege dossiers los kunt meten.
3. `klanten/[id]/page.tsx`: identiteitskop, contactregel, lokale `Paneel` opheffen,
   GDPR temmen, acties degraderen.
4. Meten in beide thema's op 375 / 768 / 1200 / 1600, daarna de groene poort.

---

## 7. Losse bevinding, buiten dit plan

`Aanleg` en `Onderhoud` op het klantdossier linken naar `/offertes/nieuw/aanleg` en
`/offertes/nieuw/onderhoud` **zonder klant-parameter**, en die wizards lezen geen
`klantId` uit de URL (`use-onderhoud-wizard.ts` haalt de klant uit een selectie in
stap 1). Vanuit een klantdossier start je dus een offerte waarin je diezelfde klant
opnieuw moet opzoeken. Dit is een functioneel gebrek, geen hiërarchiekwestie — het
hoort in een eigen taak, tegelijk met de vraag of deze twee knoppen niet gewoon de
`NewOfferteDialog` moeten openen (WS6, "één ingang").

---

## 8. Geraakte bestanden

```
src/components/ui/sectie-paneel.tsx
src/app/(dashboard)/klanten/[id]/page.tsx
src/components/klanten/klant-taken-card.tsx
src/components/tijdlijn/klant-tijdlijn.tsx
src/components/klanten/onderhoud-sectie.tsx
src/components/klanten/klant-documenten.tsx
src/app/globals.css                                   (alleen bij een nieuw oppervlaktetoken)
docs/dev/ui-patronen.md                               (varianten documenteren bij het SectiePaneel-patroon)
```

Niet aanraken:

```
src/__tests__/components/sectie-paneel.test.tsx
src/__tests__/components/composer-openklappen.test.tsx
src/components/new-offerte-dialog.tsx                 (TT-004)
src/lib/constants/statuses.ts                         (WS4)
```
