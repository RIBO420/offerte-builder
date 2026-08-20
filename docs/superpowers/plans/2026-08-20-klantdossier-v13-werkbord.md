# Klantdossier v13 + Werkbord "Mijn dag" — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> Eén agent per fase-taak; stappen met `- [ ]`. Elke agent leest vóór de start:
> `docs/superpowers/specs/2026-08-20-prototype-v13/functionele-inventaris.md` (bindend gedrag)
> en `docs/superpowers/specs/2026-08-20-prototype-v13/toelichting-prototype-v13-toptuinen.md`.

**Goal:** De klantwensen uit prototype v13 (SAIS WORKS) inbouwen: taakmodel v2 met
maker/checker en 4 statussen, werkbord "Mijn dag", statusgekleurde dossier-statregel/tellers,
Bestanden-tab, klant-toestemmingsvlaggen, en logboek+uren op het bord.

**Architecture:** Bestaand dossier v7 + gesprekslog/opname/AI-keten blijft staan (werkt,
keys staan). We verbouwen `klantTaken` naar een users-gebaseerd v2-model (iedereen met
account toewijsbaar), voegen `taakReacties`, `dagLogboek` en `klantBestanden` toe, bouwen
een gedeelde taken-UI-kit en daarbovenop het dossier-facelift en het nieuwe `/mijn-dag`-bord.

**Tech Stack:** Next.js 16 (App Router), Convex (org-model!), Clerk, @dnd-kit (al aanwezig),
Tailwind v4 + eigen design system (SectiePaneel, ResponsiveTable, Loof & Leem-tokens).

**Spec:** `docs/superpowers/specs/2026-08-20-prototype-v13/` (toelichting + html + functionele-inventaris).

## Global Constraints

- **Org-scoping**: elke query/mutation via `requireOrgContext`/`requireOrgId` uit `convex/auth.ts`; elk nieuw document krijgt `orgId`; elke lees/schrijf-check via `verifyOrgOwnership`. Klant-rol heeft nul toegang tot taken/bord/logboek/dossier-intern.
- **Harde eisen klant** (inventaris §D): alle 7 blijven overeind; nr. 7: "Wacht op check" is een echte status met filters + signalering.
- **UI**: Nederlands; SectiePaneel i.p.v. Card; ResponsiveTable; nooit horizontaal scrollen; container-queries i.p.v. viewport-breakpoints; `EmptyState compact`; >3 rijacties → dropdown. Vormgeving in ónze tokens (kleurbetekenis uit inventaris §C), Instrument Sans blijft.
- **Convex regel 4**: optionele velden nooit ongeguard in `q.eq(veld, mogelijk-undefined)`.
- **Git**: pathspec-commits (`git add -N` voor nieuwe bestanden, dan `git commit -m "…" -- <paden>`); NOOIT `git stash`/`git checkout` op de gedeelde tree; committen mag, pushen alleen op expliciet verzoek.
- **Subagents draaien GEEN `npx convex`-commando's en GEEN `npm run build`** (dev-server draait mogelijk). Orchestrator doet codegen/push tussen fases. Tests: `npm test -- <pad>` met het index-bewuste `src/__tests__/helpers/convex-mock.ts`.
- **Falsificatie-verificatie** op elke fix/feature: laat de test eerst falen (of toon dat het gedrag zonder de wijziging fout is) vóór je "werkt" claimt.

## Besluiten (defaults, door orchestrator genomen — bespreekbaar)

1. Bestanden-tab heet **"Bestanden"** (voorstel klant).
2. Maker/checker/uitzetter verwijzen naar **`users`** (niet `medewerkers`); toewijsbaar = alle actieve org-accounts behalve rol `klant`; directie/kantoor gemarkeerd "(admin)".
3. **`dagLogboek` is een eigen, lichte tabel** — we vervuilen de uren-controle-keten (`urenSegmenten`) niet. FAB toont "Naar urenstaat" → `/uren`. Geen "Dag indienen" in v1.
4. `/mijn-dag` is een **nieuwe route + sidebar-item**; het dashboard-paneel "Mijn taken" blijft maar gaat op het v2-model draaien en linkt naar het bord. De "Ik ben X"-picker uit het prototype vervalt (demo); perspectief = ingelogde gebruiker.
5. Deeplinks blijven via **`?tab=`** (bestaand patroon, voldoet aan eis 6).
6. Fotolabels: `voor|tijdens|na|schets` (incl. "na" uit de toelichting).

