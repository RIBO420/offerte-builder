"use client";

import { useMemo, useState } from "react";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { formatDate, formatDateTime } from "@/lib/format";
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
 * Betekenis zit nooit in de kleur alleen: de omschrijving draagt het.
 */
const EVENT_KLEUREN = {
  communicatie: {
    dotColor: "bg-status-voorcalculatie-dot",
  },
  gelukt: {
    dotColor: "bg-status-geaccepteerd-dot",
  },
  mislukt: {
    dotColor: "bg-status-afgewezen-dot",
  },
  aandacht: {
    dotColor: "bg-status-herinnering-dot",
  },
  systeem: {
    dotColor: "bg-muted-foreground/50",
  },
} as const;

/** Compact in de zijkolom: de laatste drie, de rest achter "Alles (n)". */
const ZICHTBAAR = 3;

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
        dotColor: "bg-muted-foreground/50",
      });
    }

    if (updatedAt && updatedAt !== createdAt) {
      items.push({
        id: "offerte-updated",
        type: "versie_aangemaakt",
        description: "Laatst gewijzigd",
        timestamp: updatedAt,
        dotColor: "bg-muted-foreground/50",
      });
    }

    // Offerte creation event
    items.push({
      id: "offerte-created",
      type: "versie_aangemaakt",
      description: "Offerte aangemaakt",
      timestamp: createdAt,
      dotColor: "bg-muted-foreground/30",
    });

    // Sort newest first
    items.sort((a, b) => b.timestamp - a.timestamp);

    return items;
  }, [emailLogs, versions, customerResponse, createdAt, updatedAt, verzondenAt]);

  const [alles, setAlles] = useState(false);
  const zichtbaar = alles ? events : events.slice(0, ZICHTBAAR);

  return (
    <SectiePaneel
      titel="Tijdlijn"
      kopbalk
      acties={
        events.length > ZICHTBAAR && (
          <button
            type="button"
            onClick={() => setAlles((a) => !a)}
            aria-expanded={alles}
            className="rounded px-1 text-[13px] text-primary transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {alles ? "Minder" : `Alles (${events.length})`}
          </button>
        )
      }
    >
      <ol className="grid gap-2.5 px-4 py-3 text-[13px]">
        {zichtbaar.map((event) => (
          <li
            key={event.id}
            className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-baseline gap-2.5"
          >
            <span
              aria-hidden="true"
              className={cn("size-2 translate-y-px rounded-full", event.dotColor)}
            />
            <span className="min-w-0 [overflow-wrap:anywhere]">{event.description}</span>
            <time
              dateTime={new Date(event.timestamp).toISOString()}
              title={formatDateTime(event.timestamp)}
              className="text-xs whitespace-nowrap text-muted-foreground tabular-nums"
            >
              {formatDate(event.timestamp)}
            </time>
          </li>
        ))}
      </ol>
    </SectiePaneel>
  );
}
