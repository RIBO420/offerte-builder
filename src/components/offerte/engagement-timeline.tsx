"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Mail,
  Eye,
  CheckCircle,
  XCircle,
  MessageSquare,
  History,
  Clock,
  AlertCircle,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────

type TimelineEventType =
  | "email_verzonden"
  | "email_geopend"
  | "email_mislukt"
  | "offerte_bekeken"
  | "offerte_geaccepteerd"
  | "offerte_afgewezen"
  | "klant_vraag"
  | "versie_aangemaakt";

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  description: string;
  timestamp: number;
  icon: React.ReactNode;
  iconColor: string;
  dotColor: string;
}

interface EmailLog {
  _id: string;
  type: string;
  to: string;
  status: string;
  createdAt: number;
  openedAt?: number;
}

interface OfferteVersion {
  _id: string;
  versieNummer: number;
  actie: string;
  omschrijving: string;
  createdAt: number;
}

interface CustomerResponse {
  status: string;
  viewedAt?: number;
  respondedAt?: number;
  comment?: string;
}

interface EngagementTimelineProps {
  emailLogs: EmailLog[];
  versions: OfferteVersion[];
  customerResponse?: CustomerResponse;
  createdAt: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return "Zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  if (hours < 24) return `${hours} uur geleden`;
  if (days === 1) return "Gisteren";
  if (days < 7) return `${days} dagen geleden`;
  if (weeks === 1) return "1 week geleden";
  if (weeks < 5) return `${weeks} weken geleden`;
  if (months === 1) return "1 maand geleden";
  return `${months} maanden geleden`;
}

function formatAbsoluteTime(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  offerte_verzonden: "Offerte",
  herinnering: "Herinnering",
  bedankt: "Bedankmail",
};

// ── Component ──────────────────────────────────────────────────────────

export function EngagementTimeline({
  emailLogs,
  versions,
  customerResponse,
  createdAt,
}: EngagementTimelineProps) {
  const events = useMemo(() => {
    const items: TimelineEvent[] = [];

    // Email events
    for (const log of emailLogs) {
      const typeLabel = EMAIL_TYPE_LABELS[log.type] ?? "Email";

      // Email sent
      items.push({
        id: `email-sent-${log._id}`,
        type: log.status === "mislukt" ? "email_mislukt" : "email_verzonden",
        description:
          log.status === "mislukt"
            ? `${typeLabel} verzenden mislukt naar ${log.to}`
            : `${typeLabel} verstuurd naar ${log.to}`,
        timestamp: log.createdAt,
        icon:
          log.status === "mislukt" ? (
            <AlertCircle className="h-3.5 w-3.5" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          ),
        iconColor:
          log.status === "mislukt"
            ? "text-red-500"
            : "text-blue-500",
        dotColor:
          log.status === "mislukt"
            ? "bg-red-500"
            : "bg-blue-500",
      });

      // Email opened
      if (log.status === "geopend" && log.openedAt) {
        items.push({
          id: `email-opened-${log._id}`,
          type: "email_geopend",
          description: "Email geopend",
          timestamp: log.openedAt,
          icon: <Eye className="h-3.5 w-3.5" />,
          iconColor: "text-purple-500",
          dotColor: "bg-purple-500",
        });
      }
    }

    // Customer response events
    if (customerResponse?.viewedAt) {
      items.push({
        id: "customer-viewed",
        type: "offerte_bekeken",
        description: "Offerte bekeken door klant",
        timestamp: customerResponse.viewedAt,
        icon: <Eye className="h-3.5 w-3.5" />,
        iconColor: "text-amber-500",
        dotColor: "bg-amber-500",
      });
    }

    if (
      customerResponse?.status === "geaccepteerd" &&
      customerResponse.respondedAt
    ) {
      items.push({
        id: "customer-accepted",
        type: "offerte_geaccepteerd",
        description: "Offerte geaccepteerd door klant",
        timestamp: customerResponse.respondedAt,
        icon: <CheckCircle className="h-3.5 w-3.5" />,
        iconColor: "text-green-500",
        dotColor: "bg-green-500",
      });
    }

    if (
      customerResponse?.status === "afgewezen" &&
      customerResponse.respondedAt
    ) {
      items.push({
        id: "customer-rejected",
        type: "offerte_afgewezen",
        description: "Offerte afgewezen door klant",
        timestamp: customerResponse.respondedAt,
        icon: <XCircle className="h-3.5 w-3.5" />,
        iconColor: "text-red-500",
        dotColor: "bg-red-500",
      });
    }

    if (
      customerResponse?.comment &&
      customerResponse.status === "bekeken" &&
      customerResponse.respondedAt
    ) {
      items.push({
        id: "customer-question",
        type: "klant_vraag",
        description: "Klant heeft een vraag gesteld",
        timestamp: customerResponse.respondedAt,
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        iconColor: "text-orange-500",
        dotColor: "bg-orange-500",
      });
    }

    // Version events (skip first "aangemaakt" — we show creation separately)
    for (const version of versions) {
      if (version.actie === "aangemaakt") continue;

      items.push({
        id: `version-${version._id}`,
        type: "versie_aangemaakt",
        description: version.omschrijving || `Versie ${version.versieNummer} aangemaakt`,
        timestamp: version.createdAt,
        icon: <History className="h-3.5 w-3.5" />,
        iconColor: "text-slate-500",
        dotColor: "bg-slate-400",
      });
    }

    // Offerte creation event
    items.push({
      id: "offerte-created",
      type: "versie_aangemaakt",
      description: "Offerte aangemaakt",
      timestamp: createdAt,
      icon: <Clock className="h-3.5 w-3.5" />,
      iconColor: "text-slate-400",
      dotColor: "bg-slate-300",
    });

    // Sort newest first
    items.sort((a, b) => b.timestamp - a.timestamp);

    return items;
  }, [emailLogs, versions, customerResponse, createdAt]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Klantactiviteit
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nog geen activiteit
          </p>
        ) : (
          <TooltipProvider delayDuration={300}>
            <div className="relative space-y-0">
              {/* Vertical line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

              {events.map((event, index) => (
                <div
                  key={event.id}
                  className={cn(
                    "relative flex items-start gap-3 py-2",
                    index === 0 && "pt-0"
                  )}
                >
                  {/* Dot on timeline */}
                  <div
                    className={cn(
                      "relative z-10 mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-background flex items-center justify-center",
                      event.dotColor
                    )}
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1.5">
                      <span className={cn("shrink-0 mt-0.5", event.iconColor)}>
                        {event.icon}
                      </span>
                      <p className="text-xs leading-snug text-foreground truncate">
                        {event.description}
                      </p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-[11px] text-muted-foreground mt-0.5 ml-5 cursor-default">
                          {formatRelativeTime(event.timestamp)}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">
                        {formatAbsoluteTime(event.timestamp)}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
