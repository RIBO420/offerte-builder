# Clerk Organizations-migratie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eén organisatie "Top Tuinen" (Clerk Organizations) waarvan alle gebruikers dezelfde Convex-data zien, met een samengevoegd Team-scherm en een verstopte opruimfunctie in Instellingen.

**Architecture:** Alle tenant-tabellen gaan van `userId: v.id("users")` naar `orgId: v.id("organisaties")`; één resolver `requireOrg(ctx)` leest het `org_id`-claim uit het Clerk-JWT. Eén compile-time-exhaustieve classificatiemap (`bewaren`/`wissen`) drijft zowel de production-migratie als de opruimfunctie. Prod gaat in twee fasen (orgId optioneel → migratie → orgId verplicht).

**Tech Stack:** Next.js 16 (App Router), Convex, Clerk (Organizations + backend-API), React Native Expo (mobile), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-18-clerk-organizations-migratie-design.md` — de bewaar-/wislijst in §7 is bindend.

**Werkafspraken uitvoering:**
- Checkpoint-commit na elke task (commitcommando staat in de task).
- Groene poort per fase: `npm run typecheck && npm run lint && npm run test:run`.
- CLAUDE.md-regels gelden onverkort (o.a. regel 4: nooit `q.eq(veld, undefined)`).
- Dev-deployment: `affable-rook-669`; prod: `impartial-dinosaur-829`. Fase 8 (prod) draait NOOIT zonder expliciete go van Ricardo in de sessie.

---

## Fase 0 — Clerk dev-setup

### Task 0.1: Clerk dev: Organizations + JWT-template (handmatig, Ricardo)

**Files:** geen — Clerk Dashboard.

Dit is de enige handmatige task. De uitvoerende agent zet hem klaar en vraagt Ricardo dit in het Clerk Dashboard (applicatie met dev-instance `moral-earwig-1`) te doen:

- [ ] **Step 1:** Dashboard → *Organizations* → **Enable organizations**. Laat "Allow users to create organizations" **uit** (org-aanmaak is beheerderswerk).
- [ ] **Step 2:** Dashboard → *JWT templates* → template **convex** → Claims uitbreiden met:

```json
{
  "org_id": "{{org.id}}",
  "org_role": "{{org.role}}"
}
```

(De bestaande claims laten staan. `{{org.id}}` is leeg als er geen actieve organisatie is — dat is precies wat `requireOrg` detecteert.)

- [ ] **Step 3:** Herhaal Step 1+2 voor de **production-instance** (`clerk.toptuinen.app`) — dit mag meteen, het is pas actief zodra org-lidmaatschappen bestaan (Fase 8).
- [ ] **Step 4:** Bevestig in de sessie dat beide instances klaar staan.

### Task 0.2: Setup-script: organisatie + leden via Clerk backend-API

**Files:**
- Create: `scripts/clerk-org-setup.mjs`

Script dat idempotent de org aanmaakt en alle bestaande users lid maakt. Gebruikt door dev (nu) én prod (Fase 8, met `--prod` en het prod-secret).

- [ ] **Step 1: Schrijf het script**

```js
#!/usr/bin/env node
// Maakt (idempotent) de Clerk-organisatie "Top Tuinen" aan en maakt alle
// bestaande users lid. Rollen volgens spec §2 besluit 3:
//   ricardobos43@gmail.com  → org:admin  (app-rol directie)
//   riboebusiness@gmail.com → org:member (app-rol medewerker, testaccount)
//   overige accounts        → org:admin  (app-rol directie)
// Klant-portalaccounts (app-rol "klant" in public_metadata) worden overgeslagen.
//
// Gebruik:  CLERK_SECRET_KEY=sk_test_… node scripts/clerk-org-setup.mjs
// Prod:     CLERK_SECRET_KEY=sk_live_… node scripts/clerk-org-setup.mjs --prod
import process from "node:process";

const SECRET = process.env.CLERK_SECRET_KEY;
if (!SECRET) throw new Error("CLERK_SECRET_KEY ontbreekt");
const isProd = process.argv.includes("--prod");
if (isProd !== SECRET.startsWith("sk_live_")) {
  throw new Error(`Key/vlag-mismatch: --prod=${isProd} maar key is ${SECRET.slice(0, 8)}…`);
}

