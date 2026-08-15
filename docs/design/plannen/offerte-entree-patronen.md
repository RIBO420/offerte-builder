# Offerte-entree: patronenonderzoek & advies

*Patronen-onderzoek voor de herstructurering van "Nieuwe offerte" — aug 2026.*
*Bronnen: Linear docs (issue creation/templates), Stripe Invoicing dashboard-docs,
Moneybird helpcenter, split-button-analyses (Coyle, Eleken, ServiceNow Horizon),
cmdk/command-palette-literatuur, plus de eigen codebase.*

## 0. Uitgangssituatie (codebase)

- `NewOfferteDialog` (`src/components/new-offerte-dialog.tsx`): dialog met 8
  werkzaamheden-tegels + lettertoetsen A/O/R/B/S/P/G/V. **Geliefd, werkt, en is
  in feite al "los scopes kiezen"** — elke tegel is een `?scope=…`-preset op
  aanleg of onderhoud (harde regel TT-004: exact twee typen, blijft zo).
- Daarachter: 5-stapswizard (Snelstart → Klant & scopes → Scope-details →
  Garantie → Bevestigen) in `offertes/nieuw/aanleg`, en `nieuw/vrij` met de
  vrije-regels-builder. Templates bestaan al als `standaardtuinen`
  (`template-selector.tsx`, `save-as-template-dialog.tsx`) maar zitten
  **verstopt ín de wizard** — er is geen eigen ingang.
- Conclusie vooraf: de drie gevraagde ingangen bestaan alle drie al; het
  probleem is niet functionaliteit maar **rangorde en reistijd**.

## 1. Hoe topproducten dit doen

**Linear** — "C" opent vanaf overal één rijke create-modal; templates zitten
*ín* die modal (knop naast teamnaam) en hebben óók een eigen sneltoets
(Alt+C). Geen dropdown-met-drie-smaken vooraf: één ingang, varianten erin.
Les: Linear laat de gebruiker nooit eerst kiezen *hoe* hij gaat aanmaken —
hij ís al aan het aanmaken, varianten zijn een detail binnen de modal.

**Stripe (invoices)** — "Create invoice" opent direct een **volledige editor
op één pagina**: links het formulier in secties (klant, regels, opties),
rechts een live-preview die meebouwt. Geen wizard; concept wordt bij verlaten
automatisch als draft bewaard. Les: het document bestaat meteen, de preview
is de voortgangsindicator, "advanced" zit achter uitklapsecties
(progressieve onthulling i.p.v. stappen).

