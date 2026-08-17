# Tijdlijn en gesprekscomposer

Kennis over twee bestaande componenten: `KlantTijdlijn`
(`components/tijdlijn/klant-tijdlijn.tsx`) en de gesprekscomposer. Lees dit als je
aan die componenten zélf werkt of ze ergens inhangt.

**Dit is geen wet voor nieuwe schermen.** Het zijn uitkomsten van het klantdossier —
dingen die je anders opnieuw ontdekt, met de meting of het bugverhaal erbij. Ontwerp
je iets nieuws, begin dan bij `docs/dev/ui-patronen.md`; laat je niet sturen door de
oplossingen hieronder alleen omdat ze hier staan.

## Tijdlijn-anatomie

`KlantTijdlijn` tekent een doorlopende rail met per gebeurtenis een knoop (het
kanaal-icoon in een schijfje). Vier dingen die je anders opnieuw ontdekt:

- De railkolom heeft `-my-2` nodig. Zonder dat stopt hij bij de tekst en valt er
  16px rij-padding tussen twee rijen — een stippellijn in plaats van een lijn.
- De rail is **niet** `bg-border`: die ligt op `--surface-primair` op 1,00:1, dus
  onzichtbaar. `bg-muted-foreground/40` blijft een token en meet 1,78:1 (licht)
  en 2,15:1 (donker). De rij-`divide-y` is weg: een streep dwars over de rail
  knipt hem stuk.
- **De rail loopt dóór de datumkoppen** en is alleen boven de allereerste en
  onder de allerlaatste knoop afwezig — `isEerste`/`isLaatste` zijn dus
  lijst-globaal, niet per datumgroep. De koppen zijn geen volle-breedte balken
  meer maar een label in de tekstkolom met een eigen railsegment. De oude
  per-groep-variant liet bij één entry per dag helemáál geen lijn zien (zo
  ontdekt in de Chat-module, waar elke dag één entry had).
- **Knoopkleur per kanaal** staat in `KANAAL_KNOOP`: telefoon `primary`,
  WhatsApp `chart-5`, e-mail `chart-3`, intern `scope-houtwerk` (bewust niet
  `chart-2`/`accent-warm`: die terracotta's meten 2,6 resp. 2,1:1 op hun
  10%-schijf in licht; houtwerk haalt 4,1:1), systeem gedempt + gestippeld.
  Iconen meten ≥3,3:1 op hun schijf in beide thema's; betekenis staat óók in
  `title` + sr-only tekst, de kleur is ondersteuning.

## Composer: één regel die openklapt bij focus

De controlestrip hangt aan `group-data-[open=false]/composer:hidden`. Let op: de
selects erin renderen in een portal, dus focus verlaat de composer — een naïeve
`onBlur` klapt hem dicht terwijl je een medewerker kiest.
`src/__tests__/components/composer-openklappen.test.tsx` bewaakt dat.

Op de dagstaat staat dezelfde composer in "Mijn taken"
(`components/dashboard/taak-composer.tsx`), met één verschil: daar staat de klant
niet vast, dus de strip begint met een compacte klantkiezer en zonder klant slaat
hij niet op. De taak komt op naam van de ingelogde medewerker — het blok heet "Mijn
taken"; toewijzen aan een collega blijft op het klantdossier. De kiezer is bewust
níét de `KlantKiezer` uit `offerte/klant-koppeling.tsx` (offertehistorie, leads,
"nieuwe klant" — veel te zwaar voor één regel in een bento-cel); gedeeld zijn alleen
`useKlanten` en `useKlantenSearch`. De strip monteert pas ná de eerste opening,
zodat de klantenlijst niet meelift op het laden van het dashboard. In tests: cmdk
selecteert in jsdom alleen op `fireEvent.click`, niet op `userEvent.click`.

## Het klikvlak is de hele regel, niet het invoerveld

Het veld is ~19px hoog in een regel van ~41px en het icoon links is geen invoerveld;
klikken op de regel deed daardoor niets. Omdat de knoppen pas ná het openklappen
bestaan, leest dat als "de knoppen werken niet". Een `onMouseDown` op de regel die
`preventDefault()` doet en het veld focust lost dat op — met een uitzondering voor
echte controls (`button, input, textarea, select, a, [role=combobox]`).