const API = "https://api.clerk.com/v1";
const headers = { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" };

async function clerk(path, init = {}) {
  const res = await fetch(`${API}${path}`, { headers, ...init });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

const ADMIN_MAIL = "ricardobos43@gmail.com";
const MEDEWERKER_MAIL = "riboebusiness@gmail.com";

// 1. Organisatie vinden of aanmaken
const orgs = await clerk(`/organizations?query=Top%20Tuinen&limit=10`);
let org = (orgs.data ?? []).find((o) => o.name === "Top Tuinen");
if (!org) {
  org = await clerk(`/organizations`, {
    method: "POST",
    body: JSON.stringify({ name: "Top Tuinen", slug: "top-tuinen" }),
  });
  console.log(`Organisatie aangemaakt: ${org.id}`);
} else {
  console.log(`Organisatie bestaat al: ${org.id}`);
}

// 2. Alle users doorlopen (paginerend)
const leden = await clerk(`/organizations/${org.id}/memberships?limit=100`);
const bestaandeLidUserIds = new Set((leden.data ?? []).map((m) => m.public_user_data.user_id));

let offset = 0;
for (;;) {
  const users = await clerk(`/users?limit=100&offset=${offset}`);
  if (users.length === 0) break;
  for (const u of users) {
    const email = (u.email_addresses?.[0]?.email_address ?? "").toLowerCase();
    const appRol = u.public_metadata?.role;
    if (appRol === "klant") { console.log(`skip (klant): ${email}`); continue; }
    const isMedewerkerTest = email === MEDEWERKER_MAIL;
    const orgRole = isMedewerkerTest ? "org:member" : "org:admin";
    const nieuweAppRol = isMedewerkerTest ? "medewerker" : "directie";
    if (!bestaandeLidUserIds.has(u.id)) {
      await clerk(`/organizations/${org.id}/memberships`, {
        method: "POST",
        body: JSON.stringify({ user_id: u.id, role: orgRole }),
      });
    }
    await clerk(`/users/${u.id}/metadata`, {
      method: "PATCH",
      body: JSON.stringify({ public_metadata: { role: nieuweAppRol } }),
    });
    console.log(`lid: ${email} → ${orgRole} / app-rol ${nieuweAppRol}`);
  }
  offset += 100;
}
console.log(`\nKLAAR. clerkOrgId voor de Convex-migratie: ${org.id}`);
```

- [ ] **Step 2: Draai het script tegen dev** — `CLERK_SECRET_KEY` uit `.env.local`:

Run: `CLERK_SECRET_KEY=$(grep '^CLERK_SECRET_KEY=' .env.local | cut -d= -f2-) node scripts/clerk-org-setup.mjs`
Expected: `Organisatie aangemaakt: org_…` + per user een `lid: …`-regel + `KLAAR. clerkOrgId …`. **Noteer het `org_…`-id** — nodig in Task 6.1.

- [ ] **Step 3:** E-mailadres-check: verifieer in de output dat ricardobos43 op `org:admin/directie` staat. (riboebusiness bestaat alleen op prod — dev-run mag dat adres missen.)

- [ ] **Step 4: Commit**

```bash
git add scripts/clerk-org-setup.mjs
git commit -m "feat(clerk): idempotent org-setup-script (Top Tuinen, leden, rollen)"
```

---

## Fase 1 — Schema (dev)

### Task 1.1: `organisaties`-tabel + classificatiemap

**Files:**
- Modify: `convex/schema.ts` (bovenaan, naast `users`)
- Create: `convex/lib/orgTabellen.ts`
- Test: `src/lib/__tests__/orgTabellen.test.ts` (of de bestaande convex-test-locatie; volg het patroon van naburige tests)

- [ ] **Step 1: Schema — voeg de tabel toe**

```ts
organisaties: defineTable({
  clerkOrgId: v.string(),      // Clerk organization-id (org_…)
  naam: v.string(),
  slug: v.optional(v.string()),
  actief: v.boolean(),
  aangemaaktOp: v.number(),
}).index("by_clerk_org_id", ["clerkOrgId"]),
```

- [ ] **Step 2: Schrijf de classificatiemap** — bindend volgens spec §7; `satisfies` dwingt af dat élke tabel (ook toekomstige) geclassificeerd is:

```ts
// convex/lib/orgTabellen.ts
// Eén bron van waarheid voor (a) welke tabellen org-gescoped zijn en
// (b) wat de opruimfunctie en de prod-migratie bewaren dan wel wissen.
// `satisfies Record<TableNames, …>` = compile-time exhaustief: een nieuwe
// tabel toevoegen zonder classificatie breekt de build. Spec §7 is bindend.
import type { TableNames } from "../_generated/dataModel";

export type Classificatie =
  | "bewaren"          // blijft staan bij opruimen én prod-migratie
  | "wissen"           // transactiedata: weg bij opruimen én prod-migratie
  | "persoonlijk"      // per-user (userId blijft!), niet org-gescoped
  | "systeem";         // convex-intern / geen classificatie nodig

export const TABEL_CLASSIFICATIE = {
  // Identiteit
  users: "systeem", organisaties: "systeem",
  // CRM (bewaren)
  klanten: "bewaren", leveranciers: "bewaren",
  configuratorAanvragen: "bewaren", leadActiviteiten: "bewaren",
  // Configuratie (bewaren)
  instellingen: "bewaren", producten: "bewaren", normuren: "bewaren",
  correctiefactoren: "bewaren", standaardtuinen: "bewaren", plantsoorten: "bewaren",
  uurtarieven: "bewaren", bouwstenen: "bewaren", tekstblokken: "bewaren",
  mailTriggers: "bewaren", emailTemplates: "bewaren", garantiePakketten: "bewaren",
  boekhoudInstellingen: "bewaren",
  // Stamdata (bewaren)
  medewerkers: "bewaren", teams: "bewaren", machines: "bewaren",
  voertuigen: "bewaren", voertuigUitrusting: "bewaren", vervalItems: "bewaren",
  afvalverwerkers: "bewaren", transportbedrijven: "bewaren",
  // Persoonlijk (userId blijft)
  notification_preferences: "persoonlijk", pushTokens: "persoonlijk",
  // Offertes & e-mail (wissen)
  offertes: "wissen", offerte_versions: "wissen", offerte_messages: "wissen",
  offerte_reminders: "wissen", conceptMails: "wissen", email_logs: "wissen",
  leerfeedback_historie: "wissen",
  // Facturatie (wissen)
  facturen: "wissen", betalingen: "wissen", betalingsherinneringen: "wissen",
  contractFacturen: "wissen", boekhoudSync: "wissen",
  // Projecten & planning (wissen)
  projecten: "wissen", planningTaken: "wissen", weekPlanning: "wissen",
  teamBemanning: "wissen", afwezigheidsblokken: "wissen", planbordLogboek: "wissen",
  reistijdCache: "wissen", dagkaartAfwijkingen: "wissen", teamBusOverrides: "wissen",
  middelReserveringen: "wissen", werklocaties: "wissen", jobSiteGeofences: "wissen",
  // Uren & calculatie (wissen)
  urenSegmenten: "wissen", urenDagen: "wissen", urenLogboek: "wissen",
  urenRegistraties: "wissen", voorcalculaties: "wissen", nacalculaties: "wissen",
  materiaalChecks: "wissen", meerwerk: "wissen", machineGebruik: "wissen",
  // Wagenpark-historie (wissen)
  voertuigOnderhoud: "wissen", kilometerStanden: "wissen",
  brandstofRegistratie: "wissen", voertuigSchades: "wissen",
  // Inkoop & voorraad (wissen)
  inkooporders: "wissen", voorraad: "wissen", voorraadMutaties: "wissen",
  projectKosten: "wissen", kwaliteitsControles: "wissen",
  // Personeel-historie (wissen)
  verlofaanvragen: "wissen", verzuimregistraties: "wissen", toolboxMeetings: "wissen",
  // Service & contracten (wissen)
  onderhoudscontracten: "wissen", contractWerkzaamheden: "wissen", garanties: "wissen",
  servicemeldingen: "wissen", meldingComments: "wissen", veldtaken: "wissen",
  serviceAfspraken: "wissen",
  // Klant-historie (wissen)
  klantTijdlijn: "wissen", klantTaken: "wissen",
  // Communicatie (wissen)
  team_messages: "wissen", direct_messages: "wissen", chat_threads: "wissen",
  chat_messages: "wissen", chat_attachments: "wissen",
  // Locatie (wissen)
  locationSessions: "wissen", locationData: "wissen", geofenceEvents: "wissen",
  routes: "wissen", locationAnalytics: "wissen", locationAuditLog: "wissen",
  // Notificaties & logs (wissen)
  notifications: "wissen", notificationDeliveryLog: "wissen",
  pushNotificationLogs: "wissen", notification_log: "wissen", demoSeed: "wissen",
} as const satisfies Record<TableNames, Classificatie>;

// Kindtabellen zonder eigen orgId: wissen loopt via de ouder.
// veld = het verwijzende veld op het kind, index = de bestaande index daarop.
export const KIND_VAN: Partial<Record<TableNames, { ouder: TableNames; veld: string; index: string }>> = {
  offerte_messages:    { ouder: "offertes",           veld: "offerteId",  index: "by_offerte" },
  planningTaken:       { ouder: "projecten",          veld: "projectId",  index: "by_project" },
  weekPlanning:        { ouder: "projecten",          veld: "projectId",  index: "by_project" },
  machineGebruik:      { ouder: "projecten",          veld: "projectId",  index: "by_project" },
  nacalculaties:       { ouder: "projecten",          veld: "projectId",  index: "by_project" },
  geofenceEvents:      { ouder: "locationSessions",   veld: "sessionId",  index: "by_session" },
  contractWerkzaamheden:{ ouder: "onderhoudscontracten", veld: "contractId", index: "by_contract" },
  chat_messages:       { ouder: "chat_threads",       veld: "threadId",   index: "by_thread" },
  leadActiviteiten:    { ouder: "configuratorAanvragen", veld: "leadId",  index: "by_lead" },
};
// LET OP: verifieer de exacte indexnamen in schema.ts en corrigeer ze hier —
// de test in Step 3 controleert dat elke genoemde index bestaat.
```

- [ ] **Step 3: Schrijf de failing test**

```ts
import { describe, it, expect } from "vitest";
import schema from "../../../convex/schema";
import { TABEL_CLASSIFICATIE, KIND_VAN } from "../../../convex/lib/orgTabellen";

describe("orgTabellen-classificatie", () => {
  const schemaTabellen = Object.keys(schema.tables);

  it("classificeert exact de tabellen die in het schema bestaan", () => {
    expect(Object.keys(TABEL_CLASSIFICATIE).sort()).toEqual(schemaTabellen.sort());
  });

  it("kindtabellen verwijzen naar bestaande ouders en indexen", () => {
    for (const [kind, def] of Object.entries(KIND_VAN)) {
      expect(schemaTabellen).toContain(kind);
      expect(schemaTabellen).toContain(def.ouder);
      const indexNamen = schema.tables[kind].indexes.map((i: { indexDescriptor: string }) => i.indexDescriptor);
      expect(indexNamen).toContain(def.index);
    }
  });
});
```

- [ ] **Step 4:** Run: `npx vitest run src/lib/__tests__/orgTabellen.test.ts` — Expected: FAIL zolang indexnamen in `KIND_VAN` niet kloppen; corrigeer ze aan de hand van `schema.ts` tot PASS. (De `satisfies` vangt ontbrekende tabellen al bij `npm run typecheck`.)
- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/lib/orgTabellen.ts src/lib/__tests__/orgTabellen.test.ts
git commit -m "feat(schema): organisaties-tabel + exhaustieve tabel-classificatie"
```

### Task 1.2: `orgId` + `by_org*`-indexes op alle tenant-tabellen; `userId` optioneel

> **Uitvoeringsbesluit (18 aug):** `userId` optioneel maken veroorzaakt ~645 typefouten
> in ~100 bestanden die in Fase 3 toch herschreven worden. `userId` blijft daarom
> VERPLICHT tot Fase 6; de sweep schrijft tijdelijk beide velden (zie Fase 3-recept),
> en Task 6.2 verwijdert `userId` uit schema én insert-sites in één keer.

**Files:**
- Modify: `convex/schema.ts`

Mechanische transformatie op elke tabel met classificatie `bewaren` of `wissen` **behalve** de kindtabellen uit `KIND_VAN` (die blijven parent-derived) en behalve `notification_log` (blijft op clerkId-strings, wissen kan full-table):

- [ ] **Step 1:** Per tabel:
  - `userId: v.id("users"),` → `userId: v.optional(v.id("users")), orgId: v.optional(v.id("organisaties")),`
  - reeds-optionele `userId` (correctiefactoren, standaardtuinen, plantsoorten, voorcalculaties, urenRegistraties, direct_messages): laat staan en voeg alleen `orgId: v.optional(v.id("organisaties")),` toe.
  - `team_messages.companyId` en `chat_threads.companyUserId`: maak optioneel en voeg `orgId` toe.
  - Tabellen zonder tenant-veld (`configuratorAanvragen`, `bouwstenen`, `tekstblokken`, `mailTriggers`, `uurtarieven`): alleen `orgId: v.optional(v.id("organisaties")),` toevoegen.
- [ ] **Step 2:** Voor elke `.index("by_user…", ["userId", …rest])` een **extra** index `.index("by_org…", ["orgId", …rest])` toevoegen (oude laten staan tot Fase 6). Voor `chat_threads`: `by_company*` → extra `by_org*`. Voor `configuratorAanvragen`: nieuwe `.index("by_org", ["orgId"])` en `.index("by_org_status", ["orgId", "status"])` naast de bestaande.
- [ ] **Step 3:** Search-indexes (`klanten`, `producten`, `leveranciers`, `klantTijdlijn`): `filterFields: ["userId"]` → `filterFields: ["userId", "orgId"]` (userId eruit in Fase 6).
- [ ] **Step 4:** Verwijder het dode veld `medewerkers.clerkOrgId` + index `by_org` op die tabel (maakt de naam vrij voor de echte org-index).
- [ ] **Step 5:** Run: `npm run typecheck` — Expected: PASS. Start `npx convex dev --once` — Expected: schema-push zonder fouten.
- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): orgId + by_org-indexes op alle tenant-tabellen (userId tijdelijk optioneel)"
```

---

## Fase 2 — Resolvers, organisaties-functies, upsert

### Task 2.1: `requireOrg` / `requireOrgId` / `verifyOrgOwnership` in `convex/auth.ts`

**Files:**
- Modify: `convex/auth.ts`
- Test: convex-test naast bestaande auth-tests (volg de bestaande testlocatie/het harnas voor convex-functies)

- [ ] **Step 1: Schrijf failing tests** — drie gedragingen: (a) geen identity → AuthError "ingelogd", (b) identity zonder `org_id`-claim → AuthError "organisatie", (c) identity met `org_id` dat matcht op een actieve `organisaties`-rij → geeft die rij terug; plus (d) inactieve org → AuthError.
- [ ] **Step 2:** Run de tests — Expected: FAIL (functies bestaan niet).
- [ ] **Step 3: Implementeer** (na `requireAuthUserId`, zelfde stijl):

```ts
/**
 * De actieve organisatie uit het Clerk-JWT (org_id-claim, gezet door het
 * JWT-template "convex"). DE standaard-resolver voor alle tenant-data.
 */
export async function requireOrg(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new AuthError("Je moet ingelogd zijn om deze actie uit te voeren");
  }
  const clerkOrgId = (identity as unknown as { org_id?: string }).org_id;
  if (!clerkOrgId) {
    throw new AuthError(
      "Je account is nog niet aan een organisatie gekoppeld. Vraag je beheerder om een uitnodiging."
    );
  }
  const org = await ctx.db
    .query("organisaties")
    .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", clerkOrgId))
    .unique();
  if (!org || !org.actief) {
    throw new AuthError("Organisatie niet gevonden of inactief");
  }
  return org;
}

