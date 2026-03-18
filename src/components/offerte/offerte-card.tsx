"use client";

import { memo, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Shovel,
  Trees,
  MoreHorizontal,
  Copy,
  Trash2,
  Eye,
  ExternalLink,
  FolderKanban,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Id } from "../../../convex/_generated/dataModel";

// Formatters (same as table utils)
const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (minutes < 1) return "Zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  if (hours < 24) return `${hours} uur geleden`;
  if (days === 1) return "Gisteren";
  if (days < 7) return `${days} dagen geleden`;
  if (weeks === 1) return "1 week geleden";
  if (weeks < 5) return `${weeks} weken geleden`;
  if (months === 1) return "1 maand geleden";
  if (months < 12) return `${months} maanden geleden`;

  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

// Project info type
type ProjectInfo = {
  _id: Id<"projecten">;
  naam: string;
  status: string;
} | null;

export interface OfferteCardProps {
  offerte: {
    _id: Id<"offertes">;
    type: "aanleg" | "onderhoud";
    offerteNummer: string;
    klant: { naam: string; plaats: string };
    totalen: { totaalInclBtw: number };
    status: string;
    updatedAt: number;
  };
  projectInfo: ProjectInfo;
  isSelected: boolean;
  onToggleSelect: (id: Id<"offertes">) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (id: string) => void;
  reducedMotion: boolean;
  index: number;
}

export const OfferteCard = memo(function OfferteCard({
  offerte,
  projectInfo,
  isSelected,
  onToggleSelect,
  onDuplicate,
  onDelete,
  onNavigate,
  reducedMotion,
  index,
}: OfferteCardProps) {
  const hasProject = projectInfo !== null;

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("button") &&
        !target.closest('[role="checkbox"]') &&
        !target.closest("a")
      ) {
        onNavigate(offerte._id);
      }
    },
    [offerte._id, onNavigate]
  );

  const handleToggleSelect = useCallback(() => {
    onToggleSelect(offerte._id);
  }, [offerte._id, onToggleSelect]);

  const handleDuplicate = useCallback(() => {
    onDuplicate(offerte._id);
  }, [offerte._id, onDuplicate]);

  const handleDelete = useCallback(() => {
    onDelete(offerte._id);
  }, [offerte._id, onDelete]);

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion ? 0 : 0.3,
        delay: reducedMotion ? 0 : index * 0.04,
      }}
    >
      <Card
        interactive
        className={`relative p-4 gap-3 cursor-pointer ${
          isSelected
            ? "ring-2 ring-primary bg-primary/5"
            : ""
        }`}
        onClick={handleCardClick}
      >
        {/* Top row: Checkbox + Offerte nummer + Type badge */}
        <div className="flex items-center justify-between gap-2 px-0">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={isSelected}
              onCheckedChange={handleToggleSelect}
              aria-label={`Selecteer ${offerte.offerteNummer}`}
            />
            <Link
              href={`/offertes/${offerte._id}`}
              className="font-semibold text-sm hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {offerte.offerteNummer}
            </Link>
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-md ${
                offerte.type === "aanleg"
                  ? "bg-primary/10"
                  : "bg-green-100 dark:bg-green-900/30"
              }`}
            >
              {offerte.type === "aanleg" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Shovel className="h-3.5 w-3.5 text-primary" />
                  </TooltipTrigger>
                  <TooltipContent>Aanleg</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Trees className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  </TooltipTrigger>
                  <TooltipContent>Onderhoud</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Meer opties"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/offertes/${offerte._id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Bekijken
                </Link>
              </DropdownMenuItem>
              {hasProject ? (
                <DropdownMenuItem asChild>
                  <Link
                    href={`/projecten/${projectInfo._id}`}
                    className="text-blue-600"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Bekijk Project
                  </Link>
                </DropdownMenuItem>
              ) : offerte.status === "geaccepteerd" ? (
                <DropdownMenuItem asChild>
                  <Link
                    href={`/projecten/nieuw?offerte=${offerte._id}`}
                    className="text-green-600"
                  >
                    <FolderKanban className="mr-2 h-4 w-4" />
                    Start Project
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Dupliceren
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Middle: Klant naam + Plaats */}
        <div className="px-0">
          <p className="text-base font-medium leading-tight truncate">
            {offerte.klant.naam}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            {offerte.klant.plaats}
          </p>
        </div>

        {/* Bottom row: Bedrag + Status + Date + Actions */}
        <div className="flex items-center justify-between gap-2 px-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-green-600 dark:text-green-400">
              {formatCurrency(offerte.totalen.totaalInclBtw)}
            </span>
            <StatusBadge status={offerte.status} size="sm" />
            {hasProject && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={`/projecten/${projectInfo._id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <FolderKanban className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{projectInfo.naam}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeDate(offerte.updatedAt)}
          </span>
        </div>

        {/* Action buttons row */}
        <div className="flex items-center gap-2 pt-1 border-t px-0">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            asChild
            onClick={(e) => e.stopPropagation()}
          >
            <Link href={`/offertes/${offerte._id}`}>
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Bekijken
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              handleDuplicate();
            }}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Dupliceren
          </Button>
          {hasProject ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/50"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={`/projecten/${projectInfo._id}`}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Project
              </Link>
            </Button>
          ) : offerte.status === "geaccepteerd" ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/50"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={`/projecten/nieuw?offerte=${offerte._id}`}>
                <FolderKanban className="mr-1.5 h-3.5 w-3.5" />
                Start
              </Link>
            </Button>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
});
