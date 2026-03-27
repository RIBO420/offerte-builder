import { internalMutation } from "./_generated/server";

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

    for (const [, msgs] of byOfferte) {
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
          senderName:
            msg.sender === "bedrijf"
              ? "Top Tuinen"
              : (offerte.klant?.naam ?? "Klant"),
          message: msg.message,
          isRead: msg.isRead,
          createdAt: msg.createdAt,
        });
        messagesMigrated++;
      }
    }

    console.log(
      `Migrated offerte_messages: ${threadsCreated} threads, ${messagesMigrated} messages`
    );
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

    console.log(
      `Migrated team_messages: ${threadsCreated} threads, ${messagesMigrated} messages`
    );
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
      const participants = [
        ...new Set([
          ...msgs.map((m) => m.fromClerkId),
          ...msgs.map((m) => m.toClerkId),
        ]),
      ];

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

    console.log(
      `Migrated direct_messages: ${threadsCreated} threads, ${messagesMigrated} messages`
    );
    return { threadsCreated, messagesMigrated };
  },
});
