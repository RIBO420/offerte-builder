# Auditherstel — resultaat

**Branch:** `fix/audit-2026-08-12` · **Datum:** 12 augustus 2026
**Uitgevoerd door:** 22 agents in 7 fasen · **Niets gecommit** — alles staat in de werktree.

---

## Gates — zelf nagedraaid, niet overgenomen uit agentrapporten

| Gate | Voor | Na |
|---|---|---|
| `npx tsc --noEmit` (web) | 0 fouten | **0 fouten** |
| `cd mobile && npx tsc --noEmit` | 0 fouten | **0 fouten** |
| `npx eslint .` | 0 problemen | **0 problemen** |
| `npx vitest run` | 88 files / 2751 tests | **97 files / 2847 tests** |
| `npx next build` | slaagt | **slaagt, 0 warnings** |

139 bestanden gewijzigd, 28 nieuw. +96 tests, waarvan 9 nieuwe testbestanden specifiek voor de security- en scoping-fixes.

---

## §1 — Account-overname (KRITIEK) — opgelost

`convex/users.ts::upsert` haalt clerkId, e-mail en naam nu uit `ctx.auth.getUserIdentity()`. De enige overgebleven arg is `bedrijfsnaam`. Zonder identity gooit de mutation.

**De eerste fix was niet genoeg** — de adversariële review vond dat de e-mail-fallback nog steeds `clerkId` op een bestaand record patchte. Wie e-mailadres X in zijn token kreeg, erfde nog altijd het account met dat adres, inclusief rol. De herstelronde heeft de by_email-fallback daarom volledig verwijderd; er wordt alleen nog op clerkId opgezocht.

Verder aangescherpt na review:

- `identity.emailVerified === false` blokkeert opslag én de ADMIN_EMAILS-promotie.
- Het patch-object is voorwaardelijk geworden. De oude code schreef `email`/`name`/`bedrijfsnaam` onvoorwaardelijk; omdat `ctx.db.patch` velden met `undefined` **wist**, sloopte elke aanroep het e-mailadres van een bestaand account. Dat had op zijn beurt de guard in `linkKlantAccount` (`if (klant.email && user.email)`) stilzwijgend uitgeschakeld.
- E-mail wordt genormaliseerd opgeslagen (trim + lowercase), zodat de case-insensitieve `isAdminEmail` en de exact matchende `by_email`-index niet meer uit elkaar lopen.
- `mobile/hooks/use-current-user.ts` riep nog de oude signatuur aan — gerepareerd.

**Gedragswijziging om te weten:** upsert koppelt niet meer op e-mailadres. Delen een dev- en prod-Clerk-instantie dezelfde Convex-database, dan ontstaat bij een instantiewissel voortaan een nieuwe users-rij in plaats van een stille overname. Bestaande productie-users merken niets.

---

## §2 — Cross-tenant lekken — opgelost, backfill nog te draaien

`userId` + `by_user`-index toegevoegd aan `urenRegistraties`, `voorcalculaties` en `direct_messages` — **optioneel**, zodat de deploy niet struikelt over bestaande data. Drie idempotente, batchgewijze backfill-migraties in `convex/migrations.ts`.

Gescopet: `weekPlanning` (4 plekken), `chat`, `users`, en in `medewerkers.ts` de naam-matching en de twee full-table-collects.

**Wat de gates niet zagen en de integratie-agent wél vond:** van de zes schrijfpaden naar die drie tabellen zette alleen `chat.ts` het nieuwe veld. Nieuwe rijen kregen `userId: undefined` en vielen daarmee buiten elke `by_user`-query — geen crash, geen typefout, gegevens die stil uit de app verdwijnen. Vijf inserts gerepareerd in `urenRegistraties.ts`, `projectKosten.ts`, `projecten.ts` en `voorcalculaties.ts`, met een test die aantoont dat een nieuwe registratie via de index vindbaar is.

---

## §3 — Ongeguarde endpoints — opgelost, plus vier die de audit miste

Gedicht: `standaardtuinen.get`, `projectKosten.getBudgetStatus`, `dagkaart.berekenReistijdenVoorDag`, `emailLogs.updateFromWebhook` (gedeeld geheim), rate limit op `configuratorAanvragen.create` en `getByReferentie`.

De review vond vier gaten die in mijn audit niet stonden:

- `standaardtuinen.createOfferteFromTemplate` omzeilde de nieuwe guard in `get` volledig — dit was de échte bypass.
- `projectKosten.checkBudgetThreshold` was een publieke mutation met alleen `requireAuthUserId`, zonder eigendomscheck.
- `projectKosten` haalde `instellingen` op met een ongescopete `.first()` — een willekeurige rij uit de tabel van een ander bedrijf.
- `dagkaart` had geen rate limit; de Maps-sleutel is deployment-breed, dus de rekening is van de app-eigenaar. Nu 10 calls/min per identiteit plus een harde bovengrens van 25 per aanroep.

Ook aangepast: `getBudgetStatus` gaf eerst `null` en zou na de fix gaan gooien — contractbreuk voor de enige consumer. Nu weer `null`. Datzelfde geldt voor `getByReferentie`: een throw in een live subscription duwde de publieke statuspagina in de error-boundary.

---

