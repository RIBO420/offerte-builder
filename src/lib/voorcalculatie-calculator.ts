/**
 * Voorcalculatie Calculator
 *
 * Provides calculation logic for project hours and duration
 * based on offerte data, normuren, and correction factors.
 */

// Types for scope data
export interface OfferteData {
  scopes: string[];
  scopeData?: Record<string, Record<string, unknown>>;
  algemeenParams: {
    bereikbaarheid: "goed" | "beperkt" | "slecht";
    achterstalligheid?: "laag" | "gemiddeld" | "hoog";
  };
  regels: Array<{
    scope: string;
    type: "materiaal" | "arbeid" | "machine";
    hoeveelheid: number;
  }>;
}

export interface Normuur {
  activiteit: string;
  scope: string;
  normuurPerEenheid: number;
  eenheid: string;
}

export interface Correctiefactor {
  type: string;
  waarde: string;
  factor: number;
}

export interface VoorcalculatieResult {
  normUrenPerScope: Record<string, number>;
  normUrenTotaal: number;
  bereikbaarheidFactor: number;
  achterstallijkheidFactor: number;
}

export interface ProjectDurationResult {
  geschatteDagen: number;
  effectieveUrenPerDag: number;
  teamGrootte: number;
  normUrenTotaal: number;
  teamCapaciteitPerDag: number;
}

/**
 * Get correction factor by type and value
 */
function getFactor(
  factoren: Correctiefactor[],
  type: string,
  waarde: string
): number {
  const factor = factoren.find((f) => f.type === type && f.waarde === waarde);
  return factor?.factor ?? 1.0;
}

/**
 * Calculate normuren for a specific scope based on offerte data
 */