---

## Fase 1 — Backend taakmodel v2 (agent **bouw-backend**, blocking)

**Files:** Modify `convex/schema.ts` (klantTaken ~r.3807, klanten-tabel), `convex/klantTaken.ts`,
`convex/users.ts` (toewijsbaarheids-query); Create `convex/taakReacties.ts`, `convex/dagLogboek.ts`,
`convex/klantBestanden.ts`, `convex/migrations/taakmodelV2.ts`;
Test `src/__tests__/unit/convex/taakmodel-v2.test.ts` (+ bestaande klantTaken-tests aanpassen).

**Produces (contract voor fase 2/3 — exact):**

```ts
// schema: klantTaken v2 (bestaande velden behouden tenzij hieronder anders)
status: v.union(v.literal("todo"), v.literal("bezig"), v.literal("check"), v.literal("klaar"))
makerId: v.optional(v.id("users"))        // "Maakt het"
checkerId: v.optional(v.id("users"))      // "Checkt het voor verzending"
uitgezetDoorId: v.optional(v.id("users")) // uitzetter; migreer vanuit aangemaaktDoorId als dat al users is
subtaken: v.optional(v.array(v.object({ titel: v.string(), klaar: v.boolean() })))
laatsteBewegingOp: v.number()             // ms; élke status-/toewijzings-/overdrachtsmutatie zet dit op Date.now()
// toegewezenAanId (medewerkers) blijft tijdelijk optioneel staan; migratie zet hem om en maakt hem leeg
// index toevoegen: by_org_status ["orgId","status"], by_org_maker ["orgId","makerId"]

// nieuwe tabellen (alle met orgId + passende by_-indexen)
taakReacties: { orgId, taakId: v.id("klantTaken"), auteurId: v.id("users"), tekst: v.string(),
  timestamp: v.number(), soort: v.union(v.literal("reactie"), v.literal("herinnering")) } // index by_taak
dagLogboek: { orgId, userId: v.id("users"), datum: v.string() /*YYYY-MM-DD*/, timestamp: v.number(),
  tekst: v.string(), uren: v.optional(v.number()) } // index by_org_user_datum ["orgId","userId","datum"]
klantBestanden: { orgId, klantId: v.id("klanten"), soort: v.union(v.literal("foto"), v.literal("document")),
  label: v.optional(v.union(v.literal("voor"), v.literal("tijdens"), v.literal("na"), v.literal("schets"))),
  titel: v.string(), storageId: v.optional(v.id("_storage")), bron: v.union(v.literal("upload"),
  v.literal("offerte"), v.literal("factuur"), v.literal("klant")), offerteId: v.optional(v.id("offertes")),
  factuurId: v.optional(v.id("facturen")), nummer: v.optional(v.string()),
  geuploadDoorId: v.optional(v.id("users")), timestamp: v.number() } // index by_klant ["orgId","klantId"]

// klanten-tabel: + opnameToestemming: v.optional(v.boolean()), bevestigingsmailBijInplannen: v.optional(v.boolean())
```

