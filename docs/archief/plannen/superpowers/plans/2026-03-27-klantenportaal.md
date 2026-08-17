# Klantenportaal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully branded customer portal where Top Tuinen customers can view offertes, track projects, manage facturen, chat with the company, and download documents — with unified chat appearing in the dashboard inbox.

**Architecture:** New `(portaal)` route group with Clerk `klant` role auth, new `chat_threads`/`chat_messages` Convex tables replacing three existing messaging systems, Top Tuinen branded light-mode UI with dark mode toggle. Portal queries filter all data by `klantId` derived from authenticated user.

**Tech Stack:** Next.js App Router, Convex (backend + schema), Clerk (auth + 2FA), React Email (notifications), shadcn/ui + Tailwind CSS (UI), Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-26-klantenportaal-design.md`

---

## File Structure

### Convex Backend (new/modified)

```
convex/
├── schema.ts                    ← MODIFY: add fields to users, klanten, projecten, facturen + new chat tables
├── validators.ts                ← MODIFY: add chat thread/message validators
├── auth.ts                      ← MODIFY: add requireKlant() helper
├── roles.ts                     ← MODIFY: add getLinkedKlant() helper
├── users.ts                     ← MODIFY: update Clerk webhook to handle klant registration
├── klanten.ts                   ← MODIFY: add portal activation mutation
├── portaal.ts                   ← CREATE: all portal-specific queries/mutations
├── chatThreads.ts               ← CREATE: unified chat thread/message functions
├── chatMigration.ts             ← CREATE: migration script for 3 existing chat tables
└── portaalEmail.ts              ← CREATE: email notification triggers (scheduled functions)
```

### Portal Auth Pages (new)

Note: Next.js route groups `(portaal-auth)` strip the group name from the URL. To get URLs like `/portaal/inloggen`, the folder structure must include a `portaal/` subfolder inside the route group.

```
src/app/(portaal-auth)/portaal/
├── layout.tsx                   ← CREATE: minimal branded layout for login/register
├── inloggen/
│   └── page.tsx                 ← CREATE: klant login page (Clerk SignIn)
└── registreren/
    └── page.tsx                 ← CREATE: klant registration with invitation token
```

### Portal Pages (new)

```
src/app/(portaal)/
├── layout.tsx                   ← CREATE: Top Tuinen branded layout with nav
├── overzicht/
│   └── page.tsx                 ← CREATE: klant dashboard/home
├── offertes/
│   ├── page.tsx                 ← CREATE: offertes list
│   └── [id]/
│       └── page.tsx             ← CREATE: offerte detail + accept/reject
├── projecten/
│   ├── page.tsx                 ← CREATE: projecten list
│   └── [id]/
│       └── page.tsx             ← CREATE: project detail with progress
├── facturen/
│   ├── page.tsx                 ← CREATE: facturen list
│   └── [id]/
│       └── page.tsx             ← CREATE: factuur detail
├── chat/
│   └── page.tsx                 ← CREATE: berichten (klant side of unified chat)
├── documenten/
│   └── page.tsx                 ← CREATE: document downloads
└── profiel/
    └── page.tsx                 ← CREATE: profile + 2FA + dark mode settings
```

### Portal Components (new)

```
src/components/portaal/
├── portaal-header.tsx           ← CREATE: top bar with logo, dark mode toggle, user menu
├── portaal-nav.tsx              ← CREATE: horizontal tab nav (desktop) + hamburger (mobile)
├── portaal-kpi-cards.tsx        ← CREATE: 4 status cards for overzicht
├── portaal-activity-feed.tsx    ← CREATE: recent activity list for overzicht
├── portaal-offerte-card.tsx     ← CREATE: offerte list card with status/actions
├── portaal-project-progress.tsx ← CREATE: visual phase progress bar
├── portaal-factuur-card.tsx     ← CREATE: factuur list card with pay/download
├── portaal-chat-thread-list.tsx ← CREATE: chat thread sidebar (klant view)
├── portaal-chat-messages.tsx    ← CREATE: message display + input (klant view)
├── portaal-document-list.tsx    ← CREATE: grouped document download list
└── portaal-theme-provider.tsx   ← CREATE: dark/light mode context + toggle
```

### Dashboard Updates (modified)

```
src/app/(dashboard)/chat/
└── page.tsx                     ← MODIFY: unified inbox with klant/team/direct threads

src/app/(dashboard)/klanten/
└── page.tsx                     ← MODIFY: add "Portaal activeren" button per klant
```

### Email Templates (new)

```
src/emails/
├── portaal-uitnodiging-email.tsx  ← CREATE: portal invitation email
├── portaal-offerte-email.tsx      ← CREATE: new offerte notification
├── portaal-bericht-email.tsx      ← CREATE: new message notification
├── portaal-factuur-email.tsx      ← CREATE: new factuur notification
└── portaal-project-email.tsx      ← CREATE: project status update notification
```

### Middleware (modified)

```
src/proxy.ts                     ← MODIFY: add role-based routing for portaal vs dashboard
```

---

## Critical Implementation Notes

These notes override any conflicting code snippets in the tasks below. The implementing agent MUST follow these:

1. **Facturen field names**: The schema uses `factuurnummer` (all lowercase), `betaaldAt` (not `betaaldOp`). There is NO `molliePaymentUrl` field on facturen — Mollie payment links live in the `betalingen` table via `molliePaymentId`. Portal factuur queries must join to `betalingen` for payment URLs.

2. **Projecten has NO date fields**: The `projecten` table has only `naam`, `status`, `offerteId`, `userId`, `createdAt`, `updatedAt`. There are NO `startDatum` or `verwachteOplevering` fields. Project dates must come from linked `planningTaken` or from the `voorcalculaties` table. For v1, show `createdAt` and status only — add planning dates in a follow-up.

3. **Clerk API in Convex**: Convex runs in its own runtime, NOT in Next.js. You cannot import `@clerk/nextjs/server` in Convex functions. Use `@clerk/backend` (add to dependencies) or use the Clerk REST API with `fetch` directly: `fetch('https://api.clerk.com/v1/users/{userId}', { headers: { Authorization: 'Bearer ' + process.env.CLERK_SECRET_KEY } })`.

4. **Token generation**: Use the existing `generateSecureToken()` from `convex/auth.ts` instead of `nanoid`. It uses `crypto.getRandomValues` which works in Convex.

5. **Convex Provider**: The root `src/app/layout.tsx` already wraps ALL routes with `ClerkProvider` + `ConvexClientProvider`. Portal routes inherit this automatically — no extra provider wrapping needed.

6. **Route group paths**: `(portaal-auth)` is a route group — it does NOT appear in the URL. Files at `src/app/(portaal-auth)/portaal/inloggen/page.tsx` serve at `/portaal/inloggen`.

7. **Migration files**: Convex supports subdirectories for functions. However, the existing codebase has `convex/migrations.ts` as a single file. Place new migration functions in `convex/chatMigration.ts` and `convex/backfillKlantIds.ts` (top-level, not in a subdirectory) to match the pattern.

---

## Phase 1: Schema & Data Foundation

### Task 1: Add new fields to existing tables in schema

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/validators.ts`

- [ ] **Step 1: Add `linkedKlantId` to users table**

In `convex/schema.ts`, find the `users` table definition. Add after `linkedMedewerkerId`:

```typescript
linkedKlantId: v.optional(v.id("klanten")),
```

Add index after `by_linked_medewerker`:

```typescript
.index("by_linked_klant", ["linkedKlantId"])
```

- [ ] **Step 2: Add portal fields to klanten table**

In `convex/schema.ts`, find the `klanten` table definition. Add after the existing fields:

```typescript
clerkUserId: v.optional(v.string()),
portalEnabled: v.optional(v.boolean()),
lastLoginAt: v.optional(v.number()),
invitationToken: v.optional(v.string()),
invitationExpiresAt: v.optional(v.number()),
```

Add indexes after existing ones:

```typescript
.index("by_clerk_user_id", ["clerkUserId"])
.index("by_email", ["email"])
.index("by_invitation_token", ["invitationToken"])
```

- [ ] **Step 3: Add `klantId` to projecten table**

In `convex/schema.ts`, find the `projecten` table definition. Add:

```typescript
klantId: v.optional(v.id("klanten")),
```

Add index:

```typescript
.index("by_klant", ["klantId"])
```

- [ ] **Step 4: Add `klantId` to facturen table**

In `convex/schema.ts`, find the `facturen` table definition. Add:

```typescript
klantId: v.optional(v.id("klanten")),
```

Add index:

```typescript
.index("by_klant", ["klantId"])
```

- [ ] **Step 5: Add new chat tables**

Add at the end of `convex/schema.ts` before the closing `});`:

