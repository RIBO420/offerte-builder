"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  ClipboardCheck,
  Check,
  X,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// QC Status types and labels
type QCStatus = "open" | "in_uitvoering" | "goedgekeurd" | "afgekeurd";

const statusConfig: Record<
  QCStatus,
  {
    label: string;
    color: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  open: {
    label: "Open",
    color: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    icon: Clock,
  },
  in_uitvoering: {
    label: "In uitvoering",
    color: "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    icon: AlertCircle,
  },
  goedgekeurd: {
    label: "Goedgekeurd",
    color: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200",
    icon: Check,
  },
  afgekeurd: {
    label: "Afgekeurd",
    color: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200",
    icon: X,
  },
};

// Scope display names
const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gras",
  houtwerk: "Houtwerk",
  water_elektra: "Water & Elektra",
  specials: "Specials",
  gras_onderhoud: "Gras (Onderhoud)",
  borders_onderhoud: "Borders (Onderhoud)",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
};

interface ChecklistItem {
  id: string;
  omschrijving: string;
  isAfgevinkt: boolean;
  afgevinktAt?: number;
  afgevinktDoor?: string;
  notities?: string;
}

interface QCChecklistCardProps {
  id: Id<"kwaliteitsControles">;
  scope: string;
  status: QCStatus;
  checklistItems: ChecklistItem[];
  opmerkingen?: string;
  goedgekeurdDoor?: string;
  goedgekeurdAt?: number;
  onApprove?: () => void;
  onReject?: () => void;
  userName?: string;
  defaultExpanded?: boolean;
}

export function QCChecklistCard({
  id,
  scope,
  status,
  checklistItems,
  opmerkingen,
  goedgekeurdDoor,
  goedgekeurdAt,
  onApprove,
  onReject,
  userName = "Gebruiker",
  defaultExpanded = false,
}: QCChecklistCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());

  const updateChecklistItem = useMutation(
    api.kwaliteitsControles.updateChecklistItem,
  );

  // Calculate progress
  const checkedCount = checklistItems.filter((item) => item.isAfgevinkt).length;
  const totalCount = checklistItems.length;
  const progress =
    totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  // Get status config
  const {
    label: statusLabel,
    color: statusColor,
    icon: StatusIcon,
  } = statusConfig[status];

  // Handle checkbox toggle
  const handleCheckboxChange = async (itemId: string, checked: boolean) => {
    setUpdatingItems((prev) => new Set(prev).add(itemId));
    try {
      await updateChecklistItem({
        id,
        itemId,
        isAfgevinkt: checked,
        afgevinktDoor: checked ? userName : undefined,
      });
    } catch (error) {
      console.error("Fout bij bijwerken checklist item:", error);
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("nl-NL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isReadOnly = status === "goedgekeurd" || status === "afgekeurd";
  const allChecked = checkedCount === totalCount && totalCount > 0;

  return (
    <Card
      className={cn(
        "transition-all",
        status === "goedgekeurd" &&
          "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20",
        status === "afgekeurd" &&
          "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20",
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">
                {scopeLabels[scope] || scope}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <span>
                  {checkedCount}/{totalCount} items
                </span>
                {goedgekeurdDoor && goedgekeurdAt && (
                  <span className="text-xs">
                    - Goedgekeurd door {goedgekeurdDoor} op{" "}
                    {formatTimestamp(goedgekeurdAt)}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColor}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {statusLabel}
            </Badge>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? "Invouwen" : "Uitvouwen"}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Voortgang</span>
            <span>{progress}%</span>
          </div>
          <Progress
            value={progress}
            className={cn("h-2", progress === 100 && "[&>div]:bg-green-500")}
          />
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {/* Checklist items */}
          <div className="space-y-3 border-t pt-4">
            {checklistItems.map((item) => {
              const isUpdating = updatingItems.has(item.id);

              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg p-2 -mx-2 transition-colors",
                    item.isAfgevinkt && "bg-green-50/50 dark:bg-green-950/20",
                  )}
                >
                  <div className="pt-0.5">
                    {isUpdating ? (
                      <div className="flex h-[18px] w-[18px] items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <Checkbox
                        id={item.id}
                        checked={item.isAfgevinkt}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange(item.id, checked === true)
                        }
                        disabled={isReadOnly || isUpdating}
                        className={cn(
                          item.isAfgevinkt &&
                            "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600",
                        )}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label
                      htmlFor={item.id}
                      className={cn(
                        "text-sm font-normal cursor-pointer leading-relaxed",
                        item.isAfgevinkt &&
                          "text-muted-foreground line-through",
                      )}
                    >
                      {item.omschrijving}
                    </Label>
                    {item.isAfgevinkt && item.afgevinktAt && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-600" />
                        {item.afgevinktDoor && `${item.afgevinktDoor} - `}
                        {formatTimestamp(item.afgevinktAt)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Opmerkingen */}
          {opmerkingen && (
            <div className="mt-4 rounded-lg bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                <strong>Opmerkingen:</strong> {opmerkingen}
              </p>
            </div>
          )}

          {/* Action buttons */}
          {!isReadOnly && (
            <div className="mt-4 flex gap-2 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={onReject}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <X className="mr-1.5 h-4 w-4" />
                Afkeuren
              </Button>
              <Button
                size="sm"
                onClick={onApprove}
                disabled={!allChecked}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="mr-1.5 h-4 w-4" />
                Goedkeuren
              </Button>
              {!allChecked && (
                <p className="text-xs text-muted-foreground self-center ml-2">
                  Vink eerst alle items af
                </p>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
