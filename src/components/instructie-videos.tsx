"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InstructieVideoType = "gazon" | "boomschors" | "verticuteren";

export interface InstructieVideosProps {
  type: InstructieVideoType;
  /** true = alleen links met icoon, false (default) = volledige kaarten */
  compact?: boolean;
  /** Extra CSS klassen voor de wrapper */
  className?: string;
}

interface VideoItem {
  titel: string;
  omschrijving: string;
  href: string;
}

// ---------------------------------------------------------------------------
// Video content per configurator-type
// ---------------------------------------------------------------------------

const VIDEO_CONTENT: Record<InstructieVideoType, { sectietitel: string; videos: VideoItem[] }> = {
  gazon: {
    sectietitel: "Instructievideo's — Gazon",
    videos: [
      {
        titel: "Hoe meet u uw gazon correct op?",
        omschrijving:
          "Stap-voor-stap uitleg over het nauwkeurig opmeten van uw gazonoppervlak, inclusief uitstekende obstakels en onregelmatige vormen.",
        href: "#",
      },
      {
        titel: "Poortbreedte controleren",
        omschrijving:
          "Korte uitleg over het meten van de poortbreedte zodat onze machines en materialen uw tuin goed kunnen bereiken.",
        href: "#",
      },
      {
        titel: "Foto-tips voor uw aanvraag",
        omschrijving:
          "Wat u moet fotograferen voor een zo compleet mogelijke aanvraag: overzichtsfoto's, poort, ondergrond en eventuele obstakels.",
        href: "#",
      },
    ],
  },
  boomschors: {
    sectietitel: "Instructievideo's — Boomschors",
    videos: [
      {
        titel: "Hoeveel boomschors heeft u nodig?",
        omschrijving:
          "Uitleg over de berekening van de benodigde hoeveelheid boomschors op basis van oppervlak en gewenste dikte van de laag.",
        href: "#",
      },
      {
        titel: "Welke boomschors past bij uw tuin?",
        omschrijving:
          "Vergelijking van de verschillende soorten boomschors: grove boomschors, decoratiebark, kokos en andere opties voor uw situatie.",
        href: "#",
      },
    ],
  },
  verticuteren: {
    sectietitel: "Instructievideo's — Verticuteren",
    videos: [
      {
        titel: "Wanneer moet u verticuteren?",
        omschrijving:
          "Seizoensinformatie: het beste tijdstip om te verticuteren en hoe u dit combineert met bemesting en nazorg.",
        href: "#",
      },
      {
        titel: "Gazonconditie beoordelen",
        omschrijving:
          "Hoe u zelf de conditie van uw gazon inschat: aanwezigheid van mos, filtvorm en de dikte van de villaag.",
        href: "#",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Compact variant — simpele linklijst
// ---------------------------------------------------------------------------

function CompactVideos({ videos }: { videos: VideoItem[] }) {
  return (
    <ul className="space-y-2">
      {videos.map((video) => (
        <li key={video.titel}>
          <a
            href={video.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 hover:underline transition-colors group"
          >
            <PlayCircle className="h-4 w-4 flex-shrink-0 text-green-600 group-hover:text-green-800 transition-colors" />
            <span>{video.titel}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Volledige variant — kaartgrid met thumbnail-placeholder
// ---------------------------------------------------------------------------

function VolledigeVideos({ videos }: { videos: VideoItem[] }) {
  return (
    <div
      className={cn(
        "grid gap-4",
        videos.length === 1
          ? "grid-cols-1"
          : videos.length === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      )}
    >
      {videos.map((video) => (
        <div
          key={video.titel}
          className="flex flex-col rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
        >
          {/* Thumbnail placeholder */}
          <div className="relative bg-gray-100 aspect-video flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-gray-100" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/80 shadow">
              <PlayCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col gap-2 p-4">
            <p className="font-semibold text-gray-900 text-sm leading-snug">
              {video.titel}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed flex-1">
              {video.omschrijving}
            </p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-2 w-full gap-2 text-green-700 border-green-200 hover:bg-green-50 hover:text-green-900"
            >
              <a
                href={video.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Bekijk video
                <ExternalLink className="h-3 w-3 ml-auto opacity-60" />
              </a>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hoofd-component
// ---------------------------------------------------------------------------

/**
 * InstructieVideos — Herbruikbaar component met instructievideo-links
 * voor klanten die de configurator gebruiken.
 *
 * Gebruik:
 * ```tsx
 * // Compact (alleen links)
 * <InstructieVideos type="gazon" compact />
 *
 * // Volledige kaartweergave
 * <InstructieVideos type="boomschors" />
 * ```
 */
export function InstructieVideos({
  type,
  compact = false,
  className,
}: InstructieVideosProps) {
  const { sectietitel, videos } = VIDEO_CONTENT[type];

  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Instructievideo&apos;s
        </p>
        <CompactVideos videos={videos} />
      </div>
    );
  }

  return (
    <Card className={cn("border-green-100", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <PlayCircle className="h-5 w-5 text-green-600" />
          {sectietitel}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Bekijk onze instructievideo&apos;s voor hulp bij het invullen van uw aanvraag.
        </p>
      </CardHeader>
      <CardContent>
        <VolledigeVideos videos={videos} />
      </CardContent>
    </Card>
  );
}
