"use node";

/**
 * Opgenomen gesprek → tekst (klantdossier v7, WS5).
 *
 * De opname staat op dat moment als audio-blob in Convex storage; deze action
 * haalt hem eruit, stuurt hem naar Deepgram en geeft de Nederlandse tekst
 * terug. Meer doet hij niet: hij schrijft niets, verwijdert niets en maakt
 * geen taak aan. Het vastleggen (en het opruimen van de audio) gebeurt pas in
 * `tijdlijn.legGesprekVast`, ná bevestiging door de gebruiker.
 *
 * ── Harde productregels uit de klantbriefing ──────────────────────────────
 * 1. **Nooit stil dataverlies.** Faalt de transcriptie — geen sleutel, API
 *    plat, lege uitvoer — dan geven we `{gelukt: false}` terug en gooien we
 *    niets richting de client. De audio blijft dan staan, de UI vraagt om het
 *    gesprek zelf uit te typen, en `legGesprekVast` bewaart de audio bij de
 *    entry (`transcriptieStatus: "mislukt"`). Alleen een auth-fout gooit wél:
 *    dat is een programmeerfout aan onze kant, geen storing.
 * 2. **Geen foutscherm.** Elke terugval hierboven is voor de gebruiker één
 *    rustige melding; het verschil zit alleen in onze logs.
 *
 * "use node" is hier nodig omdat we de blob als ArrayBuffer doorsturen; de
 * REST-API van Deepgram is één POST, dus er komt bewust géén SDK aan te pas
 * (scheelt een dependency én een bundelrisico).
 *
 * De sleutel (`DEEPGRAM_API_KEY`) staat in de Convex-env — zelfde patroon als
 * ANTHROPIC_API_KEY in `gesprekAnalyse.ts` — en komt de client nooit binnen.
 */

import { v, ConvexError } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Nova-2 is Deepgrams beste model met échte Nederlandse ondersteuning;
 * `smart_format` levert hoofdletters, leestekens en nette getallen op, wat
 * het verschil is tussen een leesbaar dossier en een woordenbrij.
 */
const DEEPGRAM_URL =
  "https://api.deepgram.com/v1/listen?model=nova-2&language=nl&smart_format=true&punctuate=true";

/** Eén hele lange klantopname is ~30 min; ruim boven wat wij toestaan. */
const MAX_BYTES = 200 * 1024 * 1024;

/** Deepgram doet een half uur audio ruim binnen deze tijd. */
const TIMEOUT_MS = 120_000;

export type TranscriptieResultaat =
  | { gelukt: true; tekst: string }
  | { gelukt: false };

const MISLUKT: TranscriptieResultaat = { gelukt: false };

/**
 * Een action heeft geen `ctx.db`, dus de rolcheck loopt via een query —
 * zelfde patroon en dezelfde eis als `gesprekAnalyse.analyseer`: alleen
 * kantoor (directie of projectleider) legt gesprekken vast, dus alleen
 * kantoor mag transcriberen. Elke call kost geld op de sleutel van de
 * app-eigenaar.
 */
async function bewaakToegang(ctx: ActionCtx): Promise<void> {
  const identiteit = await ctx.auth.getUserIdentity();
  if (!identiteit) {
    throw new ConvexError("Niet ingelogd");
  }

  const rol = await ctx.runQuery(api.roles.getCurrentUserRole, {});
  if (!rol || !(rol.isAdmin || rol.isProjectleider)) {
    throw new ConvexError(
      "Alleen kantoor (directie of projectleider) mag opnames laten uitwerken"
    );
  }
}

