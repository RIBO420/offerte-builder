"use client";

/**
 * Klantthread-paneel voor de kantoor-/stafkant (PRD §3.1 + §1.2).
 *
 * KANTOOR↔KLANT-REGELS (hard):
 * - Dit paneel is visueel ONMISKENBAAR anders dan interne threads:
 *   banner "ZICHTBAAR VOOR KLANT" + amberkleurige achtergrond.
 * - De composer staat STANDAARD op INTERN: het bericht landt dan als
 *   interne case-comment (melding) of tijdlijn-entry (werkitem) — de
 *   klant ziet er niets van.
 * - Extern versturen vergt TWEE bewuste handelingen: (1) de expliciete
 *   toggle "Naar klant" én (2) een aparte verstuurbevestiging. Server-side
 *   loopt het door assertKanNaarKlantVersturen (kantoor-only).
 * - Voor niet-kantoor-stafrollen (voorman/medewerker/...) bestaat de
 *   externe optie niet: de toggle wordt niet gerenderd.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { Eye, Loader2, Lock, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";

interface KlantThreadPaneelProps {
  klantId: Id<"klanten">;
  werkitemId?: Id<"projecten">;
  meldingId?: Id<"servicemeldingen">;
}

function formatTijd(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function KlantThreadPaneel({
  klantId,
  werkitemId,
  meldingId,
}: KlantThreadPaneelProps) {
  const [tekst, setTekst] = useState("");
  // Handeling 1: expliciete toggle — composer staat STANDAARD op intern
  const [naarKlant, setNaarKlant] = useState(false);
  // Handeling 2: aparte verstuurbevestiging
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const rol = useQuery(api.roles.getCurrentUserRole);
  const isKantoor = rol ? rol.isAdmin || rol.isProjectleider : false;

  const threadId = useQuery(api.chatThreads.getKlantThreadVoorContext, {
    werkitemId,
    meldingId,
  });
  const messages = useQuery(
    api.chatThreads.listMessages,
    threadId ? { threadId } : "skip"
  );

  const openThread = useMutation(api.chatThreads.openKlantThreadVoorContext);
  const sendMessage = useMutation(api.chatThreads.sendMessage);
  const addComment = useMutation(api.caseThread.addComment);
  const voegTijdlijnEntryToe = useMutation(api.tijdlijn.voegEntryToe);

  const verstuurIntern = async () => {
    setBusy(true);
    try {
      if (meldingId) {
        await addComment({ meldingId, tekst: tekst.trim() });
      } else if (werkitemId) {
        await voegTijdlijnEntryToe({
          klantId,
          kanaal: "intern",
          tekst: tekst.trim(),
          werkitemId,
        });
      }
      setTekst("");
      showSuccessToast("Interne notitie opgeslagen — niet zichtbaar voor de klant");
    } catch {
      showErrorToast("Opslaan is niet gelukt");
    } finally {
      setBusy(false);
    }
  };

  const verstuurExtern = async () => {
    setBusy(true);
    try {
      const id =
        threadId ?? (await openThread({ werkitemId, meldingId }));
      await sendMessage({ threadId: id, message: tekst.trim() });
      setTekst("");
      setNaarKlant(false);
      showSuccessToast("Bericht verstuurd naar de klant");
    } catch {
      showErrorToast("Versturen naar de klant is niet gelukt");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const handleSubmit = () => {
    if (!tekst.trim() || busy) return;
    if (naarKlant && isKantoor) {
      // Handeling 2: bevestiging vóór er iets richting klant gaat
      setConfirmOpen(true);
    } else {
      void verstuurIntern();
    }
  };

  return (
    <div className="rounded-lg border-2 border-amber-400 dark:border-amber-500 overflow-hidden">
      {/* Banner: onmiskenbaar klant-zichtbaar */}
      <div className="bg-amber-400 dark:bg-amber-500 px-3 py-1.5 flex items-center gap-2">
        <Eye className="h-4 w-4 text-amber-950" />
        <span className="text-xs font-bold tracking-widest text-amber-950 uppercase">
          Zichtbaar voor klant
        </span>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 p-3 space-y-3">
        {/* Berichten in de klantthread */}
        <div className="max-h-64 overflow-y-auto space-y-2">
          {threadId === undefined || (threadId && messages === undefined) ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            </div>
          ) : !threadId || !messages || messages.length === 0 ? (
            <p className="text-xs text-amber-800/70 dark:text-amber-200/60 py-2 text-center">
              Nog geen berichten in dit klantgesprek.
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m._id}
                className={cn(
                  "rounded-md px-3 py-2 text-sm max-w-[85%]",
                  m.senderType === "klant"
                    ? "bg-white dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800"
                    : "bg-amber-100 dark:bg-amber-900/70 ml-auto"
                )}
              >
                <p className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
                  {m.senderType === "klant" ? m.senderName : `${m.senderName} (kantoor)`}
                  <span className="font-normal text-amber-700/60 dark:text-amber-300/50 ml-2">
                    {formatTijd(m.createdAt)}
                  </span>
                </p>
                <p className="text-gray-900 dark:text-amber-50 whitespace-pre-wrap mt-0.5">
                  {m.message}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Composer — standaard INTERN */}
        <div
          className={cn(
            "rounded-md border p-2 space-y-2 transition-colors",
            naarKlant && isKantoor
              ? "border-amber-500 bg-amber-100/70 dark:bg-amber-900/40"
              : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
          )}
        >
          <div className="flex items-center gap-2 text-xs">
            {naarKlant && isKantoor ? (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300">
                <Eye className="h-3.5 w-3.5" />
                Dit bericht gaat NAAR DE KLANT
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-gray-600 dark:text-gray-300">
                <Lock className="h-3.5 w-3.5" />
                Intern — niet zichtbaar voor de klant
              </span>
            )}
            {isKantoor && (
              <div className="ml-auto flex items-center gap-1.5">
                <Switch
                  id="naar-klant-toggle"
                  checked={naarKlant}
                  onCheckedChange={setNaarKlant}
                  aria-label="Naar klant"
                />
                <Label
                  htmlFor="naar-klant-toggle"
                  className="text-xs text-gray-700 dark:text-gray-300"
                >
                  Naar klant
                </Label>
              </div>
            )}
          </div>
          <Textarea
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            placeholder={
              naarKlant && isKantoor
                ? "Bericht aan de klant..."
                : "Interne notitie (case-comment/tijdlijn)..."
            }
            rows={2}
            className="text-sm"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={busy || !tekst.trim()}
              className={cn(
                naarKlant && isKantoor
                  ? "bg-amber-500 hover:bg-amber-600 text-amber-950"
                  : undefined
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : naarKlant && isKantoor ? (
                <Send className="h-4 w-4 mr-1.5" />
              ) : (
                <Lock className="h-4 w-4 mr-1.5" />
              )}
              {naarKlant && isKantoor ? "Versturen naar klant..." : "Intern opslaan"}
            </Button>
          </div>
        </div>
      </div>

      {/* Handeling 2: aparte verstuurbevestiging */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Versturen naar de klant?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit bericht wordt direct zichtbaar in het klantenportaal en de
              klant kan een notificatie ontvangen. Controleer de inhoud goed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm whitespace-pre-wrap">
            {tekst.trim()}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void verstuurExtern();
              }}
              disabled={busy}
              className="bg-amber-500 hover:bg-amber-600 text-amber-950"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1.5" />
              )}
              Ja, verstuur naar klant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
