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
/convex/   → Gedeelde serverless backend (schema, auth, ~140 functiebestanden)
```

Convex is de enige backend voor web én mobiel; Clerk doet auth voor beide. Web en
mobiel delen géén UI-componenten.

## Commands

```bash
npm run dev:all      # next dev + convex dev samen — normale start (dev draait NIET standaard)
npm run dev:login    # browser inloggen als staf, zonder wachtwoord → docs/dev/dev-omgeving.md
npm run seed:demo    # demodata in de dev-deployment; seed:clear ruimt exact op → zelfde doc
npm run typecheck && npm run lint && npm run test:run   # de groene poort (Vitest, ~4650 tests)
npm run test:mobile                # mobiele hooktests (Vitest, staat niet in CI)
npx playwright test configurator   # E2E zonder auth; auth-E2E is stuk → docs/dev/dev-omgeving.md
npx convex deploy --yes            # productie-deploy Convex — alleen na expliciete go
```

Deploy: `git push origin main` = Vercel-productiebuild; Convex is een losse stap
(`npx convex deploy`). Deploy Convex vanuit een schone werkboom, anders gaat
ongecommit schema mee. Dev-deployment: `affable-rook-669`, prod: `impartial-dinosaur-829`.

Mobiel: `cd mobile && npx expo start --ios`; inloggen zonder wachtwoord via
`npm run dev:login -- --mobiel` + de Dev Login-knop (→ docs/dev/dev-omgeving.md). `mobile/.npmrc` zet `legacy-peer-deps=true`
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
9. **Alles is multi-tenant (Clerk Organizations).** Elke tenanttabel heeft `orgId`;
   lees de tenant met `requireOrg`/`requireOrgId`/`requireOrgContext` uit
   `convex/auth.ts` (org uit het JWT, nooit uit args), query via een `by_org…`-index
   en check losse documenten met `verifyOrgOwnership`. Nieuwe tabel → ook een keuze
   in `convex/lib/orgTabellen.ts` (typecheck dwingt dat af).

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
`docs/design/plannen/masterplan.md` (bronplannen ernaast). **Sinds okt 2026 geldt de
huisstijlgids van de klant** (Outfit, warm zwart/warm wit, mosgroen, goud als accent,
zwarte zijbalk): regels en tokens in `docs/design/huisstijl.md` — die gaat voor op
"Loof & Leem" in oudere plannen.

## Stand (5 okt 2026)

Live op prod: offerte/CRM/klantdossier v13, org-migratie, klantfeedback Mickey (13 sep).
**Gecommit maar NIET gepusht/gedeployed:** hub-/veldintegratie F01–F51 (uren-dagvoorstel,
werkbezoek+afvoer, aanhanger-retouren, protocollen, losse krachten, herinneringscron,
hub-XLSX-export, mobiele `app/werk/*`). Status en toestel-testlijst:
`docs/superpowers/implementation/2026-09-12-hub-eindstatus-f01-f51.md` en
`…/2026-09-12-expo-testoverdracht.md`. Uitrol vraagt: `convex deploy` (schema puur
additief), push, en een nieuwe native build (`expo-sharing`).

Open:
- Hub: toestelacceptatie (2 crewleden, offline kill/herstart, Android-CSV, XLSX in
  Excel), afvoertarieven/protocollen/herinneringsontvangers inrichten, back-upproef.
- B8: telefoonnummer-placeholder in `src/app/(public)/configurator/layout.tsx`.
- E2E-auth stuk; aanpak in docs/dev/dev-omgeving.md.
- Places API (New) staat UIT in Google Cloud; `BedrijfZoeken` verbergt zich tot die aan staat.
- Fallback-prijzen parkeerplaats/beregening zijn schattingen.
- Opschoning: 41 bestanden >800 regels, `formatCurrency`/`formatDate` 7-8× gedupliceerd,
  uren-/weekhelpers dubbel in `convex/lib` en `src/components/uren`.
