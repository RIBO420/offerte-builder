# Schema Review - convex/schema.ts

**Reviewed:** 2026-03-26
**Reviewer:** Claude Opus 4.6
**Tables:** ~45 tables across 2106 lines
**Validators file:** convex/validators.ts (715 lines)

## Summary

- Critical: 5
- Warning: 12
- Info: 8

---

## Findings

### [CRITICAL] Denormalized klant data in offertes without sync mechanism
**Location:** `offertes.klant` (embedded object, line 115-122)
**Issue:** Customer data (naam, adres, postcode, plaats, email, telefoon) is duplicated as an embedded object inside every offerte, alongside the `klantId` foreign key. While snapshotting makes sense for sent/accepted offertes (immutable record), concept-stage offertes will drift out of sync when the customer record in `klanten` is updated. There is no documented sync mechanism or migration to keep concept offertes aligned with `klanten`.
**Recommendation:** For offertes in `concept` or `voorcalculatie` status, resolve klant data at read time from the `klantId` reference. Only snapshot the klant data when the offerte transitions to `verzonden`. Alternatively, add a mutation that cascades klant updates to all concept-stage offertes.

### [CRITICAL] Missing index on offertes.klantId - frequent filter queries without index
**Location:** `offertes` table (line 97-227)
**Issue:** The `klantId` field has no index, but `convex/klanten.ts` performs `.filter((q) => q.eq(q.field("klantId"), args.id))` on offertes in at least 8 different queries (lines 74, 264, 463, 537, 649, 666, 720, 735). Every one of these is a full table scan filtered in-memory. As the offertes table grows, this becomes a serious performance bottleneck.
**Recommendation:** Add `.index("by_klant", ["klantId"])` to the offertes table. This is the single highest-impact index missing from the schema.

### [CRITICAL] urenRegistraties.medewerker is a free-text string instead of a foreign key
**Location:** `urenRegistraties.medewerker` (line 681)
**Issue:** The `medewerker` field is `v.string()` containing the employee's name, not `v.id("medewerkers")`. This means:
  1. No referential integrity -- renaming a medewerker breaks the link.
  2. Queries joining uren to medewerkers must string-match on names (fragile).
  3. The `medewerkerClerkId` field (line 699) is optional and redundant.
  The `weekPlanning` table correctly uses `medewerkerId: v.id("medewerkers")`, showing the intended pattern.
**Recommendation:** Add `medewerkerId: v.optional(v.id("medewerkers"))` to `urenRegistraties` and backfill it from existing name-based lookups. Deprecate the string `medewerker` field. Add an index `by_medewerker` on the new ID field.

### [CRITICAL] configuratorAanvragen has no userId -- no multi-tenant isolation
**Location:** `configuratorAanvragen` table (line 1903-1959)
**Issue:** This table stores customer-submitted requests (leads) but has no `userId` field to associate them with a specific business owner/tenant. The `toegewezenAan` field is optional and represents manual assignment, not data ownership. In a multi-tenant system, all queries on this table return data from all tenants. The indexes `by_status`, `by_type`, and `by_pipeline_status` are all global, not tenant-scoped.
**Recommendation:** Add `userId: v.optional(v.id("users"))` (optional because leads arrive before assignment). Add `by_user` and compound `by_user_status` indexes. Update all queries to filter by tenant.

### [CRITICAL] Seven uses of v.any() bypass type safety
**Location:** Multiple tables
**Issue:** `v.any()` is used in 7 places, completely bypassing Convex's type system:
  - `voertuigen.fleetgoData` (line 930) -- raw FleetGo API data
  - `notificationDeliveryLog.data` (line 1530) -- notification payload
  - `pushNotificationLogs.data` (line 1554) -- notification payload (deprecated table)
  - `notifications.metadata` (line 1645) -- context data
  - `configuratorAanvragen.specificaties` (line 1919) -- request specs
  - `leadActiviteiten.metadata` (line 1973) -- activity metadata
  - `betalingen.metadata` (line 1998) -- payment metadata
  Of these, `configuratorAanvragen.specificaties` is especially concerning because it is a required (non-optional) field storing core business data with zero type safety.
**Recommendation:** Replace `v.any()` with typed validators. For `specificaties`, create a `v.union()` of type-specific validators per `configuratorAanvragen.type`. For metadata/data fields, use `v.record(v.string(), v.string())` or a defined object shape. For `fleetgoData`, use `v.optional(v.record(v.string(), v.any()))` at minimum to enforce an object shape.

