# Klantenportaal — Design Specification

## Overview

A fully branded customer portal for Top Tuinen where customers can view their quotes, track project progress, manage invoices, communicate with the company, and download documents. Customer chat messages appear in the dashboard's unified inbox alongside internal team conversations.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth | Clerk customer accounts with 2FA | Full security, fits existing stack |
| Scope v1 | Offertes, projecten, facturen, chat, documenten, profiel | Complete customer experience |
| Chat | Unified inbox — customer messages in dashboard chat | One place for all conversations |
| Routing | New `(portaal)` route group | Clean separation, no data leak risk |
| Notifications | Email only, click-through to portal | Customers aren't always logged in |
| Design | Fully Top Tuinen branded, light mode default | Customer-facing = brand experience |
| Dark mode | Toggle via Lucide Sun/Moon icons in top bar + profile | No emojis, icons only |
| Architecture | New `klant` role in existing Clerk instance | Simplest infra, one deployment |

---

## 1. Architecture

### Route Structure

```
src/app/
├── (auth)/              ← Clerk sign-in/sign-up (medewerkers)
├── (dashboard)/         ← Internal backoffice (medewerkers)
├── (public)/            ← Public pages (configurator, landing)
├── (portaal)/           ← NEW: Klantenportaal
│   ├── layout.tsx       ← Top Tuinen branded layout
│   ├── overzicht/       ← Dashboard/home for customer
│   ├── offertes/        ← View quotes, accept/reject
│   │   └── [id]/        ← Single offerte detail + signature
│   ├── projecten/       ← Project progress tracking
│   │   └── [id]/        ← Project detail with phase progress
│   ├── facturen/        ← Invoices & payment status
│   │   └── [id]/        ← Single factuur detail
│   ├── chat/            ← Messages with Top Tuinen
│   ├── documenten/      ← PDF downloads
│   └── profiel/         ← Account & 2FA settings
└── (portaal-auth)/      ← NEW: Customer sign-in/sign-up
    ├── inloggen/        ← Customer login page
    └── registreren/     ← Customer registration
```

### Auth & Middleware Flow

Role-based routing in `proxy.ts` using **Clerk session claims** (publicMetadata):

- When a klant registers, the Clerk webhook handler in `convex/users.ts` creates a `users` record with `role: "klant"` and sets `publicMetadata: { role: "klant" }` on the Clerk user via the Clerk Backend API. This makes the role available in the JWT session claims without a Convex query.
- `proxy.ts` reads `auth().sessionClaims.metadata.role` to route:
  - `/portaal/*` → requires `role === "klant"` → redirect to `/portaal/inloggen` if not
  - `/dashboard/*` → requires role in `["directie", "projectleider", "voorman", "medewerker", "materiaalman", "onderaannemer_zzp", "viewer"]` → redirect to `/sign-in` if not
  - `/public/*`, `/portaal-auth/*` → no auth check, always pass through
- A klant user who navigates to `/dashboard/*` is redirected to `/portaal/overzicht`
- A medewerker who navigates to `/portaal/*` is redirected to `/dashboard`

### Clerk Roles

Existing roles (medewerkers):
- directie, projectleider, voorman, medewerker, materiaalman, onderaannemer_zzp, viewer

New role:
- **klant** — sees only own offertes, projecten, facturen, and chat threads. All Convex queries filter on `klantId` linked to the customer's Clerk userId.

The `klant` role already exists in `convex/roles.ts` and `convex/validators.ts` with permissions for read-only offertes, projecten, facturen, and create/read chat. The portal builds on this existing role definition.

### Clerk Session Configuration for Klant Accounts

- Session duration: 7 days (longer than medewerkers — klanten log in less frequently)
- Auth methods: email/password + 2FA (TOTP or SMS). No social login for v1.
- Single session allowed (security — klant data is sensitive)
- Klant accounts do NOT appear in the medewerker management UI — filter by `role !== "klant"` in the medewerkers page query

---

## 2. Data Model

### Schema Changes — Existing Tables

#### `users` table — new field