## §4 — Dark mode — grotendeels, niet volledig

Van **89** bestanden zonder enige `dark:`-variant naar **22**. `dark:`-varianten: 1647 → 2099.

Het aantal hardcoded kleurklassen steeg van 4158 naar 4511. Dat is geen regressie: statuskleuren hebben geen token in dit project, dus `text-green-600` werd `text-green-600 dark:text-green-400` — twee klassen waar er één stond.

De 22 resterende bestanden staan hieronder. De portaal-auth-pagina's zitten daar mogelijk bewust bij: de agent kreeg de opdracht niets te forceren als het portaal alleen in lichte modus draait. Dat is niet geverifieerd.

```
src/app/portaal/(auth)/registreren/[[...rest]]/page.tsx
src/app/portaal/(auth)/koppelen/page.tsx
src/app/portaal/(auth)/error.tsx
src/app/(public)/configurator/gazon/page.tsx
src/app/(public)/configurator/verticuteren/components/stap1-klantgegevens.tsx
src/app/(dashboard)/instellingen/components/normuren-tab.tsx
src/app/(dashboard)/instellingen/machines/page.tsx
src/app/(dashboard)/projecten/nieuw/page.tsx
src/app/(dashboard)/projecten/[id]/factuur/components/workflow-step-indicator.tsx
src/app/(dashboard)/uren/page.tsx
src/components/chat/new-dm-dialog.tsx
src/components/leads/kanban-board.tsx
src/components/planning/maand-kalender.tsx
src/components/app-sidebar.tsx
src/components/project/kosten/overzicht-tab.tsx
src/components/dashboard/aandacht-nodig.tsx
src/components/dashboard/pipeline-bento.tsx
src/components/dashboard/financieel-grid.tsx
src/components/dashboard/vloot-badge.tsx
src/components/meldingen/meldingen-board.tsx
src/components/wagenpark/compliance-badges.tsx
src/__tests__/components/ui/textarea-with-count.test.tsx
```

---

## §5 — Kwaliteit

- **console.\*:** 108 → 4. Nieuwe logger met eigen tests.
- **loading.tsx:** 32 → 46 · **error.tsx:** 3 → 5 (o.a. het portaal heeft nu een eigen boundary).
- **N+1 en indexen:** aangepakt in 14 Convex-modules via Map-lookups, in het idioom van `getMedewerkersMetPrestaties`.
- **TODO's:** nog steeds 8, bewust. De Mollie- en Calendly-agent kreeg de opdracht niets half te implementeren; er bestaat geen afspraken-tabel, dus de TODO's zijn herschreven tot concrete specificaties in plaats van weggewerkt.

---

## Handmatige acties vóór deploy

1. **`CONVEX_WEBHOOK_SECRET`** met dezelfde waarde in Vercel **én** Convex (`npx convex env set CONVEX_WEBHOOK_SECRET <waarde>`), de Convex-kant eerst. Ontbreekt hij, dan weigert Convex alle Resend-statusupdates en antwoordt de route 500 zodat Resend retryt — bewust faalgedrag, maar de tracking staat tot die tijd stil.
2. **Clerk JWT-template `convex` controleren**: bevat het `email`, `email_verified` en `name`? Ontbreekt `email`, dan krijgen nieuwe users een lege e-mail en werkt de ADMIN_EMAILS-promotie niet — inclusief de e2e-admin.
3. **Backfill-migraties draaien**, herhaald tot `klaar: true`, in hetzelfde deploy-window:
   ```
   npx convex run migrations:backfillUrenRegistratiesUserId '{}'
   npx convex run migrations:backfillVoorcalculatiesUserId '{}'
   npx convex run migrations:backfillDirectMessagesUserId '{}'
   ```
   Tot dat moment zijn bestaande uren, voorcalculaties en chatberichten onzichtbaar in de gescopete views.
4. **Rooktest** `dagkaart.berekenReistijdenVoorDag` op een echte deployment: geeft Convex de identiteit door van een action naar `ctx.runQuery`? Klopt die aanname niet, dan is de reistijdberekening fail-closed stuk — veilig, maar stil.

---

## Bewust niet gedaan

- **`userId` verplicht maken** in het schema — kan pas na een geslaagde backfill.
- **`medewerkerId` verplicht maken** — idem; de backfill-migratie bestaat, het veld is nog optioneel.
- **`initializeSystemTemplates` achter `requireAdmin`** — afgewezen als schijngat: geen argumenten, idempotent, hardcoded inhoud. `requireAdmin` zou wél een regressie geven, want `TemplateSelector` roept het client-side aan.
- **Klant die "medewerker" blijft als `linkKlantAccount` faalt** — reëel, maar geen regressie van deze fixes, en elke fix heeft een echte faalmodus (een medewerker die óók klant is, raakt zijn dashboard kwijt). Aparte beslissing.
- **`linkKlantAccount` guard bij ontbrekende e-mailclaim** — aanbeveling: `if (klant.email && !user.email) throw`.
- **Webhookgeheim als HTTP-header** in plaats van functie-argument — vereist een `httpAction` in `convex/http.ts`.

## Niet geverifieerd

Playwright E2E is niet gedraaid; dat vereist een draaiende `npm run dev` plus `npx convex dev` en auth-credentials.
