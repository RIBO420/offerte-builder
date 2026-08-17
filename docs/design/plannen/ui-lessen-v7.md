# UI-lessen uit het v7-prototype — app-breed toe te passen

**Bron:** `toptuinen-klantdossier-v7.html` (SAIS, 17 aug 2026). Opdracht Ricardo: niet de componenten overnemen, maar de *lessen* — iconen in de tijdlijn, kleur voor gebiedsdifferentiatie en contrast, de gevulde knop voor extra kleur, grotere iconen. Doel: een smoothere, professionelere app zonder kleur-overdaad.

## Les 1 · Icoontegels met zonekleur (het `tl-icon`-patroon)

Het prototype zet vóór elk tijdlijn-item een **tegel van 34×34px** (radius 10) in een zachte zonetint, met het icoon (15px) in de donkere variant van diezelfde tint: telefoon = groen-tint + donkergroen icoon, e-mail = zachtblauw + blauw icoon, systeem = zachtgrijs + grijs icoon. Effect: je scant de tijdlijn op kleur zonder één woord te lezen, en het icoon is een anker in plaats van 14px-strooisel.

**Toepassen op:** `TijdlijnEntryRij` (klant-tijdlijn) — tegel per kanaal: telefoon/whatsapp = primary-tint, e-mail = verzonden-blauw-tint, intern/notitie = gedempt grijs, afspraak = aandacht-amber, systeem = grijs. Daarnaast: het "Laatste contact"-blok op de dossier-Actueel-tab en lijsten die nu een kaal lucide-icoontje naast tekst zetten.

**Regels:** de tégel draagt de kleur, het icoon neemt de donkere tintvariant (≥3:1 op de tegel); de tekst ernaast blijft in teksttokens; per lijst maximaal één tegelkolom. Bestaat er geen betekenis voor een kleur, dan grijs — geen kleur als decoratie.

## Les 2 · Twee zachte zonekleuren naast het groen

Het prototype gebruikt naast groen-tint precies twee andere zachte zones: **zachtblauw** (mail-icoon, "Particulier"-tag, status verzonden) en **zacht amber** (open/aandacht). Doordat blauw en amber eigen gebieden dragen, betekent groen weer iets (actief, eigen werk, akkoord) in plaats van overal te zijn.

**Toepassen met bestaande tokens** — geen nieuwe kleuren: blauw = de `status-verzonden`-familie (communicatie, e-mail, verzonden-statussen, klanttype-tags), amber = `surface-aandacht`/`status-herinnering` (wacht op actie), groen = `primary`/`surface-primair` (actief, akkoord, eigen werk). Sweep: chips en badges die nu allemaal grijs of allemaal groen zijn krijgen hun juiste zone.

## Les 3 · Eén gevulde hoofdknop per scherm

In het prototype is de primaire actie altijd een **gevulde groene knop** (Vastleggen, Nieuwe offerte) en al het andere outline of ghost. Dat geeft elk scherm één duidelijk kleuranker én een ondubbelzinnige hiërarchie.

**Toepassen als audit per werkscherm:** precies één gevulde `Button` (default variant) voor dé hoofdactie boven de vouw; secundaire acties `outline`; tertiaire `ghost`. Schermen waar de hoofdactie nu outline is (of waar drie knoppen gevuld zijn) worden rechtgezet.

## Les 4 · Statuspil met stip — overal

`st-*`-pillen in het prototype hebben altijd een stip in de statuskleur vóór het woord. Wij hebben `StatusBadge`; de les is consistentie: nérgens meer een kale tekststatus of een zelfgebouwd pilletje buiten het systeem.

## Les 5 · Iconen als ankers, niet als strooisel

Prototype: navigatie-iconen 18px, tijdlijn-tegels 34px, monogram 60px — en verder juist **géén** iconen (geen icoon boven elke kop, geen decoratie-icoontjes in kaarten). Groter waar het een anker is, weg waar het versiering is.

**Toepassen:** icoontegels (les 1) op de ankerplekken; decoratieve mini-iconen in kop- en statregels verwijderen waar ze geen functie hebben.

## Uitvoering

- **Sweep A — tijdlijn & zones:** icoontegels in `klant-tijdlijn.tsx` + dossier-Actueel; blauwe communicatie-zone (concept-mails, mail-chips); amber-zones nalopen. Gescheiden van de uren-bestanden (WS-C werkt daar).
- **Sweep B — knop-audit:** hoofdschermen dashboard, klanten(-detail), offertes, projecten, planning, rapportages, facturen, contracten, leads. Uren overslaan tot WS-C af is.
- Poort per sweep (typecheck/lint/test:run), pathspec-commits, visuele schouw door de hoofdsessie met het headless-recept.
