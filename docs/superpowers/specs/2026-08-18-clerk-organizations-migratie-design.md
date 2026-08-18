# Clerk Organizations-migratie, Team-scherm & opruimfunctie — Design

**Datum:** 2026-08-18 · **Status:** ter review · **Eigenaar:** Ricardo

## 1. Context & probleem

Het Convex-schema is per ongeluk "multi-tenant per user": elke `users`-rij is z'n eigen
bedrijf, ~70 tabellen hangen aan `userId` (= bedrijfseigenaar), en iedereen die voor het
eerst inlogt wordt via `users.upsert` stilletjes een nieuwe tenant met eigen defaults.
Gevolg op production: elke gebruiker ziet een eigen, (deels lege) database. Daarnaast
bestaan er twee concurrerende scoping-resolvers (`requireAuthUserId` in ~55 files vs
`getCompanyUserId` in 22 files) en zijn leads (`configuratorAanvragen`) juist voor
iederéén zichtbaar.

Doel: één organisatie **Top Tuinen** waarvan alle gebruikers de data zien, gebouwd op
Clerk Organizations zodat de software later gewhitelabeld en doorverkocht kan worden
(nieuwe klant = nieuwe organization). Plus: een samengevoegd, geredesigned Team-scherm
en een weggestopte opruimfunctie in Instellingen.

## 2. Genomen besluiten

1. **Volledige org-migratie nú** (geen hybride): alle tenant-tabellen gaan van `userId`
   naar `orgId`. Dit is het goedkoopste moment: op klanten, leveranciers en leads na is
   alle production-data test en mag weg.
2. **Data van andere users op prod wordt weggegooid**; alleen de dataset van
   ricardobos43@gmail.com blijft en wordt de organisatiedata.
3. **Alle bestaande prod-accounts blijven bestaan** en worden lid van de organisatie.
   Rollen: ricardobos43@gmail.com → admin (app-rol `directie`);
   riboebusiness@gmail.com → member (app-rol `medewerker`, testaccount);
   alle overige accounts → admin (`directie`).
4. **Cleanup bewaart config + stamdata** (zie §7): alleen transactiedata wordt gewist.
5. **Uitvoering met een agent-team** (plan/review-agents op Fable high, bouwagents op
   Opus 5), met checkpoint-commits per fase.

## 3. Architectuur

### 3.1 Clerk

- Organizations aanzetten op het Clerk-project (dev-instance `moral-earwig-1` én
  prod-instance `clerk.toptuinen.app`).
- Organisatie **Top Tuinen** aanmaken in beide instances.
- JWT-template `convex` uitbreiden met org-claims (`org_id`, `org_role`), zodat
  `ctx.auth.getUserIdentity()` het actieve org-id bevat.
- Lidmaatschap & uitnodigingen lopen via Clerk (org-invitations API). App-rollen
  (`directie`, `projectleider`, `voorman`, `medewerker`, `klant`, `onderaannemer_zzp`,
  `materiaalman`) blijven het autorisatiemodel in de app zelf (users-tabel +
  `public_metadata.role`, zoals nu). Clerk-org-rol is grof: `admin` voor directie,
  `member` voor de rest.
- Klant-portalaccounts (rol `klant`) worden **geen** org-lid; hun toegang blijft via de
  bestaande klant-koppeling (`users.linkedKlantId`).

### 3.2 Convex-datamodel

- **Nieuwe tabel `organisaties`**: `{ clerkOrgId, naam, slug?, actief }` +
  index `by_clerk_org_id`. Whitelabel-metadata (branding, domein) komt hier later bij.
- **Scoping-veld**: alle tenant-tabellen krijgen `orgId: v.id("organisaties")` in
  plaats van `userId: v.id("users")`. Indexes `by_user*` → `by_org*` (zelfde
  compound-velden), search-indexes `filterFields: ["userId"]` → `["orgId"]`.
- **Nu-globale tabellen krijgen óók `orgId`**: `configuratorAanvragen` (leads),
  `bouwstenen`, `tekstblokken`, `mailTriggers`, `uurtarieven`. Daarmee is elke tabel
  whitelabel-klaar; `notification_log` wordt geschrapt uit scope (blijft op
  clerkId-strings, is puur log).
- **Systeemdefaults**: `correctiefactoren`, `standaardtuinen`, `plantsoorten` krijgen
  `orgId: v.optional(...)`; `null` = systeembreed (zelfde semantiek als nu met userId).
