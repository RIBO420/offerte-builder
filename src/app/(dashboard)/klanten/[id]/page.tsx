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
import { NieuweOfferteSplitButton } from "@/components/offerte/nieuwe-offerte-split-button";
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
 * Stille contactchip: het hele gegeven is klikbaar (bellen, mailen, route),
 * de kopieerknop verschijnt pas bij aanwijzen of toetsenbordfocus. Zo blijft
 * de regel rustig zonder dat er functionaliteit verdwijnt.
 */
function ContactChip({
  icoon,
  href,
  extern = false,
  kopieer,
  kopieerLabel,
  titel,
  className,
  children,
}: {
  icoon: ReactNode;
  href?: string;
  /** Externe links (Maps) openen in een nieuw tabblad. */
  extern?: boolean;
  kopieer?: string;
  kopieerLabel?: string;
  titel?: string;
  className?: string;
  children: ReactNode;
}) {
  const inhoud = (
    <>
      <span
        aria-hidden
        className="shrink-0 text-muted-foreground [&>svg]:size-4"
      >
        {icoon}
      </span>
      {children}
    </>
  );
  return (
    <span className="group/chip inline-flex min-w-0 items-center gap-0.5">
      {href ? (
        <a
          href={href}
          {...(extern
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
          title={titel}
          className={`inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}
        >
          {inhoud}
        </a>
      ) : (
        <span
          title={titel}
          className={`inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 ${className ?? ""}`}
        >
          {inhoud}
        </span>
      )}
      {kopieer && (
        <span className="shrink-0 opacity-0 transition-opacity duration-100 focus-within:opacity-100 group-hover/chip:opacity-100 max-sm:opacity-100">
          <CopyButton value={kopieer} label={kopieerLabel} />
        </span>
      )}
    </span>
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
        {/* Identiteitskop: wie is dit, en hoe bereik ik hem. Kantoor opent dit
            dossier het vaakst om te bellen of te mailen — dus staan telefoon en
            e-mail hier, niet onderin een rail die onder 1280px helemaal
            wegzakt. De hairline eronder maakt van de kop een podium: één
            verankerd blok (monogram + naam + contact + kerncijfers) waar de
            rest van het dossier onder hangt. */}
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
                  als de naam erboven. */}
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
                    <Link
                      href="/klanten"
                      title="Telefoonnummer toevoegen — bewerken kan via de klantenlijst"
                      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Phone className="size-4 shrink-0" aria-hidden />
                      Telefoon toevoegen
                    </Link>
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
                    <Link
                      href="/klanten"
                      title="E-mailadres toevoegen — bewerken kan via de klantenlijst"
                      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Mail className="size-4 shrink-0" aria-hidden />
                      E-mail toevoegen
                    </Link>
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

              {/* Kerncijfers als stille metaregel: hoe lang klant, wat er
                  omgaat. Eén regel voetnoot-grijs — geen kaart, geen
                  heldcijfers; de bedragen zelf staan in het dossier. */}
              <p className="text-xs text-muted-foreground tabular-nums">
                Klant sinds {formatDate(klant.createdAt)}
                {offertes.length === 0 ? (
                  <> · nog geen offertes</>
                ) : (
                  <>
                    {" · "}
                    {offertes.length} offerte{offertes.length === 1 ? "" : "s"}
                    {" · "}
                    {formatCurrency(totalValue)}
                    {" · "}
                    {geaccepteerdAantal} geaccepteerd
                    {acceptedValue > 0 && ` (${formatCurrency(acceptedValue)})`}
                  </>
                )}
              </p>
            </div>
          </div>

          {!isAnonymized && (
            <div className="flex shrink-0 flex-wrap gap-2">
              {/* Eén ingang voor een nieuwe offerte (WS6): dezelfde knop als op
                  het dashboard en in de offertetoolbar. De twee losse
                  wizard-links die hier stonden omzeilden die ingang én raakten
                  de klant kwijt; nu reist `klantId` mee door álle drie de paden
                  (tegels, vrije offerte, templates). TT-004 blijft ongemoeid:
                  het zijn startpunten, geen nieuwe `offertes.type`-waarden. */}
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

        {/* Werkvlak links, feiten rechts. De rechterkolom blijft staan bij het
            scrollen: bij het lezen van de tijdlijn wil je het telefoonnummer
            binnen bereik houden. */}
        <div className="grid items-start gap-5 xl:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-6">
            {/* Werkstroom als één cluster: Taken en Tijdlijn staan dicht op
                elkaar (12px), het dossier-archief volgt op afstand (24px).
                Twee spatiematen in plaats van één — zo leest de kolom als
                twee gedachten in plaats van een stapel gelijke blokken, en
                oogt ook een leeg dossier gecomponeerd in plaats van gestrand. */}
            <div className="space-y-3">
              {/* Taken vóór de tijdlijn: vooruitkijken vóór terugkijken. */}
              <KlantTakenCard klantId={id as Id<"klanten">} />

              {/* Klanttijdlijn (PRD §2.3) — vervangt het vrije Notities-veld
                  ("één waarheid"): filters op kanaal/klus, vrij zoeken en
                  entry-compositie voor kantoor. */}
              <KlantTijdlijn klantId={id as Id<"klanten">} toonPaneel />
            </div>

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
            {/* Contact staat in de identiteitskop en "klant sinds" plus de
                cijfers in de metaregel dáár — wat hier overblijft is de
                administratie die je zelden nodig hebt: KvK/BTW (alleen
                zakelijk) en één instelling. Eén rustige kaart in plaats van
                een halfleeg GEGEVENS-blok naast een losse instelling. */}
            <SectiePaneel titel="Gegevens">
              {(klant.kvkNummer || klant.btwNummer) && (
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
                </dl>
              )}

              {/* §2.7: opt-in inplanning-bevestigingsmail (default uit) — zet
                  bij inplannen een concept-mail klaar; kantoor keurt goed.
                  Staat bewust ín dit paneel: één instelling verdiende geen
                  tweede kaart in een rail die verder hooguit twee regels telt. */}
              <div
                className={`flex items-start justify-between gap-3 px-3 py-2.5 ${klant.kvkNummer || klant.btwNummer ? "border-t" : ""}`}
              >
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
