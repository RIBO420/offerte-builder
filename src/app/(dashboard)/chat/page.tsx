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
import { KlantTijdlijn } from "@/components/tijdlijn/klant-tijdlijn";
import Link from "next/link";
import { PaginaReveal } from "@/components/pagina-reveal";
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
  Users,
  Megaphone,
  MessageCircle,
  FolderOpen,
  UserRound,
  PenSquare,
  ArrowLeft,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { isKantoorRol } from "@/lib/rollen";
import { LaadIndicator } from "@/components/ui/laad-indicator";

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
              <LaadIndicator formaat="sectie" />
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

// ── Klanten-tab: WEERGAVE van de klanttijdlijn (PRD §2.3) ────────────
// Zelfde data als de klant-detailpagina, via dezelfde Convex-queries
// (convex/tijdlijn.ts) — andere ingang, géén tweede opslag. De oude
// klant-thread-berichten (chat_threads) zijn NIET gemigreerd maar blijven
// als read-only historie-blok zichtbaar binnen <KlantTijdlijn />.

function KlantenTijdlijnTab() {
  const klanten = useQuery(api.tijdlijn.listKlantenMetTijdlijn, {});
  const [selectedKlantId, setSelectedKlantId] = useState<Id<"klanten"> | null>(
    null
  );

  // Zonder expliciete keuze: de klant met de recentste tijdlijn-activiteit
  const effectiveKlantId = selectedKlantId ?? klanten?.[0]?.klantId ?? null;

  const selected = useMemo(() => {
    if (!effectiveKlantId || !klanten) return null;
    return klanten.find((k) => k.klantId === effectiveKlantId) ?? null;
  }, [effectiveKlantId, klanten]);

  if (klanten === undefined) {
    return (
      <div className="flex items-center justify-center flex-1">
        <LaadIndicator formaat="pagina" />
      </div>
    );
  }

  if (klanten.length === 0) {
    return (
      <EmptyState
        icon={<UserRound />}
        title="Geen klanten"
        description="Zodra er klanten zijn, zie je hier hun tijdlijnen."
        className="flex-1"
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0">
      {/* Klantenlijst sidebar */}
      <div className="w-72 border-r flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b shrink-0">
          <span className="text-sm font-medium text-muted-foreground">
            Klanten ({klanten.length})
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y">
            {klanten.map((k) => (
              <button
                key={k.klantId}
                type="button"
                className={`flex items-center gap-2 w-full p-3 text-left hover:bg-accent/50 transition-colors cursor-pointer ${
                  effectiveKlantId === k.klantId ? "bg-accent" : ""
                }`}
                onClick={() => setSelectedKlantId(k.klantId)}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs">
                  {k.naam
                    .split(" ")
                    .map((w: string) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">
                    {k.naam}
                  </span>
                  {k.laatsteEntryPreview && (
                    <p className="text-xs text-muted-foreground truncate">
                      {k.laatsteEntryPreview}
                    </p>
                  )}
                </div>
                {k.laatsteEntryAt && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatTime(k.laatsteEntryAt)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tijdlijn van de geselecteerde klant */}
      {selected ? (
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex items-center gap-2 p-3 border-b shrink-0">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{selected.naam}</span>
            <Link
              href={`/klanten/${selected.klantId}`}
              className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Open klantkaart
            </Link>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <KlantTijdlijn klantId={selected.klantId} />
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<UserRound />}
          title="Selecteer een klant"
          description="Kies een klant uit de lijst om de tijdlijn te bekijken."
          className="flex-1"
        />
      )}
    </div>
  );
}

// ── Projecten-tab: tijdlijn gefilterd op werkitem (PRD §2.3) ─────────
// Zelfde tijdlijn-data, andere ingang. De oude interne project-chat
// (team_messages, channelType "project") blijft als read-only historie
// zichtbaar onder de tijdlijn — geen dataverlies.

function ProjectTijdlijnTab({
  projectId,
  projecten,
}: {
  projectId?: Id<"projecten">;
  projecten?: { _id: string; naam: string; klantId?: string }[];
}) {
  const project = useMemo(
    () => (projecten ?? []).find((p) => p._id === projectId) ?? null,
    [projecten, projectId]
  );

  const chatHistorie = useQuery(
    api.chat.getTeamMessages,
    projectId ? { channelType: "project", projectId } : "skip"
  );

  if (!projectId) {
    return (
      <EmptyState
        icon={<FolderOpen />}
        title="Selecteer een project"
        description="Kies een project rechtsboven om de tijdlijn van die klus te bekijken."
        className="flex-1"
      />
    );
  }

  if (projecten === undefined || (project && !project.klantId)) {
    return (
      <EmptyState
        icon={<FolderOpen />}
        title={projecten === undefined ? "Laden…" : "Geen klant gekoppeld"}
        description={
          projecten === undefined
            ? ""
            : "Dit project heeft geen gekoppelde klant; er is dus geen klanttijdlijn."
        }
        className="flex-1"
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
      {project?.klantId && (
        <KlantTijdlijn
          klantId={project.klantId as Id<"klanten">}
          vasteWerkitemId={projectId}
          toonHistorie={false}
        />
      )}
      {chatHistorie && chatHistorie.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Interne project-chat van vóór de tijdlijn ({chatHistorie.length}{" "}
            berichten, alleen-lezen)
          </p>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {chatHistorie.map((msg) => (
              <div key={msg._id} className="text-sm">
                <span className="text-xs text-muted-foreground">
                  {formatTime(msg.createdAt)} —{" "}
                  <span className="font-medium">{msg.senderName}</span>:
                </span>{" "}
                <span className="whitespace-pre-wrap">{msg.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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

  // PRD §1.2: alleen kantoor mag naar de klant versturen — voor andere
  // rollen bestaat de Klanten-tab (en dus de verstuurknop) niet in de UI
  const isKantoor = isKantoorRol(userRole);

  // Unread counts
  const unreadCounts = useQuery(
    api.chat.getUnreadCounts,
    user ? {} : "skip"
  );

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
          <LaadIndicator formaat="pagina" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader />
      <PaginaReveal
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
          {/* Projecten & Klanten zijn sinds PRD §2.3 weergaven van de
              klanttijdlijn (geen chat, dus geen unread-teller) */}
          <ChatTabBadge
            label="Projecten"
            icon={<FolderOpen className="h-4 w-4" />}
            isActive={activeTab === "project"}
            onClick={() => setActiveTab("project")}
          />
          {isKantoor && (
            <ChatTabBadge
              label="Klanten"
              icon={<UserRound className="h-4 w-4" />}
              isActive={activeTab === "klant"}
              onClick={() => setActiveTab("klant")}
            />
          )}

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
            <ProjectTijdlijnTab
              projectId={selectedProjectId}
              projecten={projecten as
                | { _id: string; naam: string; klantId?: string }[]
                | undefined}
            />
          )}
          {activeTab === "klant" && isKantoor && <KlantenTijdlijnTab />}
        </div>
      </PaginaReveal>
    </>
  );
}