export async function requireOrgId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"organisaties">> {
  return (await requireOrg(ctx))._id;
}

/** Org-variant van verifyOwnership; vervangt die volledig in Fase 6. */
export async function verifyOrgOwnership<T extends { orgId?: Id<"organisaties"> }>(
  ctx: QueryCtx | MutationCtx,
  document: T | null,
  resourceName: string = "resource"
): Promise<T> {
  if (!document) throw new AuthError(`${resourceName} niet gevonden`);
  const orgId = await requireOrgId(ctx);
  if (!document.orgId || document.orgId.toString() !== orgId.toString()) {
    throw new AuthError(`Je hebt geen toegang tot deze ${resourceName}`);
  }
  return document;
}
```

- [ ] **Step 4:** Run tests — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(auth): requireOrg/requireOrgId/verifyOrgOwnership"`

### Task 2.2: `convex/organisaties.ts` — aanmaken + defaults-seed

**Files:**
- Create: `convex/organisaties.ts`
- Modify: `convex/users.ts` (verplaats `createDefaultNormuren` / `createDefaultProducten` / instellingen-seed naar org-niveau; exporteer ze of verplaats naar `convex/lib/orgDefaults.ts`)
- Test: convex-test

- [ ] **Step 1: Failing test** — `maakOrganisatie` maakt een `organisaties`-rij + seedt `instellingen`, `normuren`, `producten` met `orgId`; tweede aanroep met zelfde `clerkOrgId` is idempotent (geen dubbele rijen).
- [ ] **Step 2: Implementeer**

```ts
// convex/organisaties.ts
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireOrg } from "./auth";
import { seedOrgDefaults } from "./lib/orgDefaults";

// Interne beheerdersfunctie: aangeroepen door de migratie (Fase 6/8) en bij
// het later aanmaken van een whitelabel-klant. Idempotent op clerkOrgId.
export const maakOrganisatie = internalMutation({
  args: { clerkOrgId: v.string(), naam: v.string(), slug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const bestaande = await ctx.db
      .query("organisaties")
      .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();
    if (bestaande) return bestaande._id;
    const orgId = await ctx.db.insert("organisaties", {
      clerkOrgId: args.clerkOrgId,
      naam: args.naam,
      slug: args.slug,
      actief: true,
      aangemaaktOp: Date.now(),
    });
    await seedOrgDefaults(ctx, orgId); // instellingen + normuren + producten
    return orgId;
  },
});

export const getCurrent = query({
  args: {},
  handler: async (ctx) => await requireOrg(ctx),
});
```

`seedOrgDefaults` = de bestaande drie seeds uit `users.upsert` (users.ts:354-381 + `createDefaultNormuren`/`createDefaultProducten`), verplaatst naar `convex/lib/orgDefaults.ts` en omgezet naar `orgId`. **Alleen bij een org-aanroep zónder bestaande instellingen-rij seeden** (migratie van bestaande data mag niet dubbel seeden — check op `instellingen.by_org`).

- [ ] **Step 3:** Run tests — Expected: PASS. **Step 4: Commit** — `git commit -m "feat(convex): organisaties.maakOrganisatie + org-defaults-seed"`