```typescript
chat_threads: defineTable({
  type: v.union(
    v.literal("klant"),
    v.literal("team"),
    v.literal("direct"),
    v.literal("project")
  ),
  klantId: v.optional(v.id("klanten")),
  offerteId: v.optional(v.id("offertes")),
  projectId: v.optional(v.id("projecten")),
  channelName: v.optional(v.string()),
  participants: v.array(v.string()),
  lastMessageAt: v.optional(v.number()),
  lastMessagePreview: v.optional(v.string()),
  unreadByBedrijf: v.optional(v.number()),
  unreadByKlant: v.optional(v.number()),
  companyUserId: v.id("users"),
  createdAt: v.number(),
})
  .index("by_company", ["companyUserId"])
  .index("by_klant", ["klantId"])
  .index("by_offerte", ["offerteId"])
  .index("by_project", ["projectId"])
  .index("by_company_type", ["companyUserId", "type"])
  .index("by_company_last_message", ["companyUserId", "lastMessageAt"]),

chat_messages: defineTable({
  threadId: v.id("chat_threads"),
  senderType: v.union(
    v.literal("bedrijf"),
    v.literal("klant"),
    v.literal("medewerker")
  ),
  senderUserId: v.string(),
  senderName: v.string(),
  message: v.string(),
  attachmentStorageIds: v.optional(v.array(v.id("_storage"))),
  isRead: v.boolean(),
  createdAt: v.number(),
})
  .index("by_thread", ["threadId", "createdAt"])
  .index("by_thread_unread", ["threadId", "isRead"]),
```

- [ ] **Step 6: Add validators for new types**

In `convex/validators.ts`, add:

```typescript
export const chatThreadTypeValidator = v.union(
  v.literal("klant"),
  v.literal("team"),
  v.literal("direct"),
  v.literal("project")
);

export const chatSenderTypeValidator = v.union(
  v.literal("bedrijf"),
  v.literal("klant"),
  v.literal("medewerker")
);
```

- [ ] **Step 7: Run `npx convex dev` to verify schema pushes without errors**

Run: `npx convex dev --once`
Expected: Schema pushed successfully, no validation errors.

- [ ] **Step 8: Commit**

```bash
git add convex/schema.ts convex/validators.ts
git commit -m "feat(schema): add portal fields, klantId on projecten/facturen, unified chat tables"
```

---

### Task 2: Backfill migrations

**Files:**
- Create: `convex/backfillKlantIds.ts`

- [ ] **Step 1: Create klantId backfill migration for projecten**

Create `convex/backfillKlantIds.ts`:

```typescript
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

// Backfill klantId on projecten from their linked offerte
export const backfillProjectenKlantId = internalMutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    const projecten = await ctx.db
      .query("projecten")
      .collect();

    let updated = 0;
    for (const project of projecten) {
      if (project.klantId) continue; // already set
      if (!project.offerteId) continue;

      const offerte = await ctx.db.get(project.offerteId);
      if (offerte?.klantId) {
        await ctx.db.patch(project._id, { klantId: offerte.klantId });
        updated++;
      }
    }

    console.log(`Backfilled klantId on ${updated} projecten`);
    return { updated };
  },
});

// Backfill klantId on facturen from their linked project chain
export const backfillFacturenKlantId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const facturen = await ctx.db
      .query("facturen")
      .collect();

    let updated = 0;
    for (const factuur of facturen) {
      if (factuur.klantId) continue; // already set
      if (!factuur.projectId) continue;

      const project = await ctx.db.get(factuur.projectId);
      if (!project?.offerteId) continue;

      const offerte = await ctx.db.get(project.offerteId);
      if (offerte?.klantId) {
        await ctx.db.patch(factuur._id, { klantId: offerte.klantId });
        updated++;
      }
    }

    console.log(`Backfilled klantId on ${updated} facturen`);
    return { updated };
  },
});

// Link orphaned offertes to klant records by matching email
export const linkOrphanedOffertes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const offertes = await ctx.db
      .query("offertes")
      .collect();

    let linked = 0;
    for (const offerte of offertes) {
      if (offerte.klantId) continue; // already linked
      if (!offerte.klant?.email) continue;

      // Find klant by email
      const klant = await ctx.db
        .query("klanten")
        .withIndex("by_email", (q) => q.eq("email", offerte.klant.email))
        .first();

      if (klant && klant.userId.toString() === offerte.userId.toString()) {
        await ctx.db.patch(offerte._id, { klantId: klant._id });
        linked++;
      }
    }

    console.log(`Linked ${linked} orphaned offertes to klant records`);
    return { linked };
  },
});
```

- [ ] **Step 2: Verify migrations compile**

Run: `npx convex dev --once`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add convex/backfillKlantIds.ts
git commit -m "feat(migration): add klantId backfill for projecten, facturen, and orphaned offertes"
```

---

### Task 3: Auth helpers for portal

**Files:**
- Modify: `convex/auth.ts`
- Modify: `convex/roles.ts`

- [ ] **Step 1: Add `requireKlant` helper to `convex/auth.ts`**

Add after the existing `requireAuth` function:

```typescript
export async function requireKlant(ctx: QueryCtx | MutationCtx) {
  const user = await requireAuth(ctx);
  const role = normalizeRole(user.role);
  if (role !== "klant") {
    throw new AuthError("Deze functie is alleen beschikbaar voor klanten");
  }
  if (!user.linkedKlantId) {
    throw new AuthError("Uw account is niet gekoppeld aan een klantprofiel");
  }
  const klant = await ctx.db.get(user.linkedKlantId);
  if (!klant) {
    throw new AuthError("Klantprofiel niet gevonden");
  }
  return { user, klant };
}
```

Add the `normalizeRole` import at the top if not already imported:

```typescript
import { normalizeRole } from "./roles";
```

- [ ] **Step 2: Add `getLinkedKlant` helper to `convex/roles.ts`**

Add after the existing `getLinkedMedewerker` function:

```typescript
export async function getLinkedKlant(ctx: QueryCtx | MutationCtx) {
  const user = await requireAuth(ctx);
  if (!user.linkedKlantId) return null;
  return await ctx.db.get(user.linkedKlantId);
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx convex dev --once`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add convex/auth.ts convex/roles.ts
git commit -m "feat(auth): add requireKlant and getLinkedKlant helpers for portal access"
```

---

## Phase 2: Portal Auth & Routing

### Task 4: Update proxy.ts for role-based routing

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: Update proxy.ts with role-based route matching**

Replace the entire contents of `src/proxy.ts`:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/api/webhooks(.*)",
  "/offerte/(.*)",
  "/configurator(.*)",
  "/monitoring",
  "/manifest.json",
]);

const isPortaalAuthRoute = createRouteMatcher([
  "/portaal/inloggen(.*)",
  "/portaal/registreren(.*)",
]);

const isPortaalRoute = createRouteMatcher([
  "/portaal(.*)",
]);

const isDashboardRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/offertes(.*)",
  "/klanten(.*)",
  "/projecten(.*)",
  "/facturen(.*)",
  "/medewerkers(.*)",
  "/instellingen(.*)",
  "/planning(.*)",
  "/uren(.*)",
  "/verlof(.*)",
  "/verzuim(.*)",
  "/wagenpark(.*)",
  "/voorraad(.*)",
  "/rapportages(.*)",
  "/toolbox(.*)",
  "/prijsboek(.*)",
  "/inkoop(.*)",
  "/leveranciers(.*)",
  "/archief(.*)",
  "/profiel(.*)",
  "/gebruikers(.*)",
  "/chat(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const url = new URL(req.url);

  // Public routes — no auth required
  if (isPublicRoute(req) || isPortaalAuthRoute(req)) {
    return;
  }

  // All other routes require authentication
  const session = await auth.protect();

  // Portal routes — require klant role
  if (isPortaalRoute(req)) {
    const role = (session.sessionClaims?.metadata as { role?: string })?.role;
    if (role !== "klant") {
      // Not a klant — redirect to dashboard
      return Response.redirect(new URL("/dashboard", req.url));
    }
    return;
  }

  // Dashboard routes — require non-klant role
  if (isDashboardRoute(req)) {
    const role = (session.sessionClaims?.metadata as { role?: string })?.role;
    if (role === "klant") {
      // Klant trying to access dashboard — redirect to portal
      return Response.redirect(new URL("/portaal/overzicht", req.url));
    }
    return;
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run typecheck`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat(auth): add role-based routing in proxy.ts for portaal vs dashboard"
```

---

### Task 5: Portal auth pages (login + registration)

**Files:**
- Create: `src/app/(portaal-auth)/layout.tsx`
- Create: `src/app/(portaal-auth)/inloggen/page.tsx`
- Create: `src/app/(portaal-auth)/registreren/page.tsx`

- [ ] **Step 1: Create portaal-auth layout**

Create `src/app/(portaal-auth)/portaal/layout.tsx`:

```tsx
export default function PortaalAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f8faf8] flex flex-col items-center justify-center">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-[#4ADE80] w-10 h-10 rounded-lg flex items-center justify-center font-bold text-black text-lg">
          TT
        </div>
        <div>
          <span className="text-[#1a2e1a] font-semibold text-xl">Top Tuinen</span>
          <span className="text-[#4ADE80] text-sm ml-2 opacity-70">Klantenportaal</span>
        </div>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create klant login page**

Create `src/app/(portaal-auth)/portaal/inloggen/page.tsx`:

```tsx
import { SignIn } from "@clerk/nextjs";

export default function PortaalLoginPage() {
  return (
    <SignIn
      path="/portaal/inloggen"
      routing="path"
      afterSignInUrl="/portaal/overzicht"
      appearance={{
        elements: {
          formButtonPrimary: "bg-[#4ADE80] hover:bg-[#22c55e] text-black",
          card: "shadow-lg",
        },
      }}
    />
  );
}
```

- [ ] **Step 3: Create klant registration page**

Create `src/app/(portaal-auth)/portaal/registreren/page.tsx`:

```tsx
"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function RegistrationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  if (!token) {
    return (
      <div className="max-w-md mx-auto text-center p-8 bg-white rounded-xl border border-gray-200">
        <h2 className="text-lg font-semibold text-[#1a2e1a] mb-2">
          Ongeldige registratielink
        </h2>
        <p className="text-sm text-gray-600">
          U kunt alleen registreren via een uitnodiging van Top Tuinen.
          Neem contact op als u een uitnodiging verwacht.
        </p>
      </div>
    );
  }

  return (
    <SignUp
      path="/portaal/registreren"
      routing="path"
      afterSignUpUrl={`/portaal/overzicht?invitation=${token}`}
      appearance={{
        elements: {
          formButtonPrimary: "bg-[#4ADE80] hover:bg-[#22c55e] text-black",
          card: "shadow-lg",
        },
      }}
    />
  );
}

