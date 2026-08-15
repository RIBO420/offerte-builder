/**
 * Harde acceptatie-validatie (PRD §2.5 "Overgang naar de keten").
 *
 * Een offerte kan nooit op "geaccepteerd" zonder dat er ten minste één
 * werkitem uit voortkomt — harde validatie, geen herinnering. Pure module
 * (geen server-imports) zodat de beslisregels unit-testbaar zijn; de
 * status-mutation in convex/offertes.ts voert het besluit uit.
 */

export interface AcceptatieContext {
  type: "aanleg" | "onderhoud";
  bron?: "wizard" | "vrij";
  /** Er is al ≥1 werkitem (projecten-rij) aan deze offerte gekoppeld */
  heeftWerkitem: boolean;
  /** Er is al een onderhoudscontract uit deze offerte voortgekomen */
  heeftContract: boolean;
  /** Aantal catalogus-bouwsteenregels (route 1 / contract-koppeling) */
  aantalBouwsteenRegels: number;
  /** Er bestaat een voorcalculatie (aanleg-wizard-flow) */
  heeftVoorcalculatie: boolean;
}

/**
 * Kent deze offerte de voorcalculatie-stap?
 *
 * Alleen de aanleg-wizard: vrije offertes (PRD §2.5b) slaan de stap per
 * ontwerp over — die gaan van concept direct naar verzonden — en onderhoud
 * loopt via bouwstenen/contract (§2.1). Gedeeld met `convex/projecten.ts`,
 * zodat "wanneer is een voorcalculatie verplicht" op één plek staat en een
 * geaccepteerde offerte nooit klem komt te zitten tussen twee verschillende
 * antwoorden op die vraag.
 */
export function heeftVoorcalculatieStap(offerte: {
  type: "aanleg" | "onderhoud";
  bron?: "wizard" | "vrij";
}): boolean {
  return offerte.type === "aanleg" && offerte.bron !== "vrij";
}

export type AcceptatieBesluit =
  | {
      toegestaan: true;
      /**
       * Keten-actie die de status-mutation bij acceptatie uitvoert:
       * - "geen": uitgang bestaat al (werkitem of contract gekoppeld)
       * - "contract_aanmaken": route 1 — concept-contract via createFromOfferte
       * - "project_aanmaken": aanleg-wizard — eenmalig project (bestaand gedrag)
       */
      actie: "geen" | "contract_aanmaken" | "project_aanmaken";
    }
  | { toegestaan: false; reden: string };

export const ACCEPTATIE_GEWEIGERD_REDEN =
  "Een offerte kan niet op 'geaccepteerd' zonder ten minste één werkitem " +
  "(PRD §2.5). Koppel de regels eerst aan een eenmalig project, een losse " +
  "onderhoudsbeurt of een concept-contract via de koppel-dialoog.";

export function beoordeelAcceptatie(
  context: AcceptatieContext
): AcceptatieBesluit {
  // Uitgang bestaat al: werkitem(s) of contract gekoppeld (route 2 na de
  // koppel-dialoog, of een eerdere acceptatie).
  if (context.heeftWerkitem || context.heeftContract) {
    return { toegestaan: true, actie: "geen" };
  }

  // Route 1 — onderhoud-wizard met bouwstenencatalogus: acceptatie maakt
  // automatisch een voorgevuld concept-contract aan (PRD §2.1/§2.5a). Het
  // concept-contract + latere activering (beurtengenerator) is hier de keten.
  if (context.type === "onderhoud" && context.aantalBouwsteenRegels > 0) {
    return { toegestaan: true, actie: "contract_aanmaken" };
  }

  // Aanleg-wizard (bestaand gedrag: een geaccepteerde aanleg-offerte levert
  // een project op). De voorcalculatie-eis markeert de wizard-flow; het
  // project wordt nu direct bij acceptatie aangemaakt zodat de harde
  // validatie nooit een geaccepteerde offerte zonder werkitem toelaat.
  if (heeftVoorcalculatieStap(context) && context.heeftVoorcalculatie) {
    return { toegestaan: true, actie: "project_aanmaken" };
  }

  // Route 2 (vrij) of een offerte zonder herleidbare keten: kantoor moet
  // eerst koppelen. De mutation weigert met een duidelijke fout.
  return { toegestaan: false, reden: ACCEPTATIE_GEWEIGERD_REDEN };
}
