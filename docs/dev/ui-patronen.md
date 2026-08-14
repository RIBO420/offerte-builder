# UI-patronen: tabellen, secties, lege staten

## Tabellen: nooit zijwaarts scrollen

De app scrolt bewust nergens horizontaal — liever inkorten. `ResponsiveTable`
(`src/components/ui/responsive-table.tsx`) heeft daarvoor twee kolom-opties:

- `width?: string` — Tailwind-class (`w-[30%]`, `w-[88px]`). Zodra één kolom een
  width heeft, schakelt de tabel naar `table-fixed` en korten lange waarden in.
- `allowOverflow?: boolean` — zet `overflow-hidden` uit; nodig voor knoppenkolommen.

**Val hier niet in:** in `table-fixed` is een px-breedte **geen ondergrens**. Passen
de kolommen samen niet, dan schaalt de browser ze allemaal proportioneel mee — ook
je "vaste" 196px. Een rij met 5 icoonknoppen (≈184px nodig) verliest dan de eerste
knop buiten de cel. Oplossing bij >3 acties: potlood-knop + `DropdownMenu` met
`MoreHorizontal`, kolom `w-[88px]` + `allowOverflow`. Zie `klanten/page.tsx`.

`EmptyState` heeft een `compact`-variant (één regel i.p.v. ~180px). Gebruik die op
overzichtspagina's met meerdere secties, anders is een lege sectie de grootste.

## Werkschermsecties: `SectiePaneel`, niet `<Card>`

`src/components/ui/sectie-paneel.tsx` is het frame voor secties in een dossier of
werkscherm: één rand met een klein uppercase kopje, optioneel een teller en acties
rechts. Bewust géén `<Card>` — die brengt een eigen kop-, padding- en schaduwlaag
mee, en meerdere Cards onder elkaar lezen als losse eilanden. `SectieLegeStaat`
hoort erbij: een lege sectie legt uit waar hij voor is en blijft de kléínste sectie.
In gebruik door Tijdlijn (`components/tijdlijn/klant-tijdlijn.tsx`) en Taken
(`components/klanten/klant-taken-card.tsx`).

### Gewichtsklassen: `gewicht="primair" | "secundair" | "voetnoot"`

Eén frame zeven keer herhalen leest als "alles is even belangrijk" — dat was de
klacht over het klantdossier (`docs/design/plannen/klantdetail-hierarchie.md`).
`SectiePaneel` heeft daarom drie klassen. De prop is **additief**: zonder prop
krijg je `secundair`, de weergave die er altijd was — `sectie-paneel.test.tsx`
hoefde er geen regel voor te wijzigen.

| Gewicht | Waarvoor | Frame | Kopje |
|---|---|---|---|
| `primair` | werkstroom (taken, tijdlijn) | rand + `bg-surface-primair` + `shadow-xs` | 13px semibold, `text-foreground` |
| `secundair` (default) | gevulde naslag (onderhoud, offertes, facturen, gegevens) | rand + `bg-card`, kop `bg-muted/40` | 12px uppercase muted |
| `voetnoot` | sectie zonder inhoud | geen doos: leunt op het frame eromheen | 12px uppercase muted |

- **De vlakstap is een token, geen randtruc.** `--card` scheelt 1,05:1 van
  `--background` en kan dus geen hiërarchie dragen. `--surface-primair`
  (`globals.css`, licht én donker) haalt gemeten 1,25:1 resp. 1,26:1. Nooit een
  ad-hoc `bg-[#…]`.
- **Lege staat = `legeRegel`, niet `SectieLegeStaat`.** Heeft een sectie een kop,
  geef dan `legeRegel={{ tekst, hint }}` mee: die rendert áchter het kopje op
  dezelfde basislijn (zelfde `font-size`-box en `leading-4`, gemeten Δtop = 0px).
  De WS7-hint blijft dus staan, alleen compacter; loopt hij niet uit dan kort hij
  in met de volle tekst in `title` (nooit zijwaarts scrollen). `SectieLegeStaat`
  blijft voor secties zónder kop — de tijdlijn in de Chat-module.
- **Voetnoot leeft in een frame, niet los.** Drie kale secties naast elkaar lezen
  als weggevallen styling. Op het klantdossier zitten ze daarom samen in één
  `Dossier`-paneel met `divide-y`; de secties krijgen daar
  `className="rounded-none border-0 bg-transparent"` mee (`cn` = tailwind-merge,
  dus de className wint van `FRAME`).
- **Het gewicht komt uit de data, niet uit de aanroeper.** Elke sectie weet zelf
  of hij leeg is. Taken en tijdlijn blijven ook leeg `primair` — daar staat de
  composer, en dat is de reden dat je er bent. Onderhoud, offertes en facturen
  zakken leeg naar `voetnoot`. Een leeg zoekresultaat telt niet als leeg: dan is
  er wél inhoud, alleen niet zichtbaar, en houdt de sectie zijn eigen blok met
  "Filters wissen".

### Tijdlijn-anatomie

`KlantTijdlijn` tekent een doorlopende rail met per gebeurtenis een knoop (het
kanaal-icoon in een schijfje). Twee dingen die je anders opnieuw ontdekt:

- De railkolom heeft `-my-2` nodig. Zonder dat stopt hij bij de tekst en valt er
  16px rij-padding tussen twee rijen — een stippellijn in plaats van een lijn.
- De rail is **niet** `bg-border`: die ligt op `--surface-primair` op 1,00:1, dus
  onzichtbaar. `bg-muted-foreground/30` blijft een token en meet 1,53:1 (licht)
  en 1,74:1 (donker). De rij-`divide-y` is weg: een streep dwars over de rail
  knipt hem stuk; de datumkoppen dragen de leespauze.

Drie patronen die daar zijn vastgelegd:

- **Composer = één regel die openklapt bij focus.** De controlestrip hangt aan
  `group-data-[open=false]/composer:hidden`. Let op: de selects erin renderen in een
  portal, dus focus verlaat de composer — een naïeve `onBlur` klapt hem dicht terwijl
  je een medewerker kiest. `src/__tests__/components/composer-openklappen.test.tsx`
  bewaakt dat.
- **Container-queries, geen viewport-breakpoints.** `SectiePaneel` zet
  `@container/sectie`; smalle varianten schrijf je als `@max-[34rem]/sectie:…`.
  Nodig omdat dezelfde tijdlijn zowel in de brede klantpagina als in de smallere
  Chat-module staat — die moet niet meeliften op de schermbreedte.
- **Het klikvlak is de hele regel, niet het invoerveld.** Het veld is ~19px hoog in
  een regel van ~41px en het icoon links is geen invoerveld; klikken op de regel deed
  daardoor niets. Omdat de knoppen pas ná het openklappen bestaan, leest dat als "de
  knoppen werken niet". Een `onMouseDown` op de regel die `preventDefault()` doet en
  het veld focust lost dat op — met een uitzondering voor echte controls
  (`button, input, textarea, select, a, [role=combobox]`).