export default function PortaalRegisterPage() {
  return (
    <Suspense>
      <RegistrationContent />
    </Suspense>
  );
}
```

- [ ] **Step 4: Verify pages render without errors**

Run: `npm run typecheck`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(portaal-auth\)/
git commit -m "feat(portaal): add klant login and registration pages"
```

---

### Task 5b: Share token redirect for portal klanten

**Files:**
- Modify: `src/app/(public)/offerte/[token]/page.tsx`

- [ ] **Step 1: Add portal redirect for authenticated klanten**

At the top of the public offerte page component, after loading the offerte data, check if the current user is an authenticated klant with portal access. If so, look up the offerte's `_id` and redirect to `/portaal/offertes/[id]` instead of showing the share token view. This ensures klanten with portal access always end up in the branded portal experience.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(public\)/offerte/
git commit -m "feat(portaal): redirect portal klanten from share token to portal view"
```

---

### Task 6: Portal activation flow (Convex + dashboard)

**Files:**
- Modify: `convex/klanten.ts`
- Modify: `convex/users.ts`

- [ ] **Step 1: Add portal activation mutation to `convex/klanten.ts`**

Add to `convex/klanten.ts`:

```typescript
import { generateSecureToken } from "./auth";

export const activatePortal = mutation({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireNotViewer(ctx);
    const klant = await ctx.db.get(args.klantId);
    if (!klant) throw new Error("Klant niet gevonden");
    if (klant.userId.toString() !== user._id.toString()) {
      throw new Error("Geen toegang tot deze klant");
    }
    if (!klant.email) {
      throw new Error("Klant heeft geen e-mailadres. Voeg eerst een e-mailadres toe.");
    }
    if (klant.portalEnabled && klant.clerkUserId) {
      throw new Error("Klant heeft al portaal-toegang");
    }

    const token = generateSecureToken(48);
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    await ctx.db.patch(args.klantId, {
      portalEnabled: true,
      invitationToken: token,
      invitationExpiresAt: expiresAt,
    });

    // Schedule invitation email
    await ctx.scheduler.runAfter(0, internal.portaalEmail.sendInvitation, {
      klantId: args.klantId,
      token,
    });

    return { token, expiresAt };
  },
});

export const deactivatePortal = mutation({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireNotViewer(ctx);
    const klant = await ctx.db.get(args.klantId);
    if (!klant) throw new Error("Klant niet gevonden");
    if (klant.userId.toString() !== user._id.toString()) {
      throw new Error("Geen toegang tot deze klant");
    }

    await ctx.db.patch(args.klantId, {
      portalEnabled: false,
      invitationToken: undefined,
      invitationExpiresAt: undefined,
    });
  },
});
```

- [ ] **Step 2: Add klant linking mutation to `convex/users.ts`**

Add a mutation that runs after klant registration to link the Clerk account:

```typescript
export const linkKlantAccount = mutation({
  args: { invitationToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Find klant by invitation token
    const klant = await ctx.db
      .query("klanten")
      .withIndex("by_invitation_token", (q) =>
        q.eq("invitationToken", args.invitationToken)
      )
      .first();

    if (!klant) throw new Error("Ongeldige uitnodiging");
    if (klant.invitationExpiresAt && klant.invitationExpiresAt < Date.now()) {
      throw new Error("Deze uitnodiging is verlopen");
    }
    if (klant.clerkUserId) {
      throw new Error("Deze klant heeft al een account");
    }

    // Verify email matches
    if (klant.email && user.email && klant.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new Error("E-mailadres komt niet overeen met de uitnodiging");
    }

    // Link the accounts
    await ctx.db.patch(klant._id, {
      clerkUserId: user.clerkId,
      invitationToken: undefined,
      invitationExpiresAt: undefined,
      lastLoginAt: Date.now(),
    });

    await ctx.db.patch(user._id, {
      role: "klant",
      linkedKlantId: klant._id,
    });

    // Set Clerk publicMetadata via scheduled action
    await ctx.scheduler.runAfter(0, internal.users.setClerkMetadata, {
      clerkUserId: user.clerkId,
      metadata: { role: "klant" },
    });

    return { klantId: klant._id };
  },
});

// Internal action to set Clerk publicMetadata via REST API
// NOTE: Cannot use @clerk/nextjs in Convex — use Clerk REST API directly
export const setClerkMetadata = internalAction({
  args: {
    clerkUserId: v.string(),
    metadata: v.object({ role: v.string() }),
  },
  handler: async (_ctx, args) => {
    const response = await fetch(
      `https://api.clerk.com/v1/users/${args.clerkUserId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          public_metadata: args.metadata,
        }),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to update Clerk metadata: ${response.statusText}`);
    }
  },
});
```

- [ ] **Step 3: Verify compilation**

Run: `npx convex dev --once`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add convex/klanten.ts convex/users.ts
git commit -m "feat(portaal): add portal activation, invitation token, and klant account linking"
```

---

## Phase 3: Unified Chat Backend

### Task 7: Chat thread and message Convex functions

**Files:**
- Create: `convex/chatThreads.ts`

- [ ] **Step 1: Create `convex/chatThreads.ts` with queries**

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireKlant } from "./auth";
import { getCompanyUserId, normalizeRole } from "./roles";
import { chatThreadTypeValidator, chatSenderTypeValidator } from "./validators";