---

### [WARNING] Inconsistent soft delete -- only 2 of ~45 tables support it
**Location:** `offertes.deletedAt` (line 217), `projecten.deletedAt` (line 501)
**Issue:** Only offertes and projecten have `deletedAt` for soft delete. Related tables (facturen, meerwerk, urenRegistraties, klanten, etc.) have no soft delete support. This means:
  1. Deleting a klant hard-deletes the record while their offertes can be soft-deleted -- inconsistent behavior.
  2. Neither table has an index on `deletedAt`, so filtering out soft-deleted records requires a full scan or in-memory filter on every query.
**Recommendation:** Decide on a soft-delete strategy: either add `deletedAt` consistently to all business-critical tables (klanten, facturen, medewerkers, leveranciers) or remove it from offertes/projecten and use archiving (`isArchived`) as the sole pattern. Add a compound index like `by_user_active ["userId", "deletedAt"]` for efficient filtering.

### [WARNING] Inconsistent archiving -- 3 tables with isArchived, no indexes for it
**Location:** `offertes.isArchived` (line 213), `projecten.isArchived` (line 497), `facturen.isArchived` (line 865)
**Issue:** These three tables have `isArchived` + `archivedAt` fields, but none of them have an index including `isArchived`. The facturen query code (line 340) filters archived records in-memory: `result.filter((f) => !f.isArchived)`. Additionally, there is no archiving support on klanten, medewerkers, or leveranciers.
**Recommendation:** Add compound indexes like `by_user_archived ["userId", "isArchived"]` to support efficient filtered queries. Consider whether archiving and soft delete should be unified into a single pattern.

### [WARNING] Deprecated tables still in schema with full index sets
**Location:** `pushNotificationLogs` (line 1542-1567), `notification_log` (line 1572-1588)
**Issue:** Both tables are marked `DEPRECATED: migrate to notificationDeliveryLog` but remain fully defined with 3 indexes each. They are still actively used in code (pushNotifications.ts). These deprecated tables add storage overhead, index maintenance cost, and cognitive burden.
**Recommendation:** Create a migration plan with a deadline. Phase 1: update all reads to use `notificationDeliveryLog`. Phase 2: update all writes to dual-write. Phase 3: drop the deprecated tables.

### [WARNING] Deprecated status values in offertes and projecten
**Location:** `offertes.status` "definitief" (line 106), `projecten.status` "voorcalculatie" (line 479)
**Issue:** Both are marked as deprecated with comments but remain in the union validators. No migration has been created. Queries using `by_status` or `by_user_status` indexes may return stale data for these deprecated values. Code may still create records with these values.
**Recommendation:** Write a Convex migration to update existing records (`definitief` -> `voorcalculatie`, `voorcalculatie` -> `gepland`). After migration, remove the deprecated literals from the union validators.

### [WARNING] teams.leden uses embedded array of IDs -- no reverse lookup
**Location:** `teams.leden` (line 1022)
**Issue:** Team membership is stored as `v.array(v.id("medewerkers"))` inside the teams table. This means:
  1. You cannot efficiently query "which teams does medewerker X belong to?" without scanning all teams.
  2. Convex has a 1MB document size limit; a very large team membership list could approach this.
  3. Adding/removing a member requires rewriting the entire array.
**Recommendation:** For the current scale (a landscaping company), this is acceptable. If teams grow large, consider a junction table `teamMedewerkers(teamId, medewerkerId)` with indexes on both fields.

### [WARNING] weekPlanning has no userId -- cannot scope by tenant
**Location:** `weekPlanning` table (line 546-559)
**Issue:** The `weekPlanning` table has no `userId` field. Multi-tenant isolation relies on querying through `medewerkerId` or `projectId` relationships. This is indirect and error-prone -- a single miswritten query could expose planning data across tenants.
**Recommendation:** Add `userId: v.id("users")` for direct tenant isolation and add a compound index `by_user_datum ["userId", "datum"]`.

### [WARNING] voorcalculaties has no userId -- relies on indirect relationship
**Location:** `voorcalculaties` table (line 514-526)
**Issue:** No `userId` field. Both `offerteId` and `projectId` are optional, meaning a voorcalculatie could theoretically exist with no link to any parent record or tenant. This is a data integrity risk.
**Recommendation:** Add `userId: v.id("users")` and ensure at least one of `offerteId`/`projectId` is required (use a runtime validation check since Convex does not support conditional required fields).

