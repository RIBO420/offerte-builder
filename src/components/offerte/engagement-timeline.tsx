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
  MailCheck,
  MailX,
  MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────

type TimelineEventType =
  | "email_verzonden"
  | "email_delivered"
  | "email_geopend"
  | "email_mislukt"
  | "email_bounced"
  | "email_clicked"
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
  deliveredAt?: number;
  bouncedAt?: number;
  clickedAt?: number;
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
  /** Systeemdatums (voorheen aparte Tijdlijn-card) als events tussen de klant-events */
  updatedAt?: number;
  verzondenAt?: number;
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

/**
 * Kleurtoekenning per event, uitsluitend uit de Loof & Leem-tokens
 * (ui-lessen-v7 les 2 — geen rauwe paletkleuren, geen paars/indigo):
 * - mailverkeer (verzonden/geopend/geklikt) = de steenblauwe communicatiezone
 *   via de `status-voorcalculatie`-familie (dat ís de 245-receptuur;
 *   `status-verzonden` is in de tokens oker);
 * - afgeleverd en geaccepteerd = `status-geaccepteerd`;
 * - mislukt/bounced/afgewezen = `status-afgewezen`;
 * - bekeken en klantvraag = `status-herinnering` (amber, vraagt aandacht);
 * - systeemdatums = gedempt grijs.
 * Betekenis zit nooit in de kleur alleen: icoon + omschrijving dragen het.
 */
const EVENT_KLEUREN = {
  communicatie: {
    iconColor: "text-status-voorcalculatie-text",
    dotColor: "bg-status-voorcalculatie-dot",
  },
  gelukt: {
    iconColor: "text-status-geaccepteerd-text",
    dotColor: "bg-status-geaccepteerd-dot",
  },
  mislukt: {
    iconColor: "text-status-afgewezen-text",
    dotColor: "bg-status-afgewezen-dot",
  },
  aandacht: {
    iconColor: "text-status-herinnering-text",
    dotColor: "bg-status-herinnering-dot",
  },
  systeem: {
    iconColor: "text-muted-foreground",
    dotColor: "bg-muted-foreground/50",
  },
} as const;

// ── Component ──────────────────────────────────────────────────────────

export function EngagementTimeline({
  emailLogs,
  versions,
  customerResponse,
  createdAt,
  updatedAt,
  verzondenAt,
}: EngagementTimelineProps) {
  const events = useMemo(() => {
    const items: TimelineEvent[] = [];

    // Email events
    for (const log of emailLogs) {
      const typeLabel = EMAIL_TYPE_LABELS[log.type] ?? "Email";

      // Email sent
      items.push({
        id: `email-sent-${log._id}`,
        type: log.status === "mislukt" ? "email_mislukt" :
              log.status === "bounced" ? "email_bounced" : "email_verzonden",
        description:
          log.status === "mislukt"
            ? `${typeLabel} verzenden mislukt naar ${log.to}`
            : log.status === "bounced"
              ? `${typeLabel} kon niet worden afgeleverd bij ${log.to}`
              : `${typeLabel} verstuurd naar ${log.to}`,
        timestamp: log.createdAt,
        icon:
          log.status === "mislukt" || log.status === "bounced" ? (
            <AlertCircle className="h-3.5 w-3.5" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          ),
        ...(log.status === "mislukt" || log.status === "bounced"
          ? EVENT_KLEUREN.mislukt
          : EVENT_KLEUREN.communicatie),
      });

      // Email delivered
      if (log.deliveredAt) {
        items.push({
          id: `email-delivered-${log._id}`,
          type: "email_delivered",
          description: `${typeLabel} afgeleverd`,
          timestamp: log.deliveredAt,
          icon: <MailCheck className="h-3.5 w-3.5" />,
          ...EVENT_KLEUREN.gelukt,
        });
      }

      // Email opened
      if (log.openedAt) {
        items.push({
          id: `email-opened-${log._id}`,
          type: "email_geopend",
          description: `${typeLabel} geopend`,
          timestamp: log.openedAt,
          icon: <Eye className="h-3.5 w-3.5" />,
          ...EVENT_KLEUREN.communicatie,
        });
      }

      // Email clicked
      if (log.clickedAt) {
        items.push({
          id: `email-clicked-${log._id}`,
          type: "email_clicked",
          description: `Link in ${typeLabel.toLowerCase()} aangeklikt`,
          timestamp: log.clickedAt,
          icon: <MousePointerClick className="h-3.5 w-3.5" />,
          ...EVENT_KLEUREN.communicatie,
        });
      }

      // Email bounced
      if (log.bouncedAt) {
        items.push({
          id: `email-bounced-${log._id}`,
          type: "email_bounced",
          description: `${typeLabel} geweigerd door mailserver`,
          timestamp: log.bouncedAt,
          icon: <MailX className="h-3.5 w-3.5" />,
          ...EVENT_KLEUREN.mislukt,
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
        ...EVENT_KLEUREN.aandacht,
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
        ...EVENT_KLEUREN.gelukt,
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
        ...EVENT_KLEUREN.mislukt,
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
        ...EVENT_KLEUREN.aandacht,
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
        iconColor: "text-muted-foreground",
        dotColor: "bg-muted-foreground/50",
      });
    }

    // Systeemdatums als events (voorheen de aparte Tijdlijn-card)
    if (verzondenAt) {
      items.push({
        id: "offerte-verzonden",
        type: "email_verzonden",
        description: "Offerte verzonden",
        timestamp: verzondenAt,
        icon: <Mail className="h-3.5 w-3.5" />,
        iconColor: "text-muted-foreground",
        dotColor: "bg-muted-foreground/50",
      });
    }

    if (updatedAt && updatedAt !== createdAt) {
      items.push({
        id: "offerte-updated",
        type: "versie_aangemaakt",
        description: "Laatst gewijzigd",
        timestamp: updatedAt,
        icon: <History className="h-3.5 w-3.5" />,
        iconColor: "text-muted-foreground",
        dotColor: "bg-muted-foreground/50",
      });
    }

    // Offerte creation event
    items.push({
      id: "offerte-created",
      type: "versie_aangemaakt",
      description: "Offerte aangemaakt",
      timestamp: createdAt,
      icon: <Clock className="h-3.5 w-3.5" />,
      iconColor: "text-muted-foreground",
      dotColor: "bg-muted-foreground/30",
    });

    // Sort newest first
    items.sort((a, b) => b.timestamp - a.timestamp);

    return items;
  }, [emailLogs, versions, customerResponse, createdAt, updatedAt, verzondenAt]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Tijdlijn
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
                    {/* Binnenste stip is een "gat" in de gekleurde stip en
                        moet dus de paginakleur volgen, net als de border. */}
                    <div className="h-1.5 w-1.5 rounded-full bg-background" />
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