### Task 2.3: `users.upsert` — geen tenant-bootstrap meer + invite-koppeling

**Files:**
- Modify: `convex/users.ts:247-385` (upsert), `convex/schema.ts` (medewerkers: uitnodigingsvelden)
- Test: convex-test

- [ ] **Step 1: Schema** — voeg toe aan `medewerkers`:

```ts
uitnodigingEmail: v.optional(v.string()),      // genormaliseerd (trim+lowercase)
uitnodigingRol: v.optional(userRoleValidator), // app-rol gekozen bij uitnodigen
uitnodigingStatus: v.optional(v.union(
  v.literal("uitgenodigd"), v.literal("geaccepteerd"), v.literal("ingetrokken")
)),
uitnodigingClerkId: v.optional(v.string()),    // Clerk invitation-id (intrekken/opnieuw)
```

en index `.index("by_uitnodiging_email", ["uitnodigingEmail"])`.

- [ ] **Step 2: Failing tests** voor het nieuwe upsert-gedrag:
  - (a) nieuwe user → users-rij met rol `medewerker`, **géén** instellingen/normuren/producten-seed meer;
  - (b) nieuwe user wiens e-mail matcht op een medewerker met `uitnodigingStatus === "uitgenodigd"` → `medewerkers.clerkUserId` gezet, `users.linkedMedewerkerId` gezet, `users.role` = `uitnodigingRol`, `uitnodigingStatus` → `"geaccepteerd"`;
  - (c) bestaande user: gedrag ongewijzigd (e-mail/naam-patch-semantiek blijft).
- [ ] **Step 3: Implementeer.** In `upsert`:
  - Verwijder de first-user-→-directie-regel (users.ts:332-342; het systeem heeft al users) en de drie seed-blokken (users.ts:354-381). `initializeSystemCorrectieFactoren` blijft.
  - Nieuw, ná het aanmaken/vinden van de users-rij (alleen bij `emailBruikbaar`):

```ts
// Uitnodigings-koppeling: is er een medewerker uitgenodigd op dit adres,
// dan koppelen we account ↔ medewerker en nemen we de uitgenodigde rol over.
if (emailBruikbaar) {
  const uitgenodigde = await ctx.db
    .query("medewerkers")
    .withIndex("by_uitnodiging_email", (q) => q.eq("uitnodigingEmail", emailClaim))
    .filter((q) => q.eq(q.field("uitnodigingStatus"), "uitgenodigd"))
    .first();
  if (uitgenodigde && !uitgenodigde.clerkUserId) {
    await ctx.db.patch(uitgenodigde._id, {
      clerkUserId: clerkId,
      uitnodigingStatus: "geaccepteerd",
    });
    await ctx.db.patch(userId, {
      linkedMedewerkerId: uitgenodigde._id,
      role: uitgenodigde.uitnodigingRol ?? "medewerker",
    });
  }
}
```

(Let op CLAUDE.md regel 4: de `withIndex` op `uitnodigingEmail` is veilig omdat `emailClaim` hier nooit leeg is — de `emailBruikbaar`-guard staat eromheen.)

- [ ] **Step 4:** Run tests — Expected: PASS. **Step 5: Commit** — `git commit -m "feat(auth): upsert zonder tenant-bootstrap + automatische invite-koppeling"`

---

## Fase 3 — De grote sweep (convex-functies)

**Het mechanische recept, geldig voor elke sweep-task:**

```ts
// OUD (patroon A)                          // NIEUW
const userId = await requireAuthUserId(ctx); const orgId = await requireOrgId(ctx);
.withIndex("by_user", (q) => q.eq("userId", userId))
                                             .withIndex("by_org", (q) => q.eq("orgId", orgId))
await ctx.db.insert("klanten", { userId, … }) await ctx.db.insert("klanten", { orgId: org._id, userId: user._id, … })
// userId blijft tijdelijk verplicht in het schema (besluit bij Task 1.2): inserts
// zetten beide — `const { org, user } = await requireOrgContext(ctx)` levert allebei
// (requireOrg geeft alléén de org; requireOrgContext bestaat voor insert-sites).
// Task 6.2 verwijdert userId uit schema én uit alle insert-sites.
// Lijstverwerking: hoist de resolver — één requireOrgId vóór de lus, vergelijk
// orgId in de lus; NIET per document verifyOrgOwnership/requireOrgId aanroepen.
verifyOwnership(ctx, doc, "…")               verifyOrgOwnership(ctx, doc, "…")

// OUD (patroon B)                          // NIEUW
const companyUserId = await getCompanyUserId(ctx);  const orgId = await requireOrgId(ctx);

// Persoonlijke tabellen (notification_preferences, pushTokens, notifications,
// deelnemer-velden van direct_messages): NIET aanraken — die blijven op userId.
// Systeemdefaults (correctiefactoren/standaardtuinen/plantsoorten):
//   "eigen + systeem"-queries worden: eigen via by_org(orgId) + systeem via
//   bestaande null-scan — zelfde vorm als nu met userId, veldnaam wisselt.
```

Elke sweep-task volgt dezelfde steps; het bestandcluster verschilt. **Standaard-steps per task:**

1. Genereer de werklijst: `grep -ln "requireAuthUserId\|getCompanyUserId\|by_user\|verifyOwnership" convex/<clusterbestanden>` en loop élk bestand langs met het recept.
2. `npm run typecheck` — PASS.
3. `npx vitest run <testbestanden van het cluster>` — PASS (testfixtures die `userId` seeden gaan mee naar `orgId`).
4. Verificatie-grep op het cluster: `grep -n "requireAuthUserId\|getCompanyUserId" convex/<clusterbestanden>` → 0 hits (behalve waar persoonlijke tabellen expliciet userId nodig hebben — motiveer die in een codecomment).
5. Commit: `git commit -m "refactor(org): <cluster> naar orgId-scoping"`.

- [ ] **Task 3.1 — CRM:** `klanten.ts`, `leveranciers.ts`, `configuratorAanvragen.ts` (leads krijgen hiermee voor het eerst échte scoping: elke list/count/pipeline-query via `by_org`), `leadsKlantenHelpers.ts`, `tijdlijn.ts`, `klantTaken.ts`, `backfillKlantIds.ts`, `portaalEmail.ts`
- [ ] **Task 3.2 — Offertes & calculatie:** `offertes.ts`, `berekeningen.ts`, `voorcalculaties` (gebruik `convex/lib/voorcalculatieLookup.ts` — CLAUDE.md regel 4), `normuren.ts`, `producten.ts`, `correctiefactoren.ts`, `standaardtuinen.ts`, `plantsoorten.ts`, `bouwstenen.ts`, `tekstblokken.ts`, `uurtarieven.ts`, `afronding.ts`
- [ ] **Task 3.3 — Facturatie & boekhouding:** `facturen.ts`, `betalingen*`, `betalingsherinneringen`, `contractFacturen`, `boekhoud*.ts`, `emailLogs.ts`, `emailTemplates.ts`, `mailTriggers.ts`, `conceptMails.ts`
- [ ] **Task 3.4 — Projecten & planning:** `projecten.ts`, `planbord*.ts`, `weekPlanning.ts`, `planningTaken`, `teams.ts`, `teamBemanning`, `afwezigheidsblokken`, `reistijd*`, `dagkaart.ts`, `middelReserveringen`, `werklocaties`, `planningsattendering.ts`
- [ ] **Task 3.5 — Uren & nacalculatie:** `urenSegmenten.ts`, `urenDagen`, `urenRegistraties.ts`, `urenLogboek`, `nacalculaties`, `meerwerk.ts`, `materiaalChecks`, `materiaalDelta.ts`, `voormanDashboard.ts` (lost meteen het bekende lek uit AUDIT-2026-08-12 op), `export.ts`
- [ ] **Task 3.6 — Middelen:** `machines.ts`/`machinepark.ts`, `voertuigen*.ts`, `vervalItems.ts`, `voorraad*.ts`, `inkooporders`, `projectKosten`, `kwaliteitsControles`, `afvalverwerkers`, `transportbedrijven`, `garantiePakketten`
- [ ] **Task 3.7 — Service & contracten:** `servicemeldingen.ts`, `onderhoudscontracten*.ts`, `garanties`, `veldtaken`, `serviceAfspraken`, `caseThread.ts`, `meldingComments`, `verlofaanvragen`, `verzuimregistraties`, `toolboxMeetings`
- [ ] **Task 3.8 — Communicatie & notificaties:** `chat.ts`, `chatThreads.ts` (`companyUserId` → `orgId`), `team_messages` (`companyId` → `orgId`), `notifications*.ts`, `push*.ts`, `locatie*/location*.ts`, `sidebarTellingen.ts`
- [ ] **Task 3.9 — Medewerkers & rollen:** `medewerkers.ts` — verwijder de ad-hoc `getUserRole` (regels 55-106) en vervang door `requireOrgId` + `normalizeRole(user.role)`; `roles.ts` — **verwijder `getCompanyUserId`** (614-632); `users.ts` — resterende scoping-plekken (`listUsersWithDetails` toont voortaan alleen org-leden: users met `linkedMedewerkerId` naar een medewerker van deze org, óf org-lidmaatschap via het Team-scherm), `instellingen.ts` (alle drie de patronen → `requireOrgId`), `demoSeed.ts` (seedt voortaan met `orgId` van de dev-org; `bepaalDeployment`-guard blijft), `softDelete.ts`, `mobile.ts`, `transcriptie.ts`, `gesprekAnalyse.ts`, `places.ts`
- [ ] **Task 3.10 — Sweep-poort (hele fase):**