/** De transcriptie uit het Deepgram-antwoord peuteren, defensief. */
export function leesTranscript(ruw: unknown): string {
  if (!ruw || typeof ruw !== "object") return "";
  const kanalen = (
    ruw as { results?: { channels?: unknown } }
  ).results?.channels;
  if (!Array.isArray(kanalen) || kanalen.length === 0) return "";
  const alternatieven = (kanalen[0] as { alternatives?: unknown })?.alternatives;
  if (!Array.isArray(alternatieven) || alternatieven.length === 0) return "";
  const transcript = (alternatieven[0] as { transcript?: unknown })?.transcript;
  return typeof transcript === "string" ? transcript.trim() : "";
}

/**
 * Eén POST naar Deepgram, met een timeout eromheen. Gooit bij een netwerk- of
 * serverfout, zodat de aanroeper kan besluiten het nog één keer te proberen.
 */
async function vraagDeepgram(
  audio: ArrayBuffer,
  contentType: string,
  apiKey: string
): Promise<string> {
  const afbreker = new AbortController();
  const klok = setTimeout(() => afbreker.abort(), TIMEOUT_MS);
  try {
    const antwoord = await fetch(DEEPGRAM_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": contentType,
      },
      body: audio,
      signal: afbreker.signal,
    });

    if (!antwoord.ok) {
      // 5xx en 429 zijn het proberen waard; 4xx is een fout van ons (verkeerde
      // sleutel, niet-ondersteund formaat) en heeft geen tweede poging nodig.
      const herhaalbaar = antwoord.status >= 500 || antwoord.status === 429;
      const fout = new Error(
        `Deepgram gaf status ${antwoord.status}`
      ) as Error & { herhaalbaar?: boolean };
      fout.herhaalbaar = herhaalbaar;
      throw fout;
    }

    return leesTranscript(await antwoord.json());
  } finally {
    clearTimeout(klok);
  }
}

export const transcribeer = action({
  args: { audioId: v.id("_storage") },
  handler: async (ctx, args): Promise<TranscriptieResultaat> => {
    await bewaakToegang(ctx);

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      // Geen sleutel in deze deployment: de opname blijft bewaard en de
      // gebruiker typt het gesprek zelf uit. Geen foutscherm.
      console.warn(
        "transcriptie: DEEPGRAM_API_KEY ontbreekt — opname niet uitgewerkt"
      );
      return MISLUKT;
    }

    let audio: ArrayBuffer;
    let contentType = "audio/webm";
    try {
      const blob = await ctx.storage.get(args.audioId);
      if (!blob) {
        console.warn("transcriptie: audio niet gevonden in storage");
        return MISLUKT;
      }
      if (blob.size === 0 || blob.size > MAX_BYTES) {
        console.warn(`transcriptie: onbruikbare audiogrootte (${blob.size})`);
        return MISLUKT;
      }
      if (blob.type) contentType = blob.type;
      audio = await blob.arrayBuffer();
    } catch (fout) {
      console.error("transcriptie: audio ophalen mislukt", fout);
      return MISLUKT;
    }

    // Eén herkansing bij een netwerk- of serverstoring: dat is precies het
    // soort fout dat de tweede keer wél lukt. Meer proberen laat de gebruiker
    // alleen langer wachten op een uitkomst die er niet komt.
    for (let poging = 1; poging <= 2; poging++) {
      try {
        const tekst = await vraagDeepgram(audio, contentType, apiKey);
        if (!tekst) {
          console.warn("transcriptie: Deepgram gaf een lege transcriptie");
          return MISLUKT;
        }
        return { gelukt: true, tekst };
      } catch (fout) {
        // Een afgebroken poging (timeout) niet herhalen: dan staat de
        // gebruiker nog eens twee minuten te wachten op hetzelfde antwoord.
        const herhaalbaar =
          poging === 1 &&
          (fout as { herhaalbaar?: boolean })?.herhaalbaar !== false &&
          (fout as Error)?.name !== "AbortError";
        console.error(
          `transcriptie: poging ${poging} mislukt${herhaalbaar ? ", nog één keer" : ""}`,
          fout
        );
        if (!herhaalbaar) return MISLUKT;
      }
    }

    return MISLUKT;
  },
});
