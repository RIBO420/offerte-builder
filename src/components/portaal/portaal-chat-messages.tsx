"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { Send, MessageSquare } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

interface ChatMessage {
  _id: Id<"chat_messages">;
  threadId: Id<"chat_threads">;
  senderType: "bedrijf" | "klant" | "medewerker";
  senderName: string;
  message: string;
  createdAt: number;
}

interface PortaalChatMessagesProps {
  threadId: Id<"chat_threads"> | null;
  messages: ChatMessage[] | undefined;
  onBack?: () => void;
}

export function PortaalChatMessages({
  threadId,
  messages,
  onBack,
}: PortaalChatMessagesProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendMessage = useMutation(api.chatThreads.sendMessage);
  const markAsRead = useMutation(api.chatThreads.markAsRead);
  const prevLengthRef = useRef(0);

  // Mark thread as read when opening or receiving new messages
  useEffect(() => {
    if (threadId) {
      markAsRead({ threadId });
    }
  }, [threadId, messages?.length, markAsRead]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages && messages.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLengthRef.current = messages?.length ?? 0;
  }, [messages?.length, messages]);

  const handleSend = useCallback(async () => {
    if (!threadId || !text.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage({ threadId, message: text.trim() });
      setText("");
    } finally {
      setSending(false);
    }
  }, [threadId, text, sending, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // No thread selected
  if (!threadId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <MessageSquare className="h-10 w-10 text-gray-400 dark:text-gray-500 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Selecteer een gesprek om berichten te bekijken.
        </p>
      </div>
    );
  }

  // Loading
  if (!messages) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}
            >
              <Skeleton className={cn("h-12 rounded-xl", i % 2 === 0 ? "w-60" : "w-48")} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mobile back button */}
      {onBack && (
        <div className="md:hidden border-b border-gray-200 dark:border-[#2a3e2a] px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-[#1a2e1a] dark:text-[#4ADE80] text-sm"
          >
            ← Terug naar gesprekken
          </Button>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full py-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nog geen berichten in dit gesprek.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isKlant = msg.senderType === "klant";
              return (
                <div
                  key={msg._id}
                  className={cn("flex", isKlant ? "justify-end" : "justify-start")}
                >
                  {/* TT avatar for bedrijf/medewerker messages */}
                  {!isKlant && (
                    <div className="bg-[#4ADE80] w-7 h-7 rounded-full flex items-center justify-center font-bold text-black text-[10px] mr-2 mt-1 shrink-0">
                      TT
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-xl px-3.5 py-2.5",
                      isKlant
                        ? "bg-[#1a2e1a] text-white"
                        : "bg-white dark:bg-[#1a2e1a] border border-gray-200 dark:border-[#2a3e2a] text-gray-800 dark:text-gray-200"
                    )}
                  >
                    {!isKlant && (
                      <p className="text-[11px] font-medium text-[#4ADE80] mb-0.5">
                        {msg.senderName || "Top Tuinen"}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.message}
                    </p>
                    <p
                      className={cn(
                        "text-[10px] mt-1",
                        isKlant ? "text-gray-300" : "text-gray-500 dark:text-gray-400"
                      )}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString("nl-NL", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-[#2a3e2a] p-3">
        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Typ uw bericht..."
            className="min-h-[40px] max-h-[120px] resize-none bg-white dark:bg-[#111a11] border-gray-200 dark:border-[#2a3e2a] text-sm"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="bg-[#1a2e1a] hover:bg-[#2a3e2a] text-white dark:bg-[#4ADE80] dark:text-black dark:hover:bg-[#3bce70] shrink-0"
            size="icon"
            aria-label="Bericht verzenden"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