// List threads for dashboard (bedrijf/medewerker) or portal (klant)
export const listThreads = query({
  args: {
    filter: v.optional(chatThreadTypeValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const role = normalizeRole(user.role);

    if (role === "klant") {
      // Klant: show only their klant threads
      if (!user.linkedKlantId) return [];
      const threads = await ctx.db
        .query("chat_threads")
        .withIndex("by_klant", (q) => q.eq("klantId", user.linkedKlantId!))
        .collect();
      return threads
        .filter((t) => t.type === "klant")
        .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
    }

    // Bedrijf/medewerker: show all threads for company
    const companyUserId = await getCompanyUserId(ctx);
    let threads;
    if (args.filter) {
      threads = await ctx.db
        .query("chat_threads")
        .withIndex("by_company_type", (q) =>
          q.eq("companyUserId", companyUserId).eq("type", args.filter!)
        )
        .collect();
    } else {
      threads = await ctx.db
        .query("chat_threads")
        .withIndex("by_company", (q) => q.eq("companyUserId", companyUserId))
        .collect();
    }

    return threads.sort(
      (a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0)
    );
  },
});

export const getThread = query({
  args: { threadId: v.id("chat_threads") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;

    const role = normalizeRole(user.role);
    if (role === "klant") {
      // Klant can only see their own threads
      if (!user.linkedKlantId || thread.klantId?.toString() !== user.linkedKlantId.toString()) {
        return null;
      }
    } else {
      // Bedrijf: verify company ownership
      const companyUserId = await getCompanyUserId(ctx);
      if (thread.companyUserId.toString() !== companyUserId.toString()) {
        return null;
      }
    }

    return thread;
  },
});

export const listMessages = query({
  args: {
    threadId: v.id("chat_threads"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return [];

    // Ownership check
    const role = normalizeRole(user.role);
    if (role === "klant") {
      if (!user.linkedKlantId || thread.klantId?.toString() !== user.linkedKlantId.toString()) {
        return [];
      }
    } else {
      const companyUserId = await getCompanyUserId(ctx);
      if (thread.companyUserId.toString() !== companyUserId.toString()) {
        return [];
      }
    }

    const messages = await ctx.db
      .query("chat_messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .take(args.limit ?? 100);

    return messages;
  },
});

// Get unread counts for badge display
export const getUnreadCounts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const role = normalizeRole(user.role);

    if (role === "klant") {
      if (!user.linkedKlantId) return { total: 0 };
      const threads = await ctx.db
        .query("chat_threads")
        .withIndex("by_klant", (q) => q.eq("klantId", user.linkedKlantId!))
        .collect();
      const total = threads.reduce((sum, t) => sum + (t.unreadByKlant ?? 0), 0);
      return { total };
    }

    const companyUserId = await getCompanyUserId(ctx);
    const threads = await ctx.db
      .query("chat_threads")
      .withIndex("by_company", (q) => q.eq("companyUserId", companyUserId))
      .collect();
    const total = threads.reduce((sum, t) => sum + (t.unreadByBedrijf ?? 0), 0);
    return { total };
  },
});
```

- [ ] **Step 2: Add mutations to `convex/chatThreads.ts`**

Append to the same file:

```typescript
export const sendMessage = mutation({
  args: {
    threadId: v.id("chat_threads"),
    message: v.string(),
    attachmentStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const role = normalizeRole(user.role);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Gesprek niet gevonden");

    // Determine sender type and verify access
    let senderType: "bedrijf" | "klant" | "medewerker";
    if (role === "klant") {
      if (!user.linkedKlantId || thread.klantId?.toString() !== user.linkedKlantId.toString()) {
        throw new Error("Geen toegang tot dit gesprek");
      }
      senderType = "klant";
      // Klant cannot send attachments in v1
      if (args.attachmentStorageIds && args.attachmentStorageIds.length > 0) {
        throw new Error("Bijlagen versturen is nog niet beschikbaar");
      }
    } else {
      const companyUserId = await getCompanyUserId(ctx);
      if (thread.companyUserId.toString() !== companyUserId.toString()) {
        throw new Error("Geen toegang tot dit gesprek");
      }
      senderType = role === "directie" || role === "projectleider" ? "bedrijf" : "medewerker";
    }

    const messageId = await ctx.db.insert("chat_messages", {
      threadId: args.threadId,
      senderType,
      senderUserId: user.clerkId,
      senderName: user.name,
      message: args.message,
      attachmentStorageIds: args.attachmentStorageIds,
      isRead: false,
      createdAt: Date.now(),
    });

    // Update thread metadata
    const preview = args.message.length > 80
      ? args.message.substring(0, 80) + "..."
      : args.message;

    const updateFields: Record<string, unknown> = {
      lastMessageAt: Date.now(),
      lastMessagePreview: preview,
    };

    if (senderType === "klant") {
      updateFields.unreadByBedrijf = (thread.unreadByBedrijf ?? 0) + 1;
    } else {
      updateFields.unreadByKlant = (thread.unreadByKlant ?? 0) + 1;
    }

    await ctx.db.patch(args.threadId, updateFields);

    return messageId;
  },
});

export const markAsRead = mutation({
  args: { threadId: v.id("chat_threads") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const role = normalizeRole(user.role);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return;

    if (role === "klant") {
      await ctx.db.patch(args.threadId, { unreadByKlant: 0 });
    } else {
      await ctx.db.patch(args.threadId, { unreadByBedrijf: 0 });
    }

    // Mark individual messages as read
    const unreadMessages = await ctx.db
      .query("chat_messages")
      .withIndex("by_thread_unread", (q) =>
        q.eq("threadId", args.threadId).eq("isRead", false)
      )
      .collect();

    for (const msg of unreadMessages) {
      // Only mark messages from the other side as read
      const isFromOtherSide = role === "klant"
        ? msg.senderType !== "klant"
        : msg.senderType === "klant";
      if (isFromOtherSide) {
        await ctx.db.patch(msg._id, { isRead: true });
      }
    }
  },
});

// Create a thread (auto-created when first message sent on offerte/project)
export const getOrCreateKlantThread = mutation({
  args: {
    offerteId: v.optional(v.id("offertes")),
    projectId: v.optional(v.id("projecten")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check if thread already exists
    if (args.offerteId) {
      const existing = await ctx.db
        .query("chat_threads")
        .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId!))
        .first();
      if (existing) return existing._id;
    }
    if (args.projectId) {
      const existing = await ctx.db
        .query("chat_threads")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
        .first();
      if (existing) return existing._id;
    }

    // Determine klantId and companyUserId
    let klantId, companyUserId;
    if (args.offerteId) {
      const offerte = await ctx.db.get(args.offerteId);
      if (!offerte) throw new Error("Offerte niet gevonden");
      klantId = offerte.klantId;
      companyUserId = offerte.userId;
    } else if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project) throw new Error("Project niet gevonden");
      klantId = project.klantId;
      companyUserId = project.userId;
    } else {
      throw new Error("offerteId of projectId is verplicht");
    }

    const threadId = await ctx.db.insert("chat_threads", {
      type: "klant",
      klantId,
      offerteId: args.offerteId,
      projectId: args.projectId,
      participants: [user.clerkId],
      companyUserId,
      createdAt: Date.now(),
    });

    return threadId;
  },
});
```

- [ ] **Step 3: Verify compilation**

Run: `npx convex dev --once`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add convex/chatThreads.ts
git commit -m "feat(chat): add unified chat thread queries and mutations"
```

---

### Task 8: Chat migration script

**Files:**
- Create: `convex/chatMigration.ts`

- [ ] **Step 1: Create `convex/chatMigration.ts`**

