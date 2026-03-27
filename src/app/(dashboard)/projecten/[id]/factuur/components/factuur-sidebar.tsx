"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Receipt,
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
// Totalen Card
// ---------------------------------------------------------------------------

interface FactuurTotalenProps {
  subtotaal: number;
  btwPercentage: number;
  btwBedrag: number;
  totaalInclBtw: number;
}

export function FactuurTotalen({
  subtotaal,
  btwPercentage,
  btwBedrag,
  totaalInclBtw,
}: FactuurTotalenProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Totalen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotaal</span>
          <span className="font-medium">{formatCurrency(subtotaal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">BTW ({btwPercentage}%)</span>
          <span className="font-medium">{formatCurrency(btwBedrag)}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-lg">
          <span className="font-semibold">Totaal incl. BTW</span>
          <span className="font-bold">{formatCurrency(totaalInclBtw)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Status Info Card
// ---------------------------------------------------------------------------

interface FactuurStatusInfoProps {
  factuurStatus: string;
  factuurdatum: number;
  verzondenAt?: number;
  betaaldAt?: number;
  vervaldatum: number;
}

export function FactuurStatusInfo({
  factuurStatus,
  factuurdatum,
  verzondenAt,
  betaaldAt,
  vervaldatum,
}: FactuurStatusInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Informatie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${factuurStatus === 'betaald' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
            <Receipt className={`h-4 w-4 ${factuurStatus === 'betaald' ? 'text-green-600' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className="font-medium">Aangemaakt</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(factuurdatum)}
            </p>
          </div>
        </div>

        {(factuurStatus === 'verzonden' || factuurStatus === 'betaald' || factuurStatus === 'vervallen') && verzondenAt && (
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${factuurStatus === 'betaald' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
              <Mail className={`h-4 w-4 ${factuurStatus === 'betaald' ? 'text-green-600' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="font-medium">Verzonden</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(verzondenAt)}
              </p>
            </div>
          </div>
        )}

        {factuurStatus === 'betaald' && betaaldAt && (
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium">Betaald</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(betaaldAt)}
              </p>
            </div>
          </div>
        )}

        {factuurStatus === 'vervallen' && (
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="font-medium">Vervallen</p>
              <p className="text-sm text-muted-foreground">
                Betalingstermijn verstreken op {formatDate(vervaldatum)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Notities Card
// ---------------------------------------------------------------------------

interface FactuurNotitiesProps {
  notities: string;
}

export function FactuurNotities({ notities }: FactuurNotitiesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notities</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {notities}
        </p>
      </CardContent>
    </Card>
  );
}

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
    <Card className={
      aanmaningStatus.heeftIngebrekestelling
        ? "border-red-200 dark:border-red-900"
        : aanmaningStatus.heeftTweede
          ? "border-orange-200 dark:border-orange-900"
          : aanmaningStatus.heeftEerste
            ? "border-amber-200 dark:border-amber-900"
            : ""
    }>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4" />
          Aanmaningen
        </CardTitle>
        <CardDescription>
          {aanmaningStatus.volgendNiveau
            ? `Volgende stap: ${
                aanmaningStatus.volgendNiveau === "eerste_aanmaning" ? "1e Aanmaning" :
                aanmaningStatus.volgendNiveau === "tweede_aanmaning" ? "2e Aanmaning" :
                "Ingebrekestelling"
              }`
            : "Alle niveaus verstuurd"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Escalation level indicators */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`flex-1 h-2 rounded-full ${aanmaningStatus.heeftEerste ? "bg-amber-400" : "bg-muted"}`} />
          <div className={`flex-1 h-2 rounded-full ${aanmaningStatus.heeftTweede ? "bg-orange-400" : "bg-muted"}`} />
          <div className={`flex-1 h-2 rounded-full ${aanmaningStatus.heeftIngebrekestelling ? "bg-red-500" : "bg-muted"}`} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mb-3">
          <span>1e Aanmaning</span>
          <span>2e Aanmaning</span>
          <span>Ingebrekestelling</span>
        </div>
      </CardContent>
    </Card>
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

const typeColors: Record<string, string> = {
  herinnering: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  eerste_aanmaning: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
  tweede_aanmaning: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  ingebrekestelling: "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-100",
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Historie
        </CardTitle>
        <CardDescription>
          {herinneringen.length} herinnering(en) / aanmaning(en) verstuurd
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {herinneringen.map((h) => (
          <HerinneringItem key={h._id} h={h} />
        ))}
      </CardContent>
    </Card>
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
    <Card className="border-red-200 dark:border-red-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <FileX className="h-4 w-4" />
          Creditnota
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
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
          <span className="font-bold text-red-600">{formatCurrency(creditnota.totaalInclBtw)}</span>
        </div>
        {creditnota.creditnotaReden && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Reden:</span> {creditnota.creditnotaReden}
            </p>
          </>
        )}
      </CardContent>
    </Card>
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
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    icon: CheckCircle,
  },
  pending: {
    label: "Wacht op synchronisatie",
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    icon: Clock,
  },
  error: {
    label: "Synchronisatie mislukt",
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4" />
          Boekhouding
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
          <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-2.5">
            <p className="text-xs text-red-700 dark:text-red-300">
              {entry.errorMessage}
            </p>
            {entry.retryCount != null && entry.retryCount > 0 && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                {entry.retryCount} poging(en) mislukt
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
