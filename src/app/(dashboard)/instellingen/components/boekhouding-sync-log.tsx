"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
  CheckCircle,
  Clock,
  AlertTriangle,
  SkipForward,
  Loader2,
  History,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncLogEntry {
  _id: string;
  entityType: string;
  syncStatus: string;
  provider: string;
  errorMessage?: string;
  externalId?: string;
  factuurNummer?: string;
  klantNaam?: string;
  bedrag?: number;
  lastSyncAt?: number;
  createdAt: number;
}

interface BoekhoudingSyncLogProps {
  entries: SyncLogEntry[] | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  synced: { label: "Gesynchroniseerd", variant: "default", icon: CheckCircle },
  pending: { label: "Wachtend", variant: "secondary", icon: Clock },
  syncing: { label: "Bezig...", variant: "secondary", icon: Loader2 },
  error: { label: "Fout", variant: "destructive", icon: AlertTriangle },
  skipped: { label: "Overgeslagen", variant: "outline", icon: SkipForward },
};

const entityTypeLabels: Record<string, string> = {
  factuur: "Factuur",
  creditnota: "Creditnota",
  betaling: "Betaling",
  inkoopfactuur: "Inkoopfactuur",
  contact: "Contact",
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BoekhoudingSyncLog({ entries }: BoekhoudingSyncLogProps) {
  if (!entries || entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Synchronisatie logboek
          </CardTitle>
          <CardDescription>
            Overzicht van recente synchronisaties met het boekhoudpakket
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nog geen synchronisaties uitgevoerd. Facturen worden hier getoond zodra ze
            worden gesynchroniseerd met het boekhoudpakket.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Synchronisatie logboek
        </CardTitle>
        <CardDescription>
          {entries.length} recente synchronisatie(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Factuur</TableHead>
                <TableHead>Klant</TableHead>
                <TableHead className="text-right">Bedrag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Datum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const config = statusConfig[entry.syncStatus] ?? statusConfig.pending;
                const StatusIcon = config.icon;

                return (
                  <TableRow key={entry._id}>
                    <TableCell className="font-medium">
                      {entityTypeLabels[entry.entityType] ?? entry.entityType}
                    </TableCell>
                    <TableCell>
                      {entry.factuurNummer ?? "-"}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={entry.klantNaam}>
                      {entry.klantNaam ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.bedrag != null ? formatCurrency(entry.bedrag) : "-"}
                    </TableCell>
                    <TableCell>
                      {entry.errorMessage ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant={config.variant} className="gap-1 cursor-help">
                                <StatusIcon className={`h-3 w-3 ${entry.syncStatus === "syncing" ? "animate-spin" : ""}`} />
                                {config.label}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="text-xs">{entry.errorMessage}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Badge variant={config.variant} className="gap-1">
                          <StatusIcon className={`h-3 w-3 ${entry.syncStatus === "syncing" ? "animate-spin" : ""}`} />
                          {config.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(entry.lastSyncAt ?? entry.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
