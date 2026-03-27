"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Calculator,
  FilePlus2,
  ShieldAlert,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { DynamicPDFDownloadButton as PDFDownloadButton } from "@/components/pdf";
import type { OfferteStatus } from "@/lib/constants/statuses";
import { formatDate } from "./utils";

interface OfferteVersion {
  _id: string;
  versieNummer: number;
  createdAt: number;
  actie: string;
  omschrijving: string;
  userId?: string;
}

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
  offerteVersions?: OfferteVersion[];
  onStatusChange: (status: "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen") => void;
  onDuplicate: () => void;
  onShowTemplateDialog: () => void;
  onShowDeleteDialog: () => void;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (minutes < 1) return "zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  if (hours < 24) return `${hours} uur geleden`;
  if (days === 1) return "1 dag geleden";
  if (days < 7) return `${days} dagen geleden`;
  if (weeks === 1) return "1 week geleden";
  if (weeks < 5) return `${weeks} weken geleden`;
  if (months === 1) return "1 maand geleden";
  return `${months} maanden geleden`;
}

export function OfferteHeader({
  offerte,
  id,
  displayStatus,
  isUpdating,
  voorcalculatie,
  instellingen,
  offerteVersions,
  onStatusChange,
  onDuplicate,
  onShowTemplateDialog,
  onShowDeleteDialog,
}: OfferteHeaderProps) {
  const router = useRouter();
  const [showNieuweVersieDialog, setShowNieuweVersieDialog] = useState(false);

  const isGeaccepteerd = offerte?.status === "geaccepteerd";

  // Determine version indicator info
  const latestVersion = offerteVersions && offerteVersions.length > 0 ? offerteVersions[0] : null;
  const versionCount = latestVersion ? latestVersion.versieNummer : 1;
  return (
    <>
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
            {latestVersion ? (
              <Link
                href={`/offertes/${id}/history`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="h-3 w-3" />
                <span>
                  v{versionCount} · bijgewerkt {formatTimeAgo(latestVersion.createdAt)}
                </span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <History className="h-3 w-3" />
                <span>v1 · origineel</span>
              </span>
            )}
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

        {isGeaccepteerd ? (
          <Button
            variant="outline"
            onClick={() => setShowNieuweVersieDialog(true)}
            className="border-amber-500/50 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
          >
            <FilePlus2 className="mr-2 h-4 w-4" />
            Nieuwe versie aanmaken
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link href={`/offertes/${id}/bewerken`}>
              <Edit className="mr-2 h-4 w-4" />
              Bewerken
            </Link>
          </Button>
        )}

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

    {/* Waarschuwingsdialoog voor nieuwe versie van getekende offerte */}
    <AlertDialog open={showNieuweVersieDialog} onOpenChange={setShowNieuweVersieDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <AlertDialogTitle>Getekende offerte bewerken</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            Deze offerte is getekend en geaccepteerd door de klant. Wijzigingen
            maken automatisch een nieuwe versie. De originele getekende versie
            blijft bewaard in de versiegeschiedenis.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => router.push(`/offertes/${id}/bewerken`)}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Doorgaan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
