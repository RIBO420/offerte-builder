"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../../../../../convex/_generated/api";
import { Doc, Id } from "../../../../../../convex/_generated/dataModel";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  PartyPopper,
  Sparkles,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { transitions, fadeInUp } from "@/lib/motion-config";

// Factuur status colors - WCAG AA compliant (4.5:1 contrast ratio)
const statusColors: Record<string, string> = {
  concept: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  definitief: "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  verzonden: "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  betaald: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200",
  vervallen: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200",
};

// Factuur status labels
const statusLabels: Record<string, string> = {
  concept: "Concept",
  definitief: "Definitief",
  verzonden: "Verzonden",
  betaald: "Betaald",
  vervallen: "Vervallen",
};

// Workflow steps for the invoice process
const workflowSteps = [
  { id: "genereer", label: "Genereer", icon: FileText },
  { id: "controleer", label: "Controleer", icon: Eye },
  { id: "verstuur", label: "Verstuur", icon: Send },
  { id: "betaald", label: "Betaald", icon: CheckCircle },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Get current workflow step based on factuur status
function getWorkflowStep(status: string | null): number {
  if (!status) return 0;
  switch (status) {
    case "concept":
      return 1;
    case "definitief":
      return 2;
    case "verzonden":
      return 3;
    case "betaald":
      return 4;
    case "vervallen":
      return 3; // Same as verzonden but with warning
    default:
      return 0;
  }
}

// Workflow Step Indicator Component
function WorkflowStepIndicator({
  currentStep,
  status,
}: {
  currentStep: number;
  status: string | null;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {workflowSteps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <motion.div
                initial={prefersReducedMotion ? {} : { scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: prefersReducedMotion ? 0 : index * 0.1,
                  ...transitions.fast,
                }}
                className="flex flex-col items-center"
              >
                <div
                  className={`
                    relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300
                    ${isCompleted ? "border-green-500 bg-green-500 text-white" : ""}
                    ${isCurrent ? "border-primary bg-primary text-white ring-4 ring-primary/20" : ""}
                    ${isUpcoming ? "border-muted-foreground/30 bg-muted text-muted-foreground" : ""}
                  `}
                >
                  {isCompleted ? (
                    <motion.div
                      initial={prefersReducedMotion ? {} : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    >
                      <Check className="h-5 w-5" />
                    </motion.div>
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-xs font-medium whitespace-nowrap
                    ${isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"}
                  `}
                >
                  {step.label}
                </span>
              </motion.div>

              {/* Connector line */}
              {index < workflowSteps.length - 1 && (
                <div className="flex-1 mx-2 h-0.5 rounded-full bg-muted-foreground/20 relative overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-green-500 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: isCompleted ? "100%" : "0%" }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, delay: index * 0.1 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Pre-computed sparkle positions for celebration animation
const sparklePositions = [
  { x: 5, y: -3, left: 15, top: 20 },
  { x: -7, y: 8, left: 30, top: 45 },
  { x: 3, y: -5, left: 45, top: 70 },
  { x: -4, y: 6, left: 60, top: 20 },
  { x: 8, y: -2, left: 75, top: 45 },
  { x: -6, y: 4, left: 90, top: 70 },
];

// Celebration Component for completed invoices
function ProjectCompletedCelebration({
  projectNaam,
  bedrag,
  onDismiss,
}: {
  projectNaam: string;
  bedrag: number;
  onDismiss: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={transitions.entrance}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 p-8 text-white shadow-2xl"
    >
      {/* Animated background sparkles */}
      {!prefersReducedMotion && (
        <div className="absolute inset-0 overflow-hidden">
          {sparklePositions.map((pos, i) => (
            <motion.div
              key={i}
              className="absolute"
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0.5, 1.2, 0.5],
                x: [0, pos.x],
                y: [0, pos.y],
              }}
              transition={{
                duration: 2,
                delay: i * 0.3,
                repeat: Infinity,
                repeatDelay: 1,
              }}
              style={{
                left: `${pos.left}%`,
                top: `${pos.top}%`,
              }}
            >
              <Sparkles className="h-6 w-6 text-white/40" />
            </motion.div>
          ))}
        </div>
      )}

      <div className="relative z-10">
        {/* Icon */}
        <motion.div
          className="mb-6 flex justify-center"
          animate={prefersReducedMotion ? {} : { rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <PartyPopper className="h-10 w-10" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h2
          className="mb-2 text-center text-2xl font-bold md:text-3xl"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Project Voltooid!
        </motion.h2>

        {/* Project name */}
        <motion.p
          className="mb-4 text-center text-lg text-white/90"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {projectNaam}
        </motion.p>

        {/* Amount */}
        <motion.div
          className="mb-6 text-center"
          initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
        >
          <div className="inline-block rounded-xl bg-white/20 px-6 py-3 backdrop-blur-sm">
            <p className="text-sm text-white/80">Totaal ontvangen</p>
            <p className="text-3xl font-bold">{formatCurrency(bedrag)}</p>
          </div>
        </motion.div>

        {/* Message */}
        <motion.p
          className="mb-6 text-center text-white/80"
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Gefeliciteerd! De factuur is betaald en het project is succesvol afgerond.
        </motion.p>

        {/* Dismiss button */}
        <motion.div
          className="flex justify-center"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button
            onClick={onDismiss}
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            Bekijk Details
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Invoice Preview Card Component
function InvoicePreviewCard({
  offerte,
  nacalculatie,
  project,
  onGenerate,
  isGenerating,
}: {
  offerte: Doc<"offertes"> | null;
  nacalculatie: Doc<"nacalculaties"> | null;
  project: Doc<"projecten">;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      transition={prefersReducedMotion ? { duration: 0 } : transitions.entrance}
    >
      <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
        <CardHeader className="text-center pb-4">
          <motion.div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
            animate={prefersReducedMotion ? {} : { y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <FileText className="h-8 w-8 text-primary" />
          </motion.div>
          <CardTitle className="text-xl">Factuur Voorvertoning</CardTitle>
          <CardDescription>
            Bekijk de gegevens voordat je de factuur genereert
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mini Invoice Preview */}
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            {/* Header simulation */}
            <div className="flex justify-between items-start mb-4 pb-4 border-b">
              <div>
                <p className="text-xs text-muted-foreground">FACTUUR VOOR</p>
                {offerte && (
                  <>
                    <p className="font-semibold">{offerte.klant.naam}</p>
                    <p className="text-sm text-muted-foreground">{offerte.klant.adres}</p>
                    <p className="text-sm text-muted-foreground">
                      {offerte.klant.postcode} {offerte.klant.plaats}
                    </p>
                  </>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">PROJECT</p>
                <p className="font-semibold">{project.naam}</p>
              </div>
            </div>

            {/* Amount summary */}
            {offerte && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotaal</span>
                  <span>{formatCurrency(offerte.totalen.totaalExBtw)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    BTW ({offerte.totalen.btw > 0 ? "21%" : "0%"})
                  </span>
                  <span>{formatCurrency(offerte.totalen.btw)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Totaal</span>
                  <span className="text-primary">
                    {formatCurrency(offerte.totalen.totaalInclBtw)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Nacalculatie warning if applicable */}
          {nacalculatie && Math.abs(nacalculatie.afwijkingPercentage) > 10 && (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950"
            >
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Afwijking in uren: {nacalculatie.afwijkingPercentage > 0 ? "+" : ""}
                  {nacalculatie.afwijkingPercentage.toFixed(1)}%
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Overweeg correctieregels toe te voegen aan de factuur.
                </p>
              </div>
            </motion.div>
          )}

          {/* Generate button */}
          <div className="pt-4">
            <Button
              size="lg"
              className="w-full gap-2 h-14 text-lg"
              onClick={onGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Factuur wordt gegenereerd...
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  Genereer Factuur
                  <ChevronRight className="h-5 w-5 ml-auto" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Success state after sending invoice
function InvoiceSentSuccess({
  factuurNummer,
  klantEmail,
  onContinue,
}: {
  factuurNummer: string;
  klantEmail?: string;
  onContinue: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={transitions.entrance}
      className="rounded-xl border-2 border-green-200 bg-gradient-to-b from-green-50 to-white p-8 text-center dark:border-green-900 dark:from-green-950 dark:to-background"
    >
      <motion.div
        className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
        initial={prefersReducedMotion ? {} : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
      >
        <motion.div
          initial={prefersReducedMotion ? {} : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Send className="h-10 w-10 text-green-600 dark:text-green-400" />
        </motion.div>
      </motion.div>

      <h3 className="mb-2 text-2xl font-bold text-green-800 dark:text-green-200">
        Factuur Verzonden!
      </h3>
      <p className="mb-4 text-lg text-green-700 dark:text-green-300">
        Factuur {factuurNummer} is succesvol verstuurd
      </p>
      {klantEmail && (
        <p className="mb-6 text-muted-foreground">
          De klant ontvangt de factuur op {klantEmail}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button variant="outline" className="gap-2" onClick={onContinue}>
          <Eye className="h-4 w-4" />
          Bekijk Factuur
        </Button>
      </div>

      <motion.p
        className="mt-6 text-sm text-muted-foreground"
        initial={prefersReducedMotion ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        Vergeet niet de factuur als betaald te markeren wanneer de betaling is ontvangen.
      </motion.p>
    </motion.div>
  );
}

// Loading skeleton component for this page
function FactuurPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
