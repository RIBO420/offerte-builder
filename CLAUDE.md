# CLAUDE.md

Kort houden: harde regels en de kaart staan hier; het waarom en de stappenlijsten in
`docs/dev/`. Lees een detail-doc alleen als je taak dat onderwerp raakt.

## Project

Top Tuinen OS — bedrijfssoftware voor een Nederlands hoveniersbedrijf. Alle UI-tekst
is Nederlands. Naamregel: interne chrome zegt **Top Tuinen OS**; alles wat de klant
ziet (portaal, PDF, mail, publieke configurator) zegt **Top Tuinen**.

```
/src/      → Next.js 16 web-app (App Router, React 19, Tailwind v4, shadcn/ui)
/mobile/   → React Native Expo 54 (NativeWind, Tailwind-v3-syntax, theme in mobile/theme/, primair #4ADE80)
/convex/   → Gedeelde serverless backend (schema, auth, 65+ functiebestanden)
```

Convex is de enige backend voor web én mobiel; Clerk doet auth voor beide. Web en
mobiel delen géén UI-componenten.

## Commands

```bash
npm run dev:all      # next dev + convex dev samen — normale start (dev draait NIET standaard)
npm run dev:login    # browser inloggen als staf, zonder wachtwoord → docs/dev/dev-omgeving.md
npm run seed:demo    # demodata in de dev-deployment; seed:clear ruimt exact op → zelfde doc
npm run typecheck && npm run lint && npm run test:run   # de groene poort (Vitest, ~3000 tests)
npx playwright test configurator   # E2E zonder auth; auth-E2E is stuk → docs/dev/dev-omgeving.md
npx convex deploy --yes            # productie-deploy Convex
```

Mobiel: `cd mobile && npx expo start --ios`. `mobile/.npmrc` zet `legacy-peer-deps=true`
— niet verwijderen, anders faalt `npm ci` (o.a. in EAS Build).

## Harde regels

1. **Nooit horizontaal scrollen.** Liever inkorten; `ResponsiveTable` met
   `width`/`allowOverflow`; >3 rijacties → dropdown-patroon. Let op: in `table-fixed`
   is een px-breedte geen ondergrens. → docs/dev/ui-patronen.md
2. **`offertes.type` kent exact twee waarden** (`aanleg`, `onderhoud`) — TT-004. De 8
   werkzaamheden-tegels in `NewOfferteDialog` zijn startpunten (`?scope=…`), geen
   types. Nooit literals toevoegen: raakt 40+ switch-punten, filters, statistieken, PDF.
3. **`SectiePaneel`, niet `<Card>`,** voor secties in dossiers/werkschermen;
   `SectieLegeStaat` erbij; container-queries i.p.v. viewport-breakpoints;
   `EmptyState compact` op pagina's met meerdere secties. → docs/dev/ui-patronen.md
4. **Guard optionele velden vóór een index-`q.eq`** — `q.eq(veld, undefined)` matcht
   alle documenten zonder dat veld; `.unique()` alleen bij echte uniciteit. Voor
   voorcalculaties: gebruik `convex/lib/voorcalculatieLookup.ts`. → docs/dev/convex-patronen.md
5. **Normuren: nooit `if (normuur) …`** — gebruik
   `findNormuur(...)?.normuurPerEenheid ?? CONSTANTE`, anders wordt arbeid stilzwijgend
   €0. De fallback-constanten zijn schattingen, geen Top Tuinen-tarieven.
6. **Nooit `npm run build` naast een draaiende `next dev`** (gedeelde `.next/`).
7. **Wijziging niet zichtbaar? Vaste volgorde:** merkteken → browserpaneel-cache
   (`navigate force:true`) → dan pas dev-server herstarten (stale Tailwind-stylesheet).
   → docs/dev/dev-omgeving.md
8. **Committen mag, pushen alleen op expliciet verzoek.**

## Auth & routing (kort)

Root `/` ís het loginformulier (geen `/sign-in`-routes; sign-up uit). `src/proxy.ts`
(Next 16: `middleware`→`proxy`) gate't routes; klanten → `/portaal/overzicht`, staf →
`/dashboard`, op basis van de **Convex**-rol (niet de Clerk-claim). Rollen: `directie`,
`projectleider`, `voorman`, `medewerker`, `klant`, `onderaannemer_zzp`, `materiaalman`.
Klant-uitnodigingsflow en Clerk-vereisten: → docs/dev/auth-en-klantonboarding.md

## Domein (kort)

Offerte (concept → voorcalculatie → verzonden → geaccepteerd/geweigerd) · Klant ·
Aanleg-scopes (grondwerk, bestrating, parkeerplaats, beregening, borders, gras,
houtwerk, water_elektra, specials) · Onderhoud · Regels (materiaal/arbeid/machine) ·
Nacalculatie · Uren. Calculator: `src/lib/offerte-calculator.ts`; wizards:
`src/components/offerte/`; PDF: `@react-pdf/renderer`; forms: RHF + Zod.
`NumberInput`/`AreaInput` renderen `<input type="text" inputmode="decimal">`.

Nieuwe aanleg-scope toevoegen (leeft op ~15 plekken): → docs/dev/nieuwe-aanleg-scope.md
Feature-notities (klantTaken, Places/TT-006, klant-import): → docs/dev/convex-patronen.md

## Designprogramma (aug 2026)

Goedgekeurd masterplan met 10 werkstromen, volgordeketens en keuzepunten:
`docs/design/plannen/masterplan.md` (bronplannen ernaast). Richting: "Vakwerk in het
groen" / "Loof & Leem"-tokens, licht-eerst, dark blijft volwaardig.

## Openstaand (14 aug 2026)

- Places API (New) staat UIT in Google Cloud; `BedrijfZoeken` verbergt zichzelf tot die
  aan staat (= TT-006 live).
- Fallback-prijzen parkeerplaats/beregening zijn schattingen — kantoor moet eigen
  normuren/producten invoeren.
- E2E-auth stuk (pre-existing); aanpak-suggestie in docs/dev/dev-omgeving.md.
- Leveranciers-, medewerkers-, wagenpark- en machines-tabellen alleen nagerekend, niet
  visueel gecontroleerd.
