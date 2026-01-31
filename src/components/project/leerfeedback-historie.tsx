"use client";

import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  History,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  Loader2,
  Info,
  ArrowRight,
} from "lucide-react";
import { formatScopeName } from "@/lib/leerfeedback-analyzer";
import { Id } from "../../../convex/_generated/dataModel";

interface HistorieEntry {
  _id: Id<"leerfeedback_historie">;
  scope: string;
  activiteit: string;
  oudeWaarde: number;
  nieuweWaarde: number;
  wijzigingPercentage: number;
  reden: string;
  toegepastDoor: string;
  createdAt: number;
}

interface LeerfeedbackHistorieProps {
  historie: HistorieEntry[];
  onRevert?: (historieId: Id<"leerfeedback_historie">) => Promise<void>;
  isLoading?: boolean;
  showRevertButton?: boolean;
}

const formatDate = (timestamp: number): string => {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
};

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes} minuten geleden`;
  if (hours < 24) return `${hours} uur geleden`;
  if (days < 7) return `${days} dagen geleden`;
  return formatDate(timestamp);
};

const HistorieRow = memo(function HistorieRow({
  entry,
  onRevert,
  showRevertButton,
}: {
  entry: HistorieEntry;
  onRevert?: (historieId: Id<"leerfeedback_historie">) => Promise<void>;
  showRevertButton?: boolean;
}) {
  const [isReverting, setIsReverting] = useState(false);
  const isPositive = entry.wijzigingPercentage > 0;
  const isRevert = entry.reden.startsWith("Teruggedraaid:");

  const handleRevert = async () => {
    if (!onRevert) return;
    setIsReverting(true);
    try {
      await onRevert(entry._id);
    } finally {
      setIsReverting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2 }}
      className={`border-l-2 pl-4 pb-4 ml-4 relative ${
        isRevert
          ? "border-orange-500"
          : isPositive
            ? "border-red-500"
            : "border-blue-500"
      }`}
    >
      {/* Timeline dot */}
      <div
        className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 bg-background ${
          isRevert
            ? "border-orange-500"
            : isPositive
              ? "border-red-500"
              : "border-blue-500"
        }`}
      >
        {isRevert ? (
          <RotateCcw className="h-2 w-2 text-orange-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        ) : isPositive ? (
          <TrendingUp className="h-2 w-2 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        ) : (
          <TrendingDown className="h-2 w-2 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {formatScopeName(entry.scope)}
              </Badge>
              <span className="font-medium text-sm">{entry.activiteit}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{entry.reden}</p>
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 ${
              isRevert
                ? "text-orange-600 bg-orange-100 dark:bg-orange-900/30"
                : isPositive
                  ? "text-red-600 bg-red-100 dark:bg-red-900/30"
                  : "text-blue-600 bg-blue-100 dark:bg-blue-900/30"
            } border-0`}
          >
            {isPositive ? "+" : ""}
            {entry.wijzigingPercentage}%
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="font-mono">
              {entry.oudeWaarde}
            </span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-mono font-medium text-foreground">
              {entry.nieuweWaarde}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatRelativeTime(entry.createdAt)}
          </div>
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {entry.toegepastDoor}
          </div>
        </div>

        {showRevertButton && onRevert && !isRevert && (
          <div className="pt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={isReverting}
                >
                  {isReverting ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RotateCcw className="h-3 w-3 mr-1" />
                  )}
                  Terugdraaien
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Aanpassing terugdraaien</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>
                      Weet je zeker dat je deze aanpassing wilt terugdraaien?
                    </p>
                    <div className="bg-muted rounded-lg p-3 mt-2">
                      <p className="text-sm font-medium">{entry.activiteit}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        De waarde wordt teruggezet van{" "}
                        <span className="font-mono">{entry.nieuweWaarde}</span>{" "}
                        naar{" "}
                        <span className="font-mono">{entry.oudeWaarde}</span>
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRevert}>
                    Terugdraaien
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </motion.div>
  );
});

export const LeerfeedbackHistorie = memo(function LeerfeedbackHistorie({
  historie,
  onRevert,
  isLoading,
  showRevertButton = true,
}: LeerfeedbackHistorieProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
          <p>Historie laden...</p>
        </CardContent>
      </Card>
    );
  }

  if (historie.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Geen aanpassingen gevonden.</p>
          <p className="text-sm mt-1">
            Pas normuren aan via de suggesties om hier historie te zien.
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
          Aanpassingen Historie
        </CardTitle>
        <CardDescription>
          Overzicht van alle doorgevoerde normuur aanpassingen
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2 py-2">
            <AnimatePresence mode="popLayout">
              {historie.map((entry) => (
                <HistorieRow
                  key={entry._id}
                  entry={entry}
                  onRevert={onRevert}
                  showRevertButton={showRevertButton}
                />
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
});

// Compact table view for embedding
export const LeerfeedbackHistorieTable = memo(function LeerfeedbackHistorieTable({
  historie,
  limit = 5,
}: {
  historie: HistorieEntry[];
  limit?: number;
}) {
  const displayedHistorie = historie.slice(0, limit);

  if (historie.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        <Info className="h-5 w-5 mx-auto mb-1 opacity-50" />
        <p className="text-sm">Geen recente aanpassingen</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Activiteit</TableHead>
            <TableHead className="text-right">Wijziging</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayedHistorie.map((entry) => (
            <TableRow key={entry._id}>
              <TableCell className="text-sm text-muted-foreground">
                {formatRelativeTime(entry.createdAt)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {formatScopeName(entry.scope)}
                </Badge>
              </TableCell>
              <TableCell className="font-medium text-sm">
                {entry.activiteit}
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant="outline"
                  className={`${
                    entry.wijzigingPercentage > 0
                      ? "text-red-600 bg-red-100 dark:bg-red-900/30"
                      : "text-blue-600 bg-blue-100 dark:bg-blue-900/30"
                  } border-0`}
                >
                  {entry.wijzigingPercentage > 0 ? "+" : ""}
                  {entry.wijzigingPercentage}%
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {historie.length > limit && (
        <div className="p-2 text-center text-xs text-muted-foreground border-t">
          En {historie.length - limit} meer...
        </div>
      )}
    </div>
  );
});

export default LeerfeedbackHistorie;
