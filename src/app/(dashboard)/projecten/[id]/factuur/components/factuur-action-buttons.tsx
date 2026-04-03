"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Send,
  Download,
  Check,
  Edit,
  Eye,
  CheckCircle,
  Bell,
  ArrowLeft,
  FileX,
  Scale,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  Gavel,
} from "lucide-react";
import type { FactuurHandlersState } from "./use-factuur-handlers";

interface AanmaningDropdownProps {
  aanmaningStatus: {
    heeftEerste?: boolean;
    heeftTweede?: boolean;
    heeftIngebrekestelling?: boolean;
  } | null | undefined;
  onSelectType: (type: "eerste_aanmaning" | "tweede_aanmaning" | "ingebrekestelling") => void;
}

function AanmaningDropdown({ aanmaningStatus, onSelectType }: AanmaningDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-950">
          <Scale className="h-4 w-4" />
          Aanmaning
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Aanmaning versturen</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onSelectType("eerste_aanmaning")}
          disabled={aanmaningStatus?.heeftEerste}
          className="flex items-start gap-3 py-3"
        >
          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">1e Aanmaning</p>
            <p className="text-xs text-muted-foreground">Vriendelijk verzoek tot betaling</p>
            {aanmaningStatus?.heeftEerste && (
              <Badge variant="outline" className="mt-1 text-xs">Verstuurd</Badge>
            )}
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSelectType("tweede_aanmaning")}
          disabled={!aanmaningStatus?.heeftEerste || aanmaningStatus?.heeftTweede}
          className="flex items-start gap-3 py-3"
        >
          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">2e Aanmaning</p>
            <p className="text-xs text-muted-foreground">Formeel verzoek met waarschuwing</p>
            {aanmaningStatus?.heeftTweede && (
              <Badge variant="outline" className="mt-1 text-xs">Verstuurd</Badge>
            )}
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSelectType("ingebrekestelling")}
          disabled={!aanmaningStatus?.heeftTweede || aanmaningStatus?.heeftIngebrekestelling}
          className="flex items-start gap-3 py-3"
        >
          <Gavel className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Ingebrekestelling</p>
            <p className="text-xs text-muted-foreground">Juridische sommatie (art. 6:82 BW)</p>
            {aanmaningStatus?.heeftIngebrekestelling && (
              <Badge variant="outline" className="mt-1 text-xs">Verstuurd</Badge>
            )}
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface CreditnotaButtonProps {
  factuurnummer: string;
  creditnotaReden: string;
  onRedenChange: (reden: string) => void;
  onCreateCreditnota: () => void;
  isCreatingCreditnota: boolean;
}