```typescript
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Migrate offerte_messages → chat_threads + chat_messages
export const migrateOfferteMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("offerte_messages").collect();

    // Group messages by offerteId
    const byOfferte = new Map<string, typeof messages>();
    for (const msg of messages) {
      const key = msg.offerteId.toString();
      if (!byOfferte.has(key)) byOfferte.set(key, []);
      byOfferte.get(key)!.push(msg);
    }

    let threadsCreated = 0;
    let messagesMigrated = 0;

    for (const [offerteIdStr, msgs] of byOfferte) {
      const offerte = await ctx.db.get(msgs[0].offerteId);
      if (!offerte) continue;

      // Create thread
      const unreadByBedrijf = msgs.filter(
        (m) => m.sender === "klant" && !m.isRead
      ).length;
      const unreadByKlant = msgs.filter(
        (m) => m.sender === "bedrijf" && !m.isRead
      ).length;
      const lastMsg = msgs.sort((a, b) => b.createdAt - a.createdAt)[0];

      const threadId = await ctx.db.insert("chat_threads", {
        type: "klant",
        klantId: offerte.klantId,
        offerteId: offerte._id,
        participants: [],
        lastMessageAt: lastMsg?.createdAt,
        lastMessagePreview: lastMsg?.message?.substring(0, 80),
        unreadByBedrijf,
        unreadByKlant,
        companyUserId: offerte.userId,
        createdAt: msgs.sort((a, b) => a.createdAt - b.createdAt)[0].createdAt,
      });
      threadsCreated++;

      // Migrate messages
      for (const msg of msgs) {
        await ctx.db.insert("chat_messages", {
          threadId,
          senderType: msg.sender,
          senderUserId: "",
          senderName: msg.sender === "bedrijf" ? "Top Tuinen" : (offerte.klant?.naam ?? "Klant"),
          message: msg.message,
          isRead: msg.isRead,
          createdAt: msg.createdAt,
        });
        messagesMigrated++;
      }
    }

    console.log(`Migrated offerte_messages: ${threadsCreated} threads, ${messagesMigrated} messages`);
    return { threadsCreated, messagesMigrated };
  },
});

// Migrate team_messages → chat_threads + chat_messages
export const migrateTeamMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("team_messages").collect();

    // Group by company + channel
    const byChannel = new Map<string, typeof messages>();
    for (const msg of messages) {
      const key = `${msg.companyId}_${msg.channelType}_${msg.channelName}`;
      if (!byChannel.has(key)) byChannel.set(key, []);
      byChannel.get(key)!.push(msg);
    }

    let threadsCreated = 0;
    let messagesMigrated = 0;

    for (const [, msgs] of byChannel) {
      const lastMsg = msgs.sort((a, b) => b.createdAt - a.createdAt)[0];
      const firstMsg = msgs.sort((a, b) => a.createdAt - b.createdAt)[0];

      const threadId = await ctx.db.insert("chat_threads", {
        type: "team",
        channelName: firstMsg.channelName,
        projectId: firstMsg.projectId,
        participants: [...new Set(msgs.map((m) => m.senderClerkId))],
        lastMessageAt: lastMsg?.createdAt,
        lastMessagePreview: lastMsg?.message?.substring(0, 80),
        companyUserId: firstMsg.companyId,
        createdAt: firstMsg.createdAt,
      });
      threadsCreated++;

      for (const msg of msgs) {
        await ctx.db.insert("chat_messages", {
          threadId,
          senderType: "medewerker",
          senderUserId: msg.senderClerkId,
          senderName: msg.senderName,
          message: msg.message,
          attachmentStorageIds: msg.attachmentStorageId
            ? [msg.attachmentStorageId]
            : undefined,
          isRead: msg.isRead,
          createdAt: msg.createdAt,
        });
        messagesMigrated++;
      }
    }

    console.log(`Migrated team_messages: ${threadsCreated} threads, ${messagesMigrated} messages`);
    return { threadsCreated, messagesMigrated };
  },
});

// Migrate direct_messages → chat_threads + chat_messages
export const migrateDirectMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("direct_messages").collect();

    // Group by conversation pair (sorted clerkIds to deduplicate)
    const byConversation = new Map<string, typeof messages>();
    for (const msg of messages) {
      const pair = [msg.fromClerkId, msg.toClerkId].sort().join("_");
      const key = `${msg.companyId}_${pair}`;
      if (!byConversation.has(key)) byConversation.set(key, []);
      byConversation.get(key)!.push(msg);
    }

    let threadsCreated = 0;
    let messagesMigrated = 0;

    for (const [, msgs] of byConversation) {
      const lastMsg = msgs.sort((a, b) => b.createdAt - a.createdAt)[0];
      const firstMsg = msgs.sort((a, b) => a.createdAt - b.createdAt)[0];
      const participants = [...new Set([
        ...msgs.map((m) => m.fromClerkId),
        ...msgs.map((m) => m.toClerkId),
      ])];

      const threadId = await ctx.db.insert("chat_threads", {
        type: "direct",
        participants,
        lastMessageAt: lastMsg?.createdAt,
        lastMessagePreview: lastMsg?.message?.substring(0, 80),
        companyUserId: firstMsg.companyId,
        createdAt: firstMsg.createdAt,
      });
      threadsCreated++;

      for (const msg of msgs) {
        // Look up sender name from users table
        const sender = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", msg.fromClerkId))
          .first();

        await ctx.db.insert("chat_messages", {
          threadId,
          senderType: "medewerker",
          senderUserId: msg.fromClerkId,
          senderName: sender?.name ?? "Onbekend",
          message: msg.message,
          attachmentStorageIds: msg.attachmentStorageId
            ? [msg.attachmentStorageId]
            : undefined,
          isRead: msg.isRead,
          createdAt: msg.createdAt,
        });
        messagesMigrated++;
      }
    }

    console.log(`Migrated direct_messages: ${threadsCreated} threads, ${messagesMigrated} messages`);
    return { threadsCreated, messagesMigrated };
  },
});
```

- [ ] **Step 2: Verify compilation**

Run: `npx convex dev --once`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add convex/chatMigration.ts
git commit -m "feat(chat): add migration scripts for offerte_messages, team_messages, direct_messages"
```

---

## Phase 4: Portal Convex Functions

### Task 9: Portal queries and mutations

**Files:**
- Create: `convex/portaal.ts`

- [ ] **Step 1: Create `convex/portaal.ts` with queries**

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireKlant } from "./auth";

// Portal overview — KPIs + recent activity
export const getOverzicht = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const activeOffertes = offertes.filter(
      (o) => !o.deletedAt && !o.isArchived
    );

    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const visibleFacturen = facturen.filter((f) =>
      ["verzonden", "betaald", "vervallen"].includes(f.status)
    );

    const chatThreads = await ctx.db
      .query("chat_threads")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const unreadMessages = chatThreads.reduce(
      (sum, t) => sum + (t.unreadByKlant ?? 0),
      0
    );

    // Recent activity (last 10 items)
    const activity = [
      ...activeOffertes
        .filter((o) => o.status === "verzonden")
        .map((o) => ({
          type: "offerte" as const,
          title: `Nieuwe offerte: ${o.klant?.naam ? o.offerteNummer : o.offerteNummer}`,
          subtitle: o.offerteNummer,
          date: o.verzondenAt ?? o.createdAt,
          id: o._id,
        })),
      ...visibleFacturen
        .filter((f) => f.status === "verzonden")
        .map((f) => ({
          type: "factuur" as const,
          title: `Factuur: € ${f.totaalInclBtw?.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`,
          subtitle: f.factuurNummer,
          date: f.createdAt,
          id: f._id,
        })),
      ...chatThreads
        .filter((t) => (t.unreadByKlant ?? 0) > 0)
        .map((t) => ({
          type: "bericht" as const,
          title: `Bericht van Top Tuinen`,
          subtitle: t.lastMessagePreview ?? "",
          date: t.lastMessageAt ?? t.createdAt,
          id: t._id,
        })),
    ]
      .sort((a, b) => b.date - a.date)
      .slice(0, 10);

    return {
      kpis: {
        openOffertes: activeOffertes.filter((o) => o.status === "verzonden").length,
        lopendeProjecten: projecten.filter((p) => p.status === "in_uitvoering").length,
        openFacturen: visibleFacturen.filter((f) => f.status === "verzonden").length,
        nieuweBerichten: unreadMessages,
      },
      activity,
      klantNaam: klant.naam,
    };
  },
});

// List all offertes for this klant
export const getOffertes = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    return offertes
      .filter((o) => !o.deletedAt && !o.isArchived)
      .map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        type: o.type,
        status: o.status,
        totaalInclBtw: o.totalen?.totaalInclBtw,
        createdAt: o.createdAt,
        verzondenAt: o.verzondenAt,
        customerResponse: o.customerResponse,
        // Strip internal fields
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get single offerte detail for portal
export const getOfferte = query({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    const { klant } = await requireKlant(ctx);
    const offerte = await ctx.db.get(args.id);
    if (!offerte || offerte.klantId?.toString() !== klant._id.toString()) {
      return null;
    }

    // Return customer-visible fields only (same filtering as publicOffertes.getByToken)
    return {
      _id: offerte._id,
      offerteNummer: offerte.offerteNummer,
      type: offerte.type,
      status: offerte.status,
      klant: offerte.klant,
      scopes: offerte.scopes,
      regels: offerte.regels?.filter(
        (r) => r.type !== "arbeid"
      ),
      totalen: offerte.totalen
        ? {
            totaalExBtw: offerte.totalen.totaalExBtw,
            btw: offerte.totalen.btw,
            totaalInclBtw: offerte.totalen.totaalInclBtw,
          }
        : undefined,
      notities: offerte.notities,
      createdAt: offerte.createdAt,
      verzondenAt: offerte.verzondenAt,
      customerResponse: offerte.customerResponse,
    };
  },
});

// List projecten for this klant
export const getProjecten = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    // NOTE: projecten has no startDatum/verwachteOplevering fields
    // Dates can be derived from planningTaken in a follow-up
    return projecten
      .map((p) => ({
        _id: p._id,
        naam: p.naam,
        status: p.status,
        createdAt: p.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get single project detail
export const getProject = query({
  args: { id: v.id("projecten") },
  handler: async (ctx, args) => {
    const { klant } = await requireKlant(ctx);
    const project = await ctx.db.get(args.id);
    if (!project || project.klantId?.toString() !== klant._id.toString()) {
      return null;
    }

    // Get linked offerte for scope info
    let scopes: string[] = [];
    if (project.offerteId) {
      const offerte = await ctx.db.get(project.offerteId);
      scopes = offerte?.scopes ?? [];
    }

    // NOTE: no startDatum/verwachteOplevering on projecten table
    return {
      _id: project._id,
      naam: project.naam,
      status: project.status,
      scopes,
      createdAt: project.createdAt,
    };
  },
});

// List facturen for this klant (only customer-visible statuses)
export const getFacturen = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    // NOTE: field is factuurnummer (lowercase), betaaldAt (not betaaldOp)
    // No molliePaymentUrl on facturen — payment links via betalingen table
    const visibleFacturen = facturen
      .filter((f) => ["verzonden", "betaald", "vervallen"].includes(f.status));

    // Look up payment links from betalingen table for unpaid facturen
    const result = await Promise.all(
      visibleFacturen.map(async (f) => {
        let paymentUrl: string | undefined;
        if (f.status === "verzonden") {
          const betaling = await ctx.db
            .query("betalingen")
            .withIndex("by_factuur", (q) => q.eq("factuurId", f._id))
            .first();
          paymentUrl = betaling?.checkoutUrl;
        }
        return {
          _id: f._id,
          factuurnummer: f.factuurnummer,
          status: f.status,
          totaalInclBtw: f.totaalInclBtw,
          vervaldatum: f.vervaldatum,
          betaaldAt: f.betaaldAt,
          createdAt: f.createdAt,
          paymentUrl,
        };
      })
    );

    return result.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Respond to offerte (accept/reject with signature)
export const respondToOfferte = mutation({
  args: {
    offerteId: v.id("offertes"),
    status: v.union(v.literal("geaccepteerd"), v.literal("afgewezen")),
    comment: v.optional(v.string()),
    signature: v.optional(v.string()),
    selectedOptionalRegelIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { klant } = await requireKlant(ctx);
    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte || offerte.klantId?.toString() !== klant._id.toString()) {
      throw new Error("Offerte niet gevonden");
    }
    if (offerte.status !== "verzonden") {
      throw new Error("Deze offerte kan niet meer worden beantwoord");
    }
    if (args.status === "geaccepteerd" && !args.signature) {
      throw new Error("Een handtekening is verplicht bij acceptatie");
    }

    // Update offerte status and customerResponse
    await ctx.db.patch(args.offerteId, {
      status: args.status === "geaccepteerd" ? "geaccepteerd" : "afgewezen",
      customerResponse: {
        status: args.status,
        comment: args.comment,
        respondedAt: Date.now(),
        viewedAt: offerte.customerResponse?.viewedAt ?? Date.now(),
        signature: args.signature,
        signedAt: args.signature ? Date.now() : undefined,
        selectedOptionalRegelIds: args.selectedOptionalRegelIds,
      },
    });

    return { success: true };
  },
});

// Get all downloadable documents grouped by offerte/project
export const getDocumenten = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const visibleOffertes = offertes.filter(
      (o) => !o.deletedAt && !o.isArchived && o.status !== "concept"
    );
    const visibleFacturen = facturen.filter((f) =>
      ["verzonden", "betaald", "vervallen"].includes(f.status)
    );

    return {
      offertes: visibleOffertes.map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        type: o.type,
        createdAt: o.createdAt,
      })),
      facturen: visibleFacturen.map((f) => ({
        _id: f._id,
        factuurnummer: f.factuurnummer,
        createdAt: f.createdAt,
      })),
    };
  },
});

// Update klant profile
export const updateProfile = mutation({
  args: {
    naam: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    adres: v.optional(v.string()),
    postcode: v.optional(v.string()),
    plaats: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { klant } = await requireKlant(ctx);

    const updates: Record<string, string> = {};
    if (args.naam !== undefined) updates.naam = args.naam;
    if (args.telefoon !== undefined) updates.telefoon = args.telefoon;
    if (args.adres !== undefined) updates.adres = args.adres;
    if (args.postcode !== undefined) updates.postcode = args.postcode;
    if (args.plaats !== undefined) updates.plaats = args.plaats;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(klant._id, { ...updates, updatedAt: Date.now() });
    }
  },
});
```

- [ ] **Step 2: Verify compilation**

Run: `npx convex dev --once`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add convex/portaal.ts
git commit -m "feat(portaal): add all portal queries and mutations"
```

---

## Phase 5: Portal UI

### Task 10: Portal layout, theme provider, and navigation

**Files:**
- Create: `src/components/portaal/portaal-theme-provider.tsx`
- Create: `src/components/portaal/portaal-header.tsx`
- Create: `src/components/portaal/portaal-nav.tsx`
- Create: `src/app/(portaal)/layout.tsx`

- [ ] **Step 1: Create theme provider**

Create `src/components/portaal/portaal-theme-provider.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
}>({
  theme: "light",
  toggleTheme: () => {},
});

