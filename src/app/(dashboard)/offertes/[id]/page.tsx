"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PaginaReveal } from "@/components/pagina-reveal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { FileText } from "lucide-react";
import { SaveAsTemplateDialog } from "@/components/offerte/save-as-template-dialog";
import { KlantKoppeling } from "@/components/offerte/klant-koppeling";
import { EngagementTimeline } from "@/components/offerte/engagement-timeline";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { usePdfTheme } from "@/hooks/use-pdf-theme";
import { useIsKantoor } from "@/hooks/use-users";
import { OfferteDetailSkeleton } from "@/components/skeletons";
import { STATUS_CONFIG, getStatusConfig } from "@/lib/constants/statuses";
import { Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { showDeleteToast } from "@/lib/toast-utils";

import { DeleteDialog, StatusChangeDialog } from "./components";
import { KoppelWerkitemsDialog } from "./components/koppel-werkitems-dialog";
import { OfferteKop } from "./components/offerte-kop";
import { RegelsPaneel } from "./components/regels-paneel";
import { TotaalHeldvlak } from "./components/totaal-heldvlak";
import { UitvoeringPaneel } from "./components/uitvoering-paneel";
import { KlantPaneel } from "./components/klant-paneel";
import { FacturatiePaneel } from "./components/facturatie-paneel";
import {
  bepaalFases,
  bepaalVolgendeStap,
  type OfferteStatus,
} from "./components/offerte-voortgang";

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
  // PRD §1.2: alleen kantoor mag de offerte naar de klant versturen
  const isKantoor = useIsKantoor();
  const { theme: pdfTheme, voorwaarden: pdfVoorwaarden } = usePdfTheme();

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

  // Acceptatie-informatie (PRD §2.5): moet kantoor eerst werkitems koppelen?
  const acceptatieInfo = useQuery(
    api.vrijeOfferte.acceptatieInfo,
    offerte ? { id: id as Id<"offertes"> } : "skip"
  );
  const [showKoppelDialog, setShowKoppelDialog] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusChangeConfirm, setStatusChangeConfirm] = useState<{
    open: boolean;
    targetStatus: OfferteStatus | null;
    /** Tussenstatus die eerst gezet wordt (concept → voorcalculatie → verzonden). */
    via?: OfferteStatus;
  }>({ open: false, targetStatus: null });

  // Optimistic status update state
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);

  // Get the display status (optimistic or actual)
  const displayStatus = optimisticStatus ?? offerte?.status ?? "concept";

  const handleStatusChange = (newStatus: OfferteStatus, via?: OfferteStatus) => {
    if (!offerte) return;
    // PRD §2.5: geen acceptatie zonder werkitem — koppel-dialoog eerst
    if (newStatus === "geaccepteerd" && acceptatieInfo?.koppelingNodig) {
      setShowKoppelDialog(true);
      return;
    }
    setStatusChangeConfirm({ open: true, targetStatus: newStatus, via });
  };

  // Na de koppel-dialoog: werkitems bestaan, acceptatie kan door
  const accepteerNaKoppeling = async () => {
    if (!offerte) return;
    setOptimisticStatus("geaccepteerd");
    setIsUpdating(true);
    try {
      await updateStatus({ id: offerte._id, status: "geaccepteerd" });
      setOptimisticStatus(null);
      toast.success("Werkitems gekoppeld en offerte geaccepteerd");
    } catch (error) {
      setOptimisticStatus(null);
      const convexData = (error as { data?: string })?.data;
      toast.error(
        typeof convexData === "string"
          ? convexData
          : error instanceof Error
            ? error.message
            : "Fout bij accepteren"
      );
      throw error;
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!offerte || !statusChangeConfirm.targetStatus) return;

    const newStatus = statusChangeConfirm.targetStatus;
    const via = statusChangeConfirm.via;

    // Close dialog
    setStatusChangeConfirm({ open: false, targetStatus: null });

    // 1. Apply optimistic update immediately
    setOptimisticStatus(newStatus);
    setIsUpdating(true);

    // Show immediate feedback
    toast.success(`Status gewijzigd naar ${STATUS_CONFIG[newStatus].label}`);

    try {
      // 2. Make actual server call. "Versturen" vanuit een concept met
      // voorcalculatie gaat via de voorcalculatie-status: de server staat
      // concept → verzonden alleen toe voor vrije offertes. Faalt de tweede
      // stap, dan staat de offerte netjes op voorcalculatie (klaar om te
      // verzenden) en meldt de toast waarom.
      if (via && via !== offerte.status) {
        await updateStatus({ id: offerte._id, status: via });
      }
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
      const nieuweId = await duplicate({
        id: offerte._id,
        newOfferteNummer: newNummer,
      });
      toast.success(`Kopie aangemaakt: ${newNummer}`);
      // Meteen naar de kopie: een toast zonder bestemming liet je zoeken in de
      // lijst, en vanaf "Nieuwe versie aanmaken" is doorwerken de bedoeling.
      router.push(`/offertes/${nieuweId}`);
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
        "Offerte gearchiveerd",
        async () => {
          await restoreOfferte({ id: offerteId });
          router.push(`/offertes/${offerteId}`);
        },
        "Te herstellen via het archief (binnen 30 dagen)"
      );
    } catch {
      toast.error("Fout bij archiveren offerte");
    }
  };

  if (isLoading) {
    return (
      <>
        <PageHeader customLabels={{ [`/offertes/${id}`]: "Laden..." }} />

        <div className="@container/offerte flex flex-1 flex-col p-4 md:px-8 md:py-6">
          <OfferteDetailSkeleton />
        </div>
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

  const status = offerte.status as OfferteStatus;
  const isVrij = offerte.bron === "vrij";
  const heeftVoorcalculatie = !!voorcalculatie;
  const volgendeStap = bepaalVolgendeStap({
    offerteId: id,
    status,
    heeftVoorcalculatie,
    isVrij,
    isKantoor,
    project: existingProject,
  });
  const fases = bepaalFases({
    status,
    heeftVoorcalculatie,
    isVrij,
    verzondenAt: offerte.verzondenAt,
    customerResponse: offerte.customerResponse,
    project: existingProject,
    projectStatusLabel: existingProject
      ? getStatusConfig(existingProject.status, "project").label
      : undefined,
  });

  return (
    <>
      <PageHeader customLabels={{ [`/offertes/${id}`]: offerte.offerteNummer }} />

      {/* Variant A "Regels centraal": kop met fasestrip, de regels als
          hoofdkolom, totaal/uitvoering/klant/facturatie/tijdlijn ernaast.
          Eén reveal op de buitenkant; de blokken eronder zijn gewone divs en
          staan er dus ook als er nul animatieframes vallen.
          → src/components/pagina-reveal.tsx */}
      <PaginaReveal className="@container/offerte flex flex-1 flex-col p-4 md:px-8 md:py-6">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
          <OfferteKop
            offerte={offerte}
            id={id}
            displayStatus={displayStatus}
            isUpdating={isUpdating}
            heeftVoorcalculatie={heeftVoorcalculatie}
            isKantoor={isKantoor}
            instellingen={instellingen}
            pdfTheme={pdfTheme}
            pdfVoorwaarden={pdfVoorwaarden?.offerte}
            offerteVersions={offerteVersions ?? undefined}
            volgendeStap={volgendeStap}
            fases={fases}
            onStatusChange={handleStatusChange}
            onDuplicate={handleDuplicate}
            onShowTemplateDialog={() => setShowTemplateDialog(true)}
            onShowDeleteDialog={() => setShowDeleteDialog(true)}
          />

          {/* Zijkolom ernaast vanaf 64rem containerbreedte, daaronder eronder */}
          <div className="grid items-start gap-5 @5xl/offerte:grid-cols-[minmax(0,1fr)_360px]">
            <RegelsPaneel
              id={id}
              regels={offerte.regels}
              bron={offerte.bron}
              status={offerte.status}
              type={offerte.type}
              algemeenParams={offerte.algemeenParams}
              totalen={offerte.totalen}
              vrijeTeksten={offerte.vrijeTeksten}
              notities={offerte.notities}
            />

            <aside aria-label="Overzicht" className="flex min-w-0 flex-col gap-3.5">
              <TotaalHeldvlak totalen={offerte.totalen} />
              <UitvoeringPaneel
                id={id}
                status={offerte.status}
                isVrij={isVrij}
                begroteUren={offerte.begroteUren}
                calculatieUren={offerte.totalen.totaalUren}
                voorcalculatie={voorcalculatie}
              />
              {offerte.klant ? (
                <KlantPaneel klant={offerte.klant} klantId={offerte.klantId} />
              ) : (
                /* Een concept mag zonder klant bestaan (bv. gestart vanuit een
                   template of als vrije offerte). Dan hoort hier geen gat te
                   vallen maar de plek waar je hem koppelt — vóórdat de statusknop
                   hem alsnog eist. */
                <KlantKoppeling
                  weergave="sectie"
                  offerteId={id as Id<"offertes">}
                  klant={null}
                  klantId={offerte.klantId}
                  status={offerte.status}
                />
              )}
              <FacturatiePaneel
                id={id}
                type={offerte.type}
                status={offerte.status}
                termijnschema={offerte.termijnschema}
              />
              {/* Eén chronologische tijdlijn: systeemdatums + klantactiviteit */}
              <EngagementTimeline
                emailLogs={[]}
                versions={offerteVersions ?? []}
                customerResponse={offerte.customerResponse}
                createdAt={offerte.createdAt}
                updatedAt={offerte.updatedAt}
                verzondenAt={offerte.verzondenAt}
              />
            </aside>
          </div>
        </div>
      </PaginaReveal>

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

      {/* Koppel-dialoog bij acceptatie zonder keten-uitgang (PRD §2.5) */}
      <KoppelWerkitemsDialog
        open={showKoppelDialog}
        onOpenChange={setShowKoppelDialog}
        offerte={offerte}
        onGekoppeld={accepteerNaKoppeling}
      />

      {/* Save as template dialog */}
      <SaveAsTemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        offerte={{
          _id: offerte._id,
          bron: offerte.bron,
          type: offerte.type,
          scopes: offerte.scopes,
          scopeData: offerte.scopeData as Record<string, unknown> | undefined,
          klant: offerte.klant ?? { naam: "" },
        }}
      />

    </>
  );
}
