"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { motion } from "framer-motion";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  FileText,
  Send,
  Download,
  Check,
  Clock,
  Edit,
  Eye,
  AlertCircle,
  Euro,
  CalendarDays,
  Building2,
  User,
  Receipt,
  CheckCircle,
  Mail,
  Bell,
  ArrowRight,
  FileX,
  Scale,
  History,
  ChevronDown,
  AlertTriangle,
  Gavel,
} from "lucide-react";
import { useReducedMotion } from "@/hooks/use-accessibility";
import {
  WorkflowStepIndicator,
  ProjectCompletedCelebration,
  InvoicePreviewCard,
  InvoiceSentSuccess,
  FactuurPageSkeleton,
  statusColors,
  statusLabels,
  formatCurrency,
  formatDate,
  formatDateShort,
  getWorkflowStep,
} from "./components";

export default function FactuurPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const projectId = id as Id<"projecten">;

  // State for loading actions
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingCreditnota, setIsCreatingCreditnota] = useState(false);
  const [creditnotaReden, setCreditnotaReden] = useState("");
  const [isSendingAanmaning, setIsSendingAanmaning] = useState(false);
  const [aanmaningNotities, setAanmaningNotities] = useState("");
  const [selectedAanmaningType, setSelectedAanmaningType] = useState<"eerste_aanmaning" | "tweede_aanmaning" | "ingebrekestelling" | null>(null);

  // State for success/celebration screens
  const [showSentSuccess, setShowSentSuccess] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);

  // Reduced motion preference
  const prefersReducedMotion = useReducedMotion();

  // Fetch project data
  const projectDetails = useQuery(
    api.projecten.getWithDetails,
    projectId ? { id: projectId } : "skip"
  );

  // Fetch factuur for this project
  const factuur = useQuery(
    api.facturen.getByProject,
    projectId ? { projectId } : "skip"
  );

  // Fetch nacalculatie for summary preview
  const nacalculatie = useQuery(
    api.nacalculaties.get,
    projectId ? { projectId } : "skip"
  );

  // Herinneringen for this factuur (FAC-006)
  const herinneringen = useQuery(
    api.betalingsherinneringen.listByFactuur,
    factuur ? { factuurId: factuur._id } : "skip"
  );

  // Aanmaning status for this factuur (FAC-007)
  const aanmaningStatus = useQuery(
    api.betalingsherinneringen.getAanmaningStatus,
    factuur ? { factuurId: factuur._id } : "skip"
  );

  // Creditnota for this factuur (FAC-008)
  const creditnota = useQuery(
    api.facturen.getCreditnota,
    factuur ? { factuurId: factuur._id } : "skip"
  );

  // Mutations
  const generateFactuur = useMutation(api.facturen.generate);
  const updateFactuurStatus = useMutation(api.facturen.updateStatus);
  const markAsPaidAndArchive = useMutation(api.facturen.markAsPaidAndArchiveProject);
  const verstuurHerinnering = useMutation(api.betalingsherinneringen.verstuurHandmatig);
  const verstuurAanmaning = useMutation(api.betalingsherinneringen.verstuurAanmaning);
  const createCreditnota = useMutation(api.facturen.createCreditnota);

  // Loading state - wait for both project details and factuur query
  if (projectDetails === undefined || factuur === undefined) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/projecten">Projecten</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Factuur</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <FactuurPageSkeleton />
      </>
    );
  }

  // Project not found
  if (!projectDetails) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/projecten">Projecten</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Niet gevonden</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">Project niet gevonden</h2>
          <Button variant="outline" onClick={() => router.push("/projecten")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar projecten
          </Button>
        </div>
      </>
    );
  }

  const { project, offerte, voorcalculatie } = projectDetails;

  // Handler for generating factuur
  const handleGenerateFactuur = async () => {
    setIsGenerating(true);
    try {
      await generateFactuur({ projectId });
      toast.success("Factuur succesvol gegenereerd");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
      toast.error(`Fout bij genereren factuur: ${errorMessage}`);
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handler for making factuur definitive
  const handleMakeDefinitief = async () => {
    if (!factuur) return;

    setIsSaving(true);
    try {
      await updateFactuurStatus({ id: factuur._id, status: "definitief" });
      toast.success("Factuur is nu definitief");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
      toast.error(`Fout bij definitief maken: ${errorMessage}`);
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for sending factuur (marks as verzonden)
  const handleSendFactuur = async () => {
    if (!factuur) return;

    setIsSending(true);
    try {
      await updateFactuurStatus({ id: factuur._id, status: "verzonden" });
      setShowSentSuccess(true);
      toast.success("Factuur succesvol verzonden!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
      toast.error(`Fout bij verzenden factuur: ${errorMessage}`);
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  // Handler for marking as paid - also archives project and offerte
  const handleMarkAsPaid = async () => {
    if (!factuur) return;

    setIsSaving(true);
    try {
      await markAsPaidAndArchive({ id: factuur._id });
      setShowCelebration(true);
      toast.success("Project voltooid! Factuur is betaald en project is gearchiveerd.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
      toast.error(`Fout bij markeren als betaald: ${errorMessage}`);
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for sending reminder (FAC-006)
  const handleSendReminder = async () => {
    if (!factuur) return;
    setIsSending(true);
    try {
      await verstuurHerinnering({ factuurId: factuur._id });
      toast.success("Betalingsherinnering verstuurd");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
      toast.error(`Fout bij verzenden herinnering: ${errorMessage}`);
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  // Handler for sending aanmaning with specific level (FAC-007)
  const handleSendAanmaning = async () => {
    if (!factuur || !selectedAanmaningType) return;
    setIsSendingAanmaning(true);
    try {
      await verstuurAanmaning({
        factuurId: factuur._id,
        type: selectedAanmaningType,
        notities: aanmaningNotities.trim() || undefined,
      });
      const labels: Record<string, string> = {
        eerste_aanmaning: "1e Aanmaning",
        tweede_aanmaning: "2e Aanmaning",
        ingebrekestelling: "Ingebrekestelling",
      };
      toast.success(`${labels[selectedAanmaningType]} succesvol verstuurd`);
      setSelectedAanmaningType(null);
      setAanmaningNotities("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
      toast.error(`Fout bij verzenden aanmaning: ${errorMessage}`);
      console.error(error);
    } finally {
      setIsSendingAanmaning(false);
    }
  };

  // Handler for creating creditnota (FAC-008)
  const handleCreateCreditnota = async () => {
    if (!factuur || !creditnotaReden.trim()) return;
    setIsCreatingCreditnota(true);
    try {
      await createCreditnota({
        factuurId: factuur._id,
        reden: creditnotaReden.trim(),
      });
      setCreditnotaReden("");
      toast.success("Creditnota succesvol aangemaakt");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Onbekende fout";
      toast.error(`Fout bij aanmaken creditnota: ${errorMessage}`);
      console.error(error);
    } finally {
      setIsCreatingCreditnota(false);
    }
  };

  // Handler for downloading PDF
  const handleDownloadPdf = () => {
    // TODO: Implement PDF generation/download
    toast.info("PDF download functionaliteit wordt binnenkort toegevoegd");
  };

  // Handler for previewing PDF
  const handlePreviewPdf = () => {
    // TODO: Implement PDF preview
    toast.info("PDF preview functionaliteit wordt binnenkort toegevoegd");
  };

  // Render no factuur state with summary preview
  const renderNoFactuurState = () => (
    <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Terug naar project">
            <Link href={`/projecten/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <Receipt className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Factuur
              </h1>
            </div>
            <p className="text-muted-foreground">{project.naam}</p>
          </div>
        </div>
      </div>

      {/* Workflow Step Indicator */}
      <Card className="p-4 md:p-6">
        <WorkflowStepIndicator currentStep={0} status={null} />
      </Card>

      {/* Invoice Preview Card with Info Sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InvoicePreviewCard
            offerte={offerte}
            nacalculatie={nacalculatie ?? null}
            project={project}
            onGenerate={handleGenerateFactuur}
            isGenerating={isGenerating}
          />
        </div>

        {/* Info sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hoe werkt het?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium">Genereer</p>
                  <p className="text-sm text-muted-foreground">
                    Maak de factuur aan op basis van de offerte
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium">Controleer</p>
                  <p className="text-sm text-muted-foreground">
                    Bekijk de factuur en maak eventueel aanpassingen
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium">Verstuur</p>
                  <p className="text-sm text-muted-foreground">
                    Verstuur de factuur naar de klant via e-mail
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200 text-sm font-medium">
                  4
                </div>
                <div>
                  <p className="font-medium">Betaald</p>
                  <p className="text-sm text-muted-foreground">
                    Markeer als betaald wanneer de betaling is ontvangen
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick stats from offerte */}
          {offerte && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Offerte gegevens</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Klant</span>
                  <span className="font-medium">{offerte.klant.naam}</span>
                </div>
                {offerte.klant.email && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">E-mail</span>
                    <span className="font-medium truncate max-w-[150px]" title={offerte.klant.email}>
                      {offerte.klant.email}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Totaal</span>
                  <span className="font-bold text-lg text-primary">
                    {formatCurrency(offerte.totalen.totaalInclBtw)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );

  // Render factuur exists state with status-based actions
  const renderFactuurState = () => {
    if (!factuur) return null;

    const factuurStatus = factuur.status;
    const currentStep = getWorkflowStep(factuurStatus);

    // Show celebration for paid invoices (first time only)
    if (factuurStatus === "betaald" && showCelebration && !celebrationDismissed) {
      return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
          <ProjectCompletedCelebration
            projectNaam={project.naam}
            bedrag={factuur.totaalInclBtw}
            onDismiss={() => {
              setCelebrationDismissed(true);
              setShowCelebration(false);
            }}
          />
        </div>
      );
    }

    // Show success state after sending invoice
    if (showSentSuccess && factuurStatus === "verzonden") {
      return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
          <InvoiceSentSuccess
            factuurNummer={factuur.factuurnummer}
            klantEmail={factuur.klant.email}
            onContinue={() => setShowSentSuccess(false)}
          />
        </div>
      );
    }

    // Render action buttons based on status
    const renderActionButtons = () => {
      switch (factuurStatus) {
        case "concept":
          return (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" asChild>
                <Link href={`/projecten/${id}/factuur/bewerken`}>
                  <Edit className="h-4 w-4" />
                  Bewerken
                </Link>
              </Button>
              <Button variant="outline" className="gap-2" onClick={handlePreviewPdf}>
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
                    <AlertDialogAction onClick={handleMakeDefinitief} disabled={isSaving}>
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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
              <Button variant="outline" className="gap-2" onClick={handleDownloadPdf}>
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button className="gap-2 bg-green-600 hover:bg-green-700" onClick={handleSendFactuur} disabled={isSending}>
                {isSending ? (
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
              <Button variant="outline" className="gap-2" onClick={handleDownloadPdf}>
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleSendReminder} disabled={isSending}>
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                Herinnering Sturen
              </Button>
              {/* Aanmaning dropdown (FAC-007) */}
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
                    onClick={() => setSelectedAanmaningType("eerste_aanmaning")}
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
                    onClick={() => setSelectedAanmaningType("tweede_aanmaning")}
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
                    onClick={() => setSelectedAanmaningType("ingebrekestelling")}
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
                    <AlertDialogAction onClick={handleMarkAsPaid} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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
              <Button variant="outline" className="gap-2" onClick={handleDownloadPdf}>
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              {/* Creditnota button (FAC-008) - only if no creditnota exists yet */}
              {!creditnota && (
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
                            Hiermee maakt u een creditnota aan voor factuur {factuur.factuurnummer}.
                            De originele factuur blijft bewaard (fiscale eis).
                          </p>
                          <Textarea
                            placeholder="Reden voor creditnota..."
                            value={creditnotaReden}
                            onChange={(e) => setCreditnotaReden(e.target.value)}
                            className="mt-2"
                          />
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setCreditnotaReden("")}>Annuleren</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCreateCreditnota}
                        disabled={isCreatingCreditnota || !creditnotaReden.trim()}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {isCreatingCreditnota ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Creditnota Aanmaken
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {creditnota && (
                <Badge variant="outline" className="text-red-600 border-red-200">
                  <FileX className="h-3 w-3 mr-1" />
                  Gecrediteerd: {creditnota.factuurnummer}
                </Badge>
              )}
              <Button variant="outline" className="gap-2" asChild>
                <Link href={`/projecten/${id}`}>
                  <ArrowLeft className="h-4 w-4" />
                  Terug naar Project
                </Link>
              </Button>
            </div>
          );

        case "vervallen":
          return (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={handleDownloadPdf}>
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleSendReminder} disabled={isSending}>
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                Herinnering Sturen
              </Button>
              {/* Aanmaning dropdown (FAC-007) */}
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
                    onClick={() => setSelectedAanmaningType("eerste_aanmaning")}
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
                    onClick={() => setSelectedAanmaningType("tweede_aanmaning")}
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
                    onClick={() => setSelectedAanmaningType("ingebrekestelling")}
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
              {/* Creditnota button (FAC-008) */}
              {!creditnota && (
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
                            Hiermee maakt u een creditnota aan voor factuur {factuur.factuurnummer}.
                            De originele factuur blijft bewaard (fiscale eis).
                          </p>
                          <Textarea
                            placeholder="Reden voor creditnota..."
                            value={creditnotaReden}
                            onChange={(e) => setCreditnotaReden(e.target.value)}
                            className="mt-2"
                          />
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setCreditnotaReden("")}>Annuleren</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCreateCreditnota}
                        disabled={isCreatingCreditnota || !creditnotaReden.trim()}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {isCreatingCreditnota ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Creditnota Aanmaken
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {creditnota && (
                <Badge variant="outline" className="text-red-600 border-red-200">
                  <FileX className="h-3 w-3 mr-1" />
                  Gecrediteerd: {creditnota.factuurnummer}
                </Badge>
              )}
            </div>
          );

        default:
          return null;
      }
    };

    // Render next step hint based on status
    const renderNextStepHint = () => {
      switch (factuurStatus) {
        case "concept":
          return (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">Volgende stap: Definitief maken</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Controleer de factuur en maak deze definitief om te kunnen verzenden.
                </p>
              </div>
            </motion.div>
          );
        case "definitief":
          return (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <Send className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Klaar om te verzenden!</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  De factuur is definitief. Je kunt deze nu naar de klant versturen.
                </p>
              </div>
            </motion.div>
          );
        case "verzonden":
          return (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Wachten op betaling</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Markeer de factuur als betaald zodra de betaling is ontvangen.
                </p>
              </div>
            </motion.div>
          );
        case "betaald":
          return (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Project voltooid!</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  De factuur is betaald. Dit project is succesvol afgerond.
                </p>
              </div>
            </motion.div>
          );
        default:
          return null;
      }
    };

    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Terug naar project">
              <Link href={`/projecten/${id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <Receipt className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Factuur {factuur.factuurnummer}
                </h1>
                <Badge className={statusColors[factuurStatus]}>
                  {statusLabels[factuurStatus]}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {project.naam}
              </p>
            </div>
          </div>
          {renderActionButtons()}
        </div>

        {/* Workflow Step Indicator */}
        <Card className="p-4 md:p-6">
          <WorkflowStepIndicator currentStep={currentStep} status={factuurStatus} />
        </Card>

        {/* Next Step Hint */}
        {renderNextStepHint()}

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Euro className="h-4 w-4" />
                Totaal incl. BTW
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(factuur.totaalInclBtw)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                Factuurdatum
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatDateShort(factuur.factuurdatum)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Vervaldatum
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatDateShort(factuur.vervaldatum)}
              </p>
              <p className="text-xs text-muted-foreground">
                {factuur.betalingstermijnDagen} dagen betalingstermijn
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <User className="h-4 w-4" />
                Klant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold truncate" title={factuur.klant.naam}>
                {factuur.klant.naam}
              </p>
              <p className="text-xs text-muted-foreground truncate" title={factuur.klant.plaats}>
                {factuur.klant.plaats}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Factuur Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client & Company Info */}
            <Card>
              <CardHeader>
                <CardTitle>Gegevens</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <User className="h-4 w-4" />
                      Factuuradres
                    </div>
                    <div>
                      <p className="font-medium">{factuur.klant.naam}</p>
                      <p className="text-sm text-muted-foreground">{factuur.klant.adres}</p>
                      <p className="text-sm text-muted-foreground">
                        {factuur.klant.postcode} {factuur.klant.plaats}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      Van
                    </div>
                    <div>
                      <p className="font-medium">{factuur.bedrijf.naam}</p>
                      <p className="text-sm text-muted-foreground">{factuur.bedrijf.adres}</p>
                      <p className="text-sm text-muted-foreground">
                        {factuur.bedrijf.postcode} {factuur.bedrijf.plaats}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Lines */}
            <Card>
              <CardHeader>
                <CardTitle>Factuurregels</CardTitle>
                <CardDescription>
                  {factuur.regels.length} regel(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Omschrijving</th>
                        <th className="text-right p-3 font-medium">Aantal</th>
                        <th className="text-right p-3 font-medium">Prijs</th>
                        <th className="text-right p-3 font-medium">Totaal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {factuur.regels.map((regel, index) => (
                        <tr key={regel.id || index} className="border-b last:border-0">
                          <td className="p-3">{regel.omschrijving}</td>
                          <td className="p-3 text-right">
                            {regel.hoeveelheid} {regel.eenheid}
                          </td>
                          <td className="p-3 text-right">{formatCurrency(regel.prijsPerEenheid)}</td>
                          <td className="p-3 text-right font-medium">{formatCurrency(regel.totaal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Correcties section */}
                {factuur.correcties && factuur.correcties.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2">Correcties</h4>
                    <div className="space-y-2">
                      {factuur.correcties.map((correctie, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{correctie.omschrijving}</span>
                          <span className={correctie.bedrag >= 0 ? "text-green-600" : "text-red-600"}>
                            {correctie.bedrag >= 0 ? "+" : ""}{formatCurrency(correctie.bedrag)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Totalen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotaal</span>
                  <span className="font-medium">{formatCurrency(factuur.subtotaal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BTW ({factuur.btwPercentage}%)</span>
                  <span className="font-medium">{formatCurrency(factuur.btwBedrag)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Totaal incl. BTW</span>
                  <span className="font-bold">{formatCurrency(factuur.totaalInclBtw)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Status Timeline / Info */}
            <Card>
              <CardHeader>
                <CardTitle>Status Informatie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${factuurStatus === 'betaald' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                    <Receipt className={`h-4 w-4 ${factuurStatus === 'betaald' ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="font-medium">Aangemaakt</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(factuur.factuurdatum)}
                    </p>
                  </div>
                </div>

                {(factuurStatus === 'verzonden' || factuurStatus === 'betaald' || factuurStatus === 'vervallen') && factuur.verzondenAt && (
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${factuurStatus === 'betaald' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                      <Mail className={`h-4 w-4 ${factuurStatus === 'betaald' ? 'text-green-600' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="font-medium">Verzonden</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(factuur.verzondenAt)}
                      </p>
                    </div>
                  </div>
                )}

                {factuurStatus === 'betaald' && factuur.betaaldAt && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Betaald</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(factuur.betaaldAt)}
                      </p>
                    </div>
                  </div>
                )}

                {factuurStatus === 'vervallen' && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">Vervallen</p>
                      <p className="text-sm text-muted-foreground">
                        Betalingstermijn verstreken op {formatDate(factuur.vervaldatum)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notities */}
            {factuur.notities && (
              <Card>
                <CardHeader>
                  <CardTitle>Notities</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {factuur.notities}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Aanmaning Status Samenvatting (FAC-007) */}
            {aanmaningStatus && aanmaningStatus.totaalVerstuurd > 0 && (
              <Card className={
                aanmaningStatus.heeftIngebrekestelling
                  ? "border-red-200 dark:border-red-900"
                  : aanmaningStatus.heeftTweede
                    ? "border-orange-200 dark:border-orange-900"
                    : aanmaningStatus.heeftEerste
                      ? "border-amber-200 dark:border-amber-900"
                      : ""
              }>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Scale className="h-4 w-4" />
                    Aanmaningen
                  </CardTitle>
                  <CardDescription>
                    {aanmaningStatus.volgendNiveau
                      ? `Volgende stap: ${
                          aanmaningStatus.volgendNiveau === "eerste_aanmaning" ? "1e Aanmaning" :
                          aanmaningStatus.volgendNiveau === "tweede_aanmaning" ? "2e Aanmaning" :
                          "Ingebrekestelling"
                        }`
                      : "Alle niveaus verstuurd"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Escalation level indicators */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`flex-1 h-2 rounded-full ${aanmaningStatus.heeftEerste ? "bg-amber-400" : "bg-muted"}`} />
                    <div className={`flex-1 h-2 rounded-full ${aanmaningStatus.heeftTweede ? "bg-orange-400" : "bg-muted"}`} />
                    <div className={`flex-1 h-2 rounded-full ${aanmaningStatus.heeftIngebrekestelling ? "bg-red-500" : "bg-muted"}`} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-3">
                    <span>1e Aanmaning</span>
                    <span>2e Aanmaning</span>
                    <span>Ingebrekestelling</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Herinneringen & Aanmaningen Historie (FAC-006, FAC-007) */}
            {herinneringen && herinneringen.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Historie
                  </CardTitle>
                  <CardDescription>
                    {herinneringen.length} herinnering(en) / aanmaning(en) verstuurd
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {herinneringen.map((h) => {
                    const typeLabelsMap: Record<string, string> = {
                      herinnering: "Herinnering",
                      eerste_aanmaning: "1e Aanmaning",
                      tweede_aanmaning: "2e Aanmaning",
                      ingebrekestelling: "Ingebrekestelling",
                    };
                    const typeColors: Record<string, string> = {
                      herinnering: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
                      eerste_aanmaning: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
                      tweede_aanmaning: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
                      ingebrekestelling: "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-100",
                    };
                    const typeIcons: Record<string, typeof Bell> = {
                      herinnering: Bell,
                      eerste_aanmaning: AlertCircle,
                      tweede_aanmaning: AlertTriangle,
                      ingebrekestelling: Gavel,
                    };
                    const Icon = typeIcons[h.type] ?? Scale;
                    return (
                      <div key={h._id} className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-full ${typeColors[h.type] ?? "bg-muted"}`}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {typeLabelsMap[h.type] ?? h.type}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              #{h.volgnummer}
                            </Badge>
                            {h.emailVerstuurd && (
                              <Mail className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(h.verstuurdAt)} &middot; {h.dagenVervallen} dagen verlopen
                          </p>
                          {h.notities && (
                            <p className="text-xs text-muted-foreground mt-1 truncate" title={h.notities}>
                              {h.notities}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Creditnota Info (FAC-008) */}
            {creditnota && (
              <Card className="border-red-200 dark:border-red-900">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <FileX className="h-4 w-4" />
                    Creditnota
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Nummer</span>
                    <span className="font-medium">{creditnota.factuurnummer}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Datum</span>
                    <span className="font-medium">{formatDateShort(creditnota.factuurdatum)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Bedrag</span>
                    <span className="font-bold text-red-600">{formatCurrency(creditnota.totaalInclBtw)}</span>
                  </div>
                  {creditnota.creditnotaReden && (
                    <>
                      <Separator />
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Reden:</span> {creditnota.creditnotaReden}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Check if factuur exists
  const hasFactuur = factuur !== null && factuur !== undefined;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/projecten">Projecten</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/projecten/${id}`}>
                {project.naam}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Factuur</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      {hasFactuur ? renderFactuurState() : renderNoFactuurState()}

      {/* Aanmaning Bevestigingsdialoog (FAC-007) */}
      <AlertDialog
        open={selectedAanmaningType !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAanmaningType(null);
            setAanmaningNotities("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedAanmaningType === "eerste_aanmaning" && "1e Aanmaning versturen"}
              {selectedAanmaningType === "tweede_aanmaning" && "2e Aanmaning versturen"}
              {selectedAanmaningType === "ingebrekestelling" && "Ingebrekestelling versturen"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {selectedAanmaningType === "eerste_aanmaning" && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800 dark:text-amber-200">Vriendelijke aanmaning</p>
                      <p className="text-amber-700 dark:text-amber-300">
                        De klant ontvangt een vriendelijk verzoek om de openstaande factuur alsnog te voldoen.
                      </p>
                    </div>
                  </div>
                )}
                {selectedAanmaningType === "tweede_aanmaning" && (
                  <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-orange-800 dark:text-orange-200">Formele aanmaning</p>
                      <p className="text-orange-700 dark:text-orange-300">
                        De klant ontvangt een formeel verzoek met de waarschuwing dat verdere stappen volgen bij uitblijven van betaling.
                      </p>
                    </div>
                  </div>
                )}
                {selectedAanmaningType === "ingebrekestelling" && (
                  <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                    <Gavel className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-red-800 dark:text-red-200">Juridische ingebrekestelling</p>
                      <p className="text-red-700 dark:text-red-300">
                        De klant wordt formeel in gebreke gesteld conform art. 6:82 BW. Bij uitblijven van betaling binnen 14 dagen wordt de vordering uit handen gegeven aan een incassobureau.
                      </p>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-2">Notities (optioneel)</p>
                  <Textarea
                    placeholder="Eventuele opmerkingen bij deze aanmaning..."
                    value={aanmaningNotities}
                    onChange={(e) => setAanmaningNotities(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedAanmaningType(null);
              setAanmaningNotities("");
            }}>
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSendAanmaning}
              disabled={isSendingAanmaning}
              className={
                selectedAanmaningType === "ingebrekestelling"
                  ? "bg-red-600 hover:bg-red-700"
                  : selectedAanmaningType === "tweede_aanmaning"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-amber-600 hover:bg-amber-700"
              }
            >
              {isSendingAanmaning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Aanmaning Versturen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
