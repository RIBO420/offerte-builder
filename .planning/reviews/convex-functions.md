# Convex Functions Review

**Date:** 2026-03-26
**Reviewer:** Claude Opus 4.6 (automated)
**Scope:** All 78 files in `convex/*.ts` (~30,000+ lines)

## Summary

- **Critical: 7**
- **Warning: 18**
- **Info: 8**

---

## Findings

### [CRITICAL] Full table scan of urenRegistraties in voormanDashboard
**Location:** `convex/voormanDashboard.ts:getVoormanStats` (line 38)
**Issue:** `ctx.db.query("urenRegistraties").collect()` fetches the ENTIRE urenRegistraties table without any index filter. This table grows with every hour logged by every employee. On a company with a year of data, this could be tens of thousands of records loaded into memory just to filter for today's date client-side.
**Recommendation:** Add a `by_datum` index to urenRegistraties and use `.withIndex("by_datum", q => q.eq("datum", today))` instead. Alternatively, filter by `by_user` at minimum.

### [CRITICAL] Full table scan of urenRegistraties in directieDashboard
**Location:** `convex/directieDashboard.ts:getDirectieStats` (line 36)
**Issue:** `ctx.db.query("urenRegistraties").collect()` fetches all time registrations for all users without any index. This is called on every dashboard load for management users.
**Recommendation:** Filter by userId index, or add a date-range index. At minimum use `.withIndex("by_user", q => q.eq("userId", userId))`.

### [CRITICAL] Full table scan of urenRegistraties in mobile.ts
**Location:** `convex/mobile.ts:getWeekHours` (line 420)
**Issue:** `ctx.db.query("urenRegistraties").collect()` loads all time registrations globally, then filters in memory. This runs on every mobile app load to show weekly hours.
**Recommendation:** Use the `by_user` index or `by_project` index to scope the query. The medewerker-linked query pattern should filter at the database level.

### [CRITICAL] Multiple full table scans in medewerkerAnalytics
**Location:** `convex/medewerkerAnalytics.ts` (lines 37, 77, 269, 286, 457)
**Issue:** At least 5 full table scans without indexes: `urenRegistraties` is scanned 3 times and `voorcalculaties` is scanned 3 times across different query functions. These analytics queries load all records for all users.
**Recommendation:** All queries should filter by userId index. The `voorcalculaties` table should be queried with `.withIndex("by_offerte")` or a user-scoped index.

### [CRITICAL] betalingen.list returns ALL payments for ALL users
**Location:** `convex/betalingen.ts:list` (line 68)
**Issue:** The `list` query calls `requireAuth` but then queries all betalingen without any user filter: `ctx.db.query("betalingen").order("desc").collect()`. Any authenticated user can see all payment records. Additionally, the `create` mutation does not store `userId` on the record, making it impossible to filter by user later.
**Recommendation:** Store `userId` in the betalingen record on create. Filter list query by userId. This is a data privacy issue.

### [CRITICAL] Missing ownership verification in toolboxMeetings.update
**Location:** `convex/toolboxMeetings.ts:update` (line ~105)
**Issue:** The `update` mutation checks `requireNotViewer` but does NOT verify that the meeting belongs to the authenticated user. Any non-viewer can update any toolbox meeting by providing its ID.
**Recommendation:** Add ownership verification: fetch the meeting, compare `meeting.userId` with the authenticated user's ID.

### [CRITICAL] Missing ownership verification in leadActiviteiten.listByLead
**Location:** `convex/leadActiviteiten.ts:listByLead`
**Issue:** The query only calls `requireAuth` but does not verify that the lead (configuratorAanvragen) belongs to the authenticated user. Any authenticated user can read activities for any lead by providing its ID.
**Recommendation:** Fetch the lead record first and verify `userId` matches the authenticated user before returning activities.

---

### [WARNING] N+1 query pattern in teams.ts (8 instances)
**Location:** `convex/teams.ts` (lines 63, 99, 101, 133, 179, 350, 465, 475)
**Issue:** Multiple functions iterate over team members and call `ctx.db.get(medewerkerId)` for each one individually. In `listWithMedewerkers`, this is nested: iterating teams, then for each team iterating members. For a company with 10 teams of 5 members each, this is 50+ individual DB reads.
**Recommendation:** Batch-fetch all medewerkers with a single query (`.collect()` on the medewerkers table filtered by userId) and build a lookup map, similar to the pattern already used in `voormanDashboard.ts`.

