"use client";

import { use, useState } from "react";
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
import { Progress } from "@/components/ui/progress";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Loader2,
  ClipboardCheck,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Camera,
} from "lucide-react";
import { QCChecklistCard } from "@/components/project/qc-checklist-card";
import { QCFotoUpload } from "@/components/project/qc-foto-upload";
import { QCApprovalDialog } from "@/components/project/qc-approval-dialog";
import { QCPageSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";

// QC Status types
type QCStatus = "open" | "in_uitvoering" | "goedgekeurd" | "afgekeurd";

// Scope display names
const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gras",
  houtwerk: "Houtwerk",
  water_elektra: "Water & Elektra",
  specials: "Specials",
  gras_onderhoud: "Gras (Onderhoud)",
  borders_onderhoud: "Borders (Onderhoud)",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
};

// Status summary config
const statusSummaryConfig: Record<
  QCStatus,
  { label: string; color: string; bgColor: string }
> = {
  open: {
    label: "Open",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  in_uitvoering: {
    label: "In uitvoering",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  goedgekeurd: {
    label: "Goedgekeurd",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  afgekeurd: {
    label: "Afgekeurd",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
};

export default function KwaliteitscontrolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const projectId = id as Id<"projecten">;

  // State for dialogs
  const [showNewQCDialog, setShowNewQCDialog] = useState(false);
  const [selectedScope, setSelectedScope] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [approvalDialog, setApprovalDialog] = useState<{
    open: boolean;
    id: Id<"kwaliteitsControles"> | null;
    scope: string;
    type: "approve" | "reject";
  }>({
    open: false,
    id: null,
    scope: "",
    type: "approve",
  });
  const [expandedQC, setExpandedQC] =
    useState<Id<"kwaliteitsControles"> | null>(null);

  // Queries
  const projectDetails = useQuery(
    api.projecten.getWithDetails,
    projectId ? { id: projectId } : "skip",
  );
  const qcControles = useQuery(
    api.kwaliteitsControles.getByProject,
    projectId ? { projectId } : "skip",
  );
  const qcSummary = useQuery(
    api.kwaliteitsControles.getProjectSummary,
    projectId ? { projectId } : "skip",
  );

  // Mutations
  const createQC = useMutation(api.kwaliteitsControles.create);

  // Loading state
  if (projectDetails === undefined || qcControles === undefined) {
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
                <BreadcrumbPage>Kwaliteit</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <QCPageSkeleton />
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

  const { project, offerte } = projectDetails;

  // Get available scopes from offerte
  const availableScopes = offerte?.scopes || [];
  const existingQCScopes = new Set(qcControles?.map((qc) => qc.scope) || []);
  const scopesWithoutQC = availableScopes.filter(
    (scope) => !existingQCScopes.has(scope),
  );

  // Handle create new QC
  const handleCreateQC = async () => {
    if (!selectedScope) return;

    setIsCreating(true);
    try {
      const newId = await createQC({
        projectId,
        scope: selectedScope,
      });
      setShowNewQCDialog(false);
      setSelectedScope("");
      setExpandedQC(newId);
    } catch (error) {
      console.error("Fout bij aanmaken QC:", error);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle approval/rejection
  const handleApprove = (qcId: Id<"kwaliteitsControles">, scope: string) => {
    setApprovalDialog({
      open: true,
      id: qcId,
      scope,
      type: "approve",
    });
  };

  const handleReject = (qcId: Id<"kwaliteitsControles">, scope: string) => {
    setApprovalDialog({
      open: true,
      id: qcId,
      scope,
      type: "reject",
    });
  };

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
              <BreadcrumbPage>Kwaliteitscontrole</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-8 sm:w-8"
              asChild
              aria-label="Terug naar project"
            >
              <Link href={`/projecten/${id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Kwaliteitscontrole
                </h1>
              </div>
              <p className="text-muted-foreground">{project.naam}</p>
            </div>
          </div>
          <Button
            onClick={() => setShowNewQCDialog(true)}
            disabled={scopesWithoutQC.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nieuwe QC Check
          </Button>
        </div>

        {/* Summary Cards */}
        {qcSummary && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Overall Progress */}
            <Card className="sm:col-span-2 lg:col-span-1">
              <CardHeader className="pb-2">
                <CardDescription>Totale voortgang</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {qcSummary.voortgangPercentage}%
                    </span>
                  </div>
                  <Progress
                    value={qcSummary.voortgangPercentage}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    {qcSummary.afgevinktItems}/{qcSummary.totaalItems} items
                    afgevinkt
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Status counters */}
            {(
              [
                "open",
                "in_uitvoering",
                "goedgekeurd",
                "afgekeurd",
              ] as QCStatus[]
            ).map((status) => {
              const config = statusSummaryConfig[status];
              const count =
                status === "open"
                  ? qcSummary.open
                  : status === "in_uitvoering"
                    ? qcSummary.inUitvoering
                    : status === "goedgekeurd"
                      ? qcSummary.goedgekeurd
                      : qcSummary.afgekeurd;

              return (
                <Card key={status} className={cn("border-0", config.bgColor)}>
                  <CardHeader className="pb-2">
                    <CardDescription className={config.color}>
                      {config.label}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {status === "open" && (
                        <Clock className={cn("h-5 w-5", config.color)} />
                      )}
                      {status === "in_uitvoering" && (
                        <AlertCircle className={cn("h-5 w-5", config.color)} />
                      )}
                      {status === "goedgekeurd" && (
                        <CheckCircle2 className={cn("h-5 w-5", config.color)} />
                      )}
                      {status === "afgekeurd" && (
                        <XCircle className={cn("h-5 w-5", config.color)} />
                      )}
                      <span className={cn("text-2xl font-bold", config.color)}>
                        {count}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* QC Checks List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Kwaliteitscontroles per scope
          </h2>

          {qcControles && qcControles.length > 0 ? (
            <div className="space-y-4">
              {qcControles.map((qc) => (
                <div key={qc._id} className="space-y-4">
                  <QCChecklistCard
                    id={qc._id}
                    scope={qc.scope}
                    status={qc.status as QCStatus}
                    checklistItems={qc.checklistItems}
                    opmerkingen={qc.opmerkingen}
                    goedgekeurdDoor={qc.goedgekeurdDoor}
                    goedgekeurdAt={qc.goedgekeurdAt}
                    onApprove={() => handleApprove(qc._id, qc.scope)}
                    onReject={() => handleReject(qc._id, qc.scope)}
                    defaultExpanded={expandedQC === qc._id}
                  />

                  {/* Photo upload section */}
                  <Card className="ml-4 border-l-4 border-l-muted">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Camera className="h-4 w-4" />
                        {"Foto's"} - {scopeLabels[qc.scope] || qc.scope}
                      </CardTitle>
                      <CardDescription>
                        {"Upload foto's van voor en na de werkzaamheden"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <QCFotoUpload
                        kwaliteitsControleId={qc._id}
                        fotos={qc.fotos || []}
                        disabled={
                          qc.status === "goedgekeurd" ||
                          qc.status === "afgekeurd"
                        }
                      />
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ClipboardCheck className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">
                  Nog geen kwaliteitscontroles
                </h3>
                <p className="mt-2 text-center text-sm text-muted-foreground max-w-sm">
                  Start met het aanmaken van kwaliteitscontroles voor de
                  verschillende scopes van dit project.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setShowNewQCDialog(true)}
                  disabled={scopesWithoutQC.length === 0}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Eerste QC Check aanmaken
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Scopes without QC */}
        {scopesWithoutQC.length > 0 &&
          qcControles &&
          qcControles.length > 0 && (
            <Card className="border-dashed bg-muted/30">
              <CardHeader>
                <CardTitle className="text-base">
                  Scopes zonder QC check
                </CardTitle>
                <CardDescription>
                  De volgende scopes hebben nog geen kwaliteitscontrole
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {scopesWithoutQC.map((scope) => (
                    <Badge key={scope} variant="outline">
                      {scopeLabels[scope] || scope}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
      </div>

      {/* New QC Dialog */}
      <Dialog open={showNewQCDialog} onOpenChange={setShowNewQCDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe kwaliteitscontrole</DialogTitle>
            <DialogDescription>
              Selecteer een scope om een nieuwe kwaliteitscontrole aan te maken.
              De standaard checklist items worden automatisch toegevoegd.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Select value={selectedScope} onValueChange={setSelectedScope}>
                <SelectTrigger id="scope">
                  <SelectValue placeholder="Selecteer een scope" />
                </SelectTrigger>
                <SelectContent>
                  {scopesWithoutQC.length > 0 ? (
                    scopesWithoutQC.map((scope) => (
                      <SelectItem key={scope} value={scope}>
                        {scopeLabels[scope] || scope}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="_none" disabled>
                      Alle scopes hebben al een QC check
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewQCDialog(false)}>
              Annuleren
            </Button>
            <Button
              onClick={handleCreateQC}
              disabled={!selectedScope || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aanmaken...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Aanmaken
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      {approvalDialog.id && (
        <QCApprovalDialog
          open={approvalDialog.open}
          onOpenChange={(open) =>
            setApprovalDialog((prev) => ({ ...prev, open }))
          }
          kwaliteitsControleId={approvalDialog.id}
          scope={approvalDialog.scope}
          type={approvalDialog.type}
        />
      )}
    </>
  );
}
