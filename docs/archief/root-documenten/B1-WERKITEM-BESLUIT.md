# B1 — Besluit: werkitem-modellering in Convex

**Datum:** 2026-07-10
**Status:** Besloten (architect), ter bevestiging team-lead
**Referenties:** PRD §1.1 (`prd-toptuinen-app-v1.md` r.62–87), PLAN-PRD-V1.md beslispunt B1, schema-audit Fase 0

---

## Besluit

**Optie C — de bestaande `projecten`-tabel in-place generaliseren tot dé werkitem-tabel, zonder fysieke hernoeming.** Beurten worden rijen in dezelfde tabel met `type: "onderhoudsbeurt"`. De naam "werkitem" bestaat alleen in code (module `convex/werkitems.ts`, exported type `WerkItem`), nooit in de UI — conform PRD §1.1 ("de gebruiker ziet het woord werkitem nooit").

Dus: **geen** nieuwe `werkitems`-tabel met datamigratie (A), **geen** aparte `beurten`-tabel (B).

---

## Motivatie

### Waarom niet A (nieuwe tabel + migratie van projecten)

Convex document-ID's zijn **tabel-gebonden**. Rijen verplaatsen van `projecten` naar `werkitems` genereert nieuwe `_id`'s en breekt daarmee elke bestaande referentie. De audit telt minstens **14 tabellen met een `projectId`-verwijzing** naar `projecten`:

`weekPlanning`, `planningTaken`, `voorcalculaties`, `urenRegistraties` (verplicht veld!), `facturen`, `servicemeldingen`, `garanties`, `kwaliteitsControles`, `machineGebruik`, `werklocaties`, `nacalculaties`, `chat_threads`, `locationSessions`, `meerwerk` — plus route-parameters (`/projecten/[id]`) en 26 functies in `convex/projecten.ts`.

Optie A betekent op **productiedata**: een ID-mappingtabel bouwen, 14+ tabellen herpatchen in een gefaseerde migratie, alle `v.id("projecten")`-validators herschrijven, en een window waarin oude en nieuwe ID's naast elkaar leven. Dat is het grootste migratierisico van de drie opties, voor nul functionele winst: de data blijft inhoudelijk identiek. Een fysieke hernoeming (variant van C) heeft in Convex exact hetzelfde probleem — hernoemen = kopiëren = nieuwe ID's — en valt dus ook af.

### Waarom niet B (projecten behouden + aparte beurten-tabel)

De PRD-kern is juist dat planbord (§2.2), uren (§2.6), facturatie (§2.8) en tijdlijn (§2.3) **generiek op werkitems** werken. Met twee tabellen krijgt elke consument polymorfe referenties (`v.union(v.id("projecten"), v.id("beurten"))`) of dubbele velden (`projectId?` + `beurtId?`):

- `urenRegistraties.projectId` is nu al verplicht `v.id("projecten")` in álle schrijfpaden (add, importBatch, syncUrenRegistraties, clockOut) — die zouden allemaal een tweede pad nodig hebben.
- Het planbord/de wachtrij zou twee brontabellen moeten mergen, sorteren en dedupliceren per view.
- De facturatie-engine ("afgeronde beurt → conceptfactuur", maar ook deelfacturen op projecten) zou twee koppelvelden en twee querypaden onderhouden.
- Promotie melding→werkitem en de acceptatietests 4, 8 en 12 werken op "een werkitem", niet op "een project of een beurt".

Optie B verplaatst de complexiteit dus van één migratie naar **permanente duplicatie in elke toekomstige module**. Bovendien delen project en beurt volgens PRD §1.1 vrijwel alle kernvelden (klant, titel, status, geplande_start/eind, team, geschatte uren, offerte/factuur/contract-koppelingen, adres) — het klassieke signaal voor single-table met type-discriminator.

### Waarom C wél

- **Migratierisico ≈ nul**: alle wijzigingen zijn additief (optionele velden + status-unie verbreden + één veld van verplicht naar optioneel). Geen enkel bestaand `_id` of referentie verandert. Bestaande 26 functies in `projecten.ts` blijven ongewijzigd draaien.
- **Alle afhankelijke tabellen werken direct ook voor beurten**: een beurt krijgt een `projecten`-`_id`, dus uren, weekPlanning, facturen, servicemeldingen etc. kunnen er zonder schemawijziging aan refereren.
- **De beurtengenerator (§2.1) krijgt zijn doeltabel**: hij insert rijen met `type: "onderhoudsbeurt"` + `contractId`.
- Het enige echte nadeel — de tabelnaam `projecten` dekt de lading niet meer — is een cosmetisch developer-probleem. Dat vangen we af met een `werkitems`-abstractielaag in code en een schema-comment. Een fysieke hernoeming kan desgewenst óóit nog, maar is nooit blokkerend.

