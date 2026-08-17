"use client";

/**
 * "Gesprek vastleggen" — de kernfunctie van het klantdossier (v7, WS4/WS5).
 *
 * Je typt in gewone taal wat er besproken is — of je neemt het gesprek op en
 * laat de app het uitwerken — en de app haalt daar de vervolgacties uit.
 * Harde productregels sturen dit hele scherm:
 *
 * 1. **Taken worden nooit zonder bevestiging aangemaakt.** De analyse doet
 *    vóórstellen; pas als je op "Vastleggen en taken aanmaken" drukt gaat er
 *    iets naar de takenlijst, en alleen wat er aangevinkt staat.
 * 2. **Vastleggen blokkeert nooit op de AI.** Duurt de analyse te lang
 *    (±8 s), faalt hij, of staat de sleutel niet in de env, dan wordt het
 *    gesprek gewoon vastgelegd met de melding dat er geen taken herkend zijn.
 *    Geen foutscherm, geen verloren notitie — de tekst die je typte is het
 *    dossier, de taakherkenning is een extraatje bovenop.
 * 3. **Geen opname zonder melding aan de klant** (WS5). De meldingszin staat
 *    in beeld en de opname start pas na een expliciete bevestiging dát je hem
 *    hebt uitgesproken. Er is geen andere weg naar `start`.
 * 4. **Een opname verdwijnt nooit stilletjes.** Lukt de transcriptie, dan is
 *    de tekst het dossier en wordt de audio bij het vastleggen verwijderd.
 *    Lukt hij niet, dan blijft de audio juist bewaard bij de entry en vraagt
 *    de app om het gesprek zelf uit te typen.
 *
 * Bewuste afwijking van het prototype: een uitgewerkte opname wordt níét
 * automatisch vastgelegd als de analyse geen taken vindt. Getypte tekst leest
 * de gebruiker zelf terug voor hij op Vastleggen drukt; een transcriptie niet.
 * De tijdlijn is append-only, dus een verhaspelde zin zou er voorgoed in
 * staan. De tekst landt daarom in het veld, met de vraag hem te controleren.
 *
 * De tijdlijn en de takenlijst eronder verversen zichzelf: `legGesprekVast`
 * schrijft in beide tabellen en Convex duwt dat via de bestaande queries door.
 */

import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import {
  CalendarDays,
  Loader2,
  Mail,
  Mic,
  Phone,
  Sparkles,
  Square,
  StickyNote,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { TaakCheckbox } from "@/components/taken/taak-checkbox";
import { cn } from "@/lib/utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import {
  formatOpnameTijd,
  useGesprekOpname,
  MAX_OPNAME_SEC,
  type OpnameOpbrengst,
} from "@/hooks/use-gesprek-opname";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/** De vier typechips uit het prototype, in dezelfde volgorde. */
const TYPES = ["Gebeld", "Gemaild", "Afspraak", "Notitie"] as const;
type GesprekType = (typeof TYPES)[number];

/**
 * Icoon per typechip (UI-les 1/5: iconen als ankers). Het icoon versterkt de
 * herkenning; het woord blijft de drager — nooit alleen een icoon.
 */
const TYPE_ICONEN: Record<GesprekType, typeof Phone> = {
  Gebeld: Phone,
  Gemaild: Mail,
  Afspraak: CalendarDays,
  Notitie: StickyNote,
};

/**
 * Vertaling van de UI-chip naar het datamodel. Gebeld/Gemaild hebben een eigen
 * kanaal; Afspraak en Notitie delen kanaal "intern" en worden uit elkaar
 * gehouden door het eventType — anders was een bezoek later niet meer terug
 * te vinden tussen de losse notities.
 */
const NAAR_TIJDLIJN: Record<
  GesprekType,
  { kanaal: "telefoon" | "email" | "intern"; eventType: "handmatig" | "afspraak" }
> = {
  Gebeld: { kanaal: "telefoon", eventType: "handmatig" },
  Gemaild: { kanaal: "email", eventType: "handmatig" },
  Afspraak: { kanaal: "intern", eventType: "afspraak" },
  Notitie: { kanaal: "intern", eventType: "handmatig" },
};

/** Hoe lang de gebruiker maximaal op de analyse wacht voor we doorpakken. */
const ANALYSE_TIMEOUT_MS = 8000;