- **Persoonlijke tabellen blijven op userId**: `notification_preferences`,
  `pushTokens`, `notifications` (per ontvanger), `direct_messages` deelnemers-velden.
- **Kindtabellen blijven parent-derived** (geen eigen orgId): `offerte_messages`,
  `planningTaken`, `weekPlanning`, `machineGebruik`, `nacalculaties`,
  `geofenceEvents`, `leadActiviteiten`, `contractWerkzaamheden`, `chat_messages`.
- **`users` blijft globaal** (geen tenant-veld). Koppelvelden (`linkedMedewerkerId`,
  `linkedKlantId`, `clerkId`) blijven zoals ze zijn.
- **Backfill-gaten verdwijnen**: `voorcalculaties.userId` en `urenRegistraties.userId`
  waren optioneel wegens legacy rijen; die rijen zijn transactiedata en worden bij de
  migratie gewist, dus `orgId` wordt daar gewoon **verplicht**.
- Velden die een bedrijfs-user aanwezen onder een andere naam gaan mee:
  `team_messages.companyId` en `chat_threads.companyUserId` → `orgId`.
  Het dode veld `medewerkers.clerkOrgId` + index `by_org` vervalt (wordt vervangen
  door de echte org-scoping).

### 3.3 Eén resolver

Nieuw in `convex/auth.ts`:

- `requireOrg(ctx)` → leest `org_id` uit de identity, zoekt `organisaties` via
  `by_clerk_org_id`, gooit `AuthError` bij ontbreken. Retourneert `{ org, user }`.
- `requireOrgId(ctx)` → shorthand die alleen `Id<"organisaties">` teruggeeft.
- `verifyOwnership` gaat van `{userId}` naar `{orgId}` vergelijken.

`getCompanyUserId` (roles.ts), de ad-hoc resolver in `medewerkers.ts` en het
scoping-gebruik van `requireAuthUserId` verdwijnen; alle 77 convex-files gebruiken het
nieuwe patroon. `requireAuthUserId` blijft alléén voor persoonlijke tabellen (§3.2).

### 3.4 Onboarding zonder eigen tenant

`users.upsert` maakt **geen** tenant-bootstrap meer aan (geen `instellingen`/
`normuren`/`producten`-seed per nieuwe user; die seed verhuist naar het aanmaken van
een organisatie). Een ingelogde user zonder org-lidmaatschap krijgt een
"Geen toegang — vraag je beheerder om een uitnodiging"-pagina. Client-side wordt de
enige org automatisch actief gezet (Clerk `setActive`), web én mobile, zodat het
`org_id`-claim altijd gevuld is voor org-leden.

## 4. Schema- & codemigratie (dev)

Volgorde, met checkpoint-commit per stap:

1. Schema: `organisaties`-tabel + `orgId` (tijdelijk `v.optional`) naast `userId` op
   alle tenant-tabellen; nieuwe `by_org*`-indexes naast de oude.
2. Resolvers in `auth.ts`; `users.upsert` ontdoen van tenant-bootstrap.
3. Alle convex-functies omzetten (77 files) — mechanisch, per domein-cluster
   parallelliseerbaar door bouwagents.
4. Web-app: providers (actieve org), guards, no-access-pagina, hooks.
5. Mobile-app: `use-auth.ts` gebruikt bestaande `orgId` al bijna; zelfde no-access-flow.
6. Dev-datamigratie draaien (zelfde script als prod, §5), oude `userId`-velden en
   `by_user*`-indexes uit het schema verwijderen, `orgId` verplicht maken.
7. E2E- en unit-tests bijwerken en groen draaien.

## 5. Production-migratie

**Clerk prod-setup** (script via Clerk backend-API, `CLERK_SECRET_KEY`):
Organizations aan → org "Top Tuinen" → alle bestaande users lid maken met rollen
volgens besluit 3 → `public_metadata.role` overeenkomstig zetten.

**Convex prod, twee fasen** (patroon van `demoSeed.ts`: deployment-slug-guard
`impartial-dinosaur-829` + expliciete bevestigings-arg):

