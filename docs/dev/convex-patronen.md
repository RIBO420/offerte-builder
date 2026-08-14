# Convex-patronen & -valkuilen

- Schema in `convex/schema.ts`; functies per domein (`offertes.ts`, `klanten.ts`, …).
- Auth via `convex/auth.config.ts` (Clerk); helpers in `convex/auth.ts`
  (`requireAuth`, `requireAuthUserId`, `requireKlant`, …).
- **Rollenmodel (7 rollen, zie `convex/roles.ts` / `validators.ts`):** `directie`
  (= admin), `projectleider`, `voorman`, `medewerker`, `klant`, `onderaannemer_zzp`,
  `materiaalman`. Legacy: `admin`→`directie`, `viewer`→`klant`. `klant` leeft in
  `/portaal`; staf in `/dashboard`.

## Optionele velden in een index: `q.eq(veld, undefined)` is géén lege zoekopdracht

`withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))` matcht bij een
ontbrekende `offerteId` **alle** documenten die zelf geen `offerteId` hebben — niet
nul. Met `.unique()` erachter klapt de query zodra er twee van zijn. Zo sloopte één
werkitem zonder offerte acht schermen tegelijk (projectdetail, planning,
nacalculatie, projectkosten, archief, dashboard, analytics, rapportages) met
`unique() query returned more than one result from table voorcalculaties`. Het was
een queryfout, geen dubbele data.

Regel: **guard elk optioneel veld voordat je het in een index stopt**, en gebruik
`.unique()` alleen waar het schema uniciteit echt afdwingt — een leesquery mag nooit
een scherm slopen om een dubbele rij. Voor voorcalculaties doet
`convex/lib/voorcalculatieLookup.ts` dit: `voorcalculatieVanProject`,
`voorcalculatieVanOfferte` (undefined → `null`) en
`voorcalculatieVoorProject(ctx, project, voorkeur)`. De `voorkeur` is een parameter
omdat bij `createFromOfferte` met `copyVoorcalculatie` een projectkopie náást het
origineel op de offerte bestaat en die twee uiteen kunnen lopen; elke aanroeper
houdt de volgorde die hij had.

## Feature-notities

- **`klantTaken`** (`convex/klantTaken.ts`) — losse to-do's per klant, toewijsbaar
  aan een medewerker. Eigen tabel naast `klantTijdlijn` (wat er gebeurd ís,
  append-only) en `planningTaken` (hangt aan een werkitem). Intern dossier:
  klantaccounts krijgen op elke functie een `AuthError`. UI: `klant-taken-card` op
  `/klanten/[id]`, teller in de klantenlijst, `mijn-taken` op het dashboard.
- **`places` / `placesLogica`** (TT-006) — bedrijfszoeken via Google Places. De
  sleutel (`GOOGLE_MAPS_API_KEY`, dezelfde als Distance Matrix) blijft server-side in
  een action. Per aanroep afgerekend op de sleutel van de app-eigenaar, dus: debounce
  350 ms + minimaal 3 tekens, sessie-token, krappe `X-Goog-FieldMask`, rate limit per
  gebruiker (`checkPlacesRateLimit`). `placesLogica.ts` is puur en wordt getest met
  een gemockte fetch — er gaan nooit echte calls uit in de testsuite.
- **Klant-import** — `src/lib/klant-import-parser.ts` is bewust tolerant: een rij
  wordt alleen geweigerd als er geen náám uit te halen is. Ontbrekende/buitenlandse
  postcodes en onleesbare e-mailadressen leveren een aandachtspunt op, geen fout. Het
  adresveld van de relatie-export ("Dijk 24A, 6127 AG Grevenbicht") wordt gesplitst
  door van achteren naar voren het laatste komma-segment met een postcode te zoeken.
  `importKlanten` en `importLeveranciers` accepteren lege adresvelden en gebruiken
  `normaliseerImportPostcode` (normaliseert, weigert nooit) i.p.v. de strenge
  varianten. Eén gedeelde dialog: `src/components/import/relatie-import-dialog.tsx`.
