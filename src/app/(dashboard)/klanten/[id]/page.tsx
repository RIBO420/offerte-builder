"use client";

import { use, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  FileText,
  Loader2,
  ArrowLeft,
  Shovel,
  Trees,
  History,
  ShieldAlert,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useKlantWithOffertes } from "@/hooks/use-klanten";
import { useIsAdmin } from "@/hooks/use-users";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { CopyButton } from "@/components/ui/copy-button";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Id } from "../../../../../convex/_generated/dataModel";
import { LeadHistorieCard } from "@/components/leads/lead-historie-card";
import { OnderhoudSectie } from "@/components/klanten/onderhoud-sectie";
import { KlantTakenCard } from "@/components/klanten/klant-taken-card";
import { KlantTijdlijn } from "@/components/tijdlijn/klant-tijdlijn";
import { KlantReminderBanner } from "@/components/klant-reminder-banner";
import { formatCurrency } from "@/lib/format/currency";

const statusColors: Record<string, string> = {
  concept: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  voorcalculatie: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  verzonden: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  geaccepteerd: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  afgewezen: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

// CRM-002: Pipeline status labels and colors
type PipelineStatus = "lead" | "offerte_verzonden" | "getekend" | "in_uitvoering" | "opgeleverd" | "onderhoud";

const pipelineLabels: Record<PipelineStatus, string> = {
  lead: "Lead",
  offerte_verzonden: "Offerte verzonden",
  getekend: "Getekend",
  in_uitvoering: "In uitvoering",
  opgeleverd: "Opgeleverd",
  onderhoud: "Onderhoud",
};

const pipelineColors: Record<PipelineStatus, string> = {
  lead: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  offerte_verzonden: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  getekend: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  in_uitvoering: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  opgeleverd: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  onderhoud: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

// CRM-003: Klant type labels and colors
type KlantType = "particulier" | "zakelijk" | "vve" | "gemeente" | "overig";

const klantTypeLabels: Record<KlantType, string> = {
  particulier: "Particulier",
  zakelijk: "Zakelijk",
  vve: "VvE",
  gemeente: "Gemeente",
  overig: "Overig",
};

const klantTypeColors: Record<KlantType, string> = {
  particulier: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  zakelijk: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  vve: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  gemeente: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  overig: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const statusLabels: Record<string, string> = {
  concept: "Concept",
  voorcalculatie: "Voorcalculatie",
  verzonden: "Verzonden",
  geaccepteerd: "Geaccepteerd",
  afgewezen: "Afgewezen",
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Paneel in de rechterkolom. Bewust géén <Card>: die brengt een eigen
 * kop-, padding- en schaduwlaag mee, en drie Cards onder elkaar in een smalle
 * kolom leest als drie losse eilanden. Eén rand met een klein kopje houdt het
 * dossier rustig.
 */
function Paneel({
  titel,
  children,
}: {
  titel: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <h2 className="border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titel}
      </h2>
      {children}
    </section>
  );
}

/** Label links, waarde rechts — leest als een dossierregel, niet als een kaart. */
function Feit({
  label,
  children,
  uitlijnen = "rechts",
}: {
  label: string;
  children: ReactNode;
  /** Adressen lopen over meerdere regels en staan beter onder het label. */
  uitlijnen?: "rechts" | "onder";
}) {
  if (uitlijnen === "onder") {
    return (
      <div className="px-4 py-2.5">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm">{children}</dd>
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm">{children}</dd>
    </div>
  );
}

export default function KlantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const { klant, isLoading } = useKlantWithOffertes(id as Id<"klanten">);
  const gdprAnonymize = useMutation(api.klanten.gdprAnonymize);
  const setInplanMail = useMutation(api.klanten.setInplanBevestigingsMail);
  const gdprBlockers = useQuery(
    api.klanten.checkGdprBlockers,
    id ? { id: id as Id<"klanten"> } : "skip"
  );
  const [showGdprDialog, setShowGdprDialog] = useState(false);
  const [isAnonymizing, setIsAnonymizing] = useState(false);

  const isAnonymized = gdprBlockers?.isAnonymized === true;
  const hasBlockers = gdprBlockers?.hasBlockers === true;

  const handleGdprAnonymize = async () => {
    setIsAnonymizing(true);
    try {
      await gdprAnonymize({ id: id as Id<"klanten"> });
      showSuccessToast("Klantgegevens zijn geanonimiseerd", {
        description: "Alle persoonsgegevens zijn definitief verwijderd conform GDPR.",
      });
      setShowGdprDialog(false);
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij anonimiseren"
      );
    } finally {
      setIsAnonymizing(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!klant) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <User className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">Klant niet gevonden</h2>
          <Button variant="outline" onClick={() => router.push("/klanten")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar klanten
          </Button>
        </div>
      </>
    );
  }

  type OfferteWithTotals = {
    _id: Id<"offertes">;
    status: string;
    offerteNummer: string;
    type: string;
    createdAt: number;
    totalen?: {
      totaalInclBtw?: number;
    };
  };

  const offertes: OfferteWithTotals[] = klant.offertes || [];
  const totalValue = offertes.reduce(
    (sum, o) => sum + (o.totalen?.totaalInclBtw || 0),
    0
  );
  const geaccepteerdAantal = offertes.filter(
    (o) => o.status === "geaccepteerd"
  ).length;
  const acceptedValue = offertes
    .filter((o) => o.status === "geaccepteerd")
    .reduce((sum, o) => sum + (o.totalen?.totaalInclBtw || 0), 0);

  const pipelineStatus = (klant as { pipelineStatus?: PipelineStatus })
    .pipelineStatus;
  const klantType =
    (klant as { klantType?: KlantType }).klantType ?? "particulier";
  const tags = (klant as { tags?: string[] }).tags ?? [];

  const adresregel = [
    klant.adres,
    [klant.postcode, klant.plaats].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <PageHeader customLabels={{ [`/klanten/${id}`]: klant.naam }} />

      <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
        {/* Kop: identiteit links, acties rechts. Compact gehouden — de details
            staan in de rechterkolom, niet in de titel. */}
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              asChild
              aria-label="Terug naar klanten"
            >
              <Link href="/klanten">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <h1 className="truncate text-2xl font-semibold tracking-tight">
                  {klant.naam}
                </h1>
                {/* Geen status = nog geen stadium, géén "Lead" verzinnen */}
                {pipelineStatus && (
                  <Badge className={pipelineColors[pipelineStatus]}>
                    {pipelineLabels[pipelineStatus]}
                  </Badge>
                )}
                <Badge className={klantTypeColors[klantType]}>
                  {klantTypeLabels[klantType]}
                </Badge>
                {tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {!isAnonymized && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/offertes/nieuw/aanleg">
                  <Shovel className="mr-2 h-4 w-4" />
                  Aanleg
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/offertes/nieuw/onderhoud">
                  <Trees className="mr-2 h-4 w-4" />
                  Onderhoud
                </Link>
              </Button>
            </div>
          )}
        </header>

        {/* CRM-008: GDPR Anonymized Banner */}
        {isAnonymized && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Deze klant is geanonimiseerd conform GDPR
              </p>
              <p className="text-amber-600 dark:text-amber-400">
                Persoonsgegevens verwijderd op{" "}
                {gdprBlockers?.anonymizedAt
                  ? formatDate(gdprBlockers.anonymizedAt)
                  : "onbekend"}
                . Financiële gegevens zijn bewaard voor de boekhouding.
              </p>
            </div>
          </div>
        )}

        {/* CRM-005: Opvolgherinnering banner */}
        {!isAnonymized && (
          <KlantReminderBanner
            klantId={id as Id<"klanten">}
            telefoon={klant.telefoon}
            email={klant.email}
          />
        )}

        {/* Werkvlak links, feiten rechts. De rechterkolom blijft staan bij het
            scrollen: bij het lezen van de tijdlijn wil je het telefoonnummer
            binnen bereik houden. */}
        <div className="grid items-start gap-5 xl:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-5">
            {/* Taken vóór de tijdlijn: vooruitkijken vóór terugkijken. */}
            <KlantTakenCard klantId={id as Id<"klanten">} />

            {/* Klanttijdlijn (PRD §2.3) — vervangt het vrije Notities-veld
                ("één waarheid"): filters op kanaal/klus, vrij zoeken en
                entry-compositie voor kantoor. */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" />
                  Tijdlijn
                </CardTitle>
                <CardDescription>
                  Wie heeft wat besproken, wanneer, via welk kanaal, over welke
                  klus?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <KlantTijdlijn klantId={id as Id<"klanten">} />
              </CardContent>
            </Card>

            {/* Onderhoud (PRD §2.1): contracten + losse beurten */}
            <OnderhoudSectie klantId={id as Id<"klanten">} />

            {/* Offertes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Offertes
                  {offertes.length > 0 && (
                    <Badge variant="secondary">{offertes.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {offertes.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<FileText aria-hidden />}
                    title="Nog geen offertes."
                    description="Maak de eerste offerte voor deze klant."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nummer</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Bedrag</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offertes.map((offerte) => (
                        <TableRow key={offerte._id}>
                          <TableCell>
                            <Link
                              href={`/offertes/${offerte._id}`}
                              className="font-medium hover:underline"
                            >
                              {offerte.offerteNummer}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {offerte.type === "aanleg" ? (
                                <Shovel className="h-4 w-4 shrink-0 text-muted-foreground" />
                              ) : (
                                <Trees className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                              <span className="capitalize">{offerte.type}</span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(offerte.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[offerte.status]}>
                              {statusLabels[offerte.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(offerte.totalen?.totaalInclBtw || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6">
            <Paneel titel="Gegevens">
              <dl className="divide-y">
                {klant.contactpersoon && (
                  <Feit label="Contactpersoon">{klant.contactpersoon}</Feit>
                )}
                {klant.telefoon && (
                  <Feit label="Telefoon">
                    <span className="inline-flex items-center gap-1">
                      <a
                        href={`tel:${klant.telefoon}`}
                        className="hover:underline"
                      >
                        {klant.telefoon}
                      </a>
                      <CopyButton
                        value={klant.telefoon}
                        label="Kopieer telefoonnummer"
                      />
                    </span>
                  </Feit>
                )}
                {klant.email && (
                  <Feit label="E-mail" uitlijnen="onder">
                    <span className="flex items-center gap-1">
                      <a
                        href={`mailto:${klant.email}`}
                        className="truncate hover:underline"
                        title={klant.email}
                      >
                        {klant.email}
                      </a>
                      <CopyButton
                        value={klant.email}
                        label="Kopieer e-mailadres"
                      />
                    </span>
                  </Feit>
                )}
                <Feit label="Adres" uitlijnen="onder">
                  {adresregel || (
                    <span className="text-muted-foreground">
                      Geen adres bekend
                    </span>
                  )}
                </Feit>
                {klant.kvkNummer && (
                  <Feit label="KvK">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      {klant.kvkNummer}
                      <CopyButton
                        value={klant.kvkNummer}
                        label="Kopieer KvK-nummer"
                      />
                    </span>
                  </Feit>
                )}
                {klant.btwNummer && (
                  <Feit label="BTW">
                    <span className="inline-flex items-center gap-1">
                      {klant.btwNummer}
                      <CopyButton
                        value={klant.btwNummer}
                        label="Kopieer BTW-nummer"
                      />
                    </span>
                  </Feit>
                )}
                <Feit label="Klant sinds">{formatDate(klant.createdAt)}</Feit>
              </dl>
            </Paneel>

            <Paneel titel="Cijfers">
              <dl className="divide-y">
                <Feit label="Offertes">
                  <span className="tabular-nums">{offertes.length}</span>
                </Feit>
                <Feit label="Geaccepteerd">
                  <span className="tabular-nums">{geaccepteerdAantal}</span>
                </Feit>
                <Feit label="Totale waarde">
                  <span className="tabular-nums">
                    {formatCurrency(totalValue)}
                  </span>
                </Feit>
                <Feit label="Waarvan geaccepteerd">
                  <span className="tabular-nums font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(acceptedValue)}
                  </span>
                </Feit>
              </dl>
            </Paneel>

            {/* §2.7: opt-in inplanning-bevestigingsmail (default uit) — zet bij
                inplannen een concept-mail klaar; kantoor keurt goed */}
            <Paneel titel="Instellingen">
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Bevestigingsmail bij inplannen
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Zet een concept-mail klaar in Concept-mails
                  </p>
                </div>
                <Switch
                  className="mt-0.5 shrink-0"
                  checked={klant.inplanBevestigingsMail === true}
                  onCheckedChange={async (checked) => {
                    try {
                      await setInplanMail({
                        id: id as Id<"klanten">,
                        inplanBevestigingsMail: checked,
                      });
                      showSuccessToast(
                        checked
                          ? "Bevestigingsmail bij inplannen aangezet"
                          : "Bevestigingsmail bij inplannen uitgezet"
                      );
                    } catch {
                      showErrorToast("Bijwerken mislukt");
                    }
                  }}
                  aria-label="Bevestigingsmail bij inplannen"
                />
              </div>
            </Paneel>

            {/* Lead-historie (PRD §1.3): herkomst + activiteiten van de
                gepromoveerde lead blijven vanaf de klant bereikbaar.
                Rendert niets als deze klant geen lead-verleden heeft. */}
            <LeadHistorieCard klantId={id as Id<"klanten">} />

            {/* Onomkeerbaar, dus onderaan en visueel apart van de dagelijkse acties. */}
            {isAdmin && !isAnonymized && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setShowGdprDialog(true)}
              >
                <ShieldAlert className="mr-2 h-4 w-4" />
                GDPR-verwijderverzoek
              </Button>
            )}
          </aside>
        </div>
      </div>

      {/* CRM-008: GDPR Anonymization Confirmation Dialog */}
      <AlertDialog open={showGdprDialog} onOpenChange={setShowGdprDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>GDPR Verwijderverzoek</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Alle persoonsgegevens van deze klant worden definitief
                  geanonimiseerd. Dit kan niet ongedaan gemaakt worden.
                </p>
                <p>
                  Financiele gegevens blijven bewaard voor de boekhouding.
                </p>

                {hasBlockers && gdprBlockers?.blockers && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 mt-2">
                    <p className="text-sm font-medium text-destructive mb-2">
                      Anonimisering is niet mogelijk vanwege:
                    </p>
                    <ul className="text-sm text-destructive space-y-1 list-disc list-inside">
                      {gdprBlockers.blockers.map((blocker, i) => (
                        <li key={i}>{blocker.label}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isAnonymizing}>
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGdprAnonymize}
              disabled={isAnonymizing || hasBlockers}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isAnonymizing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bezig met anonimiseren...
                </>
              ) : (
                "Definitief anonimiseren"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