```ts
// convex/klantTaken.ts — publieke API (alle org-gescoped, klant-rol geweigerd)
listVoorKlant({ klantId })  // → VerrijkteTaak[]
mijnDag({})                 // → { taken: VerrijkteTaak[], personen: ToewijsbaarPersoon[],
                            //     klanten: {_id, naam}[] } — alle niet-klaar taken van de org
                            //     + klaar-taken van de laatste 7 dagen
create({ klantId, titel, omschrijving?, deadline?, prioriteit?, makerId?, checkerId? })
update({ taakId, titel?, omschrijving?, deadline?, prioriteit?, subtaken? })
setStatus({ taakId, status })            // reset laatsteBewegingOp
wijsToe({ taakId, makerId: id|null, checkerId: id|null })  // reset; overdracht = reset
zelfOppakken({ taakId })                 // makerId = ik, reset
remove({ taakId })

// VerrijkteTaak = taak + { stilDagen: number, over: boolean, ai: boolean,
//   maker/checker/uitzetter: { _id, naam, initialen, isAdmin } | null,
//   subtakenKlaar: number, subtakenTotaal: number, reactieCount: number, klantNaam: string }
// stilDagen = hele dagen sinds laatsteBewegingOp; over = deadline < vandaag && status !== "klaar"
// ai = bronTijdlijnId aanwezig
```

```ts
// convex/taakReacties.ts
list({ taakId })                          // → (reactie + auteurNaam/initialen)[]
plaats({ taakId, tekst })
plaatsHerinnering({ taakId })             // soort "herinnering", server kiest gericht-aan:
                                          // checker bij status "check", anders maker; tekst:
                                          // "Even een reminder: dit staat nog open bij [voornaam]."
// convex/dagLogboek.ts
vandaag({})                               // → { regels: [...], totaalUren: number } (eigen regels, vandaag)
voegToe({ tekst })                        // server parseert uren: /(\d+[.,]?\d*)\s*(u|uur|h)\b/ → uren,
                                          // /(\d+)\s*(m|min|minuten)\b/ → uren afgerond op 0,1; anders uren=undefined
// convex/klantBestanden.ts
list({ klantId })                         // → { fotos: [...], documenten: [...] } met download-URLs
genereerUploadUrl({})
registreer({ klantId, soort, label?, titel, storageId })
verwijder({ bestandId })
// users.ts: takenToewijsbaar({}) → { _id, naam, initialen, isAdmin }[] — alle actieve org-users
//   behalve rol "klant"; isAdmin = rol directie/projectleider(kantoor)
```

- [ ] 1.1 Schema-wijziging in twee stappen i.v.m. bestaande dev-data: eerst status-union
      **tijdelijk** `todo|bezig|check|klaar|open|afgerond` + alle nieuwe velden/tabellen;
      `convex/migrations/taakmodelV2.ts` met internalMutation `migreer` (batched, à la
      `naarOrganisaties.ts`): `open→todo`, `afgerond→klaar`, `toegewezenAanId` →
      `makerId` (via `medewerkers.clerkUserId` → users-rij; geen match → leeg laten),
      `uitgezetDoorId` uit `aangemaaktDoorId` als dat een users-id is,
      `laatsteBewegingOp` = `_creationTime`, daarna `toegewezenAanId` leegzetten.
      **Meld in je eindrapport dat de orchestrator moet pushen + migreren**, waarna jij in
      een vervolgcommit de union op 4 waarden strak zet en `toegewezenAanId` als
      deprecated optioneel laat staan.
- [ ] 1.2 `klantTaken.ts` v2 conform contract; `mijnTaken` (dashboard) herschrijven op
      makerId/checkerId (de "val terug op alle org-taken"-bug voor accounts zonder
      medewerkers-rij verdwijnt daarmee — schrijf daar expliciet een regressietest voor).
- [ ] 1.3 `taakReacties.ts`, `dagLogboek.ts`, `klantBestanden.ts`, `users.takenToewijsbaar` conform contract.
- [ ] 1.4 Auto-archivering: zoek de verzend-mutations van offertes en facturen en voeg daar
      een `klantBestanden`-insert toe (soort "document", bron "offerte"/"factuur", nummer,
      titel "Offerte OF-… "/"Factuur F-…", storageId van de gegenereerde PDF als die
      bestaat, anders alleen verwijzing via offerteId/factuurId).
