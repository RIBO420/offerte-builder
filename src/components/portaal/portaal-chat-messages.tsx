"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { Send, MessageSquare } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { TopTuinenLogo } from "@/components/ui/top-tuinen-logo";
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
        <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
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
        <div className="md:hidden border-b border-border px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-primary text-sm"
          >
            ← Terug naar gesprekken
          </Button>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full py-12">
            <p className="text-sm text-muted-foreground">
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
                    <div className="bg-sidebar-primary w-7 h-7 rounded-full flex items-center justify-center mr-2 mt-1 shrink-0">
                      <TopTuinenLogo variant="wit" size={20} className="size-[18px]" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-xl px-3.5 py-2.5",
                      isKlant
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-card-foreground"
                    )}
                  >
                    {!isKlant && (
                      <p className="text-[11px] font-semibold text-primary mb-0.5">
                        {msg.senderName || "Top Tuinen"}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.message}
                    </p>
                    <p
                      className={cn(
                        "text-[10px] mt-1",
                        isKlant ? "text-primary-foreground/70" : "text-muted-foreground"
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
      <div className="border-t border-border p-3">
        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Typ uw bericht..."
            className="min-h-[40px] max-h-[120px] resize-none bg-card text-sm"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="shrink-0"
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
