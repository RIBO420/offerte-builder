"use client";

import { MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

interface ChatThread {
  _id: Id<"chat_threads">;
  type: string;
  offerteId?: Id<"offertes">;
  projectId?: Id<"projecten">;
  lastMessagePreview?: string;
  lastMessageAt?: number;
  unreadByKlant?: number;
  createdAt: number;
}

interface PortaalChatThreadListProps {
  threads: ChatThread[] | undefined;
  activeThreadId: Id<"chat_threads"> | null;
  onSelectThread: (threadId: Id<"chat_threads">) => void;
}

export function PortaalChatThreadList({
  threads,
  activeThreadId,
  onSelectThread,
}: PortaalChatThreadListProps) {
  if (!threads) {
    return (
      <div className="p-3 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 p-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <MessageSquare className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Nog geen gesprekken.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Gesprekken verschijnen hier wanneer er berichten zijn over uw offertes of projecten.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {threads.map((thread) => {
          const isActive = activeThreadId === thread._id;
          const hasUnread = (thread.unreadByKlant ?? 0) > 0;
          const label = thread.offerteId
            ? "Offerte"
            : thread.projectId
              ? "Project"
              : "Gesprek";

          return (
            <button
              key={thread._id}
              onClick={() => onSelectThread(thread._id)}
              className={cn(
                "w-full text-left px-3 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-[#e8f5e8] dark:bg-[#1a2e1a] border-l-3 border-[#4ADE80]"
                  : "hover:bg-gray-50 dark:hover:bg-[#111a11]",
                hasUnread && !isActive && "bg-gray-50 dark:bg-[#111a11]"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-sm",
                    hasUnread
                      ? "font-semibold text-[#1a2e1a] dark:text-white"
                      : "font-medium text-gray-700 dark:text-gray-300"
                  )}
                >
                  {label}
                </span>
                <div className="flex items-center gap-2">
                  {hasUnread && (
                    <Badge className="bg-[#4ADE80] text-black text-[10px] h-[18px] min-w-[18px] flex items-center justify-center rounded-full px-1">
                      {thread.unreadByKlant}
                    </Badge>
                  )}
                  {thread.lastMessageAt && (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      {formatRelativeTime(thread.lastMessageAt)}
                    </span>
                  )}
                </div>
              </div>
              {thread.lastMessagePreview && (
                <p
                  className={cn(
                    "text-xs truncate",
                    hasUnread
                      ? "text-gray-600 dark:text-gray-300"
                      : "text-gray-400 dark:text-gray-500"
                  )}
                >
                  {thread.lastMessagePreview}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "nu";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}u`;
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}
