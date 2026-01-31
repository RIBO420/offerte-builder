"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
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
} from "lucide-react";

// Factuur status colors
const statusColors: Record<string, string> = {
  concept: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  definitief: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  verzonden: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  betaald: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  vervallen: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

// Factuur status labels
const statusLabels: Record<string, string> = {
  concept: "Concept",
  definitief: "Definitief",
  verzonden: "Verzonden",
  betaald: "Betaald",
  vervallen: "Vervallen",
};

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

  // Fetch project data
  const projectDetails = useQuery(
    api.projecten.getWithDetails,
    projectId ? { id: projectId } : "skip"
  );

  // Note: facturen API doesn't exist yet - this is a placeholder
  // Once convex/facturen.ts is created with getByProject query, uncomment below:
  // const factuur = useQuery(
  //   api.facturen.getByProject,
  //   projectId ? { projectId } : "skip"
  // );
  const factuur = null; // Placeholder until facturen API exists

  // Fetch nacalculatie for summary preview
  const nacalculatie = useQuery(
    api.nacalculaties.get,
    projectId ? { projectId } : "skip"
  );

  // Mutations - these will need to be created in the facturen API
  // const generateFactuur = useMutation(api.facturen.generate);
  // const updateFactuurStatus = useMutation(api.facturen.updateStatus);
  // const sendFactuur = useMutation(api.facturen.send);

  // Loading state
  if (projectDetails === undefined) {
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

  // Handler for generating factuur (placeholder - needs facturen API)
  const handleGenerateFactuur = async () => {
    setIsGenerating(true);
    try {
      // TODO: Call generateFactuur mutation once facturen API is created
      // await generateFactuur({ projectId });
      toast.info("Factuur genereren functionaliteit wordt binnenkort toegevoegd");
    } catch (error) {
      toast.error("Fout bij genereren factuur");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handler for making factuur definitive
  const handleMakeDefinitief = async () => {
    setIsSaving(true);
    try {
      // TODO: Call updateFactuurStatus mutation once facturen API is created
      // await updateFactuurStatus({ factuurId: factuur._id, status: "definitief" });
      toast.info("Definitief maken functionaliteit wordt binnenkort toegevoegd");
    } catch (error) {
      toast.error("Fout bij definitief maken");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for sending factuur
  const handleSendFactuur = async () => {
    setIsSending(true);
    try {
      // TODO: Call sendFactuur mutation once facturen API is created
      // await sendFactuur({ factuurId: factuur._id });
      toast.info("Verzenden functionaliteit wordt binnenkort toegevoegd");
    } catch (error) {
      toast.error("Fout bij verzenden factuur");
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  // Handler for marking as paid
  const handleMarkAsPaid = async () => {
    setIsSaving(true);
    try {
      // TODO: Call updateFactuurStatus mutation once facturen API is created
      // await updateFactuurStatus({ factuurId: factuur._id, status: "betaald" });
      toast.info("Betaald markeren functionaliteit wordt binnenkort toegevoegd");
    } catch (error) {
      toast.error("Fout bij markeren als betaald");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for sending reminder
  const handleSendReminder = async () => {
    setIsSending(true);
    try {
      // TODO: Call sendReminder mutation once facturen API is created
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
          <Button variant="ghost" size="icon" asChild>
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
            <p className="text-muted-foreground">
              {project.naam}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Preview Card */}
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Factuur Samenvatting Preview
          </CardTitle>
          <CardDescription>
            Bekijk de samenvatting voordat je de factuur genereert
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Client Info */}
          {offerte && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <User className="h-4 w-4" />
                  Klantgegevens
                </div>
                <div className="rounded-lg border p-4">
                  <p className="font-medium">{offerte.klant.naam}</p>
                  <p className="text-sm text-muted-foreground">{offerte.klant.adres}</p>
                  <p className="text-sm text-muted-foreground">
                    {offerte.klant.postcode} {offerte.klant.plaats}
                  </p>
                  {offerte.klant.email && (
                    <p className="text-sm text-muted-foreground mt-2">{offerte.klant.email}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Euro className="h-4 w-4" />
                  Bedragen uit Offerte
                </div>
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Subtotaal</span>
                    <span className="font-medium">{formatCurrency(offerte.totalen.totaalExBtw)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">BTW ({offerte.totalen.btw > 0 ? '21%' : '0%'})</span>
                    <span className="font-medium">{formatCurrency(offerte.totalen.btw)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-medium">Totaal incl. BTW</span>
                    <span className="font-bold text-lg">{formatCurrency(offerte.totalen.totaalInclBtw)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nacalculatie info (if available) */}
          {nacalculatie && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                Nacalculatie Afwijking
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Afwijking uren</span>
                  <Badge
                    variant={nacalculatie.afwijkingPercentage > 10 ? "destructive" : nacalculatie.afwijkingPercentage < -10 ? "default" : "secondary"}
                  >
                    {nacalculatie.afwijkingPercentage > 0 ? "+" : ""}
                    {nacalculatie.afwijkingPercentage.toFixed(1)}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Let op: Bij grote afwijkingen kan het nodig zijn om correctieregels toe te voegen aan de factuur.
                </p>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="flex justify-center pt-4">
            <Button
              size="lg"
              onClick={handleGenerateFactuur}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Factuur Genereren
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Render factuur exists state with status-based actions
  const renderFactuurState = () => {
    // Using mock data until facturen API exists
    const mockFactuur = {
      _id: "mock" as Id<"facturen">,
      factuurnummer: `${new Date().getFullYear()}-001`,
      status: "concept" as const,
      klant: offerte?.klant || { naam: "", adres: "", postcode: "", plaats: "" },
      bedrijf: { naam: "Top Tuinen", adres: "", postcode: "", plaats: "" },
      regels: offerte?.regels || [],
      subtotaal: offerte?.totalen.totaalExBtw || 0,
      btwPercentage: 21,
      btwBedrag: offerte?.totalen.btw || 0,
      totaalInclBtw: offerte?.totalen.totaalInclBtw || 0,
      factuurdatum: Date.now(),
      vervaldatum: Date.now() + 14 * 24 * 60 * 60 * 1000,
      betalingstermijnDagen: 14,
    };

    // Use actual factuur if available, otherwise mock
    const currentFactuur = factuur || mockFactuur;
    const factuurStatus = currentFactuur.status;

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
                  <Button className="gap-2">
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
              <Button className="gap-2" onClick={handleSendFactuur} disabled={isSending}>
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Verzenden
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
                  <Button className="gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Markeer als Betaald
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Factuur als betaald markeren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Hiermee bevestig je dat de betaling is ontvangen. De factuurstatus wordt
                      gewijzigd naar &apos;Betaald&apos;.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={handleMarkAsPaid} disabled={isSaving}>
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

    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/projecten/${id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <Receipt className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Factuur {currentFactuur.factuurnummer}
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
                {formatCurrency(currentFactuur.totaalInclBtw)}
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
                {formatDateShort(currentFactuur.factuurdatum)}
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
                {formatDateShort(currentFactuur.vervaldatum)}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentFactuur.betalingstermijnDagen} dagen betalingstermijn
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
              <p className="text-lg font-bold truncate">
                {currentFactuur.klant.naam}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {currentFactuur.klant.plaats}
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
                      <p className="font-medium">{currentFactuur.klant.naam}</p>
                      <p className="text-sm text-muted-foreground">{currentFactuur.klant.adres}</p>
                      <p className="text-sm text-muted-foreground">
                        {currentFactuur.klant.postcode} {currentFactuur.klant.plaats}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      Van
                    </div>
                    <div>
                      <p className="font-medium">{currentFactuur.bedrijf.naam}</p>
                      <p className="text-sm text-muted-foreground">{currentFactuur.bedrijf.adres}</p>
                      <p className="text-sm text-muted-foreground">
                        {currentFactuur.bedrijf.postcode} {currentFactuur.bedrijf.plaats}
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
                  {currentFactuur.regels.length} regel(s)
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
                      {currentFactuur.regels.map((regel: any, index: number) => (
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
                  <span className="font-medium">{formatCurrency(currentFactuur.subtotaal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BTW ({currentFactuur.btwPercentage}%)</span>
                  <span className="font-medium">{formatCurrency(currentFactuur.btwBedrag)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Totaal incl. BTW</span>
                  <span className="font-bold">{formatCurrency(currentFactuur.totaalInclBtw)}</span>
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
                      {formatDate(currentFactuur.factuurdatum)}
                    </p>
                  </div>
                </div>

                {(factuurStatus === 'verzonden' || factuurStatus === 'betaald' || factuurStatus === 'vervallen') && (
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${factuurStatus === 'betaald' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                      <Mail className={`h-4 w-4 ${factuurStatus === 'betaald' ? 'text-green-600' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="font-medium">Verzonden</p>
                      <p className="text-sm text-muted-foreground">
                        {/* TODO: Show actual sent date */}
                        Naar {currentFactuur.klant.email || currentFactuur.klant.naam}
                      </p>
                    </div>
                  </div>
                )}

                {factuurStatus === 'betaald' && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Betaald</p>
                      <p className="text-sm text-muted-foreground">
                        {/* TODO: Show actual payment date */}
                        Betaling ontvangen
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
                        Betalingstermijn verstreken op {formatDate(currentFactuur.vervaldatum)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  // Check if factuur exists
  // Note: Since facturen API doesn't exist yet, we always show "no factuur" state
  // Once the API exists, uncomment the condition below
  // const hasFactuur = factuur !== null && factuur !== undefined;
  const hasFactuur = false; // Placeholder until facturen API exists

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