function calculateScopeNormuren(
  scope: string,
  data: Record<string, unknown> | undefined,
  scopeNormuren: Normuur[],
  factoren: Correctiefactor[]
): number {
  let scopeUren = 0;

  switch (scope) {
    case "grondwerk": {
      const oppervlakte = typeof data?.oppervlakte === 'number' ? data.oppervlakte : 0;
      const diepte = typeof data?.diepte === 'string' ? data.diepte : "standaard";
      const afvoerGrond = typeof data?.afvoerGrond === 'boolean' ? data.afvoerGrond : false;

      const diepteFactor = getFactor(factoren, "diepte", diepte);

      const ontgravenNormuur = scopeNormuren.find((n) =>
        n.activiteit.toLowerCase().includes("ontgraven")
      );
      scopeUren +=
        oppervlakte *
        (ontgravenNormuur?.normuurPerEenheid || 0.25) *
        diepteFactor;

      if (afvoerGrond) {
        const afvoerNormuur = scopeNormuren.find((n) =>
          n.activiteit.toLowerCase().includes("afvoer")
        );
        const volume =
          oppervlakte *
          (diepte === "licht" ? 0.15 : diepte === "zwaar" ? 0.5 : 0.3);
        scopeUren += volume * (afvoerNormuur?.normuurPerEenheid || 0.1);
      }
      break;
    }

    case "bestrating": {
      const oppervlakte = (data?.oppervlakte as number) || 0;
      const typeBestrating = (data?.typeBestrating as string) || "tegel";
      const snijwerk = (data?.snijwerk as string) || "laag";

      const snijwerkFactor = getFactor(factoren, "snijwerk", snijwerk);

      const bestratingNormuur =
        scopeNormuren.find((n) =>
          n.activiteit.toLowerCase().includes(typeBestrating)
        ) ||
        scopeNormuren.find((n) =>
          n.activiteit.toLowerCase().includes("leggen")
        );

      scopeUren +=
        oppervlakte *
        (bestratingNormuur?.normuurPerEenheid || 0.4) *
        snijwerkFactor;

      const zandbedNormuur = scopeNormuren.find((n) =>
        n.activiteit.toLowerCase().includes("zandbed")
      );
      scopeUren += oppervlakte * (zandbedNormuur?.normuurPerEenheid || 0.1);
      break;
    }

    case "borders": {
      const oppervlakte = (data?.oppervlakte as number) || 0;
      const intensiteit =
        (data?.beplantingsintensiteit as string) || "gemiddeld";

      const intensiteitFactor = getFactor(factoren, "intensiteit", intensiteit);

      const grondNormuur = scopeNormuren.find((n) =>
        n.activiteit.toLowerCase().includes("grondbewerking")
      );
      scopeUren += oppervlakte * (grondNormuur?.normuurPerEenheid || 0.2);

      const plantenNormuur =
        scopeNormuren.find((n) =>
          n.activiteit.toLowerCase().includes(intensiteit)
        ) ||
        scopeNormuren.find((n) =>
          n.activiteit.toLowerCase().includes("planten")
        );
      scopeUren +=
        oppervlakte *
        (plantenNormuur?.normuurPerEenheid || 0.25) *
        intensiteitFactor;
      break;
    }

    case "gras": {
      const oppervlakte = (data?.oppervlakte as number) || 0;
      const type = (data?.type as string) || "graszoden";

      const grasNormuur = scopeNormuren.find((n) =>
        n.activiteit.toLowerCase().includes(type)
      );
      scopeUren +=
        oppervlakte *
        (grasNormuur?.normuurPerEenheid ||
          (type === "graszoden" ? 0.12 : 0.05));
      break;
    }

    case "houtwerk": {
      const afmeting = (data?.afmeting as number) || 0;
      const typeHoutwerk = (data?.typeHoutwerk as string) || "schutting";
      const fundering = (data?.fundering as string) || "standaard";

      const houtwerkNormuur = scopeNormuren.find((n) =>
        n.activiteit.toLowerCase().includes(typeHoutwerk)
      );
      scopeUren += afmeting * (houtwerkNormuur?.normuurPerEenheid || 0.8);

      const funderingNormuur = scopeNormuren.find(
        (n) =>
          n.activiteit.toLowerCase().includes("fundering") &&
          n.activiteit.toLowerCase().includes(fundering)
      );
      const aantalPalen =
        typeHoutwerk === "schutting" ? Math.ceil(afmeting / 2) : 4;
      scopeUren += aantalPalen * (funderingNormuur?.normuurPerEenheid || 0.5);
      break;
    }

    case "water_elektra": {
      const aantalPunten = (data?.aantalPunten as number) || 0;
      const sleuvenNodig = (data?.sleuvenNodig as boolean) || false;

      const armatuurNormuur = scopeNormuren.find((n) =>
        n.activiteit.toLowerCase().includes("armatuur")
      );
      scopeUren += aantalPunten * (armatuurNormuur?.normuurPerEenheid || 0.5);

      if (sleuvenNodig) {
        const sleufNormuur = scopeNormuren.find((n) =>
          n.activiteit.toLowerCase().includes("sleuf graven")
        );
        scopeUren += aantalPunten * 3 * (sleufNormuur?.normuurPerEenheid || 0.3);
      }
      break;
    }

    case "gras_onderhoud": {
      const oppervlakte = (data?.grasOppervlakte as number) || 0;
      const maaien = (data?.maaien as boolean) || false;

      if (maaien) {
        const maaienNormuur = scopeNormuren.find((n) =>
          n.activiteit.toLowerCase().includes("maaien")
        );
        scopeUren += oppervlakte * (maaienNormuur?.normuurPerEenheid || 0.02);
      }
      break;
    }

    case "borders_onderhoud": {
      const oppervlakte = (data?.borderOppervlakte as number) || 0;
      const intensiteit =
        (data?.onderhoudsintensiteit as string) || "gemiddeld";

      const wiedenNormuur =
        scopeNormuren.find((n) =>
          n.activiteit.toLowerCase().includes(intensiteit)
        ) ||
        scopeNormuren.find((n) =>
          n.activiteit.toLowerCase().includes("wieden")
        );

      scopeUren += oppervlakte * (wiedenNormuur?.normuurPerEenheid || 0.15);
      break;
    }

    case "heggen": {
      const lengte = (data?.lengte as number) || 0;
      const hoogte = (data?.hoogte as number) || 1;
      const breedte = (data?.breedte as number) || 0.5;

      const volume = lengte * hoogte * breedte;

      const hegNormuur = scopeNormuren.find((n) =>
        n.activiteit.toLowerCase().includes("heg snoeien")
      );
      scopeUren += volume * (hegNormuur?.normuurPerEenheid || 0.15);
      break;
    }

    case "bomen": {
      const aantalBomen = (data?.aantalBomen as number) || 0;
      const snoei = (data?.snoei as string) || "licht";

      const boomNormuur =
        scopeNormuren.find((n) => n.activiteit.toLowerCase().includes(snoei)) ||
        scopeNormuren.find((n) =>
          n.activiteit.toLowerCase().includes("boom")
        );

      scopeUren +=
        aantalBomen *
        (boomNormuur?.normuurPerEenheid || (snoei === "zwaar" ? 1.5 : 0.5));
      break;
    }

    default:
      // For unknown scopes, return 0 (fallback to regels in caller)
      scopeUren = 0;
  }

  return scopeUren;
}

