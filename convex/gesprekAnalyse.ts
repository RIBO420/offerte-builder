"use node";

/**
 * Taakherkenning in een vastgelegd gesprek (klantdossier v7, WS4).
 *
 * LET OP — "use node" is verplicht: `@anthropic-ai/sdk` laadt `node:fs` en
 * `node:path` voor zijn credential-lezers, en die bestaan niet in de standaard
 * Convex-runtime (bundelen faalt dan meteen). Dit bestand bevat daarom alleen
 * deze action; queries en mutations kunnen hier niet bij.
 *
 * ── Twee harde productregels uit de klantbriefing ─────────────────────────
 * 1. Deze action MAAKT NOOIT EEN TAAK AAN. Hij geeft alleen vóórstellen terug;
 *    pas `tijdlijn.legGesprekVast` schrijft, en alleen wat de gebruiker heeft
 *    aangevinkt.
 * 2. Vastleggen mag nooit blokkeren op de AI. Ontbreekt de API-sleutel, faalt
 *    de call, of komt er onzin terug, dan geven we `{taken: [], herkend: false}`
 *    terug — geen throw. De client legt het gesprek dan gewoon vast met de
 *    rustige melding "geen taken herkend". Alleen een auth-fout gooit wél,
 *    want dat is een programmeerfout aan onze kant, geen AI-storing.
 *
 * De sleutel (`ANTHROPIC_API_KEY`) staat in de Convex-env en komt de client
 * nooit binnen — zelfde patroon als `convex/places.ts` met GOOGLE_MAPS_API_KEY.
 */

import { v, ConvexError } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { action, type ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { tijdlijnGesprekTypeValidator, type GesprekType } from "./validators";

/**
 * Haiku is hier de juiste keus: één korte tekst, een handvol taken eruit, en
 * de gebruiker staat te wachten. Geen thinking, lage max_tokens.
 */
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 700;
/** Meer dan vijf voorstellen is geen hulp meer maar een tweede takenlijst. */
const MAX_TAKEN = 5;
/** Ruwe bovengrens op de invoer; een gesprek van 20k tekens is geen gesprek. */
const MAX_TEKST = 8000;
const MAX_TITEL = 120;
const DEADLINE_PATROON = /^\d{4}-\d{2}-\d{2}$/;

export interface TaakVoorstel {
  titel: string;
  /** YYYY-MM-DD, of null als er geen datum in het gesprek zat. */
  deadline: string | null;
  /** 0..1 — de UI vinkt ≥ 0,6 standaard aan. */
  confidence: number;
}

export interface AnalyseResultaat {
  taken: TaakVoorstel[];
  /**
   * False bij elke terugval (geen sleutel, API-fout, onleesbare uitvoer).
   * De UI toont dan "geen taken herkend" in plaats van een foutscherm — het
   * verschil met `taken: []` én `herkend: true` (de AI heeft gekeken en niets
   * gevonden) is voor ons alleen zichtbaar in de logs.
   */
  herkend: boolean;
}

const GEEN_TAKEN: AnalyseResultaat = { taken: [], herkend: false };

/** Wat de UI-typechip betekent in de prompt. */
const TYPE_OMSCHRIJVING: Record<GesprekType, string> = {
  Gebeld: "een telefoongesprek met de klant",
  Gemaild: "een e-mailwisseling met de klant",
  Afspraak: "een afspraak of bezoek bij de klant",
  Notitie: "een interne notitie over deze klant",
};

/**
 * Datum van vandaag in Europe/Amsterdam als YYYY-MM-DD.
 *
 * Convex draait in UTC; zonder deze omrekening zou "volgende week dinsdag"
 * tussen 00:00 en 02:00 Nederlandse tijd een dag te vroeg uitkomen.
 * `en-CA` geeft precies het ISO-formaat terug.
 */
function vandaagAmsterdam(nu: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nu);
}

/** Nederlandse weekdagnaam van vandaag, zodat "volgende week dinsdag" klopt. */
function weekdagAmsterdam(nu: Date = new Date()): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
  }).format(nu);
}

