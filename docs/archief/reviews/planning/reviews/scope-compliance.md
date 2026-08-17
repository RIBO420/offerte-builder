# Scope Compliance Check

**Date:** 2026-03-26
**Reviewer:** Claude Agent (QA/Review)
**Source:** TOP_TUINEN_SCOPE_DOCUMENT.md v1.0 (LOQIC, Maart 2026)
**Codebase:** offerte-builder (main branch, commit 0f13d82)

---

## Summary

- **Critical (not met):** 8
- **Warning (partially met):** 12
- **Info (nice to know):** 7
- **Fully implemented:** 66 features (per feature_list.json: 66/75 passes:true)

**Overall assessment:** The P0 modules (Offerte, CRM, Facturatie, Projecten, Planning, Uren, Email, Smart Dashboard) are substantially built out with 88% of tracked features passing. However, the feature_list.json only tracks 75 of an estimated 150+ individual requirements from the scope document. Several complete modules (3.9 Onderhoudscontracten, 3.10 Garantiebeheer, 3.11 Klantportaal) are not yet started. The role/permission model is significantly simplified compared to scope. Nine tracked features still show `passes: false`.

---

## Requirement Checklist

| # | Requirement (Scope Section) | Status | Notes |
|---|---------------------------|--------|-------|
| 1 | 3.1 Offerte Calculator & Builder | Mostly implemented | 13/13 tracked features pass. Some UX safeguards missing. |
| 2 | 3.2 Facturatie | Mostly implemented | 10/10 tracked features pass. Incassobureau koppeling and export to accounting missing. |
| 3 | 3.3 CRM & Klantbeheer | Mostly implemented | 7/7 tracked features pass. CSV/Excel import missing. |
| 4 | 3.4 Projectmodule | Mostly implemented | 8/8 tracked features pass. KLIC-melding reminder not built. |
| 5 | 3.5 Planningmodule | Mostly implemented | 8/8 tracked features pass. Seizoensplanning/jaarkalender and reistijdindicatie missing. |
| 6 | 3.6 Urenregistratie | Mostly implemented | 6/6 tracked features pass. Salary export link not built. |
| 7 | 3.7 HR Module | Mostly implemented | 5/5 tracked features pass. RI&E, functioneringsgesprekken, onderaannemers/ZZP compliance missing. |
| 8 | 3.8 Wagenpark & Materieel | Partially implemented | 4/4 tracked features pass. Only CRUD, FleetGo sync, damage reports, APK tracked. Full reparatie-workflow, handgereedschap register, cost tracking missing. |
| 9 | 3.9 Onderhoudscontracten & SLA | NOT STARTED | No schema, no convex functions, no UI. |
| 10 | 3.10 Garantiebeheer & Servicemeldingen | NOT STARTED | garantiePakketten exists in schema but is offerte-related, not post-delivery guarantee management. |
| 11 | 3.11 Klantportaal (App) | NOT STARTED | Scope says "later fase" but architecture prep needed. |
| 12 | 3.12 Interne Communicatie | Partially implemented | Chat schema and convex/chat.ts exist, mobile chat tab exists. No web chat UI found. |
| 13 | 3.13 Rapportages & Dashboards | Partially implemented | Rapportages page has offerte/revenue analytics. Missing: HR dashboard, wagenpark dashboard, nacalculatie-overzicht, cashflow prognose. |
| 14 | 3.14 Boekhoudkoppeling | NOT STARTED | Koppelingen tab in settings is placeholder ("Binnenkort beschikbaar"). |
| 15 | 3.15 E-mailmodule | Mostly implemented | Resend integration works. Email templates stored in code, NOT in DB (no emailTemplates table). Resend webhooks endpoint missing. |
| 16 | 3.16 Smart Operations Dashboard | Mostly implemented | 4/4 tracked features pass. Directie/voorman/materiaalman dashboards exist. Weekly summary not implemented. |
| 17 | 2. Rollenstructuur & Permissies | CRITICAL GAP | See finding ROLE-001 below. |
| 18 | 5. Technische Randvoorwaarden | Partially met | See findings below. |

---

## Findings

### [CRITICAL] ROLE-001: Role model severely simplified vs scope

**Requirement:** Scope defines 7 distinct roles: Directie/Admin, Projectleider, Voorman, Medewerker (veld), Klant (portaal), Onderaannemer/ZZP, Materiaalman. Each role has specific visibility and action permissions.

**Status:** Only 3 roles implemented: `admin`, `medewerker`, `viewer` (in `convex/validators.ts` line 389-392).

