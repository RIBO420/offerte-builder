"use client";

/**
 * Gevarenzone — "Werkdata opschonen" onderaan /instellingen.
 *
 * Dit is het scherm bij `convex/opschonen.ts`: één ronde wist alle werkdata
 * (offertes, facturen, projecten, planning, uren, service, chats, meldingen) en
 * laat de stamgegevens staan (leads, klanten, leveranciers, instellingen,
 * catalogus, personeel, middelen). Onomkeerbaar, dus:
 *
 * 1. **Weggestopt by design.** Geen tab tussen de tien andere, maar een gedempt
 *    tekstlinkje onder de pagina dat de sectie uitklapt — en alleen voor
 *    directie (`useIsAdmin`). Wie hier per ongeluk komt, komt hier niet.
 * 2. **De preview draait pas als de dialoog open staat** (`"skip"` daarbuiten).
 *    `api.opschonen.preview` telt met `.collect()` over tientallen tabellen;
 *    die rekening hoort niet bij elk bezoek aan Instellingen op tafel te komen.
 * 3. **De voortgang ís de telling.** De backend houdt bewust geen status bij;
 *    `useQuery` is reactief, dus zodra de batchloop rijen wist zakt `totaal`
 *    vanzelf. Nul = klaar. `beginTotaal` (vastgelegd bij de start) maakt daar
 *    een percentage van.
 *
 * De categorienamen hieronder zijn de vertaling van tabelnamen naar taal van
 * kantoor. Een tabel die nog niet in de lijst staat valt op "Overige werkdata"
 * terug: de dialoog blijft dan kloppen, hij wordt alleen minder specifiek.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsAdmin } from "@/hooks/use-users";

/** Letterlijk dit woord, hoofdletters en al — de server eist hetzelfde. */
const BEVESTIGING = "OPSCHONEN";

/** Restcategorie voor tabellen die hieronder (nog) geen plek hebben. */
const OVERIG = "Overige werkdata";

const CATEGORIEEN: { label: string; tabellen: string[] }[] = [
  {
    label: "Offertes en offertemail",
    tabellen: [
      "offertes",
      "offerte_versions",
      "offerte_messages",
      "offerte_reminders",
      "conceptMails",
      "email_logs",
      "leerfeedback_historie",
    ],
  },
  {
    label: "Facturen en betalingen",
    tabellen: [
      "facturen",
      "betalingen",
      "betalingsherinneringen",
      "contractFacturen",
      "boekhoudSync",
    ],
  },
  {
    label: "Projecten en planning",
    tabellen: [
      "projecten",
      "planningTaken",
      "weekPlanning",
      "teamBemanning",
      "afwezigheidsblokken",
      "planbordLogboek",
      "reistijdCache",
      "dagkaartAfwijkingen",
      "teamBusOverrides",
      "middelReserveringen",
      "werklocaties",
      "jobSiteGeofences",
    ],
  },
  {
    label: "Uren, voor- en nacalculatie",
    tabellen: [
      "urenSegmenten",
      "urenDagen",
      "urenLogboek",
      "urenRegistraties",
      "voorcalculaties",
      "nacalculaties",
      "materiaalChecks",
      "meerwerk",
    ],
  },
  {
    label: "Gebruik van bussen en machines",
    tabellen: [
      "machineGebruik",
      "voertuigOnderhoud",
      "kilometerStanden",
      "brandstofRegistratie",
      "voertuigSchades",
    ],
  },
  {
    label: "Inkoop, voorraad en projectkosten",
    tabellen: [
      "inkooporders",
      "voorraad",
      "voorraadMutaties",
      "projectKosten",
      "kwaliteitsControles",
    ],
  },
  {
    label: "Verlof, verzuim en toolboxen",
    tabellen: ["verlofaanvragen", "verzuimregistraties", "toolboxMeetings"],
  },
  {
    label: "Onderhoud, garantie en service",
    tabellen: [
      "onderhoudscontracten",
      "contractWerkzaamheden",
      "garanties",
      "servicemeldingen",
      "meldingComments",
      "veldtaken",
      "serviceAfspraken",
    ],
  },
  {
    label: "Tijdlijn en taken in klantdossiers",
    tabellen: ["klantTijdlijn", "klantTaken"],
  },
  {
    label: "Chats en berichten",
    tabellen: [
      "team_messages",
      "direct_messages",
      "chat_threads",
      "chat_messages",
      "chat_attachments",
    ],
  },
  {
    label: "Locaties, ritten en werkgebieden",
    tabellen: [
      "locationSessions",
      "locationData",
      "geofenceEvents",
      "routes",
      "locationAnalytics",
      "locationAuditLog",
    ],
  },
  {
    label: "Meldingen, logboeken en demodata",
    tabellen: [
      "notifications",
      "notificationDeliveryLog",
      "pushNotificationLogs",
      "notification_log",
      "demoSeed",
    ],
  },
];

