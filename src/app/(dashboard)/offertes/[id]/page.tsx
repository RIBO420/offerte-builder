"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { m } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { SaveAsTemplateDialog } from "@/components/offerte/save-as-template-dialog";
import { OfferteWorkflowStepper } from "@/components/offerte/offerte-workflow-stepper";
import { EngagementTimeline } from "@/components/offerte/engagement-timeline";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { OfferteDetailSkeleton } from "@/components/skeletons";
import { STATUS_CONFIG } from "@/lib/constants/statuses";
import { Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { showDeleteToast } from "@/lib/toast-utils";

import {
  OfferteHeader,
  VoorcalculatieCard,
  KlantDetailsCard,
  ScopesCard,
  OfferteRegelsCard,
  NotitiesCard,
  TotalenCard,
  TijdlijnCard,
  ProjectCard,
  DeleteDialog,
  StatusChangeDialog,
} from "./components";

export default function OfferteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // Use the combined query that includes voorcalculatie data
  const offerteWithVoorcalculatie = useQuery(
    api.offertes.getWithVoorcalculatie,
    { id: id as Id<"offertes"> }
  );
  const offerte = offerteWithVoorcalculatie ? { ...offerteWithVoorcalculatie, voorcalculatie: undefined } : null;
  const voorcalculatie = offerteWithVoorcalculatie?.voorcalculatie;
  const isLoading = offerteWithVoorcalculatie === undefined;

  const { updateStatus, delete: deleteOfferte, restore: restoreOfferte, duplicate } = useOffertes();
  const { getNextNummer, instellingen } = useInstellingen();

  // Fetch version history for engagement timeline
  const offerteVersions = useQuery(
    api.offerteVersions.listByOfferte,
    { offerteId: id as Id<"offertes"> }
  );

  // Check if a project exists for this offerte (always query to show project info)
  const existingProject = useQuery(
    api.projecten.getByOfferte,
    offerte ? { offerteId: id as Id<"offertes"> } : "skip"
  );

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusChangeConfirm, setStatusChangeConfirm] = useState<{
    open: boolean;
    targetStatus: "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen" | null;
  }>({ open: false, targetStatus: null });

  // Optimistic status update state
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);

  // Get the display status (optimistic or actual)
  const displayStatus = optimisticStatus ?? offerte?.status ?? "concept";

  const handleStatusChange = (
    newStatus: "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen"
  ) => {
    if (!offerte) return;
    setStatusChangeConfirm({ open: true, targetStatus: newStatus });
  };

  const confirmStatusChange = async () => {
    if (!offerte || !statusChangeConfirm.targetStatus) return;

    const newStatus = statusChangeConfirm.targetStatus;

    // Close dialog
    setStatusChangeConfirm({ open: false, targetStatus: null });

    // 1. Apply optimistic update immediately
    setOptimisticStatus(newStatus);
    setIsUpdating(true);

    // Show immediate feedback
    toast.success(`Status gewijzigd naar ${STATUS_CONFIG[newStatus].label}`);

    try {
      // 2. Make actual server call
      await updateStatus({ id: offerte._id, status: newStatus });

      // 3. Clear optimistic state (server data will take over)
      setOptimisticStatus(null);
    } catch (error) {
      // 4. Rollback on error
      setOptimisticStatus(null);
      // Extract message from ConvexError (data property) or regular Error
      const convexData = (error as { data?: string })?.data;
      const errorMessage = typeof convexData === "string"
        ? convexData
        : error instanceof Error ? error.message : "Fout bij wijzigen status";

      // Show contextual toast for voorcalculatie requirement
      if (errorMessage.toLowerCase().includes("voorcalculatie")) {
        toast.error(errorMessage, {
          action: {
            label: "Naar voorcalculatie",
            onClick: () => router.push(`/offertes/${id}/voorcalculatie`),
          },
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDuplicate = async () => {
    if (!offerte) return;
    try {
      const newNummer = await getNextNummer();
      await duplicate({ id: offerte._id, newOfferteNummer: newNummer });
      toast.success("Offerte gedupliceerd");
    } catch {
      toast.error("Fout bij dupliceren offerte");
    }
  };

  const handleDelete = async () => {
    if (!offerte) return;
    try {
      const offerteId = offerte._id;
      await deleteOfferte({ id: offerteId });
      router.push("/offertes");
      // Show undo toast with 30-second window
      showDeleteToast(
        "Offerte verwijderd",
        async () => {
          await restoreOfferte({ id: offerteId });
          router.push(`/offertes/${offerteId}`);
        }
      );
    } catch {
      toast.error("Fout bij verwijderen offerte");
    }
  };

  if (isLoading) {
    return (
      <>
        <PageHeader customLabels={{ [`/offertes/${id}`]: "Laden..." }} />

        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
        >
          <OfferteDetailSkeleton />
        </m.div>
      </>
    );
  }

  if (!offerte) {
    return (
      <>
        <PageHeader customLabels={{ [`/offertes/${id}`]: "Niet gevonden" }} />

        <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                Offerte niet gevonden
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                De offerte met ID &quot;{id}&quot; bestaat niet of je hebt geen
                toegang.
              </p>
              <Button asChild className="mt-4">
                <Link href="/offertes">Terug naar Offertes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader customLabels={{ [`/offertes/${id}`]: offerte.offerteNummer }}>
        <Badge variant="secondary" className="text-sm md:text-lg font-semibold px-2 py-0.5 md:px-3 md:py-1 truncate max-w-[150px] md:max-w-none">
          {formatCurrency(offerte.totalen.totaalInclBtw)} incl. BTW
        </Badge>
      </PageHeader>

      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Header */}
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <OfferteHeader
            offerte={offerte}
            id={id}
            displayStatus={displayStatus}
            isUpdating={isUpdating}
            voorcalculatie={voorcalculatie}
            instellingen={instellingen}
            offerteVersions={offerteVersions ?? undefined}
            onStatusChange={handleStatusChange}
            onDuplicate={handleDuplicate}
            onShowTemplateDialog={() => setShowTemplateDialog(true)}
            onShowDeleteDialog={() => setShowDeleteDialog(true)}
          />
        </m.div>

        {/* Workflow Stepper */}
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Card className="p-4 md:p-6">
            <OfferteWorkflowStepper
              currentStatus={displayStatus as "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen"}
              hasVoorcalculatie={!!voorcalculatie}
              offerteId={id}
              showNextStepAction={true}
            />
          </Card>
        </m.div>

        {/* Voorcalculatie Card */}
        {(offerte.status === "concept" || voorcalculatie) && (
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
          >
            <VoorcalculatieCard
              id={id}
              offerteStatus={offerte.status}
              voorcalculatie={voorcalculatie}
            />
          </m.div>
        )}

        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid gap-4 lg:grid-cols-3"
        >
          {/* Left column - Details */}
          <div className="space-y-4 lg:col-span-2">
            <KlantDetailsCard klant={offerte.klant} />
            <ScopesCard scopes={offerte.scopes} algemeenParams={offerte.algemeenParams} />
            <OfferteRegelsCard regels={offerte.regels} id={id} />
            <NotitiesCard notities={offerte.notities} />
          </div>

          {/* Right column - Totals & Tijdlijn */}
          <div className="space-y-4">
            <TotalenCard totalen={offerte.totalen} />
            <TijdlijnCard
              createdAt={offerte.createdAt}
              updatedAt={offerte.updatedAt}
              verzondenAt={offerte.verzondenAt}
            />
            <EngagementTimeline
              emailLogs={[]}
              versions={offerteVersions ?? []}
              customerResponse={offerte.customerResponse}
              createdAt={offerte.createdAt}
            />
            <ProjectCard
              id={id}
              offerteStatus={offerte.status}
              existingProject={existingProject}
            />
          </div>
        </m.div>
      </m.div>

      {/* Delete confirmation dialog */}
      <DeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        offerteNummer={offerte.offerteNummer}
        onConfirm={handleDelete}
      />

      {/* Status change confirmation dialog */}
      <StatusChangeDialog
        open={statusChangeConfirm.open}
        onOpenChange={(open) => {
          if (!open) setStatusChangeConfirm({ open: false, targetStatus: null });
        }}
        currentStatus={offerte.status}
        targetStatus={statusChangeConfirm.targetStatus}
        onConfirm={confirmStatusChange}
      />

      {/* Save as template dialog */}
      <SaveAsTemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        offerte={{
          type: offerte.type,
          scopes: offerte.scopes,
          scopeData: offerte.scopeData as Record<string, unknown> | undefined,
          klant: offerte.klant,
        }}
      />

    </>
  );
}