- **Fase A** — deploy schema met optionele `orgId` + interne migratiefuncties. Draai
  `migreerNaarOrganisatie`:
  1. `organisaties`-rij "Top Tuinen" aanmaken (clerkOrgId uit Clerk-setup).
  2. Bewaartabellen van de eigenaar (users-rij van ricardobos43@gmail.com):
     `klanten`, `leveranciers` + alle config/stamdata uit de bewaarlijst (§7) →
     `orgId` zetten.
  3. Alle `configuratorAanvragen` (leads, nu zonder tenant-veld) → `orgId` zetten;
     `leadActiviteiten` blijven via parent geldig.
  4. Alles van andere users + alle transactiedata (wislijst §7) verwijderen, in
     batches via de scheduler.
  5. Verificatiequery `verifieerMigratie`: aantallen klanten/leveranciers/leads vóór
     en ná moeten exact gelijk zijn; geen enkele bewaarde rij zonder `orgId`.
- **Fase B** — deploy definitief schema (orgId verplicht, userId-tenant-velden weg)
  + alle nieuwe app-code. Daarna handmatige rooktest met beide accounts van Ricardo
  (admin-zicht én medewerker-zicht).

Volgorde is belangrijk: Clerk-setup eerst (org-id nodig), dan Fase A, dan Fase B.
Tijdens de migratie is er een kort venster waarin prod de oude code draait op deels
gemigreerde data; dat is acceptabel omdat alleen de drie bewaartabellen live in
gebruik zijn en die pas in Fase B van leespad wisselen.

## 6. Team-scherm (`/team`)

Vervangt `/gebruikers` en `/medewerkers` (oude routes redirecten; sidebar-links
Verlof/Verzuim blijven). Toegang: `directie` volledig; `projectleider` alleen-lezen
dossierdeel — client-side guard (`RequireRole`) én server-side checks op elke functie
(het huidige `/gebruikers` had alleen een client-side check).

- **Tab "Team"** — elke medewerker één rij met dossier + toegang:
  - Dossier: naam, functie, uurtarief, contracttype, specialisaties, certificaten,
    beschikbaarheid; bewerken via detail-sheet (bestaande medewerkers-functionaliteit
    verhuist mee).
  - Toegang: status *Geen account* / *Uitgenodigd* / *Actief*.
    - **Uitnodigen**: kies app-rol → Clerk org-invitation per e-mail
      (+ `public_metadata.role` in de invitation). Opnieuw versturen / intrekken kan.
    - **Automatische koppeling**: accepteert iemand de invite en logt in, dan matcht
      `users.upsert` het account op uitnodigings-e-mail → zet
      `medewerkers.clerkUserId`, `users.linkedMedewerkerId` en de app-rol. Het
      handmatige "linken" verdwijnt.
    - *Actief*: rol-badge, rol wijzigen, toegang intrekken (org-membership + metadata).
  - Statusfilter: actief personeel / uit dienst / met account.
- **Tab "Accounts"** — accounts zonder medewerker-dossier (extra admins,
  testaccounts): rol wijzigen, account verwijderen (bestaande `deleteUser`-flow incl.
  Clerk-delete). Klant-portalaccounts vallen hierbuiten.
- **Visueel**: zelfde tabel-/badge-/sheet-patronen als het klantdossier v7; stats-rij
  bovenaan (aantal actief, met account, uitgenodigd).

## 7. Opruimfunctie ("Werkdata opschonen")

**Plek:** onderaan `/instellingen` een onopvallende regel "Geavanceerd beheer" →
sectie **Gevarenzone**, alleen zichtbaar én bruikbaar voor `directie` (server-side
afgedwongen).

**Flow:** preview-query toont per categorie hoeveel rijen verwijderd gaan worden →
gebruiker typt letterlijk `OPSCHONEN` → mutation start batch-gewijze verwijdering via
de scheduler (grote tabellen kunnen niet in één mutation) → voortgang zichtbaar →
afsluitende logregel (wie, wanneer, aantallen). Scope: alleen de eigen organisatie.

**Referentie-schoonmaak:** velden op bewaarde rijen die naar gewiste rijen wijzen
worden leeggemaakt (o.a. lead → `offerteId`-verwijzingen, klant → laatste-offerte/
project-verwijzingen). Verwijzingen tussen bewaarde tabellen (bijv.
`configuratorAanvragen.gekoppeldKlantId`) blijven intact.

**Exhaustiviteit:** de implementatie bevat één map `tabel → bewaren | wissen` die
compile-time gecheckt wordt tegen `schema.ts` (elke nieuwe tabel moet expliciet
geclassificeerd worden, anders faalt de build/test).

### Bewaarlijst (blijft staan)

