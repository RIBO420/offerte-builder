import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
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
