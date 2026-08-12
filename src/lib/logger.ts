/**
 * Gestructureerde logging
 *
 * Waarom deze module bestaat: `console.*` is in productie geen logging maar
 * ruis. In de browser belandt het in een console die niemand van ons ooit ziet,
 * en op de server in stdout zonder structuur of alerting. Sentry is al
 * geconfigureerd (client, server en edge), dus alle signalen horen daarheen.
 *
 * De verdeling is bewust:
 * - `error`  → Sentry **issue** (captureException). Dit is waar we op alerten.
 * - `warn`/`info` → Sentry **log** (logger.warn/info). Wel bewaard voor
 *   context en zoeken, maar het maakt geen issue aan — anders verdrinkt de
 *   alerting in verwachte gevallen zoals een ontbrekende webhook-header.
 * - `debug` → uitsluitend de dev-console. Nooit naar Sentry; dit is materiaal
 *   dat alleen tijdens het bouwen nuttig is.
 *
 * De console wordt alleen in development gebruikt, omdat je daar directe
 * feedback wilt zonder eerst het Sentry-dashboard te openen.
 */

import * as Sentry from "@sentry/nextjs";

/**
 * Extra context bij een logregel.
 *
 * `module` is een afspraak: gebruik een herkenbare plek-/actienaam zoals
 * "mollie/webhook" of "projecten/uitvoering". Die wordt een Sentry-tag, zodat
 * je in het dashboard op één onderdeel kunt filteren. Alle overige velden
 * komen als gestructureerde attributen mee.
 */
export interface LogContext {
  module?: string;
  [sleutel: string]: unknown;
}

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Splits de `module`-tag van de overige context.
 *
 * Sentry-tags moeten strings zijn en zijn indexeerbaar; de rest gaat als
 * `extra`/attributen mee en mag elk type hebben.
 */
function splitsContext(context?: LogContext): {
  module?: string;
  overige: Record<string, unknown>;
} {
  if (!context) return { overige: {} };
  const { module, ...overige } = context;
  return { module, overige };
}

/**
 * Maak van een onbekende `catch`-waarde iets dat in een logregel leesbaar is.
 *
 * Niet elke throw is een Error — Convex en third-party SDK's gooien soms
 * strings of objecten. Zonder deze normalisatie zou dat in Sentry als
 * "[object Object]" eindigen.
 */
function beschrijfFout(fout: unknown): string {
  if (fout instanceof Error) return fout.message;
  if (typeof fout === "string") return fout;
  try {
    return JSON.stringify(fout);
  } catch {
    return String(fout);
  }
}

export const logger = {
  /**
   * Alleen tijdens ontwikkelen zichtbaar. Gaat nooit naar Sentry.
   */
  debug(bericht: string, context?: LogContext): void {
    if (isDevelopment) {
      console.debug(`[debug] ${bericht}`, context ?? "");
    }
  },

  /**
   * Noemenswaardige gebeurtenis die geen fout is (bv. "webhook verwerkt").
   */
  info(bericht: string, context?: LogContext): void {
    const { module, overige } = splitsContext(context);
    Sentry.logger.info(bericht, { ...overige, ...(module ? { module } : {}) });
    if (isDevelopment) {
      console.info(`[info] ${bericht}`, context ?? "");
    }
  },

  /**
   * Iets klopt niet, maar het is verwacht of niet-blokkerend (ontbrekende
   * header, lege export, niet-kritieke vervolgactie die faalde).
   */
  warn(bericht: string, context?: LogContext): void {
    const { module, overige } = splitsContext(context);
    Sentry.logger.warn(bericht, { ...overige, ...(module ? { module } : {}) });
    if (isDevelopment) {
      console.warn(`[warn] ${bericht}`, context ?? "");
    }
  },

  /**
   * Een echte fout. Maakt een Sentry-issue aan zodat er op gealerteerd wordt.
   *
   * @param bericht Wat er misging, in mensentaal — dit is de issue-titel.
   * @param fout De opgevangen waarde uit het `catch`-blok (mag alles zijn).
   * @param context Extra gegevens; `module` wordt een filterbare Sentry-tag.
   */
  error(bericht: string, fout?: unknown, context?: LogContext): void {
    const { module, overige } = splitsContext(context);
    const tags = module ? { module } : undefined;

    if (fout instanceof Error) {
      Sentry.captureException(fout, {
        tags,
        // Het bericht staat los van error.message: de eerste beschrijft wat we
        // probeerden, de tweede wat de library terugkreeg. Allebei nodig.
        extra: { ...overige, bericht },
      });
    } else {
      Sentry.captureMessage(bericht, {
        level: "error",
        tags,
        extra: {
          ...overige,
          ...(fout === undefined ? {} : { fout: beschrijfFout(fout) }),
        },
      });
    }

    if (isDevelopment) {
      console.error(`[error] ${bericht}`, fout ?? "", context ?? "");
    }
  },
};
