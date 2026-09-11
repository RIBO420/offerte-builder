// @vitest-environment node
/**
 * Eén adresregel voor de hele app.
 *
 * Tot 11 sep 2026 bouwden minstens negen plekken hun eigen adresregel, in twee
 * formaten: het dossier en de klantenlijst mét postcode ("Straat 1, 1234 AB
 * Meppel"), de dagkaart, het planbord en materiaalDelta zónder ("Straat 1,
 * Meppel"). Dezelfde klant kreeg dus twee verschillende regels, afhankelijk
 * van het scherm. Deze suite legt het ene formaat vast — mét postcode — en de
 * regel dat lege delen wegvallen in plaats van een losse komma achter te
 * laten (dat gebeurde na een import met halflege adresvelden).
 */

import { describe, it, expect } from "vitest";
import {
  adresRegel,
  googleMapsZoekUrl,
  googleMapsRouteUrl,
} from "../../../../convex/lib/adres";

describe("adresRegel", () => {
  it("zet straat, postcode en plaats in één regel mét postcode", () => {
    expect(
      adresRegel({ adres: "Straat 1", postcode: "1234 AB", plaats: "Plaats" })
    ).toBe("Straat 1, 1234 AB Plaats");
  });

  it("slaat een ontbrekende postcode over zonder dubbele spatie", () => {
    expect(adresRegel({ adres: "Straat 1", plaats: "Meppel" })).toBe(
      "Straat 1, Meppel"
    );
  });

  it("slaat een ontbrekende straat over zonder losse komma vooraan", () => {
    expect(adresRegel({ postcode: "7941 AB", plaats: "Meppel" })).toBe(
      "7941 AB Meppel"
    );
  });

  it("geeft alleen de straat als de rest ontbreekt", () => {
    expect(adresRegel({ adres: "Straat 1" })).toBe("Straat 1");
  });

  it("geeft een lege regel als alles ontbreekt", () => {
    expect(adresRegel({})).toBe("");
    expect(adresRegel({ adres: null, postcode: null, plaats: null })).toBe("");
    expect(adresRegel({ adres: undefined })).toBe("");
  });

  it("behandelt spaties-alleen als leeg en trimt de delen", () => {
    expect(
      adresRegel({ adres: "  ", postcode: "  1234 AB ", plaats: " Meppel " })
    ).toBe("1234 AB Meppel");
    expect(adresRegel({ adres: " ", postcode: " ", plaats: " " })).toBe("");
  });
});

describe("googleMapsZoekUrl", () => {
  it("bouwt een zoek-URL met een ge-encodeerde adresregel", () => {
    expect(
      googleMapsZoekUrl({
        adres: "Straat 1",
        postcode: "1234 AB",
        plaats: "Plaats",
      })
    ).toBe(
      "https://www.google.com/maps/search/?api=1&query=Straat%201%2C%201234%20AB%20Plaats"
    );
  });

  it("accepteert ook een kant-en-klare adresregel (werkitem-adres)", () => {
    expect(googleMapsZoekUrl("Loodsweg 1, Meppel")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Loodsweg%201%2C%20Meppel"
    );
  });

  it("geeft een lege string bij een leeg adres — nooit een kapotte link", () => {
    expect(googleMapsZoekUrl({})).toBe("");
    expect(googleMapsZoekUrl("")).toBe("");
  });
});

describe("googleMapsRouteUrl", () => {
  it("bouwt een route-URL met een ge-encodeerde bestemming", () => {
    expect(
      googleMapsRouteUrl({
        adres: "Straat 1",
        postcode: "1234 AB",
        plaats: "Plaats",
      })
    ).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Straat%201%2C%201234%20AB%20Plaats"
    );
  });

  it("accepteert ook een kant-en-klare adresregel", () => {
    expect(googleMapsRouteUrl("Loodsweg 1, Meppel")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Loodsweg%201%2C%20Meppel"
    );
  });

  it("geeft een lege string bij een leeg adres", () => {
    expect(googleMapsRouteUrl({})).toBe("");
  });
});