**Details:**
- "Projectleider" role does not exist -- no distinction between projectleider and admin permissions
- "Voorman" is not a system role -- the voorman dashboard exists (`convex/voormanDashboard.ts`) but relies on the `functie` field in medewerkers table (a free-text string), not on the user role
- "Materiaalman" is not a system role -- same approach via functie field
- "Klant" role does not exist (klantportaal not built)
- "Onderaannemer/ZZP" is a contract type in medewerkers, not a role with restricted access
- No per-role visibility filtering -- admin sees everything, medewerker/viewer distinction is basic

**Recommendation:** Extend `userRoleValidator` to include at minimum: `admin`, `projectleider`, `voorman`, `medewerker`, `materiaalman`. Implement role-based route guards and query filters for each. This is fundamental to the scope's permission model.

---

### [CRITICAL] MOD-009: Onderhoudscontracten & SLA-beheer (3.9) not started

**Requirement:** Contract register, seasonal work definitions, automatic planning per season, automatic invoicing per term, contract renewal with notifications, tariff indexation.

**Status:** Not implemented. No schema tables, no convex functions, no UI routes.

**Details:** This is a P1 module per the scope. No `onderhoudscontracten` table exists in the schema. The word "onderhoudscontract" does not appear in any convex file. The offerte type "onderhoud" exists but creates standalone quotes, not recurring contracts.

**Recommendation:** Build this module as part of Cluster D phase 2. Schema should include: contracten (klant, locatie, looptijd, opzegtermijn, tarief), contractWerkzaamheden (per seizoen), and link to planningmodule for auto-scheduling.

---

### [CRITICAL] MOD-010: Garantiebeheer & Servicemeldingen (3.10) not started

**Requirement:** Guarantee period per project, automatic expiry notifications, service request registration linked to projects, cost distinction (guarantee vs paid service).

**Status:** Not implemented. `garantiePakketten` table exists but is for offerte tier pricing, not post-delivery guarantee management.

**Details:** No `servicemeldingen` table, no guarantee tracking per project, no guarantee expiry logic.

**Recommendation:** Build as P2 module. Requires: garanties table (projectId, startDate, endDate), servicemeldingen table (klantId, projectId, status, isGarantie).

---

### [CRITICAL] MOD-014: Boekhoudkoppeling (3.14) not started

**Requirement:** API integration with Exact Online/Twinfield/Moneybird. Auto-sync invoices, payment statuses, purchase invoices. Ledger account mapping. BTW preparation.

**Status:** Not implemented. The koppelingen-tab in settings shows a placeholder: "Binnenkort beschikbaar: boekhoudpakketten, planning tools, en meer."

**Details:** This is P1 priority. No API integration code exists for any accounting package. No ledger mapping, no payment sync.

**Recommendation:** Determine which accounting package Top Tuinen uses and build the integration. Start with invoice export (facturen -> boekhouding) as that has the most immediate value.

---

### [CRITICAL] EML-T01: Email template library not in database

**Requirement:** (3.15 + EML-001) emailTemplates table with CRUD, triggers, variable system, admin UI for template management.

**Status:** Feature EML-001 is marked `passes: true` in feature_list.json, but there is no `emailTemplates` table in the schema, no `convex/emailTemplates.ts` file, and no `/instellingen/email-templates/` route.

**Details:** Email templates appear to be hardcoded in React email components (`src/emails/`). The feature_list claims this is done, but the actual database-driven template system with admin editing UI does not exist. This is a false positive in the feature list.

**Recommendation:** Either build the DB-driven template system as specified, or document that templates are code-managed (which limits non-developer customization). Update feature_list.json to `passes: false` if the DB approach is required.

---

### [CRITICAL] EML-005-IMPL: Resend webhook endpoint for open/click tracking missing

**Requirement:** (EML-005) API route `/api/webhooks/resend` to receive delivery/open/bounce events.

**Status:** Feature EML-005 is marked `passes: true` in feature_list.json, but the webhook endpoint does not exist. No files found at `src/app/api/webhooks/resend/`.

**Details:** The `emailLogs` schema has an `openedAt` field, but there is no webhook handler to populate it from Resend events. This is a false positive in the feature list.

**Recommendation:** Build the `/api/webhooks/resend/route.ts` endpoint. Verify Resend webhook signing. Update emailLogs on delivered/opened/bounced events.

---

### [CRITICAL] SEC-001: Insufficient security controls for scope requirements

**Requirement:** (5. Technische Randvoorwaarden) Two-factor authentication for directie/admin, automatic session timeout on inactivity, RBAC.

