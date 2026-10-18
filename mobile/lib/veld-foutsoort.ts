/**
 * Hoe de VeldOutbox op een mislukte opdracht reageert.
 * - `netwerk`: geen verbinding of sessie nog niet klaar → stil wachten, geen poging tellen.
 * - `tijdelijk`: server tijdelijk niet beschikbaar (429/5xx/gateway, verlopen token) → opnieuw met backoff.
 * - `conflict`: de server heeft de opdracht inhoudelijk geweigerd → de gebruiker moet kijken.
 *
 * ConvexHttpClient gooit bij een niet-OK HTTP-antwoord een kale `Error(responseText)`;
 * alleen status 560 betekent dat de functie zelf draaide en faalde. Daarom geeft de
 * mutatie-wrapper de HTTP-status mee als `httpStatus` op de fout.
 */
export type VeldFoutsoort = 'netwerk' | 'tijdelijk' | 'conflict';

/** Convex: de functie draaide en gooide (ConvexError, validatie of eigen Error). */
export const CONVEX_FUNCTIE_FOUT = 560;

const NETWERK = /network|fetch failed|offline|connection|disconnected|aborted|timed? ?out|sessie niet beschikbaar|sessie is gewijzigd/i;
/** Lokale fouten die bij herhalen nooit vanzelf verdwijnen. */
const LOKAAL_PERMANENT = /lokale foto ontbreekt|foto kan niet worden gelezen|groter dan 15 MB|geen fotoreferentie/i;

export function httpStatusVan(fout: unknown): number | undefined {
  const status = (fout as { httpStatus?: unknown } | null)?.httpStatus;
  return typeof status === 'number' ? status : undefined;
}

export function classificeerVeldFout(fout: unknown, online = true): VeldFoutsoort {
  if (!online) return 'netwerk';
  const naam = (fout as { name?: unknown } | null)?.name;
  // ConvexError zet `data` (forwardErrorData) en heet 'ConvexError'.
  if (naam === 'ConvexError' || (fout instanceof Error && 'data' in fout)) return 'conflict';
  const bericht = fout instanceof Error ? fout.message : typeof fout === 'string' ? fout : '';
  if (/ArgumentValidationError|ReturnsValidationError/.test(bericht)) return 'conflict';
  const status = httpStatusVan(fout);
  if (status === CONVEX_FUNCTIE_FOUT) return 'conflict';
  if (status !== undefined) return 'tijdelijk';
  const upload = /upload mislukt \((\d{3})\)/i.exec(bericht);
  if (upload) {
    const code = Number(upload[1]);
    return code >= 500 || code === 408 || code === 429 ? 'tijdelijk' : 'conflict';
  }
  if (NETWERK.test(bericht)) return 'netwerk';
  if (LOKAAL_PERMANENT.test(bericht)) return 'conflict';
  return 'tijdelijk';
}

/** 30s, 1m, 2m, 4m, 8m, daarna elke 15 minuten. */
export function backoffMs(pogingen: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, pogingen - 1), 15 * 60_000);
}
/** Na zoveel tijdelijke mislukkingen (~45 min) vraagt de opdracht toch om controle. */
export const MAX_TIJDELIJKE_POGINGEN = 8;
