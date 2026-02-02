"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck, FileText, MessageCircle, FolderKanban, Info, X, Eye, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/use-notifications";
import type { Doc } from "../../convex/_generated/dataModel";

type Notification = Doc<"notifications">;

/**
 * Format timestamp to Dutch relative time string.
 */
function formatTimestamp(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return "Zojuist";
  } else if (diffMins < 60) {
    return `${diffMins} min geleden`;
  } else if (diffHours < 24) {
    return `${diffHours} uur geleden`;
  } else if (diffDays === 1) {
    return "Gisteren";
  } else if (diffDays < 7) {
    return `${diffDays} dagen geleden`;
  } else {
    return date.toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
    });
  }
}

/**
 * Get icon and color for notification type.
 */
function getNotificationIcon(type: string): { icon: React.ElementType; color: string; bgColor: string } {
  if (type.startsWith("offerte_")) {
    switch (type) {
      case "offerte_geaccepteerd":
        return { icon: Check, color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" };
      case "offerte_afgewezen":
        return { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30" };
      case "offerte_bekeken":
        return { icon: Eye, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" };
      case "offerte_verzonden":
        return { icon: Send, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30" };
      default:
        return { icon: FileText, color: "text-muted-foreground", bgColor: "bg-muted" };
    }
  } else if (type.startsWith("chat_")) {
    return { icon: MessageCircle, color: "text-primary", bgColor: "bg-primary/10" };
  } else if (type.startsWith("project_")) {
    return { icon: FolderKanban, color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" };
  } else if (type.startsWith("system_")) {
    return { icon: Info, color: "text-indigo-600", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" };
  }
  return { icon: Bell, color: "text-muted-foreground", bgColor: "bg-muted" };
}

/**
 * Get navigation link for notification.
 */
function getNotificationLink(notification: Notification): string | null {
  if (notification.type.startsWith("offerte_") && notification.offerteId) {
    return `/offertes/${notification.offerteId}`;
  } else if (notification.type.startsWith("project_") && notification.projectId) {
    return `/projecten/${notification.projectId}`;
  }
  // Chat and system notifications don't have specific links for now
  return null;
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: () => void;
  onDismiss: () => void;
  onClose: () => void;
}

function NotificationItem({ notification, onMarkAsRead, onDismiss, onClose }: NotificationItemProps) {
  const { icon: Icon, color, bgColor } = getNotificationIcon(notification.type);
  const link = getNotificationLink(notification);

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkAsRead();
    }
    if (link) {
      onClose();
    }
  };

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg transition-colors group relative",
        notification.isRead
          ? "bg-background hover:bg-muted/50"
          : "bg-muted/50 hover:bg-muted",
        link && "cursor-pointer"
      )}
      onClick={handleClick}
    >
      {/* Icon */}
      <div className={cn("flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center", bgColor)}>
        <Icon className={cn("h-4 w-4", color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className={cn(
            "text-sm truncate",
            notification.isRead ? "font-normal" : "font-medium"
          )}>
            {notification.title}
          </p>
          {!notification.isRead && (
            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatTimestamp(notification.createdAt)}
        </p>
      </div>

      {/* Dismiss button - only show on hover */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        title="Verwijderen"
      >
        <X className="h-3 w-3" />
        <span className="sr-only">Verwijderen</span>
      </Button>
    </div>
  );

  if (link) {
    return <Link href={link}>{content}</Link>;
  }

  return content;
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCounts,
    isLoading,
    hasUnread,
    markAsRead,
    markAllAsRead,
    dismiss
  } = useNotifications({ limit: 20 });

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await markAsRead(notificationId as unknown as Parameters<typeof markAsRead>[0]);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }, [markAsRead]);

  const handleDismiss = useCallback(async (notificationId: string) => {
    try {
      await dismiss(notificationId as unknown as Parameters<typeof dismiss>[0]);
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
    }
  }, [dismiss]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  }, [markAllAsRead]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-11 sm:size-8 shrink-0"
          aria-label={hasUnread ? `${unreadCounts.total} ongelezen meldingen` : "Meldingen"}
        >
          <Bell className="h-4 w-4" />
          {hasUnread && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] font-bold"
            >
              {unreadCounts.total > 99 ? "99+" : unreadCounts.total}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-base">Meldingen</h2>
            {hasUnread && (
              <Badge variant="secondary" className="text-xs">
                {unreadCounts.total} nieuw
              </Badge>
            )}
          </div>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Alles gelezen
            </Button>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm">Laden...</p>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1">Geen meldingen</h3>
              <p className="text-sm text-muted-foreground max-w-[200px]">
                Meldingen over offertes, projecten en systeemwaarschuwingen verschijnen hier.
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification._id}
                  notification={notification}
                  onMarkAsRead={() => handleMarkAsRead(notification._id)}
                  onDismiss={() => handleDismiss(notification._id)}
                  onClose={() => setIsOpen(false)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t px-4 py-2">
            <p className="text-xs text-muted-foreground text-center">
              Swipe naar links om te verwijderen
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
