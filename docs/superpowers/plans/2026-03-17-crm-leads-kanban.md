# CRM Leads Kanban Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Leads tab into a drag-and-drop kanban CRM board with activity log, offerte-koppeling, and automatic klant-conversie.

**Architecture:** Extend the existing `configuratorAanvragen` table with new pipeline fields (keeping backward compatibility via the `referentie` field for payments/public status). New `leadActiviteiten` table for activity timeline. Kanban UI built with `@dnd-kit` (already installed). Lead detail modal replaces the current Sheet component.

**Tech Stack:** Next.js 16, Convex (schema + functions), @dnd-kit/core@6.x + @dnd-kit/sortable@10.x, shadcn/ui, React 19, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-17-crm-leads-kanban-design.md`

---

## Chunk 1: Schema & Backend

### Task 1: Extend configuratorAanvragen schema with pipeline fields

**Files:**
- Modify: `convex/schema.ts` (configuratorAanvragen table definition)

- [ ] **Step 1: Add new fields to configuratorAanvragen table**

Add these fields to the existing `configuratorAanvragen` table in `convex/schema.ts`:

```typescript
// Add to configuratorAanvragen table definition:
pipelineStatus: v.optional(v.union(
  v.literal("nieuw"),
  v.literal("contact_gehad"),
  v.literal("offerte_verstuurd"),
  v.literal("gewonnen"),
  v.literal("verloren")
)),
bron: v.optional(v.union(
  v.literal("configurator_gazon"),
  v.literal("configurator_boomschors"),
  v.literal("configurator_verticuteren"),
  v.literal("handmatig"),
  v.literal("telefoon"),
  v.literal("email"),
  v.literal("doorverwijzing")
)),
verliesReden: v.optional(v.string()),
gekoppeldKlantId: v.optional(v.id("klanten")),
geschatteWaarde: v.optional(v.number()),
omschrijving: v.optional(v.string()),
```

Add new indexes:

```typescript
.index("by_pipeline_status", ["pipelineStatus"])
.index("by_gekoppeld_klant", ["gekoppeldKlantId"])
```

Keep all existing fields and indexes (`by_status`, `by_type`, `by_referentie`) intact.

- [ ] **Step 2: Run `npx convex dev` to verify schema syncs**

Run: `npx convex dev --once`
Expected: Schema syncs without errors

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): add pipeline fields to configuratorAanvragen"
```

### Task 2: Create leadActiviteiten table

**Files:**
- Modify: `convex/schema.ts` (add new table)

- [ ] **Step 1: Add leadActiviteiten table definition**

Add after the `configuratorAanvragen` table in `convex/schema.ts`:

```typescript
leadActiviteiten: defineTable({
  leadId: v.id("configuratorAanvragen"),
  type: v.union(
    v.literal("status_wijziging"),
    v.literal("notitie"),
    v.literal("toewijzing"),
    v.literal("offerte_gekoppeld"),
    v.literal("aangemaakt")
  ),
  beschrijving: v.string(),
  gebruikerId: v.optional(v.id("users")),
  metadata: v.optional(v.any()),
  createdAt: v.number(),
}).index("by_lead", ["leadId", "createdAt"]),
```

Note: `gebruikerId` is optional because configurator-created leads have no user context.

- [ ] **Step 2: Run `npx convex dev` to verify schema syncs**

Run: `npx convex dev --once`
Expected: Schema syncs without errors

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): add leadActiviteiten table"
```

### Task 3: Add leadId field to offertes table

**Files:**
- Modify: `convex/schema.ts` (offertes table definition)

- [ ] **Step 1: Add optional leadId field and index to offertes**

In the `offertes` table definition, add:

```typescript
leadId: v.optional(v.id("configuratorAanvragen")),
```

Add index:

```typescript
.index("by_lead", ["leadId"])
```

- [ ] **Step 2: Run `npx convex dev` to verify schema syncs**

Run: `npx convex dev --once`
Expected: Schema syncs without errors

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): add leadId to offertes table"
```

### Task 4: Create leadActiviteiten Convex functions

**Files:**
- Create: `convex/leadActiviteiten.ts`

