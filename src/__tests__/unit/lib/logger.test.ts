/**
 * Tests voor de gestructureerde logger.
 *
 * De kern van K1 is dat er niets meer stilletjes in een console verdwijnt.
 * Deze tests borgen de afspraken die dat garanderen: fouten worden een
 * Sentry-issue, warn/info blijven logregels (geen alert-ruis), debug gaat
 * nooit naar Sentry, en `module` wordt een filterbare tag.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const captureException = vi.fn();
const captureMessage = vi.fn();
const sentryLoggerInfo = vi.fn();
const sentryLoggerWarn = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
  captureMessage: (...args: unknown[]) => captureMessage(...args),
  logger: {
    info: (...args: unknown[]) => sentryLoggerInfo(...args),
    warn: (...args: unknown[]) => sentryLoggerWarn(...args),
  },
}));

import { logger } from "@/lib/logger";

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("error", () => {
    it("stuurt een Error als exception naar Sentry, met module als tag", () => {
      const fout = new Error("Convex mutation geweigerd");

      logger.error("Opslaan machine mislukt", fout, {
        module: "instellingen/machines",
        machineId: "abc",
      });

      expect(captureException).toHaveBeenCalledTimes(1);
      const [meegegevenFout, opties] = captureException.mock.calls[0] as [
        unknown,
        { tags?: Record<string, string>; extra?: Record<string, unknown> },
      ];
      expect(meegegevenFout).toBe(fout);
      expect(opties.tags).toEqual({ module: "instellingen/machines" });
      // Het bericht blijft naast error.message bestaan: het eerste zegt wat we
      // probeerden, het tweede wat er terugkwam.
      expect(opties.extra).toEqual({
        machineId: "abc",
        bericht: "Opslaan machine mislukt",
      });
      expect(captureMessage).not.toHaveBeenCalled();
    });

    it("gebruikt captureMessage wanneer er geen Error-object is", () => {
      logger.error("MOLLIE_API_KEY niet geconfigureerd", undefined, {
        module: "mollie/webhook",
      });

      expect(captureException).not.toHaveBeenCalled();
      expect(captureMessage).toHaveBeenCalledTimes(1);
      const [bericht, opties] = captureMessage.mock.calls[0] as [
        string,
        { level?: string; tags?: Record<string, string>; extra?: Record<string, unknown> },
      ];
      expect(bericht).toBe("MOLLIE_API_KEY niet geconfigureerd");
      expect(opties.level).toBe("error");
      expect(opties.tags).toEqual({ module: "mollie/webhook" });
      // Zonder fout hoort er geen lege `fout`-sleutel in de context te staan.
      expect(opties.extra).toEqual({});
    });

    it("normaliseert een niet-Error worp tot leesbare tekst", () => {
      logger.error("Onbekende worp", { code: 42 });

      const [, opties] = captureMessage.mock.calls[0] as [
        string,
        { extra?: Record<string, unknown> },
      ];
      expect(opties.extra).toEqual({ fout: '{"code":42}' });
    });

    it("maakt geen Sentry-log aan — een fout hoort een issue te zijn", () => {
      logger.error("Iets ging mis", new Error("boem"));

      expect(sentryLoggerWarn).not.toHaveBeenCalled();
      expect(sentryLoggerInfo).not.toHaveBeenCalled();
    });
  });

  describe("warn en info", () => {
    it("schrijft een warn als Sentry-log, niet als issue", () => {
      logger.warn("Handtekening-header ontbreekt", {
        module: "mollie/webhook",
      });

      expect(sentryLoggerWarn).toHaveBeenCalledWith(
        "Handtekening-header ontbreekt",
        { module: "mollie/webhook" }
      );
      expect(captureException).not.toHaveBeenCalled();
      expect(captureMessage).not.toHaveBeenCalled();
    });

    it("neemt overige context mee als attributen naast de module", () => {
      logger.info("Emailstatus bijgewerkt", {
        module: "resend/webhook",
        resendId: "re_123",
      });

      expect(sentryLoggerInfo).toHaveBeenCalledWith("Emailstatus bijgewerkt", {
        resendId: "re_123",
        module: "resend/webhook",
      });
    });

    it("werkt zonder context", () => {
      logger.warn("Geen context meegegeven");

      expect(sentryLoggerWarn).toHaveBeenCalledWith(
        "Geen context meegegeven",
        {}
      );
    });
  });

  describe("debug", () => {
    it("gaat nooit naar Sentry", () => {
      logger.debug("Alleen tijdens ontwikkelen interessant", {
        module: "export-utils",
      });

      expect(captureException).not.toHaveBeenCalled();
      expect(captureMessage).not.toHaveBeenCalled();
      expect(sentryLoggerInfo).not.toHaveBeenCalled();
      expect(sentryLoggerWarn).not.toHaveBeenCalled();
    });
  });
});
