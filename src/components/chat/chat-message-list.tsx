"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone } from "lucide-react";

interface ChatMessage {
  _id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  message: string;
  messageType: "text" | "image" | "announcement";
  createdAt: number;
  editedAt?: number;
  readBy?: string[];
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  currentUserClerkId: string;
  isLoading: boolean;
  emptyMessage?: string;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "zojuist";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min geleden`;
  }
  if (diffHours < 24) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays < 7) {
    const date = new Date(timestamp);
    return date.toLocaleDateString("nl-NL", { weekday: "short" }) +
      " " +
      date.toLocaleTimeString("nl-NL", {
        hour: "2-digit",
        minute: "2-digit",
      });
  }
  const date = new Date(timestamp);
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {Array.from({ length: 5 }).map((_, i) => {
        const isOwn = i % 3 === 0;
        return (
          <div
            key={i}
            className={cn("flex gap-3 max-w-[80%]", isOwn && "ml-auto")}
          >
            {!isOwn && <Skeleton className="size-8 rounded-full shrink-0" />}
            <div className={cn("flex flex-col gap-1", isOwn && "items-end")}>
              {!isOwn && <Skeleton className="h-3 w-24" />}
              <Skeleton
                className={cn(
                  "h-10 rounded-2xl",
                  isOwn ? "w-40" : "w-52"
                )}
              />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnnouncementMessage({ message }: { message: ChatMessage }) {
  return (
    <div
      className={cn(
        "mx-4 my-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4",
        "dark:border-amber-400/20 dark:bg-amber-400/5"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Megaphone className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">
              {message.senderName}
            </span>
            {message.senderRole && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {message.senderRole}
              </Badge>
            )}
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
            {message.message}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(message.createdAt)}
            </span>
            {message.editedAt && (
              <span className="text-xs text-muted-foreground italic">
                (bewerkt)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  isOwn,
}: {
  message: ChatMessage;
  isOwn: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-2.5 max-w-[80%] sm:max-w-[70%]",
        isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
    >
      {!isOwn && (
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium select-none"
          aria-hidden="true"
        >
          {getInitials(message.senderName)}
        </div>
      )}
      <div
        className={cn(
          "flex flex-col gap-0.5",
          isOwn ? "items-end" : "items-start"
        )}
      >
        {!isOwn && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-xs font-medium text-foreground">
              {message.senderName}
            </span>
            {message.senderRole && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {message.senderRole}
              </Badge>
            )}
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted text-foreground rounded-bl-md"
          )}
        >
          {message.message}
        </div>
        <div className="flex items-center gap-1.5 px-1">
          <span className="text-[11px] text-muted-foreground">
            {formatRelativeTime(message.createdAt)}
          </span>
          {message.editedAt && (
            <span className="text-[11px] text-muted-foreground italic">
              (bewerkt)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatMessageList({
  messages,
  currentUserClerkId,
  isLoading,
  emptyMessage = "Nog geen berichten",
}: ChatMessageListProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const previousMessageCountRef = React.useRef(0);

  React.useEffect(() => {
    if (messages.length > previousMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    previousMessageCountRef.current = messages.length;
  }, [messages.length]);

  React.useEffect(() => {
    if (!isLoading && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        role="log"
        aria-label="Berichten worden geladen"
        aria-busy="true"
      >
        <MessageSkeleton />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-y-auto"
        role="log"
        aria-label="Berichtenlijst"
      >
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      role="log"
      aria-label="Berichtenlijst"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 p-4">
        {messages.map((message) => {
          if (message.messageType === "announcement") {
            return (
              <AnnouncementMessage key={message._id} message={message} />
            );
          }

          const isOwn = message.senderId === currentUserClerkId;

          return (
            <ChatBubble key={message._id} message={message} isOwn={isOwn} />
          );
        })}
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </div>
  );
}

export { ChatMessageList };
export type { ChatMessageListProps, ChatMessage };
