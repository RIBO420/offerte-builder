"use client";

import { useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "./utils";

interface Message {
  _id: string;
  sender: "klant" | "business";
  message: string;
  isRead: boolean;
  createdAt: number;
}

interface ChatCardProps {
  messages: Message[] | undefined;
  chatMessage: string;
  onChatMessageChange: (message: string) => void;
  onSendMessage: () => void;
  isSendingMessage: boolean;
}

export function ChatCard({
  messages,
  chatMessage,
  onChatMessageChange,
  onSendMessage,
  isSendingMessage,
}: ChatCardProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Berichten
          {messages && messages.filter(m => m.sender === "klant" && !m.isRead).length > 0 && (
            <Badge variant="destructive" className="text-xs px-1.5">
              {messages.filter(m => m.sender === "klant" && !m.isRead).length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScrollArea className="h-48 rounded-md border p-2">
          {messages && messages.length > 0 ? (
            <div className="space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg._id}
                  className={cn(
                    "flex",
                    msg.sender === "klant" ? "justify-start" : "justify-end"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[95%] sm:max-w-[85%] rounded-lg px-3 py-1.5 text-xs",
                      msg.sender === "klant"
                        ? "bg-muted"
                        : "bg-primary text-primary-foreground"
                    )}
                  >
                    <p>{msg.message}</p>
                    <p
                      className={cn(
                        "text-[10px] mt-0.5",
                        msg.sender === "klant"
                          ? "text-muted-foreground"
                          : "text-primary-foreground/70"
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
              <MessageSquare className="h-6 w-6 mb-1 opacity-50" />
              <p className="text-xs">Nog geen berichten</p>
            </div>
          )}
        </ScrollArea>
        <div className="flex gap-2">
          <Input
            placeholder="Typ een bericht..."
            value={chatMessage}
            onChange={(e) => onChatMessageChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            disabled={isSendingMessage}
            className="text-sm h-8"
          />
          <Button
            size="sm"
            onClick={onSendMessage}
            disabled={!chatMessage.trim() || isSendingMessage}
            className="h-8 px-3"
          >
            {isSendingMessage ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
