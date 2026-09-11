# Plan: klantfeedback Mickey (WhatsApp 24 aug 2026)

Bron: zeven WhatsApp-berichten van Mickey Savelberg (Top Tuinen) met screenshots.
Onderzoek (11 sep 2026) van vier Explore-agents ligt hieraan ten grondslag; de
bevindingen met regelnummers staan in de taken hieronder.

Punten:
1. Lead direct als klant aanmaken/koppelen zonder "Gewonnen" → Task 3
2. WhatsApp als gesprekskanaal → Task 2
3. Voor-/achternaam, standaard sorteren op achternaam → Task 1, 5, 6, 8
4. Taak toewijzen aan Mickey/Yannick onder één directie-account → **geen code**
   (advies: eigen logins via Team → Uitnodigen; zie Rulings)
5. Klant bewerken vanuit dossier → vervalt (kan al via Instellingen)
6. Tweede adres (uitvoer vs. factuur), automatisch bij één adres → Task 1, 4, 5, 6, 7
7. Tweede telefoonnummer + vast notitieblok "bijzonderheden" → Task 1, 5, 6, 7, 8

## Global Constraints

- Repo: `offerte-builder/` (Next.js 16 App Router, React 19, Tailwind v4, shadcn,
  Convex, Clerk). Alle UI-tekst Nederlands. Lees `CLAUDE.md` in de repo-root: de
  harde regels gelden (nooit horizontaal scrollen; `SectiePaneel` i.p.v. `<Card>`;
  guard optionele velden vóór index-`q.eq`; committen mag, pushen nooit).
- **Security:** elke nieuwe/gewijzigde Convex-functie is org-gescoped. Klanten via
  bestaande patronen (`getOwnedKlant`/`verifyOrgOwnership`), schrijvers via
  `requireNotViewer`. Nooit een klant uit een andere org koppelen of lezen. Alle
  strings door de bestaande sanitizers uit `convex/validators.ts` (`sanitizePhone`,
  `sanitizeString`/trim, lengtelimieten). Geen nieuwe vrije `any`.
- **Cleane code:** één helper per concept, geen kopieën van bestaande logica. Pure
  logica in `convex/lib/` (importeerbaar door web én Convex, zoals
  `convex/lib/normuren.ts`), met Vitest-tests in `src/__tests__/unit/convex/`.
  Bestaande patronen volgen; geen herstructurering buiten je taak.
- **Bestaande velden blijven werken:** `klanten.naam` blijft de weergavenaam en wordt
  overal gelezen (±460 plekken: snapshots, PDF, mail, zoekindex, mobiel). `naam`
  wordt nooit verwijderd of optioneel gemaakt.
- **Geen browser voor bouwagents.** Verifiëren via `npm run typecheck`, `npx eslint
  <paden>` en gerichte `npx vitest run <pad>`. Draai geen `npm run build`. De
  orchestrator doet de visuele schouw.