### [WARNING] nacalculaties has no userId -- relies on projectId traversal
**Location:** `nacalculaties` table (line 719-730)
**Issue:** Same pattern as voorcalculaties -- no direct tenant scoping. All access requires first resolving the project's userId.
**Recommendation:** Add `userId: v.id("users")` for direct tenant isolation.

### [WARNING] planningTaken has no userId -- relies on projectId traversal
**Location:** `planningTaken` table (line 529-543)
**Issue:** Same multi-tenant concern. The `by_status` index is global (not tenant-scoped), meaning a query on status returns tasks from all tenants.
**Recommendation:** Add `userId: v.id("users")` and change `by_status` to `by_user_status ["userId", "status"]`.

### [WARNING] brandstofRegistratie.datum is v.number() while other tables use v.string() for dates
**Location:** `brandstofRegistratie.datum` (line 1003)
**Issue:** Most date fields in the schema use `v.string()` with YYYY-MM-DD format (urenRegistraties, weekPlanning, machineGebruik, kilometerStanden, projectKosten, etc.). But `brandstofRegistratie.datum` uses `v.number()` (timestamp). This inconsistency makes date-based queries across tables unreliable and confusing for developers.
**Recommendation:** Standardize all `datum` fields to the same type. Since the majority use `v.string()` YYYY-MM-DD, convert `brandstofRegistratie.datum` to match.

### [WARNING] Duplicate klant data shape defined 3 times without shared validator
**Location:** `offertes.klant` (line 115-122), `offerte_versions.snapshot.klant` (line 404-411), `facturen.klant` (line 804-811)
**Issue:** The exact same klant object shape (naam, adres, postcode, plaats, optional email, optional telefoon) is duplicated three times. If the shape needs to change, all three must be updated in sync.
**Recommendation:** Extract a shared `klantSnapshotValidator` in `validators.ts` and reference it in all three places.

---

### [INFO] offerte_versions snapshot uses v.string() for typed fields
**Location:** `offerte_versions.snapshot.status` (line 403), `snapshot.algemeenParams.bereikbaarheid` (line 413), `snapshot.regels[].type` (line 444)
**Issue:** The version snapshot uses `v.string()` for fields that are typed unions in the parent `offertes` table (e.g., `status` is `v.union(...)` in offertes but `v.string()` in the snapshot). This is a deliberate trade-off for flexibility (historical snapshots should not break if enum values change), but it means snapshot data is not type-checked.
**Recommendation:** Acceptable as-is for a snapshot/audit table. Document this decision in a code comment.

### [INFO] offertes.regels stored as embedded array -- not normalized
**Location:** `offertes.regels` (line 162-180)
**Issue:** Line items are embedded in the offerte document rather than in a separate `offerte_regels` table. This means the entire regels array is loaded every time the offerte is queried, and individual line items cannot be indexed or queried independently. For a typical offerte with 10-50 line items, this is fine, but very large offertes could hit the 1MB document limit.
**Recommendation:** Acceptable for current scale. Monitor document sizes. If offertes regularly exceed 100+ line items, consider normalizing to a separate table.

### [INFO] routes.pathPoints could grow very large
**Location:** `routes.pathPoints` (line 1370-1376)
**Issue:** The `pathPoints` array stores every GPS coordinate along a route. For a long journey with high-frequency GPS polling, this array could contain thousands of entries, approaching the 1MB document limit.
**Recommendation:** Consider compression (e.g., Douglas-Peucker algorithm to reduce points) or chunking into separate `routeSegments` documents if routes become very long.

### [INFO] locationData table could grow unbounded
**Location:** `locationData` table (line 1257-1285)
**Issue:** GPS data points are recorded continuously during tracking sessions. Over weeks/months of use with multiple field workers, this table could grow to millions of rows. The `by_time` index helps, but there is no TTL or archival strategy.
**Recommendation:** Implement a data retention policy -- aggregate old data into `locationAnalytics` and delete raw `locationData` after 30-90 days. Consider GDPR implications.

