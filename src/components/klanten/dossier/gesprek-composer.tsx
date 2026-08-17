"use client";

/**
 * "Gesprek vastleggen" — de kernfunctie van het klantdossier (v7, WS4).
 *
 * Je typt in gewone taal wat er besproken is, en de app haalt daar de
 * vervolgacties uit. Twee harde productregels sturen dit hele scherm:
 *
 * 1. **Taken worden nooit zonder bevestiging aangemaakt.** De analyse doet
 *    vóórstellen; pas als je op "Vastleggen en taken aanmaken" drukt gaat er
 *    iets naar de takenlijst, en alleen wat er aangevinkt staat.
 * 2. **Vastleggen blokkeert nooit op de AI.** Duurt de analyse te lang
 *    (±8 s), faalt hij, of staat de sleutel niet in de env, dan wordt het
 *    gesprek gewoon vastgelegd met de melding dat er geen taken herkend zijn.
 *    Geen foutscherm, geen verloren notitie — de tekst die je typte is het
 *    dossier, de taakherkenning is een extraatje bovenop.
 *
 * De tijdlijn en de takenlijst eronder verversen zichzelf: `legGesprekVast`
 * schrijft in beide tabellen en Convex duwt dat via de bestaande queries door.
 */

import { useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { TaakCheckbox } from "@/components/taken/taak-checkbox";
import { cn } from "@/lib/utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/** De vier typechips uit het prototype, in dezelfde volgorde. */
const TYPES = ["Gebeld", "Gemaild", "Afspraak", "Notitie"] as const;
type GesprekType = (typeof TYPES)[number];

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

interface Voorstel {
  titel: string;
  deadline: string | null;
  confidence: number;
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
  const legVast = useMutation(api.tijdlijn.legGesprekVast);

  const [type, setType] = useState<GesprekType>("Gebeld");
  const [tekst, setTekst] = useState("");
  const [fase, setFase] = useState<"invoer" | "analyseren" | "voorstellen">(
    "invoer"
  );
  const [voorstellen, setVoorstellen] = useState<Voorstel[]>([]);
  const [aangevinkt, setAangevinkt] = useState<boolean[]>([]);
  const [bezig, setBezig] = useState(false);

  const tekstRef = useRef<HTMLTextAreaElement>(null);

  const bezigOfAnalyse = bezig || fase === "analyseren";

  /** Terug naar een leeg vel: het gesprek staat nu in de tijdlijn. */
  const herstel = () => {
    setTekst("");
    setVoorstellen([]);
    setAangevinkt([]);
    setFase("invoer");
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
    const { kanaal, eventType } = NAAR_TIJDLIJN[type];
    setBezig(true);
    try {
      await legVast({
        klantId,
        kanaal,
        eventType,
        tekst: tekst.trim(),
        taken,
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

  const handleVastleggen = async () => {
    if (!tekst.trim()) {
      showErrorToast("Vul eerst in wat er besproken is");
      tekstRef.current?.focus();
      return;
    }
    if (bezigOfAnalyse) return;

    setFase("analyseren");

    // De analyse mag het vastleggen nooit ophouden: na 8 seconden pakken we
    // door alsof er niets herkend is. De action loopt serverzijde gewoon uit,
    // maar niemand wacht er nog op.
    let uitkomst: { taken: Voorstel[]; herkend: boolean } | null = null;
    try {
      uitkomst = await Promise.race([
        analyseer({ klantId, tekst: tekst.trim(), type }),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), ANALYSE_TIMEOUT_MS)
        ),
      ]);
    } catch {
      uitkomst = null;
    }

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

  const aantalGekozen = aangevinkt.filter(Boolean).length;

  return (
    <SectiePaneel
      titel="Gesprek vastleggen"
      kopbalk
      gewicht="primair"
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
          {TYPES.map((waarde) => (
            <button
              key={waarde}
              type="button"
              role="radio"
              aria-checked={type === waarde}
              tabIndex={type === waarde ? 0 : -1}
              data-actief={type === waarde}
              onClick={() => setType(waarde)}
              className="inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card data-[actief=true]:border-primary/40 data-[actief=true]:bg-primary/10 data-[actief=true]:text-primary"
            >
              {waarde}
            </button>
          ))}
        </div>

        <textarea
          ref={tekstRef}
          value={tekst}
          rows={3}
          aria-label="Wat is er besproken?"
          placeholder="Wat is er besproken of afgesproken? Bijv: mevrouw wil een schetsontwerp zien, volgende week terugbellen en de offerte voor de vlonder sturen."
          disabled={fase === "voorstellen"}
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
            disabled={bezigOfAnalyse || fase === "voorstellen"}
          >
            {bezigOfAnalyse && <Loader2 className="size-3 animate-spin" />}
            Vastleggen
          </Button>
        </div>

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
              {voorstellen.length} voorgestelde{" "}
              {voorstellen.length === 1 ? "taak" : "taken"} gevonden
            </p>

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