- [ ] **Step 1: Create the leadActiviteiten functions file**

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listByLead = query({
  args: { leadId: v.id("configuratorAanvragen") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leadActiviteiten")
      .withIndex("by_lead", (q) => q.eq("leadId", args.leadId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    leadId: v.id("configuratorAanvragen"),
    type: v.union(
      v.literal("status_wijziging"),
      v.literal("notitie"),
      v.literal("toewijzing"),
      v.literal("offerte_gekoppeld"),
      v.literal("aangemaakt")
    ),
    beschrijving: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    let gebruikerId;
    if (identity) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .unique();
      gebruikerId = user?._id;
    }

    return await ctx.db.insert("leadActiviteiten", {
      leadId: args.leadId,
      type: args.type,
      beschrijving: args.beschrijving,
      gebruikerId,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});
```

- [ ] **Step 2: Run `npx convex dev` to verify functions sync**

Run: `npx convex dev --once`
Expected: Functions sync without errors

- [ ] **Step 3: Commit**

```bash
git add convex/leadActiviteiten.ts
git commit -m "feat: add leadActiviteiten Convex functions"
```

### Task 5: Add pipeline queries to configuratorAanvragen

**Files:**
- Modify: `convex/configuratorAanvragen.ts`

- [ ] **Step 1: Add listByPipeline query**

Add to `convex/configuratorAanvragen.ts`:

```typescript
export const listByPipeline = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niet geautoriseerd");

    const all = await ctx.db.query("configuratorAanvragen").collect();

    // Group by pipelineStatus, fallback to mapping old status
    const grouped: Record<string, typeof all> = {
      nieuw: [],
      contact_gehad: [],
      offerte_verstuurd: [],
      gewonnen: [],
      verloren: [],
    };

    for (const lead of all) {
      const status = lead.pipelineStatus ?? mapOldStatus(lead.status);
      if (grouped[status]) {
        grouped[status].push(lead);
      }
    }

    return grouped;
  },
});

export const pipelineStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niet geautoriseerd");

    const all = await ctx.db.query("configuratorAanvragen").collect();

    let totaalLeads = 0;
    let pipelineWaarde = 0;
    let gewonnenWaarde = 0;
    let gewonnenCount = 0;
    let verlorenCount = 0;

    const now = new Date();
    const startVanMaand = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    for (const lead of all) {
      const status = lead.pipelineStatus ?? mapOldStatus(lead.status);
      const waarde = lead.definitievePrijs ?? lead.geschatteWaarde ?? lead.indicatiePrijs;

      if (status !== "gewonnen" && status !== "verloren") {
        totaalLeads++;
        pipelineWaarde += waarde;
      }

      if (status === "gewonnen") {
        gewonnenCount++;
        if (lead.updatedAt >= startVanMaand) {
          gewonnenWaarde += waarde;
        }
      }

      if (status === "verloren") {
        verlorenCount++;
      }
    }

    const conversieRatio = (gewonnenCount + verlorenCount) > 0
      ? Math.round((gewonnenCount / (gewonnenCount + verlorenCount)) * 100)
      : 0;

    return { totaalLeads, pipelineWaarde, gewonnenWaarde, conversieRatio };
  },
});

