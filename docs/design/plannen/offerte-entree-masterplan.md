# Masterplan: offerte-entree & werkbank

Consolidatie van `offerte-entree-inventaris.md`, `offerte-entree-schouw.md` en
`offerte-entree-patronen.md` (15 aug 2026). Uitvoering na goedkeuring, bouwagents
op Opus 5.

## Diagnose in één alinea

Aanleg én onderhoud kosten nu 14 klikken over 7 schermen tot een offerte met
regels; het bestaande vrije pad doet het in 6 klikken over 3. Stap "Snelstart" is
een leeg drempelscherm (pakketten zijn bewust leeg), de werkzaamheid wordt twee
keer gevraagd (tegel-modal én stap 2), garantie is een hele stap voor één keuze,
en het template-pad is een doodlopende lus — terwijl de templates-backend
(`standaardtuinen` + `createOfferteFromTemplate`) compleet en ongebruikt klaarligt.
De wizard draagt bovendien nergens Loof & Leem (Geist-koppen, losse kleuren).

## Fase A — Entree (klein, direct effect)

**A1. Split-button "Nieuwe offerte".** Hoofdklik → direct de tegel-dialog
(scopes kiezen; tegels + lettertoetsen A/O/R/B/S/P/G/V blijven). Chevron →
shadcn `DropdownMenu` met drie rijke rijen (icoon + titel + ondertitel +
sneltoets): **Vrije offerte** (V), **Scopes kiezen** (S), **Templates** (T).
Zelfde menu op alle plekken waar nu "Nieuwe offerte" staat; klantdossier-ingang
geeft `klantId` aan álle drie de paden door.

**A2. Snelstart-stap verwijderen.** `?scope=` en de tegel-dialog landen direct
op de eerste echte stap. De onjuiste copy ("Je begint blanco" terwijl een tegel
al voorselecteert) verdwijnt mee.

**A3. Vrije offerte = direct een lege offerte.** Route bestaat
(`/offertes/nieuw/vrij` → regel-editor). Fixes: `?klantId=` doorgeven (raakt nu
verloren), en klant **optioneel bij concept** maken (verplicht blijft hij bij
definitief maken/versturen) zodat "klik → leeg document" echt kan. Editor krijgt
een "Klant koppelen"-veld bovenin (zelfde klant-dropdown met recente offertes
als de wizard — die is goed).

**A4. Templates krijgen een gezicht.** `Sheet` rechts vanuit het menu: lijst
`standaardtuinen` met scope-tags, "Gebruik deze" → `createOfferteFromTemplate`
(nu nergens aangeroepen), plus "Nieuwe template" en beheer (hernoemen/
verwijderen). "Opslaan als template" vanuit een bestaande offerte sluit de
kringloop.

**A5. Dubbelvragen weg.** Werkzaamheid niet opnieuw in stap 2; garantie wordt
een inline sectie i.p.v. een stap ("geen garantie" = 0 klikken); onderhoud
vraagt oppervlakte en maaien nog maar één keer; de samenwerking-slider wordt
gepersisteerd of verwijderd (wordt nu weggegooid).

**A6. Offertenummer server-side reserveren** — het client-side ophalen vóór
create is een raceconditie zodra de entree sneller wordt.

## Fase B — De werkbank (de kers op de taart)

Der wizard verdwijnt: één werkblad waar de offerte **meteen bestaat** als
autosave-concept (Moneybird/Stripe-model, sluit aan op de bestaande autosave
die nu al vóór "Offerte Aanmaken" concepten maakt — begrippen kloppen dan weer).

- Links het document: regels, scope-secties met progressieve onthulling
  (klant, bereikbaarheid/factor, garantie als invulsecties, niet als stappen).
- Rechts het **scope-palet**: dezelfde acht kaarten met lettertoetsen; aanklikken
  voegt de scope met zijn bouwstenen live toe; sticky totaalkolom telt mee.
- Behouden pareltjes: funderings-lagendiagram, automatische regelberekening
  (type+m² → 5 regels), succesmodal met vervolgacties.
- Loof & Leem overal: Fraunces-koppen, tokens, rustige vlakken; geen
  SaaS-pricing-cards voor garantie.
- TT-004 onaangetast: alles blijft binnen `type: aanleg|onderhoud`;
  `bron` wordt consequent gezet (wizard-routes verdwijnen, `bron:"vrij"`-guard
  blijft kloppen).

## Gates

Typecheck, lint, alle tests, configurator-E2E onaangeroerd; ingelogde schouw
met kliktelling (doel: van 14 naar ≤6 klikken tot offerte met regels);
`?klantId=`-kringloop vanaf klantdossier op alle drie de paden getest.
