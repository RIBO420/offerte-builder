"use client";

import { memo, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Info,
} from "lucide-react";
import {
  type ScopeAfwijking,
  getDeviationColor,
  formatDeviation,
  getScopeDisplayName,
} from "@/lib/nacalculatie-calculator";

type SortField = "scope" | "geplandeUren" | "werkelijkeUren" | "afwijkingPercentage";
type SortDirection = "asc" | "desc";

interface AfwijkingenTabelProps {
  afwijkingen: ScopeAfwijking[];
  onScopeClick?: (scope: string) => void;
}

const StatusIcon = memo(function StatusIcon({
  status,
}: {
  status: "good" | "warning" | "critical";
}) {
  switch (status) {
    case "good":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "critical":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
  }
});

const SortButton = memo(function SortButton({
  field,
  currentField,
  currentDirection,
  onClick,
  children,
}: {
  field: SortField;
  currentField: SortField;
  currentDirection: SortDirection;
  onClick: (field: SortField) => void;
  children: React.ReactNode;
}) {
  const isActive = field === currentField;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 -ml-3 font-medium hover:bg-muted/50"
      onClick={() => onClick(field)}
    >
      {children}
      {isActive ? (
        currentDirection === "asc" ? (
          <ArrowUp className="ml-2 h-3 w-3" />
        ) : (
          <ArrowDown className="ml-2 h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
      )}
    </Button>
  );
});

export const AfwijkingenTabel = memo(function AfwijkingenTabel({
  afwijkingen,
  onScopeClick,
}: AfwijkingenTabelProps) {
  const [sortField, setSortField] = useState<SortField>("afwijkingPercentage");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedAfwijkingen = useMemo(() => {
    return [...afwijkingen].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "scope":
          comparison = a.scope.localeCompare(b.scope);
          break;
        case "geplandeUren":
          comparison = a.geplandeUren - b.geplandeUren;
          break;
        case "werkelijkeUren":
          comparison = a.werkelijkeUren - b.werkelijkeUren;
          break;
        case "afwijkingPercentage":
          comparison =
            Math.abs(a.afwijkingPercentage) - Math.abs(b.afwijkingPercentage);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [afwijkingen, sortField, sortDirection]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const critical = afwijkingen.filter((a) => a.status === "critical").length;
    const warning = afwijkingen.filter((a) => a.status === "warning").length;
    const good = afwijkingen.filter((a) => a.status === "good").length;
    return { critical, warning, good };
  }, [afwijkingen]);

  if (afwijkingen.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Geen afwijkingen per scope beschikbaar.</p>
          <p className="text-sm">
            Controleer of urenregistraties een scope hebben.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Afwijkingen per Scope</CardTitle>
            <CardDescription>
              Vergelijking geplande vs werkelijke uren per werkgebied
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {summary.critical > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {summary.critical} kritiek
              </Badge>
            )}
            {summary.warning > 0 && (
              <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                <AlertTriangle className="h-3 w-3" />
                {summary.warning} aandacht
              </Badge>
            )}
            {summary.good > 0 && (
              <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="h-3 w-3" />
                {summary.good} goed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>
                  <SortButton
                    field="scope"
                    currentField={sortField}
                    currentDirection={sortDirection}
                    onClick={handleSort}
                  >
                    Scope
                  </SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton
                    field="geplandeUren"
                    currentField={sortField}
                    currentDirection={sortDirection}
                    onClick={handleSort}
                  >
                    Gepland
                  </SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton
                    field="werkelijkeUren"
                    currentField={sortField}
                    currentDirection={sortDirection}
                    onClick={handleSort}
                  >
                    Werkelijk
                  </SortButton>
                </TableHead>
                <TableHead className="text-right">Afwijking (uren)</TableHead>
                <TableHead className="text-right">
                  <SortButton
                    field="afwijkingPercentage"
                    currentField={sortField}
                    currentDirection={sortDirection}
                    onClick={handleSort}
                  >
                    Afwijking (%)
                  </SortButton>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {sortedAfwijkingen.map((afwijking, index) => {
                  const colors = getDeviationColor(afwijking.status);

                  return (
                    <motion.tr
                      key={afwijking.scope}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className={`border-b transition-colors hover:bg-muted/50 ${
                        onScopeClick ? "cursor-pointer" : ""
                      }`}
                      onClick={() => onScopeClick?.(afwijking.scope)}
                    >
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <StatusIcon status={afwijking.status} />
                            </TooltipTrigger>
                            <TooltipContent>
                              {afwijking.status === "good" &&
                                "Binnen acceptabele afwijking"}
                              {afwijking.status === "warning" &&
                                "Aandacht vereist"}
                              {afwijking.status === "critical" &&
                                "Significante afwijking"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="font-medium">
                        {getScopeDisplayName(afwijking.scope)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {afwijking.geplandeUren} uur
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {afwijking.werkelijkeUren} uur
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${colors.text}`}>
                        {afwijking.afwijkingUren > 0 ? "+" : ""}
                        {afwijking.afwijkingUren} uur
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={`${colors.text} ${colors.bg} border-0`}
                        >
                          {formatDeviation(afwijking.afwijkingPercentage)}
                        </Badge>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span>{"<= 5%"} afwijking</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
            <span>{"5-15%"} afwijking</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-red-500" />
            <span>{"> 15%"} afwijking</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default AfwijkingenTabel;