**Notion** — nieuwe pagina is direct leeg en bewerkbaar; templates verschijnen
als *suggesties in de lege staat* ("Press / for commands, or pick a
template"). Les: leeg-beginnen en template-kiezen zijn geen aparte routes maar
één scherm waar de lege staat het werk doet.

**Figma** — full-page "create hub": grote tegels (Design file, FigJam, Slides)
plus templates eronder. Werkt omdat Figma-bestandstypen wezenlijk andere
editors zijn. Les: een create-hub is pas gerechtvaardigd bij écht
verschillende bestemmingen — onze drie ingangen eindigen alle drie in
dezelfde offerte-editor, dus een hub-pagina is hier te zwaar.

**Moneybird** (NL, dichtst bij onze doelgroep) — "Toevoegen" opent direct het
factuurscherm; contact kies je door op het adresblok te klikken, de
"workflow" (betaaltermijn, taal, herinneringen) kies je in datzelfde scherm.
Geen wizard, geen keuzemenu vooraf. Les: de NL-administratiestandaard is al
"één scherm, document bestaat meteen" — een hovenier die Moneybird kent
verwacht dit.

**Patroonvergelijk voor de knop zelf:**

| Patroon | Wie | Past hier? |
| --- | --- | --- |
| Dropdown (klik = alleen menu) | Google Drive "Nieuw" | Matig: élke klik kost een extra beslissing, ook de 9-van-de-10-keer-route |
| **Split-button** (klik = hoofdactie, chevron = varianten) | ServiceNow, MS Office, GitHub "Code ▾" | **Goed**: hoofdklik doet direct het gebruikelijke, varianten blijven één klik weg. Voorwaarde (Eleken/Coyle): één actie domineert duidelijk — hier: scopes kiezen |
| Command-menu (⌘K) | Linear, Vercel, Slack | Als *versneller* erbij, niet als enige ingang: kantoormedewerkers zijn geen ⌘K-publiek |
| Full-page create-hub | Figma, Canva | Nee: te veel ceremonie voor drie ingangen naar dezelfde editor |

## 2. shadcn-bouwstenen

- **`DropdownMenu`** is de juiste basis voor het menu: ondersteunt native
  icoon + `DropdownMenuShortcut`, en een rij mag gerust twee regels hoog zijn
  (titel + `text-muted-foreground`-ondertitel in een flex-kolom) — zie het
  "rich menu item"-patroon uit de shadcn-voorbeelden (o.a. team-switcher in
  het dashboard-block). Combineer met `DropdownMenuLabel` + `Separator` voor
  groepering. Alles al geïnstalleerd (`src/components/ui/dropdown-menu.tsx`).
- **`Command`** (cmdk, ook al geïnstalleerd) is de basis zodra er gezocht
  moet worden — templatelijst > ~6 items, of klant zoeken. Niet nodig voor
  een menu van 3.
- **`Dialog`** blijft voor de scope-tegels (bestaat al). **`Sheet`** (rechts)
  is het juiste chassis voor "templates snel kiezen zonder de pagina te
  verlaten" — een lijst met preview hoort niet in een dropdown gepropt.
- Split-button is geen shadcn-component maar triviaal: twee `Button`s in een
  `inline-flex` met `divide-x` en gedeelde rand; de rechter (chevron) is de
  `DropdownMenuTrigger` met `asChild`. Let op één gezamenlijke focus-ring en
  `aria-label="Meer manieren om te starten"` op de chevron.

## 3. Wizard verkorten: wanneer mag de stepper weg?

Een stepper is gerechtvaardigd bij (a) onomkeerbare stappen, (b) stappen die
elkaars invoer vereisen, of (c) éénmalige flows voor onervaren gebruikers.
Geen van drie geldt hier: kantoor draait dagelijks offertes, niets is
onomkeerbaar (concept-status bestaat), en scope-details hangen niet van
garantie af. Stripe en Moneybird bewijzen dat een factuur/offerte-editor op
één pagina kan zolang:

1. **het document meteen bestaat** (autosave als concept — `restore-draft-dialog`
   verdwijnt daarmee ook, drafts zijn gewoon offertes);
2. **secties zich progressief onthullen**: een scope aanvinken → het
   bijbehorende `scope-form` klapt open op dezelfde pagina; Garantie en
   verzendopties als ingeklapte secties onderaan (zoals Stripe's "advanced
   options");
3. **er één levende samenvatting is** (sticky totaalkolom of -balk) die de
   rol van "Bevestigen"-stap overneemt.

De huidige stap "Snelstart" en de tegel-dialog zijn dubbelop — dat is het
eerste dat sneuvelt. "Bevestigen" wordt een verzendknop met controle-drawer.

## 4. Out-of-the-box richtingen

### A. De Werkbank (offerte bestaat meteen, paletten ernaast)
Klik op een scope-tegel → je staat *direct in de offerte* (concept,
autosave). Links het werkblad met secties per scope; rechts een smal palet
met de overige scope-tegels (zelfde lettertoetsen!) — een tegel aanklikken
voegt de sectie ter plekke toe. Templates zijn een tab in datzelfde palet.
Bereikbaarheid/factor en klant zijn invulkaarten bovenaan het werkblad die
"nog instellen" tonen tot ze gevuld zijn (Notion-achtige lege staat).
- **Oplevert:** kortste route ooit (1 klik tot typen), tegels blijven de
  helden, wizard verdwijnt zonder functieverlies, en het palet maakt
  "scope er later bij" eindelijk vloeiend (nu: `scope-change-modal`).
- **Risico:** middelgroot-hoog. De 5 wizard-stappen en hun validatie
  (`validation-summary`, per-stap gating) moeten naar sectie-niveau;
  autosave-concept vergt Convex-mutatie bij creatie i.p.v. bij bevestigen.
  Goed op te knippen: eerst aanleg, dan onderhoud.
- **Past bij de hovenier?** Ja — dit ís Moneybird-gevoel maar dan met
  Top Tuinen-vakkennis (scopes, normuren) ingebakken. Kers-op-de-taart-waardig.

### B. Command-first ("typ wat je wilt")
De knop opent een `Command`-overlay: typ "bestrating jansen" → regels
"Nieuwe bestrating-offerte voor Jansen", "Template Strakke stadstuin", "Vrije
offerte". Lettertoetsen blijven werken als eerste-teken-filter.
- **Oplevert:** spectaculair voor demo's; klant+scope in één handeling.
- **Risico:** laag qua bouw (cmdk staat er al), maar hoog qua adoptie: dit
  beloont typers, terwijl de huidige tegels juist geliefd zijn omdat je
  *niet* hoeft na te denken. Superhuman/Linear-publiek ≠ hovenierskantoor.
- **Oordeel:** niet als hoofdingang; wél als gratis bijvangst — de bestaande
  ⌘K kan deze acties opnemen.

### C. Scope-canvas met live totaal
Full-screen canvas: de 8 tegels groot in het midden; aanklikken stapelt
kaarten in een "offerte-mand" die met richtprijzen (bestaat al:
`price-estimate-badge`) live een bandbreedte-totaal opbouwt. "Verder" →
werkblad met die scopes.
- **Oplevert:** verkoopgesprek-modus — met de klant aan tafel scopes
  aantikken en meteen een indicatie zien. Emotioneel de mooiste.
- **Risico:** richtprijzen vóór er ook maar één m² is ingevuld zijn
  gevaarlijk in een offertecontext (verankering bij de klant); en het is
  een extra scherm vóór het echte werk — reistijd neemt juist toe.
- **Oordeel:** niet als entree. Herbruikbaar idee: de mand-met-totaal is
  precies de sticky samenvatting van richting A.

### D. (gevraagde variant) Kleine dropdown met 3 opties
Werkt, maar degradeert de geliefde tegels tot optie 2 van 3 en voegt een
tussenstation toe aan de meest gelopen route. Als pure dropdown afgeraden;
als **split-button** (zie advies) is hij wél waardevol.

## 5. Aanbeveling

**Hoofdrichting: A (Werkbank), ontsloten via een split-button — niet via een
plain dropdown.** In twee fasen:

**Fase 1 (klein, direct te bouwen):** "Nieuwe offerte" wordt een
split-button in `offerte-toolbar.tsx`.
- *Hoofdklik* = wat men 9 van de 10 keer wil: de bestaande tegel-dialog
  (= ingang "Los scopes kiezen"; de dialog krijgt bovenin twee rustige
  extra rijen zodat alle drie de ingangen óók daar zichtbaar zijn).
- *Chevron* = `DropdownMenu` met drie rijke rijen (icoon + titel +
  ondertitel + shortcut): **Vrije offerte** (`V` — route `nieuw/vrij`
  bestaat), **Scopes kiezen** (`N` — tegel-dialog), **Templates** (`T` —
  nieuwe `Sheet` rechts: `standaardtuinen`-lijst met scope-tags en
  "Nieuwe template"-knop; kiezen → prefilled werkblad waar alleen klant en
  bereikbaarheid/factor nog open staan).
- Zo landen de drie gevraagde ingangen exact, zonder de snelste route ook
  maar één klik langzamer te maken.

**Fase 2 (de kers):** wizard vervangen door het werkblad met scope-palet
(richting A), met Stripe-achtige autosave-concepten en de sticky
totaalkolom. De tegel-dialog blijft de entree; hij levert alleen niet meer
af bij stap 1-van-5 maar midden in een levend document. TT-004 blijft
onaangetast: tegels en palet zetten alleen `?scope=…` binnen aanleg of
onderhoud.

Wat we bewust níet doen: full-page create-hub (te veel ceremonie),
command-first als hoofdingang (verkeerd publiek), richtprijzen vóór invoer
(verankering). De lettertoetsen A/O/R/B/S/P/G/V blijven overal het snelste
pad — in dialog, palet én ⌘K.
