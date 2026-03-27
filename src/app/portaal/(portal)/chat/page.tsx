"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PortaalChatThreadList } from "@/components/portaal/portaal-chat-thread-list";
import { PortaalChatMessages } from "@/components/portaal/portaal-chat-messages";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../../convex/_generated/dataModel";

export default function PortaalChatPage() {
  const [activeThreadId, setActiveThreadId] = useState<Id<"chat_threads"> | null>(null);

  const threads = useQuery(api.chatThreads.listThreads, {});
  const messages = useQuery(
    api.chatThreads.listMessages,
    activeThreadId ? { threadId: activeThreadId } : "skip"
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#1a2e1a] dark:text-white">
          Berichten
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Communiceer direct met Top Tuinen over uw offertes en projecten.
        </p>
      </div>

      <div className="bg-white dark:bg-[#111a11] border border-gray-200 dark:border-[#2a3e2a] rounded-xl overflow-hidden h-[calc(100vh-220px)] min-h-[400px]">
        <div className="flex h-full">
          {/* Thread list — visible on desktop always, on mobile only when no thread selected */}
          <div
            className={cn(
              "w-full md:w-[260px] md:border-r border-gray-200 dark:border-[#2a3e2a] md:block shrink-0",
              activeThreadId ? "hidden md:block" : "block"
            )}
          >
            <div className="border-b border-gray-200 dark:border-[#2a3e2a] px-4 py-3">
              <h2 className="text-sm font-semibold text-[#1a2e1a] dark:text-white">
                Gesprekken
              </h2>
            </div>
            <div className="h-[calc(100%-49px)]">
              <PortaalChatThreadList
                threads={threads}
                activeThreadId={activeThreadId}
                onSelectThread={setActiveThreadId}
              />
            </div>
          </div>

          {/* Messages — visible on desktop always, on mobile only when thread selected */}
          <div
            className={cn(
              "flex-1 min-w-0",
              activeThreadId ? "block" : "hidden md:block"
            )}
          >
            <PortaalChatMessages
              threadId={activeThreadId}
              messages={activeThreadId ? messages : undefined}
              onBack={() => setActiveThreadId(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
