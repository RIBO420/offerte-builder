"use client";

import React from "react";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  CheckCircle,
  AlertCircle,
  Bell,
  AlertTriangle,
  FileX,
  Scale,
  History,
  Gavel,
  BookOpen,
  Clock,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, formatDate, formatDateShort } from "./types";

// ---------------------------------------------------------------------------
// Aanmaning Status Card
// ---------------------------------------------------------------------------

interface AanmaningStatusCardProps {
  aanmaningStatus: {
    heeftEerste?: boolean;
    heeftTweede?: boolean;
    heeftIngebrekestelling?: boolean;
    totaalVerstuurd: number;
    volgendNiveau?: string | null;
  };
}

export function AanmaningStatusCard({ aanmaningStatus }: AanmaningStatusCardProps) {
  if (aanmaningStatus.totaalVerstuurd <= 0) return null;

  return (
    <SectiePaneel
      titel="Aanmaningen"
      icoon={<Scale aria-hidden="true" />}
      kopbalk
      className={
        aanmaningStatus.heeftIngebrekestelling
          ? "border-status-vervallen-border"
          : aanmaningStatus.heeftTweede
            ? "border-accent-warm/60"
            : aanmaningStatus.heeftEerste
              ? "border-status-herinnering-border"
              : undefined
      }
    >
      <div className="p-4">
        <p className="mb-3 text-[13px] text-muted-foreground">
          {aanmaningStatus.volgendNiveau
            ? `Volgende stap: ${
                aanmaningStatus.volgendNiveau === "eerste_aanmaning" ? "1e Aanmaning" :
                aanmaningStatus.volgendNiveau === "tweede_aanmaning" ? "2e Aanmaning" :
                "Ingebrekestelling"
              }`
            : "Alle niveaus verstuurd"
          }
        </p>
        {/* Escalation level indicators */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`flex-1 h-2 rounded-full ${aanmaningStatus.heeftEerste ? "bg-status-herinnering-dot" : "bg-muted"}`} />
          <div className={`flex-1 h-2 rounded-full ${aanmaningStatus.heeftTweede ? "bg-accent-warm" : "bg-muted"}`} />
          <div className={`flex-1 h-2 rounded-full ${aanmaningStatus.heeftIngebrekestelling ? "bg-destructive" : "bg-muted"}`} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1e Aanmaning</span>
          <span>2e Aanmaning</span>
          <span>Ingebrekestelling</span>
        </div>
      </div>
    </SectiePaneel>
  );
}

// ---------------------------------------------------------------------------
// Herinneringen Historie Card
// ---------------------------------------------------------------------------

interface Herinnering {
  _id: string;
  type: string;
  volgnummer: number;
  emailVerstuurd?: boolean;
  verstuurdAt: number;
  dagenVervallen: number;
  notities?: string;
}

const typeLabelsMap: Record<string, string> = {
  herinnering: "Herinnering",
  eerste_aanmaning: "1e Aanmaning",
  tweede_aanmaning: "2e Aanmaning",
  ingebrekestelling: "Ingebrekestelling",
};

// Escalatietrap: wachten (oker 85) → actief aanmanen (amber 70) → negatief (30);
// ingebrekestelling krijgt dezelfde negatieve tint met een rand als zwaarste stap.
const typeColors: Record<string, string> = {
  herinnering: "bg-status-herinnering text-status-herinnering-text",
  eerste_aanmaning: "bg-status-in-uitvoering text-status-in-uitvoering-text",
  tweede_aanmaning: "bg-status-vervallen text-status-vervallen-text",
  ingebrekestelling: "bg-status-vervallen text-status-vervallen-text border border-status-vervallen-border",
};

const typeIcons: Record<string, typeof Bell> = {
  herinnering: Bell,
  eerste_aanmaning: AlertCircle,
  tweede_aanmaning: AlertTriangle,
  ingebrekestelling: Gavel,
};

