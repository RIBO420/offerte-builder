import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

/**
 * Eén payload voedt alle vier de secties — dus ook één type. Afgeleid van de
 * query zelf, zodat een wijziging in `convex/rapportage.ts` hier een typefout
 * geeft in plaats van een `undefined` in beeld.
 */
export type Rapportage = FunctionReturnType<
  typeof api.rapportage.getRapportage
>;

export type Periode = Rapportage["periode"];
export type HoeLoopt = Rapportage["hoeLoopt"];
export type Pipeline = Rapportage["pipeline"];
export type GeldLigt = Rapportage["geldLigt"];
export type BesteWerk = Rapportage["besteWerk"];

export type VoorNacalculatieDetail = FunctionReturnType<
  typeof api.rapportage.getVoorNacalculatieDetail
>;
