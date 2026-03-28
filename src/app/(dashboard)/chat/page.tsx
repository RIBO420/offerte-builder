"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatTabBadge } from "@/components/chat/chat-tabs-badge";
import { NewDMDialog } from "@/components/chat/new-dm-dialog";
import { m } from "framer-motion";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Megaphone,
  MessageCircle,
  FolderOpen,
  UserRound,
  Loader2,
  PenSquare,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";

type ChatTab = "team" | "mededelingen" | "dm" | "project" | "klant";

// ── Team / Mededelingen / Project Tab Content ────────────────────────

function ChannelTab({
  channelType,
  projectId,
  currentUserClerkId,
  userRole,
  emptyMessage,
}: {
  channelType: "team" | "project" | "broadcast";
  projectId?: Id<"projecten">;
  currentUserClerkId: string;
  userRole?: string;
  emptyMessage: string;
}) {
  const messages = useQuery(
    api.chat.getTeamMessages,
    projectId !== undefined || channelType !== "project"
      ? { channelType, projectId }
      : "skip"
  );
  const sendMessage = useMutation(api.chat.sendTeamMessage);
  const markAsRead = useMutation(api.chat.markTeamMessagesAsRead);

  // Mark messages as read when tab is viewed
  useEffect(() => {
    if (messages && messages.length > 0) {
      markAsRead({ channelType, projectId }).catch(() => {});
    }
  }, [messages, channelType, projectId, markAsRead]);

  const handleSend = useCallback(
    (message: string) => {
      sendMessage({
        channelType,
        projectId,
        message,
        messageType: channelType === "broadcast" ? "announcement" : "text",
      }).catch(() => {});
    },
    [sendMessage, channelType, projectId]
  );

  const mappedMessages = useMemo(
    () =>
      (messages ?? []).map((m) => ({
        _id: m._id,
        senderId: m.senderClerkId,
        senderName: m.senderName,
        senderRole: m.senderRole,
        message: m.message,
        messageType: m.messageType,
        createdAt: m.createdAt,
        editedAt: m.editedAt,
        readBy: m.readBy,
      })),
    [messages]
  );

  // Broadcast: only directie can send
  const canSend =
    channelType !== "broadcast" ||
    userRole === "directie" ||
    userRole === "admin";

  // Project tab without selection
  if (channelType === "project" && !projectId) {
    return (
      <EmptyState
        icon={<FolderOpen />}
        title="Geen project geselecteerd"
        description="Selecteer een project om berichten te zien."
        className="flex-1"
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatMessageList
          messages={mappedMessages}
          currentUserClerkId={currentUserClerkId}
          isLoading={messages === undefined}
          emptyMessage={emptyMessage}
        />
      </div>
      {canSend && (
        <div className="border-t p-3">
          <ChatInput
            onSend={handleSend}
            placeholder={
              channelType === "broadcast"
                ? "Schrijf een mededeling..."
                : channelType === "project"
                  ? "Bericht naar projectteam..."
                  : "Bericht naar team..."
            }
          />
        </div>
      )}
    </div>
  );
}

// ── DM Tab Content ───────────────────────────────────────────────────

function DMTab({ currentUserClerkId }: { currentUserClerkId: string }) {
  const conversations = useQuery(api.chat.getDMConversations);
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(
    null
  );
  const [showNewDM, setShowNewDM] = useState(false);

  const handleSelectUser = useCallback((userId: Id<"users">) => {
    setSelectedUserId(userId);
  }, []);

  // Conversation list view
  if (!selectedUserId) {
    return (
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-medium text-muted-foreground">
            Gesprekken
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNewDM(true)}
            title="Nieuw gesprek"
          >
            <PenSquare className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {conversations === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <EmptyState
              icon={<MessageCircle />}
              title="Nog geen gesprekken"
              description="Start een nieuw gesprek met een collega."
              action={{
                label: "Nieuw gesprek",
                onClick: () => setShowNewDM(true),
                variant: "outline",
              }}
              className="py-12 px-4"
            />
          ) : (
            <div className="divide-y">
              {conversations.map((conv) => (
                <button
                  key={conv.partnerId}
                  className="flex items-center gap-3 w-full p-3 text-left hover:bg-accent/50 transition-colors"
                  onClick={() =>
                    setSelectedUserId(conv.partnerId as Id<"users">)
                  }
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-sm">
                    {conv.partnerName
                      .split(" ")
                      .map((w: string) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">
                        {conv.partnerName}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.lastMessage}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="shrink-0 h-5 min-w-5 flex items-center justify-center text-xs"
                    >
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        <NewDMDialog
          open={showNewDM}
          onOpenChange={setShowNewDM}
          onSelectUser={handleSelectUser}
        />
      </div>
    );
  }

  // Individual DM conversation view
  return (
    <DMConversation
      withUserId={selectedUserId}
      currentUserClerkId={currentUserClerkId}
      onBack={() => setSelectedUserId(null)}
      conversations={conversations}
    />
  );
}

function DMConversation({
  withUserId,
  currentUserClerkId,
  onBack,
  conversations,
}: {
  withUserId: Id<"users">;
  currentUserClerkId: string;
  onBack: () => void;
  conversations?: Array<{ partnerId: string; partnerName: string }>;
}) {
  const messages = useQuery(api.chat.getDirectMessages, { withUserId });
  const sendMessage = useMutation(api.chat.sendDirectMessage);
  const markAsRead = useMutation(api.chat.markDMAsRead);

  const partnerName = useMemo(() => {
    const conv = conversations?.find((c) => c.partnerId === withUserId);
    return conv?.partnerName ?? "Gesprek";
  }, [conversations, withUserId]);

  // Mark as read when viewing
  useEffect(() => {
    if (messages && messages.length > 0) {
      markAsRead({ fromUserId: withUserId }).catch(() => {});
    }
  }, [messages, withUserId, markAsRead]);

  const handleSend = useCallback(
    (message: string) => {
      sendMessage({ toUserId: withUserId, message }).catch(() => {});
    },
    [sendMessage, withUserId]
  );

  const mappedMessages = useMemo(
    () =>
      (messages ?? []).map((m) => ({
        _id: m._id,
        senderId: m.fromClerkId,
        senderName: m.fromClerkId === currentUserClerkId ? "Jij" : partnerName,
        message: m.message,
        messageType: m.messageType as "text" | "image" | "announcement",
        createdAt: m.createdAt,
      })),
    [messages, currentUserClerkId, partnerName]
  );

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex items-center gap-2 p-3 border-b">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium text-sm">{partnerName}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatMessageList
          messages={mappedMessages}
          currentUserClerkId={currentUserClerkId}
          isLoading={messages === undefined}
          emptyMessage="Nog geen berichten. Stuur het eerste bericht!"
        />
      </div>
      <div className="border-t p-3">
        <ChatInput onSend={handleSend} placeholder="Typ een bericht..." />
      </div>
    </div>
  );
}

// ── Klant Tab Content ────────────────────────────────────────────────

function KlantTab({ currentUserClerkId, userRole }: { currentUserClerkId: string; userRole?: string }) {
  const threads = useQuery(api.chatThreads.listThreads, {});
  const deleteThread = useMutation(api.chatThreads.deleteThread);
  const [selectedThreadId, setSelectedThreadId] =
    useState<Id<"chat_threads"> | null>(null);
  const [threadToDelete, setThreadToDelete] = useState<{ _id: Id<"chat_threads">; name: string } | null>(null);

  const selectedThread = useMemo(() => {
    if (!selectedThreadId || !threads) return null;
    return threads.find((t) => t._id === selectedThreadId) ?? null;
  }, [selectedThreadId, threads]);

  // Auto-select first thread
  useEffect(() => {
    if (threads && threads.length > 0 && !selectedThread) {
      setSelectedThreadId(threads[0]._id);
    }
  }, [threads, selectedThread]);

  const handleDeleteThread = useCallback(async () => {
    if (!threadToDelete) return;
    try {
      await deleteThread({ threadId: threadToDelete._id });
      toast.success("Gesprek verwijderd");
      if (selectedThreadId === threadToDelete._id) {
        setSelectedThreadId(null);
      }
    } catch {
      toast.error("Fout bij verwijderen gesprek");
    } finally {
      setThreadToDelete(null);
    }
  }, [threadToDelete, deleteThread, selectedThreadId]);

  const canDelete = userRole === "directie" || userRole === "admin";

  if (threads === undefined) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <EmptyState
        icon={<UserRound />}
        title="Geen klantgesprekken"
        description="Er zijn nog geen gesprekken met klanten gestart."
        className="flex-1"
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0">
      {/* Thread list sidebar */}
      <div className="w-72 border-r flex flex-col overflow-hidden">
        <div className="p-3 border-b shrink-0">
          <span className="text-sm font-medium text-muted-foreground">
            Klanten ({threads.length})
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y">
            {threads.map((thread) => (
              <div
                key={thread._id}
                className={`flex items-center gap-2 w-full p-3 hover:bg-accent/50 transition-colors cursor-pointer ${
                  selectedThreadId === thread._id ? "bg-accent" : ""
                }`}
                onClick={() => setSelectedThreadId(thread._id)}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs">
                  {(thread.channelName || "K")
                    .split(" ")
                    .map((w: string) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">
                    {thread.channelName || "Klant"}
                  </span>
                  {thread.lastMessagePreview && (
                    <p className="text-xs text-muted-foreground truncate">
                      {thread.lastMessagePreview}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(thread.unreadByBedrijf ?? 0) > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-5 text-xs">
                      {thread.unreadByBedrijf}
                    </Badge>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setThreadToDelete({ _id: thread._id, name: thread.channelName || "Klant" });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Messages area */}
      {selectedThread ? (
        <KlantThreadMessages
          threadId={selectedThread._id}
          threadName={selectedThread.channelName || "Klant"}
          currentUserClerkId={currentUserClerkId}
        />
      ) : (
        <EmptyState
          icon={<MessageCircle />}
          title="Selecteer een gesprek"
          description="Kies een klant uit de lijst om het gesprek te bekijken."
          className="flex-1"
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!threadToDelete} onOpenChange={() => setThreadToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gesprek verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je het gesprek met <strong>{threadToDelete?.name}</strong> wilt verwijderen?
              Alle berichten worden permanent verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteThread}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KlantThreadMessages({
  threadId,
  threadName,
  currentUserClerkId,
}: {
  threadId: Id<"chat_threads">;
  threadName: string;
  currentUserClerkId: string;
}) {
  const messages = useQuery(api.chatThreads.listMessages, { threadId });
  const sendMessage = useMutation(api.chatThreads.sendMessage);
  const markAsRead = useMutation(api.chatThreads.markAsRead);

  useEffect(() => {
    markAsRead({ threadId }).catch(() => {});
  }, [threadId, markAsRead]);

  const handleSend = useCallback(
    (message: string) => {
      sendMessage({ threadId, message }).catch(() => {});
    },
    [sendMessage, threadId]
  );

  const mappedMessages = useMemo(
    () =>
      (messages ?? []).map((m) => ({
        _id: m._id,
        senderId: m.senderUserId || "",
        senderName: m.senderName || "Klant",
        message: m.message,
        messageType: "text" as const,
        createdAt: m.createdAt,
      })),
    [messages]
  );

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex items-center gap-2 p-3 border-b shrink-0">
        <UserRound className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{threadName}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatMessageList
          messages={mappedMessages}
          currentUserClerkId={currentUserClerkId}
          isLoading={messages === undefined}
          emptyMessage="Nog geen berichten met deze klant"
        />
      </div>
      <div className="border-t p-3 shrink-0">
        <ChatInput onSend={handleSend} placeholder={`Bericht naar ${threadName}...`} />
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "zojuist";
  if (diffMin < 60) return `${diffMin}m`;

  const date = new Date(timestamp);
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}

// ── Main Chat Page ───────────────────────────────────────────────────

export default function ChatPage() {
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<ChatTab>("team");
  const [selectedProjectId, setSelectedProjectId] =
    useState<Id<"projecten"> | undefined>(undefined);

  const currentUserClerkId = useMemo(() => {
    if (!user) return "";
    return (user as { clerkId?: string }).clerkId ?? "";
  }, [user]);

  const userRole = useMemo(() => {
    if (!user) return undefined;
    return (user as { role?: string }).role;
  }, [user]);

  // Unread counts
  const unreadCounts = useQuery(
    api.chat.getUnreadCounts,
    user ? {} : "skip"
  );

  // Klant thread unread count
  const klantThreads = useQuery(
    api.chatThreads.listThreads,
    user ? {} : "skip"
  );
  const klantUnread = useMemo(() => {
    if (!klantThreads) return 0;
    return klantThreads.reduce(
      (sum, t) => sum + (t.unreadByBedrijf ?? 0),
      0
    );
  }, [klantThreads]);

  // Projects list for project selector
  const projecten = useQuery(
    api.projecten.list,
    user ? {} : "skip"
  );

  if (!user) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader />
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col overflow-hidden"
        style={{ height: "calc(100vh - 4rem)" }}
      >
        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b overflow-x-auto">
          <ChatTabBadge
            label="Team"
            icon={<Users className="h-4 w-4" />}
            count={unreadCounts?.team}
            isActive={activeTab === "team"}
            onClick={() => setActiveTab("team")}
          />
          <ChatTabBadge
            label="Mededelingen"
            icon={<Megaphone className="h-4 w-4" />}
            count={unreadCounts?.broadcast}
            isActive={activeTab === "mededelingen"}
            onClick={() => setActiveTab("mededelingen")}
          />
          <ChatTabBadge
            label="DM"
            icon={<MessageCircle className="h-4 w-4" />}
            count={unreadCounts?.dm}
            isActive={activeTab === "dm"}
            onClick={() => setActiveTab("dm")}
          />
          <ChatTabBadge
            label="Projecten"
            icon={<FolderOpen className="h-4 w-4" />}
            count={unreadCounts?.project}
            isActive={activeTab === "project"}
            onClick={() => setActiveTab("project")}
          />
          <ChatTabBadge
            label="Klanten"
            icon={<UserRound className="h-4 w-4" />}
            count={klantUnread}
            isActive={activeTab === "klant"}
            onClick={() => setActiveTab("klant")}
          />

          {/* Project selector (visible when project tab is active) */}
          {activeTab === "project" && (
            <div className="ml-auto">
              <Select
                value={selectedProjectId ?? "none"}
                onValueChange={(v) =>
                  setSelectedProjectId(
                    v === "none" ? undefined : (v as Id<"projecten">)
                  )
                }
              >
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="Kies project..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">
                      Kies project...
                    </span>
                  </SelectItem>
                  {(projecten ?? []).map((p: { _id: string; naam: string }) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.naam}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Tab content */}
        <div className="flex flex-1 min-h-0">
          {activeTab === "team" && (
            <ChannelTab
              channelType="team"
              currentUserClerkId={currentUserClerkId}
              userRole={userRole}
              emptyMessage="Nog geen teamberichten. Start het gesprek!"
            />
          )}
          {activeTab === "mededelingen" && (
            <ChannelTab
              channelType="broadcast"
              currentUserClerkId={currentUserClerkId}
              userRole={userRole}
              emptyMessage="Nog geen mededelingen"
            />
          )}
          {activeTab === "dm" && (
            <DMTab currentUserClerkId={currentUserClerkId} />
          )}
          {activeTab === "project" && (
            <ChannelTab
              channelType="project"
              projectId={selectedProjectId}
              currentUserClerkId={currentUserClerkId}
              userRole={userRole}
              emptyMessage="Nog geen berichten in dit project"
            />
          )}
          {activeTab === "klant" && (
            <KlantTab currentUserClerkId={currentUserClerkId} userRole={userRole} />
          )}
        </div>
      </m.div>
    </>
  );
}
