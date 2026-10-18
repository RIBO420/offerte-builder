"use client";

import { use, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { ArrowLeft, ChevronDown, FileText, Loader2 } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../../convex/_generated/dataModel";
import { QC_STATUS_CONFIG, type QCStatus } from "@/lib/constants/statuses";
import { scopeLabel } from "@/lib/rapportage-labels";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { ProjectKop } from "@/components/project/project-kop";
import { scopeStip } from "@/components/project/project-cijfers";
import { QCChecklistCard } from "@/components/project/qc-checklist-card";
import { QCApprovalDialog } from "@/components/project/qc-approval-dialog";
import { QCPageSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { showErrorToast } from "@/lib/toast-utils";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";

type Controle = Doc<"kwaliteitsControles">;

/** De vier tellers van de standregel, in werkvolgorde. */
const TELLERS: { status: QCStatus; label: string }[] = [
  { status: "open", label: "open" },
  { status: "in_uitvoering", label: "bezig" },
  { status: "goedgekeurd", label: "goedgekeurd" },
  { status: "afgekeurd", label: "afgekeurd" },
];

/**
 * De ene gevulde hoofdknop van het scherm: eerst de eerste scope die nog geen
 * controle heeft; zijn alle scopes gestart, dan "Goedkeuren" van de eerste
 * controle waarvan alle punten zijn afgevinkt.
 */
type HoofdActie =
  | { soort: "starten"; scope: string }
  | { soort: "goedkeuren"; id: Id<"kwaliteitsControles"> }
  | null;

export default function KwaliteitscontrolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const projectId = id as Id<"projecten">;

  const [startendeScope, setStartendeScope] = useState<string | null>(null);
  const [approvalDialog, setApprovalDialog] = useState<{
    open: boolean;
    id: Id<"kwaliteitsControles"> | null;
    scope: string;
    type: "approve" | "reject";
  }>({ open: false, id: null, scope: "", type: "approve" });

  const projectDetails = useQuery(api.projecten.getWithDetails, { id: projectId });
  const qcControles = useQuery(api.kwaliteitsControles.getByProject, { projectId });
  // Bestaande query met de standaardlijsten per scope: daarmee tonen we vóór
  // het starten welke punten een controle krijgt.
  const standaardLijsten = useQuery(api.kwaliteitsControles.getAllDefaultChecklists, {});

  const createQC = useMutation(api.kwaliteitsControles.create);

  if (projectDetails === undefined || qcControles === undefined) {
    return (
      <>
        <PageHeader />
        <QCPageSkeleton />
      </>
    );
  }

  if (!projectDetails) {
    return (
      <>
        <PageHeader customLabels={{ [`/projecten/${id}/kwaliteit`]: "Niet gevonden" }} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <FileText className="size-12 text-muted-foreground/50" aria-hidden="true" />
          <h2 className="font-display text-lg font-medium">Project niet gevonden</h2>
          <Button variant="outline" onClick={() => router.push("/projecten")}>
            <ArrowLeft aria-hidden="true" />
            Terug naar projecten
          </Button>
        </div>
      </>
    );
  }

  const { project, offerte } = projectDetails;

  // Scopes uit de offerte, in offertevolgorde; een controle voor een scope die
  // (niet meer) in de offerte staat, blijft zichtbaar achteraan.
  const controlePerScope = new Map<string, Controle>(qcControles.map((qc) => [qc.scope, qc]));
  const offerteScopes = offerte?.scopes ?? [];
  const scopes = [
    ...offerteScopes,
    ...qcControles.map((qc) => qc.scope).filter((s) => !offerteScopes.includes(s)),
  ].filter((s, i, lijst) => lijst.indexOf(s) === i);

  const standaardPerScope = new Map<string, string[]>(
    (standaardLijsten ?? []).map((lijst) => [
      lijst.scope,
      lijst.items.map((item) => item.omschrijving),
    ])
  );
  // Zelfde terugval als `create`: onbekende scope krijgt de lijst "overig".
  const standaardVoor = (scope: string) =>
    standaardLijsten === undefined
      ? undefined
      : (standaardPerScope.get(scope) ?? standaardPerScope.get("overig") ?? []);

  const telling: Record<QCStatus, number> = {
    open: 0,
    in_uitvoering: 0,
    goedgekeurd: 0,
    afgekeurd: 0,
  };
  for (const qc of qcControles) {
    if (qc.status in telling) telling[qc.status as QCStatus] += 1;
  }

  const eersteZonder = scopes.find((s) => !controlePerScope.has(s));
  const eersteKlaar = scopes
    .map((s) => controlePerScope.get(s))
    .find(
      (qc): qc is Controle =>
        !!qc &&
        (qc.status === "open" || qc.status === "in_uitvoering") &&
        qc.checklistItems.length > 0 &&
        qc.checklistItems.every((item) => item.isAfgevinkt)
    );
  const hoofdActie: HoofdActie = eersteZonder
    ? { soort: "starten", scope: eersteZonder }
    : eersteKlaar
      ? { soort: "goedkeuren", id: eersteKlaar._id }
      : null;

  const handleStart = async (scope: string) => {
    if (startendeScope) return;
    setStartendeScope(scope);
    try {
      await createQC({ projectId, scope });
    } catch (error) {
      logger.error("Aanmaken kwaliteitscontrole mislukt", error, {
        module: "projecten/kwaliteit",
        projectId,
        scope,
      });
      showErrorToast("Kwaliteitscontrole kon niet worden gestart", {
        description: getMutationErrorMessage(error),
      });
    } finally {
      setStartendeScope(null);
    }
  };

  const openBeoordeling = (qc: Controle, type: "approve" | "reject") =>
    setApprovalDialog({ open: true, id: qc._id, scope: qc.scope, type });

  return (
    <>
      <PageHeader customLabels={{ [`/projecten/${id}`]: project.naam }} />

      <div className={`${REVEAL_KLASSE} flex flex-1 flex-col gap-5 p-4 md:p-8`}>
        {/* Geen "Nieuwe QC-check" in de kop: elke scope heeft hieronder zijn
            eigen startknop, dat is één handeling minder en altijd duidelijk
            welke scope je start. */}
        <ProjectKop projectId={id} actief="kwaliteit" />

        <div className="@container/kwaliteit">
          <div className="grid items-start gap-5 @4xl/kwaliteit:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
            <div className="flex min-w-0 flex-col gap-4">
              {/* Stand in één regel */}
              <section
                aria-label="Stand van de controles"
                className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-card px-4 py-3"
              >
                <p className="text-[15px] tabular-nums">
                  <span className="font-semibold">
                    {telling.goedgekeurd} van {scopes.length}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {scopes.length === 1 ? "scope" : "scopes"} gecontroleerd
                  </span>
                </p>
                <span aria-hidden="true" className="hidden h-[18px] w-px bg-border @md/kwaliteit:block" />
                <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
                  {TELLERS.map(({ status, label }) => (
                    <li
                      key={status}
                      className="flex items-center gap-1.5 text-[13px] tabular-nums text-muted-foreground"
                    >
                      <span
                        aria-hidden="true"
                        className={cn("size-2 rounded-full", QC_STATUS_CONFIG[status].color.dot)}
                      />
                      {telling[status]} {label}
                    </li>
                  ))}
                </ul>
              </section>

              {scopes.length === 0 ? (
                <SectiePaneel
                  titel="Scopes"
                  kopbalk
                  legeRegel={{
                    tekst: "Geen scopes in de offerte",
                    hint: "Een controle start je per scope uit de offerte.",
                  }}
                />
              ) : (
                scopes.map((scope) => {
                  const qc = controlePerScope.get(scope);
                  if (qc) {
                    return (
                      <QCChecklistCard
                        key={scope}
                        controle={qc}
                        onApprove={() => openBeoordeling(qc, "approve")}
                        onReject={() => openBeoordeling(qc, "reject")}
                        goedkeurenGevuld={
                          hoofdActie?.soort === "goedkeuren" && hoofdActie.id === qc._id
                        }
                      />
                    );
                  }
                  const gevuld = hoofdActie?.soort === "starten" && hoofdActie.scope === scope;
                  return (
                    <ScopeZonderControle
                      key={scope}
                      scope={scope}
                      punten={standaardVoor(scope)}
                      gevuld={gevuld}
                      bezig={startendeScope === scope}
                      uitgeschakeld={startendeScope !== null}
                      onStart={() => handleStart(scope)}
                    />
                  );
                })
              )}
            </div>

            <aside aria-label="Zo werkt een controle" className="flex min-w-0 flex-col gap-4">
              <SectiePaneel titel="Zo werkt een controle" kopbalk>
                <ol className="flex flex-col gap-3 p-4 text-[13px]">
                  {[
                    ["Start per scope.", "De punten komen uit de standaardlijst."],
                    ["Vink af op locatie", "en voeg foto's toe als bewijs."],
                    ["Keur goed of af.", "Goedkeuren kan als alle punten zijn afgevinkt."],
                  ].map(([kop, rest], i) => (
                    <li key={kop} className="flex gap-2.5">
                      <span
                        aria-hidden="true"
                        className="grid size-[22px] flex-none place-items-center rounded-full border text-[11px] font-semibold tabular-nums"
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 pt-px">
                        <span className="font-semibold">{kop}</span>{" "}
                        <span className="text-muted-foreground">{rest}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </SectiePaneel>
            </aside>
          </div>
        </div>
      </div>

      {approvalDialog.id && (
        <QCApprovalDialog
          open={approvalDialog.open}
          onOpenChange={(open) => setApprovalDialog((prev) => ({ ...prev, open }))}
          kwaliteitsControleId={approvalDialog.id}
          scope={approvalDialog.scope}
          type={approvalDialog.type}
        />
      )}
    </>
  );
}

/**
 * Een scope zonder controle: status "Nog niet gestart", de startknop en een
 * uitklapbare preview van de standaardpunten die de controle krijgt. De scope
 * met de gevulde startknop staat open, de rest is ingeklapt.
 */
function ScopeZonderControle({
  scope,
  punten,
  gevuld,
  bezig,
  uitgeschakeld,
  onStart,
}: {
  scope: string;
  /** undefined = standaardlijsten laden nog. */
  punten: string[] | undefined;
  gevuld: boolean;
  bezig: boolean;
  uitgeschakeld: boolean;
  onStart: () => void;
}) {
  const [open, setOpen] = useState(gevuld);
  const lijstId = useId();
  const label = scopeLabel(scope);
  const aantal = punten?.length ?? 0;

  return (
    <SectiePaneel
      id={`qc-${scope}`}
      titel={label}
      kopbalk
      icoon={<span aria-hidden="true" className={cn("block size-2.5 rounded-full", scopeStip(scope))} />}
      acties={
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {/* Geen QC-status (er is nog geen controle), dus een neutrale pil in
              dezelfde vorm als StatusBadge. */}
          <span className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Nog niet gestart
          </span>
          {aantal > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={lijstId}
              className="text-muted-foreground"
            >
              <span className="tabular-nums">{aantal} standaardpunten</span>
              <ChevronDown
                aria-hidden="true"
                className={cn("transition-transform", open && "rotate-180")}
              />
            </Button>
          )}
          <Button
            variant={gevuld ? "default" : "outline"}
            size="sm"
            onClick={onStart}
            disabled={uitgeschakeld}
            aria-label={`Controle starten voor ${label}`}
          >
            {bezig && <Loader2 aria-hidden="true" className="animate-spin" />}
            Controle starten
          </Button>
        </div>
      }
    >
      {open && aantal > 0 && (
        <div id={lijstId} className="px-4 pt-3 pb-3.5">
          <p className="pb-1 text-xs tabular-nums text-muted-foreground">
            {aantal} standaardpunten · na het starten kun je er punten aan toevoegen
          </p>
          <ul aria-label={`Standaardpunten ${label}`}>
            {punten?.map((punt, i) => (
              <li
                key={`${i}-${punt}`}
                className="flex items-start gap-2.5 py-1.5 text-[13px] text-muted-foreground"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 size-4 flex-none rounded-[4px] border-[1.5px] border-border"
                />
                {punt}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectiePaneel>
  );
}
