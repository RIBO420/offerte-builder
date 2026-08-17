# UI-patronen: tabellen, secties, lege staten

App-brede wet. Dit geldt voor élk scherm, ook een scherm dat nog niet bestaat.
Bouw je aan de tijdlijn of de gesprekscomposer zélf, lees dan óók
`docs/dev/componenten/tijdlijn-en-composer.md` — die kennis staat daar bewust apart,
zodat een nieuw ontwerp niet ongemerkt de keuzes van het klantdossier overneemt.

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
klacht over het klantdossier. `SectiePaneel` heeft daarom drie klassen. De prop is
**additief**: zonder prop krijg je `secundair`, de weergave die er altijd was —
`sectie-paneel.test.tsx` hoefde er geen regel voor te wijzigen.

| Gewicht | Waarvoor | Frame | Kopje |
|---|---|---|---|
| `primair` | werkstroom (taken, tijdlijn) | rand + `bg-surface-primair` + `shadow-sm` | 13px semibold, `text-foreground` |
| `secundair` (default) | gevulde naslag (onderhoud, offertes, facturen, gegevens) | rand + `bg-card`, kop `bg-muted/40` | 12px uppercase muted |
| `voetnoot` | sectie zonder inhoud | geen doos: leunt op het frame eromheen | 12px uppercase muted |

- **De vlakstap is een token, geen randtruc.** `--card` scheelt 1,05:1 van
  `--background` en kan dus geen hiërarchie dragen. `--surface-primair`
  (`globals.css`, licht én donker) haalt gemeten 1,22:1 resp. 1,29:1. Nooit een
  ad-hoc `bg-[#…]`.
- **Twee werkvlakken, niet één** (15 aug 2026). De eerste versie was één
  salietint voor de hele werkstrook, met chroma 0,011 — dat leest niet als
  kleur maar als vuil, en zo kwam het ook bij de eigenaar binnen ("de grijs
  groene achtergrond"). Nu: `--surface-primair` loofgroen voor werk dat van
  jóú is (taken, tijdlijn, werkbankpalet) en `--surface-aandacht` leem/amber
  voor wat je aandacht vraagt (alleen "Aandacht nodig"). Een aanroeper kiest
  het andere vlak met `className="bg-surface-aandacht"` — tailwind-merge laat
  die winnen van `FRAME`. Meetwaarden en grenzen staan in
  `src/__tests__/design/werkvlak-contrast.test.ts`; die test faalt als iemand
  de tint terugdraait naar "iets neutraler".
- **Het afvinkhokje van een taak is `TaakCheckbox`, niet `Checkbox`**
  (`components/taken/taak-checkbox.tsx`). De basiscomponent tekent zijn rand
  met `border-input`: gemeten 1,03:1 op het werkvlak en 1,32:1 op `--card` —
  onzichtbaar, en ver onder de 3:1 van WCAG 1.4.11. `TaakCheckbox` geeft hem
  een merkgroene rand op 75% (3,49:1 licht, 5,08:1 donker), een `--card`-
  vulling en de hitzone/wrapper-neutralisatie die de rij compact houdt.
  Dagstaat en klantdossier delen hem. Opvolgpunt: `border-input` is app-breed
  te licht voor een 3:1-rand.
- **`--destructive` is op deze vlakken géén tekstkleur.** Gemeten 4,2:1 —
  goed genoeg voor een prioriteitsstip (3:1), niet voor de 11px-regel
  "3 dagen te laat". Die gebruikt `--status-vervallen-text` (10,2:1 licht,
  9,1:1 donker) uit de ene statusbron.
- **Lege staat = `legeRegel`, niet `SectieLegeStaat`.** Heeft een sectie een kop,
  geef dan `legeRegel={{ tekst, hint }}` mee: die rendert áchter het kopje op
  dezelfde basislijn (zelfde `font-size`-box en `leading-4`, gemeten Δtop = 0px).
  De hint blijft dus staan, alleen compacter; loopt hij niet uit dan kort hij
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

## Container-queries, geen viewport-breakpoints

`SectiePaneel` zet `@container/sectie`; smalle varianten schrijf je als
`@max-[34rem]/sectie:…`. Nodig omdat dezelfde sectie zowel in een brede pagina als
in een smalle kolom kan staan — die moet niet meeliften op de schermbreedte.
