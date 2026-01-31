"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  ArrowRight,
} from "lucide-react";
import {
  type ScopeSuggestie,
  type ActiviteitSuggestie,
  formatScopeName,
  getConfidenceColor,
  getConfidenceBadgeVariant,
  getSuggestionTypeColor,
  validateSuggestion,
} from "@/lib/leerfeedback-analyzer";

interface NormuurSuggestieCardProps {
  suggestie: ScopeSuggestie;
  onApply: (
    normuurId: string,
    nieuweWaarde: number,
    reden: string,
    bronProjecten: string[]
  ) => Promise<void>;
  isApplying?: boolean;
}

const ConfidenceBadge = memo(function ConfidenceBadge({
  level,
}: {
  level: "laag" | "gemiddeld" | "hoog";
}) {
  const labels = {
    laag: "Lage betrouwbaarheid",
    gemiddeld: "Gemiddelde betrouwbaarheid",
    hoog: "Hoge betrouwbaarheid",
  };

  return (
    <Badge variant={getConfidenceBadgeVariant(level)} className="gap-1">
      {level === "hoog" && <CheckCircle className="h-3 w-3" />}
      {level === "gemiddeld" && <Info className="h-3 w-3" />}
      {level === "laag" && <AlertTriangle className="h-3 w-3" />}
      {labels[level]}
    </Badge>
  );
});

const ActiviteitRow = memo(function ActiviteitRow({
  activiteit,
  onApply,
  isApplying,
  reden,
  bronProjecten,
}: {
  activiteit: ActiviteitSuggestie;
  onApply: (
    normuurId: string,
    nieuweWaarde: number,
    reden: string,
    bronProjecten: string[]
  ) => Promise<void>;
  isApplying?: boolean;
  reden: string;
  bronProjecten: string[];
}) {
  const [applying, setApplying] = useState(false);
  const isPositive = activiteit.wijzigingPercentage > 0;

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply(
        activiteit.normuurId,
        activiteit.gesuggereerdeWaarde,
        reden,
        bronProjecten
      );
    } finally {
      setApplying(false);
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{activiteit.activiteit}</TableCell>
      <TableCell className="text-right tabular-nums">
        {activiteit.huidigeWaarde} {activiteit.eenheid}
      </TableCell>
      <TableCell className="text-center">
        <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {activiteit.gesuggereerdeWaarde} {activiteit.eenheid}
      </TableCell>
      <TableCell className="text-right">
        <Badge
          variant="outline"
          className={
            isPositive
              ? "text-red-600 bg-red-100 dark:bg-red-900/30 border-0"
              : "text-blue-600 bg-blue-100 dark:bg-blue-900/30 border-0"
          }
        >
          {isPositive ? "+" : ""}
          {activiteit.wijzigingPercentage}%
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={applying || isApplying}>
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Toepassen"
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Normuur aanpassen</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  Weet je zeker dat je de normuur voor{" "}
                  <strong>{activiteit.activiteit}</strong> wilt aanpassen?
                </p>
                <div className="bg-muted rounded-lg p-3 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Huidige waarde:</span>
                    <span className="font-medium">
                      {activiteit.huidigeWaarde} {activiteit.eenheid}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm">Nieuwe waarde:</span>
                    <span className="font-medium">
                      {activiteit.gesuggereerdeWaarde} {activiteit.eenheid}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm">Wijziging:</span>
                    <span
                      className={`font-medium ${isPositive ? "text-red-600" : "text-blue-600"}`}
                    >
                      {isPositive ? "+" : ""}
                      {activiteit.wijzigingPercentage}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Deze aanpassing wordt gelogd en kan later worden teruggedraaid.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuleren</AlertDialogCancel>
              <AlertDialogAction onClick={handleApply}>
                Bevestigen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
});

export const NormuurSuggestieCard = memo(function NormuurSuggestieCard({
  suggestie,
  onApply,
  isApplying,
}: NormuurSuggestieCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const typeColors = getSuggestionTypeColor(suggestie.type);
  const validation = validateSuggestion(suggestie);
  const TrendIcon =
    suggestie.type === "onderschatting" ? TrendingUp : TrendingDown;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden">
        <div
          className={`absolute top-0 left-0 w-1 h-full ${
            suggestie.type === "onderschatting"
              ? "bg-red-500"
              : "bg-blue-500"
          }`}
        />
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <TrendIcon
                  className={`h-5 w-5 ${typeColors.text}`}
                />
                {formatScopeName(suggestie.scope)}
              </CardTitle>
              <CardDescription>{suggestie.reden}</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge
                variant="outline"
                className={`${typeColors.text} ${typeColors.bg} border-0`}
              >
                {suggestie.type === "onderschatting"
                  ? `+${Math.abs(suggestie.gemiddeldeAfwijkingPercentage)}%`
                  : `-${Math.abs(suggestie.gemiddeldeAfwijkingPercentage)}%`}
              </Badge>
              <ConfidenceBadge level={suggestie.betrouwbaarheid} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-2 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Gem. afwijking</p>
              <p className="text-lg font-semibold">
                {suggestie.gemiddeldeAfwijking > 0 ? "+" : ""}
                {suggestie.gemiddeldeAfwijking} uur
              </p>
            </div>
            <div className="text-center p-2 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Projecten</p>
              <p className="text-lg font-semibold">
                {suggestie.aantalProjecten}
              </p>
            </div>
            <div className="text-center p-2 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Activiteiten</p>
              <p className="text-lg font-semibold">
                {suggestie.activiteiten.length}
              </p>
            </div>
          </div>

          {/* Warnings */}
          {!validation.valid && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    Let op
                  </p>
                  <ul className="text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                    {validation.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Collapsible activities table */}
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between"
                size="sm"
              >
                <span>
                  {isOpen ? "Verberg" : "Toon"} activiteiten (
                  {suggestie.activiteiten.length})
                </span>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Activiteit</TableHead>
                      <TableHead className="text-right">Huidig</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="text-right">Nieuw</TableHead>
                      <TableHead className="text-right">Wijziging</TableHead>
                      <TableHead className="text-right">Actie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggestie.activiteiten.map((activiteit) => (
                      <ActiviteitRow
                        key={activiteit.normuurId}
                        activiteit={activiteit}
                        onApply={onApply}
                        isApplying={isApplying}
                        reden={suggestie.reden}
                        bronProjecten={suggestie.bronProjecten}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground border-t pt-4">
          <Info className="h-3 w-3 mr-1" />
          Gebaseerd op {suggestie.aantalProjecten} afgeronde projecten. Pas
          individuele activiteiten aan of bekijk de details.
        </CardFooter>
      </Card>
    </motion.div>
  );
});

export default NormuurSuggestieCard;
