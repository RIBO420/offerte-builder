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

  // Mutations
  const generateFactuur = useMutation(api.facturen.generate);
  const updateFactuurStatus = useMutation(api.facturen.updateStatus);
  const markAsPaidAndArchive = useMutation(api.facturen.markAsPaidAndArchiveProject);

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

  // Handler for sending reminder
  const handleSendReminder = async () => {
    setIsSending(true);
    try {
      // TODO: Implement reminder functionality when API is available
      toast.info("Herinnering verzenden functionaliteit wordt binnenkort toegevoegd");
    } catch (error) {
      toast.error("Fout bij verzenden herinnering");
      console.error(error);
    } finally {
      setIsSending(false);
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
    </>
  );
}
