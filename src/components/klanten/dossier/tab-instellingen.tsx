"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, ShieldAlert, SlidersHorizontal, User } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Switch } from "@/components/ui/switch";
import { Feit } from "@/components/klanten/klant-detail-primitieven";
import { LeadHistorieCard } from "@/components/leads/lead-historie-card";
import { useIsAdmin } from "@/hooks/use-users";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * Instellingen — alles wat je zelden aanraakt maar wél moet kunnen vinden:
 * de administratieve gegevens, de voorkeuren en het privacy-blok.
 *
 * Drie panelen in de volgorde van het prototype (Contactgegevens / Voorkeuren
 * / Privacy). WS3 bouwt in het eerste paneel het échte bewerkformulier
 * (`klanten.update` bestaat al); de structuur staat daar al op te wachten,
 * inclusief de plek voor de knop "Wijzigen" in de kopbalk.
 */

/** Wat deze tab van de klant nodig heeft — bewust smal gehouden. */
export interface KlantInstellingenGegevens {
  _id: Id<"klanten">;
  naam: string;
  adres?: string;
  postcode?: string;
  plaats?: string;
  email?: string;
  telefoon?: string;
  contactpersoon?: string;
  kvkNummer?: string;
  btwNummer?: string;
  inplanBevestigingsMail?: boolean;
}

/** Eén regel, ook als het gegeven ontbreekt: "—" is een antwoord. */
function Waarde({ tekst }: { tekst?: string }) {
  if (!tekst) return <span className="text-muted-foreground">—</span>;
  return <>{tekst}</>;
}

export function TabInstellingen({
  klant,
  isAnonymized,
}: {
  klant: KlantInstellingenGegevens;
  isAnonymized: boolean;
}) {
  const isAdmin = useIsAdmin();
  const setInplanMail = useMutation(api.klanten.setInplanBevestigingsMail);
  const gdprAnonymize = useMutation(api.klanten.gdprAnonymize);
  const gdprBlockers = useQuery(api.klanten.checkGdprBlockers, {
    id: klant._id,
  });
  const [toonGdprDialog, setToonGdprDialog] = useState(false);
  const [bezigMetAnonimiseren, setBezigMetAnonimiseren] = useState(false);

  const heeftBlockers = gdprBlockers?.hasBlockers === true;

  const adresregel = [
    klant.adres,
    [klant.postcode, klant.plaats].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const anonimiseer = async () => {
    setBezigMetAnonimiseren(true);
    try {
      await gdprAnonymize({ id: klant._id });
      showSuccessToast("Klantgegevens zijn geanonimiseerd", {
        description:
          "Alle persoonsgegevens zijn definitief verwijderd conform GDPR.",
      });
      setToonGdprDialog(false);
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij anonimiseren"
      );
    } finally {
      setBezigMetAnonimiseren(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Contactgegevens ──────────────────────────────────────────────── */}
      <SectiePaneel titel="Contactgegevens" icoon={<User />} kopbalk>
        {/* WS3: hier komt de knop "Wijzigen" in `acties` plus het formulier
            (naam, type, adres, e-mail, telefoon) via `klanten.update`. */}
        <dl className="divide-y">
          <Feit label="Naam">{klant.naam}</Feit>
          <Feit label="Contactpersoon">
            <Waarde tekst={klant.contactpersoon} />
          </Feit>
          <Feit label="Telefoon">
            {klant.telefoon ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                {klant.telefoon}
                <CopyButton
                  value={klant.telefoon}
                  label="Kopieer telefoonnummer"
                />
              </span>
            ) : (
              <Waarde />
            )}
          </Feit>
          <Feit label="E-mail">
            {klant.email ? (
              <span className="inline-flex items-center gap-1">
                {klant.email}
                <CopyButton value={klant.email} label="Kopieer e-mailadres" />
              </span>
            ) : (
              <Waarde />
            )}
          </Feit>
          <Feit label="Adres" uitlijnen="onder">
            <Waarde tekst={adresregel} />
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
        </dl>
      </SectiePaneel>

      {/* ── Voorkeuren ───────────────────────────────────────────────────── */}
      <SectiePaneel
        titel="Voorkeuren"
        icoon={<SlidersHorizontal />}
        kopbalk
      >
        {/* §2.7: opt-in inplanning-bevestigingsmail (default uit) — zet bij
            inplannen een concept-mail klaar; kantoor keurt goed.
            WS4/WS5: de schakelaar "Gesprekken mogen opgenomen worden"
            (`opnameToestemming`) hoort hier als tweede regel. */}
        <div className="flex items-start justify-between gap-3 px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Bevestigingsmail bij inplannen</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Zet een concept-mail klaar in Concept-mails
            </p>
          </div>
          <Switch
            className="mt-0.5 shrink-0"
            checked={klant.inplanBevestigingsMail === true}
            onCheckedChange={async (aan) => {
              try {
                await setInplanMail({
                  id: klant._id,
                  inplanBevestigingsMail: aan,
                });
                showSuccessToast(
                  aan
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

      {/* Lead-historie (PRD §1.3): herkomst en activiteiten van de
          gepromoveerde lead. Rendert niets zonder lead-verleden. */}
      <LeadHistorieCard klantId={klant._id} />

      {/* ── Privacy ──────────────────────────────────────────────────────── */}
      {isAdmin && !isAnonymized && (
        <SectiePaneel titel="Privacy" icoon={<ShieldAlert />} kopbalk>
          <div className="flex flex-wrap items-start gap-3 px-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">GDPR-verwijderverzoek</p>
              <p className="mt-0.5 max-w-[52ch] text-xs text-muted-foreground">
                Anonimiseert alle persoonsgegevens van deze klant. Financiële
                gegevens blijven bewaard voor de boekhouding.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={() => setToonGdprDialog(true)}
            >
              Verzoek starten
            </Button>
          </div>
        </SectiePaneel>
      )}

      {/* CRM-008: bevestiging vóór de onomkeerbare stap */}
      <AlertDialog open={toonGdprDialog} onOpenChange={setToonGdprDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>GDPR Verwijderverzoek</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Alle persoonsgegevens van deze klant worden definitief
                  geanonimiseerd. Dit kan niet ongedaan gemaakt worden.
                </p>
                <p>Financiele gegevens blijven bewaard voor de boekhouding.</p>

                {heeftBlockers && gdprBlockers?.blockers && (
                  <div className="mt-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                    <p className="mb-2 text-sm font-medium text-destructive">
                      Anonimisering is niet mogelijk vanwege:
                    </p>
                    <ul className="list-inside list-disc space-y-1 text-sm text-destructive">
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
            <AlertDialogCancel disabled={bezigMetAnonimiseren}>
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={anonimiseer}
              disabled={bezigMetAnonimiseren || heeftBlockers}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bezigMetAnonimiseren ? (
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
    </div>
  );
}