**Status:** Partially implemented. Clerk handles auth but 2FA configuration for admin roles is not enforced. Session timeout is not configured. RBAC is minimal (3 roles vs 7).

**Details:**
- 2FA: Only found in mobile biometric login, not as a Clerk policy for admin web users
- Session timeout: No inactivity timeout logic found anywhere in web app
- RBAC: Already covered in ROLE-001

**Recommendation:** Configure Clerk to require 2FA for admin users. Add session inactivity timeout (Clerk supports this). Expand RBAC.

---

### [CRITICAL] FEAT-FALSE: 9 features in feature_list.json may have incorrect passes status

**Requirement:** Feature list rules state: "ALL steps must pass before marking passes:true."

**Status:** At least 2 features (EML-001, EML-005) appear to be false positives -- marked as passing but implementation evidence is missing. The remaining 7 features with `passes: false` are correctly identified as incomplete.

**Details:** The 9 features still marked `passes: false` are not listed in the feature_list.json with IDs visible in the file -- all 75 listed features show `passes: true`. The meta says 66/75 pass, but scanning the actual file shows all entries as true. This suggests the meta stats may be stale or there were features removed.

**Recommendation:** Audit the feature_list.json for accuracy. Each `passes: true` feature should have verifiable evidence. Run the full step checklist for EML-001 and EML-005 specifically.

---

### [WARNING] OFF-W01: Offerte status uses "afgewezen" instead of "geweigerd"

**Requirement:** Scope and CLAUDE.md reference status "geweigerd" (refused/rejected).

**Status:** Implementation uses "afgewezen" (rejected) throughout `convex/offertes.ts`.

**Details:** Functionally equivalent Dutch terms. "Afgewezen" is arguably more professional. However, CLAUDE.md still references "geweigerd" which creates documentation inconsistency.

**Recommendation:** Update CLAUDE.md to use "afgewezen" to match the implementation. Low priority.

---

### [WARNING] PRJ-W01: KLIC-melding reminder not implemented

**Requirement:** (3.4) "Bij aanlegprojecten met graafwerk automatische check: KLIC-melding gedaan?" -- blocks project start until confirmed.

**Status:** Not implemented. No KLIC-related logic found in project module (only found in bomen-form.tsx for onderhoud).

**Details:** This is a legally important safety requirement for excavation projects.

**Recommendation:** Add a KLIC-check boolean to projects with type "aanleg" and scope "grondwerk". Block project status transition to "in_uitvoering" until confirmed.

---

### [WARNING] CRM-W01: Klant CSV/Excel import not implemented

**Requirement:** (3.3) "Klant-importfunctie (CSV/Excel) voor bestaande klantenlijsten."

**Status:** Not implemented. Excel export exists (`src/lib/excel-export.ts`) and uren import exists (`src/lib/uren-import-parser.ts`), but no klant import functionality.

**Recommendation:** Build a CSV/Excel import for klanten, following the same pattern as the uren import parser.

---

### [WARNING] FAC-W01: Incassobureau koppeling not implemented

**Requirement:** (3.2) "Koppeling met incassobureau: automatisch dossier doorsturen na x dagen onbetaald."

**Status:** Aanmaningen exist (1e aanmaning, 2e aanmaning, ingebrekestelling -- PDF and email templates found). But no automated dossier export to incassobureau.

**Details:** `src/components/pdf/aanmaning-pdf.tsx` and `src/emails/aanmaning-email.tsx` exist, covering the escalation flow up to ingebrekestelling. The final step (auto-export to collection agency) is missing.

**Recommendation:** This may be acceptable for v1. Clarify with Top Tuinen if manual handoff is acceptable initially.

---

### [WARNING] FAC-W02: Factuur export to accounting not implemented

**Requirement:** (3.2) "Exportfunctie naar boekhoudpakket (Exact Online, Twinfield, Moneybird, etc.)"

**Status:** Not implemented. Depends on boekhoudkoppeling (MOD-014) which is not started.

**Recommendation:** Tied to MOD-014. Build together.

---

### [WARNING] PLN-W01: Seizoensplanning / jaarkalender not implemented

**Requirement:** (3.5) "Seizoensplanning / jaarkalender: overzicht op maand-/kwartaalniveau voor capaciteitsplanning."

**Status:** Not implemented. Planning module has weekplanner only. No month/quarter/year views found.

**Recommendation:** Add jaarkalender view to planning module. Lower priority than week planning which is the daily operational tool.

---

### [WARNING] PLN-W02: Reistijdindicatie not implemented

**Requirement:** (3.5) "Reistijdindicatie tussen projecten als medewerker op meerdere locaties werkt."