const HerinneringItem = React.memo(function HerinneringItem({ h }: { h: Herinnering }) {
  const Icon = typeIcons[h.type] ?? Scale;
  return (
    <div className="flex items-start gap-3">
      <div className={`p-1.5 rounded-full ${typeColors[h.type] ?? "bg-muted"}`}>
        <Icon className="h-3 w-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">
            {typeLabelsMap[h.type] ?? h.type}
          </p>
          <Badge variant="outline" className="text-xs">
            #{h.volgnummer}
          </Badge>
          {h.emailVerstuurd && (
            <Mail className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDate(h.verstuurdAt)} &middot; {h.dagenVervallen} dagen verlopen
        </p>
        {h.notities && (
          <p className="text-xs text-muted-foreground mt-1 truncate" title={h.notities}>
            {h.notities}
          </p>
        )}
      </div>
    </div>
  );
});

interface HerinneringenHistorieProps {
  herinneringen: Herinnering[];
}

export function HerinneringenHistorie({ herinneringen }: HerinneringenHistorieProps) {
  if (herinneringen.length === 0) return null;

  return (
    <SectiePaneel
      titel="Historie"
      icoon={<History aria-hidden="true" />}
      telling={herinneringen.length}
      kopbalk
    >
      <div className="space-y-3 p-4">
        <p className="text-[13px] text-muted-foreground tabular-nums">
          {herinneringen.length} herinnering(en) / aanmaning(en) verstuurd
        </p>
        {herinneringen.map((h) => (
          <HerinneringItem key={h._id} h={h} />
        ))}
      </div>
    </SectiePaneel>
  );
}

// ---------------------------------------------------------------------------
// Creditnota Info Card
// ---------------------------------------------------------------------------

interface CreditnotaInfoProps {
  creditnota: {
    factuurnummer: string;
    factuurdatum: number;
    totaalInclBtw: number;
    creditnotaReden?: string;
  };
}

export function CreditnotaInfo({ creditnota }: CreditnotaInfoProps) {
  return (
    <SectiePaneel
      titel="Creditnota"
      icoon={<FileX aria-hidden="true" className="text-destructive" />}
      kopbalk
      className="border-status-vervallen-border"
    >
      <div className="space-y-2 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Nummer</span>
          <span className="font-medium">{creditnota.factuurnummer}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Datum</span>
          <span className="font-medium">{formatDateShort(creditnota.factuurdatum)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Bedrag</span>
          <span className="font-bold tabular-nums text-destructive">{formatCurrency(creditnota.totaalInclBtw)}</span>
        </div>
        {creditnota.creditnotaReden && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Reden:</span> {creditnota.creditnotaReden}
            </p>
          </>
        )}
      </div>
    </SectiePaneel>
  );
}

// ---------------------------------------------------------------------------
// Boekhouding Sync Status Card (MOD-014)
// ---------------------------------------------------------------------------

interface BoekhoudSyncStatusCardProps {
  syncStatus?: {
    syncStatus: string;
    externalId?: string;
    lastSyncAt?: number;
    syncEntry?: {
      _id: string;
      syncStatus: string;
      errorMessage?: string;
      externalUrl?: string;
      provider: string;
      lastSyncAt?: number;
      retryCount?: number;
    } | null;
  } | null;
}

const syncStatusConfig: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof CheckCircle;
}> = {
  synced: {
    label: "Gesynchroniseerd",
    color: "text-status-betaald-text",
    bgColor: "bg-status-betaald",
    icon: CheckCircle,
  },
  pending: {
    label: "Wacht op synchronisatie",
    color: "text-status-herinnering-text",
    bgColor: "bg-status-herinnering",
    icon: Clock,
  },
  error: {
    label: "Synchronisatie mislukt",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: AlertCircle,
  },
  not_synced: {
    label: "Niet gekoppeld",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    icon: BookOpen,
  },
};

export function BoekhoudSyncStatusCard({ syncStatus }: BoekhoudSyncStatusCardProps) {
  if (!syncStatus) return null;

  const status = syncStatus.syncStatus;
  const config = syncStatusConfig[status] ?? syncStatusConfig.not_synced;
  const StatusIcon = config.icon;
  const entry = syncStatus.syncEntry;

  return (
    <SectiePaneel titel="Boekhouding" icoon={<BookOpen aria-hidden="true" />} kopbalk>
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${config.bgColor}`}>
            {status === "pending" ? (
              <Loader2 className={`h-4 w-4 ${config.color} animate-spin`} />
            ) : (
              <StatusIcon className={`h-4 w-4 ${config.color}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm ${config.color}`}>
              {config.label}
            </p>

            {/* External ID */}
            {syncStatus.externalId && (
              <p className="text-xs text-muted-foreground mt-0.5">
                ID: {syncStatus.externalId}
              </p>
            )}

            {/* Last sync time */}
            {syncStatus.lastSyncAt && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(syncStatus.lastSyncAt).toLocaleDateString("nl-NL", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}

            {/* Provider name */}
            {entry?.provider && (
              <Badge variant="outline" className="mt-1.5 text-xs capitalize">
                {entry.provider.replace("_", " ")}
              </Badge>
            )}
          </div>

          {/* External link */}
          {entry?.externalUrl && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={entry.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>Bekijk in boekhoudpakket</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Error message */}
        {status === "error" && entry?.errorMessage && (
          <div className="rounded-md bg-destructive/10 p-2.5">
            <p className="text-xs text-destructive">
              {entry.errorMessage}
            </p>
            {entry.retryCount != null && entry.retryCount > 0 && (
              <p className="text-xs text-destructive mt-1">
                {entry.retryCount} poging(en) mislukt
              </p>
            )}
          </div>
        )}
      </div>
    </SectiePaneel>
  );
}