/**
 * Calculate total normuren from offerte data
 */
export function calculateNormuren(
  offerte: OfferteData,
  normuren: Normuur[],
  factoren: Correctiefactor[]
): VoorcalculatieResult {
  const normUrenPerScope: Record<string, number> = {};
  const scopes = offerte.scopes || [];
  const scopeData = offerte.scopeData;

  // Get global correction factors
  const bereikbaarheidFactor = getFactor(
    factoren,
    "bereikbaarheid",
    offerte.algemeenParams.bereikbaarheid
  );
  const achterstallijkheidFactor = offerte.algemeenParams.achterstalligheid
    ? getFactor(
        factoren,
        "achterstalligheid",
        offerte.algemeenParams.achterstalligheid
      )
    : 1.0;

  for (const scope of scopes) {
    const scopeNormuren = normuren.filter((n) => n.scope === scope);
    const data = scopeData?.[scope];

    let scopeUren = calculateScopeNormuren(
      scope,
      data,
      scopeNormuren,
      factoren
    );

    // If no calculated uren, fallback to arbeid regels
    if (scopeUren === 0) {
      const scopeRegels = offerte.regels.filter(
        (r) => r.scope === scope && r.type === "arbeid"
      );
      for (const regel of scopeRegels) {
        scopeUren += regel.hoeveelheid;
      }
    }

    // Apply global factors
    scopeUren *= bereikbaarheidFactor * achterstallijkheidFactor;

    normUrenPerScope[scope] = Math.round(scopeUren * 100) / 100;
  }

  const normUrenTotaal = Object.values(normUrenPerScope).reduce(
    (a, b) => a + b,
    0
  );

  return {
    normUrenPerScope,
    normUrenTotaal: Math.round(normUrenTotaal * 100) / 100,
    bereikbaarheidFactor,
    achterstallijkheidFactor,
  };
}

/**
 * Calculate project duration based on team configuration
 */
export function calculateProjectDuration(
  normUrenTotaal: number,
  teamGrootte: 2 | 3 | 4,
  effectieveUrenPerDag: number = 7
): ProjectDurationResult {
  const teamCapaciteitPerDag = teamGrootte * effectieveUrenPerDag;
  const geschatteDagen = Math.ceil(normUrenTotaal / teamCapaciteitPerDag);

  return {
    geschatteDagen,
    effectieveUrenPerDag,
    teamGrootte,
    normUrenTotaal,
    teamCapaciteitPerDag,
  };
}

/**
 * Calculate project duration with buffer for weather/unforeseen
 */
export function calculateProjectDurationWithBuffer(
  normUrenTotaal: number,
  teamGrootte: 2 | 3 | 4,
  effectieveUrenPerDag: number = 7,
  bufferPercentage: number = 10
): ProjectDurationResult & { geschatteDagenMetBuffer: number } {
  const result = calculateProjectDuration(
    normUrenTotaal,
    teamGrootte,
    effectieveUrenPerDag
  );

  const geschatteDagenMetBuffer = Math.ceil(
    result.geschatteDagen * (1 + bufferPercentage / 100)
  );

  return {
    ...result,
    geschatteDagenMetBuffer,
  };
}

/**
 * Format hours to display string
 */
export function formatUren(uren: number): string {
  const hours = Math.floor(uren);
  const minutes = Math.round((uren - hours) * 60);

  if (minutes === 0) {
    return `${hours} uur`;
  }

  return `${hours}:${minutes.toString().padStart(2, "0")} uur`;
}

/**
 * Format days to display string
 */
export function formatDagen(dagen: number): string {
  if (dagen === 1) {
    return "1 dag";
  }
  return `${dagen} dagen`;
}

/**
 * Scope labels for display
 */
export const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gras",
  houtwerk: "Houtwerk",
  water_elektra: "Water & Elektra",
  specials: "Specials",
  gras_onderhoud: "Gras Onderhoud",
  borders_onderhoud: "Borders Onderhoud",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
};

/**
 * Get scope label
 */
export function getScopeLabel(scope: string): string {
  return scopeLabels[scope] || scope;
}
