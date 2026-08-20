/**
 * De link naar één factuur is een contract tussen twee kanten: het dossier en
 * het debiteurenoverzicht BOUWEN `/facturen?zoek=…`, de facturenlijst LEEST
 * hem. Die tweede helft ontbrak — de links kwamen uit op een ongefilterde
 * lijst (review v13, bevinding 6). Deze test bewaakt de rondgang.
 */

import { describe, it, expect } from "vitest";
import {
  ZOEK_PARAM,
  factuurZoekHref,
  zoekTermUitParams,
} from "@/components/facturen/zoek-param";

/** Wat de facturenpagina van `useSearchParams()` krijgt. */
function paramsVanHref(href: string): URLSearchParams {
  return new URL(href, "https://app.toptuinen.nl").searchParams;
}

describe("facturen-zoeklink", () => {
  it("levert een factuurnummer heen en terug af", () => {
    const href = factuurZoekHref("2026-014");
    expect(href).toBe(`/facturen?${ZOEK_PARAM}=2026-014`);
    expect(zoekTermUitParams(paramsVanHref(href))).toBe("2026-014");
  });

  it("overleeft tekens die in een URL iets anders betekenen", () => {
    const href = factuurZoekHref("F 2026/014 & co");
    expect(href).not.toContain(" ");
    expect(zoekTermUitParams(paramsVanHref(href))).toBe("F 2026/014 & co");
  });

  it("geeft een lege zoekterm als het param ontbreekt of leeg is", () => {
    expect(zoekTermUitParams(paramsVanHref("/facturen"))).toBe("");
    expect(zoekTermUitParams(paramsVanHref("/facturen?zoek="))).toBe("");
    expect(zoekTermUitParams(paramsVanHref("/facturen?zoek=%20%20"))).toBe("");
    expect(zoekTermUitParams(null)).toBe("");
  });
});
