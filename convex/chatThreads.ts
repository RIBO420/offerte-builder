import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./auth";
import {
  getCompanyUserId,
  normalizeRole,
  assertKanNaarKlantVersturen,
  klantHeeftToegangTotThread,
  requireKantoor,
} from "./roles";
import { chatThreadTypeValidator } from "./validators";

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

    // Enrich threads with klant name if missing channelName
    const enriched = await Promise.all(
      threads.map(async (thread) => {
        if (thread.channelName) return thread;
        if (thread.klantId) {
          const klant = await ctx.db.get(thread.klantId);
          if (klant) {
            return { ...thread, channelName: klant.naam };
          }
        }
        return thread;
      })
    );

    return enriched.sort(
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
      // Klant: alleen eigen klant-threads — interne threads (team/project/dm)
      // zijn nooit zichtbaar, ook niet met een (per ongeluk) gezet klantId
      if (!klantHeeftToegangTotThread(user.linkedKlantId, thread)) {
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
      // Klant: alleen eigen klant-threads — interne threads nooit leesbaar
      if (!klantHeeftToegangTotThread(user.linkedKlantId, thread)) {
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
      const total = threads
        .filter((t) => t.type === "klant")
        .reduce((sum, t) => sum + (t.unreadByKlant ?? 0), 0);
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
      // Klant: alleen posten in eigen klant-threads — nooit in interne threads
      if (!klantHeeftToegangTotThread(user.linkedKlantId, thread)) {
        throw new ConvexError("Geen toegang tot dit gesprek");
      }
      senderType = "klant";
      // Klant cannot send attachments in v1
      if (args.attachmentStorageIds && args.attachmentStorageIds.length > 0) {
        throw new ConvexError("Bijlagen versturen is nog niet beschikbaar");
      }
    } else {
      const companyUserId = await getCompanyUserId(ctx);
      if (thread.companyUserId.toString() !== companyUserId.toString()) {
        throw new ConvexError("Geen toegang tot dit gesprek");
      }
      // Capability "versturen naar klant" (PRD §1.2): alleen kantoor mag in
      // een klant-thread posten — voorman/medewerker worden geweigerd
      // (AuthError via de centrale capability-assert)
      if (thread.type === "klant") {
        await assertKanNaarKlantVersturen(ctx);
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

    // Notify klant via portal email when bedrijf sends a message
    if (thread.type === "klant" && senderType !== "klant" && thread.klantId) {
      await ctx.scheduler.runAfter(0, internal.portaalEmail.sendMessageNotification, {
        klantId: thread.klantId,
      });
    }

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

    // Ownership check: alleen deelnemers mogen unread-tellers resetten
    if (role === "klant") {
      if (!klantHeeftToegangTotThread(user.linkedKlantId, thread)) {
        throw new ConvexError("Geen toegang tot dit gesprek");
      }
      await ctx.db.patch(args.threadId, { unreadByKlant: 0 });
    } else {
      const companyUserId = await getCompanyUserId(ctx);
      if (thread.companyUserId.toString() !== companyUserId.toString()) {
        throw new ConvexError("Geen toegang tot dit gesprek");
      }
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


/**
 * Create a standalone klant thread (not linked to offerte or project).
 * If a standalone thread for this klant already exists, return it.
 */
export const createKlantThread = mutation({
  args: {
    klantId: v.id("klanten"),
  },
  handler: async (ctx, args) => {
    // Klant-threads openen is een kantoor-taak (PRD §1.2)
    const user = await requireKantoor(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    // Verify klant belongs to company
    const klant = await ctx.db.get(args.klantId);
    if (!klant) throw new ConvexError("Klant niet gevonden");
    if (klant.userId.toString() !== companyUserId.toString()) {
      throw new ConvexError("Geen toegang tot deze klant");
    }

    // Check if a standalone thread (without offerte/project) already exists
    const existingThreads = await ctx.db
      .query("chat_threads")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .collect();

    const standaloneThread = existingThreads.find(
      (t) => t.type === "klant" && !t.offerteId && !t.projectId
    );

    if (standaloneThread) {
      return standaloneThread._id;
    }

    // Create new standalone klant thread
    const threadId = await ctx.db.insert("chat_threads", {
      type: "klant",
      klantId: args.klantId,
      participants: [user.clerkId],
      companyUserId,
      createdAt: Date.now(),
    });

    return threadId;
  },
});

/**
 * Staf: bestaande klantthread bij een werkitem/melding opzoeken (géén
 * create). Voor het thread-paneel in de detailweergave. Alle interne
 * rollen mogen LEZEN; versturen blijft kantoor-only (sendMessage).
 * De klant-rol wordt geweigerd — die gebruikt het portaal-pad.
 */
export const getKlantThreadVoorContext = query({
  args: {
    werkitemId: v.optional(v.id("projecten")),
    meldingId: v.optional(v.id("servicemeldingen")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (normalizeRole(user.role) === "klant") return null;
    const companyUserId = await getCompanyUserId(ctx);

    if (!args.werkitemId && !args.meldingId) return null;

    const threads = args.werkitemId
      ? await ctx.db
          .query("chat_threads")
          .withIndex("by_project", (q) => q.eq("projectId", args.werkitemId))
          .collect()
      : await ctx.db
          .query("chat_threads")
          .withIndex("by_melding", (q) => q.eq("meldingId", args.meldingId))
          .collect();

    const thread = threads.find(
      (t) =>
        t.type === "klant" &&
        t.companyUserId.toString() === companyUserId.toString()
    );
    return thread?._id ?? null;
  },
});

/**
 * Kantoor: klantthread bij een werkitem of melding openen (get-or-create).
 * Dit is het thread-paneel in de detailweergave (PRD §3.1): de thread is
 * ZICHTBAAR VOOR DE KLANT — versturen loopt via sendMessage, dat voor
 * klant-threads assertKanNaarKlantVersturen afdwingt (kantoor-only).
 */
export const openKlantThreadVoorContext = mutation({
  args: {
    werkitemId: v.optional(v.id("projecten")),
    meldingId: v.optional(v.id("servicemeldingen")),
  },
  handler: async (ctx, args) => {
    const user = await requireKantoor(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    if (!args.werkitemId && !args.meldingId) {
      throw new ConvexError("Werkitem of melding is verplicht");
    }

    let klantId;
    let channelName: string;
    if (args.werkitemId) {
      const werkitem = await ctx.db.get(args.werkitemId);
      if (
        !werkitem ||
        werkitem.deletedAt ||
        werkitem.userId.toString() !== companyUserId.toString()
      ) {
        throw new ConvexError("Werkitem niet gevonden");
      }
      if (!werkitem.klantId) {
        throw new ConvexError("Dit werkitem heeft geen gekoppelde klant");
      }
      klantId = werkitem.klantId;
      channelName = werkitem.naam;
    } else {
      const melding = await ctx.db.get(args.meldingId!);
      if (
        !melding ||
        melding.deletedAt ||
        melding.userId.toString() !== companyUserId.toString()
      ) {
        throw new ConvexError("Melding niet gevonden");
      }
      klantId = melding.klantId;
      channelName = `Melding: ${melding.beschrijving.slice(0, 60)}`;
    }

    const bestaande = args.werkitemId
      ? await ctx.db
          .query("chat_threads")
          .withIndex("by_project", (q) => q.eq("projectId", args.werkitemId))
          .collect()
      : await ctx.db
          .query("chat_threads")
          .withIndex("by_melding", (q) => q.eq("meldingId", args.meldingId))
          .collect();
    const thread = bestaande.find(
      (t) => t.type === "klant" && t.klantId?.toString() === klantId.toString()
    );
    if (thread) return thread._id;

    return await ctx.db.insert("chat_threads", {
      type: "klant",
      klantId,
      projectId: args.werkitemId,
      meldingId: args.meldingId,
      channelName,
      participants: [user.clerkId],
      companyUserId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Delete a chat thread and all its messages. Admin/directie only.
 */
export const deleteThread = mutation({
  args: { threadId: v.id("chat_threads") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const role = normalizeRole(user.role);
    if (role !== "directie") {
      throw new ConvexError("Alleen directie kan gesprekken verwijderen");
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new ConvexError("Gesprek niet gevonden");
    }

    // Delete all messages in the thread
    const messages = await ctx.db
      .query("chat_messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the thread itself
    await ctx.db.delete(args.threadId);

    return { success: true };
  },
});
