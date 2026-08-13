import { describe, it, expect, vi } from "vitest";
import {
  bouwDetailsUitComponenten,
  haalPlaatsDetails,
  zoekPlaatsen,
  type FetchLike,
} from "../../../../convex/placesLogica";

/** Fetch-mock die één vast antwoord teruggeeft. */
function mockFetch(
  body: unknown,
  opties: { ok?: boolean; status?: number } = {}
): FetchLike & { calls: Array<{ url: string; init?: unknown }> } {
  const calls: Array<{ url: string; init?: unknown }> = [];
  const fn = vi.fn(async (url: string, init?: unknown) => {
    calls.push({ url, init });
    return {
      ok: opties.ok ?? true,
      status: opties.status ?? 200,
      json: async () => body,
    };
  }) as unknown as FetchLike & { calls: typeof calls };
  (fn as unknown as { calls: typeof calls }).calls = calls;
  return fn;
}

const API_KEY = "test-sleutel";

describe("zoekPlaatsen", () => {
  it("zoekt niet bij minder dan drie tekens", async () => {
    const fetchFn = mockFetch({});
    const resultaat = await zoekPlaatsen("To", { apiKey: API_KEY, fetchFn });

    expect(resultaat).toEqual([]);
    // Belangrijk: dit zijn betaalde calls, er mag er geen uitgaan.
    expect(fetchFn.calls).toHaveLength(0);
  });

  it("zet suggesties om naar hoofdtekst en subtekst", async () => {
    const fetchFn = mockFetch({
      suggestions: [
        {
          placePrediction: {
            placeId: "abc123",
            structuredFormat: {
              mainText: { text: "Top Tuinen" },
              secondaryText: { text: "Sittarderweg 5, Born" },
            },
          },
        },
      ],
    });

    const resultaat = await zoekPlaatsen("Top Tuinen", {
      apiKey: API_KEY,
      fetchFn,
    });

    expect(resultaat).toEqual([
      {
        placeId: "abc123",
        hoofdtekst: "Top Tuinen",
        subtekst: "Sittarderweg 5, Born",
      },
    ]);
  });

  it("stuurt de sleutel mee in de header, niet in de URL", async () => {
    const fetchFn = mockFetch({ suggestions: [] });
    await zoekPlaatsen("Bruls Beton", { apiKey: API_KEY, fetchFn });

    const call = fetchFn.calls[0];
    expect(call.url).not.toContain(API_KEY);
    expect(
      (call.init as { headers: Record<string, string> }).headers["X-Goog-Api-Key"]
    ).toBe(API_KEY);
  });

  it("beperkt de zoekopdracht tot NL, BE en DE", async () => {
    const fetchFn = mockFetch({ suggestions: [] });
    await zoekPlaatsen("Kranzusch", { apiKey: API_KEY, fetchFn });

    const body = JSON.parse((fetchFn.calls[0].init as { body: string }).body);
    expect(body.includedRegionCodes).toEqual(["nl", "be", "de"]);
    expect(body.languageCode).toBe("nl");
  });

  it("geeft een lege lijst bij een foutstatus", async () => {
    const fetchFn = mockFetch({}, { ok: false, status: 403 });
    const resultaat = await zoekPlaatsen("Top Tuinen", {
      apiKey: API_KEY,
      fetchFn,
    });

    expect(resultaat).toEqual([]);
  });

  it("geeft een lege lijst als de fetch gooit", async () => {
    const fetchFn = (async () => {
      throw new Error("netwerk down");
    }) as unknown as FetchLike;

    await expect(
      zoekPlaatsen("Top Tuinen", { apiKey: API_KEY, fetchFn })
    ).resolves.toEqual([]);
  });

  it("slaat suggesties zonder placeId over", async () => {
    const fetchFn = mockFetch({
      suggestions: [
        { placePrediction: { structuredFormat: { mainText: { text: "Zonder id" } } } },
        {
          placePrediction: {
            placeId: "ok",
            structuredFormat: { mainText: { text: "Met id" } },
          },
        },
      ],
    });

    const resultaat = await zoekPlaatsen("test", { apiKey: API_KEY, fetchFn });
    expect(resultaat).toHaveLength(1);
    expect(resultaat[0].placeId).toBe("ok");
  });
});

describe("bouwDetailsUitComponenten", () => {
  it("stelt adres samen uit straat en huisnummer", () => {
    const details = bouwDetailsUitComponenten({
      displayName: { text: "Bruls Prefab Beton" },
      addressComponents: [
        { longText: "Lissabonlaan", types: ["route"] },
        { longText: "2", types: ["street_number"] },
        { longText: "6135 LE", types: ["postal_code"] },
        { longText: "Sittard", types: ["locality"] },
      ],
      nationalPhoneNumber: "046 123 4567",
    });

    expect(details).toEqual({
      naam: "Bruls Prefab Beton",
      adres: "Lissabonlaan 2",
      postcode: "6135 LE",
      plaats: "Sittard",
      telefoon: "046 123 4567",
      website: undefined,
    });
  });

  it("valt terug op postal_town als locality ontbreekt", () => {
    const details = bouwDetailsUitComponenten({
      addressComponents: [
        { longText: "Hoofdstraat", types: ["route"] },
        { longText: "Buchten", types: ["postal_town"] },
      ],
    });

    expect(details.plaats).toBe("Buchten");
  });

  it("gaat om met een volledig leeg antwoord", () => {
    const details = bouwDetailsUitComponenten({});

    expect(details.naam).toBe("");
    expect(details.adres).toBe("");
    expect(details.postcode).toBe("");
    expect(details.plaats).toBe("");
  });

  it("laat het huisnummer weg als Google het niet kent", () => {
    const details = bouwDetailsUitComponenten({
      addressComponents: [{ longText: "Heugerstraat", types: ["route"] }],
    });

    expect(details.adres).toBe("Heugerstraat");
  });
});

describe("haalPlaatsDetails", () => {
  it("geeft null bij een lege placeId zonder call te doen", async () => {
    const fetchFn = mockFetch({});
    const resultaat = await haalPlaatsDetails("  ", { apiKey: API_KEY, fetchFn });

    expect(resultaat).toBeNull();
    expect(fetchFn.calls).toHaveLength(0);
  });

  it("vraagt alleen de velden op die we gebruiken", async () => {
    const fetchFn = mockFetch({ displayName: { text: "Top Tuinen" } });
    await haalPlaatsDetails("abc123", { apiKey: API_KEY, fetchFn });

    const headers = (
      fetchFn.calls[0].init as { headers: Record<string, string> }
    ).headers;
    // Een ruimere FieldMask kost meer per call.
    expect(headers["X-Goog-FieldMask"]).toBe(
      "displayName,addressComponents,nationalPhoneNumber,websiteUri"
    );
  });

  it("geeft null bij een foutstatus", async () => {
    const fetchFn = mockFetch({}, { ok: false, status: 500 });
    const resultaat = await haalPlaatsDetails("abc", { apiKey: API_KEY, fetchFn });

    expect(resultaat).toBeNull();
  });
});