// Helper: map old status to pipeline status for backward compat
function mapOldStatus(oldStatus: string): string {
  switch (oldStatus) {
    case "nieuw": return "nieuw";
    case "in_behandeling": return "contact_gehad";
    case "goedgekeurd": return "gewonnen";
    case "afgekeurd": return "verloren";
    case "voltooid": return "gewonnen";
    default: return "nieuw";
  }
}
```

- [ ] **Step 2: Run `npx convex dev` to verify**

Run: `npx convex dev --once`
Expected: Functions sync without errors

- [ ] **Step 3: Commit**

```bash
git add convex/configuratorAanvragen.ts
git commit -m "feat: add pipeline queries (listByPipeline, pipelineStats)"
```

### Task 6: Add pipeline mutations to configuratorAanvragen

**Files:**
- Modify: `convex/configuratorAanvragen.ts`

- [ ] **Step 1: Add updatePipelineStatus mutation**

```typescript
export const updatePipelineStatus = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
    pipelineStatus: v.union(
      v.literal("nieuw"),
      v.literal("contact_gehad"),
      v.literal("offerte_verstuurd"),
      v.literal("gewonnen"),
      v.literal("verloren")
    ),
    verliesReden: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niet geautoriseerd");

    const lead = await ctx.db.get(args.id);
    if (!lead) throw new Error("Lead niet gevonden");

    const oudeStatus = lead.pipelineStatus ?? mapOldStatus(lead.status);

    // Validate transition rules
    if (oudeStatus === "gewonnen") {
      throw new Error("Gewonnen leads kunnen niet teruggezet worden");
    }

    if (args.pipelineStatus === "verloren" && !args.verliesReden) {
      throw new Error("Verliesreden is verplicht");
    }

    const updates: Record<string, unknown> = {
      pipelineStatus: args.pipelineStatus,
      updatedAt: Date.now(),
    };

    if (args.pipelineStatus === "verloren") {
      updates.verliesReden = args.verliesReden;
    }

    // Clear verliesReden when reopening from verloren
    if (oudeStatus === "verloren" && args.pipelineStatus === "nieuw") {
      updates.verliesReden = undefined;
    }

    await ctx.db.patch(args.id, updates);

    // Log activity
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    await ctx.db.insert("leadActiviteiten", {
      leadId: args.id,
      type: "status_wijziging",
      beschrijving: `Status gewijzigd: ${oudeStatus} → ${args.pipelineStatus}`,
      gebruikerId: user?._id,
      metadata: { van: oudeStatus, naar: args.pipelineStatus, verliesReden: args.verliesReden },
      createdAt: Date.now(),
    });
  },
});
```

- [ ] **Step 2: Add markGewonnen mutation**

```typescript
export const markGewonnen = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niet geautoriseerd");

    const lead = await ctx.db.get(args.id);
    if (!lead) throw new Error("Lead niet gevonden");
    if (!lead.klantNaam) throw new Error("Naam is verplicht voor conversie naar klant");

    const oudeStatus = lead.pipelineStatus ?? mapOldStatus(lead.status);

    // Check if klant already exists by email
    let klantId;
    if (lead.klantEmail) {
      const bestaandeKlant = await ctx.db
        .query("klanten")
        .filter((q) => q.eq(q.field("email"), lead.klantEmail))
        .first();
      klantId = bestaandeKlant?._id;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!klantId) {
      // Create new klant
      klantId = await ctx.db.insert("klanten", {
        userId: user!._id,
        naam: lead.klantNaam,
        adres: lead.klantAdres || "",
        postcode: lead.klantPostcode || "",
        plaats: lead.klantPlaats || "",
        email: lead.klantEmail || undefined,
        telefoon: lead.klantTelefoon || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("leadActiviteiten", {
        leadId: args.id,
        type: "status_wijziging",
        beschrijving: "Klant aangemaakt en gekoppeld",
        gebruikerId: user?._id,
        metadata: { van: oudeStatus, naar: "gewonnen", klantId },
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.insert("leadActiviteiten", {
        leadId: args.id,
        type: "status_wijziging",
        beschrijving: "Gekoppeld aan bestaande klant",
        gebruikerId: user?._id,
        metadata: { van: oudeStatus, naar: "gewonnen", klantId },
        createdAt: Date.now(),
      });
    }

    await ctx.db.patch(args.id, {
      pipelineStatus: "gewonnen",
      gekoppeldKlantId: klantId,
      updatedAt: Date.now(),
    });
  },
});
```

- [ ] **Step 3: Add createHandmatig mutation (authenticated)**

```typescript
export const createHandmatig = mutation({
  args: {
    klantNaam: v.string(),
    klantEmail: v.optional(v.string()),
    klantTelefoon: v.optional(v.string()),
    klantAdres: v.optional(v.string()),
    klantPostcode: v.optional(v.string()),
    klantPlaats: v.optional(v.string()),
    omschrijving: v.optional(v.string()),
    geschatteWaarde: v.optional(v.number()),
    bron: v.union(
      v.literal("handmatig"),
      v.literal("telefoon"),
      v.literal("email"),
      v.literal("doorverwijzing")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niet geautoriseerd");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    // Generate referentie
    const count = (await ctx.db.query("configuratorAanvragen").collect()).length;
    const referentie = `TOP-MAN-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

    const id = await ctx.db.insert("configuratorAanvragen", {
      type: "gazon", // placeholder for handmatige leads
      status: "nieuw",
      pipelineStatus: "nieuw",
      bron: args.bron,
      referentie,
      klantNaam: args.klantNaam,
      klantEmail: args.klantEmail ?? "",
      klantTelefoon: args.klantTelefoon ?? "",
      klantAdres: args.klantAdres ?? "",
      klantPostcode: args.klantPostcode ?? "",
      klantPlaats: args.klantPlaats ?? "",
      specificaties: {},
      indicatiePrijs: args.geschatteWaarde ?? 0,
      geschatteWaarde: args.geschatteWaarde,
      omschrijving: args.omschrijving,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.insert("leadActiviteiten", {
      leadId: id,
      type: "aangemaakt",
      beschrijving: `Lead handmatig aangemaakt (${args.bron})`,
      gebruikerId: user?._id,
      metadata: { bron: args.bron },
      createdAt: Date.now(),
    });

    return { id, referentie };
  },
});
```

- [ ] **Step 4: Update existing `create` mutation to set bron and pipelineStatus**

In the existing public `create` mutation, add these fields to the insert:

```typescript
pipelineStatus: "nieuw",
bron: type === "gazon" ? "configurator_gazon"
    : type === "boomschors" ? "configurator_boomschors"
    : "configurator_verticuteren",
```

Also add a leadActiviteiten entry:

```typescript
await ctx.db.insert("leadActiviteiten", {
  leadId: id,
  type: "aangemaakt",
  beschrijving: `Lead aangemaakt via ${type} configurator`,
  metadata: { bron: `configurator_${type}`, indicatiePrijs: args.indicatiePrijs },
  createdAt: Date.now(),
});
```

- [ ] **Step 5: Run `npx convex dev` to verify**

Run: `npx convex dev --once`
Expected: Functions sync without errors

- [ ] **Step 6: Commit**

```bash
git add convex/configuratorAanvragen.ts
git commit -m "feat: add pipeline mutations (updatePipelineStatus, markGewonnen, createHandmatig)"
```

### Task 7: Update existing toewijzen and addNotitie to log activities

**Files:**
- Modify: `convex/configuratorAanvragen.ts`

- [ ] **Step 1: Update toewijzen mutation to log activity**

In the existing `toewijzen` mutation handler, after the `ctx.db.patch(...)` call, add:

```typescript
const assignedUser = await ctx.db.get(args.toegewezenAan);
await ctx.db.insert("leadActiviteiten", {
  leadId: args.id,
  type: "toewijzing",
  beschrijving: `Toegewezen aan ${assignedUser?.name ?? "medewerker"}`,
  gebruikerId: user?._id,
  metadata: { toegewezenAan: args.toegewezenAan },
  createdAt: Date.now(),
});
```

- [ ] **Step 2: Update addNotitie mutation to log activity**

In the existing `addNotitie` mutation handler, after the `ctx.db.patch(...)` call, add:

```typescript
await ctx.db.insert("leadActiviteiten", {
  leadId: args.id,
  type: "notitie",
  beschrijving: args.notitie,
  gebruikerId: user?._id,
  createdAt: Date.now(),
});
```

- [ ] **Step 3: Run `npx convex dev` to verify**

Run: `npx convex dev --once`
Expected: Functions sync without errors

- [ ] **Step 4: Commit**

```bash
git add convex/configuratorAanvragen.ts
git commit -m "feat: log activities on toewijzen and addNotitie"
```

---

## Chunk 2: Kanban Board UI

### Task 8: Create KanbanBoard component

**Files:**
- Create: `src/components/leads/kanban-board.tsx`

- [ ] **Step 1: Create the kanban board component**

```tsx
"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { LeadCard } from "./lead-card";
import { VerliesRedenDialog } from "./verlies-reden-dialog";
import type { Id } from "../../../convex/_generated/dataModel";

type Lead = {
  _id: Id<"configuratorAanvragen">;
  klantNaam: string;
  klantEmail: string;
  klantTelefoon: string;
  klantAdres: string;
  klantPostcode: string;
  klantPlaats: string;
  type: string;
  status: string;
  pipelineStatus?: string;
  bron?: string;
  referentie: string;
  indicatiePrijs: number;
  geschatteWaarde?: number;
  definitievePrijs?: number;
  omschrijving?: string;
  toegewezenAan?: Id<"users">;
  verliesReden?: string;
  specificaties: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

type PipelineStatus = "nieuw" | "contact_gehad" | "offerte_verstuurd" | "gewonnen" | "verloren";

const COLUMNS: { id: PipelineStatus; label: string; color: string }[] = [
  { id: "nieuw", label: "Nieuw", color: "#3b82f6" },
  { id: "contact_gehad", label: "Contact gehad", color: "#f59e0b" },
  { id: "offerte_verstuurd", label: "Offerte verstuurd", color: "#8b5cf6" },
  { id: "gewonnen", label: "Gewonnen", color: "#10b981" },
  { id: "verloren", label: "Verloren", color: "#ef4444" },
];

function mapOldStatus(status: string): PipelineStatus {
  switch (status) {
    case "in_behandeling": return "contact_gehad";
    case "goedgekeurd": return "gewonnen";
    case "afgekeurd": return "verloren";
    case "voltooid": return "gewonnen";
    default: return "nieuw";
  }
}

export function KanbanBoard({
  leads,
  onLeadClick,
}: {
  leads: Record<string, Lead[]>;
  onLeadClick: (lead: Lead) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [verliesDialogOpen, setVerliesDialogOpen] = useState(false);
  const [pendingVerliesId, setPendingVerliesId] = useState<Id<"configuratorAanvragen"> | null>(null);

  const updatePipelineStatus = useMutation(api.configuratorAanvragen.updatePipelineStatus);
  const markGewonnen = useMutation(api.configuratorAanvragen.markGewonnen);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const activeLead = activeId
    ? Object.values(leads).flat().find((l) => l._id === activeId)
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as Id<"configuratorAanvragen">;
    const newStatus = over.id as PipelineStatus;

    // Find the lead's current status
    const lead = Object.values(leads).flat().find((l) => l._id === leadId);
    if (!lead) return;
    const currentStatus = (lead.pipelineStatus ?? mapOldStatus(lead.status)) as PipelineStatus;
    if (currentStatus === newStatus) return;

    // Block moving from gewonnen
    if (currentStatus === "gewonnen") {
      toast.error("Gewonnen leads kunnen niet teruggezet worden");
      return;
    }

    // Handle special transitions
    if (newStatus === "verloren") {
      setPendingVerliesId(leadId);
      setVerliesDialogOpen(true);
      return;
    }

    if (newStatus === "gewonnen") {
      try {
        await markGewonnen({ id: leadId });
        toast.success("Lead gewonnen — klant aangemaakt");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Fout bij markeren als gewonnen");
      }
      return;
    }

    try {
      await updatePipelineStatus({ id: leadId, pipelineStatus: newStatus });
      toast.success(`Status gewijzigd naar ${COLUMNS.find((c) => c.id === newStatus)?.label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fout bij statuswijziging");
    }
  };

  const handleVerliesBevestigd = async (reden: string) => {
    if (!pendingVerliesId) return;
    try {
      await updatePipelineStatus({
        id: pendingVerliesId,
        pipelineStatus: "verloren",
        verliesReden: reden,
      });
      toast.success("Lead gemarkeerd als verloren");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fout");
    } finally {
      setVerliesDialogOpen(false);
      setPendingVerliesId(null);
    }
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              color={col.color}
              leads={leads[col.id] ?? []}
              onLeadClick={onLeadClick}
              isLost={col.id === "verloren"}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead ? <LeadCard lead={activeLead} isDragOverlay /> : null}
        </DragOverlay>
      </DndContext>

      <VerliesRedenDialog
        open={verliesDialogOpen}
        onClose={() => {
          setVerliesDialogOpen(false);
          setPendingVerliesId(null);
        }}
        onBevestig={handleVerliesBevestigd}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/leads/kanban-board.tsx
git commit -m "feat: create KanbanBoard component with drag & drop"
```

### Task 9: Create KanbanColumn component

**Files:**
- Create: `src/components/leads/kanban-column.tsx`

- [ ] **Step 1: Create the column component**

```tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import { LeadCard } from "./lead-card";
import type { Id } from "../../../convex/_generated/dataModel";

type Lead = {
  _id: Id<"configuratorAanvragen">;
  klantNaam: string;
  type: string;
  status: string;
  pipelineStatus?: string;
  bron?: string;
  indicatiePrijs: number;
  geschatteWaarde?: number;
  createdAt: number;
  [key: string]: unknown;
};

export function KanbanColumn({
  id,
  label,
  color,
  leads,
  onLeadClick,
  isLost = false,
}: {
  id: string;
  label: string;
  color: string;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  isLost?: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[260px] rounded-xl border p-3 transition-colors ${
        isOver ? "bg-accent/50 border-primary" : "bg-card"
      } ${isLost ? "opacity-70" : ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-semibold">{label}</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: `${color}20`,
              color,
            }}
          >
            {leads.length}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {leads.map((lead) => (
          <LeadCard
            key={lead._id}
            lead={lead}
            onClick={() => onLeadClick(lead)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/leads/kanban-column.tsx
git commit -m "feat: create KanbanColumn droppable component"
```

### Task 10: Create LeadCard component

**Files:**
- Create: `src/components/leads/lead-card.tsx`

- [ ] **Step 1: Create the draggable lead card**

```tsx
"use client";

import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import type { Id } from "../../../convex/_generated/dataModel";

type Lead = {
  _id: Id<"configuratorAanvragen">;
  klantNaam: string;
  type: string;
  pipelineStatus?: string;
  bron?: string;
  indicatiePrijs: number;
  geschatteWaarde?: number;
  createdAt: number;
  [key: string]: unknown;
};

const typeLabels: Record<string, { label: string; className: string }> = {
  gazon: { label: "Gazon", className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300" },
  boomschors: { label: "Boomschors", className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300" },
  verticuteren: { label: "Verticuteren", className: "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/30 dark:text-lime-300" },
};

function formatRelativeDatum(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minuten = Math.floor(diff / 60000);
  const uren = Math.floor(diff / 3600000);
  const dagen = Math.floor(diff / 86400000);

  if (minuten < 60) return `${minuten} min geleden`;
  if (uren < 24) return `${uren} uur geleden`;
  if (dagen === 1) return "gisteren";
  if (dagen < 7) return `${dagen} dagen`;
  if (dagen < 30) return `${Math.floor(dagen / 7)} weken`;
  return `${Math.floor(dagen / 30)} maanden`;
}

function formatPrijs(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(bedrag);
}

export function LeadCard({
  lead,
  onClick,
  isDragOverlay = false,
}: {
  lead: Lead;
  onClick?: () => void;
  isDragOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead._id,
  });

  const isHandmatig = lead.bron === "handmatig" || lead.bron === "telefoon" || lead.bron === "email" || lead.bron === "doorverwijzing";
  const typeConfig = typeLabels[lead.type];
  const waarde = lead.geschatteWaarde ?? lead.indicatiePrijs;

  return (
    <div
      ref={!isDragOverlay ? setNodeRef : undefined}
      {...(!isDragOverlay ? { ...attributes, ...listeners } : {})}
      onClick={onClick}
      className={`rounded-lg border p-3 bg-background cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${
        isDragging ? "opacity-50" : ""
      } ${isDragOverlay ? "shadow-xl rotate-2" : ""} ${
        isHandmatig ? "border-l-[3px] border-l-purple-500" : ""
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm font-semibold truncate">{lead.klantNaam}</span>
        {isHandmatig ? (
          <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 text-[10px]">
            Handmatig
          </Badge>
        ) : typeConfig ? (
          <Badge variant="outline" className={`${typeConfig.className} text-[10px]`}>
            {typeConfig.label}
          </Badge>
        ) : null}
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-emerald-600">
          {formatPrijs(waarde)}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatRelativeDatum(lead.createdAt)}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/leads/lead-card.tsx
git commit -m "feat: create draggable LeadCard component"
```

### Task 11: Create VerliesRedenDialog component

**Files:**
- Create: `src/components/leads/verlies-reden-dialog.tsx`

- [ ] **Step 1: Create the loss reason dialog**

```tsx
"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function VerliesRedenDialog({
  open,
  onClose,
  onBevestig,
}: {
  open: boolean;
  onClose: () => void;
  onBevestig: (reden: string) => void;
}) {
  const [reden, setReden] = useState("");

  const handleBevestig = () => {
    if (!reden.trim()) return;
    onBevestig(reden.trim());
    setReden("");
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lead markeren als verloren</AlertDialogTitle>
          <AlertDialogDescription>
            Geef een reden op waarom deze lead verloren is.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          placeholder="Bijv. te duur, geen reactie, andere aanbieder gekozen..."
          value={reden}
          onChange={(e) => setReden(e.target.value)}
          rows={3}
        />
        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose}>Annuleren</Button>
          <Button
            variant="destructive"
            onClick={handleBevestig}
            disabled={!reden.trim()}
          >
            Markeer als verloren
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/leads/verlies-reden-dialog.tsx
git commit -m "feat: create VerliesRedenDialog component"
```

### Task 12: Create PipelineStats component

**Files:**
- Create: `src/components/leads/pipeline-stats.tsx`

- [ ] **Step 1: Create the stats bar**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

function formatPrijs(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(bedrag);
}

export function PipelineStats() {
  const stats = useQuery(api.configuratorAanvragen.pipelineStats);

  if (!stats) return null;

  return (
    <div className="bg-card border rounded-xl p-4 flex justify-around text-center">
      <div>
        <div className="text-xl font-bold">{stats.totaalLeads}</div>
        <div className="text-xs text-muted-foreground">Actieve leads</div>
      </div>
      <div className="border-l pl-6">
        <div className="text-xl font-bold text-emerald-600">{formatPrijs(stats.pipelineWaarde)}</div>
        <div className="text-xs text-muted-foreground">Pipeline waarde</div>
      </div>
      <div className="border-l pl-6">
        <div className="text-xl font-bold text-green-600">{formatPrijs(stats.gewonnenWaarde)}</div>
        <div className="text-xs text-muted-foreground">Gewonnen deze maand</div>
      </div>
      <div className="border-l pl-6">
        <div className="text-xl font-bold">{stats.conversieRatio}%</div>
        <div className="text-xs text-muted-foreground">Conversieratio</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/leads/pipeline-stats.tsx
git commit -m "feat: create PipelineStats component"
```

---

## Chunk 3: Lead Detail Modal & Nieuwe Lead Form

### Task 13: Create LeadDetailModal component

**Files:**
- Create: `src/components/leads/lead-detail-modal.tsx`

- [ ] **Step 1: Create the two-column detail modal**

Create the modal with left column (lead info, contactgegevens, specificaties, prijzen, offertes, toewijzing) and right column (activiteitenlog with timeline).

Key features:
- Header with naam, status badge, type badge, snelknop naar volgende status
- Contactgegevens with mailto/tel/Google Maps links
- Specificaties grid from configurator data
- Prijzen (indicatie + definitief)
- Offertes section with "Offerte aanmaken" button (links to `/offertes/nieuw/aanleg?leadId={id}`)
- Toewijzing section with medewerker selector
- Right column: notitie input + activity timeline with colored dots

Use `Dialog` from shadcn/ui (large size). Query `api.leadActiviteiten.listByLead` for timeline. Query `api.users.listUsersWithDetails` for toewijzing dropdown. Use mutations: `api.configuratorAanvragen.updatePipelineStatus`, `.toewijzen`, `api.leadActiviteiten.create` (for notes).

The component receives `lead` (full lead object or null) and `open`/`onClose` props.

This file will be ~300 lines. Implement the full component following the mockup design from the brainstorm session.

- [ ] **Step 2: Commit**

```bash
git add src/components/leads/lead-detail-modal.tsx
git commit -m "feat: create LeadDetailModal with info and activity timeline"
```

### Task 14: Create NieuweLeadDialog component

**Files:**
- Create: `src/components/leads/nieuwe-lead-dialog.tsx`

- [ ] **Step 1: Create the manual lead creation dialog**

```tsx
"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";

type Bron = "handmatig" | "telefoon" | "email" | "doorverwijzing";

export function NieuweLeadDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const createHandmatig = useMutation(api.configuratorAanvragen.createHandmatig);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    klantNaam: "",
    klantEmail: "",
    klantTelefoon: "",
    klantAdres: "",
    klantPostcode: "",
    klantPlaats: "",
    omschrijving: "",
    geschatteWaarde: "",
    bron: "handmatig" as Bron,
  });

  const resetForm = useCallback(() => {
    setFormData({
      klantNaam: "",
      klantEmail: "",
      klantTelefoon: "",
      klantAdres: "",
      klantPostcode: "",
      klantPlaats: "",
      omschrijving: "",
      geschatteWaarde: "",
      bron: "handmatig",
    });
  }, []);

  const handleSubmit = async () => {
    if (!formData.klantNaam.trim()) {
      toast.error("Naam is verplicht");
      return;
    }

    setIsSubmitting(true);
    try {
      const waarde = formData.geschatteWaarde
        ? parseFloat(formData.geschatteWaarde.replace(",", "."))
        : undefined;

      await createHandmatig({
        klantNaam: formData.klantNaam,
        klantEmail: formData.klantEmail || undefined,
        klantTelefoon: formData.klantTelefoon || undefined,
        klantAdres: formData.klantAdres || undefined,
        klantPostcode: formData.klantPostcode || undefined,
        klantPlaats: formData.klantPlaats || undefined,
        omschrijving: formData.omschrijving || undefined,
        geschatteWaarde: waarde,
        bron: formData.bron,
      });
      toast.success("Lead aangemaakt");
      resetForm();
      onClose();
    } catch {
      toast.error("Fout bij aanmaken lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nieuwe Lead</DialogTitle>
          <DialogDescription>
            Voeg handmatig een nieuwe lead toe aan de pipeline.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="naam">Naam *</Label>
              <Input
                id="naam"
                placeholder="Jan Jansen"
                value={formData.klantNaam}
                onChange={(e) => setFormData({ ...formData, klantNaam: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bron">Bron</Label>
              <Select
                value={formData.bron}
                onValueChange={(val) => setFormData({ ...formData, bron: val as Bron })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="handmatig">Handmatig</SelectItem>
                  <SelectItem value="telefoon">Telefoon</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="doorverwijzing">Doorverwijzing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="jan@voorbeeld.nl"
                value={formData.klantEmail}
                onChange={(e) => setFormData({ ...formData, klantEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefoon">Telefoon</Label>
              <Input
                id="telefoon"
                placeholder="06-12345678"
                value={formData.klantTelefoon}
                onChange={(e) => setFormData({ ...formData, klantTelefoon: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adres">Adres</Label>
            <Input
              id="adres"
              placeholder="Hoofdstraat 1"
              value={formData.klantAdres}
              onChange={(e) => setFormData({ ...formData, klantAdres: e.target.value })}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input
                id="postcode"
                placeholder="1234 AB"
                value={formData.klantPostcode}
                onChange={(e) => setFormData({ ...formData, klantPostcode: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="plaats">Plaats</Label>
              <Input
                id="plaats"
                placeholder="Amsterdam"
                value={formData.klantPlaats}
                onChange={(e) => setFormData({ ...formData, klantPlaats: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="waarde">Geschatte waarde</Label>
            <Input
              id="waarde"
              placeholder="0,00"
              value={formData.geschatteWaarde}
              onChange={(e) => setFormData({ ...formData, geschatteWaarde: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="omschrijving">Omschrijving</Label>
            <Textarea
              id="omschrijving"
              placeholder="Beschrijf het gewenste werk..."
              value={formData.omschrijving}
              onChange={(e) => setFormData({ ...formData, omschrijving: e.target.value })}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuleren</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lead Aanmaken
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/leads/nieuwe-lead-dialog.tsx
git commit -m "feat: create NieuweLeadDialog for manual lead creation"
```

---

## Chunk 4: Integration & Wiring

### Task 15: Replace LeadsTabContent with kanban board

**Files:**
- Modify: `src/app/(dashboard)/klanten/page.tsx`

- [ ] **Step 1: Rewrite LeadsTabContent**

Replace the entire `LeadsTabContent` function and all its supporting components/types (everything after `KlantenPageContent`'s closing bracket, except the page wrapper components at the bottom) with:

```tsx
function LeadsTabContent() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [nieuweLeadOpen, setNieuweLeadOpen] = useState(false);

  const leads = useQuery(api.configuratorAanvragen.listByPipeline);
  const isLoading = leads === undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setNieuweLeadOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe Lead
        </Button>
      </div>

      <KanbanBoard
        leads={leads}
        onLeadClick={(lead) => {
          setSelectedLead(lead);
          setDetailOpen(true);
        }}
      />

      <div className="mt-6">
        <PipelineStats />
      </div>

      <LeadDetailModal
        lead={selectedLead}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedLead(null);
        }}
      />

      <NieuweLeadDialog
        open={nieuweLeadOpen}
        onClose={() => setNieuweLeadOpen(false)}
      />
    </>
  );
}
```

Add the necessary imports at the top of the file:

```tsx
import { KanbanBoard } from "@/components/leads/kanban-board";
import { PipelineStats } from "@/components/leads/pipeline-stats";
import { LeadDetailModal } from "@/components/leads/lead-detail-modal";
import { NieuweLeadDialog } from "@/components/leads/nieuwe-lead-dialog";
```

Remove all the old inline lead components that are no longer used: `AanvraagDetailSheet`, `AanvraagCard`, `StatusBadge`, `TypeBadge`, `SpecificatiesSamenvatting`, `VolleSpecificaties`, and their related types (`AanvraagStatus`, `AanvraagType`, `ConfiguratorAanvraag`, `LeadsTabFilter`, `statusConfig`, `typeConfig`, `formatPrijs`, `formatDatum`).

Also remove now-unused imports: `Sheet`, `SheetContent`, `SheetDescription`, `SheetHeader`, `SheetTitle`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `Tabs` (inner leads tabs), `TabsList`, `TabsTrigger`, `User`, `Euro`, `CheckCircle`, `XCircle`, `ClipboardList`, `UserCheck`.

Keep the outer `Tabs` used by `KlantenPageWithTabs` for the Klanten/Leads top-level tabs.

- [ ] **Step 2: Run `npx tsc --noEmit` to verify**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/klanten/page.tsx
git commit -m "feat: replace leads card view with kanban board"
```

### Task 16: Update sidebar badge to use new query

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Verify sidebar badge still works**

The sidebar currently uses `api.configuratorAanvragen.countByStatus` which counts `status === "nieuw"`. This query should also count leads with `pipelineStatus === "nieuw"` (for new leads that already have the pipeline field). Update the `countByStatus` query in `convex/configuratorAanvragen.ts`:

```typescript
export const countByStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const all = await ctx.db.query("configuratorAanvragen").collect();
    return all.filter((a) => {
      const status = a.pipelineStatus ?? a.status;
      return status === "nieuw";
    }).length;
  },
});
```

- [ ] **Step 2: Run `npx convex dev` to verify**

Run: `npx convex dev --once`
Expected: Functions sync without errors

- [ ] **Step 3: Commit**

```bash
git add convex/configuratorAanvragen.ts
git commit -m "fix: update countByStatus to check pipelineStatus field"
```

### Task 17: Final integration test

- [ ] **Step 1: Start dev server**

Run: `npm run dev` (in one terminal) and `npx convex dev` (in another)

- [ ] **Step 2: Manual verification checklist**

1. Navigate to `/klanten` — should see Klanten and Leads tabs
2. Click Leads tab — should see kanban board with 5 columns
3. Pipeline stats bar should show at bottom
4. Click "+ Nieuwe Lead" — form should open
5. Fill in and submit — new card should appear in "Nieuw" column
6. Drag a card from "Nieuw" to "Contact gehad" — should update
7. Drag to "Verloren" — should show reden dialog
8. Drag to "Gewonnen" — should create klant automatically
9. Click a card — should open detail modal with info + activity log
10. Sidebar Klanten badge should show count of new leads

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit any fixes and push**

```bash
git push
```
