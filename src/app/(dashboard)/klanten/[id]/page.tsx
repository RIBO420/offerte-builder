"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

import { User, ArrowLeft, Mail, MapPin, Phone, ShieldAlert } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useKlantWithOffertes } from "@/hooks/use-klanten";
import { useTabState } from "@/hooks/use-tab-state";
import { NieuweOfferteSplitButton } from "@/components/offerte/nieuwe-offerte-split-button";
import { Id } from "../../../../../convex/_generated/dataModel";
import { ContactChip } from "@/components/klanten/klant-detail-primitieven";
import {
  DossierNav,
  isDossierTab,
  type DossierTab,
  type DossierTellingen,
} from "@/components/klanten/dossier/dossier-nav";
import { KlantCijferstrip } from "@/components/klanten/dossier/klant-cijferstrip";
import { TabActueel } from "@/components/klanten/dossier/tab-actueel";
import { TabTijdlijn } from "@/components/klanten/dossier/tab-tijdlijn";
import { TabTaken } from "@/components/klanten/dossier/tab-taken";
import { TabProjecten } from "@/components/klanten/dossier/tab-projecten";
import { TabOnderhoud } from "@/components/klanten/dossier/tab-onderhoud";
import { TabOffertes } from "@/components/klanten/dossier/tab-offertes";
import { TabFacturen } from "@/components/klanten/dossier/tab-facturen";
import { TabInstellingen } from "@/components/klanten/dossier/tab-instellingen";
import { KlantReminderBanner } from "@/components/klant-reminder-banner";
import { KLANT_PIPELINE_CONFIG, statusClasses } from "@/lib/constants/statuses";
import { LaadIndicator } from "@/components/ui/laad-indicator";

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

/** Twee letters volstaan als monogram; de volle naam staat er direct naast. */
function initialen(naam: string): string {
  const delen = naam.trim().split(/\s+/).filter(Boolean);
  if (delen.length === 0) return "?";
  if (delen.length === 1) return delen[0].slice(0, 2).toUpperCase();
  return (delen[0][0] + delen[delen.length - 1][0]).toUpperCase();
}

/**
 * Het klantdossier (herindeling v7).
 *
 * Deze pagina is het frame en niet meer de inhoud: identiteitskop,
 * cijferstrip, submenu en het actieve paneel. Elke tab woont in een eigen
 * bestand onder `src/components/klanten/dossier/`, zodat WS2/WS3/WS4 er naast
 * elkaar aan kunnen werken zonder elkaars regels te raken.
 *
 * Tabs en géén routes: `?tab=` via `useTabState` houdt de pagina deeplinkbaar
 * (de Meldingen-module linkt hierheen) zonder dat de layout per tab opnieuw
 * opgebouwd wordt.
 */