function CreditnotaButton({
  factuurnummer,
  creditnotaReden,
  onRedenChange,
  onCreateCreditnota,
  isCreatingCreditnota,
}: CreditnotaButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
          <FileX className="h-4 w-4" />
          Creditnota
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Creditnota aanmaken</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Hiermee maakt u een creditnota aan voor factuur {factuurnummer}.
                De originele factuur blijft bewaard (fiscale eis).
              </p>
              <Textarea
                placeholder="Reden voor creditnota..."
                value={creditnotaReden}
                onChange={(e) => onRedenChange(e.target.value)}
                className="mt-2"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onRedenChange("")}>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            onClick={onCreateCreditnota}
            disabled={isCreatingCreditnota || !creditnotaReden.trim()}
            className="bg-red-600 hover:bg-red-700"
          >
            {isCreatingCreditnota ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Creditnota Aanmaken
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface CreditnotaBadgeProps {
  factuurnummer: string;
}

function CreditnotaBadge({ factuurnummer }: CreditnotaBadgeProps) {
  return (
    <Badge variant="outline" className="text-red-600 border-red-200">
      <FileX className="h-3 w-3 mr-1" />
      Gecrediteerd: {factuurnummer}
    </Badge>
  );
}

export interface FactuurActionButtonsProps {
  factuurStatus: string;
  projectId: string;
  factuurnummer: string;
  handlers: FactuurHandlersState;
  aanmaningStatus: {
    heeftEerste?: boolean;
    heeftTweede?: boolean;
    heeftIngebrekestelling?: boolean;
  } | null | undefined;
  creditnota: { factuurnummer: string } | null | undefined;
}

export function FactuurActionButtons({
  factuurStatus,
  projectId,
  factuurnummer,
  handlers,
  aanmaningStatus,
  creditnota,
}: FactuurActionButtonsProps) {
  switch (factuurStatus) {
    case "concept":
      return (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <Link href={`/projecten/${projectId}/factuur/bewerken`}>
              <Edit className="h-4 w-4" />
              Bewerken
            </Link>
          </Button>
          <Button variant="outline" className="gap-2" onClick={handlers.handlePreviewPdf}>
            <Eye className="h-4 w-4" />
            Preview PDF
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="gap-2 bg-primary">
                <Check className="h-4 w-4" />
                Definitief Maken
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Factuur definitief maken?</AlertDialogTitle>
                <AlertDialogDescription>
                  Wanneer je de factuur definitief maakt, kan deze niet meer worden bewerkt.
                  Je kunt de factuur daarna verzenden naar de klant.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={handlers.handleMakeDefinitief} disabled={handlers.isSaving}>
                  {handlers.isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Definitief Maken
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );

    case "definitief":
      return (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={handlers.handlePreviewPdf} disabled={handlers.isDownloadingPdf}>
            {handlers.isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Bekijk PDF
          </Button>
          <Button variant="outline" className="gap-2" onClick={handlers.handleDownloadPdf} disabled={handlers.isDownloadingPdf}>
            {handlers.isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </Button>
          <Button className="gap-2 bg-green-600 hover:bg-green-700" onClick={handlers.handleSendFactuur} disabled={handlers.isSending}>
            {handlers.isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Verstuur Factuur
          </Button>
        </div>
      );

    case "verzonden":
      return (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={handlers.handlePreviewPdf} disabled={handlers.isDownloadingPdf}>
            {handlers.isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Bekijk PDF
          </Button>
          <Button variant="outline" className="gap-2" onClick={handlers.handleDownloadPdf} disabled={handlers.isDownloadingPdf}>
            {handlers.isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </Button>
          <Button variant="outline" className="gap-2" onClick={handlers.handleSendReminder} disabled={handlers.isSending}>
            {handlers.isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            Herinnering Sturen
          </Button>
          <AanmaningDropdown
            aanmaningStatus={aanmaningStatus}
            onSelectType={handlers.setSelectedAanmaningType}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="gap-2 bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4" />
                Markeer als Betaald
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Factuur als betaald markeren?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>Hiermee bevestig je dat de betaling is ontvangen.</p>
                    <p className="text-sm">Dit zal automatisch:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>De factuur markeren als &apos;Betaald&apos;</li>
                      <li>Het project markeren als &apos;Gefactureerd&apos;</li>
                      <li>Het project en de offerte archiveren</li>
                    </ul>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={handlers.handleMarkAsPaid} disabled={handlers.isSaving} className="bg-green-600 hover:bg-green-700">
                  {handlers.isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Betaald
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );

    case "betaald":
      return (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={handlers.handlePreviewPdf} disabled={handlers.isDownloadingPdf}>
            {handlers.isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Bekijk PDF
          </Button>
          <Button variant="outline" className="gap-2" onClick={handlers.handleDownloadPdf} disabled={handlers.isDownloadingPdf}>
            {handlers.isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </Button>
          {!creditnota && (
            <CreditnotaButton
              factuurnummer={factuurnummer}
              creditnotaReden={handlers.creditnotaReden}
              onRedenChange={handlers.setCreditnotaReden}
              onCreateCreditnota={handlers.handleCreateCreditnota}
              isCreatingCreditnota={handlers.isCreatingCreditnota}
            />
          )}
          {creditnota && <CreditnotaBadge factuurnummer={creditnota.factuurnummer} />}
          <Button variant="outline" className="gap-2" asChild>
            <Link href={`/projecten/${projectId}`}>
              <ArrowLeft className="h-4 w-4" />
              Terug naar Project
            </Link>
          </Button>
        </div>
      );

    case "vervallen":
      return (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={handlers.handlePreviewPdf} disabled={handlers.isDownloadingPdf}>
            {handlers.isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Bekijk PDF
          </Button>
          <Button variant="outline" className="gap-2" onClick={handlers.handleDownloadPdf} disabled={handlers.isDownloadingPdf}>
            {handlers.isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </Button>
          <Button variant="outline" className="gap-2" onClick={handlers.handleSendReminder} disabled={handlers.isSending}>
            {handlers.isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            Herinnering Sturen
          </Button>
          <AanmaningDropdown
            aanmaningStatus={aanmaningStatus}
            onSelectType={handlers.setSelectedAanmaningType}
          />
          {!creditnota && (
            <CreditnotaButton
              factuurnummer={factuurnummer}
              creditnotaReden={handlers.creditnotaReden}
              onRedenChange={handlers.setCreditnotaReden}
              onCreateCreditnota={handlers.handleCreateCreditnota}
              isCreatingCreditnota={handlers.isCreatingCreditnota}
            />
          )}
          {creditnota && <CreditnotaBadge factuurnummer={creditnota.factuurnummer} />}
        </div>
      );

    default:
      return null;
  }
}
