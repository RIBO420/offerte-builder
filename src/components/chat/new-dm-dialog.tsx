"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Loader2, MessageCircle, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface NewDMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectUser: (userId: Id<"users">) => void;
}

/**
 * Deterministic color for avatar initials based on a name string.
 * Returns a Tailwind bg class.
 */
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

/**
 * Translate functie/role to a user-friendly Dutch label.
 */
function getRoleLabel(functie: string | undefined): string {
  if (!functie) return "Medewerker";
  const lower = functie.toLowerCase();
  if (lower === "directie") return "Directie";
  if (lower === "projectleider") return "Projectleider";
  if (lower === "voorman") return "Voorman";
  if (lower === "hovenier") return "Hovenier";
  if (lower === "leerling") return "Leerling";
  // Return the original value with first letter capitalized
  return functie.charAt(0).toUpperCase() + functie.slice(1);
}

export function NewDMDialog({
  open,
  onOpenChange,
  onSelectUser,
}: NewDMDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const users = useQuery(api.chat.getUsersForDM, open ? {} : "skip");

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase().trim();
    return users.filter(
      (user) =>
        user.naam.toLowerCase().includes(query) ||
        (user.email && user.email.toLowerCase().includes(query)) ||
        (user.functie && user.functie.toLowerCase().includes(query))
    );
  }, [users, searchQuery]);

  function handleSelectUser(userId: Id<"users">) {
    onSelectUser(userId);
    onOpenChange(false);
    setSearchQuery("");
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSearchQuery("");
    }
  }

  const isLoading = open && users === undefined;
  const isEmpty = users !== undefined && filteredUsers.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-5" />
            Nieuw Gesprek
          </DialogTitle>
          <DialogDescription>
            Selecteer een collega om een direct bericht te sturen.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="Zoek op naam..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            autoFocus
            aria-label="Zoek gebruikers"
          />
        </div>

        <ScrollArea className="max-h-[320px]">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
              <p className="text-muted-foreground text-sm">
                Gebruikers laden...
              </p>
            </div>
          )}

          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Users className="text-muted-foreground size-8" />
              <p className="text-muted-foreground text-sm">
                {searchQuery.trim()
                  ? "Geen gebruikers gevonden"
                  : "Er zijn geen beschikbare gebruikers"}
              </p>
            </div>
          )}

          {!isLoading && filteredUsers.length > 0 && (
            <ul role="list" className="flex flex-col gap-1" aria-label="Beschikbare gebruikers">
              {filteredUsers.map((user) => {
                const initials = getInitials(user.naam);
                const colorClass = getAvatarColor(user.naam);

                return (
                  <li key={user.userId}>
                    <button
                      type="button"
                      onClick={() => handleSelectUser(user.userId)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2.5",
                        "transition-colors hover:bg-accent focus-visible:bg-accent",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        "text-left"
                      )}
                      aria-label={`Start gesprek met ${user.naam}`}
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
                          {user.naam}
                        </p>
                        <p className="text-muted-foreground text-xs truncate">
                          {user.email}
                        </p>
                      </div>

                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {getRoleLabel(user.functie)}
                      </Badge>

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