Run: `grep -rn "getCompanyUserId" convex/ | grep -v "_generated"` → Expected: 0 hits.
Run: `grep -rln 'withIndex("by_user"' convex/ | grep -v "_generated"` → Expected: alléén bestanden die persoonlijke tabellen raken (notification_preferences, pushTokens, notifications) — elk ander hit is een gemiste plek.
Run: `npm run typecheck && npm run lint && npm run test:run` → Expected: PASS.
Commit: `git commit -m "refactor(org): sweep-poort groen — alle tenant-scoping op orgId"`

---

## Fase 4 — Web-app

### Task 4.1: Actieve org + no-access-pagina

**Files:**
- Create: `src/components/providers/org-gate.tsx`, `src/app/(dashboard)/geen-toegang/page.tsx`
- Modify: `src/components/providers/convex-client-provider.tsx`, dashboard-layout (waar de providers genest zijn), `src/hooks/use-current-user.ts`

- [ ] **Step 1: OrgGate** — binnen de Clerk-provider, om de dashboard-tree:

```tsx
"use client";
import { useOrganizationList, useAuth } from "@clerk/nextjs";
import { useEffect, type ReactNode } from "react";
import { GeenToegang } from "@/app/(dashboard)/geen-toegang/geen-toegang";

// Zet de (enige) organisatie automatisch actief zodat het org_id-claim in elk
// Convex-token zit. Zonder lidmaatschap: nette no-access-staat i.p.v. lege app.
export function OrgGate({ children }: { children: ReactNode }) {
  const { orgId } = useAuth();
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: false },
  });

  const eersteOrg = userMemberships?.data?.[0]?.organization;

  useEffect(() => {
    if (isLoaded && !orgId && eersteOrg) {
      void setActive({ organization: eersteOrg.id });
    }
  }, [isLoaded, orgId, eersteOrg, setActive]);

  if (!isLoaded) return null;                      // Clerk laadt nog
  if (!orgId && !eersteOrg) return <GeenToegang />; // geen lidmaatschap
  if (!orgId) return null;                          // setActive onderweg
  return <>{children}</>;
}
```

`GeenToegang`: bestaande empty-state-patronen (`EmptyState`), tekst "Je account is nog niet aan een organisatie gekoppeld — vraag je beheerder om een uitnodiging", knop Uitloggen. Klant-portalroutes (`/portaal/*`) vallen **buiten** de OrgGate (klanten zijn geen org-lid).

- [ ] **Step 2:** `use-current-user.ts`: de `upsert`-aanroep blijft; voeg `useOrganization()` toe waar de app org-context nodig heeft.
- [ ] **Step 3:** Handmatige check met browserpaneel: inloggen als staf → dashboard laadt data; check in de Convex-dashboard-logs dat queries `org_id` zien (of log éénmalig `identity` in `requireOrg` en verwijder die log weer).
- [ ] **Step 4:** `npm run typecheck && npm run lint` → PASS. Commit: `git commit -m "feat(web): OrgGate + geen-toegang-pagina"`

### Task 4.2: Convex-teamfuncties (`convex/team.ts`)

**Files:**
- Create: `convex/team.ts`
- Test: convex-test

- [ ] **Step 1: Failing tests** — (a) `listTeam` geeft per medewerker `accountStatus: "geen" | "uitgenodigd" | "actief"` + gekoppelde user-info; (b) `zetUitnodiging` (mutation) schrijft uitnodigingsvelden; (c) `trekUitnodigingIn` zet status `"ingetrokken"` en wist `uitnodigingEmail`; (d) alles directie-only (AuthError voor andere rollen).
- [ ] **Step 2: Implementeer**

```ts
// convex/team.ts — Team-scherm: dossier + toegang in één model.
import { v } from "convex/values";
import { query, mutation, internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireOrg, requireOrgId, AuthError } from "./auth";
import { requireAdmin } from "./roles";
import { userRoleValidator } from "./validators";

export const listTeam = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx); // projectleider mag lezen; UI beperkt acties
    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return await Promise.all(
      medewerkers.map(async (m) => {
        const account = m.clerkUserId
          ? await ctx.db.query("users")
              .withIndex("by_clerk_id", (q) => q.eq("clerkId", m.clerkUserId!))
              .unique()
          : null;
        const accountStatus = account
          ? ("actief" as const)
          : m.uitnodigingStatus === "uitgenodigd"
            ? ("uitgenodigd" as const)
            : ("geen" as const);
        return { ...m, accountStatus,
          account: account ? { id: account._id, email: account.email, role: account.role } : null };
      })
    );
  },
});

// Action: praat met de Clerk-API (kan niet vanuit een mutation).
export const stuurUitnodiging = action({
  args: { medewerkerId: v.id("medewerkers"), email: v.string(), rol: userRoleValidator },
  handler: async (ctx, args) => {
    const { clerkOrgId } = await ctx.runMutation(internal.team.valideerUitnodiging, args);
    const secret = process.env.CLERK_SECRET_KEY;
    if (!secret) throw new Error("CLERK_SECRET_KEY ontbreekt in Convex env");
    const res = await fetch(
      `https://api.clerk.com/v1/organizations/${clerkOrgId}/invitations`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email_address: args.email.trim().toLowerCase(),
          role: args.rol === "directie" ? "org:admin" : "org:member",
          public_metadata: { role: args.rol },
        }),
      }
    );
    if (!res.ok) throw new Error(`Clerk-uitnodiging mislukt: ${res.status} ${await res.text()}`);
    const invitation = await res.json();
    await ctx.runMutation(internal.team.registreerUitnodiging, {
      medewerkerId: args.medewerkerId, email: args.email, rol: args.rol,
      clerkInvitationId: invitation.id,
    });
  },
});

export const valideerUitnodiging = internalMutation({
  args: { medewerkerId: v.id("medewerkers"), email: v.string(), rol: userRoleValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const org = await requireOrg(ctx);
    const m = await ctx.db.get(args.medewerkerId);
    if (!m || m.orgId !== org._id) throw new AuthError("Medewerker niet gevonden");
    if (m.clerkUserId) throw new AuthError("Deze medewerker heeft al een account");
    return { clerkOrgId: org.clerkOrgId };
  },
});

