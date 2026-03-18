"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Edit,
  Send,
  ArrowLeft,
  Loader2,
  Shovel,
  Trees,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  Trash2,
  BookmarkPlus,
  History,
  Link2,
  Calculator,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { DynamicPDFDownloadButton as PDFDownloadButton } from "@/components/pdf";
import type { OfferteStatus } from "@/lib/constants/statuses";
import { formatDate } from "./utils";

interface OfferteHeaderProps {
  // Offerte is passed through to PDFDownloadButton which expects a broad type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  offerte: any;
  id: string;
  displayStatus: string;
  isUpdating: boolean;
  voorcalculatie: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instellingen: any;
  onStatusChange: (status: "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen") => void;
  onDuplicate: () => void;
  onShowTemplateDialog: () => void;
  onShowEmailDialog: () => void;
  onShowShareDialog: () => void;
  onShowDeleteDialog: () => void;
}

export function OfferteHeader({
  offerte,
  id,
  displayStatus,
  isUpdating,
  voorcalculatie,
  instellingen,
  onStatusChange,
  onDuplicate,
  onShowTemplateDialog,
  onShowEmailDialog,
  onShowShareDialog,
  onShowDeleteDialog,
}: OfferteHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Terug naar offertes">
          <Link href="/offertes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              offerte.type === "aanleg" ? "bg-primary/10" : "bg-green-100 dark:bg-green-900/30"
            }`}
          >
            {offerte.type === "aanleg" ? (
              <Shovel className="h-5 w-5 text-primary" />
            ) : (
              <Trees className="h-5 w-5 text-green-600 dark:text-green-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {offerte.offerteNummer}
              </h1>
              <StatusBadge status={displayStatus as OfferteStatus} />
            </div>
            <p className="text-muted-foreground">
              {offerte.type === "aanleg" ? "Aanleg" : "Onderhoud"} offerte •
              Aangemaakt op {formatDate(offerte.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isUpdating}>
              {isUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Clock className="mr-2 h-4 w-4" />
              )}
              Status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => onStatusChange("concept")}
              disabled={offerte?.status !== "voorcalculatie"}
            >
              <Clock className="mr-2 h-4 w-4" />
              Concept
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onStatusChange("voorcalculatie")}
              disabled={offerte?.status !== "concept" || !voorcalculatie}
            >
              <Calculator className="mr-2 h-4 w-4" />
              Voorcalculatie
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onStatusChange("verzonden")}
              disabled={offerte?.status !== "voorcalculatie"}
            >
              <Send className="mr-2 h-4 w-4" />
              Verzonden
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onStatusChange("geaccepteerd")}
              disabled={offerte?.status !== "verzonden"}
            >
              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
              Geaccepteerd
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onStatusChange("afgewezen")}
              disabled={offerte?.status !== "verzonden"}
            >
              <XCircle className="mr-2 h-4 w-4 text-red-600" />
              Afgewezen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" asChild>
          <Link href={`/offertes/${id}/bewerken`}>
            <Edit className="mr-2 h-4 w-4" />
            Bewerken
          </Link>
        </Button>

        <Button
          variant="outline"
          onClick={onShowEmailDialog}
        >
          <Send className="mr-2 h-4 w-4" />
          Email
        </Button>

        <Button
          variant="outline"
          onClick={onShowShareDialog}
        >
          <Link2 className="mr-2 h-4 w-4" />
          Delen
        </Button>

        <PDFDownloadButton
          offerte={offerte}
          bedrijfsgegevens={instellingen?.bedrijfsgegevens}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" aria-label="Meer opties">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Dupliceren
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowTemplateDialog}>
              <BookmarkPlus className="mr-2 h-4 w-4" />
              Opslaan als Template
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/offertes/${id}/history`}>
                <History className="mr-2 h-4 w-4" />
                Versiegeschiedenis
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onShowDeleteDialog}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Verwijderen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