```typescript
linkedKlantId: v.optional(v.id("klanten")),  // Links klant user to their klanten record
```

New index: `by_linked_klant: ["linkedKlantId"]`

The existing `users` table has `linkedMedewerkerId` for medewerkers. This mirrors that pattern for klant users. Set during registration (Phase 1, step 6 of the activation flow).

#### `klanten` table — new fields

```typescript
clerkUserId: v.optional(v.string()),   // The customer's own Clerk account ID
portalEnabled: v.optional(v.boolean()), // Whether portal access is activated
lastLoginAt: v.optional(v.number()),    // Last portal login timestamp
```

New indexes:
- `by_clerk_user_id: ["clerkUserId"]` — fast lookup when klant logs in
- `by_email: ["email"]` — needed for auto-linking during registration (note: `email` is optional, so some records won't be findable by email)

#### `projecten` table — new field

```typescript
klantId: v.optional(v.id("klanten")),  // NEW: direct link to klant
```

New index: `by_klant: ["klantId"]`

Currently `projecten` has no `klantId` — it only links to offertes via `offerteId`. Without this field, portal queries would require expensive multi-hop joins (klant → offerte → project). A backfill migration will populate `klantId` from `offertes.klantId` for existing projects.

#### `facturen` table — new field

```typescript
klantId: v.optional(v.id("klanten")),  // NEW: direct link to klant
```

New index: `by_klant: ["klantId"]`

Currently `facturen` has no `klantId` — it links through `projectId` → `offerteId` → `klantId`. Same as projecten: a backfill migration will populate `klantId` from the offerte chain for existing facturen.

#### `offertes` table — klantId handling

`offertes.klantId` is currently optional (`v.optional(v.id("klanten"))`). Offertes without a `klantId` will NOT appear in the portal. The implementation plan includes a backfill migration that matches existing offertes to klant records by `offerte.klant.email` === `klant.email`. Any remaining unlinked offertes must be manually linked by medewerkers via the dashboard before they become visible to customers.

### Klant ↔ User Linking

**Activation flow:**
1. Medewerker creates klant record (as today)
2. Medewerker clicks "Portaal activeren" on klant detail page (requires klant email to be set)
3. System generates an invitation token and sends invitation email to klant's email address
4. Klant clicks link → arrives at `/portaal-auth/registreren?token=xxx`
5. Klant registers via Clerk (email/password + 2FA setup)
6. Registration page calls a Convex mutation that:
   - Validates the invitation token
   - Looks up the `klanten` record by email (using `by_email` index)
   - Sets `clerkUserId` on the klanten record
   - Creates a `users` record with `role: "klant"` and `linkedKlantId` pointing to the klanten record
   - Sets Clerk `publicMetadata: { role: "klant" }` via Clerk Backend API
7. Klant can now log in and see their data

**Edge cases:**
- If klant email matches an existing `users` record: reject registration, surface error asking klant to contact Top Tuinen
- If klant email is not found in `klanten` table: reject registration (invitation-only system)
- If `klanten.email` is empty: "Portaal activeren" button is disabled with tooltip "Voeg eerst een e-mailadres toe"

### Unified Chat — New Tables

#### Existing chat tables (to be migrated)

The codebase has three separate messaging systems:

| Table | Purpose | Schema highlights |
|-------|---------|-------------------|
| `offerte_messages` | Klant ↔ bedrijf per offerte | `sender: "bedrijf" \| "klant"`, `offerteId`, `message`, `isRead` |
| `team_messages` | Team channel messages | `channelId`, `senderId`, `content`, `attachmentStorageId` |
| `direct_messages` | 1-on-1 DMs between medewerkers | `senderId`, `receiverId`, `content`, `attachmentStorageId` |

All three are replaced by a unified `chat_threads` + `chat_messages` system:

```typescript
// convex/schema.ts — NEW table
chat_threads: defineTable({
  type: v.union(
    v.literal("klant"),      // klant ↔ bedrijf conversation
    v.literal("team"),       // team channel
    v.literal("direct"),     // 1-on-1 DM between medewerkers
    v.literal("project")     // project-specific discussion
  ),
  klantId: v.optional(v.id("klanten")),
  offerteId: v.optional(v.id("offertes")),
  projectId: v.optional(v.id("projecten")),
  channelName: v.optional(v.string()),    // for team channels (migrated from team_messages)
  participants: v.array(v.string()),       // Clerk userIds
  lastMessageAt: v.optional(v.number()),
  lastMessagePreview: v.optional(v.string()),
  unreadByBedrijf: v.optional(v.number()),
  unreadByKlant: v.optional(v.number()),
  companyUserId: v.id("users"),            // Business/company owner (NOT the klant)
  createdAt: v.number(),
})
  .index("by_company", ["companyUserId"])
  .index("by_klant", ["klantId"])
  .index("by_offerte", ["offerteId"])
  .index("by_project", ["projectId"])
  .index("by_company_type", ["companyUserId", "type"])
  .index("by_company_last_message", ["companyUserId", "lastMessageAt"])

// convex/schema.ts — NEW table
chat_messages: defineTable({
  threadId: v.id("chat_threads"),
  senderType: v.union(
    v.literal("bedrijf"),
    v.literal("klant"),
    v.literal("medewerker")
  ),
  senderUserId: v.string(),               // Clerk userId
  senderName: v.string(),                  // Display name
  message: v.string(),
  attachmentStorageIds: v.optional(v.array(v.id("_storage"))),  // Convex storage IDs
  isRead: v.boolean(),
  createdAt: v.number(),
})
  .index("by_thread", ["threadId", "createdAt"])
  .index("by_thread_unread", ["threadId", "isRead"])
```

**Key design choices:**
- `companyUserId` (not `userId`) clarifies this is always the business owner, even for klant threads
- `attachmentStorageIds` uses Convex `_storage` IDs (not string URLs) to match the existing `team_messages` pattern
- `type: "direct"` added for 1-on-1 DMs (was missing in initial design)
- `channelName` added for team channel migration

### Chat Migration Mapping

| Source | Target thread type | Field mapping |
|--------|-------------------|---------------|
| `offerte_messages` | `type: "klant"` | `sender` → `senderType`, `message` → `message`, `offerteId` → thread's `offerteId`, `isRead` → `isRead` |
| `team_messages` | `type: "team"` | `channelId` → lookup channel name → `channelName`, `senderId` → `senderUserId`, `content` → `message`, `attachmentStorageId` → `attachmentStorageIds: [id]` |
| `direct_messages` | `type: "direct"` | `senderId` + `receiverId` → `participants`, `content` → `message`, `attachmentStorageId` → `attachmentStorageIds: [id]` |

### Dashboard Unified Inbox

The existing dashboard chat page (`/dashboard/chat/`) is updated to:
- Query `chat_threads` by `companyUserId`, sorted by `lastMessageAt` descending
- Show all thread types: `klant` threads with green KLANT badge, `team` threads with blue TEAM badge, `direct` threads with user avatar
- Klant threads display offerte/project context (e.g., "OFF-2024-042 · Tuinaanleg")
- Unread count badge per thread
- Filter tabs: Alle | Klanten | Team | Direct

### Portal Chat (Klant Side)

Portal chat queries `chat_threads` by `klantId`:
- Only sees `type: "klant"` threads
- Threads grouped by offerte/project
- Text-only messages in v1 (no file uploads from klant side — see Attachments below)
- Same messages, different UI (light/branded styling)

### Attachments

- **v1 scope:** Klanten can view attachments sent by medewerkers but cannot upload files themselves. The chat input is text-only for klant senders.
- **Medewerker side:** Medewerkers can attach files via Convex storage upload (existing pattern from `team_messages`). Attachments are stored as `v.id("_storage")` references.
- **Future:** File upload for klanten (with type/size restrictions) can be added later.

---

## 3. UI Design

### Design Tokens — Top Tuinen Brand

```
Colors:
  Primary Dark:    #1a2e1a  (dark green — top bar, headings)
  Accent Green:    #4ADE80  (CTA buttons, active states, badges)
  Background:      #f8faf8  (subtle green tint)
  Card:            #ffffff  (white cards with 1px #e5e7eb border)
  Warning:         #F59E0B  (open invoices, pending items)
  Info Blue:       #60A5FA  (messages, info badges)
  Error:           #EF4444  (overdue, rejected)

Dark Mode:
  Background:      #0a0f0a
  Card:            #1a2e1a
  Border:          #2a3e2a
  Text Primary:    #f0fdf4
  Text Secondary:  #888

Typography:
  Font:            Inter / Geist Sans
  Headings:        600-700 weight
  Body:            400 weight
  Labels:          12px uppercase, 0.5px letter-spacing

Spacing:
  Cards:           12px border-radius
  Buttons:         8px border-radius
  Grid:            16px / 24px spacing

Mode:
  Default:         Light mode
  Toggle:          Lucide Sun/Moon icons in top bar + profiel page
```

### Layout — Desktop

- **Top bar:** Dark green (#1a2e1a) with TT logo + "Top Tuinen" text + "Klantenportaal" subtle label. Right side: dark mode toggle (Lucide Sun/Moon), customer name, logout button.
- **Horizontal tab navigation:** Overzicht | Offertes | Projecten | Facturen | Berichten (with unread badge) | Documenten
- **Content area:** Light background (#f8faf8), white cards with subtle borders

### Layout — Mobile (responsive)

- **Top bar:** Compact with TT logo + hamburger menu icon (Lucide Menu)
- **Hamburger menu:** Full-height dark green overlay with navigation items, active item has left green border
- **Content:** Single column, cards stack vertically, KPI cards in 2x2 grid

### Pages

#### Overzicht (Home)
- Personal welcome message: "Welkom, [klantnaam]"
- 4 KPI cards: Openstaande offertes, Lopende projecten, Openstaande facturen, Nieuwe berichten
- Recente activiteit feed with colored dot indicators (green=offerte, blue=message, yellow=factuur)

#### Offertes
- Card per offerte with:
  - Name + status badge (Wacht op reactie / Geaccepteerd / Afgewezen)
  - Amount (incl. BTW) prominent on the right
  - Offerte number, type, date below
  - Actions: "Bekijken & Reageren" (green primary), "PDF Downloaden", "Vraag stellen"
- Rejected offertes visually muted (reduced opacity)
- Detail page: reuses the existing public offerte view components (line items, optional items selection, signature pad) but within the portal layout. The portal's `respondToOfferte` mutation calls the same underlying logic as `publicOffertes.respond` — same validation (offerte must be in `verzonden` status), same `customerResponse` field on the offerte, same version recording. The difference is auth: portal uses Clerk auth + klantId ownership check instead of share tokens.

#### Projecten
- List of projects with status badges
- Detail page:
  - Visual progress bar per phase (e.g., Grondwerk → Bestrating → Beplanting → Houtwerk → Oplevering)
  - Green = completed, Yellow = in progress, Grey = upcoming
  - Planning card: start date, expected completion, project leader, planned workdays
  - Quick actions: send message, view documents

#### Facturen
- Card per factuur with status badges mapped to schema values:
  - "Openstaand" → schema status `verzonden` (sent but unpaid)
  - "Betaald" → schema status `betaald`
  - "Vervallen" → schema status `vervallen` (overdue)
  - `concept` and `definitief` facturen are NOT shown in portal (internal-only statuses)
- "Betalen" button on `verzonden` invoices (links to Mollie payment page)
- PDF download on `betaald` invoices
- Amount + due date prominent

#### Berichten (Chat)
- Thread list on the left (per offerte/project), conversation on the right
- Top Tuinen messages: TT avatar + company name, left-aligned
- Customer messages: right-aligned, dark green background
- Text-only input bar at the bottom with "Verstuur" button (no file upload for klanten in v1)
- Medewerker-sent attachments are shown as downloadable links
- Same data as dashboard unified inbox, different UI styling (light/branded)

#### Documenten
- Grouped by offerte/project
- PDF downloads for: offertes, facturen, contracten
- Simple list with download icons

#### Profiel & Beveiliging
- Personal details card: naam, telefoon, adres — editable (updates `klanten` record only, does NOT retroactively update denormalized `offerte.klant` snapshots — those reflect the data at time of offerte creation)
- Email is read-only (tied to Clerk account, change via Clerk settings)
- Security card:
  - 2FA status + setup (via Clerk `<UserProfile />` component)
  - Password change (via Clerk `<UserProfile />` component)
  - Dark mode toggle (Lucide Sun/Moon with toggle switch)

---

## 4. Convex Functions

### New file: `convex/portaal.ts`

Portal-specific queries and mutations, all requiring `klant` role:

```
Queries:
  getOverzicht()        → KPI counts + recent activity for logged-in klant
  getOffertes()         → All offertes where klantId matches (only those with klantId set)
  getOfferte(id)        → Single offerte detail (ownership check via klantId)
  getProjecten()        → All projects where klantId matches (uses new klantId field)
  getProject(id)        → Project detail with phase progress (ownership check)
  getFacturen()         → All facturen where klantId matches AND status in [verzonden, betaald, vervallen]
  getFactuur(id)        → Single factuur detail (ownership check)
  getDocumenten()       → All downloadable documents grouped by offerte/project

Mutations:
  respondToOfferte(id, status, comment?, signature?, selectedOptionalRegelIds?)
    → Validates offerte is in "verzonden" status
    → Uses same customerResponse field as publicOffertes.respond
    → Auth via Clerk + klantId ownership (not share token)
    → Creates offerte version record (same as existing flow)
  updateProfile(naam, telefoon, adres)
    → Updates klanten record fields only
    → Does NOT update denormalized offerte.klant snapshots
```

### New file: `convex/chatThreads.ts`

```
Queries:
  listThreads(filter?)           → All threads for user (bedrijf queries by companyUserId, klant queries by klantId)
  getThread(threadId)            → Thread detail with ownership check (company or klant participant)
  listMessages(threadId, limit?) → Paginated messages for a thread (with ownership check)

Mutations:
  sendMessage(threadId, message, attachmentStorageIds?)
    → Klant senders: attachmentStorageIds must be empty/null (text-only in v1)
    → Rate limited: 30 messages/minute per user
  markAsRead(threadId)
    → Updates unreadByBedrijf or unreadByKlant depending on caller role
  createThread(type, klantId?, offerteId?, projectId?)
    → Auto-created when first message is sent on an offerte/project that has no thread yet
```

### Data Isolation

Every portal query:
1. Gets the Clerk userId from auth context
2. Looks up the `users` record by `clerkId`
3. Confirms `role === "klant"` and gets `linkedKlantId`
4. Looks up the `klanten` record by `linkedKlantId`
5. Filters all data by the klant's `_id` (matching `klantId` fields on offertes, projecten, facturen, chat_threads)
6. Returns only customer-visible fields (no internal margins, notes, cost breakdowns, medewerker assignments)

---

## 5. Email Notifications

### Implementation

- **Mechanism:** Convex scheduled functions (using `ctx.scheduler.runAfter`) triggered from mutations
- **Templates:** New React Email templates in `src/emails/` following existing patterns (`factuur-email.tsx`, `offerte-email.tsx`)
- **Sending:** Via existing email infrastructure (Resend)
- **Rate limiting:** Debounce multiple events within 5 minutes into a single email (e.g., if 3 messages are sent quickly, only one "new message" email goes out)
- **Unsubscribe:** Not in v1 — email is the only notification channel, so unsubscribing would mean no notifications at all. Consider adding per-event-type preferences in v2.

### Email Triggers

| Event | Email to Customer | Template | Link |
|-------|-------------------|----------|------|
| New offerte available | "Nieuwe offerte beschikbaar" | `portaal-offerte-email.tsx` | `/portaal/offertes/[id]` |
| Message from Top Tuinen | "Nieuw bericht van Top Tuinen" | `portaal-bericht-email.tsx` | `/portaal/chat` |
| Invoice created | "Nieuwe factuur aangemaakt" | `portaal-factuur-email.tsx` | `/portaal/facturen/[id]` |
| Project status changed | "Update over uw project" | `portaal-project-email.tsx` | `/portaal/projecten/[id]` |
| Portal invitation | "Welkom bij Top Tuinen" | `portaal-uitnodiging-email.tsx` | `/portaal-auth/registreren?token=xxx` |

All emails are branded with Top Tuinen styling and link directly to the relevant portal page.

---

## 6. Security Considerations

- **Role isolation:** `proxy.ts` reads role from Clerk session claims (`publicMetadata.role`) and enforces route-level access. Portal routes require `klant` role, dashboard routes require medewerker/admin roles. A customer cannot access `/dashboard/*`.
- **Data isolation:** All Convex portal queries derive `klantId` from the authenticated user's `linkedKlantId` on the `users` record. No query accepts a `klantId` parameter from the client.
- **Field filtering:** Portal queries return only customer-visible fields. Internal fields (margins, internal notes, cost breakdowns, medewerker assignments) are stripped before returning.
- **Rate limiting:** Chat message sending is rate-limited (30 messages/minute per user).
- **2FA:** Clerk-managed, configurable per customer account. Encouraged during registration.
- **Invitation-only:** Customers cannot self-register. Registration requires a valid invitation token from a medewerker activating portal access.
- **Share tokens:** Existing share token system coexists. Customers with portal access who click a share token link are redirected to the portal version. Customers without portal access continue using share tokens.
- **Klant visibility in dashboard:** Klant user records are filtered out of the medewerkers management page (`/dashboard/medewerkers`) by excluding `role: "klant"`.

---

## 7. Migration & Backwards Compatibility

### Phase 1: Schema changes + portal auth
- Add `linkedKlantId` field to `users` table + `by_linked_klant` index
- Add `clerkUserId`, `portalEnabled`, `lastLoginAt` fields to `klanten` table
- Add `by_clerk_user_id` and `by_email` indexes to `klanten` table
- Add `klantId` field to `projecten` table + `by_klant` index
- Add `klantId` field to `facturen` table + `by_klant` index
- Backfill migration: populate `projecten.klantId` from `offertes.klantId` (via `projecten.offerteId`)
- Backfill migration: populate `facturen.klantId` from project chain (via `facturen.projectId` → `projecten.offerteId` → `offertes.klantId`)
- Backfill migration: link orphaned offertes to klant records by matching `offerte.klant.email` to `klanten.email`
- Add `chat_threads` and `chat_messages` tables to schema
- Set up `(portaal-auth)` routes with Clerk
- Set up `(portaal)` layout with role-based middleware in `proxy.ts`
- Update Clerk webhook handler to support `klant` role + `publicMetadata` setting

### Phase 2: Unified chat
- Migrate `offerte_messages` → `chat_messages` with `type: "klant"` threads
- Migrate `team_messages` → `chat_messages` with `type: "team"` threads (map `channelId` → `channelName`, `attachmentStorageId` → `attachmentStorageIds`)
- Migrate `direct_messages` → `chat_messages` with `type: "direct"` threads (group by sender+receiver pair)
- Update dashboard chat to unified inbox
- Keep old message query functions working (deprecated, reading from new tables with a compatibility layer)

### Phase 3: Portal pages
- Build portal pages: overzicht, offertes, projecten, facturen, chat, documenten, profiel
- Reuse existing components where possible (offerte detail view, signature pad, PDF generation)
- Build `convex/portaal.ts` with all portal queries/mutations
- Build `convex/chatThreads.ts` with unified chat functions

### Phase 4: Email notifications + activation flow
- Build "Portaal activeren" button on klant detail in dashboard
- Invitation email with registration link + token
- Registration flow with auto-linking
- Event-based email notifications via Convex scheduled functions
- New React Email templates for each notification type

### Share Token Coexistence
- Customers without portal access continue using share token links
- Customers with portal access who visit a share token link are redirected to `/portaal/offertes/[id]`
- Share tokens remain as fallback for one-off interactions
