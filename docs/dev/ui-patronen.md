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