/** Vanaf deze zekerheid staat een voorstel standaard aangevinkt. */
const DREMPEL_AANGEVINKT = 0.6;

/** De zin die de klant te horen krijgt vóór er ook maar iets opneemt. */
const MELDINGSZIN =
  "Ik zet je even op de luidspreker en neem het gesprek op zodat ik niks mis, is dat goed?";

interface Voorstel {
  titel: string;
  deadline: string | null;
  confidence: number;
}

/** Waar de opnameketen in staat; "uit" is het gewone tikscherm. */
type OpnameFase = "uit" | "melding" | "opnemen" | "uitwerken";

/**
 * Wat er van een afgeronde opname bij de entry hoort te belanden. `audioId`
 * blijft alleen staan bij een mislukte transcriptie; bij een geslaagde ruimt
 * `legGesprekVast` de audio op.
 */
interface OpnameInfo {
  duurSec: number;
  audioId: Id<"_storage"> | null;
  status: "gelukt" | "mislukt";
}

/** "2026-08-25" → "di 25 aug". Zonder datum blijft de kolom leeg. */
function formatDeadline(deadline: string | null): string | null {
  if (!deadline) return null;
  const datum = new Date(`${deadline}T12:00:00`);
  if (Number.isNaN(datum.getTime())) return null;
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(datum);
}

function takenZin(aantal: number): string {
  if (aantal === 0) return "Gesprek vastgelegd op de tijdlijn";
  return `Gesprek vastgelegd, ${aantal} ${aantal === 1 ? "taak" : "taken"} aangemaakt`;
}

