"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ChatTabBadgeProps {
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

function ChatTabBadge({
  label,
  count,
  isActive,
  onClick,
  icon,
}: ChatTabBadgeProps) {
  const hasUnread = typeof count === "number" && count > 0;

  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={
        hasUnread
          ? `${label}, ${count} ongelezen`
          : label
      }
      className={cn(
        "relative gap-1.5 rounded-lg px-3 transition-colors",
        isActive && "bg-accent text-accent-foreground",
        !isActive && "text-muted-foreground"
      )}
    >
      <span className="[&>svg]:size-4 flex items-center">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
      {hasUnread && (
        <Badge
          variant="destructive"
          className="ml-0.5 min-w-[18px] px-1 py-0 text-[10px] leading-[18px]"
        >
          {count > 99 ? "99+" : count}
        </Badge>
      )}
    </Button>
  );
}

export { ChatTabBadge };
export type { ChatTabBadgeProps };