- [ ] 1.5 `dossierTellingen` (in `convex/klanten.ts`) uitbreiden t.b.v. statregel + gekleurde
      tellers: `{ openstaandBedrag, openFacturen, factuurOuderDan30: boolean, openTaken,
      eerstvolgendeDeadline: string|null, offertesTotaal, offertesConcept, laatsteContactOp:
      number|null, klantSinds: number, bestanden: number, tijdlijn: number }`.
- [ ] 1.6 Tests (convex-mock, falsificatie eerst): statusmigratie-mapping, stilDagen/over-afleiding,
      reset bij setStatus/wijsToe/zelfOppakken, herinnering kiest checker bij "check",
      urenparsing (`"1,5u"→1.5`, `"45m"→0.8`, `"overleg"→undefined`), org-isolatie
      (seedAndereOrganisatie), klant-rol geweigerd op alle nieuwe endpoints,
      `mijnTaken`-regressie, toewijsbaarheid bevat admin-account.
- [ ] 1.7 Typecheck (`npx tsc --noEmit` mag wél) + pathspec-commit(s).

**Orchestrator na fase 1:** `npx convex dev --once` (push), migratie draaien, verifiëren,
daarna agent de union laten strakzetten + tweede push.

---

## Fase 2 — Gedeelde taken-UI-kit (agent **bouw-takenkit**)

**Files:** Create in `src/components/taken/`: `taak-kaart.tsx`, `taak-tags.tsx`,
`wie-doet-wat.tsx`, `subtaken-lijst.tsx`, `taak-status-knoppen.tsx`, `reacties-blok.tsx`,
`persoon-avatar.tsx`, `types.ts`; Modify `src/components/klanten/klant-taken-card.tsx`
(op v2 + nieuwe kaart), `src/components/dashboard/mijn-taken.tsx` + `taak-composer.tsx`
(v2-model, link "Naar Mijn dag" — route bestaat pas na fase 3, gebruik gewoon `/mijn-dag`);
Test `src/__tests__/unit/components/taak-kaart.test.tsx`.

**Interfaces:** Consumes fase 1-contract (`VerrijkteTaak`, `ToewijsbaarPersoon`, mutations).
Produces:

```tsx
<TaakKaart taak={VerrijkteTaak} personen={ToewijsbaarPersoon[]}
  variant="dossier" | "drawer"   // drawer: geen eigen open/dicht-chevron, altijd open
  onOpenKlant?: (klantId) => void />
<TaakTags taak={...} toonStatus={boolean} />        // status/prio/deadline(amber)/x-y subtaken/UIT GESPREK/💬 n
<PersoonAvatar persoon={...} rol="maker" | "checker" | "neutraal" />  // maker groen, checker amber
<WieDoetWat taak personen />                        // 2 selects, optie "Niemand", "(admin)"-suffix
<TaakStatusKnoppen taak />                          // 4 knoppen; check-knop toont
                                                    // "Klaar, moet gecheckt door [voornaam]" (amber),
                                                    // zonder checker: "Klaar, moet gecheckt" + toast om checker te kiezen
<SubtakenLijst taak />                              // voortgangsbalk + "+ Subtaak toevoegen"
<ReactiesBlok taakId />                             // lijst + invoer (Enter), herinnering-soort gedimd/geïtaliceerd
```

- [ ] 2.1 Kit bouwen conform inventaris §A6 (ingeklapt + open gedrag, klaar = doorgestreept,
      toast "Klaargezet voor [checker]" bij check). SectiePaneel-stijl, geen Card.
- [ ] 2.2 `klant-taken-card.tsx` (dossier-tab Actueel + Taken) verbouwen naar de kit;
      secties "Open (n)" / "Afgerond (n)"; composer behoudt bestaande AI-koppelfunctie.
- [ ] 2.3 Dashboard `mijn-taken.tsx` op v2 ("Van mij"-scope: maker of checker = ik).
- [ ] 2.4 Component-tests (rendering statussen, checker-knoptekst, avatarrollen) + falsificatie;
      typecheck; pathspec-commit.

---

## Fase 3a — Dossier-facelift (agent **bouw-dossier**, parallel met 3b)