const CATEGORIE_VAN = new Map<string, string>(
  CATEGORIEEN.flatMap(({ label, tabellen }) =>
    tabellen.map((tabel) => [tabel, label] as const)
  )
);

export interface OpschoonRegel {
  label: string;
  aantal: number;
  /** Staat er iets in deze regel dat voor de hele installatie geldt? */
  heleInstallatie: boolean;
}

/**
 * Telling per tabel → regels per categorie, in vaste volgorde, zonder nullen.
 *
 * Lege categorieën weglaten houdt de lijst tijdens de ronde leesbaar: hij
 * krimpt mee terwijl de batchloop tabellen leegmaakt.
 */
export function maakRegels(
  telling: Record<string, number>,
  heleInstallatieTabellen: readonly string[]
): OpschoonRegel[] {
  const perCategorie = new Map<string, OpschoonRegel>();

  for (const [tabel, aantal] of Object.entries(telling)) {
    const label = CATEGORIE_VAN.get(tabel) ?? OVERIG;
    const regel = perCategorie.get(label) ?? {
      label,
      aantal: 0,
      heleInstallatie: false,
    };
    regel.aantal += aantal;
    if (aantal > 0 && heleInstallatieTabellen.includes(tabel)) {
      regel.heleInstallatie = true;
    }
    perCategorie.set(label, regel);
  }

  return [...CATEGORIEEN.map((c) => c.label), OVERIG]
    .map((label) => perCategorie.get(label))
    .filter((regel): regel is OpschoonRegel => !!regel && regel.aantal > 0);
}

// ── Gevarenzone ─────────────────────────────────────────────────────────────