/**
 * De komende veertien dagen als "dinsdag 2026-08-25"-regels. Alleen de datum
 * van vandaag meegeven bleek niet genoeg: het model rekende "volgende week
 * dinsdag" een dag mis (gemeten: wo 26 aug i.p.v. di 25 aug). Met dit lijstje
 * is omrekenen opzoeken in plaats van rekenen — daar maakt een klein model
 * geen fouten in.
 */
export function kalenderAmsterdam(nu: Date = new Date(), dagen = 14): string[] {
  const uit: string[] = [];
  for (let i = 1; i <= dagen; i++) {
    const dag = new Date(nu.getTime() + i * 24 * 60 * 60 * 1000);
    uit.push(`${weekdagAmsterdam(dag)} ${vandaagAmsterdam(dag)}`);
  }
  return uit;
}

/**
 * Systeemprompt. Bewust kort en concreet: het model hoeft niets te bedenken,
 * alleen te herkennen. De datum staat erin omdat "volgende week dinsdag"
 * anders niet om te rekenen is.
 */
export function bouwSysteemPrompt(
  vandaag: string,
  weekdag: string,
  kalender: string[] = []
): string {
  return [
    "Je bent de assistent van een Nederlands hoveniersbedrijf (Top Tuinen).",
    "Je leest een kort verslag van klantcontact en haalt daar de concrete",
    "vervolgacties uit die het kantoor nog moet doen.",
    "",
    `Vandaag is het ${weekdag} ${vandaag} (Europe/Amsterdam).`,
    "Reken elke datumaanduiding in de tekst hiernaar om:",
    '"morgen", "volgende week dinsdag", "eind van de maand", "over twee weken".',
    "Staat er geen datum in de tekst, dan is de deadline null — verzin er geen.",
    ...(kalender.length
      ? [
          "Gebruik dit overzicht van de komende dagen en zoek de datum erin op",
          "in plaats van zelf te rekenen:",
          ...kalender.map((regel) => `  ${regel}`),
        ]
      : []),
    "",
    "Regels:",
    `- Maximaal ${MAX_TAKEN} taken. Liever te weinig dan te veel.`,
    "- Alleen acties voor het kantoor zelf. Wat de klant gaat doen is geen taak.",
    "- Alleen wat er echt staat. Verzin geen vervolgstappen die niet besproken zijn.",
    "- Is er niets afgesproken (puur een verslag of een mededeling)? Geef dan een lege lijst.",
    "- Titels kort en gebiedend, maximaal acht woorden, zonder punt aan het eind:",
    '  "Terugbellen over ontwerp", "Offerte vlonder versturen", "Afspraak inplannen om op te meten".',
    "- Schrijf de titel in het Nederlands.",
    "- confidence: 1.0 als de actie letterlijk is afgesproken, rond 0.5 als je hem",
    "  afleidt uit de context, lager als je twijfelt.",
    "",
    "Geef je antwoord uitsluitend via het gereedschap noteer_taken.",
  ].join("\n");
}

/** Gebruikersbericht: het gesprekstype plus de letterlijke tekst. */
export function bouwGebruikersPrompt(type: GesprekType, tekst: string): string {
  return [
    `Dit is ${TYPE_OMSCHRIJVING[type]}.`,
    "",
    "Verslag:",
    tekst,
  ].join("\n");
}

/** Het schema dat de JSON afdwingt — tool-use is robuuster dan "geef JSON". */
const TAKEN_TOOL = {
  name: "noteer_taken",
  description:
    "Noteer de vervolgacties die uit dit klantcontact volgen. Geef een lege lijst als er niets af te handelen valt.",
  input_schema: {
    type: "object" as const,
    properties: {
      taken: {
        type: "array",
        maxItems: MAX_TAKEN,
        items: {
          type: "object",
          properties: {
            titel: {
              type: "string",
              description:
                "Korte, gebiedende omschrijving van de actie, bijv. 'Terugbellen over ontwerp'.",
            },
            deadline: {
              type: ["string", "null"],
              description:
                "Datum in het formaat JJJJ-MM-DD, of null als er geen datum genoemd is.",
            },
            confidence: {
              type: "number",
              description: "Hoe zeker deze actie is afgesproken, 0 tot en met 1.",
            },
          },
          required: ["titel", "deadline", "confidence"],
          additionalProperties: false,
        },
      },
    },
    required: ["taken"],
    additionalProperties: false,
  },
};