| Categorie | Tabellen |
|---|---|
| Identiteit | `users`, `organisaties` |
| CRM | `klanten`, `leveranciers`, `configuratorAanvragen`, `leadActiviteiten` |
| Configuratie | `instellingen`, `producten`, `normuren`, `correctiefactoren`, `standaardtuinen`, `plantsoorten`, `uurtarieven`, `bouwstenen`, `tekstblokken`, `mailTriggers`, `emailTemplates`, `garantiePakketten`, `boekhoudInstellingen` |
| Stamdata | `medewerkers`, `teams`, `machines`, `voertuigen`, `voertuigUitrusting`, `vervalItems`, `afvalverwerkers`, `transportbedrijven` |
| Persoonlijk | `notification_preferences`, `pushTokens` |

### Wislijst (gaat weg)

| Categorie | Tabellen |
|---|---|
| Offertes & e-mail | `offertes`, `offerte_versions`, `offerte_messages`, `offerte_reminders`, `conceptMails`, `email_logs`, `leerfeedback_historie` |
| Facturatie | `facturen`, `betalingen`, `betalingsherinneringen`, `contractFacturen`, `boekhoudSync` |
| Projecten & planning | `projecten`, `planningTaken`, `weekPlanning`, `teamBemanning`, `afwezigheidsblokken`, `planbordLogboek`, `reistijdCache`, `dagkaartAfwijkingen`, `teamBusOverrides`, `middelReserveringen`, `werklocaties`, `jobSiteGeofences` |
| Uren & calculatie | `urenSegmenten`, `urenDagen`, `urenLogboek`, `urenRegistraties`, `voorcalculaties`, `nacalculaties`, `materiaalChecks`, `meerwerk`, `machineGebruik` |
| Wagenpark-historie | `voertuigOnderhoud`, `kilometerStanden`, `brandstofRegistratie`, `voertuigSchades` |
| Inkoop & voorraad | `inkooporders`, `voorraad`, `voorraadMutaties`, `projectKosten`, `kwaliteitsControles` |
| Personeel-historie | `verlofaanvragen`, `verzuimregistraties`, `toolboxMeetings` |
| Service & contracten | `onderhoudscontracten`, `contractWerkzaamheden`, `garanties`, `servicemeldingen`, `meldingComments`, `veldtaken`, `serviceAfspraken` |
| Klant-historie | `klantTijdlijn`, `klantTaken` |
| Communicatie | `team_messages`, `direct_messages`, `chat_threads`, `chat_messages`, `chat_attachments` |
| Locatie | `locationSessions`, `locationData`, `geofenceEvents`, `routes`, `locationAnalytics`, `locationAuditLog` |
| Notificaties & logs | `notifications`, `notificationDeliveryLog`, `pushNotificationLogs`, `notification_log`, `demoSeed` |

De production-migratie (§5, stap 4) hergebruikt exact dezelfde classificatie-map.

## 8. Testen & verificatie

- Unit/convex-tests voor `requireOrg`, upsert-koppeling (invite → automatisch linken),
  cleanup-classificatie (exhaustiviteit) en batch-verwijdering.
- E2E: bestaande suites omgezet naar org-model; nieuw scenario "invite → signup →
  ziet bedrijfsdata" en "user zonder org ziet no-access-pagina".
- Prod-verificatie: telquery's vóór/na migratie (klanten/leveranciers/leads exact
  gelijk), rooktest met ricardobos43 (directie) en riboebusiness (medewerker).

## 9. Risico's

| Risico | Mitigatie |
|---|---|
| Gemiste query bij de refactor → data onzichtbaar of te breed zichtbaar | Eén resolver-patroon, grep-baseline (`by_user` mag nergens meer voorkomen), reviews door aparte review-agents, E2E |
| Migratie wist te veel op prod | Deployment-guard + bevestigings-arg + preview-telling vóór uitvoering; klanten/leveranciers/leads-aantallen als harde invariant |
| JWT mist org-claim (template vergeten / geen actieve org) | `requireOrg` faalt hard met duidelijke fout; client zet actieve org automatisch; rooktest |
| Mobile loopt achter op web | Zelfde resolver server-side (mobile praat tegen dezelfde convex-functies); mobile-wijziging beperkt tot actieve-org + no-access |
| Clerk-invitations e-mail belandt in spam / komt niet aan | Status "Uitgenodigd" met opnieuw-versturen; invite-link ook kopieerbaar in het Team-scherm |