export function usePortaalTheme() {
  return useContext(ThemeContext);
}

export function PortaalThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("portaal-theme") as Theme | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("portaal-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 2: Create header component**

Create `src/components/portaal/portaal-header.tsx`:

```tsx
"use client";

import { UserButton } from "@clerk/nextjs";
import { Sun, Moon, Menu } from "lucide-react";
import { usePortaalTheme } from "./portaal-theme-provider";
import { Button } from "@/components/ui/button";

interface PortaalHeaderProps {
  klantNaam?: string;
  onMenuToggle?: () => void;
}

export function PortaalHeader({ klantNaam, onMenuToggle }: PortaalHeaderProps) {
  const { theme, toggleTheme } = usePortaalTheme();

  return (
    <header className="bg-[#1a2e1a] dark:bg-[#0a150a] px-4 md:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-white hover:bg-[#2a3e2a]"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="bg-[#4ADE80] w-8 h-8 rounded-lg flex items-center justify-center font-bold text-black text-sm">
          TT
        </div>
        <span className="text-white font-semibold text-base">Top Tuinen</span>
        <span className="text-[#4ADE80] text-xs opacity-70 hidden sm:inline">
          Klantenportaal
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-gray-300 hover:text-white hover:bg-[#2a3e2a]"
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
        {klantNaam && (
          <span className="text-gray-300 text-sm hidden sm:inline">
            {klantNaam}
          </span>
        )}
        <UserButton afterSignOutUrl="/portaal/inloggen" />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create navigation component**

Create `src/components/portaal/portaal-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Receipt,
  MessageSquare,
  Download,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/portaal/overzicht", label: "Overzicht", icon: LayoutDashboard },
  { href: "/portaal/offertes", label: "Offertes", icon: FileText },
  { href: "/portaal/projecten", label: "Projecten", icon: FolderOpen },
  { href: "/portaal/facturen", label: "Facturen", icon: Receipt },
  { href: "/portaal/chat", label: "Berichten", icon: MessageSquare, badgeKey: "messages" as const },
  { href: "/portaal/documenten", label: "Documenten", icon: Download },
];

