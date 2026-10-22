"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  Archive,
  ArrowRight,
  BookmarkPlus,
  Calculator,
  CheckCircle,
  Clock,
  Copy,
  FilePlus2,
  History,
  Loader2,
  MoreHorizontal,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
// Bewust uit ./dynamic en niet uit de barrel: de barrel sleepte de statische
// react-pdf-keten (~500 KB) mee in de offertedetail-bundle (optimize O1).
import { DynamicPDFDownloadButton as PDFDownloadButton } from "@/components/pdf/dynamic";
import type { PdfTheme } from "@/components/pdf/pdf-theme";
import { getStatusConfig } from "@/lib/constants/statuses";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { scopeLabels } from "./utils";
import { FaseStrip } from "./fase-strip";
import type { Actie, Fase, OfferteStatus, VolgendeStap } from "./offerte-voortgang";

interface OfferteVersion {
  _id: string;
  versieNummer: number;
  createdAt: number;
}

interface OfferteKopProps {
  // Offerte gaat door naar PDFDownloadButton, die een breed type verwacht
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  offerte: any;
  id: string;
  displayStatus: string;
  isUpdating: boolean;
  heeftVoorcalculatie: boolean;
  isKantoor: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instellingen: any;
  pdfTheme?: PdfTheme;
  pdfVoorwaarden?: string;
  offerteVersions?: OfferteVersion[];
  volgendeStap: VolgendeStap;
  fases: Fase[];
  onStatusChange: (status: OfferteStatus, via?: OfferteStatus) => void;
  onDuplicate: () => void;
  onShowTemplateDialog: () => void;
  onShowDeleteDialog: () => void;
}

/** "Grondwerk en bestrating", "Grondwerk, bestrating en borders", "… en 2 meer". */
function scopeZin(scopes: string[] | undefined): string | null {
  if (!scopes || scopes.length === 0) return null;
  const namen = scopes.map((s, i) => {
    const label = scopeLabels[s] ?? s;
    return i === 0 ? label : label.toLowerCase();
  });
  if (namen.length > 3) return `${namen.slice(0, 2).join(", ")} en ${namen.length - 2} meer`;
  if (namen.length === 1) return namen[0];
  return `${namen.slice(0, -1).join(", ")} en ${namen.at(-1)}`;
}

/**
 * Kop van het offertedetail (variant A "Regels centraal"): klantnaam als
 * titel, statuspil, één metaregel, rechts de acties met precies één gevulde
 * knop voor de volgende stap, en de fasestrip eronder. Vervangt de vroegere
 * OfferteHeader, de stepper-kaart en de totaalbadge in de PageHeader.
 */