### [WARNING] N+1 query pattern in weekPlanning.ts
**Location:** `convex/weekPlanning.ts:getWeek` (line 41), `getOntbrekendeUren` (lines 473, 515)
**Issue:** `getWeek` maps over toewijzingen and does `ctx.db.get()` for each medewerker/project/voertuig. `getOntbrekendeUren` loops over medewerkerIds calling `ctx.db.get()` for each one.
**Recommendation:** Pre-fetch all referenced entities in a single pass using `Promise.all` with a deduplicated ID list, or use a single indexed query + map lookup.

### [WARNING] N+1 query pattern in toolboxMeetings.ts
**Location:** `convex/toolboxMeetings.ts:list` and `get`
**Issue:** Both functions resolve `aanwezigenNamen` by calling `ctx.db.get(id)` for each attendee in a `Promise.all(meeting.aanwezigen.map(...))`. When listing multiple meetings, this becomes deeply nested: for each meeting, for each attendee, one DB read.
**Recommendation:** Pre-fetch all medewerkers once and use a Map for lookups.

### [WARNING] Unbounded .collect() calls across dashboard/analytics queries
**Location:** `convex/analytics.ts`, `convex/realtime.ts`, `convex/projectRapportages.ts`, `convex/medewerkerRapportages.ts`
**Issue:** Dashboard and analytics queries frequently use `.collect()` on indexed queries (e.g., all offertes for a user, all projecten for a user). While indexed, these grow unbounded over time. A user with 500+ offertes will load all of them into memory for every dashboard load.
**Recommendation:** For dashboard stats, consider adding time-bounded queries (e.g., last 12 months) or paginate. For counts, use `.collect()` but return only aggregated stats, not raw records.

### [WARNING] configuratorAanvragen.countByStatus does a full table scan
**Location:** `convex/configuratorAanvragen.ts:countByStatus` (line 77-81)
**Issue:** `ctx.db.query("configuratorAanvragen").collect()` loads all aanvragen without an index, then groups by status in memory.
**Recommendation:** Use `.withIndex("by_user", ...)` or similar index to scope this query.

### [WARNING] Pagination inconsistency across files
**Location:** Multiple files
**Issue:** Pagination is implemented differently across the codebase:
- `offertes.ts:listPaginated` uses Convex's native `.paginate()` with cursor -- correct pattern
- `projecten.ts:listPaginated` uses manual `.collect()` then `.slice()` for offset-based pagination -- loads all records then slices
- `facturen.ts:listPaginated` also uses manual `.collect()` + `.slice()`
- `leveranciers.ts`, `voertuigen.ts` also use offset-based collect+slice

The manual pattern defeats the purpose of pagination since all records are fetched first.
**Recommendation:** Standardize on Convex's native cursor-based `.paginate()` API across all paginated queries. The offset-based approach loads the entire dataset into memory.

### [WARNING] facturen.generate mutation writes to 2 tables without rollback
**Location:** `convex/facturen.ts:generate`
**Issue:** This mutation inserts a factuur AND patches instellingen (to increment `laatsteFactuurNummer`). If the factuur insert succeeds but the instellingen patch fails (unlikely but possible with validation), the counter is out of sync. Note: Convex mutations ARE atomic (all-or-nothing), so this is safe within Convex's transactional model. However, the pattern of reading instellingen + incrementing a counter could cause race conditions under concurrent calls (two users generating a factuur simultaneously could get the same number).
**Recommendation:** Consider using a Convex-native approach for sequential numbering, or add a unique index on `factuurnummer` to catch duplicates.

### [WARNING] facturen.markAsPaidAndArchiveProject writes to 3 tables
**Location:** `convex/facturen.ts:markAsPaidAndArchiveProject`
**Issue:** This mutation patches facturen, projecten, and offertes in a single call. While Convex mutations are atomic, this tightly couples three domain entities. If any of the intermediate `ctx.db.get()` calls return null (data inconsistency), the error is thrown after partial patches may have already occurred within the same transaction -- though Convex rolls back on error, the throws after patches are fine.
**Recommendation:** This is acceptable in Convex's transactional model. No action needed, but consider extracting to a helper function for readability.

### [WARNING] offertes.updateStatus mutation writes to offertes + offerte_versions + schedules notifications
**Location:** `convex/offertes.ts:updateStatus`
**Issue:** This mutation patches the offerte, inserts a version snapshot, and schedules notifications. The multi-table write is fine (Convex atomicity), but the notification scheduling via `ctx.scheduler.runAfter` means the notification is fire-and-forget. If the notification action fails, there's no retry or error handling visible.
**Recommendation:** Ensure the notification actions have proper error handling and logging. Consider adding a notification delivery log (which appears to exist in the schema).