interface PortaalNavProps {
  unreadMessages?: number;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function PortaalNav({ unreadMessages, mobileOpen, onMobileClose }: PortaalNavProps) {
  const pathname = usePathname();

  // Desktop horizontal nav
  const desktopNav = (
    <nav className="hidden md:flex bg-white dark:bg-[#1a2e1a] border-b border-gray-200 dark:border-[#2a3e2a] px-6">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm transition-colors border-b-2",
              isActive
                ? "text-[#1a2e1a] dark:text-[#4ADE80] border-[#4ADE80] font-semibold"
                : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            {item.label}
            {item.badgeKey === "messages" && unreadMessages && unreadMessages > 0 ? (
              <Badge className="bg-[#4ADE80] text-black text-[10px] h-[18px] min-w-[18px] flex items-center justify-center rounded-full px-1">
                {unreadMessages}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  // Mobile slide-out menu
  const mobileNav = (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-72 bg-[#1a2e1a] z-50 transform transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#2a3e2a]">
          <div className="flex items-center gap-2">
            <div className="bg-[#4ADE80] w-7 h-7 rounded-md flex items-center justify-center font-bold text-black text-xs">
              TT
            </div>
            <span className="text-white font-semibold text-sm">Top Tuinen</span>
          </div>
          <button onClick={onMobileClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="py-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-3 px-5 py-3.5 text-sm transition-colors",
                  isActive
                    ? "text-[#4ADE80] font-semibold border-l-3 border-[#4ADE80]"
                    : "text-gray-300 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.badgeKey === "messages" && unreadMessages && unreadMessages > 0 ? (
                  <Badge className="bg-[#4ADE80] text-black text-[10px] h-[18px] ml-auto">
                    {unreadMessages}
                  </Badge>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );

  return (
    <>
      {desktopNav}
      {mobileNav}
    </>
  );
}
```

- [ ] **Step 4: Create portal layout**

Create `src/app/(portaal)/layout.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PortaalThemeProvider } from "@/components/portaal/portaal-theme-provider";
import { PortaalHeader } from "@/components/portaal/portaal-header";
import { PortaalNav } from "@/components/portaal/portaal-nav";

export default function PortaalLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const overzicht = useQuery(api.portaal.getOverzicht);
  const unreadCounts = useQuery(api.chatThreads.getUnreadCounts);

  return (
    <PortaalThemeProvider>
      <div className="min-h-screen bg-[#f8faf8] dark:bg-[#0a0f0a]">
        <PortaalHeader
          klantNaam={overzicht?.klantNaam}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <PortaalNav
          unreadMessages={unreadCounts?.total}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <main className="p-4 md:p-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </PortaalThemeProvider>
  );
}
```

- [ ] **Step 5: Verify typecheck**

Run: `npm run typecheck`
Expected: No errors (or only pre-existing ones unrelated to portal).

- [ ] **Step 6: Commit**

```bash
git add src/components/portaal/ src/app/\(portaal\)/layout.tsx
git commit -m "feat(portaal): add portal layout, header, navigation, and theme provider"
```

---

### Task 11: Overzicht (home) page

**Files:**
- Create: `src/components/portaal/portaal-kpi-cards.tsx`
- Create: `src/components/portaal/portaal-activity-feed.tsx`
- Create: `src/app/(portaal)/overzicht/page.tsx`

- [ ] **Step 1: Create KPI cards component**

Create `src/components/portaal/portaal-kpi-cards.tsx`:

```tsx
import { FileText, FolderOpen, Receipt, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";

interface KpiData {
  openOffertes: number;
  lopendeProjecten: number;
  openFacturen: number;
  nieuweBerichten: number;
}

export function PortaalKpiCards({ data }: { data: KpiData }) {
  const items = [
    { label: "Openstaande offertes", value: data.openOffertes, icon: FileText, color: "text-[#1a2e1a] dark:text-white" },
    { label: "Lopende projecten", value: data.lopendeProjecten, icon: FolderOpen, color: "text-[#4ADE80]" },
    { label: "Openstaande facturen", value: data.openFacturen, icon: Receipt, color: "text-[#F59E0B]" },
    { label: "Nieuwe berichten", value: data.nieuweBerichten, icon: MessageSquare, color: "text-[#60A5FA]" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="p-4 bg-white dark:bg-[#1a2e1a] border-gray-200 dark:border-[#2a3e2a]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {item.label}
              </span>
              <Icon className="h-4 w-4 text-gray-400" />
            </div>
            <div className={`text-2xl md:text-3xl font-bold ${item.color}`}>
              {item.value}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create activity feed component**

Create `src/components/portaal/portaal-activity-feed.tsx`:

```tsx
import { Card } from "@/components/ui/card";

interface ActivityItem {
  type: "offerte" | "factuur" | "bericht";
  title: string;
  subtitle: string;
  date: number;
  id: string;
}

const dotColors = {
  offerte: "bg-[#4ADE80]",
  factuur: "bg-[#F59E0B]",
  bericht: "bg-[#60A5FA]",
};

export function PortaalActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="p-6 bg-white dark:bg-[#1a2e1a] border-gray-200 dark:border-[#2a3e2a]">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Geen recente activiteit.
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-[#1a2e1a] border-gray-200 dark:border-[#2a3e2a]">
      <div className="p-5 pb-3">
        <h3 className="text-[15px] font-semibold text-[#1a2e1a] dark:text-white">
          Recente activiteit
        </h3>
      </div>
      <div className="px-5 pb-5">
        {items.map((item, i) => (
          <div
            key={`${item.type}-${item.id}`}
            className={`flex items-start gap-3 py-3 ${
              i < items.length - 1 ? "border-b border-gray-100 dark:border-[#2a3e2a]" : ""
            }`}
          >
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColors[item.type]}`} />
            <div>
              <p className="text-sm text-gray-800 dark:text-gray-200">{item.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {item.subtitle} &middot;{" "}
                {new Date(item.date).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Create overzicht page**

Create `src/app/(portaal)/overzicht/page.tsx`:

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PortaalKpiCards } from "@/components/portaal/portaal-kpi-cards";
import { PortaalActivityFeed } from "@/components/portaal/portaal-activity-feed";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortaalOverzichtPage() {
  const overzicht = useQuery(api.portaal.getOverzicht);

  if (!overzicht) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#1a2e1a] dark:text-white">
          Welkom, {overzicht.klantNaam}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Hier vindt u een overzicht van uw tuinprojecten bij Top Tuinen.
        </p>
      </div>

      <PortaalKpiCards data={overzicht.kpis} />
      <PortaalActivityFeed items={overzicht.activity} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/portaal/portaal-kpi-cards.tsx src/components/portaal/portaal-activity-feed.tsx src/app/\(portaal\)/overzicht/
git commit -m "feat(portaal): add overzicht page with KPI cards and activity feed"
```

---

### Task 12: Offertes pages (list + detail)

**Files:**
- Create: `src/components/portaal/portaal-offerte-card.tsx`
- Create: `src/app/(portaal)/offertes/page.tsx`
- Create: `src/app/(portaal)/offertes/[id]/page.tsx`

This task creates the offertes list page with status cards and a detail page that reuses the existing signature pad and offerte response logic. The detail page allows klanten to view line items, select optional regels, and accept/reject with signature.

- [ ] **Step 1: Create offerte card component**

Create `src/components/portaal/portaal-offerte-card.tsx` — card with offerte name, status badge, amount, and action buttons (Bekijken & Reageren, PDF Downloaden, Vraag stellen). Status badge colors: Wacht op reactie = amber, Geaccepteerd = green, Afgewezen = red. Afgewezen cards get opacity-60.

- [ ] **Step 2: Create offertes list page**

Create `src/app/(portaal)/offertes/page.tsx` — uses `useQuery(api.portaal.getOffertes)`, renders `PortaalOfferteCard` per offerte, shows empty state if none.

- [ ] **Step 3: Create offerte detail page**

Create `src/app/(portaal)/offertes/[id]/page.tsx` — uses `useQuery(api.portaal.getOfferte, { id })`, displays line items grouped by scope (same filtering logic as public offerte page: hide arbeid, group kleinmateriaal), optional regel checkboxes, signature pad for acceptance, comment field for rejection. Uses `useMutation(api.portaal.respondToOfferte)`.

- [ ] **Step 4: Commit**

```bash
git add src/components/portaal/portaal-offerte-card.tsx src/app/\(portaal\)/offertes/
git commit -m "feat(portaal): add offertes list and detail pages"
```

---

### Task 13: Projecten pages (list + detail)

**Files:**
- Create: `src/components/portaal/portaal-project-progress.tsx`
- Create: `src/app/(portaal)/projecten/page.tsx`
- Create: `src/app/(portaal)/projecten/[id]/page.tsx`

- [ ] **Step 1: Create progress bar component**

Create `src/components/portaal/portaal-project-progress.tsx` — visual phase progress bar. Takes scopes array and project status. Each scope = one segment. Colors: green = afgerond, yellow = in uitvoering, grey = nog te doen.

- [ ] **Step 2: Create projecten list page**

Create `src/app/(portaal)/projecten/page.tsx` — uses `useQuery(api.portaal.getProjecten)`, card per project with status badge and date.

- [ ] **Step 3: Create project detail page**

Create `src/app/(portaal)/projecten/[id]/page.tsx` — uses `useQuery(api.portaal.getProject)`, progress bar, planning card (startdatum, verwachte oplevering), quick action buttons (bericht sturen, documenten bekijken).

- [ ] **Step 4: Commit**

```bash
git add src/components/portaal/portaal-project-progress.tsx src/app/\(portaal\)/projecten/
git commit -m "feat(portaal): add projecten list and detail pages with progress bar"
```

---

### Task 14: Facturen page

**Files:**
- Create: `src/components/portaal/portaal-factuur-card.tsx`
- Create: `src/app/(portaal)/facturen/page.tsx`
- Create: `src/app/(portaal)/facturen/[id]/page.tsx`

- [ ] **Step 1: Create factuur card component**

Create `src/components/portaal/portaal-factuur-card.tsx` — card with factuur number, mapped status badge (verzonden→"Openstaand", betaald→"Betaald", vervallen→"Vervallen"), amount, "Betalen" button for verzonden (links to `molliePaymentUrl`), "PDF" button for betaald.

- [ ] **Step 2: Create facturen list and detail pages**

Create `src/app/(portaal)/facturen/page.tsx` and `src/app/(portaal)/facturen/[id]/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/portaal/portaal-factuur-card.tsx src/app/\(portaal\)/facturen/
git commit -m "feat(portaal): add facturen list and detail pages"
```

---

### Task 15: Portal chat page

**Files:**
- Create: `src/components/portaal/portaal-chat-thread-list.tsx`
- Create: `src/components/portaal/portaal-chat-messages.tsx`
- Create: `src/app/(portaal)/chat/page.tsx`

- [ ] **Step 1: Create thread list component**

Create `src/components/portaal/portaal-chat-thread-list.tsx` — sidebar with threads per offerte/project. Shows offerte nummer, last message preview, timestamp. Active thread has green left border + green background tint.

- [ ] **Step 2: Create messages component**

Create `src/components/portaal/portaal-chat-messages.tsx` — message display with TT avatar for bedrijf messages (left-aligned), klant messages right-aligned with dark green background. Text-only input bar with "Verstuur" button. Uses `useMutation(api.chatThreads.sendMessage)` and `useMutation(api.chatThreads.markAsRead)`.

- [ ] **Step 3: Create chat page**

Create `src/app/(portaal)/chat/page.tsx` — split layout: thread list left (260px), messages right. On mobile: thread list full-width, tap to open conversation. Uses `useQuery(api.chatThreads.listThreads)` and `useQuery(api.chatThreads.listMessages, { threadId })`.

- [ ] **Step 4: Commit**

```bash
git add src/components/portaal/portaal-chat-thread-list.tsx src/components/portaal/portaal-chat-messages.tsx src/app/\(portaal\)/chat/
git commit -m "feat(portaal): add chat page with thread list and message display"
```

---

### Task 16: Documenten page

**Files:**
- Create: `src/app/(portaal)/documenten/page.tsx`

- [ ] **Step 1: Create documenten page**

Create `src/app/(portaal)/documenten/page.tsx` — groups documents by offerte/project. Lists available PDFs (offerte PDF, factuur PDF) with download icons (Lucide `Download`). Uses portal queries to get offertes and facturen, generates PDF download links using existing PDF generation infrastructure.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(portaal\)/documenten/
git commit -m "feat(portaal): add documenten page with PDF downloads"
```

---

### Task 17: Profiel page

**Files:**
- Create: `src/app/(portaal)/profiel/page.tsx`

- [ ] **Step 1: Create profiel page**

Create `src/app/(portaal)/profiel/page.tsx`:
- Personal details card (naam, telefoon, adres, postcode, plaats) — editable via form, uses `useMutation(api.portaal.updateProfile)`. Email is read-only.
- Security card with Clerk `<UserProfile />` component embedded for 2FA and password management.
- Dark mode toggle with Lucide Sun/Moon and toggle switch, using `usePortaalTheme()`.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(portaal\)/profiel/
git commit -m "feat(portaal): add profiel page with personal details and security settings"
```

---

## Phase 6: Dashboard Unified Inbox

### Task 18: Update dashboard chat to unified inbox

**Files:**
- Modify: `src/app/(dashboard)/chat/page.tsx`

- [ ] **Step 1: Update dashboard chat page**

Refactor `src/app/(dashboard)/chat/page.tsx` to:
- Replace existing team_messages/direct_messages queries with `useQuery(api.chatThreads.listThreads)`
- Add filter tabs: Alle | Klanten | Team | Direct
- Add green KLANT badge and blue TEAM badge per thread type
- Klant threads show offerte context (offerte nummer + type)
- Unread badge count per thread
- Use `useQuery(api.chatThreads.listMessages, { threadId })` for message display
- Use `useMutation(api.chatThreads.sendMessage)` for sending
- Keep existing UI structure (sidebar + chat area) but update data source

- [ ] **Step 2: Verify no type errors**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/chat/
git commit -m "feat(chat): update dashboard chat to unified inbox with klant/team threads"
```

---

### Task 19: Add "Portaal activeren" to klant detail

**Files:**
- Modify: `src/app/(dashboard)/klanten/page.tsx`

- [ ] **Step 1: Add portal activation button**

In the klant detail view/dialog on the klanten page, add:
- "Portaal activeren" button (disabled if no email, with tooltip "Voeg eerst een e-mailadres toe")
- "Portaal deactiveren" button (if already active)
- Portal status indicator: "Actief" badge if `portalEnabled && clerkUserId`, "Uitgenodigd" if `portalEnabled && !clerkUserId`, nothing if not enabled
- Uses `useMutation(api.klanten.activatePortal)` and `useMutation(api.klanten.deactivatePortal)`

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/klanten/
git commit -m "feat(portaal): add portal activation button to klant detail"
```

---

### Task 19b: Filter klant users from medewerkers page

**Files:**
- Modify: `convex/medewerkers.ts` or `convex/users.ts` (whichever backs the medewerkers page query)

- [ ] **Step 1: Exclude klant role from medewerkers list query**

In the query that powers the `/dashboard/medewerkers` page, add a filter to exclude users with `role === "klant"`. This prevents klant accounts from appearing in the medewerker management UI.

- [ ] **Step 2: Commit**

```bash
git commit -m "fix(medewerkers): filter out klant users from medewerkers page"
```

---

### Task 19c: Update lastLoginAt on portal page load

**Files:**
- Modify: `convex/portaal.ts`

- [ ] **Step 1: Add updateLastLogin mutation**

Add a mutation to `convex/portaal.ts` that updates `klanten.lastLoginAt`. Call this from the portal layout on mount (via `useMutation` in a `useEffect`).

```typescript
export const updateLastLogin = mutation({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);
    await ctx.db.patch(klant._id, { lastLoginAt: Date.now() });
  },
});
```

- [ ] **Step 2: Call from portal layout**

In `src/app/(portaal)/layout.tsx`, add a `useEffect` that calls `updateLastLogin` once on mount.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(portaal): track klant last login time"
```

---

## Phase 7: Email Notifications

### Task 20: Email templates

**Files:**
- Create: `src/emails/portaal-uitnodiging-email.tsx`
- Create: `src/emails/portaal-offerte-email.tsx`
- Create: `src/emails/portaal-bericht-email.tsx`
- Create: `src/emails/portaal-factuur-email.tsx`
- Create: `src/emails/portaal-project-email.tsx`

- [ ] **Step 1: Create all 5 email templates**

Follow the existing React Email pattern from `src/emails/factuur-email.tsx`:
- Exported component function with typed props
- Top Tuinen branded styling (green header, clean layout)
- Dutch text
- CTA button linking to the relevant portal page
- `server-only` directive

Each template: branded header, greeting, event description, CTA button, footer with "Top Tuinen" branding.

- [ ] **Step 2: Commit**

```bash
git add src/emails/portaal-*.tsx
git commit -m "feat(email): add 5 portal notification email templates"
```

---

### Task 21: Email notification triggers

**Files:**
- Create: `convex/portaalEmail.ts`

- [ ] **Step 1: Create email trigger functions**

Create `convex/portaalEmail.ts` with internal mutations/actions that are scheduled via `ctx.scheduler.runAfter()` from existing mutations:

- `sendInvitation(klantId, token)` — called from `klanten.activatePortal`
- `sendOfferteNotification(offerteId)` — called when offerte status → verzonden and klant has portal
- `sendMessageNotification(threadId)` — called from `chatThreads.sendMessage` when sender is bedrijf, debounced 5 min
- `sendFactuurNotification(factuurId)` — called when factuur is created/sent and klant has portal
- `sendProjectNotification(projectId, statusChange)` — called on project status change

Each function: looks up klant email, renders React Email template, sends via Resend.

- [ ] **Step 2: Wire triggers into existing mutations**

Add `ctx.scheduler.runAfter(0, internal.portaalEmail.sendXxx, { ... })` calls to:
- `convex/offertes.ts` — when status changes to "verzonden"
- `convex/chatThreads.ts` — in `sendMessage` when senderType is "bedrijf"
- `convex/facturen.ts` — when factuur is created/sent
- `convex/projecten.ts` — when status changes

Only schedule if klant has `portalEnabled === true`.

- [ ] **Step 3: Commit**

```bash
git add convex/portaalEmail.ts convex/offertes.ts convex/chatThreads.ts convex/facturen.ts convex/projecten.ts
git commit -m "feat(email): add portal email notification triggers"
```

---

## Phase 8: Integration & Cleanup

### Task 22: Run backfill migrations

- [ ] **Step 1: Run klantId backfill on projecten**

Via Convex dashboard or CLI, run:
```
npx convex run backfillKlantIds:backfillProjectenKlantId
```

- [ ] **Step 2: Run klantId backfill on facturen**

```
npx convex run backfillKlantIds:backfillFacturenKlantId
```

- [ ] **Step 3: Run orphaned offerte linking**

```
npx convex run backfillKlantIds:linkOrphanedOffertes
```

- [ ] **Step 4: Verify data integrity**

Check in Convex dashboard that projecten and facturen have populated `klantId` fields.

---

### Task 23: Run chat migration

- [ ] **Step 1: Run offerte_messages migration**

```
npx convex run chatMigration:migrateOfferteMessages
```

- [ ] **Step 2: Run team_messages migration**

```
npx convex run chatMigration:migrateTeamMessages
```

- [ ] **Step 3: Run direct_messages migration**

```
npx convex run chatMigration:migrateDirectMessages
```

- [ ] **Step 4: Verify chat data in Convex dashboard**

Check `chat_threads` and `chat_messages` tables have expected data.

---

### Task 24: End-to-end verification

- [ ] **Step 1: Verify portal auth flow**

1. Open `/portaal/overzicht` without login → redirects to `/portaal/inloggen`
2. Login as klant → redirected to `/portaal/overzicht`
3. Open `/dashboard` as klant → redirected to `/portaal/overzicht`

- [ ] **Step 2: Verify portal pages load data**

Navigate through all portal pages and verify data appears correctly.

- [ ] **Step 3: Verify unified inbox**

1. Send message from portal chat as klant
2. Check it appears in dashboard unified inbox with KLANT badge
3. Reply from dashboard
4. Check reply appears in portal chat

- [ ] **Step 4: Verify dark mode toggle**

Toggle dark mode in portal header and profile page. Verify colors switch correctly.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(portaal): complete klantenportaal integration and verification"
```
