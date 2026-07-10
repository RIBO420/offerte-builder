"use client";

/**
 * Detail + interne case-thread van een melding (PRD §2.4, case-test §8.6).
 *
 * - Thread is INTERN (klant-rol krijgt server-side een AuthError; alleen
 *   kantoor kan iets richting klant doen — daarom bestaat hier geen
 *   verstuurknop naar de klant).
 * - Een @tag van een medewerker maakt een veldtaak die op diens dagkaart
 *   verschijnt zodra zijn team bij deze klant gepland staat.
 * - Promotie melding → werkitem en (voor plantaken) "beurt vrijgeven naar
 *   wachtrij". De INPLAN-MAIL-knop (§2.7) zet de mail als CONCEPT klaar in
 *   de wachtrij "Concept-mails" — vanuit dit scherm wordt NIETS gemaild;
 *   goedkeuren + versturen gebeurt in de wachtrij (capability §1.2).
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AtSign, CheckCircle2, Hammer, Mail, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { KlantThreadPaneel } from "./klant-thread-paneel";

const STATUS_OPTIES = [
  { value: "nieuw", label: "Nieuw" },
  { value: "in_behandeling", label: "In behandeling" },
  { value: "wacht_op_derden", label: "Wacht op derden" },
  { value: "opgelost", label: "Opgelost" },
] as const;

interface MeldingDetailModalProps {
  meldingId: Id<"servicemeldingen"> | null;
  onClose: () => void;
  kanMuteren: boolean;
}

export function MeldingDetailModal({
  meldingId,
  onClose,
  kanMuteren,
}: MeldingDetailModalProps) {
  const melding = useQuery(
    api.servicemeldingen.getById,
    meldingId ? { id: meldingId } : "skip"
  );
  const comments = useQuery(
    api.caseThread.listComments,
    meldingId ? { meldingId } : "skip"
  );
  const veldtaken = useQuery(
    api.caseThread.listVeldtakenVoorMelding,
    meldingId ? { meldingId } : "skip"
  );
  const medewerkers = useQuery(
    api.medewerkers.list,
    meldingId ? { isActief: true } : "skip"
  );

  const updateStatus = useMutation(api.servicemeldingen.updateStatus);
  const addComment = useMutation(api.caseThread.addComment);
  const rondVeldtaakAf = useMutation(api.caseThread.rondVeldtaakAf);
  const promoveer = useMutation(api.servicemeldingen.promoveerNaarWerkitem);
  const geefVrij = useMutation(api.planningsattendering.geefBeurtVrij);
  const maakInplanConcept = useMutation(api.conceptMails.maakInplanConcept);

  const [commentTekst, setCommentTekst] = useState("");
  const [tagMedewerkerId, setTagMedewerkerId] = useState<string>("");
  const [bezig, setBezig] = useState(false);

  if (!meldingId) return null;

  const isPlantaak = melding?.taaksoort === "plantaak";

  async function handleStatus(status: string) {
    if (!meldingId) return;
    try {
      await updateStatus({
        id: meldingId,
        status: status as "nieuw" | "in_behandeling" | "wacht_op_derden" | "opgelost",
      });
      showSuccessToast("Status bijgewerkt");
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Mislukt");
    }
  }

  async function handleComment() {
    if (!meldingId || !commentTekst.trim()) return;
    setBezig(true);
    try {
      const medewerker = (medewerkers ?? []).find(
        (m) => m._id === tagMedewerkerId
      );
      // @tag in de tekst tonen zoals de PRD hem beschrijft (bv. "@Michel")
      const tekst =
        medewerker && !commentTekst.includes(`@${medewerker.naam}`)
          ? `@${medewerker.naam} ${commentTekst.trim()}`
          : commentTekst.trim();
      await addComment({
        meldingId,
        tekst,
        taggedMedewerkerIds: tagMedewerkerId
          ? [tagMedewerkerId as Id<"medewerkers">]
          : undefined,
      });
      showSuccessToast(
        medewerker
          ? `Comment geplaatst — veldtaak aangemaakt voor ${medewerker.naam}`
          : "Comment geplaatst"
      );
      setCommentTekst("");
      setTagMedewerkerId("");
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Mislukt");
    } finally {
      setBezig(false);
    }
  }

  async function handlePromotie() {
    if (!meldingId) return;
    setBezig(true);
    try {
      await promoveer({ id: meldingId });
      showSuccessToast("Werkitem aangemaakt — staat in de wachtrij");
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Mislukt");
    } finally {
      setBezig(false);
    }
  }

  async function handleVrijgeven() {
    if (!meldingId) return;
    setBezig(true);
    try {
      await geefVrij({ meldingId });
      showSuccessToast("Beurt vrijgegeven naar de wachtrij");
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Mislukt");
    } finally {
      setBezig(false);
    }
  }

  // §2.7 (event inplan_attendering): één klik zet de inplan-mail als
  // CONCEPT klaar in de wachtrij "Concept-mails" — kantoor keurt daar goed
  // en verstuurt (of verwerpt). Vanuit dit scherm wordt NIETS gemaild.
  async function handleInplanMail() {
    if (!meldingId) return;
    setBezig(true);
    try {
      await maakInplanConcept({ meldingId });
      showSuccessToast(
        "Inplan-mail klaargezet — goedkeuren en versturen via Concept-mails"
      );
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Mislukt");
    } finally {
      setBezig(false);
    }
  }

  return (
    <Dialog open={meldingId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPlantaak ? "Plantaak" : "Melding"}
            {melding?.geescaleerd && (
              <Badge variant="destructive">Geëscaleerd</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {melding?.klantNaam}
            {melding?.werkitemNaam ? ` — ${melding.werkitemNaam}` : ""}
          </DialogDescription>
        </DialogHeader>

        {melding && (
          <div className="space-y-4">
            <p className="text-sm">{melding.beschrijving}</p>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {melding.type && <Badge variant="outline">{melding.type}</Badge>}
              {melding.kanaal && (
                <Badge variant="outline">{melding.kanaal}</Badge>
              )}
              {melding.verzekeringsvlag && (
                <Badge variant="outline">Verzekering</Badge>
              )}
              {melding.beoordelenVoorPlanning && (
                <Badge variant="outline">Beoordelen voor planning</Badge>
              )}
              {melding.eigenaarNaam && (
                <span>Eigenaar: {melding.eigenaarNaam}</span>
              )}
              {melding.deadline && <span>Deadline: {melding.deadline}</span>}
            </div>

            {kanMuteren && (
              <div className="flex flex-wrap items-center gap-2">
                <Select value={melding.status} onValueChange={handleStatus}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!isPlantaak && !melding.werkitemId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePromotie}
                    disabled={bezig}
                  >
                    <Hammer className="size-4 mr-1" />
                    Maak werkitem
                  </Button>
                )}

                {isPlantaak && (
                  <>
                    <Button
                      size="sm"
                      onClick={handleVrijgeven}
                      disabled={bezig || melding.status === "opgelost"}
                    >
                      <Send className="size-4 mr-1" />
                      Beurt vrijgeven naar wachtrij
                    </Button>
                    {/* §2.7: zet de inplan-mail als concept in de wachtrij —
                        versturen gebeurt daar, na goedkeuring door kantoor */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleInplanMail}
                      disabled={bezig || melding?.status === "opgelost"}
                      title="Zet de inplan-mail klaar in Concept-mails (kantoor keurt goed en verstuurt)"
                    >
                      <Mail className="size-4 mr-1" />
                      Inplan-mail klaarzetten
                    </Button>
                  </>
                )}
              </div>
            )}

            {(veldtaken ?? []).length > 0 && (
              <div className="space-y-1.5">
                <Label>Veldtaken</Label>
                {(veldtaken ?? []).map((taak) => (
                  <div
                    key={taak._id}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm"
                  >
                    <AtSign className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">{taak.medewerkerNaam}</span>
                    <span className="text-muted-foreground truncate flex-1">
                      {taak.tekst}
                    </span>
                    {taak.status === "afgerond" ? (
                      <Badge variant="secondary">Afgerond</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rondVeldtaakAf({ veldtaakId: taak._id })}
                      >
                        <CheckCircle2 className="size-4 mr-1" />
                        Afronden
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Interne case-thread</Label>
              <p className="text-xs text-muted-foreground">
                Niet zichtbaar voor de klant. Alleen kantoor koppelt terug naar
                de klant.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto rounded-md border p-2">
                {(comments ?? []).map((c) => (
                  <div
                    key={c._id}
                    className={cn(
                      "rounded-md p-2 text-sm",
                      c.systeem
                        ? "bg-muted/50 text-muted-foreground italic"
                        : "bg-accent/40"
                    )}
                  >
                    <div className="text-xs font-medium mb-0.5">
                      {c.auteurNaam}
                      <span className="text-muted-foreground font-normal ml-2">
                        {new Date(c.createdAt).toLocaleString("nl-NL")}
                      </span>
                    </div>
                    {c.tekst}
                  </div>
                ))}
                {(comments ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">
                    Nog geen berichten in deze thread.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Textarea
                  value={commentTekst}
                  onChange={(e) => setCommentTekst(e.target.value)}
                  placeholder="Interne notitie of antwoord…"
                  rows={2}
                />
                <div className="flex items-center gap-2">
                  <Select
                    value={tagMedewerkerId}
                    onValueChange={setTagMedewerkerId}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="@ Medewerker taggen (veldtaak)" />
                    </SelectTrigger>
                    <SelectContent>
                      {(medewerkers ?? []).map((m) => (
                        <SelectItem key={m._id} value={m._id}>
                          @{m.naam}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleComment}
                    disabled={bezig || !commentTekst.trim()}
                  >
                    Plaatsen
                  </Button>
                </div>
              </div>
            </div>

            {/* Klantthread (§3.1) — STRIKT gescheiden van de interne
                case-thread hierboven; visueel onmiskenbaar anders.
                Onderhoudstaken (§3.3) hebben geen klant → geen klantthread */}
            {melding && melding.klantId && (
              <div className="space-y-2">
                <Label>Klantgesprek</Label>
                <KlantThreadPaneel
                  klantId={melding.klantId}
                  meldingId={meldingId}
                />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
