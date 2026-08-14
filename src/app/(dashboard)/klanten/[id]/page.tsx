"use client";

import { use, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";


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
  User,
  Loader2,
  ArrowLeft,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useKlantWithOffertes } from "@/hooks/use-klanten";
import { useIsAdmin } from "@/hooks/use-users";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { CopyButton } from "@/components/ui/copy-button";
import { Switch } from "@/components/ui/switch";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { useShortcuts } from "@/components/providers/shortcuts-provider";
import { Id } from "../../../../../convex/_generated/dataModel";
import { LeadHistorieCard } from "@/components/leads/lead-historie-card";
import { OnderhoudSectie } from "@/components/klanten/onderhoud-sectie";
import { KlantTakenCard } from "@/components/klanten/klant-taken-card";
import {
  KlantFacturenSectie,
  KlantOffertesSectie,
} from "@/components/klanten/klant-documenten";
import { KlantTijdlijn } from "@/components/tijdlijn/klant-tijdlijn";
import { KlantReminderBanner } from "@/components/klant-reminder-banner";
import { formatCurrency } from "@/lib/format/currency";
import { KLANT_PIPELINE_CONFIG, statusClasses } from "@/lib/constants/statuses";

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

// Statuskleuren uit de centrale bron (WS4): zelfde status = zelfde kleur.
const pipelineColors: Record<PipelineStatus, string> = Object.fromEntries(
  Object.entries(KLANT_PIPELINE_CONFIG).map(([key, config]) => [
    key,
    statusClasses(config),
  ])
) as Record<PipelineStatus, string>;

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

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
      <div className="px-3 py-2.5">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm">{children}</dd>
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
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
  const { setShowNewOfferteDialog } = useShortcuts();
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
  // Headerbadge-dedupe (WS6): zelfde regel als de lijst — tags die alleen het
  // klantType of de contract-status herhalen niet nogmaals als badge tonen.
  const tags = ((klant as { tags?: string[] }).tags ?? []).filter((tag) => {
    const t = tag.trim().toLowerCase();
    if (t === klantTypeLabels[klantType].toLowerCase()) return false;
    if (t === "contract" && pipelineStatus === "onderhoud") return false;
    return true;
  });

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
        {/* Identiteitskop: wie is dit, en hoe bereik ik hem. Kantoor opent dit
            dossier het vaakst om te bellen of te mailen — dus staan telefoon en
            e-mail hier, niet onderin een rail die onder 1280px helemaal
            wegzakt. */}
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="mt-1 h-8 w-8 shrink-0"
              asChild
              aria-label="Terug naar klanten"
            >
              <Link href="/klanten">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <h1 className="truncate font-display text-[30px] leading-tight font-semibold tracking-tight">
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

              {/* Contactregel: direct klikbaar, geen tussenscherm. Inkorten gaat
                  vóór uitwijken — elke waarde truncate't binnen zijn eigen
                  breedte en houdt de volle tekst in `title`. */}
              {(klant.telefoon || klant.email || adresregel) && (
                <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
                  {klant.telefoon && (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <Phone
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <a
                        href={`tel:${klant.telefoon}`}
                        className="truncate text-base font-medium tabular-nums hover:underline"
                      >
                        {klant.telefoon}
                      </a>
                      <CopyButton
                        value={klant.telefoon}
                        label="Kopieer telefoonnummer"
                      />
                    </span>
                  )}
                  {klant.email && (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <Mail
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <a
                        href={`mailto:${klant.email}`}
                        className="max-w-[28ch] truncate text-sm hover:underline"
                        title={klant.email}
                      >
                        {klant.email}
                      </a>
                      <CopyButton
                        value={klant.email}
                        label="Kopieer e-mailadres"
                      />
                    </span>
                  )}
                  {adresregel && (
                    <span
                      className="inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
                      title={adresregel}
                    >
                      <MapPin className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{adresregel}</span>
                    </span>
                  )}
                  {klant.contactpersoon && (
                    <span
                      className="inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
                      title={klant.contactpersoon}
                    >
                      <User className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{klant.contactpersoon}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {!isAnonymized && (
            <div className="flex shrink-0 flex-wrap gap-2">
              {/* Eén ingang voor een nieuwe offerte (WS6): dezelfde dialog als
                  ⌘N, het dashboard en de offertetoolbar. De twee losse
                  wizard-links die hier stonden omzeilden die ingang én raakten
                  de klant kwijt. TT-004 blijft ongemoeid: de dialog levert
                  alleen startpunten, geen nieuwe `offertes.type`-waarden. */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewOfferteDialog(true, { klantId: klant._id })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe offerte
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
            <KlantTijdlijn klantId={id as Id<"klanten">} toonPaneel />

            {/* Dossier: wat er vastligt. Eén paneel om alle drie heen in
                plaats van drie losse dozen — dat geeft de onderkant van de
                pagina een anker, ook als de secties leeg zijn. Een lege sectie
                is dan één nette rij binnen dit kader; een gevulde brengt zijn
                eigen kop met rijen mee. `rounded-none border-0` haalt het
                eigen frame van de secties weg: het kader is nu van de groep.
                Een losse zwevende scheidingslijn zou hier niets structureren. */}
            <section className="overflow-hidden rounded-lg border bg-card">
              <h2 className="border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide leading-4 text-muted-foreground">
                Dossier
              </h2>
              <div className="divide-y">
                {/* Onderhoud (PRD §2.1): contracten + losse beurten */}
                <OnderhoudSectie
                  klantId={id as Id<"klanten">}
                  className="rounded-none border-0 bg-transparent"
                />

                <KlantOffertesSectie
                  offertes={offertes}
                  className="rounded-none border-0 bg-transparent"
                />

                {/* Facturen: klanten hebben niet alleen offertes — het dossier
                    was pas compleet toen ook de geldkant erin stond. */}
                <KlantFacturenSectie
                  klantId={id as Id<"klanten">}
                  className="rounded-none border-0 bg-transparent"
                />
              </div>
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6">
            {/* Contactpersoon, telefoon, e-mail en adres staan nu in de
                identiteitskop: dáár zoekt kantoor ze, en dáár staan ze óók
                onder 1280px bovenaan in plaats van onder vijf secties. Wat
                hier overblijft is administratie. */}
            <SectiePaneel titel="Gegevens">
              <dl className="divide-y">
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
              {/* CIJFERS als één subregel (WS6): het aparte kaartblok herhaalde
                  de OFFERTES-sectie ernaast regel voor regel. */}
              <p className="border-t px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                {offertes.length} offerte{offertes.length === 1 ? "" : "s"}
                {" · "}
                {formatCurrency(totalValue)}
                {" · "}
                {geaccepteerdAantal} geaccepteerd
                {acceptedValue > 0 && ` (${formatCurrency(acceptedValue)})`}
              </p>

              {/* §2.7: opt-in inplanning-bevestigingsmail (default uit) — zet
                  bij inplannen een concept-mail klaar; kantoor keurt goed.
                  Staat bewust ín dit paneel: één instelling verdiende geen
                  tweede kaart in een rail die verder maar drie regels telt. */}
              <div className="flex items-start justify-between gap-3 border-t px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Bevestigingsmail bij inplannen
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
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
            </SectiePaneel>

            {/* Lead-historie (PRD §1.3): tweede blok in de rail: herkomst + activiteiten van de
                gepromoveerde lead blijven vanaf de klant bereikbaar.
                Rendert niets als deze klant geen lead-verleden heeft. */}
            <LeadHistorieCard klantId={id as Id<"klanten">} />

            {/* Onomkeerbaar én zeldzaam: bereikbaar, maar stil. Als rode knop
                over de volle railbreedte was dit het opvallendste element van
                de pagina — meer visueel oppervlak dan het telefoonnummer,
                terwijl kantoor hier hooguit een paar keer per jaar op klikt.
                Nu een gewone tekstregel die pas bij aanwijzen rood wordt. */}
            {isAdmin && !isAnonymized && (
              <button
                type="button"
                onClick={() => setShowGdprDialog(true)}
                className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <ShieldAlert className="size-3 shrink-0" aria-hidden />
                GDPR-verwijderverzoek
              </button>
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