export function GesprekComposer({ klantId }: { klantId: Id<"klanten"> }) {
  const analyseer = useAction(api.gesprekAnalyse.analyseer);
  const transcribeer = useAction(api.transcriptie.transcribeer);
  const legVast = useMutation(api.tijdlijn.legGesprekVast);
  const genereerUploadUrl = useMutation(api.tijdlijn.generateOpnameUploadUrl);
  const verwijderOpname = useMutation(api.tijdlijn.verwijderOpname);

  const [type, setType] = useState<GesprekType>("Gebeld");
  const [tekst, setTekst] = useState("");
  const [fase, setFase] = useState<"invoer" | "analyseren" | "voorstellen">(
    "invoer"
  );
  const [voorstellen, setVoorstellen] = useState<Voorstel[]>([]);
  const [aangevinkt, setAangevinkt] = useState<boolean[]>([]);
  const [bezig, setBezig] = useState(false);

  const [opnameFase, setOpnameFase] = useState<OpnameFase>("uit");
  const [opnameInfo, setOpnameInfo] = useState<OpnameInfo | null>(null);
  /** De uitgewerkte tekst, apart bewaard om hem in het analysepaneel te tonen. */
  const [transcriptie, setTranscriptie] = useState<string | null>(null);

  const tekstRef = useRef<HTMLTextAreaElement>(null);
  /**
   * Audio die al geüpload is maar nog bij geen enkele entry hoort. Navigeert
   * de gebruiker weg, dan ruimen we hem op — best effort, want een verweesd
   * bestand is minder erg dan een blokkade in de UI.
   */
  const hangendeAudioRef = useRef<Id<"_storage"> | null>(null);
  /**
   * Tekst waarvoor de analyse al gedraaid heeft zonder iets te vinden. Drukt
   * de gebruiker daarna op Vastleggen zonder er iets aan te veranderen, dan
   * stellen we niet nog een keer dezelfde vraag (en wacht hij niet nog eens).
   */
  const alGeanalyseerdRef = useRef<string | null>(null);

  const bezigOfAnalyse = bezig || fase === "analyseren";
  const opnameBezig = opnameFase !== "uit";

  /** Terug naar een leeg vel: het gesprek staat nu in de tijdlijn. */
  const herstel = () => {
    setTekst("");
    setVoorstellen([]);
    setAangevinkt([]);
    setFase("invoer");
    setOpnameInfo(null);
    setTranscriptie(null);
    setOpnameFase("uit");
    hangendeAudioRef.current = null;
    alGeanalyseerdRef.current = null;
    if (tekstRef.current) {
      tekstRef.current.style.height = "auto";
      tekstRef.current.focus();
    }
  };

  /**
   * De enige plek die schrijft. `taken` is leeg bij "Alleen gesprek
   * vastleggen" en bij elke terugval — de tekst gaat altijd mee.
   */
  const schrijf = async (
    taken: { titel: string; deadline?: string }[],
    melding?: string
  ) => {
    // Een opname is per definitie een telefoongesprek; de typechip mag daar
    // niets aan veranderen.
    const { kanaal, eventType } = opnameInfo
      ? { kanaal: "telefoon" as const, eventType: "handmatig" as const }
      : NAAR_TIJDLIJN[type];
    setBezig(true);
    try {
      await legVast({
        klantId,
        kanaal,
        eventType,
        tekst: tekst.trim(),
        taken,
        // Zonder opname exact dezelfde aanroep als voorheen.
        ...(opnameInfo
          ? {
              opnameDuurSec: opnameInfo.duurSec,
              transcriptieStatus: opnameInfo.status,
              // Alleen bij een mislukte transcriptie heeft de server nog iets
              // aan het id; bij "gelukt" gebruikt hij het om de audio op te
              // ruimen en bewaart hij het niet.
              ...(opnameInfo.audioId ? { audioId: opnameInfo.audioId } : {}),
            }
          : {}),
      });
      showSuccessToast(melding ?? takenZin(taken.length));
      herstel();
    } catch (fout) {
      showErrorToast(
        fout instanceof Error ? fout.message : "Gesprek vastleggen mislukt"
      );
      // Bewust géén herstel(): de getypte tekst is het enige wat de gebruiker
      // niet opnieuw kan maken, dus die blijft staan om het nog eens te proberen.
      setFase("invoer");
    } finally {
      setBezig(false);
    }
  };

  /**
   * De analyse met de vaste wachttijd eromheen. Geeft `null` bij een fout of
   * een te trage uitkomst; de action loopt serverzijde gewoon uit, maar
   * niemand wacht er nog op.
   */
  const vraagAnalyse = async (
    tekstWaarde: string,
    typeWaarde: GesprekType
  ): Promise<{ taken: Voorstel[]; herkend: boolean } | null> => {
    try {
      return await Promise.race([
        analyseer({ klantId, tekst: tekstWaarde, type: typeWaarde }),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), ANALYSE_TIMEOUT_MS)
        ),
      ]);
    } catch {
      return null;
    }
  };

  const handleVastleggen = async () => {
    const huidigeTekst = tekst.trim();
    if (!huidigeTekst) {
      showErrorToast("Vul eerst in wat er besproken is");
      tekstRef.current?.focus();
      return;
    }
    if (bezigOfAnalyse || opnameBezig) return;

    // Deze tekst is net al geanalyseerd (uitgewerkte opname zonder taken) en
    // sindsdien niet gewijzigd: meteen vastleggen.
    if (alGeanalyseerdRef.current === huidigeTekst) {
      await schrijf([]);
      return;
    }

    setFase("analyseren");
    const uitkomst = await vraagAnalyse(huidigeTekst, type);

    if (!uitkomst || !uitkomst.herkend || uitkomst.taken.length === 0) {
      await schrijf([], "Gesprek vastgelegd — geen taken herkend");
      return;
    }

    setVoorstellen(uitkomst.taken);
    setAangevinkt(uitkomst.taken.map((t) => t.confidence >= DREMPEL_AANGEVINKT));
    setFase("voorstellen");
  };

  const handleBevestig = async () => {
    const gekozen = voorstellen
      .filter((_, index) => aangevinkt[index])
      .map((v) => ({ titel: v.titel, deadline: v.deadline ?? undefined }));
    await schrijf(gekozen);
  };

  // ── Opnameketen ───────────────────────────────────────────────────────────

  const opnemer = useGesprekOpname();

  /** Opgenomen audio → storage. `null` als de upload niet lukt. */
  const uploadAudio = async (blob: Blob): Promise<Id<"_storage"> | null> => {
    try {
      const uploadUrl = await genereerUploadUrl();
      const reactie = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      });
      if (!reactie.ok) {
        throw new Error(`Upload mislukt met statuscode ${reactie.status}`);
      }
      const { storageId } = (await reactie.json()) as {
        storageId: Id<"_storage">;
      };
      return storageId;
    } catch (fout) {
      console.error("opname: upload mislukt", fout);
      return null;
    }
  };

  /** Upload → transcriptie → dezelfde analyse- en bevestigingsflow als tekst. */
  const werkOpnameUit = async ({ blob, duurSec }: OpnameOpbrengst) => {
    const audioId = await uploadAudio(blob);
    if (!audioId) {
      setOpnameFase("uit");
      showErrorToast(
        "De opname kon niet worden opgeslagen. Typ het gesprek zelf uit en leg het vast."
      );
      tekstRef.current?.focus();
      return;
    }
    hangendeAudioRef.current = audioId;

    let resultaat: { gelukt: boolean; tekst?: string };
    try {
      resultaat = await transcribeer({ audioId });
    } catch (fout) {
      // De action vangt zijn eigen fouten af; dit is het net eronder.
      console.error("opname: transcriptie-action gooide", fout);
      resultaat = { gelukt: false };
    }

    setOpnameFase("uit");
    setType("Gebeld");

    const uitgewerkt = resultaat.gelukt ? (resultaat.tekst ?? "").trim() : "";
    if (!uitgewerkt) {
      // De audio blijft staan en gaat straks mee naar de entry, zodat het
      // gesprek alsnog handmatig gelogd kan worden.
      setOpnameInfo({ duurSec, audioId, status: "mislukt" });
      showErrorToast(
        "Transcriptie mislukt — de opname is bewaard. Typ het gesprek zelf uit en leg het vast."
      );
      tekstRef.current?.focus();
      return;
    }

    setOpnameInfo({ duurSec, audioId, status: "gelukt" });
    setTekst(uitgewerkt);
    setTranscriptie(uitgewerkt);

    setFase("analyseren");
    const uitkomst = await vraagAnalyse(uitgewerkt, "Gebeld");

    if (!uitkomst || !uitkomst.herkend || uitkomst.taken.length === 0) {
      // Niet automatisch vastleggen: eerst mag de gebruiker de uitgewerkte
      // tekst nalezen (zie de kop van dit bestand).
      alGeanalyseerdRef.current = uitgewerkt;
      setFase("invoer");
      showSuccessToast("Opname uitgewerkt — lees na en leg vast");
      tekstRef.current?.focus();
      return;
    }

    setVoorstellen(uitkomst.taken);
    setAangevinkt(uitkomst.taken.map((t) => t.confidence >= DREMPEL_AANGEVINKT));
    setFase("voorstellen");
  };

  const stopEnWerkUit = async () => {
    setOpnameFase("uitwerken");
    const opbrengst = await opnemer.stop();
    if (!opbrengst) {
      setOpnameFase("uit");
      showErrorToast(
        "Er is niets opgenomen. Probeer het opnieuw of typ het gesprek zelf uit."
      );
      tekstRef.current?.focus();
      return;
    }
    await werkOpnameUit(opbrengst);
  };

  /**
   * Versie van `stopEnWerkUit` die het 30-minuten-effect hieronder kan
   * aanroepen zonder dat de hele keten gememoïseerd hoeft te worden.
   */
  const stopEnWerkUitRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    stopEnWerkUitRef.current = stopEnWerkUit;
  });

  const startOpname = async () => {
    const uitkomst = await opnemer.start();
    if (!uitkomst.gestart) {
      setOpnameFase("uit");
      showErrorToast(
        uitkomst.fout === "geweigerd"
          ? "Geen toegang tot de microfoon. Sta opnemen toe in je browser en probeer het opnieuw."
          : "Opnemen kan niet in deze browser. Typ het gesprek zelf uit."
      );
      return;
    }
    setOpnameFase("opnemen");
  };

  const annuleerOpname = () => {
    opnemer.annuleer();
    setOpnameFase("uit");
  };

  // Een half uur is de grens: daarboven is het geen gesprek meer maar een
  // vergeten tabblad. Afkappen gaat langs precies dezelfde weg als Stop, dus
  // de opname is niet weg — hij wordt meteen uitgewerkt.
  const secondenLoopt = opnemer.seconden;
  useEffect(() => {
    if (opnameFase !== "opnemen" || secondenLoopt < MAX_OPNAME_SEC) return;
    showErrorToast("Opname gestopt na 30 minuten — hij wordt nu uitgewerkt.");
    void stopEnWerkUitRef.current();
  }, [opnameFase, secondenLoopt]);

  // Wegnavigeren met een opname die nog nergens bij hoort: opruimen.
  useEffect(() => {
    return () => {
      const audioId = hangendeAudioRef.current;
      if (audioId) {
        hangendeAudioRef.current = null;
        void verwijderOpname({ audioId }).catch(() => {
          // Best effort; er is geen scherm meer om iets op te melden.
        });
      }
    };
  }, [verwijderOpname]);

  const aantalGekozen = aangevinkt.filter(Boolean).length;
  const opnameDuurLabel = opnameInfo
    ? formatOpnameTijd(opnameInfo.duurSec)
    : null;

  return (
    <SectiePaneel
      titel="Gesprek vastleggen"
      kopbalk
      acties={
        <span className="truncate text-xs text-muted-foreground @max-[30rem]/sectie:hidden">
          taken worden automatisch herkend
        </span>
      }
    >
      <div className="px-3 py-2.5">
        {/* Typechips: één keuze, dus radiogroup — niet vier losse knoppen. */}
        <div
          role="radiogroup"
          aria-label="Soort contact"
          className="flex flex-wrap items-center gap-1.5"
        >
          {TYPES.map((waarde) => {
            const Icoon = TYPE_ICONEN[waarde];
            return (
              <button
                key={waarde}
                type="button"
                role="radio"
                aria-checked={type === waarde}
                tabIndex={type === waarde ? 0 : -1}
                data-actief={type === waarde}
                onClick={() => setType(waarde)}
                // Prototype-gedrag (UI-les 3): gekozen = vól primary met witte
                // tekst, hover op de rest = gekleurde rand — geen tintvlakje.
                className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card data-[actief=true]:border-primary data-[actief=true]:bg-primary data-[actief=true]:text-primary-foreground"
              >
                <Icoon className="size-3.5" aria-hidden />
                {waarde}
              </button>
            );
          })}
        </div>

        {opnameInfo && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-tight text-muted-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-foreground">
              <Mic className="size-2.5" aria-hidden />
              OPNAME · <span className="tabular-nums">{opnameDuurLabel}</span>
            </span>
            {opnameInfo.status === "gelukt"
              ? "Uitgewerkt uit de opname — lees na en pas aan waar nodig."
              : "Transcriptie mislukt; de opname blijft bewaard bij dit gesprek. Typ zelf uit wat er besproken is."}
          </p>
        )}

        <textarea
          ref={tekstRef}
          value={tekst}
          rows={3}
          aria-label="Wat is er besproken?"
          placeholder="Wat is er besproken of afgesproken? Bijv: mevrouw wil een schetsontwerp zien, volgende week terugbellen en de offerte voor de vlonder sturen."
          disabled={fase === "voorstellen" || opnameFase === "opnemen"}
          style={{ maxHeight: "14rem" }}
          onChange={(e) => setTekst(e.target.value)}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void handleVastleggen();
            }
          }}
          className="mt-2 w-full resize-none overflow-y-auto rounded-md border bg-background px-2.5 py-2 text-sm leading-snug outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        />

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="min-w-0 flex-1 text-[11px] leading-tight text-muted-foreground">
            Noem acties zoals terugbellen, offerte sturen of afspraak plannen,
            dan staan ze direct klaar als taak.
          </span>
          <Button
            size="xs"
            className="ml-auto h-8 min-h-0 shrink-0 sm:h-8"
            onClick={() => void handleVastleggen()}
            disabled={bezigOfAnalyse || fase === "voorstellen" || opnameBezig}
          >
            {bezigOfAnalyse && <Loader2 className="size-3 animate-spin" />}
            Vastleggen
          </Button>
        </div>

        {/* ── Opnemen ──────────────────────────────────────────────────────
            Eigen rij met bovenrand, zoals in het prototype: de opname is een
            tweede weg naar hetzelfde vastleggen, geen variant van de knop. */}
        {fase === "invoer" && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3">
            <Button
              variant="outline"
              size="xs"
              className="h-8 min-h-0 shrink-0 sm:h-8"
              onClick={() => setOpnameFase("melding")}
              disabled={bezig || opnameBezig}
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full bg-destructive"
              />
              Gesprek opnemen
            </Button>
            <span className="min-w-0 flex-1 text-[11px] leading-tight text-muted-foreground">
              Zet de klant op de luidspreker, de app neemt op en werkt het
              gesprek voor je uit.
            </span>
          </div>
        )}

        {opnameBezig && (
          <div className="mt-3 rounded-lg border bg-card p-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200">
            {/* Zonder melding geen opname — deze notice blijft staan zolang
                het paneel open is, ook tijdens het opnemen zelf. */}
            <div className="flex items-start gap-2 rounded-md border border-accent-warm/40 bg-surface-aandacht px-3 py-2.5 text-[13px] leading-snug text-foreground">
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-accent-warm"
                aria-hidden
              />
              <p>
                <strong className="font-semibold">
                  Meld de opname eerst aan de klant.
                </strong>{" "}
                Bijvoorbeeld: “{MELDINGSZIN}” Zonder melding geen opname.
              </p>
            </div>

            {opnameFase === "melding" && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Button
                  size="xs"
                  className="h-8 min-h-0 sm:h-8"
                  onClick={() => void startOpname()}
                >
                  Melding gedaan, start opname
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-8 min-h-0 sm:h-8"
                  onClick={annuleerOpname}
                >
                  Annuleren
                </Button>
              </div>
            )}

            {opnameFase === "opnemen" && (
              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full bg-destructive motion-safe:animate-pulse"
                />
                <span
                  role="status"
                  aria-label={`Opname loopt, ${formatOpnameTijd(opnemer.seconden)}`}
                  className="text-lg font-semibold tabular-nums text-foreground"
                >
                  {formatOpnameTijd(opnemer.seconden)}
                </span>
                <Button
                  variant="destructive"
                  size="xs"
                  className="ml-auto h-8 min-h-0 sm:h-8"
                  onClick={() => void stopEnWerkUit()}
                >
                  <Square className="size-3 fill-current" aria-hidden />
                  Stop
                </Button>
              </div>
            )}

            {opnameFase === "uitwerken" && (
              <div className="mt-2.5 flex items-center gap-2 text-[13px] font-medium text-foreground">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse"
                />
                <span role="status">Opname wordt uitgewerkt…</span>
              </div>
            )}
          </div>
        )}

        {fase === "analyseren" && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-[13px] font-medium text-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-150">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse"
            />
            <span role="status">Gesprek wordt geanalyseerd…</span>
          </div>
        )}

        {fase === "voorstellen" && (
          <div className="mt-3 rounded-lg border bg-card p-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
              <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden />
              {transcriptie && opnameDuurLabel
                ? `Opname uitgewerkt (${opnameDuurLabel}), `
                : ""}
              {voorstellen.length} voorgestelde{" "}
              {voorstellen.length === 1 ? "taak" : "taken"} gevonden
            </p>

            {transcriptie && (
              <p className="mt-2 max-h-40 overflow-y-auto rounded-md border bg-muted/40 px-2.5 py-2 text-[12.5px] leading-snug text-muted-foreground">
                {transcriptie}
              </p>
            )}

            <ul className="mt-2 space-y-1.5">
              {voorstellen.map((voorstel, index) => {
                const deadline = formatDeadline(voorstel.deadline);
                return (
                  <li key={`${voorstel.titel}-${index}`}>
                    <label
                      className={cn(
                        "flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors hover:bg-muted/40",
                        aangevinkt[index] ? "border-primary/35" : "border-border"
                      )}
                    >
                      <TaakCheckbox
                        checked={Boolean(aangevinkt[index])}
                        onCheckedChange={(waarde) =>
                          setAangevinkt((huidig) =>
                            huidig.map((aan, i) =>
                              i === index ? waarde === true : aan
                            )
                          )
                        }
                        aria-label={voorstel.titel}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] leading-snug">
                        {voorstel.titel}
                      </span>
                      {deadline && (
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {deadline}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button
                size="xs"
                className="h-8 min-h-0 sm:h-8"
                onClick={() => void handleBevestig()}
                disabled={bezig || aantalGekozen === 0}
              >
                {bezig && <Loader2 className="size-3 animate-spin" />}
                Vastleggen en taken aanmaken
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="h-8 min-h-0 sm:h-8"
                onClick={() => void schrijf([])}
                disabled={bezig}
              >
                Alleen gesprek vastleggen
              </Button>
            </div>
          </div>
        )}
      </div>
    </SectiePaneel>
  );
}