export const registreerUitnodiging = internalMutation({
  args: { medewerkerId: v.id("medewerkers"), email: v.string(),
          rol: userRoleValidator, clerkInvitationId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.medewerkerId, {
      uitnodigingEmail: args.email.trim().toLowerCase(),
      uitnodigingRol: args.rol,
      uitnodigingStatus: "uitgenodigd",
      uitnodigingClerkId: args.clerkInvitationId,
    });
  },
});
```

Plus analoog: `trekUitnodigingIn` (action: `POST /organizations/{orgId}/invitations/{id}/revoke` + patch status/`uitnodigingEmail: undefined`), `trekToegangIn` (action: membership DELETE + `users.role` niet aanraken; medewerker `clerkUserId: undefined`). Rol wijzigen blijft via bestaande `users.updateUserRole`/`setClerkMetadata`.

Aanvullende eisen (uit review taak 2.3):
- `valideerUitnodiging` dwingt **uniciteit** af: weiger als er al een medewerker met een
  openstaande uitnodiging (`uitnodigingStatus: "uitgenodigd"`) op hetzelfde
  genormaliseerde adres bestaat, én als er al een users-rij met dat adres is die aan een
  andere medewerker gekoppeld is. (De upsert-koppeling gebruikt `.first()` — uniciteit
  wordt hiér bewaakt, niet daar.)
- De rolkeuzelijst in de uitnodigen-dialog bevat alleen uitnodigbare rollen: géén
  `klant` en géén legacy `admin`/`viewer`.
- Let op de upsert-guard: de uitnodigingsrol wordt alleen overgenomen als de user nog de
  default-rol `medewerker` heeft — het uitnodigen van een bestaand directie-account
  verlaagt diens rol dus niet (toon dat in de UI als hint bij zo'n adres).

- [ ] **Step 3:** Tests PASS. **Step 4:** Zet `CLERK_SECRET_KEY` in de dev-Convex-env: `npx convex env set CLERK_SECRET_KEY sk_test_…` (staat er waarschijnlijk al voor `deleteClerkUser` — verifieer met `npx convex env list`). **Step 5: Commit** — `git commit -m "feat(convex): team-functies met Clerk org-invitations"`

### Task 4.3: `/team`-pagina (redesign, vervangt /gebruikers + /medewerkers)

**Files:**
- Create: `src/app/(dashboard)/team/page.tsx`, `src/app/(dashboard)/team/components/team-tab.tsx`, `accounts-tab.tsx`, `uitnodigen-dialog.tsx`, `src/hooks/use-team.ts`
- Modify: `src/app/(dashboard)/medewerkers/page.tsx` en `src/app/(dashboard)/gebruikers/page.tsx` → `redirect("/team")` (Next `redirect` in een server component; verwijder de oude implementaties), `src/components/app-sidebar.tsx:105-111` (personeelMenuItems: "Medewerkers"+"Gebruikersbeheer" → één item "Team")
- Test: bestaande component-testpatronen; minimaal een render-test per tab

Richtlijnen (CLAUDE.md): `SectiePaneel` (geen `<Card>`), `ResponsiveTable`, geen horizontaal scrollen, >3 rijacties → dropdown, `EmptyState compact`, container-queries. Visuele taal = klantdossier v7.

- [ ] **Step 1: `use-team.ts`** — wrapt `api.team.listTeam`, `api.team.stuurUitnodiging`, `api.team.trekUitnodigingIn`, `api.team.trekToegangIn`, bestaande `api.medewerkers.*` CRUD en `api.users.listUsersWithDetails`/`updateUserRole`/`deleteUser`.
- [ ] **Step 2: Pagina-skelet** — `<RequireRole allowedRoles={["directie", "projectleider"]}>` om de pagina; binnen de pagina bepaalt `useIsAdmin()` of schrijfacties zichtbaar zijn (projectleider = alleen-lezen dossier). Stats-rij bovenaan (actief · met account · uitgenodigd). Twee tabs: **Team** en **Accounts** (Accounts alleen voor directie).
- [ ] **Step 3: Team-tab** — tabel: naam/functie (link naar detail-sheet met de bestaande medewerker-CRUD, verhuisd uit `/medewerkers`), contracttype, uurtarief, accountstatus-badge (`geen`=muted, `uitgenodigd`=amber + "opnieuw versturen"/"intrekken" in dropdown, `actief`=groen + rol-badge), rijacties in dropdown: Bewerken · Uitnodigen/Intrekken · Rol wijzigen · Toegang intrekken · Uit dienst. Statusfilter (actief / uit dienst / met account). De bestaande medewerker-detail-sheet en dialogen uit `/medewerkers` verhuizen naar `team/components/` — kopieer de bestanden, pas imports aan, verwijder de oude map pas in Step 5.
- [ ] **Step 4: Accounts-tab** — users zonder `linkedMedewerkerId` en zonder rol `klant` (= losse admins/testaccounts): e-mail, naam, rol-badge, acties Rol wijzigen · Verwijderen (bestaande `deleteUser`-flow). Uitleg-regel bovenaan: "Accounts zonder medewerkersdossier. Nieuwe collega's nodig je uit via de Team-tab."
- [ ] **Step 5: Uitnodigen-dialog** — velden: e-mail (verplicht, type email), app-rol (select met de veld/kantoor-rollen behalve `klant`), uitleg "De collega ontvangt een e-mail van Clerk en wordt na aanmelden automatisch gekoppeld." Bevestigen → `stuurUitnodiging`. Toon daarna de status in de tabel. Verwijder nu `src/app/(dashboard)/medewerkers/` (behalve de redirect-page) en `src/app/(dashboard)/gebruikers/` (idem), en de `/medewerkers/teams`-route → verhuist als sub-link onder Team (sidebar-item blijft werken).
- [ ] **Step 6:** `npm run typecheck && npm run lint && npm run test:run` → PASS. Browserpaneel-schouw: `/team` als directie (alle acties), `/gebruikers` en `/medewerkers` redirecten. Commit: `git commit -m "feat(web): /team vervangt gebruikers- en medewerkersscherm"`

### Task 4.4: Opruimfunctie — engine (`convex/opschonen.ts`)

**Files:**
- Create: `convex/opschonen.ts`
- Test: convex-test

- [ ] **Step 1: Failing tests** — (a) `preview` telt per categorie de te wissen rijen van de eigen org (en telt kind-rijen mee); (b) `start` weigert zonder `bevestiging: "OPSCHONEN"`; (c) `start` + batchloop wist alle wissen-tabellen van de org maar laat bewaren-tabellen en andere orgs intact; (d) referentie-schoonmaak: lead met `offerteId`-verwijzing houdt zijn rij maar het verwijsveld is leeg; (e) niet-directie → AuthError.
- [ ] **Step 2: Implementeer** — kern:

```ts
// convex/opschonen.ts — Gevarenzone: wist alle transactiedata van de eigen org.
// Classificatie komt uit convex/lib/orgTabellen.ts (spec §7, bindend).
import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { TableNames } from "./_generated/dataModel";
import { requireOrgId, AuthError } from "./auth";
import { requireAdmin } from "./roles";
import { TABEL_CLASSIFICATIE, KIND_VAN } from "./lib/orgTabellen";

const BATCH = 200;

// Org-gescopede wissen-tabellen (kindtabellen gaan via hun ouder mee).
const WIS_TABELLEN = (Object.entries(TABEL_CLASSIFICATIE) as [TableNames, string][])
  .filter(([t, c]) => c === "wissen" && !(t in KIND_VAN) && t !== "notification_log" && t !== "demoSeed")
  .map(([t]) => t);