### [WARNING] publicOffertes mutations lack rate limiting on some endpoints
**Location:** `convex/publicOffertes.ts:markAsViewed`, `submitQuestion`
**Issue:** While `respond` has rate limiting via `checkPublicOfferteRateLimit`, the `markAsViewed` and `submitQuestion` mutations only validate the share token but have no rate limiting. A malicious actor with a valid token could spam view events or questions.
**Recommendation:** Apply the same rate limiting pattern used in `respond` to `markAsViewed` and `submitQuestion`.

### [WARNING] chat.ts getUnreadCounts performs multiple full-table-ish collects
**Location:** `convex/chat.ts:getUnreadCounts` (around line 492)
**Issue:** This query collects team_messages and direct_messages, then filters in memory for unread status. As chat history grows, this becomes increasingly expensive. This is a real-time query (subscribed by the frontend for live updates).
**Recommendation:** Use more specific indexes (e.g., by_recipient_unread) and limit the scan range (e.g., only messages from the last 30 days). Consider a separate unread-count materialized view.

### [WARNING] Missing input validation on financial amounts
**Location:** `convex/betalingen.ts:create`, `convex/meerwerk.ts:create`
**Issue:** The `bedrag` field in betalingen and the `totaal` field in meerwerk regels accept any number without validation. Negative amounts, NaN, or extremely large values could be inserted.
**Recommendation:** Add validation: `if (args.bedrag <= 0) throw new Error("Bedrag moet positief zijn")`. The `validators.ts` file already has `validateFinancialAmount` and `validatePrijsPerEenheid` helpers -- use them consistently.

### [WARNING] Date() timezone dependency in voormanDashboard and proactiveWarnings
**Location:** `convex/voormanDashboard.ts:todayStr()`, `convex/proactiveWarnings.ts`
**Issue:** `new Date()` in Convex server functions uses UTC timezone, but the Dutch business operates in CET/CEST (UTC+1/+2). The `todayStr()` function could return yesterday's date for the first 1-2 hours of the Dutch business day.
**Recommendation:** Apply a timezone offset for CET/CEST when computing "today" in server functions, or accept a client-provided date.

### [WARNING] offerteMessages.markAsRead loops with individual patches
**Location:** `convex/offerteMessages.ts:markAsRead`, `markCustomerMessagesAsRead`
**Issue:** Both functions collect all unread messages and then patch each one individually in a `for` loop. With many unread messages, this could be slow within a single mutation.
**Recommendation:** This is acceptable for small volumes. If message counts grow large, consider batch-update patterns or a single "lastReadAt" timestamp approach.

### [WARNING] Missing error messages in English mixed with Dutch
**Location:** Various files
**Issue:** Most error messages are correctly in Dutch (e.g., "Offerte niet gevonden"), but some files have English error messages (e.g., `convex/meerwerk.ts`: "Alleen aangevraagd meerwerk kan goedgekeurd worden" is Dutch, but some validators throw generic English). Error message language is inconsistent.
**Recommendation:** Audit all `throw new Error()` calls and standardize to Dutch for user-facing errors, English for developer/system errors.

### [WARNING] mobile.ts admin queries lack proper full-table protection
**Location:** `convex/mobile.ts:adminListAllUsers` (line 1046), `adminListMedewerkers` (line 1097)
**Issue:** `adminListAllUsers` does `ctx.db.query("users").collect()` and `ctx.db.query("medewerkers").collect()` -- full table scans. While these are admin-only queries, they will become slow as the user base grows.
**Recommendation:** Add pagination or result limits to admin queries.

---

### [INFO] Correct use of query vs mutation distinction
**Location:** All files
**Issue:** All read operations use `query` and all write operations use `mutation`. No mutations are used where queries should be, and vice versa. The `action` type is properly reserved for external API calls (Expo push notifications in `notifications.ts`). Internal functions correctly use `internalMutation`, `internalQuery`, and `internalAction`.
**Recommendation:** No action needed. This is well-implemented.

### [INFO] Consistent auth pattern across all files
**Location:** All files
**Issue:** All exported queries and mutations use either `requireAuth`, `requireAuthUserId`, `requireNotViewer`, or `requireAdmin` as the first line of the handler. Public endpoints (publicOffertes, offerteMessages public functions) correctly use token-based auth instead. The auth helper pattern in `convex/auth.ts` is clean and well-designed.
**Recommendation:** No action needed.

