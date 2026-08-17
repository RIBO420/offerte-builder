"use client";

/**
 * Dunne adapter naar `convex/urenControle.*` (plan §2).
 *
 * WS-A bouwt die module parallel. Zolang `convex/_generated/api.d.ts` hem niet
 * kent — codegen loopt pas als `convex dev` draait — kan de UI hem niet via
 * `api.urenControle.getControleWeek` importeren zonder de typecheck te breken.
 * Deze module lost dat op zonder ergens een `any` te laten staan:
 *
 * 1. Staat de module al in de gegenereerde `api`, dan pakken we die referentie.
 *    Dat gebeurt automatisch na de eerstvolgende codegen; er hoeft dan niets
 *    aan de UI te veranderen.
 * 2. Zo niet, dan maken we de referentie op naam met `makeFunctionReference`.
 *    Dat is dezelfde soort referentie als de gegenereerde (`convex/server`
 *    kent hem als eersteklas API), dus `useQuery`/`useMutation` werken
 *    normaal. Bestaat de functie op de deployment nog niet, dan faalt de
 *    query — en dat vangt de `DataFetchErrorBoundary` op de pagina op met een
 *    eerlijke melding, in plaats van een leeg scherm.
 *
 * TODO(WS-A): **opruimen zodra `urenControle` in de gegenereerde api staat** —
 * dit bestand kan dan vervangen worden door
 * drie directe verwijzingen naar `api.urenControle.*`. De componenten raken dat
 * niet aan; die typen op `controle-types.ts`.
 */

import {
  makeFunctionReference,
  type FunctionReference,
} from "convex/server";
import { api } from "@convex/_generated/api";
import type { ControleWeek } from "./controle-types";

/** Wat er van `api.urenControle` bekend is (nog niets, of alles). */
const controleModule = (api as unknown as Record<string, unknown>)
  .urenControle as Record<string, unknown> | undefined;

/**
 * Kent de gegenereerde API de module al? Alleen bedoeld voor meldingen en
 * tests — de referenties hieronder werken in beide gevallen.
 */
export const CONTROLE_IN_GENERATED_API = controleModule !== undefined;

function referentie<T>(naam: string): T {
  return (controleModule?.[naam] ??
    makeFunctionReference(`urenControle:${naam}`)) as T;
}

export const getControleWeekRef =
  referentie<
    FunctionReference<"query", "public", { weekStart: string }, ControleWeek>
  >("getControleWeek");

export const keurDagGoedRef =
  referentie<
    FunctionReference<
      "mutation",
      "public",
      { medewerkerId: string; datum: string },
      null
    >
  >("keurDagGoed");

export const keurWeekGoedRef =
  referentie<
    FunctionReference<
      "mutation",
      "public",
      { weekStart: string },
      { gekweten: number } | null
    >
  >("keurWeekGoed");