// notification_log & demoSeed: geen orgId → aparte full-scan-stap in de loop,
// gefilterd op niets (single-org install) — gedocumenteerd in de UI-preview.

export const preview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orgId = await requireOrgId(ctx);
    const telling: Record<string, number> = {};
    for (const tabel of WIS_TABELLEN) {
      const rijen = await ctx.db.query(tabel)
        .withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
      telling[tabel] = rijen.length;
      const kinderen = Object.entries(KIND_VAN).filter(([, d]) => d.ouder === tabel);
      for (const [kindTabel, def] of kinderen) {
        if (TABEL_CLASSIFICATIE[kindTabel as TableNames] !== "wissen") continue;
        let n = 0;
        for (const ouder of rijen) {
          n += (await ctx.db.query(kindTabel as TableNames)
            .withIndex(def.index, (q) => q.eq(def.veld, ouder._id)).collect()).length;
        }
        telling[kindTabel] = n;
      }
    }
    return telling;
  },
});

export const start = mutation({
  args: { bevestiging: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const orgId = await requireOrgId(ctx);
    if (args.bevestiging !== "OPSCHONEN") {
      throw new AuthError('Typ letterlijk "OPSCHONEN" om te bevestigen');
    }
    await ctx.scheduler.runAfter(0, internal.opschonen.verwerkBatch, {
      orgId, tabelIndex: 0,
    });
    return { gestart: true };
  },
});

export const verwerkBatch = internalMutation({
  args: { orgId: v.id("organisaties"), tabelIndex: v.number() },
  handler: async (ctx, args) => {
    if (args.tabelIndex >= WIS_TABELLEN.length) {
      await ctx.scheduler.runAfter(0, internal.opschonen.maakReferentiesSchoon, { orgId: args.orgId });
      return;
    }
    const tabel = WIS_TABELLEN[args.tabelIndex];
    const batch = await ctx.db.query(tabel)
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId)).take(BATCH);
    for (const doc of batch) {
      // kinderen eerst
      for (const [kindTabel, def] of Object.entries(KIND_VAN)) {
        if (def.ouder !== tabel) continue;
        if (TABEL_CLASSIFICATIE[kindTabel as TableNames] !== "wissen") continue;
        const kinderen = await ctx.db.query(kindTabel as TableNames)
          .withIndex(def.index, (q) => q.eq(def.veld, doc._id)).collect();
        for (const kind of kinderen) await ctx.db.delete(kind._id);
      }
      await ctx.db.delete(doc._id);
    }
    const klaarMetTabel = batch.length < BATCH;
    await ctx.scheduler.runAfter(0, internal.opschonen.verwerkBatch, {
      orgId: args.orgId,
      tabelIndex: klaarMetTabel ? args.tabelIndex + 1 : args.tabelIndex,
    });
  },
});

// Bewaarde rijen die naar gewiste rijen wijzen: verwijsvelden leegmaken.
// Concreet (verifieer veldnamen in schema.ts): configuratorAanvragen.offerteId?,
// klanten.laatsteOfferte*/laatsteProject*-velden, medewerkers.huidigProjectId?.
export const maakReferentiesSchoon = internalMutation({ /* per bewaartabel de
  verwijsvelden naar wissen-tabellen patchen naar undefined; daarna een
  notifications-vrije logregel in de Convex-logs + klaar-status schrijven op
  organisaties (bijv. laatsteOpschoning: Date.now()). */ });
```

Voor de voortgang: `preview` opnieuw pollen in de UI (aantallen lopen naar 0) — geen aparte status-tabel nodig (YAGNI).

- [ ] **Step 3:** Tests PASS (`preview`-test dekt ook dat `WIS_TABELLEN` + kinderen + de twee full-scan-tabellen samen exact de wislijst van spec §7 vormen — vergelijk als set in de test). **Step 4: Commit** — `git commit -m "feat(convex): opschoon-engine (batch, cascade, referentie-schoonmaak)"`

### Task 4.5: Opruimfunctie — UI in Instellingen

**Files:**
- Create: `src/app/(dashboard)/instellingen/components/gevarenzone.tsx`
- Modify: `src/app/(dashboard)/instellingen/page.tsx` (onderaan, bij de bestaande sub-pagina-links op :262-279)

- [ ] **Step 1:** Onderaan de pagina, alleen voor `useIsAdmin()`: een kleine, muted tekstlink "Geavanceerd beheer". Klik → toont de `Gevarenzone`-sectie (collapsible, geen tab — bewust weggestopt).
- [ ] **Step 2: Gevarenzone-component** — rood omlijnd `SectiePaneel` "Gevarenzone": uitleg wat bewaard blijft (leads, klanten, leveranciers, instellingen, catalogus, personeel, middelen) en wat verdwijnt; knop "Werkdata opschonen…" → dialog: preview-tabel (categorieën + aantallen uit `api.opschonen.preview`), input met placeholder `Typ OPSCHONEN om te bevestigen`, destructieve knop pas enabled bij exacte match; na start: voortgang door `preview` te blijven pollen tot alles 0 is, dan succes-toast.
- [ ] **Step 3:** Browserpaneel-schouw (dev): seed demo-data (`npm run seed:demo`), draai de opruimfunctie, verifieer dat klanten/leads/leveranciers/config blijven en de rest 0 is. `npm run typecheck && npm run lint` → PASS.
- [ ] **Step 4: Commit** — `git commit -m "feat(web): gevarenzone met opruimfunctie in instellingen"`

---

## Fase 5 — Mobile

### Task 5.1: Actieve org + no-access in de Expo-app

**Files:**
- Modify: `mobile/hooks/use-auth.ts` (orgId/orgRole worden al geëxposeerd op regels 30/81/167/184 — nu ook gebruiken), app-root-layout in `mobile/app/`
- Create: no-access-screen conform mobile-theme (NativeWind, primair `#4ADE80`)

- [ ] **Step 1:** Zelfde gate-logica als web: na login → als geen actief org maar wel lidmaatschap: `setActive`; geen lidmaatschap → no-access-screen met uitlogknop. Clerk Expo: `useOrganizationList` uit `@clerk/clerk-expo`.
- [ ] **Step 2:** Doorloop `mobile/` op directe `userId`-aannames: `grep -rn "companyUserId\|getCompanyUserId" mobile/` → verwacht 0 hits (mobile praat via convex-functies; die zijn al om).
- [ ] **Step 3:** `cd mobile && npx tsc --noEmit` (of het bestaande typecheck-script) → PASS. Commit: `git commit -m "feat(mobile): actieve organisatie + no-access-screen"`

---

## Fase 6 — Dev-migratie + schema-finalisatie

### Task 6.1: Migratiefunctie (gedeeld dev/prod)

**Files:**
- Create: `convex/migrations/naarOrganisaties.ts`
- Test: convex-test

- [ ] **Step 1: Failing tests** — met fixture-data over twee "users" (eigenaar + andere): na de migratie (a) hebben alle bewaren-rijen van de eigenaar `orgId`; (b) zijn bewaren-rijen van de andere user verwijderd; (c) zijn alle wissen-tabellen leeg; (d) hebben alle leads `orgId` (ook zonder eerdere eigenaar); (e) verifieer-query rapporteert gelijke aantallen klanten/leveranciers/leads t.o.v. de voor-telling.
- [ ] **Step 2: Implementeer** — patroon van `demoSeed.ts` (`bepaalDeployment`/`bewaakDeployment` hergebruiken of kopiëren, mét beide slugs toegestaan want dit draait ook op prod):