- **Commits:** pathspec-scoped (`git commit -m "…" -- <paden>`), want meerdere
  agents delen één working tree en index. Nooit `git add -A`/`git commit -a`. Laat
  `next.config.ts` (bestaande lokale wijziging) met rust. Commitbericht eindigt
  met `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Nooit pushen.
- **Bestandseigendom per fase** (zie tabel onderaan): raak alleen bestanden van je
  eigen taak; heb je een ander bestand nodig, meld het als concern.
- Tests: bestaande tests die op de oude vorm rekenen worden bijgewerkt, niet
  verwijderd. Nieuwe pure logica krijgt tests.

## Fase 1 (parallel): Task 1, 2, 3, 4

### Task 1: Klantmodel-fundament (schema, backend, validatie, import/export)

Doel: de klant krijgt optionele velden `voornaam`, `achternaam`, `telefoon2`,
`bijzonderheden` en `uitvoerAdres`. `naam` blijft de afgeleide weergavenaam.

Schema `convex/schema.ts`, tabel `klanten` (r.119-216), toevoegen:
- `voornaam: v.optional(v.string())`, `achternaam: v.optional(v.string())` —
  alleen betekenisvol bij `klantType` particulier (of ontbrekend); bij zakelijk/
  vve/gemeente/overig blijven ze leeg en is `naam` de bedrijfsnaam.
- `telefoon2: v.optional(v.string())`
- `bijzonderheden: v.optional(v.string())` — vast klantkenmerk (bijv. "sleutel
  onder de pot, hond los in de tuin, altijd vrijdag maaien"). Commentaar: dit is
  bewust NIET het deprecated `notities`-veld (dat is gemigreerd naar klantTijdlijn).
- `uitvoerAdres: v.optional(v.object({ adres: v.string(), postcode: v.string(),
  plaats: v.string() }))` — afwijkend uitvoeradres. Het bestaande `adres/postcode/
  plaats` is het hoofd- en factuuradres. Geen migratie nodig.

Nieuwe pure helper `convex/lib/klantNaam.ts` (met tests
`src/__tests__/unit/convex/klant-naam.test.ts`):
- `samengesteldeNaam({ voornaam?, achternaam?, naam })` → `"${voornaam} ${achternaam}"`
  getrimd als minstens één van beide gevuld is, anders `naam`.
- `splitsNaam(naam)` → `{ voornaam, achternaam }`: eerste woord = voornaam, rest =
  achternaam; Nederlandse tussenvoegsels horen bij de achternaam ("Jan van der
  Berg" → voornaam "Jan", achternaam "van der Berg"). Tussenvoegsel-lijst als
  exporteerbare constante (van, de, der, den, het, 't, ten, ter, te, op, in,
  aan, bij, onder, over, 's, d', l'). Eén woord → voornaam leeg, achternaam = naam.
- `sorteerNaam(klant: { naam; voornaam?; achternaam?; klantType? })` → lowercase
  sorteersleutel: `achternaam + " " + voornaam` als achternaam gevuld, anders
  `naam`. Tussenvoegsels blijven vooraan in de achternaam (Mickey wil "van der
  Berg" onder de V; dat is ook hoe de rest van de app namen toont).
- `lijktBedrijfsnaam(naam)` → true bij tokens als BV, B.V., VOF, V.O.F., NV,
  Stichting, Gemeente, VvE, Holding, Advocaten, Beheer, & (case-insensitief).

Backend `convex/klanten.ts`:
- `create` (r.168-231) en `update` (r.234-329): nieuwe optionele args. Sanitizen:
  `telefoon2` via `sanitizePhone` (zelfde regel als `telefoon`), `bijzonderheden`
  trim + max 2000 tekens (ConvexError bij langer), `voornaam`/`achternaam` trim +
  max 100, `uitvoerAdres` velden trim + dezelfde limieten als adres/postcode/plaats.
  Als `voornaam` of `achternaam` gevuld is: `naam = samengesteldeNaam(...)`. Volg
  de bestaande `update`-conventie voor wissen (lege string → veld leeg; kijk hoe
  `email`/`telefoon` dat nu doen en doe het identiek, ook voor `uitvoerAdres`
  wissen).
- `checkDuplicates` (r.549-614): telefoon-match ook op `telefoon2` (beide kanten).
- `gdprAnonymize` (±r.953 en ±r.1026): wis `voornaam`, `achternaam`, `telefoon2`,
  `bijzonderheden`, `uitvoerAdres`.
- `importKlanten` (r.1047-1247): `extraTelefoon` gaat naar `telefoon2` (via
  `normaliseerImportTelefoon`) i.p.v. de tekst "Tweede telefoonnummer: …" in
  `notities`; `voornaam`/`achternaam` uit de parser worden opgeslagen.
- `createFromOfferte` (r.617-671): ongewijzigd, behalve dat niets breekt.

Parser `src/lib/klant-import-parser.ts` (±r.64-65, ±r.422-426): behoud `voornaam`
en `achternaam` apart in het resultaat naast de samengestelde `naam`. Tests in
`src/__tests__/unit/lib/klant-import-parser.test.ts` en
`relatie-export-import.test.ts` bijwerken.

Export `convex/export.ts` (`exportKlanten`, ±r.149) en `src/lib/excel-export.ts`:
kolommen Voornaam, Achternaam, Telefoon 2, Uitvoeradres, Bijzonderheden erbij.

Zod `src/lib/validations/klant.ts` (`klantSchema` r.29-42): `voornaam`,
`achternaam` (optioneel, max 100), `telefoon2` via bestaande `optionalPhone`,
`bijzonderheden` (optioneel, max 2000), `uitvoerAdres` optioneel object waarvan
alle drie velden verplicht zijn zodra het object meegaat. `naam` blijft verplicht
(formulieren berekenen `naam` met `samengesteldeNaam` vóór submit).

Zoeken `src/lib/klant-zoeken.ts` (`zoekbareTekst` r.29-47): `telefoon2`,
`voornaam`, `achternaam`, `uitvoerAdres`-velden meenemen; test in
`src/__tests__/lib/klant-zoeken.test.ts`.

Typen: waar een `Klant`-type in `src/` handmatig is uitgeschreven i.p.v. afgeleid
van `Doc<"klanten">`, de nieuwe velden toevoegen (zoek op `telefoon?: string`).

Niet aanraken in deze taak: `convex/validators.ts`, alle `src/app/**` en
`src/components/**` (die zijn van Task 4, 5, 6), `convex/leadsKlantenHelpers.ts`.

Verificatie: `npm run typecheck`, `npx vitest run src/__tests__/unit/convex/klant-naam.test.ts src/__tests__/lib/klant-zoeken.test.ts src/__tests__/unit/lib/klant-import-parser.test.ts src/__tests__/unit/lib/relatie-export-import.test.ts` en de bestaande klanten-tests onder `src/__tests__/unit/convex/` die `klanten` raken.

### Task 2: WhatsApp als gesprekskanaal

Het datamodel kent `whatsapp` al (`tijdlijnKanaalValidator`,
`tijdlijnHandmatigKanaalValidator`, tijdlijn-rendering met `MessageCircle`). Alleen
de chip-laag "GesprekType" is hard op vier waarden gezet.

- `src/components/klanten/dossier/gesprek-composer.tsx`: `MessageCircle`
  importeren (r.38-49); `TYPES` (r.65) wordt `["Gebeld", "WhatsApp", "Gemaild",
  "Afspraak", "Notitie"]`; `TYPE_ICONEN` (r.72-77) krijgt `WhatsApp: MessageCircle`;
  `NAAR_TIJDLIJN` (r.85-94) krijgt `WhatsApp: { kanaal: "whatsapp", eventType:
  "handmatig" }` en de inline kanaal-union op r.87 krijgt `"whatsapp"`. Docstrings
  "vier typechips" (r.64, r.490) bijwerken. Placeholder-tekst mag per type
  hetzelfde blijven.
- `convex/validators.ts`: `tijdlijnGesprekTypeValidator` (r.502-507) en type
  `GesprekType` (r.509) uitbreiden met `"WhatsApp"`; docstring r.496.
- `convex/gesprekAnalyse.ts`: `TYPE_OMSCHRIJVING` (r.66-71) krijgt `WhatsApp:
  "een WhatsApp-gesprek met de klant"`.
- Test `src/__tests__/components/gesprek-composer.test.tsx`: spiegelcase naast
  r.190-206: chip "WhatsApp" → `{ kanaal: "whatsapp", eventType: "handmatig" }`.
- Bij een opname blijft kanaal geforceerd `telefoon` (r.229-232): ongewijzigd.

Verificatie: `npm run typecheck`, `npx vitest run src/__tests__/components/gesprek-composer.test.tsx src/__tests__/unit/convex/tijdlijn.test.ts`.

### Task 3: Lead direct als klant aanmaken of koppelen (lead blijft open)

Feiten: leads staan in tabel `configuratorAanvragen`; koppeling is
`gekoppeldKlantId`. `isGepromoveerdeLead` = `gewonnen && gekoppeldKlantId`, dus een
gekoppelde lead met status `offerte_verstuurd` blijft op het bord. `promoveerLead`
(`convex/leadsKlantenHelpers.ts` r.157-275) respecteert een bestaande koppeling al
(test `leads-klanten-scheiding.test.ts:353`).

Backend:
- `convex/leadsKlantenHelpers.ts`: het insert-blok r.209-222 uittrekken naar een
  geëxporteerde helper `maakKlantUitLead(ctx, lead, orgId)` (inclusief de
  e-mail-dedup r.174-206 als aparte helper `vindKlantVoorLead(ctx, lead, orgId)`);
  `promoveerLead` gebruikt beide. Gedrag van `promoveerLead` verandert niet.
- `convex/configuratorAanvragen.ts`: twee nieuwe mutaties, beide `requireNotViewer`
  + `verifyOrgOwnership` op de lead (patroon `updatePrijzen` r.711-720):
  - `koppelKlant({ id, klantId })`: klant moet bestaan, niet gearchiveerd zijn en
    dezelfde `orgId` hebben (anders ConvexError "Klant niet gevonden" — geen
    informatie lekken over andere orgs). Patch alleen `gekoppeldKlantId` +
    `updatedAt`, pipelineStatus blijft. Log `leadActiviteiten` (type `notitie`
    is te zwak: voeg literal `klant_gekoppeld` toe aan de union in `schema.ts`
    r.3002-3008 én `convex/leadActiviteiten.ts` r.52-58, met
    `metadata.gekoppeldKlantId`) en `logTijdlijnEvent` op de klant zoals
    `promoveerLead` r.262-272 doet (eventType hergebruiken of, als `lead_gewonnen`
    semantisch niet past, de dichtstbijzijnde bestaande — geen nieuw tijdlijn-
    eventType zonder noodzaak).
  - `maakKlantUitLead({ id })`: als al gekoppeld → return bestaande klantId;
    anders `vindKlantVoorLead` (e-mail-dedup) en zo niet gevonden
    `maakKlantUitLead`; dan dezelfde koppel- en loglogica. Return
    `{ klantId, nieuweKlant: boolean }`.
  - `ontkoppelKlant({ id })`: alleen toegestaan als status niet `gewonnen` is;
    wist `gekoppeldKlantId`; logt activiteit.
- `getLeadVoorKlant` (r.859-893) blijft; de tekst in
  `src/components/leads/lead-historie-card.tsx` r.57 ("ontstaan uit lead") wordt
  "Gekoppeld aan lead …" zodat hij ook klopt vóór gewonnen.

Frontend `src/components/leads/lead-detail-modal.tsx` (header r.545-590):
- Geen klant gekoppeld: knop "Klant aanmaken" (opent `NieuweKlantDialog` uit
  `src/components/klanten/nieuwe-klant-dialog.tsx` met `initialValues` uit
  `lead.klantNaam/klantEmail/klantTelefoon/klantAdres(+huisnummer)/klantPostcode/
  klantPlaats`; `onCreated` → `koppelKlant`) en een secundaire actie "Bestaande
  klant koppelen" (Popover met zoekveld op `api.klanten.search`, toon naam +
  plaats, klik → `koppelKlant`). Toon vóór het aanmaken een duplicaatwaarschuwing
  op basis van `api.klanten.checkDuplicates` als die matcht: "Er bestaat al een
  klant met dit e-mailadres/telefoonnummer: X — koppelen?" met knop die
  `koppelKlant` doet.
- Wel gekoppeld: badge "Klant" met `Link` naar `/klanten/${gekoppeldKlantId}`
  (label = klantnaam via `api.klanten.getVoorSelector` of een kleine query) en,
  als status ≠ gewonnen, een dropdown-item "Ontkoppelen".
- "Offerte aanmaken" (r.861-875): als gekoppeld, `&klantId=${gekoppeldKlantId}`
  meegeven.
- Quick-action "Gewonnen" blijft ongewijzigd.

Tests: `src/__tests__/unit/convex/leads-klanten-scheiding.test.ts` uitbreiden met
(a) gekoppelde lead met status `contact_gehad` blijft in `listByPipeline`, (b)
`koppelKlant` weigert klant uit andere org, (c) `maakKlantUitLead` dedupt op
e-mail en maakt anders aan, (d) `ontkoppelKlant` weigert bij gewonnen. Volg de
bestaande teststijl in dat bestand (convex-test of pure helpers).

Niet aanraken: `convex/klanten.ts`, `convex/schema.ts` behalve de
`leadActiviteiten`-union.

Verificatie: `npm run typecheck`, `npx vitest run src/__tests__/unit/convex/leads-klanten-scheiding.test.ts` plus tests die `lead-detail-modal` of `leadActiviteiten` raken.

### Task 4: Eén adreshelper voor de hele app

Nu bouwen minstens negen plekken zelf de adresregel, in twee formaten (met/zonder
postcode). Eén helper vóórdat het tweede adres (Task 7) landt.

- Nieuw `convex/lib/adres.ts` met tests `src/__tests__/unit/convex/adres.test.ts`:
  - `type AdresVelden = { adres?: string | null; postcode?: string | null; plaats?: string | null }`
  - `adresRegel(a: AdresVelden): string` → `"Straat 1, 1234 AB Plaats"`; lege delen
    worden overgeslagen; alles leeg → `""`.
  - `googleMapsZoekUrl(a)` en `googleMapsRouteUrl(a)` (huidige varianten
    `klanten/[id]/page.tsx:305` search en `materiaalDelta.ts:199` dir), met
    `encodeURIComponent`.
- Vervang de handgemaakte opbouw door de helper op: `src/app/(dashboard)/klanten/
  page.tsx` r.712-717; `src/app/(dashboard)/klanten/[id]/page.tsx` r.181-186 en
  r.305; `src/components/offerte/klant-koppeling.tsx` r.602-607;
  `src/components/klanten/dossier/tab-instellingen.tsx` r.97-101 (`adresRegel`
  lokaal → import); `src/components/leads/lead-detail-modal.tsx` r.497-499 alleen
  de Maps-URL (rest van dat bestand is van Task 3 — raak alleen die regels);
  `convex/werkitems.ts` r.149-156 `resolveAdres`; `convex/planbord.ts` r.265;
  `convex/dagkaart.ts` r.325, 429-437, 830; `convex/materiaalDelta.ts` r.193-199.
- Ruling (orchestrator): het uniforme formaat is mét postcode. De reistijdcache
  (`reistijdCache.sleutel`) krijgt daardoor eenmalig cache-misses; dat is
  geaccepteerd. Documenteer dit in een commentaar bij de helper.
- Bestaande tests die het oude formaat zonder postcode asserten (dagkaart/planbord/
  materiaalDelta) bijwerken naar het nieuwe formaat.

Verificatie: `npm run typecheck`, `npx vitest run src/__tests__/unit/convex/adres.test.ts` plus de dagkaart-, planbord-, werkitems- en materiaalDelta-tests.

## Fase 2 (parallel, na Task 1 en 4): Task 5, 6, 7, 8

### Task 5: Klantenlijst en klantformulieren

Bestand `src/app/(dashboard)/klanten/page.tsx` (formulier `klantFormJsx`
r.872-1090, state r.236-249, `handleAdd` r.457-485, `handleEdit` r.487-504,
`handleUpdate` r.506-560, tabel r.599-866, sortering r.436-439):
- Particulier: veld "Naam" wordt twee velden "Voornaam" en "Achternaam" (naast
  elkaar, achternaam verplicht, voornaam optioneel). Andere typen: "Bedrijfsnaam"
  zoals nu. Bij submit `naam = samengesteldeNaam(...)` uit `convex/lib/klantNaam`.
- `handleEdit`: particulier zonder `voornaam/achternaam` → voorvullen met
  `splitsNaam(klant.naam)` zodat opslaan de splitsing vastlegt.
- Veld "Telefoon 2" naast Telefoon (zelfde validatie/foutmelding als Telefoon).
- Sectie "Afwijkend uitvoeradres" als uitklapbare checkbox/`Collapsible` onder het
  adres; open = drie velden (adres, postcode, plaats) verplicht; dicht = veld
  leeg sturen zodat de backend het wist. Toelichting eronder: "Alleen invullen als
  het werk ergens anders is dan het factuuradres."
- Sortering: default op achternaam. Pas `src/hooks/use-table-sort.ts` aan met een
  optionele `accessors`-map (`Partial<Record<keyof T | string, (item: T) => string | number | null | undefined>>`)
  en gebruik `naam: sorteerNaam` uit `convex/lib/klantNaam`. Tests in
  `src/__tests__/hooks/use-table-sort.test.ts` uitbreiden. De kolomkop blijft
  "Naam", pijl blijft werken.
- Kolom Naam blijft `klant.naam` tonen. Kolom Telefoon: `telefoon2` op een tweede
  regel in dezelfde cel (`text-muted-foreground text-xs`), geen extra kolom (regel:
  nooit horizontaal scrollen).
- Kolom Adres: als `uitvoerAdres` bestaat, tweede regel "Uitvoer: …" (via
  `adresRegel`), getruncate met `title`.

Bestand `src/components/klanten/nieuwe-klant-dialog.tsx`: dezelfde veldsplitsing
(voornaam/achternaam bij particulier, telefoon2). `NieuweKlantWaarden`/
`initialValues` (r.58-65) krijgt de nieuwe optionele velden zodat Task 3's
voorvulling blijft werken; `naam` in `initialValues` wordt bij particulier
gesplitst met `splitsNaam`. Uitvoeradres hier niet (YAGNI: snel aanmaken vanuit
offerte/lead).

Tests: bestaande `e2e/klant-crud.spec.ts` niet draaien (auth-E2E stuk); wel
component-/hooktests bijwerken die op de oude velden rekenen.

Verificatie: `npm run typecheck`, `npx eslint src/app/\(dashboard\)/klanten src/components/klanten/nieuwe-klant-dialog.tsx src/hooks/use-table-sort.ts`, `npx vitest run src/__tests__/hooks/use-table-sort.test.ts` plus tests die `nieuwe-klant-dialog` raken.

### Task 6: Klantdossier — contactgegevens, tweede adres, telefoon 2, bijzonderheden

- `src/components/klanten/dossier/tab-instellingen.tsx`:
  - `ContactgegevensWeergave` (r.105-171): bij particulier Voornaam/Achternaam
    tonen; "Telefoon 2"; "Uitvoeradres" (alleen als gevuld, via `adresRegel`).
  - `ContactgegevensFormulier` (r.195-±470): velden zoals in Task 5 (voornaam/
    achternaam bij particulier met `splitsNaam`-voorvulling, telefoon2,
    uitvoeradres-collapsible). `VeldFouten` (r.176-178) uitbreiden. Wissen volgt
    de bestaande lege-string-conventie (r.260-267).
  - Nieuw `SectiePaneel` "Bijzonderheden" direct onder Contactgegevens: één
    `Textarea` (max 2000, teller) met toelichting "Vaste bijzonderheden die elke
    collega moet weten: sleutel, hond, toegang, vaste werkzaamheden.", knoppen
    Opslaan/Annuleren, opslaan via `api.klanten.update({ id, bijzonderheden })`.
    `SectieLegeStaat` als leeg.
- `src/app/(dashboard)/klanten/[id]/page.tsx`: `initialen` (r.87) op basis van
  voornaam/achternaam als aanwezig; contactchips (r.253-326): tweede `tel:`-chip
  voor `telefoon2`; adresregel via `adresRegel`; extra chip "Uitvoer: …" met
  Maps-link als `uitvoerAdres` bestaat.
- `src/components/klanten/dossier/tab-actueel.tsx`: bovenaan een compacte
  bijzonderheden-strook (icoon `Info`, tekst getruncate op 2 regels, `title`
  volledig) alleen als `bijzonderheden` gevuld is.
- Tests: `src/__tests__/components/klant-contactgegevens-formulier.test.tsx`
  uitbreiden (telefoon2-validatie, uitvoeradres verplicht compleet als open,
  voornaam/achternaam → naam).

Verificatie: `npm run typecheck`, eslint op de geraakte bestanden, `npx vitest run src/__tests__/components/klant-contactgegevens-formulier.test.tsx` plus tests die `tab-actueel`/`tab-instellingen` raken.

### Task 7: Uitvoeradres en bijzonderheden doorvoeren in planning, veld en facturen

Semantiek (ruling): werk (werkitems, planbord, dagkaart, routes, contracten,
veld-app) gebruikt het uitvoeradres als dat bestaat, anders het hoofdadres.
Offertes en facturen gebruiken altijd het hoofdadres (= factuuradres).

- `convex/lib/adres.ts` (uit Task 4) uitbreiden: `klantUitvoerAdres(klant)` →
  `klant.uitvoerAdres ?? { adres, postcode, plaats }` en `klantFactuurAdres(klant)`
  → hoofdadres. Tests erbij.
- `convex/werkitems.ts` `resolveAdres` (r.149-156): via `klantUitvoerAdres`.
  `werkitems.create`: nieuwe optionele arg `adresKeuze: "uitvoer" | "hoofd"`;
  zonder keuze → uitvoer-logica.
- Werkitem-aanmaakdialoog in `src/components/planbord/dialogen.tsx`: alleen als
  de gekozen klant een `uitvoerAdres` heeft, een `RadioGroup` "Werkadres" met
  "Uitvoeradres — …" (default) en "Hoofdadres — …". Anders niets tonen
  (Mickey: "als er maar 1 adres is dan gaat het automatisch").
- `src/components/project/koppel-werkitems-dialog.tsx` r.175: als de offerte een
  `klantId` heeft en die klant een `uitvoerAdres`, dat gebruiken i.p.v. de
  offerte-snapshot.
- `convex/planbord.ts` r.265, `convex/dagkaart.ts` (klantadres-terugval),
  `convex/materiaalDelta.ts`: via `klantUitvoerAdres`.
- `src/app/(dashboard)/contracten/nieuw/page.tsx` r.293-295: locatie voorvullen
  met uitvoeradres.
- `convex/facturatieEngine.ts` r.96-104 en `convex/facturen.ts` r.373-375, 926-928:
  expliciet `klantFactuurAdres` (gedrag gelijk, intentie vastgelegd).
- `convex/offertes.ts` snapshot r.657-672, 948-964: expliciet `klantFactuurAdres`.
- Bijzonderheden zichtbaar voor de hovenier: `convex/planbord.ts` en
  `convex/dagkaart.ts` geven `bijzonderheden` mee in de stop-/kaartpayload;
  `src/components/planbord/dagkaart.tsx` (r.147-150) toont het onder het adres;
  `convex/mobile.ts` r.198-199 en `convex/veldLogica.ts` geven het mee;
  `src/components/veld/klantblok-kaart.tsx` r.98-99 toont het; `mobile/types/
  veld.ts` r.48 krijgt het veld en `mobile/components/veld/KlantblokKaart.tsx`
  r.111-116 toont het (alleen als gevuld; kort, `numberOfLines={3}`).
- Tests: dagkaart-, planbord-, werkitems-, facturatie-tests bijwerken/uitbreiden
  met een klant mét uitvoeradres.

Verificatie: `npm run typecheck`, gerichte vitest-runs van de geraakte tests. Mobiel: `cd mobile && npx tsc --noEmit` als dat werkt; anders melden.

### Task 8: Migraties (naam splitsen, telefoon 2 uit notities)

Sjabloon: `convex/migrations/saneerLeadsKlanten.ts` (gepagineerd 100/batch,
`dryRun`, cursor via scheduler, idempotent, aparte `verifieer…`-query, header met
`npx convex run`-commando's). Pure kern per klant apart exporteren voor tests
(patroon `convex/tijdlijnMigratie.ts`).

- `convex/migrations/splitsKlantNaam.ts`: voor klanten zonder `voornaam` en
  `achternaam`, met `klantType` `particulier` of ontbrekend, `naam` met ≥2 woorden
  en `!lijktBedrijfsnaam(naam)`: `splitsNaam` toepassen en patchen. Overgeslagen
  gevallen (één woord, bedrijfsachtig, ander type) tellen in het rapport als
  `twijfel` met de klant-id en naam (max 50 voorbeelden in de output). `naam` zelf
  blijft ongewijzigd (samengestelde naam is identiek aan de bron).
- `convex/migrations/telefoon2UitNotities.ts`: klanten met `notities` die de regel
  `Tweede telefoonnummer: <nummer>` bevatten (exacte tekst zoals `importKlanten`
  die tot nu toe schreef, zie r.1177-1197) en zonder `telefoon2`: nummer via
  `normaliseerImportTelefoon` naar `telefoon2`, regel uit `notities` verwijderen
  (leeg → veld wissen). Nummer ongeldig → overslaan en rapporteren.
- Tests: `src/__tests__/unit/convex/migraties-klantvelden.test.ts` voor beide
  kernfuncties (splitsen, overslaan, notitie-parsing, idempotentie).
- Documentatie: in de header van elk bestand de volgorde: eerst
  `npx convex run migrations/splitsKlantNaam:start '{"dryRun":true}'`, rapport
  lezen, dan zonder dryRun. Niet uitvoeren in deze taak.

Verificatie: `npm run typecheck`, `npx vitest run src/__tests__/unit/convex/migraties-klantvelden.test.ts`.

### Task 9: Restpunten uit fase 1 (kleine batch)

Allemaal kleine, onafhankelijke wijzigingen; één agent, één commit per onderdeel.

1. Resterende handgebouwde adresregels op `adresRegel` uit `convex/lib/adres.ts`
   zetten: `convex/servicemeldingen.ts`, `convex/urenSegmenten.ts` (±r.277),
   `convex/garanties.ts`, `convex/beurtgenerator.ts`, `convex/demoSeed.ts`. Zoek
   in elk bestand op `postcode` en `plaats` in string-concatenaties/`join`. Niet
   `convex/dagkaart.ts` (dat is van Task 7).
2. `src/components/import/relatie-import-dialog.tsx` (±r.221): `voornaam` en
   `achternaam` uit de parser-entries meesturen naar `api.klanten.importKlanten`
   (de mutatie accepteert ze al sinds Task 1).
3. `src/__tests__/unit/convex/analytics-rapportage-org.test.ts`: de fixture
   `DEZE_MAAND = "2026-08-05"` faalt sinds september (kalenderrot). Maak de test
   klok-onafhankelijk: `vi.useFakeTimers()` + `vi.setSystemTime(...)` op een
   datum in de fixture-maand, of leid de fixture-datum af van `new Date()`. Kies
   wat het bestand al doet voor andere datums.
4. `convex/lib/adres.ts`: voeg `adresRegelOfNull(a)` toe (`adresRegel(a) || null`)
   en gebruik die op de vijf plekken die nu `adresRegel(...) || null` schrijven
   (`convex/planbord.ts`, `convex/materiaalDelta.ts`; `convex/dagkaart.ts` NIET —
   Task 7 doet dagkaart). Verwijder de datum "Tot 11 sep 2026" uit het
   doc-commentaar (r.7).

Verificatie: `npm run typecheck`, eslint op geraakte bestanden, `npx vitest run src/__tests__/unit/convex/adres.test.ts src/__tests__/unit/convex/analytics-rapportage-org.test.ts` plus tests van de geraakte convex-bestanden.

## Bestandseigendom

| Fase | Task | Eigen bestanden |
|---|---|---|
| 1 | 1 | convex/schema.ts (klanten-tabel), convex/klanten.ts, convex/lib/klantNaam.ts, convex/export.ts, src/lib/validations/klant.ts, src/lib/klant-zoeken.ts, src/lib/klant-import-parser.ts, src/lib/excel-export.ts, bijbehorende tests |
| 1 | 2 | gesprek-composer.tsx, convex/validators.ts, convex/gesprekAnalyse.ts, gesprek-composer.test.tsx |
| 1 | 3 | convex/configuratorAanvragen.ts, convex/leadsKlantenHelpers.ts, convex/leadActiviteiten.ts, convex/schema.ts (alleen leadActiviteiten-union), src/components/leads/**, leads-klanten-scheiding.test.ts |
| 1 | 4 | convex/lib/adres.ts (+test), convex/werkitems.ts, convex/planbord.ts, convex/dagkaart.ts, convex/materiaalDelta.ts, en alléén de adresregels in klanten/page.tsx, klanten/[id]/page.tsx, klant-koppeling.tsx, tab-instellingen.tsx, lead-detail-modal.tsx (Maps-URL) |
| 2 | 5 | klanten/page.tsx, nieuwe-klant-dialog.tsx, use-table-sort.ts (+tests) |
| 2 | 6 | tab-instellingen.tsx, klanten/[id]/page.tsx, tab-actueel.tsx (+tests) |
| 2 | 7 | convex/lib/adres.ts, werkitems.ts, planbord.ts, dagkaart.ts, materiaalDelta.ts, facturatieEngine.ts, facturen.ts, offertes.ts (snapshot), planbord/dialogen.tsx, koppel-werkitems-dialog.tsx, contracten/nieuw/page.tsx, planbord/dagkaart.tsx, veld/klantblok-kaart.tsx, convex/mobile.ts, convex/veldLogica.ts, mobile/** |
| 2 | 8 | convex/migrations/splitsKlantNaam.ts, convex/migrations/telefoon2UitNotities.ts (+test) |
| 2 | 9 | servicemeldingen.ts, urenSegmenten.ts, garanties.ts, beurtgenerator.ts, demoSeed.ts, relatie-import-dialog.tsx, analytics-rapportage-org.test.ts, convex/lib/adres.ts (adresRegelOfNull), planbord.ts, materiaalDelta.ts |

Task 3 en Task 4 raken beide `lead-detail-modal.tsx`: Task 4 raakt alleen de
Maps-URL-regels en commit die apart; Task 3 rebased er niet op maar werkt in
dezelfde tree, dus conflicten bestaan niet, alleen gedeelde index — commit altijd
met pathspec.

## Rulings (orchestrator, 11 sep 2026)

- Punt 4 (taken directie): niet bouwen. Advies aan Mickey: Mickey en Yannick elk
  een eigen login met rol directie via Team → Uitnodigen; dan kloppen toewijzing,
  filters en "Uitgezet door" meteen. Kosten als fout: 1,5 dag bouwwerk alsnog.
- Naam-model: additief (`voornaam`/`achternaam` optioneel, `naam` afgeleid en
  blijvend). Kosten als fout: geen; dit is de veiligste route bij ±460 lezers.
- Tussenvoegsels bij de achternaam en vooraan in de sorteersleutel ("van der Berg"
  onder V). Kosten als fout: sorteersleutel aanpassen is één functie.
- Adresformaat uniform mét postcode; reistijdcache eenmalig koud. Kosten als
  fout: enkele Distance-Matrix-calls.
- Offerte/factuur = hoofdadres; werk = uitvoeradres. Kosten als fout: één helper
  omdraaien.
- Werk op `main` in de gedeelde working tree met pathspec-commits, conform de
  vaste werkwijze in dit project (geen worktree). Niet pushen.

## Uitkomst (11 sep 2026)

Gebouwd in 27 commits (6740cf0..857e3b1), 9 taken elk apart gereviewd, eindreview +
fixwave, poort groen (typecheck, lint, 4218 tests). Dry runs van beide migraties op
dev geverifieerd. Niet gepusht, Convex prod niet gedeployed.

Uitrolvolgorde: `npx convex deploy --yes` → `git push origin main` →
`npx convex run migrations/splitsKlantNaam:start '{"dryRun":true}'` (rapport lezen,
twijfelgevallen bekijken) → `'{"dryRun":false}'` herhalen met `cursor` tot `isDone` →
`migrations/splitsKlantNaam:verifieer` → zelfde voor `migrations/telefoon2UitNotities`.

Follow-ups (kunnen wachten):
- Eén `NaamVelden`-component voor lijstformulier, aanmaakdialoog en dossier (nu drie
  kopieën) + labelpariteit sub-labels uitvoeradres.
- `tab-instellingen.tsx` splitsen (BijzonderhedenPaneel, uitvoeradres-Collapsible).
- Collapsible-trigger klantformulier: focus-visible ring + aria-describedby.
- `servicemeldingen.ts` meldingdetail toont hoofdadres; `portaal.updateProfile`
  sanitiseert telefoon/adres/postcode/plaats niet (pre-existing).
- `ontkoppelKlant` logt als `klant_gekoppeld`; `koppelKlant` op een legacy gewonnen
  lead zonder koppeling maakt geen werkitem.
- Integratietests dagkaart/facturatie met een klant mét uitvoeradres.
- Migratie-scaffolding (batch/rapport) dubbel in beide migraties.

## Fase 3 (parallel): follow-ups — Task 10 t/m 14

Zelfde Global Constraints als hierboven. Bestandseigendom staat per taak; commit met
pathspec.

### Task 10: Eén set gedeelde klantveld-componenten (naam, telefoon, uitvoeradres)

Nu staan dezelfde veldblokken drie keer: `src/app/(dashboard)/klanten/page.tsx`
(`klantFormJsx`), `src/components/klanten/nieuwe-klant-dialog.tsx` en
`src/components/klanten/dossier/tab-instellingen.tsx` (`ContactgegevensFormulier`).
Ook is `tab-instellingen.tsx` gegroeid naar ±1140 regels.

- Nieuwe map `src/components/klanten/velden/` met:
  - `naam-velden.tsx`: `NaamVelden` — bij particulier "Voornaam" + "Achternaam *"
    naast elkaar, anders "Bedrijfsnaam *". Props: `klantType`, `waarden {naam,
    voornaam, achternaam}`, `onChange`, `fouten?`, `idPrefix`. Zelfde labels op alle
    drie de plekken.
  - `telefoon-velden.tsx`: `TelefoonVelden` — "Telefoon" + "Telefoon 2" met dezelfde
    placeholder/foutmelding.
  - `uitvoeradres-velden.tsx`: `UitvoeradresVelden` — de `Collapsible` "Afwijkend
    uitvoeradres" met toelichting, sub-labels "Adres (uitvoer) *", "Postcode (uitvoer)
    *", "Plaats (uitvoer) *" (de dossier-variant is leidend), trigger met
    `focus-visible`-ring en `aria-describedby` naar de toelichting, `aria-expanded`.
    Props: `open`, `onOpenChange`, `waarden`, `onChange`, `fouten?`, `idPrefix`.
  - Een pure helper `src/components/klanten/velden/klant-formulier-logica.ts` met
    `naamVelden(...)` (naam samenstellen via `samengesteldeNaam`), `splitsVoorBewerken`
    (prefill via `splitsNaam` als delen ontbreken) en `uitvoerAdresPayload(open, waarden)`
    (→ object, clear-payload `{ "", "", "" }` bij update, `undefined` bij create). Deze
    logica staat nu ook drie keer.
- De drie formulieren gebruiken de componenten en de helper; gedrag blijft identiek
  (bestaande tests blijven groen; `klant-contactgegevens-formulier.test.tsx` en
  `use-table-sort.test.ts` niet verzwakken).
- `tab-instellingen.tsx`: `BijzonderhedenPaneel` naar
  `src/components/klanten/dossier/bijzonderheden-paneel.tsx`; `FOUTSLEUTEL` naar
  module-scope; de test "klapt met Wijzigen om" met `within(panel)` i.p.v.
  `getAllByRole(...)[0]`.
- Tests: `src/__tests__/components/klant-velden.test.tsx` voor de drie componenten
  (labels per klantType, aria op de trigger, clear-payload) en
  `klant-formulier-logica.test.ts` voor de helper.

Verificatie: typecheck, eslint, `npx vitest run src/__tests__/components src/__tests__/hooks`.

### Task 11: Servicemelding-detail en portaalprofiel

- `convex/servicemeldingen.ts` ±r.309: `klantAdres` in het meldingdetail via
  `adresRegel(klantUitvoerAdres(klant))` (werkadres, consistent met
  `promoveerNaarWerkitem`). Test in de servicemeldingen-testsuite bijwerken/toevoegen.
- `convex/portaal.ts` `updateProfile` (±r.530-560): `telefoon` via `sanitizePhone`,
  `adres`/`postcode`/`plaats` via dezelfde sanitizers/validators als `klanten.update`
  (`validateRequiredPostcode` e.d.); lege string wist optionele velden zoals bij
  `klanten.update`; ongeldige invoer → `ConvexError` met dezelfde melding als het
  kantoorformulier. Tenancy ongewijzigd (`requireKlant` → eigen record). Tests in
  `src/__tests__/unit/convex/portaal-fase2.test.ts` (+3: telefoon genormaliseerd,
  ongeldig nummer geweigerd, postcode gevalideerd).

Verificatie: typecheck, eslint, gerichte vitest.

### Task 12: Leadkoppeling — logtype, legacy gewonnen, busy-state

- Schema `leadActiviteiten.type` (convex/schema.ts) + validator in
  `convex/leadActiviteiten.ts`: literal `klant_ontkoppeld` erbij; `ontkoppelKlant`
  logt daarmee; UI-map van iconen/kleuren in `src/components/leads/**` (zoek op
  `klant_gekoppeld`) krijgt een grijze variant voor ontkoppeld.
- `koppelKlant` op een lead met status `gewonnen` zonder koppeling: weigeren met
  ConvexError "Een gewonnen lead koppel je via Gewonnen" is te hard voor legacy
  data; kies: koppelen én meteen het werkitem aanmaken via het bestaande
  `promoveerLead`-pad (zodat de lead consistent gepromoveerd is). Test erbij in
  `leads-klanten-scheiding.test.ts`.
- `lead-detail-modal.tsx`: busy-state (`disabled` + spinner) op Ontkoppelen en op
  Koppelen in de duplicaatbanner; sluit het modal niet bij navigeren naar het
  dossier via de badge? Nee: laat het modal staan, maar geef de badge-`Link`
  `onClick={onClose}` zodat terugnavigeren het bord toont zonder oud modal.
- Testhelper `handlerVan` in `leads-klanten-scheiding.test.ts` één keer op
  module-niveau.

Verificatie: typecheck, eslint, `npx vitest run src/__tests__/unit/convex/leads-klanten-scheiding.test.ts` + leads-componenttests.

### Task 13: Integratietests uitvoeradres in dagkaart en facturatie

Alleen tests, geen productiecode (als een test een echte bug vindt: rapporteren, niet
fixen).
- `src/__tests__/unit/convex/dagkaart.test.ts`: klant mét `uitvoerAdres` → stop-adres,
  reistijdsleutel en Maps-route gebruiken het uitvoeradres; klant zonder → hoofdadres.
- Facturatie: `facturatieEngine`/`facturen`-tests: klant mét `uitvoerAdres` → factuur-
  snapshot bevat het hoofdadres, nooit het uitvoeradres. Offerte-snapshot idem
  (`offerte-klant-optioneel.test.ts` of de dichtstbijzijnde suite).
- Werkitems: `werkitem-adres.test.ts` bestaat; voeg `adresKeuze: "hoofd"` bij klant mét
  uitvoeradres toe als die ontbreekt.
- `servicemeldingen`: promoveren naar werkitem met uitvoeradres (bestaat sinds de
  fixwave; controleren, anders toevoegen).

Verificatie: gerichte vitest-runs, geen productiebestanden in de diff.

### Task 14: Migratie-scaffolding delen

- Nieuw `convex/migrations/_batch.ts` met de gedeelde constanten/typen en twee
  helpers: `verzamelVoorbeelden(max)` (accumulator voor max N voorbeelden) en
  `leesAlleOfBatch(ctx, tabel, { dryRun, cursor, batchGrootte })` die bij dryRun
  `collect()` doet en anders precies één `paginate` (Convex-regel: één paginate per
  functie — in commentaar). `splitsKlantNaam.ts` en `telefoon2UitNotities.ts` gebruiken
  ze; rapportvorm en gedrag ongewijzigd (`migraties-klantvelden.test.ts` blijft groen,
  inclusief de paginate-guard). `saneerLeadsKlanten.ts` e.a. niet aanraken.
- `bepaalNaamSplitsing` in `splitsKlantNaam.ts`: de dubbele klanttype/woordentelling
  laten leunen op `naamDelenVoorNieuweKlant`, met behoud van de aparte `reden`-waarden.

Verificatie: typecheck, eslint, `npx vitest run src/__tests__/unit/convex/migraties-klantvelden.test.ts`, daarna `npx convex dev --once` en beide dry runs op dev opnieuw (moeten identiek rapporteren aan de vorige run: 274 bekeken).

| Fase | Task | Eigen bestanden |
|---|---|---|
| 3 | 10 | klanten/page.tsx, nieuwe-klant-dialog.tsx, tab-instellingen.tsx, src/components/klanten/velden/**, dossier/bijzonderheden-paneel.tsx, componenttests |
| 3 | 11 | convex/servicemeldingen.ts, convex/portaal.ts, hun tests |
| 3 | 12 | convex/schema.ts (leadActiviteiten-union), convex/leadActiviteiten.ts, convex/configuratorAanvragen.ts, src/components/leads/**, leads-tests |
| 3 | 13 | alleen testbestanden onder src/__tests__/ |
| 3 | 14 | convex/migrations/_batch.ts, splitsKlantNaam.ts, telefoon2UitNotities.ts, migraties-klantvelden.test.ts |