### [INFO] Inconsistent naming conventions across tables
**Location:** Schema-wide
**Issue:** Table names mix camelCase and snake_case:
  - camelCase: `offertes`, `klanten`, `projecten`, `weekPlanning`, `machineGebruik`, `voertuigOnderhoud`, etc.
  - snake_case: `offerte_messages`, `offerte_versions`, `email_logs`, `team_messages`, `direct_messages`, `notification_preferences`, `chat_attachments`, `notification_log`, `offerte_reminders`
  Field names also mix Dutch and English (e.g., `isActief` vs `isActive`, `createdAt` vs `aangemaakt`).
**Recommendation:** Standardize to one convention. Since the majority of tables use camelCase and field names are primarily Dutch, adopt camelCase for new tables. Rename snake_case tables in a future migration.

### [INFO] garantiePakketten.by_tier index is not tenant-scoped
**Location:** `garantiePakketten` table (line 1880-1894)
**Issue:** The `by_tier` index is `["tier"]` without `userId`. Querying by tier returns packages from all tenants. The `by_user` index exists but cannot filter by tier efficiently.
**Recommendation:** Replace `by_tier` with `by_user_tier ["userId", "tier"]`.

### [INFO] betalingen table has no direct link to facturen
**Location:** `betalingen` table (line 1978-2004)
**Issue:** The `betalingen` table links payments to source entities via `referentie` (a string) and `type`. There is no direct foreign key to `facturen` for invoice payments, requiring string-based lookups to connect payments to invoices.
**Recommendation:** Add `factuurId: v.optional(v.id("facturen"))` for direct linking of invoice payments.

### [INFO] Missing updatedAt on several tables
**Location:** Multiple tables
**Issue:** The following tables have `createdAt` but no `updatedAt`:
  - `normuren` (line 251-260)
  - `correctiefactoren` (line 263-270)
  - `offerte_messages` (line 357-365)
  - `voorcalculaties` (line 514-526)
  - `planningTaken` (line 529-543)
  - `weekPlanning` (line 546-559)
  - `machineGebruik` (line 707-716)
  - `kilometerStanden` (line 985-996)
  - `brandstofRegistratie` (line 1000-1011)
  - `leerfeedback_historie` (line 897-912)
  - `geofenceEvents` (line 1318-1336)
  - `routes` (line 1339-1381)
  - `locationAnalytics` (line 1384-1403)
  - `locationAuditLog` (line 1406-1424)
  - `pushTokens` (line 1487-1499)
  - `leadActiviteiten` (line 1962-1975)
  While not all tables need `updatedAt` (some are append-only logs), tables like `normuren`, `planningTaken`, and `weekPlanning` are regularly updated and would benefit from tracking the last modification time.
**Recommendation:** Add `updatedAt: v.number()` to tables that support updates (normuren, planningTaken, weekPlanning, machineGebruik). Leave append-only log tables as-is.

---

## Documented Known Issues (from schema header comment)

The schema header (lines 10-22) documents known type inconsistencies from parallel agent development:
- `adres`: string vs optional across tables
- `beschrijving`: string vs optional across tables
- `btw`: number vs optional across tables
- `voertuigId`: id vs optional across tables
- `projectId`: id vs optional across tables

These are acknowledged and tracked for future cleanup.

## Architecture Notes

The schema represents a comprehensive business application spanning:
- **Core business:** Offertes, klanten, projecten, facturen (~8 tables)
- **Calculation engine:** Producten, normuren, correctiefactoren, voorcalculaties, nacalculaties (~6 tables)
- **Planning:** WeekPlanning, planningTaken (~2 tables)
- **Fleet management:** Voertuigen, onderhoud, schades, uitrusting, brandstof, km-standen (~6 tables)
- **HR:** Medewerkers, verlof, verzuim, toolbox (~4 tables)
- **Communication:** Team/direct messages, notifications, push tokens (~8 tables)
- **GPS tracking:** Location sessions, data, geofences, routes, analytics, audit (~7 tables)
- **Supply chain:** Leveranciers, inkooporders, voorraad, mutaties (~4 tables)
- **CRM/Configurator:** Leads, activiteiten, betalingen (~3 tables)

Overall, the schema is well-structured for its domain. The main systemic issues are: (1) inconsistent multi-tenant isolation (some tables lack userId), (2) missing klantId index on offertes causing frequent full-table scans, and (3) string-based references where foreign keys should be used (urenRegistraties.medewerker).