**Files:** Modify `src/app/(dashboard)/klanten/[id]/page.tsx`,
`src/components/klanten/dossier/dossier-nav.tsx`, cijferstrip-component (zoek in dossier-map),
`src/components/klanten/dossier/gesprek-composer.tsx` (alleen verifiëren/bijschaven),
instellingen-tabcomponent; Create `src/components/klanten/dossier/bestanden-tab.tsx`;
Test `src/__tests__/unit/components/dossier-statregel.test.tsx`.

**Interfaces:** Consumes `dossierTellingen` v2 (fase 1.5), `klantBestanden`-API, taken-kit (fase 2).

- [ ] 3a.1 **Statregel**: 4 klikbare tegels met 4px kleurbalk links (amber/groen/klei/donkergroen
      → onze tokens), inhoud + subteksten exact volgens inventaris §A1; klik zet `?tab=`.
- [ ] 3a.2 **Tellers** in dossier-nav statusgekleurd volgens §A2 (grijs `—` / amber / rood bij
      factuur >30 dagen); Actueel-teller = open taken + open facturen.
- [ ] 3a.3 **Actueel-layout** checken tegen §A3 (gesprek-kaart boven, 2 kolommen: taakkaarten
      uit de kit links, laatste 3 contactmomenten rechts) — bijschaven waar het afwijkt.
- [ ] 3a.4 **Bestanden-tab** (§A7): foto-grid met labelbadges + documentenlijst (auto-rijen
      "automatisch toegevoegd" voor verzonden offertes/facturen), uploadzone
      (`<input type="file" accept="image/*" capture="environment">` op mobiel/foto's;
      documenten accept pdf/afbeeldingen), nav-item "Bestanden" in groep Klant + teller.
      De oude `klant-documenten.tsx`-lijst gaat hierin op (redirect/verwijder de losse plek).
- [ ] 3a.5 **Instellingen-tab**: toggles "Bevestigingsmail bij inplannen" en "Gesprekken mogen
      opgenomen worden" (schrijven naar de nieuwe klant-velden). Gesprek-composer: als
      `opnameToestemming === true` toon naast de meldingsnotice "Mondelinge toestemming
      eerder vastgelegd" — de meldplicht-stap blijft ALTIJD (harde eis 3).
- [ ] 3a.6 **AI-flow verifiëren** tegen §A4 + harde eisen 1-5: bevestigingsstap met
      checkboxes (default aan) en knoppen "Vastleggen en taken aanmaken" / "Alleen gesprek
      vastleggen"; `gesprekAnalyse.analyseer` geeft huidige datum mee in de prompt en
      retourneert per taak titel/deadline|null/confidence; analyse-falen blokkeert opslaan
      niet. Wat al klopt: niet aanraken; wat afwijkt: bijwerken. Aangemaakte taken krijgen
      status "todo", uitzetter = ik.
- [ ] 3a.7 Tests (statregel-kleuren/klikdoelen, tellerregels incl. rood-bij-30d, bestanden-tab
      render) + falsificatie; typecheck; pathspec-commits.

---

## Fase 3b — Werkbord "Mijn dag" (agent **bouw-werkbord**, parallel met 3a)

**Files:** Create `src/app/(dashboard)/mijn-dag/page.tsx`, `src/components/mijn-dag/`
(`werkbord.tsx`, `bord-kaart.tsx`, `bord-kolom.tsx`, `blijft-liggen.tsx`, `taak-drawer.tsx`,
`logboek-fab.tsx`, `perspectief-balk.tsx`, `verdeel-op.ts` (pure indelingslogica));
Modify sidebar (zoek `src/components/` navigatie; item "Mijn dag" direct onder Dashboard);
Test `src/__tests__/unit/components/mijn-dag-verdeling.test.ts` (pure logica!).

**Interfaces:** Consumes `klantTaken.mijnDag`, mutations (`setStatus`, `wijsToe`, `update`
voor deadline, `zelfOppakken`), `taakReacties`, `dagLogboek`, taken-kit
(`<TaakKaart variant="drawer">`, `<TaakTags>`, `<PersoonAvatar>`, `<ReactiesBlok>`).

