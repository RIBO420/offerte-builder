"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, Send, Loader2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Id } from "../../../convex/_generated/dataModel";

interface OfferteChatProps {
  offerteId: Id<"offertes">;
  klantNaam: string;
  compact?: boolean;
  inline?: boolean; // Removes Card wrapper for embedding
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

export function OfferteChat({ offerteId, klantNaam, compact = false, inline = false }: OfferteChatProps) {
  const messages = useQuery(api.offerteMessages.listByOfferte, { offerteId });
  const unreadCount = useQuery(api.offerteMessages.getUnreadCount, { offerteId });
  const sendMessage = useMutation(api.offerteMessages.sendFromBusiness);
  const markAsRead = useMutation(api.offerteMessages.markAsRead);

  const [message, setMessage] = useState("");
  const [expandedMessage, setExpandedMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const expandedMessagesEndRef = useRef<HTMLDivElement>(null);

  // Mark messages as read when viewing
  useEffect(() => {
    if (unreadCount && unreadCount > 0) {
      markAsRead({ offerteId }).catch(console.error);
    }
  }, [unreadCount, offerteId, markAsRead]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    expandedMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const handleExpandedSend = async () => {
    if (!expandedMessage.trim()) return;
    setIsSending(true);
    try {
      await sendMessage({ offerteId, message: expandedMessage.trim() });
      setExpandedMessage("");
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const renderMessages = (scrollRef: React.RefObject<HTMLDivElement | null>, isLarge = false) => (
    messages && messages.length > 0 ? (
      <div className={isLarge ? "space-y-3" : (compact || inline ? "space-y-2" : "space-y-4")}>
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
                "rounded-lg",
                isLarge ? "max-w-[80%] px-4 py-2" : (compact || inline ? "max-w-[85%] px-2 py-1" : "max-w-[80%] px-4 py-2"),
                msg.sender === "bedrijf"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              {isLarge && (
                <p className="text-xs font-medium mb-1">
                  {msg.sender === "bedrijf" ? "Jij" : klantNaam}
                </p>
              )}
              <p className={isLarge ? "text-sm" : (compact || inline ? "text-[11px]" : "text-sm")}>{msg.message}</p>
              <p
                className={cn(
                  isLarge ? "text-xs mt-1" : (compact || inline ? "text-[9px] mt-0.5" : "text-xs mt-1"),
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
        <div ref={scrollRef} />
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <MessageSquare className={isLarge ? "h-8 w-8 mb-2 opacity-50" : (compact || inline ? "h-5 w-5 mb-1 opacity-50" : "h-8 w-8 mb-2 opacity-50")} />
        <p className={isLarge ? "text-sm" : (compact || inline ? "text-[10px]" : "text-sm")}>Nog geen berichten</p>
        {isLarge && <p className="text-xs">Start een gesprek met de klant</p>}
      </div>
    )
  );

  const chatContent = (
    <div className={cn(inline ? "h-full flex flex-col space-y-2" : (compact ? "space-y-3" : undefined))}>
      <div className="relative">
        <ScrollArea className={cn(
          "rounded-md border",
          inline ? "h-[120px] p-2" : (compact ? "h-48 p-2" : "h-64 p-4")
        )}>
          {renderMessages(messagesEndRef)}
        </ScrollArea>
        {(compact || inline) && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-1 right-1 h-6 w-6 p-0 opacity-60 hover:opacity-100"
            onClick={() => setIsExpanded(true)}
            title="Vergroot chat"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          placeholder="Bericht..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isSending}
          className={cn(compact || inline ? "text-xs h-7" : undefined)}
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || isSending}
          size="sm"
          className={cn(compact || inline ? "h-7 px-2" : "h-8 px-3")}
        >
          {isSending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );

  const expandedDialog = (
    <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="block">Chat met {klantNaam}</span>
              {unreadCount && unreadCount > 0 ? (
                <span className="text-sm font-normal text-muted-foreground">
                  {unreadCount} ongelezen bericht{unreadCount > 1 ? "en" : ""}
                </span>
              ) : (
                <span className="text-sm font-normal text-muted-foreground">
                  {messages?.length || 0} bericht{messages?.length !== 1 ? "en" : ""}
                </span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 py-4">
          <ScrollArea className="h-[400px] rounded-lg border bg-muted/30 p-4">
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
                        "max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm",
                        msg.sender === "bedrijf"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-background border rounded-bl-md"
                      )}
                    >
                      <p className="text-xs font-medium mb-1 opacity-70">
                        {msg.sender === "bedrijf" ? "Jij" : klantNaam}
                      </p>
                      <p className="text-sm leading-relaxed">{msg.message}</p>
                      <p
                        className={cn(
                          "text-[10px] mt-1.5 opacity-60",
                          msg.sender === "bedrijf"
                            ? "text-primary-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatDateTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={expandedMessagesEndRef} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <MessageSquare className="h-8 w-8 opacity-50" />
                </div>
                <p className="text-base font-medium">Nog geen berichten</p>
                <p className="text-sm mt-1">Start een gesprek met {klantNaam}</p>
              </div>
            )}
          </ScrollArea>
        </div>
        <div className="pt-4 border-t">
          <div className="flex gap-3">
            <Input
              placeholder={`Bericht aan ${klantNaam}...`}
              value={expandedMessage}
              onChange={(e) => setExpandedMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleExpandedSend();
                }
              }}
              disabled={isSending}
              className="flex-1 h-11"
            />
            <Button
              onClick={handleExpandedSend}
              disabled={!expandedMessage.trim() || isSending}
              className="h-11 px-6"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Verstuur
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Druk op Enter om te versturen
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Inline mode: return content with dialog
  if (inline) {
    return (
      <>
        {chatContent}
        {expandedDialog}
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className={compact ? "pb-2" : undefined}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={cn("flex items-center gap-2", compact && "text-base")}>
                <MessageSquare className={compact ? "h-4 w-4" : "h-5 w-5"} />
                Berichten
                {unreadCount && unreadCount > 0 && (
                  <Badge variant="destructive" className={compact ? "text-xs px-1.5" : "ml-2"}>
                    {unreadCount}{compact ? "" : " nieuw"}
                  </Badge>
                )}
              </CardTitle>
              {!compact && <CardDescription>Chat met {klantNaam}</CardDescription>}
            </div>
            {compact && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setIsExpanded(true)}
                title="Vergroot chat"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className={compact ? "space-y-3" : undefined}>
          {chatContent}
        </CardContent>
      </Card>
      {expandedDialog}
    </>
  );
}
