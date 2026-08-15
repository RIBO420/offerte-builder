"use client";

/**
 * De voorcalculatie — de stap tussen het werkblad en het versturen.
 *
 * Deze pagina zat midden in de nieuwe flow nog in het oude ontwerp: een
 * SaaS-stepper met een "Voortgang 80%"-balk, gekleurde kaarten en een
 * genummerd "wat gebeurt er hierna". Dat schuurde direct ná de werkbank.
 *
 * De stepper is weg. Voortgang van 40 + 20 + 20 + 20 procent was ook geen
 * voortgang: teamgrootte en uren-per-dag hebben altijd een waarde, dus de
 * balk stond bij binnenkomst al op 80 zonder dat er iets gedaan was. Wat
 * ervoor in de plaats komt is de vorm van het werkblad: links het document
 * (de uren), rechts de rail met de keuzes en het heldcijfer, en één knop die
 * de fase afsluit.
 *
 * Het gedrag is ongemoeid: autosave na 2 seconden, afronden zet de status op
 * voorcalculatie (fix 0ce9c9b — een gelijke-statusovergang wordt overgeslagen)
 * en stuurt door naar de offerte.
 */

import { klantNaam } from "@convex/lib/offerteKlant";

import { use, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Eye,
  FileText,
  Loader2,
  PenLine,
  ShieldCheck,
} from "lucide-react";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useOfferteVoorcalculatie } from "@/hooks/use-voorcalculatie";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
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
import { VoorcalculatiePlanning } from "@/components/offerte/voorcalculatie/voorcalculatie-planning";
import { VoorcalculatieUrenblad } from "@/components/offerte/voorcalculatie/voorcalculatie-urenblad";
import { formatDagen, formatUren } from "@/lib/voorcalculatie-calculator";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { Id } from "@convex/_generated/dataModel";

const STATUS_LABEL: Record<string, string> = {
  concept: "Concept",
  voorcalculatie: "Voorcalculatie",
  verzonden: "Verzonden",
  geaccepteerd: "Geaccepteerd",
  afgewezen: "Afgewezen",
};

export default function OfferteVoorcalculatiePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const {
    offerte,
    voorcalculatie,
    calculation,
    isLoading,
    hasVoorcalculatie,
    saveVoorcalculatie,
    moveToVoorcalculatie,
    calculateDays,
  } = useOfferteVoorcalculatie(id as Id<"offertes">);

  const [teamGrootte, setTeamGrootte] = useState<2 | 3 | 4>(
    voorcalculatie?.teamGrootte ?? 2
  );
  const [teamleden, setTeamleden] = useState<string[]>(
    voorcalculatie?.teamleden ?? []
  );
  const [effectieveUrenPerDag, setEffectieveUrenPerDag] = useState(
    voorcalculatie?.effectieveUrenPerDag ?? 7
  );
  const [bevestigOpen, setBevestigOpen] = useState(false);
  const [afronden, setAfronden] = useState(false);

  // Alleen lezen zodra de offerte de voorcalculatiefase voorbij is.
  const leesAlleen = Boolean(
    offerte?.status && !["concept", "voorcalculatie"].includes(offerte.status)
  );

  useMemo(() => {
    if (voorcalculatie) {
      setTeamGrootte(voorcalculatie.teamGrootte);
      setTeamleden(voorcalculatie.teamleden ?? []);
      setEffectieveUrenPerDag(voorcalculatie.effectieveUrenPerDag);
    }
  }, [voorcalculatie]);

  const geschatteDagen = useMemo(() => {
    if (!calculation) return 0;
    return calculateDays(
      calculation.normUrenTotaal,
      teamGrootte,
      effectieveUrenPerDag
    );
  }, [calculation, teamGrootte, effectieveUrenPerDag, calculateDays]);

  const autoSaveData = useMemo(
    () => ({
      teamGrootte,
      teamleden: teamleden.length > 0 ? teamleden : undefined,
      effectieveUrenPerDag,
    }),
    [teamGrootte, teamleden, effectieveUrenPerDag]
  );

  const handleAutoSave = useCallback(
    async (data: typeof autoSaveData) => {
      await saveVoorcalculatie(data);
    },
    [saveVoorcalculatie]
  );

  const {
    isSaving,
    isDirty,
    lastSaved,
    saveNow,
    error: saveError,
  } = useAutoSave({
    data: autoSaveData,
    onSave: handleAutoSave,
    debounceMs: 2000,
    enabled: !!calculation && !leesAlleen,
  });

  useMemo(() => {
    if (saveError) {
      toast.error("Fout bij auto-opslaan voorcalculatie");
    }
  }, [saveError]);

  const handleAfronden = useCallback(async () => {
    setAfronden(true);
    try {
      if (isDirty || isSaving || !hasVoorcalculatie) {
        await saveNow();
      }
      await moveToVoorcalculatie();
      toast.success("Voorcalculatie afgerond — offerte klaar om te verzenden");
      router.push(`/offertes/${id}`);
    } catch (error) {
      toast.error("Fout bij afronden voorcalculatie");
      logger.error("Afronden voorcalculatie mislukt", error, {
        module: "offertes/voorcalculatie",
        offerteId: id,
      });
    } finally {
      setAfronden(false);
      setBevestigOpen(false);
    }
  }, [
    hasVoorcalculatie,
    isDirty,
    isSaving,
    saveNow,
    moveToVoorcalculatie,
    router,
    id,
  ]);

  if (isLoading) {
    return (
      <>
        <PageHeader customLabels={{ [`/offertes/${id}`]: "Laden…" }} />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <div className="h-16 animate-pulse rounded-lg border bg-card" />
          <div className="flex flex-col gap-5 @min-[68rem]/voorcalc:grid @min-[68rem]/voorcalc:grid-cols-[minmax(0,1fr)_20.5rem]">
            <div className="h-64 animate-pulse rounded-lg border bg-card" />
            <div className="h-48 animate-pulse rounded-lg border bg-card" />
          </div>
        </div>
      </>
    );
  }

  if (!offerte) {
    return (
      <>
        <PageHeader customLabels={{ [`/offertes/${id}`]: "Niet gevonden" }} />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <section className="rounded-lg border border-dashed px-4 py-6">
            <p className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
              <FileText aria-hidden className="size-4 text-muted-foreground" />
              Deze offerte bestaat niet
            </p>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              De offerte is verwijderd, of je hebt er geen toegang toe.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/offertes">Terug naar offertes</Link>
            </Button>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader customLabels={{ [`/offertes/${id}`]: offerte.offerteNummer }} />

      <div className="@container/voorcalc flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Masthead
          offerteNummer={offerte.offerteNummer}
          status={offerte.status}
          klant={klantNaam(offerte.klant)}
          offerteId={id}
          isSaving={isSaving}
          isDirty={isDirty}
          lastSaved={lastSaved}
          leesAlleen={leesAlleen}
        />

        {leesAlleen && (
          <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs leading-4 text-muted-foreground">
            <Eye aria-hidden className="mt-px size-3.5 shrink-0" />
            <span>
              Deze offerte is{" "}
              {STATUS_LABEL[offerte.status]?.toLowerCase() ?? offerte.status}.
              Je kijkt mee ter referentie; de planning ligt vast.
            </span>
          </p>
        )}

        <div className="flex flex-col gap-5 @min-[68rem]/voorcalc:grid @min-[68rem]/voorcalc:grid-cols-[minmax(0,1fr)_20.5rem] @min-[68rem]/voorcalc:items-start @min-[68rem]/voorcalc:gap-6">
          {/* Rail: op smalle schermen bóven het urenblad, nooit weggelaten. */}
          <aside className="order-1 @min-[68rem]/voorcalc:order-2 @min-[68rem]/voorcalc:sticky @min-[68rem]/voorcalc:top-4">
            {calculation ? (
              <VoorcalculatiePlanning
                teamGrootte={teamGrootte}
                teamleden={teamleden}
                effectieveUrenPerDag={effectieveUrenPerDag}
                normUrenTotaal={calculation.normUrenTotaal}
                geschatteDagen={geschatteDagen}
                leesAlleen={leesAlleen}
                afronden={afronden}
                kanAfronden={!isSaving}
                onTeamGrootte={setTeamGrootte}
                onTeamleden={setTeamleden}
                onEffectieveUren={setEffectieveUrenPerDag}
                onAfronden={() => setBevestigOpen(true)}
                onBekijk={() => router.push(`/offertes/${id}`)}
              />
            ) : (
              <div className="h-64 animate-pulse rounded-lg border bg-card" />
            )}
          </aside>

          <div className="order-2 min-w-0 space-y-3 @min-[68rem]/voorcalc:order-1">
            {calculation ? (
              <VoorcalculatieUrenblad
                normUrenPerScope={calculation.normUrenPerScope}
                normUrenTotaal={calculation.normUrenTotaal}
                bereikbaarheidFactor={calculation.bereikbaarheidFactor}
                achterstallijkheidFactor={calculation.achterstallijkheidFactor}
              />
            ) : (
              <div className="h-48 animate-pulse rounded-lg border bg-card" />
            )}

            {!leesAlleen && (
              <p className="flex items-start gap-2 px-1 text-xs leading-4 text-muted-foreground">
                <PenLine aria-hidden className="mt-px size-3.5 shrink-0" />
                <span>
                  Kloppen de uren niet? Ze komen uit het werkblad — pas daar de
                  maatvoering aan en dit blad rekent mee.{" "}
                  <Link
                    href={`/offertes/${id}/bewerken`}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    Werkblad openen
                  </Link>
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={bevestigOpen} onOpenChange={setBevestigOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display tracking-tight">
              Voorcalculatie afronden?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  De planning wordt vastgelegd en de offerte gaat naar &ldquo;klaar
                  om te verzenden&rdquo;. Aanpassen kan daarna nog.
                </p>
                <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2 text-xs leading-5">
                  <dt className="text-muted-foreground">Ploeg</dt>
                  <dd className="text-right font-medium tabular-nums text-foreground">
                    {teamGrootte} personen
                  </dd>
                  <dt className="text-muted-foreground">Uren per dag</dt>
                  <dd className="text-right font-medium tabular-nums text-foreground">
                    {formatUren(effectieveUrenPerDag)}
                  </dd>
                  <dt className="text-muted-foreground">Normuren</dt>
                  <dd className="text-right font-medium tabular-nums text-foreground">
                    {formatUren(calculation?.normUrenTotaal ?? 0)}
                  </dd>
                  <dt className="text-muted-foreground">Geschatte duur</dt>
                  <dd className="text-right font-medium tabular-nums text-foreground">
                    {formatDagen(geschatteDagen)}
                  </dd>
                </dl>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={afronden}>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleAfronden} disabled={afronden}>
              {afronden ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 size-4" />
              )}
              {afronden ? "Bezig met afronden…" : "Afronden en doorgaan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Dezelfde kop als het werkblad: kruimel, offertenummer in Fraunces met de
 * statuschip ernaast, klant eronder, opslagstaat rechts. Wie van het werkblad
 * doorklikt moet hetzelfde document herkennen, één fase verder.
 */
function Masthead({
  offerteNummer,
  status,
  klant,
  offerteId,
  isSaving,
  isDirty,
  lastSaved,
  leesAlleen,
}: {
  offerteNummer: string;
  status: string;
  klant: string;
  offerteId: string;
  isSaving: boolean;
  isDirty: boolean;
  lastSaved: Date | null;
  leesAlleen: boolean;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b pb-4">
      <div className="flex min-w-0 items-start gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 mt-1 size-8 shrink-0"
          asChild
          aria-label="Terug naar de offerte"
        >
          <Link href={`/offertes/${offerteId}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <p className="text-xs leading-4 font-medium tracking-wide text-muted-foreground uppercase">
            Voorcalculatie
          </p>
          <h1 className="mt-1 flex min-w-0 items-baseline gap-2.5 font-display text-[30px] leading-tight font-semibold tracking-tight">
            {offerteNummer}
            <StatusChip status={status} />
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {klant || "Nog geen klant gekoppeld"}
          </p>
        </div>
      </div>

      {!leesAlleen && (
        <p className="text-right text-xs text-muted-foreground">
          <OpslagChip
            isSaving={isSaving}
            isDirty={isDirty}
            lastSaved={lastSaved}
          />
        </p>
      )}
    </header>
  );
}

function StatusChip({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[11px] leading-4 font-medium",
        status === "voorcalculatie"
          ? "bg-status-voorcalculatie text-status-voorcalculatie-text"
          : status === "verzonden"
            ? "bg-status-verzonden text-status-verzonden-text"
            : status === "geaccepteerd"
              ? "bg-status-geaccepteerd text-status-geaccepteerd-text"
              : status === "afgewezen"
                ? "bg-status-afgewezen text-status-afgewezen-text"
                : "bg-status-concept text-status-concept-text"
      )}
    >
      {label}
    </span>
  );
}

function OpslagChip({
  isSaving,
  isDirty,
  lastSaved,
}: {
  isSaving: boolean;
  isDirty: boolean;
  lastSaved: Date | null;
}) {
  if (isSaving) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="size-3 animate-spin" />
        Opslaan…
      </span>
    );
  }
  if (isDirty) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <AlertTriangle className="size-3" />
        Niet-opgeslagen wijziging
      </span>
    );
  }
  if (lastSaved) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Check className="size-3 text-primary" />
        Opgeslagen om{" "}
        {lastSaved.toLocaleTimeString("nl-NL", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <PenLine className="size-3" />
      Alles wordt automatisch bewaard
    </span>
  );
}