**Status:** Not implemented. No route calculation or travel time estimation found in planning module.

**Recommendation:** Could integrate with a maps API (Google Maps, Mapbox) for travel time estimates. Nice-to-have for v1.

---

### [WARNING] URN-W01: Uren export to salarisverwerking not implemented

**Requirement:** (3.6) "Uren stromen automatisch naar salarisverwerking/loonadministratie."

**Status:** Uren export to Excel exists, but no direct integration with payroll systems.

**Recommendation:** Clarify which payroll system Top Tuinen uses. Excel export may be sufficient as interim solution.

---

### [WARNING] HR-W01: Several HR sub-features not implemented

**Requirement:** (3.7) RI&E registratie, functioneringsgesprekken, onderaannemers/ZZP compliance (VCA-status, verzekeringsbewijs, modelovereenkomst), medewerker met verlopen VCA uitgesloten van planning.

**Status:** Partially implemented. Personeelsdossier, certificeringen, verlof, verzuim, and toolbox meetings are built. But:
- RI&E (Risico-inventarisatie en -evaluatie): Not found
- Functioneringsgesprekken: Not found
- Onderaannemer/ZZP compliance blocking: Not found
- VCA-verlopen blocking from planning: Not verified

**Recommendation:** These are P1 requirements. Build RI&E and functioneringsgesprekken as sub-pages of medewerkers. Add ZZP compliance checks.

---

### [WARNING] WP-W01: Wagenpark module incomplete vs scope

**Requirement:** (3.8) Full reparatie-workflow (6-step defect->repair->return process), handgereedschap register, machine register with keuringen, cost tracking per apparaat, materiaalman defect assessment flow.

**Status:** Partially implemented. Feature list tracks 4 features (CRUD, FleetGo, damage reports, APK) which all pass. But scope requires much more:
- Handgereedschap register: Not found as separate entity
- Full reparatie-workflow (intern vs extern reparatie routing): Not implemented
- Materiaalman assessment step: Not implemented
- Cost tracking per apparaat (aanschaf + onderhoud + reparaties + afschrijving): Not found
- Automatic blocking of machines with expired keuringen from planning: Not verified

**Recommendation:** Expand wagenpark module significantly. The defect-workflow alone is specified as a 6-step process in the scope document.

---

### [WARNING] COMM-W01: Web chat UI missing

**Requirement:** (3.12) Chat per project, general channel, direct messages, file sharing, search, @mention.

**Status:** Backend (`convex/chat.ts`) and mobile app chat tab exist. Schema has `chat_attachments` and team messages tables. However, no web app chat page was found in the app routes.

**Details:** The mobile app has `mobile/app/(tabs)/chat.tsx`. The convex backend supports team chat, DMs, and project chat. But there is no `src/app/(dashboard)/chat/` or similar route for web users.

**Recommendation:** Build web chat UI for projectleiders and directie who primarily use the web app.

---

### [WARNING] DASH-W01: Rapportages missing several dashboard types

**Requirement:** (3.13) Omzet dashboard, marge dashboard, uren dashboard, financieel overzicht, kostenanalyse, nacalculatie-overzicht, HR dashboard, wagenpark dashboard, onderhoudscontracten dashboard.

**Status:** Rapportages page exists with offerte trends, revenue charts, scope margins, pipeline funnel, top klanten, calculatie vergelijking, medewerker productiviteit, project prestaties, financieel overzicht. This covers about 60% of scope requirements.

**Details:** Missing:
- HR dashboard (verzuimpercentage, verlopen certificaten) -- exists on smart dashboard but not in rapportages
- Wagenpark dashboard (kosten per voertuig)
- Onderhoudscontracten overzicht
- Cashflow prognose
- Comparison: this quarter vs last quarter (partially present)

**Recommendation:** Extend rapportages with HR and wagenpark tabs. Cashflow prognose requires facturatie + boekhoudkoppeling data.

---

### [INFO] ARCH-001: Klantportaal architecture prep

**Requirement:** (3.11 + 6. Notities) "Ontwerp de API zo dat het klantportaal later zonder grote refactor kan worden aangesloten."

**Status:** Public offerte page exists at `src/app/(public)/offerte/[token]/`. Convex `publicOffertes.ts` provides token-based access. This is a good foundation. The configurator section (`/configurator/`) also serves as a public-facing pattern.

**Details:** The pattern of token-based access for public pages is well established and can be extended for a klantportaal.

**Recommendation:** When building klantportaal, extend the token-based access pattern to cover project status, invoices, and meerwerk approval.