/**
 * Uitvoer van het model valideren. Alles wat niet klopt gaat eruit in plaats
 * van de hele analyse te laten mislukken: één rare regel mag de andere vier
 * niet weggooien.
 */
export function valideerTaken(ruw: unknown): TaakVoorstel[] {
  if (!ruw || typeof ruw !== "object") return [];
  const lijst = (ruw as { taken?: unknown }).taken;
  if (!Array.isArray(lijst)) return [];

  const uit: TaakVoorstel[] = [];
  for (const item of lijst) {
    if (!item || typeof item !== "object") continue;
    const kandidaat = item as {
      titel?: unknown;
      deadline?: unknown;
      confidence?: unknown;
    };

    if (typeof kandidaat.titel !== "string") continue;
    const titel = kandidaat.titel.trim().slice(0, MAX_TITEL);
    if (!titel) continue;

    const deadline =
      typeof kandidaat.deadline === "string" &&
      DEADLINE_PATROON.test(kandidaat.deadline.trim())
        ? kandidaat.deadline.trim()
        : null;

    const ruweConfidence =
      typeof kandidaat.confidence === "number" &&
      Number.isFinite(kandidaat.confidence)
        ? kandidaat.confidence
        : 0.5;
    const confidence = Math.min(1, Math.max(0, ruweConfidence));

    uit.push({ titel, deadline, confidence });
    if (uit.length >= MAX_TAKEN) break;
  }
  return uit;
}

/**
 * Een action heeft geen `ctx.db`, dus de rolcheck loopt via een query —
 * zelfde patroon als `places.bewaakToegang`. De eis is dezelfde als bij
 * `tijdlijn.voegEntryToe`: alleen kantoor (directie of projectleider) legt
 * gesprekken vast, dus alleen kantoor mag de analyse aanroepen. Elke call
 * kost geld op de sleutel van de app-eigenaar.
 */
async function bewaakToegang(ctx: ActionCtx): Promise<void> {
  const identiteit = await ctx.auth.getUserIdentity();
  if (!identiteit) {
    throw new ConvexError("Niet ingelogd");
  }

  const rol = await ctx.runQuery(api.roles.getCurrentUserRole, {});
  if (!rol || !(rol.isAdmin || rol.isProjectleider)) {
    throw new ConvexError(
      "Alleen kantoor (directie of projectleider) mag gesprekken laten analyseren"
    );
  }
}

export const analyseer = action({
  args: {
    klantId: v.id("klanten"),
    tekst: v.string(),
    type: tijdlijnGesprekTypeValidator,
  },
  handler: async (ctx, args): Promise<AnalyseResultaat> => {
    await bewaakToegang(ctx);

    const tekst = args.tekst.trim().slice(0, MAX_TEKST);
    if (!tekst) return GEEN_TAKEN;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Geen sleutel in deze deployment: vastleggen moet gewoon doorgaan.
      console.warn(
        "gesprekAnalyse: ANTHROPIC_API_KEY ontbreekt — taakherkenning overgeslagen"
      );
      return GEEN_TAKEN;
    }

    try {
      const client = new Anthropic({ apiKey });
      const nu = new Date();
      const antwoord = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: bouwSysteemPrompt(
          vandaagAmsterdam(nu),
          weekdagAmsterdam(nu),
          kalenderAmsterdam(nu)
        ),
        tools: [TAKEN_TOOL],
        // Dwingt het model in het schema: geen vrije tekst, altijd deze vorm.
        tool_choice: { type: "tool", name: TAKEN_TOOL.name },
        messages: [
          { role: "user", content: bouwGebruikersPrompt(args.type, tekst) },
        ],
      });

      const blok = antwoord.content.find((b) => b.type === "tool_use");
      if (!blok || blok.type !== "tool_use") {
        console.warn("gesprekAnalyse: geen tool_use-blok in het antwoord");
        return GEEN_TAKEN;
      }

      return { taken: valideerTaken(blok.input), herkend: true };
    } catch (fout) {
      // Nooit doorgooien naar de client: het gesprek moet vastgelegd kunnen
      // worden ook als Anthropic plat ligt, traag is of een 429 geeft.
      console.error("gesprekAnalyse: analyse mislukt", fout);
      return GEEN_TAKEN;
    }
  },
});