---

## Doelmodel (schema-schets, `convex/schema.ts` → tabel `projecten`)

```ts
// WERKITEM-tabel (PRD §1.1). Fysieke naam blijft "projecten" (Convex-ID's zijn
// tabel-gebonden; hernoemen = datamigratie van 14+ referende tabellen).
// Code-alias: convex/werkitems.ts. UI: type project → "Project",
// type onderhoudsbeurt → "Onderhoudsbeurt".
projecten: defineTable({
  // — discriminator (nieuw) —
  type: v.optional(v.union(v.literal("project"), v.literal("onderhoudsbeurt"))),
  //   ^ optioneel tijdens migratie; na backfill verplicht maken (stap 3).
  //     Semantiek: undefined === "project" (alle bestaande rijen).

  // — bestaand, ongewijzigd —
  naam: v.string(),                       // = PRD "titel"
  klantId: v.optional(v.id("klanten")),   // schema blijft optioneel; mutations
                                          // eisen hem voor ALLE nieuwe records
  toegewezenMedewerkerIds: ...,
  klicMeldingGedaan: ...,
  // ... overige bestaande velden

  // — gewijzigd —
  offerteId: v.optional(v.id("offertes")), // was verplicht; PRD: nullable
  status: v.union(
    // project-statussen (bestaand)
    v.literal("gepland"), v.literal("in_uitvoering"), v.literal("afgerond"),
    v.literal("nacalculatie_compleet"), v.literal("gefactureerd"),
    // beurt-statussen (nieuw; "gepland"/"gefactureerd" gedeeld)
    v.literal("uitgevoerd"), v.literal("vervallen"),
  ),

  // — nieuwe gedeelde kernvelden (PRD §1.1), alle optioneel —
  geplandeStart: v.optional(v.string()),  // YYYY-MM-DD, gezet door planbord
  geplandeEind: v.optional(v.string()),
  teamId: v.optional(v.id("teams")),
  geschatteUren: v.optional(v.number()),  // uit offerte/receptuur/contractregel
  factuurId: v.optional(v.id("facturen")),
  contractId: v.optional(v.id("onderhoudscontracten")), // alleen bij beurten
  adres: v.optional(v.string()),          // default klantadres, overschrijfbaar

  // — grondverzet (alleen type project, PRD §1.1) —
  ontgravenVolumeM3: v.optional(v.number()),
  mbaStatus: v.optional(v.string()),
  dsoReferentie: v.optional(v.string()),
})
  // bestaande indexes blijven; nieuw:
  .index("by_user_type", ["userId", "type"])
  .index("by_klant", ["klantId"])
  .index("by_contract", ["contractId"])
  .index("by_user_type_status", ["userId", "type", "status"])
  .index("by_user_geplandeStart", ["userId", "geplandeStart"]) // planbord/wachtrij
```

**Type-invarianten** (afgedwongen in mutations, niet in schema — Convex kent geen conditionele validators):

| Regel | project | onderhoudsbeurt |
|---|---|---|
| Toegestane statussen | gepland / in_uitvoering / afgerond / nacalculatie_compleet / gefactureerd | gepland / uitgevoerd / gefactureerd / vervallen |
| `contractId` | verboden | optioneel (los = zonder contract, PRD §2.1) |
| `offerteId` | optioneel (was verplicht) | optioneel |
| `klantId` | verplicht bij create | verplicht bij create |
| Grondverzet-velden | toegestaan | verboden |
| Vrij notitieveld | **bestaat niet** (PRD: tijdlijn is de waarheid) | idem |

Eén statusvalidator-helper (`assertStatusVoorType(type, status)`) in `convex/werkitems.ts`, gebruikt door elke status-mutation.

---

## Code-architectuur

1. **`convex/werkitems.ts` (nieuw)** — de enige plek met werkitem-kennis:
   - `export type WerkItemType = "project" | "onderhoudsbeurt"` en `WerkItem`-doc-type;
   - helpers: `getType(doc)` (undefined → "project"), `assertStatusVoorType`, `resolveAdres(klant, werkitem)`;
   - generieke queries voor nieuwe consumenten: `listVoorWachtrij`, `listVoorPlanbord(range)`, `getById`.