export function Gevarenzone() {
  const [open, setOpen] = useState(false);
  const [bevestiging, setBevestiging] = useState("");
  /** Telling op het moment van starten; basis voor de voortgangsbalk. */
  const [beginTotaal, setBeginTotaal] = useState<number | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [startBezig, setStartBezig] = useState(false);

  // Buiten de dialoog niets tellen: zie punt 2 in de kop van dit bestand.
  const preview = useQuery(api.opschonen.preview, open ? {} : "skip");
  const start = useMutation(api.opschonen.start);

  const loopt = beginTotaal !== null;
  const totaal = preview?.totaal ?? 0;

  const regels = useMemo(
    () =>
      preview
        ? maakRegels(preview.telling, preview.fullScanTabellen)
        : [],
    [preview]
  );

  const heeftHeleInstallatie = regels.some((r) => r.heleInstallatie);

  // Nul = klaar. De backend houdt geen status bij, dus dit ís het eindsignaal.
  useEffect(() => {
    if (!loopt || preview === undefined || preview.totaal > 0) return;
    toast.success("Werkdata opgeschoond");
    setBeginTotaal(null);
    setBevestiging("");
    setOpen(false);
  }, [loopt, preview]);

  const handleStart = useCallback(async () => {
    if (bevestiging !== BEVESTIGING || !preview || preview.totaal === 0) return;
    setFout(null);
    setStartBezig(true);
    try {
      await start({ bevestiging: BEVESTIGING });
      setBeginTotaal(preview.totaal);
    } catch (error) {
      // ConvexError draagt zijn tekst in `data`; die tekst is Nederlands en
      // legt precies uit wat er misging (geen rechten, verkeerd woord).
      const data = (error as { data?: string })?.data;
      setFout(
        typeof data === "string"
          ? data
          : error instanceof Error
            ? error.message
            : "Opschonen kon niet starten."
      );
    } finally {
      setStartBezig(false);
    }
  }, [bevestiging, preview, start]);

  const voortgang =
    beginTotaal && beginTotaal > 0
      ? Math.min(100, Math.round(((beginTotaal - totaal) / beginTotaal) * 100))
      : 0;

  return (
    <SectiePaneel
      titel="Gevarenzone"
      icoon={<AlertTriangle />}
      className="border-destructive/60"
      uitleg="Hiermee wis je in één keer alle werkdata. Stamgegevens blijven staan."
    >
      <div className="space-y-4 p-4 text-sm">
        <p className="text-muted-foreground">
          Hiermee begin je met een schone administratie: alle lopende en
          afgeronde werkgegevens verdwijnen, terwijl je bedrijfsgegevens blijven
          staan. Dit kan niet ongedaan worden gemaakt.
        </p>

        <div className="grid gap-4 @md/sectie:grid-cols-2">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="font-medium text-foreground">Blijft staan</p>
            <p className="mt-1 text-muted-foreground">
              Leads, klanten, leveranciers, instellingen, catalogus (producten,
              tekstblokken, normuren), personeel en middelen (bussen, machines,
              teams).
            </p>
          </div>
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="font-medium text-foreground">Verdwijnt</p>
            <p className="mt-1 text-muted-foreground">
              Offertes, facturen, projecten, planning, uren, service en
              onderhoud, chats, meldingen en logboeken.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            setBevestiging("");
            setFout(null);
            setOpen(true);
          }}
        >
          Werkdata opschonen…
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(nieuw) => {
          // Tijdens de ronde blijft de dialoog staan: sluiten stopt de telling
          // en daarmee het enige signaal dat het klaar is.
          if (!nieuw && loopt) return;
          setOpen(nieuw);
        }}
      >
        <DialogContent showCloseButton={!loopt} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Werkdata opschonen</DialogTitle>
            <DialogDescription>
              {loopt
                ? "Bezig met opschonen. Laat dit venster open tot het klaar is."
                : "Controleer wat er weggaat. Dit kan niet ongedaan worden gemaakt."}
            </DialogDescription>
          </DialogHeader>

          {preview === undefined ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Bezig met tellen…
            </p>
          ) : (
            <div className="space-y-4">
              <div className="max-h-64 overflow-y-auto rounded-md border">
                {regels.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    Er is geen werkdata om op te schonen.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {regels.map((regel) => (
                        <tr key={regel.label} className="border-b last:border-0">
                          <td className="px-3 py-1.5">
                            {regel.label}
                            {regel.heleInstallatie && (
                              <span aria-hidden="true"> *</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {regel.aantal.toLocaleString("nl-NL")}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t bg-muted/40 font-medium">
                        <td className="px-3 py-1.5">Totaal</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {totaal.toLocaleString("nl-NL")}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              {heeftHeleInstallatie && (
                <p className="text-xs text-muted-foreground">
                  * Deze regel wordt voor de hele installatie opgeschoond, niet
                  alleen voor jouw eigen werkomgeving.
                </p>
              )}

              {loopt ? (
                <div className="space-y-2">
                  <Progress value={voortgang} />
                  <p className="text-sm text-muted-foreground">
                    Nog {totaal.toLocaleString("nl-NL")} van{" "}
                    {(beginTotaal ?? 0).toLocaleString("nl-NL")} te gaan.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="opschonen-bevestiging">
                    Typ {BEVESTIGING} om te bevestigen
                  </Label>
                  <Input
                    id="opschonen-bevestiging"
                    value={bevestiging}
                    autoComplete="off"
                    disabled={totaal === 0}
                    placeholder={`Typ ${BEVESTIGING} om te bevestigen`}
                    onChange={(e) => setBevestiging(e.target.value)}
                  />
                  {totaal === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Er is niets om op te schonen — de knop blijft daarom uit.
                    </p>
                  )}
                </div>
              )}

              {fout && (
                <p role="alert" className="text-sm text-destructive">
                  {fout}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            {!loopt && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Annuleren
              </Button>
            )}
            <Button
              type="button"
              variant="destructive"
              disabled={
                loopt ||
                startBezig ||
                totaal === 0 ||
                bevestiging !== BEVESTIGING
              }
              onClick={handleStart}
            >
              {(loopt || startBezig) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {loopt ? "Bezig met opschonen…" : "Definitief wissen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectiePaneel>
  );
}

// ── Ingang onderaan Instellingen ────────────────────────────────────────────

/**
 * Het gedempte linkje dat de Gevarenzone uitklapt. Geen tab: dit hoort niet
 * tussen de instellingen te staan die kantoor dagelijks aanraakt.
 *
 * Alleen directie ziet het — en de Gevarenzone hangt eronder in plaats van
 * ernaast, zodat de preview-query pas na een bewuste klik mount.
 */
export function GeavanceerdBeheer() {
  const isDirectie = useIsAdmin();
  const [zichtbaar, setZichtbaar] = useState(false);

  if (!isDirectie) return null;

  return (
    <div className="mt-6 border-t pt-4">
      <button
        type="button"
        onClick={() => setZichtbaar((v) => !v)}
        aria-expanded={zichtbaar}
        className="flex items-center gap-1 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {zichtbaar ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Geavanceerd beheer
      </button>

      {zichtbaar && (
        <div className="mt-3 max-w-3xl">
          <Gevarenzone />
        </div>
      )}
    </div>
  );
}
