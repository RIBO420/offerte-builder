"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Loader2, Search, UserRound, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

interface NewKlantChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onThreadCreated: (threadId: Id<"chat_threads">) => void;
}

const AVATAR_COLORS = [
  "bg-emerald-600",
  "bg-blue-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-violet-600",
  "bg-cyan-600",
  "bg-orange-600",
  "bg-teal-600",
  "bg-indigo-600",
  "bg-pink-600",
] as const;

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function NewKlantChatDialog({
  open,
  onOpenChange,
  onThreadCreated,
}: NewKlantChatDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const klanten = useQuery(api.klanten.list, open ? {} : "skip");
  const createThread = useMutation(api.chatThreads.createKlantThread);

  const filteredKlanten = useMemo(() => {
    if (!klanten) return [];
    if (!searchQuery.trim()) return klanten;
    const query = searchQuery.toLowerCase().trim();
    return klanten.filter(
      (klant) =>
        klant.naam.toLowerCase().includes(query) ||
        (klant.email && klant.email.toLowerCase().includes(query)) ||
        (klant.telefoon && klant.telefoon.toLowerCase().includes(query)) ||
        (klant.plaats && klant.plaats.toLowerCase().includes(query))
    );
  }, [klanten, searchQuery]);

  async function handleSelectKlant(klantId: Id<"klanten">) {
    setIsCreating(true);
    try {
      const threadId = await createThread({ klantId });
      onThreadCreated(threadId);
      onOpenChange(false);
      setSearchQuery("");
    } catch {
      toast.error("Fout bij aanmaken gesprek");
    } finally {
      setIsCreating(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isCreating) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSearchQuery("");
    }
  }

  const isLoading = open && klanten === undefined;
  const isEmpty = klanten !== undefined && filteredKlanten.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="size-5" />
            Nieuw klantgesprek
          </DialogTitle>
          <DialogDescription>
            Selecteer een klant om een gesprek te starten.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="Zoek op naam, email of plaats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            autoFocus
            aria-label="Zoek klanten"
          />
        </div>

        <ScrollArea className="max-h-[320px]">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
              <p className="text-muted-foreground text-sm">
                Klanten laden...
              </p>
            </div>
          )}

          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <UserRound className="text-muted-foreground size-8" />
              <p className="text-muted-foreground text-sm">
                {searchQuery.trim()
                  ? "Geen klanten gevonden"
                  : "Er zijn nog geen klanten aangemaakt"}
              </p>
            </div>
          )}

          {!isLoading && filteredKlanten.length > 0 && (
            <ul role="list" className="flex flex-col gap-1" aria-label="Beschikbare klanten">
              {filteredKlanten.map((klant) => {
                const initials = getInitials(klant.naam);
                const colorClass = getAvatarColor(klant.naam);

                return (
                  <li key={klant._id}>
                    <button
                      type="button"
                      disabled={isCreating}
                      onClick={() => handleSelectKlant(klant._id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2.5",
                        "transition-colors hover:bg-accent focus-visible:bg-accent",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        "text-left",
                        isCreating && "opacity-50 cursor-not-allowed"
                      )}
                      aria-label={`Start gesprek met ${klant.naam}`}
                    >
                      <Avatar size="default">
                        <AvatarFallback
                          className={cn(colorClass, "text-white text-xs font-medium")}
                        >
                          {initials}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {klant.naam}
                        </p>
                        <p className="text-muted-foreground text-xs truncate">
                          {[klant.email, klant.plaats].filter(Boolean).join(" \u2022 ")}
                        </p>
                      </div>

                      <MessageCircle className="text-muted-foreground size-4 shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
