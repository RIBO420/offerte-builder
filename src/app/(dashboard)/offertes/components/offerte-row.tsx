"use client";

import { memo, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
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
import { TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "./utils";
import type { OfferteRowProps } from "./types";

export const OfferteRow = memo(function OfferteRow({
  offerte,
  projectInfo,
  isSelected,
  onToggleSelect,
  onDuplicate,
  onDelete,
  onNavigate,
  reducedMotion,
  index,
}: OfferteRowProps) {
  const hasProject = projectInfo !== null;
  const handleRowClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('button') && !target.closest('[role="checkbox"]')) {
      onNavigate(offerte._id);
    }
  }, [offerte._id, onNavigate]);

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
    <motion.tr
      key={offerte._id}
      initial={reducedMotion ? false : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: reducedMotion ? 0 : 0.3,
        delay: reducedMotion ? 0 : index * 0.05,
      }}
      className={`border-b hover:bg-muted/50 transition-colors cursor-pointer hover:translate-y-[-1px] ${isSelected ? "bg-muted/50" : ""}`}
      onClick={handleRowClick}
    >
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleToggleSelect}
          aria-label={`Selecteer ${offerte.offerteNummer}`}
        />
      </TableCell>
      <TableCell>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            offerte.type === "aanleg"
              ? "bg-primary/10"
              : "bg-green-100 dark:bg-green-900/30"
          }`}
        >
          {offerte.type === "aanleg" ? (
            <Shovel className="h-4 w-4 text-primary" />
          ) : (
            <Trees className="h-4 w-4 text-green-600 dark:text-green-400" />
          )}
        </div>
      </TableCell>
      <TableCell className="font-medium">
        <Link
          href={`/offertes/${offerte._id}`}
          className="hover:underline"
        >
          {offerte.offerteNummer}
        </Link>
      </TableCell>
      <TableCell>{offerte.klant.naam}</TableCell>
      <TableCell>{offerte.klant.plaats}</TableCell>
      <TableCell>
        {formatCurrency(offerte.totalen.totaalInclBtw)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <StatusBadge status={offerte.status} size="sm" />
          {/* Project indicator icon with tooltip */}
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
          {/* Project button: "Bekijk Project" if exists, "Start Project" if geaccepteerd without project */}
          {hasProject ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/50"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={`/projecten/${projectInfo._id}`}>
                <ExternalLink className="h-3 w-3 mr-1" />
                Bekijk Project
              </Link>
            </Button>
          ) : offerte.status === "geaccepteerd" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/50"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={`/projecten/nieuw?offerte=${offerte._id}`}>
                <FolderKanban className="h-3 w-3 mr-1" />
                Start Project
              </Link>
            </Button>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(offerte.updatedAt)}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" aria-label="Meer opties">
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
                <Link href={`/projecten/${projectInfo._id}`} className="text-blue-600">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Bekijk Project
                </Link>
              </DropdownMenuItem>
            ) : offerte.status === "geaccepteerd" ? (
              <DropdownMenuItem asChild>
                <Link href={`/projecten/nieuw?offerte=${offerte._id}`} className="text-green-600">
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
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Verwijderen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </motion.tr>
  );
});
