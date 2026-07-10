/**
 * ReistijdProvider — reistijdberekening voor de dagkaart (PRD §2.2, stap 5b).
 *
 * Twee implementaties achter één interface:
 * - StandaardReistijd: instelbare default minuten per verplaatsing
 *   (instellingen.dagkaartInstellingen.standaardReistijdMinuten, default 20).
 *   Dit is de ACTIEVE provider zolang er geen Maps-key is.
 * - GoogleMapsReistijd: Distance Matrix. Alleen actief als de env-var
 *   GOOGLE_MAPS_API_KEY op de deployment staat; elke fout (netwerk, quota,
 *   onbekend adres) valt FAIL-CLOSED terug op de standaard-reistijd.
 *
 * Berekening gebeurt in een Convex-action (convex/dagkaart.ts); resultaten
 * worden per adrespaar gecachet in de tabel reistijdCache. Tests mocken de
 * fetch-functie — er gaan nooit echte Maps-calls uit in de testsuite.
 */

export type ReistijdBron = "standaard" | "google_maps";

export interface ReistijdProvider {
  readonly bron: ReistijdBron;
  /** Reistijd in hele minuten tussen twee adressen. */
  berekenMinuten(vanAdres: string, naarAdres: string): Promise<number>;
}

export const STANDAARD_REISTIJD_MINUTEN = 20;

/** Vaste default-reistijd per verplaatsing (instelbaar, PRD §2.2 fase 1). */
export class StandaardReistijd implements ReistijdProvider {
  readonly bron = "standaard" as const;

  constructor(
    private readonly minuten: number = STANDAARD_REISTIJD_MINUTEN
  ) {}

  async berekenMinuten(): Promise<number> {
    return this.minuten;
  }
}

/** Minimale fetch-signatuur zodat tests een mock kunnen injecteren. */
export type ReistijdFetch = (
  url: string
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

interface DistanceMatrixAntwoord {
  status?: string;
  rows?: {
    elements?: {
      status?: string;
      duration?: { value?: number };
    }[];
  }[];
}

/**
 * Google Maps Distance Matrix. Fail-closed: elke afwijking van een geldig
 * antwoord levert de fallback-reistijd op. De API-key komt uit de omgeving
 * en verschijnt nooit in logs of foutmeldingen.
 */
export class GoogleMapsReistijd implements ReistijdProvider {
  readonly bron = "google_maps" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fallback: ReistijdProvider,
    private readonly fetchFn: ReistijdFetch = (url) => fetch(url)
  ) {}

  async berekenMinuten(vanAdres: string, naarAdres: string): Promise<number> {
    try {
      const url =
        "https://maps.googleapis.com/maps/api/distancematrix/json" +
        `?origins=${encodeURIComponent(vanAdres)}` +
        `&destinations=${encodeURIComponent(naarAdres)}` +
        `&key=${encodeURIComponent(this.apiKey)}`;
      const antwoord = await this.fetchFn(url);
      if (!antwoord.ok) {
        return this.fallback.berekenMinuten(vanAdres, naarAdres);
      }
      const data = (await antwoord.json()) as DistanceMatrixAntwoord;
      const element = data.rows?.[0]?.elements?.[0];
      const seconden = element?.duration?.value;
      if (
        data.status !== "OK" ||
        element?.status !== "OK" ||
        typeof seconden !== "number" ||
        !Number.isFinite(seconden) ||
        seconden < 0
      ) {
        return this.fallback.berekenMinuten(vanAdres, naarAdres);
      }
      return Math.max(1, Math.ceil(seconden / 60));
    } catch {
      // Netwerk-/parsefout: fail-closed naar de standaard-reistijd
      return this.fallback.berekenMinuten(vanAdres, naarAdres);
    }
  }
}

/**
 * Kiest de actieve provider: Google Maps alléén bij een aanwezige API-key,
 * anders (en als fallback bínnen Maps) de standaard-reistijd.
 */
export function kiesReistijdProvider(opties: {
  apiKey?: string | null;
  standaardMinuten?: number;
  fetchFn?: ReistijdFetch;
}): ReistijdProvider {
  const standaard = new StandaardReistijd(
    opties.standaardMinuten ?? STANDAARD_REISTIJD_MINUTEN
  );
  const key = opties.apiKey?.trim();
  if (!key) return standaard;
  return new GoogleMapsReistijd(key, standaard, opties.fetchFn);
}