```ts
// convex/migrations/naarOrganisaties.ts
// Eenmalige migratie naar het org-model. Idempotent. Draait op dev én prod;
// vereist expliciete bevestiging van de deployment-slug + eigenaar-e-mail.
export const voorTelling = internalQuery({ /* {klanten, leveranciers, leads: aantallen} */ });

export const migreer = internalMutation({
  args: {
    bevestigDeployment: v.string(),   // "affable-rook-669" | "impartial-dinosaur-829"
    clerkOrgId: v.string(),           // uit clerk-org-setup.mjs
    eigenaarEmail: v.string(),        // "ricardobos43@gmail.com"
  },
  handler: async (ctx, args) => {
    bewaakDeployment(args.bevestigDeployment);
    // 1. Org aanmaken (idempotent; seedOrgDefaults slaat over omdat de
    //    eigenaar al instellingen heeft — die verhuizen in stap 3 mee).
    // 2. Eigenaar vinden: users.by_email op genormaliseerde eigenaarEmail;
    //    .unique() — bij meerdere rijen: hard falen met duidelijke melding.
    // 3. Voor elke bewaren-tabel met orgId-veld: rijen van eigenaar → patch {orgId};
    //    rijen van andere users → delete (kinderen eerst via KIND_VAN).
    //    Batching: zelfde scheduler-loop-patroon als opschonen.verwerkBatch.
    // 4. configuratorAanvragen (geen eigenaar): ALLE rijen → patch {orgId}.
    //    Overige orgId-loze bewaren-tabellen (bouwstenen, tekstblokken,
    //    mailTriggers, uurtarieven): idem, alle rijen naar de org.
    // 5. Systeemdefaults (userId undefined bij correctiefactoren/standaard-
    //    tuinen/plantsoorten): laten staan, GEEN orgId (blijven systeembreed).
    // 6. Alle wissen-tabellen: full-table delete in batches (óók rijen zonder
    //    userId — de optionele-veld-gaten uit de audit verdwijnen hiermee).
  },
});

export const verifieerMigratie = internalQuery({ /* naTelling + telt bewaren-
  rijen zonder orgId (moet 0 zijn, systeemdefaults uitgezonderd) */ });
```

- [ ] **Step 3:** Tests PASS. Commit: `git commit -m "feat(migratie): naarOrganisaties (gedeeld dev/prod)"`

### Task 6.2: Dev-migratie draaien + schema-finalisatie

**Files:**
- Modify: `convex/schema.ts`, `convex/auth.ts`, restanten

- [ ] **Step 1:** Tag het huidige commit — dit is de deploy-basis voor prod-Fase-A: `git tag fase-a`
- [ ] **Step 2:** Draai op dev: `npx convex run migrations/naarOrganisaties:voorTelling` (noteer), dan `npx convex run migrations/naarOrganisaties:migreer '{"bevestigDeployment":"affable-rook-669","clerkOrgId":"<org_… uit Task 0.2>","eigenaarEmail":"ricardobos43@gmail.com"}'`, dan `…:verifieerMigratie` — Expected: gelijke tellingen, 0 bewaren-rijen zonder orgId.
- [ ] **Step 3: Schema-finalisatie:** verwijder op alle tenant-tabellen het `userId`-veld + alle `by_user*`-indexes (persoonlijke tabellen behouden userId!), verwijder óók alle `userId: …`-schrijfplekken op tenant-tabellen in convex/ (grep-gate: geen insert/patch op een tenant-tabel zet nog userId), maak `orgId` verplicht (`v.optional` eraf; behalve systeemdefault-tabellen — daar blijft `v.optional` met betekenis "null = systeem"), search-indexes `filterFields: ["orgId"]`, verwijder `team_messages.companyId`/`chat_threads.companyUserId`.
- [ ] **Step 4:** Verwijder `verifyOwnership` (oude), en de scoping-rol van `requireAuthUserId` (blijft alleen waar persoonlijke tabellen hem nodig hebben). `getOwnedOfferte`/`getOwnedKlant` gaan naar `verifyOrgOwnership`.
- [ ] **Step 5:** Poort: `npm run typecheck && npm run lint && npm run test:run` → PASS. `npx convex dev --once` → schema-push OK (faalt er een rij op het verplichte veld, dan is de migratie niet compleet — terug naar Step 2).
- [ ] **Step 6:** `npm run seed:demo && npm run seed:clear` → werkt op org-model. Commit: `git commit -m "refactor(schema): userId-tenant-velden verwijderd, orgId verplicht"`

---

## Fase 7 — Tests & E2E

### Task 7.1: Volledige groene poort + E2E

- [ ] **Step 1:** `npm run typecheck && npm run lint && npm run test:run` → alles PASS (~3000 tests; fixtures op org-model).
- [ ] **Step 2:** `npx playwright test configurator` → PASS (auth-E2E is pre-existing stuk; niet in scope).
- [ ] **Step 3:** Browserpaneel-doorloop (dev): login directie → dashboard/klanten/leads/offertes zichtbaar; `/team` volledig; instellingen-gevarenzone; tweede account zonder membership → geen-toegang-pagina.
- [ ] **Step 4:** Grep-eindpoort: `grep -rn "getCompanyUserId\|companyUserId" convex/ src/ | grep -v _generated` → 0 hits. Commit: `git commit -m "test: groene poort org-migratie"`

---

## Fase 8 — Production (ALLEEN met expliciete go van Ricardo per step)

### Task 8.1: Clerk prod + deploy Fase A + migratie + deploy Fase B

- [ ] **Step 1 (Ricardo bevestigt Task 0.1 Step 3 gedaan):** Organizations + JWT-claims staan aan op de prod-instance.
- [ ] **Step 2:** `CLERK_SECRET_KEY=sk_live_… node scripts/clerk-org-setup.mjs --prod` → noteer prod-`org_…`-id. Verifieer output: ricardobos43 admin/directie, riboebusiness member/medewerker, rest admin/directie, klant-accounts geskipt.
- [ ] **Step 3 — Deploy Fase A:** `git checkout fase-a && npx convex deploy --yes` (alleen Convex; de Vercel-app blijft op de oude build — kort venster waarin prod-web nog `by_user` leest, dat is de oude code op oude data: consistent).
- [ ] **Step 4 — Migratie:** voorTelling → `npx convex run migrations/naarOrganisaties:migreer '{"bevestigDeployment":"impartial-dinosaur-829","clerkOrgId":"<prod org-id>","eigenaarEmail":"ricardobos43@gmail.com"}' --prod` → verifieerMigratie: tellingen gelijk, 0 zonder orgId.
- [ ] **Step 5 — Deploy Fase B:** `git checkout main && npx convex deploy --yes` + Vercel-productie-deploy van de web-app.
- [ ] **Step 6 — Rooktest:** inloggen als ricardobos43 (directie: dashboard, klanten, leads, leveranciers, /team, gevarenzone-preview) én riboebusiness (medewerker-zicht). Mobile: inloggen + data zichtbaar.
- [ ] **Step 7:** `git tag org-migratie-live && git push` alleen op expliciet verzoek (CLAUDE.md regel 8).

---

## Whitelabel-vervolg (buiten deze migratie)

- `organisaties.updateOrganisatie` (naam/slug/branding wijzigen) bestaat bewust nog
  niet — `maakOrganisatie` is een pure aanmaakfunctie. Toevoegen zodra het eerste
  whitelabel-traject start.

## Zelf-reviewnotities (al verwerkt)

- Kindtabel-indexnamen in `KIND_VAN` zijn aannames — Task 1.1 Step 3/4 dwingt verificatie tegen `schema.ts` af vóór er iets op draait.
- `weekPlanning` heeft mogelijk geen `by_project`-index (report: index op medewerkerId+projectId) — de orgTabellen-test vangt dit; kies dan de bestaande index en pas `veld` aan.
- `notification_log` en `demoSeed` hebben geen orgId; opschonen en migratie wissen ze full-table (single-org install; gedocumenteerd in preview-UI en migratiecomment).
- Rollen-gate: `requireAdmin` (roles.ts) accepteert directie/admin — gebruikt door team- en opschoonfuncties; projectleider-leestoegang op `listTeam` bewust via `requireOrgId` zonder admin-check.
