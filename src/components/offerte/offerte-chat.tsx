"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Id } from "../../../convex/_generated/dataModel";

interface OfferteChatProps {
  offerteId: Id<"offertes">;
  klantNaam: string;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatDateTime(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return formatTime(timestamp);
  }
  if (isYesterday) {
    return `Gisteren ${formatTime(timestamp)}`;
  }
  return `${date.getDate()}/${date.getMonth() + 1} ${formatTime(timestamp)}`;
}

export function OfferteChat({ offerteId, klantNaam }: OfferteChatProps) {
  const messages = useQuery(api.offerteMessages.listByOfferte, { offerteId });
  const unreadCount = useQuery(api.offerteMessages.getUnreadCount, { offerteId });
  const sendMessage = useMutation(api.offerteMessages.sendFromBusiness);
  const markAsRead = useMutation(api.offerteMessages.markAsRead);

  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mark messages as read when viewing
  useEffect(() => {
    if (unreadCount && unreadCount > 0) {
      markAsRead({ offerteId }).catch(console.error);
    }
  }, [unreadCount, offerteId, markAsRead]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim()) return;
    setIsSending(true);
    try {
      await sendMessage({ offerteId, message: message.trim() });
      setMessage("");
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Berichten
              {unreadCount && unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} nieuw
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Chat met {klantNaam}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 rounded-md border p-4 mb-4">
          {messages && messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg._id}
                  className={cn(
                    "flex",
                    msg.sender === "bedrijf" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-2",
                      msg.sender === "bedrijf"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="text-xs font-medium mb-1">
                      {msg.sender === "bedrijf" ? "Jij" : klantNaam}
                    </p>
                    <p className="text-sm">{msg.message}</p>
                    <p
                      className={cn(
                        "text-xs mt-1",
                        msg.sender === "bedrijf"
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      )}
                    >
                      {formatDateTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Nog geen berichten</p>
              <p className="text-xs">Start een gesprek met de klant</p>
            </div>
          )}
        </ScrollArea>
        <div className="flex gap-2">
          <Input
            placeholder="Typ een bericht..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isSending}
          />
          <Button onClick={handleSend} disabled={!message.trim() || isSending}>
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