export function OfferteKop({
  offerte,
  id,
  displayStatus,
  isUpdating,
  heeftVoorcalculatie,
  isKantoor,
  instellingen,
  pdfTheme,
  pdfVoorwaarden,
  offerteVersions,
  volgendeStap,
  fases,
  onStatusChange,
  onDuplicate,
  onShowTemplateDialog,
  onShowDeleteDialog,
}: OfferteKopProps) {
  const [showNieuweVersieDialog, setShowNieuweVersieDialog] = useState(false);
  // Inleiding/afsluiting met ingevulde velden voor de PDF
  const teksten = useQuery(api.offertes.getTeksten, { id: id as Id<"offertes"> });

  const status = offerte.status as OfferteStatus;
  const statusConfig = getStatusConfig(displayStatus, "offerte");
  const latestVersion = offerteVersions && offerteVersions.length > 0 ? offerteVersions[0] : null;
  const scopes = scopeZin(offerte.scopes);
  const { primair, secundair } = volgendeStap;

  // "Nieuwe versie" = een kopie als nieuw concept. Zinvol zodra de offerte
  // niet meer bewerkt kan worden; bij afgewezen ís het de primaire knop.
  const toonNieuweVersie =
    (status === "verzonden" || status === "geaccepteerd") &&
    primair?.soort !== "nieuweVersie";

  const voerUit = (actie: Actie) => {
    if (actie.soort === "status") onStatusChange(actie.doelStatus, actie.via);
    else if (actie.soort === "nieuweVersie") setShowNieuweVersieDialog(true);
  };

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="min-w-0 text-2xl leading-tight @3xl/offerte:text-[28px] font-semibold tracking-tight break-words">
                {offerte.klant?.naam || offerte.offerteNummer}
              </h1>
              <span
                className={cn(
                  "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold",
                  statusConfig.color.bg,
                  statusConfig.color.text,
                  statusConfig.color.border
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 rounded-full", statusConfig.color.dot)}
                />
                {statusConfig.label}
              </span>
            </div>
            <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              <span>{offerte.type === "aanleg" ? "Aanleg" : "Onderhoud"}</span>
              {scopes && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="min-w-0">{scopes}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-0.5">
                <span className="tabular-nums">{offerte.offerteNummer}</span>
                <CopyButton value={offerte.offerteNummer} label="Kopieer offertenummer" />
              </span>
              <span aria-hidden="true">·</span>
              <Link
                href={`/offertes/${id}/history`}
                className="tabular-nums transition-colors hover:text-foreground"
                title="Versiegeschiedenis"
              >
                v{latestVersion ? latestVersion.versieNummer : 1}
              </Link>
              <span aria-hidden="true">·</span>
              <span>aangemaakt {formatDate(offerte.createdAt)}</span>
            </p>
          </div>

          {/* flex-wrap: op smalle vensters vallen de knoppen naar een nieuwe
              regel in plaats van buiten beeld (CLAUDE.md regel 1). */}
          <div className="flex flex-wrap items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Meer acties"
                  disabled={isUpdating}
                  className="text-muted-foreground"
                >
                  {isUpdating ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Clock className="mr-2 h-4 w-4" />
                    Status wijzigen
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => onStatusChange("concept")}
                      disabled={status !== "voorcalculatie"}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Concept
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onStatusChange("voorcalculatie")}
                      disabled={status !== "concept" || !heeftVoorcalculatie}
                    >
                      <Calculator className="mr-2 h-4 w-4" />
                      Voorcalculatie
                    </DropdownMenuItem>
                    {/* PRD §1.2: versturen naar klant is kantoor-only — de optie
                        bestaat niet voor andere rollen (niet disabled, niet gerenderd) */}
                    {isKantoor && (
                      <DropdownMenuItem
                        onClick={() => onStatusChange("verzonden")}
                        disabled={status !== "voorcalculatie"}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Verzonden
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onStatusChange("geaccepteerd")}
                      disabled={status !== "verzonden"}
                    >
                      <CheckCircle className="mr-2 h-4 w-4 text-status-geaccepteerd-dot" />
                      Geaccepteerd
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onStatusChange("afgewezen")}
                      disabled={status !== "verzonden"}
                    >
                      <XCircle className="mr-2 h-4 w-4 text-destructive" />
                      Afgewezen
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="mr-2 h-4 w-4" />
                  Dupliceren
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onShowTemplateDialog}>
                  <BookmarkPlus className="mr-2 h-4 w-4" />
                  Opslaan als template
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/offertes/${id}/history`}>
                    <History className="mr-2 h-4 w-4" />
                    Versiegeschiedenis
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onShowDeleteDialog} className="text-destructive">
                  <Archive className="mr-2 h-4 w-4" />
                  Archiveren
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {toonNieuweVersie && (
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setShowNieuweVersieDialog(true)}
              >
                <FilePlus2 />
                Nieuwe versie
              </Button>
            )}

            {/* Eén PDF-knop: preview-modal (download zit ín de modal) */}
            <PDFDownloadButton
              offerte={offerte}
              bedrijfsgegevens={instellingen?.bedrijfsgegevens}
              theme={pdfTheme}
              voorwaarden={pdfVoorwaarden}
              teksten={teksten?.teksten}
              showPreview
              label="PDF"
              variant="outline"
            />

            {secundair && (
              <ActieKnop actie={secundair} variant="outline" bezig={isUpdating} onKlik={voerUit} />
            )}
            {primair && (
              <ActieKnop actie={primair} variant="default" bezig={isUpdating} onKlik={voerUit} />
            )}
          </div>
        </div>

        <FaseStrip fases={fases} />
      </header>

      {/* Waarschuwing vóór een nieuwe versie: het origineel blijft staan */}
      <AlertDialog open={showNieuweVersieDialog} onOpenChange={setShowNieuweVersieDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              {status === "geaccepteerd" && (
                <ShieldAlert className="h-5 w-5 text-status-in-uitvoering-dot" />
              )}
              <AlertDialogTitle>
                {status === "geaccepteerd" ? "Getekende offerte bewerken" : "Nieuwe versie maken"}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left">
              {status === "geaccepteerd"
                ? "Deze offerte is getekend en geaccepteerd door de klant; daarom blijft hij zoals hij is. "
                : status === "afgewezen"
                  ? "Deze offerte is afgewezen en blijft zo bewaard. "
                  : "Deze offerte is al naar de klant verstuurd en blijft zoals hij is. "}
              Je werkt verder in een kopie: een nieuw concept met dezelfde klant,
              werkzaamheden en regels, onder een eigen offertenummer. Deze
              offerte blijft ongewijzigd bestaan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={onDuplicate}>Kopie maken</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const ACTIE_ICOON = {
  voorcalculatie: Calculator,
  project: ArrowRight,
  versturen: Send,
  akkoord: CheckCircle,
  afwijzen: XCircle,
  klaar: CheckCircle,
} as const;

function ActieKnop({
  actie,
  variant,
  bezig,
  onKlik,
}: {
  actie: Actie;
  variant: "default" | "outline";
  bezig: boolean;
  onKlik: (actie: Actie) => void;
}) {
  if (actie.soort === "link") {
    const Icoon = ACTIE_ICOON[actie.icoon];
    return (
      <Button asChild variant={variant}>
        <Link href={actie.href}>
          {actie.icoon === "project" ? (
            <>
              {actie.label}
              <Icoon />
            </>
          ) : (
            <>
              <Icoon />
              {actie.label}
            </>
          )}
        </Link>
      </Button>
    );
  }
  const Icoon = actie.soort === "status" ? ACTIE_ICOON[actie.icoon] : FilePlus2;
  return (
    <Button variant={variant} disabled={bezig} onClick={() => onKlik(actie)}>
      {bezig && actie.soort === "status" ? <Loader2 className="animate-spin" /> : <Icoon />}
      {actie.label}
    </Button>
  );
}