### [INFO] Convex mutations are inherently atomic
**Location:** Multiple files with multi-table writes
**Issue:** Several mutations write to multiple tables (e.g., `facturen.generate` writes factuur + patches instellingen, `offertes.updateStatus` patches offerte + inserts version). In Convex, all mutations are transactional -- if any step throws, the entire mutation is rolled back. This means the multi-table writes found in the codebase are safe.
**Recommendation:** No action needed. The transactional model is correctly leveraged.

### [INFO] Good use of Promise.all for parallel data fetching
**Location:** `convex/offertes.ts:getDashboardData`, `convex/directieDashboard.ts`, `convex/materiaalmanDashboard.ts`, `convex/projectKosten.ts`, many others
**Issue:** Most dashboard and detail queries use `Promise.all` to fetch related data in parallel rather than sequentially. This reduces query execution time.
**Recommendation:** No action needed. This is a good pattern.

### [INFO] Soft delete pattern is well-implemented
**Location:** `convex/softDelete.ts`, used by `convex/offertes.ts`, `convex/projecten.ts`, `convex/klanten.ts`
**Issue:** The soft delete pattern with `deletedAt` timestamps, 30-day retention, and automated cleanup via daily cron job is well-designed. The cron job in `convex/crons.ts` runs at 3:00 AM UTC.
**Recommendation:** No action needed.

### [INFO] Pipeline helper pattern is clean
**Location:** `convex/pipelineHelpers.ts`
**Issue:** The `upgradeKlantPipeline` helper correctly ensures pipeline status only moves forward (never downgrades). It's used consistently from `offertes.ts`, `publicOffertes.ts`, and `projecten.ts`.
**Recommendation:** No action needed.

### [INFO] Shared validators in validators.ts are comprehensive
**Location:** `convex/validators.ts` (716 lines)
**Issue:** Extensive validation library covering Dutch phone numbers, postcodes, KVK numbers, BTW numbers, IBAN, and domain-specific validators for all scope types. Well-structured with sanitization functions.
**Recommendation:** Use these validators more consistently across all mutation files. Some files (e.g., `betalingen.ts`, `meerwerk.ts`) don't use the shared validators for financial fields.

### [INFO] migrations.ts functions are correctly internal-only
**Location:** `convex/migrations.ts`
**Issue:** All migration functions are defined as `internalMutation`, meaning they can only be called from within the Convex backend (not from the frontend). This prevents accidental triggering from the UI.
**Recommendation:** No action needed.

---

## Aggregate Observations

### Full Table Scans Summary
The following tables are scanned without indexes in at least one location:
| Table | Files with full scans |
|---|---|
| `urenRegistraties` | voormanDashboard, directieDashboard, mobile, medewerkerAnalytics (3x) |
| `voorcalculaties` | medewerkerAnalytics (3x) |
| `configuratorAanvragen` | configuratorAanvragen.countByStatus |
| `users` | mobile.adminListAllUsers |
| `medewerkers` | mobile.adminListMedewerkers |
| `instellingen` | projectKosten (2x, using `.first()` without index) |

### N+1 Pattern Summary
| File | Function | Pattern |
|---|---|---|
| `teams.ts` | getWithMedewerkers, listWithMedewerkers, getTeamPrestaties, getAllTeamsPrestaties | Loop over team members with `ctx.db.get()` |
| `weekPlanning.ts` | getWeek, getOntbrekendeUren, sendUrenHerinneringen | Loop over toewijzingen/medewerkers with `ctx.db.get()` |
| `toolboxMeetings.ts` | list, get | Loop over aanwezigen with `ctx.db.get()` |
| `mobile.ts` | getWeekHours, getAssignedProjects, getRecentSessions | Loop over projects/sessions with `ctx.db.get()` |
| `voormanDashboard.ts` | getVoormanStats | Loop over projects + medewerkers + voertuigen |

### Files with Most Issues
1. `convex/medewerkerAnalytics.ts` -- 5 full table scans, performance-critical
2. `convex/voormanDashboard.ts` -- full table scan + N+1 patterns
3. `convex/mobile.ts` -- full table scans + N+1 patterns (mobile performance critical)
4. `convex/teams.ts` -- 8 N+1 patterns
5. `convex/weekPlanning.ts` -- 3 N+1 patterns + many unbounded collects