2. **`convex/projecten.ts` blijft bestaan** en blijft de project-CRUD; list-queries krijgen één toevoeging: filter `type === "project" || type === undefined`, zodat beurten niet in `/projecten` lekken. Verder niet refactoren (raakt 26 functies + UI zo min mogelijk).
3. **Beurt-functies** (beurtengenerator §2.1, losse beurt) komen in `convex/werkitems.ts` of `convex/beurten.ts`, maar schrijven naar de `projecten`-tabel met `type: "onderhoudsbeurt"`.
4. **Nieuwe modules** (planbord-wachtrij, urensegmenten, facturatie-engine, tijdlijn-events) refereren uitsluitend via `werkitems.ts`-helpers en het veld `werkitemId: v.id("projecten")` — naamgeving in code mag "werkitem" zeggen terwijl de validator naar `projecten` wijst.

---

## Migratieschets (productie-veilig, 4 stappen)

**Stap 1 — additieve schema-deploy (geen datamutatie).**
Alle nieuwe velden optioneel toevoegen; `status`-unie verbreden; `offerteId` van verplicht → `v.optional`. Verplicht→optioneel is in Convex backwards-compatibel: alle bestaande documenten valideren ongewijzigd. Nieuwe indexes toevoegen (Convex bouwt ze online). **Rollback:** velden ongebruikt laten; niets te herstellen.

**Stap 2 — backfill (internalMutation, gebatcht).**
`type: "project"` zetten op alle bestaande rijen (paginated, idempotent). Optioneel in dezelfde run: `klantId` afleiden via `offerte.klantId` waar leeg, en rijen zonder afleidbare klant rapporteren (niet gokken). **Verificatie:** count(type=undefined) === 0.

**Stap 3 — schema aanscherpen.**
`type` van optioneel → verplicht (kan pas na stap 2). Mutations `projecten.create` en de nieuwe beurt-create eisen `klantId`. `klantId` blijft in het **schema** optioneel zolang er legacy-rijen zonder klant bestaan; pas verplicht maken nadat de rapportage uit stap 2 handmatig is opgeschoond.

**Stap 4 — consumenten aansluiten (per module, geen big bang).**
- `/projecten`-queries: type-filter (stap 4a, klein).
- Beurtengenerator §2.1 schrijft beurten (Fase 1.2).
- Planbord leest `listVoorPlanbord`; `weekPlanning`-rijen blijven geldig want `projectId` blijft bestaan — consolidatie van weekPlanning/planningTaken naar `geplandeStart/teamId` op het werkitem is een **aparte, latere** migratie (planbord-bouw, §2.2) en hoort niet bij B1.
- Uren/facturatie: `projectId`-velden hernoemen we NIET; ze verwijzen voortaan conceptueel naar een werkitem. Documenteren in schema-comment.

Elke stap is afzonderlijk deploybaar en terugdraaibaar; er is geen moment waarop oude code faalt op nieuwe data of andersom.

---

## Consequenties voor de rest van het plan

- **§2.1 beurtengenerator**: doeltabel bestaat na stap 3; genereert per contractwerkzaamheid rijen met `contractId`, `geschatteUren` (= geschatteUrenPerBeurt), status "gepland".
- **§2.2 planbord**: werkt op één tabel; `geplandeStart/geplandeEind/teamId` zijn de PRD-planningsvelden. Bestaande `weekPlanning` blijft de bemannings-detailtabel tot het planbord-ontwerp anders beslist.
- **§2.6 uren**: `urenRegistraties.projectId` accepteert automatisch beurten — geen schemawijziging nodig voor "uren op elk werkitem".
- **§2.8 facturatie**: "afgeronde beurt → conceptfactuur" is een query op `type=onderhoudsbeurt, status=uitgevoerd` + `facturen.projectId`-koppeling die al bestaat.
- **§2.4 meldingen**: promotie melding→werkitem = insert in `projecten` + `servicemeldingen.projectId` zetten — bestaande relatie volstaat.
- **Naamgeving-afspraak**: in nieuwe code heet het domeinbegrip `werkitem`; de fysieke tabel en bestaande veldnamen (`projectId`) blijven. Dit is bewust en gedocumenteerd; níet half hernoemen.

## Open punten (niet blokkerend voor B1)

1. Legacy-rijen zonder afleidbare `klantId`: handmatige opschoonlijst uit stap 2.
2. Beurt-statusovergang "gefactureerd" moet t.z.t. door de facturatie-engine gezet worden, niet handmatig — vastleggen bij §2.8.
3. `adres` als string vs. gestructureerd adres: string volstaat voor v1 (consistent met `onderhoudscontracten.locatie`); herzien bij Google Maps-geocoding (§2.2 reistijd).