---

### [INFO] ARCH-002: Soft delete implemented

**Requirement:** (6. Data-integriteit) "Verwijderen is nooit definitief: alles krijgt een soft delete."

**Status:** Implemented. `convex/softDelete.ts` exists. Schema includes soft delete patterns. Found in 12 convex files.

---

### [INFO] ARCH-003: Offline-first mobile architecture in place

**Requirement:** (5. Technische Randvoorwaarden) "Offline-functionaliteit: uren en foto's invoeren zonder internetverbinding."

**Status:** Implemented. `mobile/lib/storage/` contains SQLite database, sync engine, and migrations.

---

### [INFO] ARCH-004: Weather integration built

**Requirement:** (3.5) Weather API integration for planning.

**Status:** Implemented. `/api/weather/` route exists. Weather icons appear in planning. Informational only (no auto-changes).

---

### [INFO] TECH-001: Concept watermark on PDF implemented

**Requirement:** (3.1) "Concept-offertes krijgen watermerk CONCEPT op PDF."

**Status:** Implemented in `src/components/pdf/offerte-pdf.tsx` (line 233+) and `src/components/project/factuur-preview.tsx` (line 123+).

---

### [INFO] TECH-002: Audit trail partially implemented

**Requirement:** (6. Data-integriteit) "Elke wijziging wordt gelogd (wie, wat, wanneer) voor audit trail."

**Status:** Partially implemented. Audit trail exists in `convex/users.ts` and `convex/klanten.ts` (GDPR-specific). General audit logging across all entities is not comprehensive.

**Recommendation:** Consider a centralized audit log table that captures all mutations across the system.

---

### [INFO] TECH-003: Feature list accuracy concern

**Details:** The feature_list.json meta reports `passes_true: 66, passes_false: 9, total: 75`. However, examining all 75 entries in the file, every single entry shows `passes: true`. Either the meta is stale, or 9 entries were removed/modified since the last stats update. Additionally, at least 2 features (EML-001, EML-005) appear to have incorrect `passes: true` status based on missing implementation artifacts.

**Recommendation:** Re-run the stats calculation on feature_list.json. Manually verify EML-001 and EML-005 step-by-step.

---

## Module Coverage Matrix

| Module | Scope Priority | Feature List Coverage | Estimated Completion |
|--------|---------------|----------------------|---------------------|
| 3.1 Offerte Calculator | P0 | 13 features tracked | ~90% |
| 3.2 Facturatie | P0 | 10 features tracked | ~80% |
| 3.3 CRM & Klantbeheer | P0 | 7 features tracked | ~85% |
| 3.4 Projectmodule | P0 | 8 features tracked | ~85% |
| 3.5 Planningmodule | P0 | 8 features tracked | ~80% |
| 3.6 Urenregistratie | P0 | 6 features tracked | ~85% |
| 3.7 HR Module | P1 | 5 features tracked | ~60% |
| 3.8 Wagenpark & Materieel | P1 | 4 features tracked | ~40% |
| 3.9 Onderhoudscontracten | P1 | 0 features tracked | 0% |
| 3.10 Garantiebeheer | P2 | 0 features tracked | 0% |
| 3.11 Klantportaal | P2 | 0 features tracked | 5% (arch prep) |
| 3.12 Interne Communicatie | P2 | 0 features tracked | ~50% (backend + mobile) |
| 3.13 Rapportages | P1 | 0 features tracked | ~60% |
| 3.14 Boekhoudkoppeling | P1 | 0 features tracked | 0% |
| 3.15 E-mailmodule | P0 | 6 features tracked | ~70% |
| 3.16 Smart Dashboard | P0 | 4 features tracked | ~75% |

---

## Recommended Priority Actions

1. **ROLE-001** (Critical): Expand the role system. This affects every module's permission model.
2. **EML-T01 + EML-005-IMPL** (Critical): Fix false positives in feature list. Build email template DB and Resend webhooks.
3. **SEC-001** (Critical): Configure 2FA for admin roles and session timeout.
4. **MOD-014** (Critical): Start boekhoudkoppeling -- determine which package Top Tuinen uses.
5. **MOD-009** (Critical): Start onderhoudscontracten module (P1 scope priority).
6. **WP-W01** (Warning): Expand wagenpark module with full reparatie-workflow.
7. **HR-W01** (Warning): Complete HR sub-features (RI&E, functioneringsgesprekken).
8. **PRJ-W01** (Warning): Add KLIC-melding reminder (legal requirement).

---

*Generated by Claude Agent (QA/Review) -- 2026-03-26*
