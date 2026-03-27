"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { m } from "framer-motion";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  Send,
  Loader2,
  Users,
  User,
  Building2,
} from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Id } from "../../../../convex/_generated/dataModel";

type ThreadFilter = "alle" | "klant" | "team" | "direct";

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const time = date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return time;
  if (isYesterday) return `Gisteren ${time}`;
  return `${date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} ${time}`;
}

// Thread type badge component
function ThreadTypeBadge({ type }: { type: string }) {
  if (type === "klant") {
    return (
      <Badge className="text-[10px] bg-green-600 hover:bg-green-600 text-white">
        KLANT
      </Badge>
    );
  }
  if (type === "team") {
    return (
      <Badge className="text-[10px] bg-blue-600 hover:bg-blue-600 text-white">
        TEAM
      </Badge>
    );
  }
  // "direct" and "project" threads don't get a badge
  return null;
}

// Thread icon by type
function ThreadIcon({ type }: { type: string }) {
  if (type === "klant") return <Building2 className="h-4 w-4 shrink-0" />;
  if (type === "team") return <Users className="h-4 w-4 shrink-0" />;
  return <User className="h-4 w-4 shrink-0" />;
}

// Thread display name — shows context for klant threads
function getThreadDisplayName(thread: {
  type: string;
  channelName?: string;
  klantId?: Id<"klanten">;
  offerteId?: Id<"offertes">;
  projectId?: Id<"projecten">;
  participants?: string[];
}): string {
  if (thread.channelName) return thread.channelName;
  if (thread.type === "team") return "Team";
  if (thread.type === "direct") return "Direct bericht";
  if (thread.type === "klant") return "Klantgesprek";
  return "Gesprek";
}

interface ThreadListItem {
  _id: Id<"chat_threads">;
  type: string;
  channelName?: string;
  klantId?: Id<"klanten">;
  offerteId?: Id<"offertes">;
  projectId?: Id<"projecten">;
  participants: string[];
  lastMessageAt?: number;
  lastMessagePreview?: string;
  unreadByBedrijf?: number;
  unreadByKlant?: number;
  companyUserId: Id<"users">;
  createdAt: number;
}

function ThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
}: {
  threads: ThreadListItem[];
  selectedThreadId: Id<"chat_threads"> | null;
  onSelectThread: (thread: ThreadListItem) => void;
}) {
  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">
          Geen gesprekken gevonden
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {threads.map((thread) => {
        const isActive = selectedThreadId === thread._id;
        const unread = thread.unreadByBedrijf ?? 0;
        const displayName = getThreadDisplayName(thread);

        return (
          <button
            key={thread._id}
            onClick={() => onSelectThread(thread)}
            className={`flex items-start gap-2 rounded-md px-2 py-2 text-sm transition-colors w-full text-left ${
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-muted text-foreground"
            }`}
          >
            <ThreadIcon type={thread.type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="truncate text-sm font-medium">
                  {displayName}
                </span>
                <ThreadTypeBadge type={thread.type} />
              </div>
              {thread.lastMessagePreview && (
                <p className="truncate text-xs text-muted-foreground">
                  {thread.lastMessagePreview}
                </p>
              )}
              {thread.lastMessageAt && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatTime(thread.lastMessageAt)}
                </p>
              )}
            </div>
            {unread > 0 && (
              <Badge
                variant="default"
                className="h-5 min-w-5 px-1 text-xs bg-blue-600 hover:bg-blue-600 shrink-0"
              >
                {unread}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ThreadMessageArea({
  threadId,
  thread,
  currentUserClerkId,
}: {
  threadId: Id<"chat_threads">;
  thread: ThreadListItem;
  currentUserClerkId: string;
}) {
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useQuery(api.chatThreads.listMessages, {
    threadId,
  });

  const sendMessage = useMutation(api.chatThreads.sendMessage);
  const markAsRead = useMutation(api.chatThreads.markAsRead);

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages && messages.length > 0) {
      markAsRead({ threadId });
    }
  }, [messages, markAsRead, threadId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = newMessage.trim();
    if (!trimmed) return;

    setIsSending(true);
    setNewMessage("");
    try {
      await sendMessage({
        threadId,
        message: trimmed,
      });
    } catch {
      setNewMessage(trimmed);
    } finally {
      setIsSending(false);
    }
  }, [newMessage, sendMessage, threadId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  if (messages === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayName = getThreadDisplayName(thread);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nog geen berichten in dit gesprek.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Stuur het eerste bericht!
              </p>
            </div>
          )}
          {messages.map((msg) => {
            const isOwn = msg.senderUserId === currentUserClerkId;

            return (
              <div
                key={msg._id}
                className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    isOwn
                      ? "bg-primary text-primary-foreground"
                      : msg.senderType === "klant"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {msg.senderName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div
                  className={`max-w-[70%] ${isOwn ? "text-right" : ""}`}
                >
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className={`text-xs font-medium ${isOwn ? "order-2" : ""}`}>
                      {isOwn ? "Jij" : msg.senderName}
                    </span>
                    {msg.senderType === "klant" && !isOwn && (
                      <Badge className="text-[9px] px-1 py-0 h-4 bg-green-600 hover:bg-green-600 text-white">
                        KLANT
                      </Badge>
                    )}
                    <span className={`text-[10px] text-muted-foreground ${isOwn ? "order-1" : ""}`}>
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <div
                    className={`inline-block rounded-lg px-3 py-2 text-sm ${
                      isOwn
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            placeholder={`Bericht in ${displayName}...`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
            size="icon"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { user } = useCurrentUser();
  const [filter, setFilter] = useState<ThreadFilter>("alle");
  const [selectedThreadId, setSelectedThreadId] = useState<Id<"chat_threads"> | null>(null);

  // Query threads with filter
  const threads = useQuery(
    api.chatThreads.listThreads,
    user?._id
      ? filter !== "alle"
        ? { filter: filter as "klant" | "team" | "direct" }
        : {}
      : "skip"
  );

  const currentUserClerkId = useMemo(() => {
    if (!user) return "";
    return (user as { clerkId?: string }).clerkId ?? "";
  }, [user]);

  // Track the selected thread object for display
  const selectedThread = useMemo(() => {
    if (!selectedThreadId || !threads) return null;
    return threads.find((t) => t._id === selectedThreadId) ?? null;
  }, [selectedThreadId, threads]);

  // Auto-select first thread when list changes and nothing is selected
  useEffect(() => {
    if (threads && threads.length > 0 && !selectedThread) {
      setSelectedThreadId(threads[0]._id);
    }
  }, [threads, selectedThread]);

  const handleSelectThread = useCallback((thread: ThreadListItem) => {
    setSelectedThreadId(thread._id);
  }, []);

  const handleFilterChange = useCallback((value: string) => {
    setFilter(value as ThreadFilter);
    setSelectedThreadId(null); // Reset selection when filter changes
  }, []);

  const isLoading = !threads;

  return (
    <>
      <PageHeader />
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Chat
          </h1>
          <p className="text-muted-foreground">
            Communiceer met klanten, team en collega&apos;s
          </p>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={handleFilterChange}>
          <TabsList>
            <TabsTrigger value="alle">Alle</TabsTrigger>
            <TabsTrigger value="klant">Klanten</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="direct">Direct</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card className="flex-1 flex flex-col md:flex-row overflow-hidden" style={{ minHeight: "500px" }}>
            {/* Sidebar - Thread list */}
            <div className="w-full md:w-72 md:border-r shrink-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Gesprekken
                  {threads.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {threads.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <ScrollArea className="max-h-48 md:max-h-none md:h-[calc(100%-60px)]">
                <ThreadList
                  threads={threads as ThreadListItem[]}
                  selectedThreadId={selectedThreadId}
                  onSelectThread={handleSelectThread}
                />
              </ScrollArea>
            </div>

            {/* Main content - Messages */}
            <div className="flex-1 flex flex-col min-h-0">
              {selectedThread ? (
                <>
                  {/* Thread header */}
                  <div className="border-b px-4 py-3 flex items-center gap-2">
                    <ThreadIcon type={selectedThread.type} />
                    <span className="font-medium text-sm">
                      {getThreadDisplayName(selectedThread)}
                    </span>
                    <ThreadTypeBadge type={selectedThread.type} />
                  </div>
                  <ThreadMessageArea
                    threadId={selectedThread._id}
                    thread={selectedThread as ThreadListItem}
                    currentUserClerkId={currentUserClerkId}
                  />
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Selecteer een gesprek om te beginnen
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </m.div>
    </>
  );
}