export default function KlantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { klant, isLoading } = useKlantWithOffertes(id as Id<"klanten">);
  const gdprBlockers = useQuery(
    api.klanten.checkGdprBlockers,
    id ? { id: id as Id<"klanten"> } : "skip"
  );
  // Eén verzamelquery voor alle acht tellers — zie convex/klanten.ts.
  const tellingen = useQuery(api.klanten.dossierTellingen, {
    klantId: id as Id<"klanten">,
  }) as DossierTellingen | null | undefined;

  const [tabWaarde, setTab] = useTabState("actueel");
  const actieveTab: DossierTab = isDossierTab(tabWaarde) ? tabWaarde : "actueel";

  const isAnonymized = gdprBlockers?.isAnonymized === true;

  if (isLoading) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 items-center justify-center">
          <LaadIndicator formaat="pagina" />
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
        {/* Identiteitskop: wie is dit, en hoe bereik ik hem. Kantoor opent dit
            dossier het vaakst om te bellen of te mailen — dus staan telefoon en
            e-mail hier, niet onderin een rail die onder 1280px helemaal
            wegzakt. De hairline eronder maakt van de kop een podium: één
            verankerd blok (monogram + naam + contact) waar de rest van het
            dossier onder hangt. */}
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b pb-5">
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

            {/* Monogram op een zachte primary-tint: geeft naam, badges en
                contact één ankerpunt links — dezelfde initialen-regel als de
                avatar in de sidebar. Puur decoratief; de naam staat ernaast. */}
            <span
              aria-hidden
              className="mt-1 flex size-12 shrink-0 select-none items-center justify-center rounded-full border border-primary/15 bg-primary/10 font-display text-lg font-semibold tracking-wide text-primary"
            >
              {initialen(klant.naam)}
            </span>

            <div className="min-w-0 space-y-1.5 pl-1">
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

              {/* Contactregel: stille chips, direct klikbaar (bellen, mailen,
                  route in Maps), kopieerknop pas bij aanwijzen. Inkorten gaat
                  vóór uitwijken — elke waarde truncate't binnen zijn eigen
                  breedte en houdt de volle tekst in `title`. Ontbreekt een
                  gegeven, dan staat er een gedempte toevoegen-affordance in
                  plaats van niets. -ml-1.5 zet de chip-tekst op dezelfde x
                  als de naam erboven. De kerncijfers die hier eerst als
                  metaregel stonden, staan nu in de cijferstrip eronder. */}
              <div className="-ml-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                {klant.telefoon ? (
                  <ContactChip
                    icoon={<Phone />}
                    href={`tel:${klant.telefoon}`}
                    kopieer={klant.telefoon}
                    kopieerLabel="Kopieer telefoonnummer"
                  >
                    <span className="truncate text-base font-medium tabular-nums">
                      {klant.telefoon}
                    </span>
                  </ContactChip>
                ) : (
                  !isAnonymized && (
                    <button
                      type="button"
                      onClick={() => setTab("instellingen")}
                      title="Telefoonnummer toevoegen — dat doe je bij Instellingen"
                      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Phone className="size-4 shrink-0" aria-hidden />
                      Telefoon toevoegen
                    </button>
                  )
                )}
                {klant.email ? (
                  <ContactChip
                    icoon={<Mail />}
                    href={`mailto:${klant.email}`}
                    kopieer={klant.email}
                    kopieerLabel="Kopieer e-mailadres"
                    titel={klant.email}
                  >
                    <span className="max-w-[28ch] truncate text-sm">
                      {klant.email}
                    </span>
                  </ContactChip>
                ) : (
                  !isAnonymized && (
                    <button
                      type="button"
                      onClick={() => setTab("instellingen")}
                      title="E-mailadres toevoegen — dat doe je bij Instellingen"
                      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Mail className="size-4 shrink-0" aria-hidden />
                      E-mail toevoegen
                    </button>
                  )
                )}
                {adresregel && (
                  <ContactChip
                    icoon={<MapPin />}
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresregel)}`}
                    extern
                    kopieer={adresregel}
                    kopieerLabel="Kopieer adres"
                    titel={`${adresregel} — route in Google Maps`}
                    className="text-muted-foreground"
                  >
                    <span className="truncate text-sm">{adresregel}</span>
                  </ContactChip>
                )}
                {klant.contactpersoon && (
                  <ContactChip
                    icoon={<User />}
                    titel={klant.contactpersoon}
                    className="text-muted-foreground"
                  >
                    <span className="truncate text-sm">
                      {klant.contactpersoon}
                    </span>
                  </ContactChip>
                )}
              </div>
            </div>
          </div>

          {!isAnonymized && (
            <div className="flex shrink-0 flex-wrap gap-2">
              {/* Eén ingang voor een nieuwe offerte (WS6): dezelfde knop als op
                  het dashboard en in de offertetoolbar. TT-004 blijft ongemoeid:
                  de tegels zijn startpunten, geen `offertes.type`-waarden. */}
              <NieuweOfferteSplitButton size="sm" klantId={klant._id} />
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

        {/* Vier tegels die het dossier samenvatten én bedienen: elke tegel
            opent de tab die het cijfer bewijst. */}
        <KlantCijferstrip
          tellingen={tellingen}
          klantSinds={klant.createdAt}
          actief={actieveTab}
          onKies={setTab}
        />

        {/* Submenu links, actieve tab rechts. De kolom is 196px breed (zoals
            het prototype) en blijft staan bij het scrollen; onder lg vouwt hij
            tot chips boven de inhoud. */}
        <div className="grid items-start gap-5 lg:grid-cols-[12.25rem_minmax(0,1fr)]">
          <DossierNav
            actief={actieveTab}
            onKies={setTab}
            tellingen={tellingen}
          />

          <div className="min-w-0">
            {actieveTab === "actueel" && (
              <TabActueel
                klantId={id as Id<"klanten">}
                onNaarTijdlijn={() => setTab("tijdlijn")}
              />
            )}
            {actieveTab === "tijdlijn" && (
              <TabTijdlijn klantId={id as Id<"klanten">} />
            )}
            {actieveTab === "taken" && (
              <TabTaken klantId={id as Id<"klanten">} />
            )}
            {actieveTab === "projecten" && <TabProjecten />}
            {actieveTab === "onderhoud" && (
              <TabOnderhoud klantId={id as Id<"klanten">} />
            )}
            {actieveTab === "offertes" && (
              <TabOffertes offertes={offertes} />
            )}
            {actieveTab === "facturen" && (
              <TabFacturen klantId={id as Id<"klanten">} />
            )}
            {actieveTab === "instellingen" && (
              <TabInstellingen klant={klant} isAnonymized={isAnonymized} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