- [ ] 3b.1 Route + sidebar-item; pagina alleen voor niet-klant-rollen (zelfde patroon als
      andere dashboard-pagina's). Bordstate (perspectief/indeling/blijft-liggen-modus) in
      URL-queryparams zodat het deeplinkbaar en herlaadvast is.
- [ ] 3b.2 **Pure indelingslogica** in `verdeel-op.ts`: perspectieffilters (`mij`: maker of
      checker = ik; `uitgezet`: uitzetter = ik && maker ≠ ik; `alles`), statuschips,
      kolomindelingen `wanneer|wie|status|klant` (regels §B2: te laat → Vandaag; "Later" =
      geen datum; Wie-indeling: persoon = maker óf checker, plus kolom "Niet toegewezen";
      klaar verborgen behalve in Status-indeling), en `redenen()` voor blijft-liggen (§B3,
      exact drie triggers, hard vóór zacht, klaar uitgesloten, alleen ik-betrokken).
      **Eerst tests schrijven voor deze module, dan implementeren.**
- [ ] 3b.3 Bord met @dnd-kit (patroon: `src/components/leads/kanban-board.tsx`): drop-gedrag
      per indeling (§B2 — Wanneer: deadline = vandaag/morgen/vrijdag/leeg; Wie: wijsToe;
      Status: setStatus; Klant: geen drag). Kaartjes volgens §B4. Sticky kolomkoppen; het
      bord scrollt binnen zijn eigen container (geen paginabrede horizontale scroll).
- [ ] 3b.4 **Blijft liggen**: kolom (default, sticky links, rode stijl) / balk / verbergen,
      keuze in een segment-control; geen dubbeling met gewone kolommen in kolom-modus;
      lege balk = groene strip "Niets blijft liggen. Alles loopt."; kaartjes met reden,
      "bij [persoon]", knoppen Herinneren (→ `taakReacties.plaatsHerinnering`) en
      Zelf oppakken (→ `zelfOppakken`).
- [ ] 3b.5 **Drawer** bij kaartklik: `<TaakKaart variant="drawer">` + `<ReactiesBlok>`;
      sluit met Escape/overlay-klik.
- [ ] 3b.6 **Logboek-FAB** rechtsonder op dit scherm: live dagtotaal uit `dagLogboek.vandaag`,
      paneel "Wat heb ik gedaan" (lijst + invoer, Enter = `voegToe`), footer-link
      "Naar urenstaat" → `/uren`.
- [ ] 3b.7 Tests: verdeel-op.ts volledig (perspectieven, kolomtoewijzing incl. te-laat→Vandaag,
      alle drie blijft-liggen-triggers + uitsluitingen, geen-dubbeling) + falsificatie;
      typecheck; pathspec-commits.

---

## Fase 4 — Review + verificatie (orchestrator + agent **review**)

- [ ] 4.1 Review-agent: volledige diff tegen dit plan + inventaris §D (7 harde eisen) +
      Global Constraints; org-isolatie en rolchecks op elk nieuw endpoint adversarieel
      controleren (falsificatie: probeer als klant-rol en als andere org bij data te komen).
- [ ] 4.2 Orchestrator: volledige testsuite + typecheck groen; browser-schouw op dev
      (dossier: statregel/tellers/bestanden/gesprek→taken-flow; bord: alle 4 indelingen,
      slepen, blijft-liggen, drawer-reacties, FAB); daarna afrondrapport aan Ricardo.
      Mobile-app raakt dit plan niet (web-only), behalve dat mobile.ts-taakqueries mee
      moeten met het nieuwe statusmodel — review-agent checkt dat compileert en klopt.

## Buiten scope (bewust)

- "Dag indienen" vanuit de FAB (urenmodule heeft eigen indien-flow).
- Telefonie-integratie; Aanleg/Onderhoud/Offertes/Facturen-tabs (bestaan al, alleen tellers).
- Prototype-font en letterlijke hexkleuren.
