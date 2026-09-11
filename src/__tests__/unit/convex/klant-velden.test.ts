/**
 * De nieuwe klantvelden (klantfeedback Mickey, sep 2026): `voornaam`,
 * `achternaam`, `telefoon2`, `bijzonderheden` en `uitvoerAdres`.
 *
 * Wat hier vastligt:
 *
 * 1. **`naam` blijft de weergavenaam.** Vul je voor- en/of achternaam in, dan
 *    wordt `naam` daaruit afgeleid — ook bij een deel-update, waar het andere
 *    deel nog in de database staat.
 * 2. **Wissen gaat zoals bij `email`/`telefoon`:** een lege string (of een
 *    uitvoeradres met drie lege velden) maakt het veld leeg.
 * 3. **Sanitizing is niet optioneel:** `telefoon2` loopt langs dezelfde
 *    `sanitizePhone` als `telefoon`, lange bijzonderheden worden geweigerd en
 *    een half uitvoeradres ook.
 * 4. **De dubbelcheck kijkt kruislings** naar beide nummers: je tikt het
 *    mobiele nummer in terwijl het bij die klant in `telefoon2` staat.
 * 5. **De relatie-import** schrijft het tweede nummer naar `telefoon2` in
 *    plaats van als regel "Tweede telefoonnummer: …" in `notities`.
 */
import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";

import {
  checkDuplicates,
  create as klantCreate,
  createFromOfferte,
  importKlanten,
  update as klantUpdate,
} from "../../../../convex/klanten";
import {
  MockConvexStore,
  createMockCtx,
  createMockKlant,
  createMockUser,
  seedMockOrganisatie,
} from "../../helpers/convex-mock";

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;

/** Convex registreert de handler op de functie zelf (func._handler). */
function handler(fn: unknown): AnyHandler {
  return (fn as { _handler: AnyHandler })._handler;
}

function bouwWereld(klantOverrides: Record<string, unknown> = {}) {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser({ orgId }));
  const klantId = store.insert(
    "klanten",
    createMockKlant(userId, { orgId, ...klantOverrides })
  );
  return { store, ctx: createMockCtx(store), orgId, userId, klantId };
}

function lees(store: MockConvexStore, id: string): Record<string, unknown> {
  return store.get(id) as unknown as Record<string, unknown>;
}

const BASIS = {
  adres: "Tulpstraat 12",
  postcode: "1234 AB",
  plaats: "Amsterdam",
};

describe("klanten.create — nieuwe velden", () => {
  it("leidt naam af uit voornaam en achternaam", async () => {
    const wereld = bouwWereld();

    const id = (await handler(klantCreate)(wereld.ctx, {
      ...BASIS,
      naam: "wordt overschreven",
      voornaam: " Jan ",
      achternaam: "van der Berg",
    })) as string;

    const klant = lees(wereld.store, id);
    expect(klant.naam).toBe("Jan van der Berg");
    expect(klant.voornaam).toBe("Jan");
    expect(klant.achternaam).toBe("van der Berg");
  });

  it("laat naam staan als voor- en achternaam leeg zijn", async () => {
    const wereld = bouwWereld();

    const id = (await handler(klantCreate)(wereld.ctx, {
      ...BASIS,
      naam: "Hoveniersbedrijf Groenveld B.V.",
      klantType: "zakelijk",
      voornaam: "",
    })) as string;

    const klant = lees(wereld.store, id);
    expect(klant.naam).toBe("Hoveniersbedrijf Groenveld B.V.");
    expect(klant.voornaam).toBeUndefined();
  });

  it("sanitized telefoon2 langs dezelfde regel als telefoon", async () => {
    const wereld = bouwWereld();

    const id = (await handler(klantCreate)(wereld.ctx, {
      ...BASIS,
      naam: "Jan de Vries",
      telefoon: "06-12 34 56 78",
      telefoon2: "046 443 3918",
    })) as string;

    expect(lees(wereld.store, id).telefoon2).toBe("0464433918");

    await expect(
      handler(klantCreate)(wereld.ctx, {
        ...BASIS,
        naam: "Jan de Vries",
        telefoon2: "geen nummer",
      })
    ).rejects.toThrow(ConvexError);
  });

  it("bewaart bijzonderheden getrimd en weigert een te lang verhaal", async () => {
    const wereld = bouwWereld();

    const id = (await handler(klantCreate)(wereld.ctx, {
      ...BASIS,
      naam: "Jan de Vries",
      bijzonderheden: "  Sleutel onder de pot, hond los in de tuin.  ",
    })) as string;

    expect(lees(wereld.store, id).bijzonderheden).toBe(
      "Sleutel onder de pot, hond los in de tuin."
    );

    await expect(
      handler(klantCreate)(wereld.ctx, {
        ...BASIS,
        naam: "Jan de Vries",
        bijzonderheden: "x".repeat(2001),
      })
    ).rejects.toThrow(ConvexError);
  });

  it("normaliseert het uitvoeradres en weigert een half adres", async () => {
    const wereld = bouwWereld();

    const id = (await handler(klantCreate)(wereld.ctx, {
      ...BASIS,
      naam: "Jan de Vries",
      uitvoerAdres: { adres: " Beukenlaan 3 ", postcode: "6041ma", plaats: " Roermond " },
    })) as string;

    expect(lees(wereld.store, id).uitvoerAdres).toEqual({
      adres: "Beukenlaan 3",
      postcode: "6041 MA",
      plaats: "Roermond",
    });

    await expect(
      handler(klantCreate)(wereld.ctx, {
        ...BASIS,
        naam: "Jan de Vries",
        uitvoerAdres: { adres: "", postcode: "6041 MA", plaats: "Roermond" },
      })
    ).rejects.toThrow(ConvexError);
  });

  it("laat het uitvoeradres weg als alle drie de velden leeg zijn", async () => {
    const wereld = bouwWereld();

    const id = (await handler(klantCreate)(wereld.ctx, {
      ...BASIS,
      naam: "Jan de Vries",
      uitvoerAdres: { adres: "", postcode: "", plaats: "" },
    })) as string;

    expect(lees(wereld.store, id).uitvoerAdres).toBeUndefined();
  });
});

describe("klanten.update — nieuwe velden", () => {
  it("stelt naam samen met het deel dat al in de database staat", async () => {
    const wereld = bouwWereld({
      naam: "Jan van der Berg",
      voornaam: "Jan",
      achternaam: "van der Berg",
    });

    await handler(klantUpdate)(wereld.ctx, {
      id: wereld.klantId,
      voornaam: "Johan",
    });

    const klant = lees(wereld.store, wereld.klantId);
    expect(klant.voornaam).toBe("Johan");
    expect(klant.naam).toBe("Johan van der Berg");
  });

  it("laat naam staan als beide naamdelen worden gewist", async () => {
    const wereld = bouwWereld({
      naam: "Jan van der Berg",
      voornaam: "Jan",
      achternaam: "van der Berg",
    });

    await handler(klantUpdate)(wereld.ctx, {
      id: wereld.klantId,
      voornaam: "",
      achternaam: "",
    });

    const klant = lees(wereld.store, wereld.klantId);
    expect(klant.voornaam).toBeUndefined();
    expect(klant.achternaam).toBeUndefined();
    expect(klant.naam).toBe("Jan van der Berg");
  });

  it("raakt naam niet aan als alleen andere velden meegaan", async () => {
    const wereld = bouwWereld({ naam: "Groenveld B.V." });

    await handler(klantUpdate)(wereld.ctx, {
      id: wereld.klantId,
      bijzonderheden: "Altijd vrijdag maaien",
    });

    const klant = lees(wereld.store, wereld.klantId);
    expect(klant.naam).toBe("Groenveld B.V.");
    expect(klant.bijzonderheden).toBe("Altijd vrijdag maaien");
  });

  it("wist telefoon2, bijzonderheden en uitvoeradres met lege waarden", async () => {
    const wereld = bouwWereld({
      telefoon2: "0464433918",
      bijzonderheden: "Sleutel onder de pot",
      uitvoerAdres: { adres: "Beukenlaan 3", postcode: "6041 MA", plaats: "Roermond" },
    });

    await handler(klantUpdate)(wereld.ctx, {
      id: wereld.klantId,
      telefoon2: "",
      bijzonderheden: "",
      uitvoerAdres: { adres: "", postcode: "", plaats: "" },
    });

    const klant = lees(wereld.store, wereld.klantId);
    expect(klant.telefoon2).toBeUndefined();
    expect(klant.bijzonderheden).toBeUndefined();
    expect(klant.uitvoerAdres).toBeUndefined();
  });
});

describe("klanten.checkDuplicates — tweede nummer", () => {
  it("herkent een klant ook op het tweede nummer, beide kanten op", async () => {
    const wereld = bouwWereld({
      naam: "Piet Houtermann",
      telefoon: "0464433918",
      telefoon2: "0621276398",
    });

    const opTweede = (await handler(checkDuplicates)(wereld.ctx, {
      telefoon: "06 21276398",
    })) as Array<{ matchType: string }>;
    expect(opTweede).toHaveLength(1);
    expect(opTweede[0].matchType).toBe("telefoon");

    const opEigenTweede = (await handler(checkDuplicates)(wereld.ctx, {
      telefoon2: "046-4433918",
    })) as Array<{ matchType: string }>;
    expect(opEigenTweede).toHaveLength(1);

    const geenTreffer = (await handler(checkDuplicates)(wereld.ctx, {
      telefoon: "0612345000",
    })) as unknown[];
    expect(geenTreffer).toHaveLength(0);
  });
});

describe("klanten.importKlanten — tweede nummer en naamdelen", () => {
  it("schrijft het extra nummer naar telefoon2 in plaats van naar notities", async () => {
    const store = new MockConvexStore();
    const orgId = seedMockOrganisatie(store);
    store.insert("users", createMockUser({ orgId }));
    const ctx = createMockCtx(store);

    const uitkomst = (await handler(importKlanten)(ctx, {
      klanten: [
        {
          naam: "Piet Houtermann",
          voornaam: "Piet",
          achternaam: "Houtermann",
          email: "piet@voorbeeld.nl",
          telefoon: "046 443 3918",
          extraTelefoon: "06 21276398",
          adres: "Dorpsstraat 4",
          postcode: "6121 AB",
          plaats: "Born",
        },
      ],
    })) as { imported: number };

    expect(uitkomst.imported).toBe(1);
    const klant = store
      .getAll("klanten")
      .find((k) => (k as unknown as { naam: string }).naam === "Piet Houtermann") as
      unknown as Record<string, unknown>;

    expect(klant.telefoon).toBe("0464433918");
    expect(klant.telefoon2).toBe("0621276398");
    expect(klant.voornaam).toBe("Piet");
    expect(klant.achternaam).toBe("Houtermann");
    expect(klant.notities).toBeUndefined();
  });

  it("vult telefoon2 en naamdelen aan bij een klant die er al staat", async () => {
    const wereld = bouwWereld({
      naam: "Piet Houtermann",
      telefoon: "0464433918",
      postcode: "6121 AB",
      telefoon2: undefined,
      voornaam: undefined,
      achternaam: undefined,
    });

    await handler(importKlanten)(wereld.ctx, {
      klanten: [
        {
          naam: "Piet Houtermann",
          voornaam: "Piet",
          achternaam: "Houtermann",
          telefoon: "046 443 3918",
          extraTelefoon: "06 21276398",
          postcode: "6121 AB",
        },
      ],
    });

    const klant = lees(wereld.store, wereld.klantId);
    expect(klant.telefoon2).toBe("0621276398");
    expect(klant.voornaam).toBe("Piet");
    expect(klant.achternaam).toBe("Houtermann");
    expect(klant.notities).toBeUndefined();
  });
});

/**
 * `naam` en de naamdelen mogen niet uit elkaar lopen. Zodra dat wél gebeurt
 * sorteert en zoekt de app op een achternaam die niemand meer ziet staan.
 */
describe("klanten.update — naam en naamdelen blijven bij elkaar", () => {
  it("wist de opgeslagen naamdelen als alleen een afwijkende naam meegaat", async () => {
    const wereld = bouwWereld({
      naam: "Jan van der Berg",
      voornaam: "Jan",
      achternaam: "van der Berg",
    });

    await handler(klantUpdate)(wereld.ctx, {
      id: wereld.klantId,
      naam: "Hoveniersbedrijf Groenveld B.V.",
    });

    const klant = lees(wereld.store, wereld.klantId);
    expect(klant.naam).toBe("Hoveniersbedrijf Groenveld B.V.");
    expect(klant.voornaam).toBeUndefined();
    expect(klant.achternaam).toBeUndefined();
  });

  it("laat de naamdelen staan als de meegestuurde naam er nog uit volgt", async () => {
    const wereld = bouwWereld({
      naam: "Jan van der Berg",
      voornaam: "Jan",
      achternaam: "van der Berg",
    });

    await handler(klantUpdate)(wereld.ctx, {
      id: wereld.klantId,
      naam: "  Jan van der Berg  ",
    });

    const klant = lees(wereld.store, wereld.klantId);
    expect(klant.naam).toBe("Jan van der Berg");
    expect(klant.voornaam).toBe("Jan");
    expect(klant.achternaam).toBe("van der Berg");
  });

  it("herberekent naam als de naamdelen naast een naam meegaan", async () => {
    const wereld = bouwWereld({
      naam: "Jan van der Berg",
      voornaam: "Jan",
      achternaam: "van der Berg",
    });

    await handler(klantUpdate)(wereld.ctx, {
      id: wereld.klantId,
      naam: "wordt overschreven",
      voornaam: "Piet",
      achternaam: "Houtermann",
    });

    const klant = lees(wereld.store, wereld.klantId);
    expect(klant.naam).toBe("Piet Houtermann");
    expect(klant.voornaam).toBe("Piet");
    expect(klant.achternaam).toBe("Houtermann");
  });
});

describe("klanten.checkDuplicates — schoonmaak en archief", () => {
  it("matcht een nummer met haakjes, zoals sanitizePhone het opslaat", async () => {
    const wereld = bouwWereld({ telefoon: "0464433918" });

    const treffers = (await handler(checkDuplicates)(wereld.ctx, {
      telefoon: "(046) 443 3918",
    })) as unknown[];

    expect(treffers).toHaveLength(1);
  });

  it("laat een gearchiveerde klant buiten de dubbelcheck", async () => {
    const wereld = bouwWereld({ telefoon: "0464433918", isArchived: true });

    const treffers = (await handler(checkDuplicates)(wereld.ctx, {
      telefoon: "0464433918",
    })) as unknown[];

    expect(treffers).toHaveLength(0);
  });
});

describe("klanten.importKlanten — naamdelen", () => {
  it("leidt naam af uit de naamdelen en begrenst ze op 100 tekens", async () => {
    const store = new MockConvexStore();
    const orgId = seedMockOrganisatie(store);
    store.insert("users", createMockUser({ orgId }));
    const ctx = createMockCtx(store);

    const uitkomst = (await handler(importKlanten)(ctx, {
      klanten: [
        {
          naam: "Houtermann, Piet",
          voornaam: "  Piet  ",
          achternaam: "Houtermann",
          postcode: "6121 AB",
        },
        {
          naam: "Te lange voornaam",
          voornaam: "x".repeat(101),
          postcode: "6121 AB",
        },
      ],
    })) as { imported: number; errors: string[] };

    expect(uitkomst.imported).toBe(1);
    expect(uitkomst.errors).toHaveLength(1);
    expect(uitkomst.errors[0]).toContain("Voornaam");

    const klant = store
      .getAll("klanten")
      .find((k) => (k as unknown as { voornaam?: string }).voornaam === "Piet") as
      unknown as Record<string, unknown>;
    expect(klant.naam).toBe("Piet Houtermann");
  });

  it("vult naamdelen alleen aan als ze samen de opgeslagen naam vormen", async () => {
    const wereld = bouwWereld({
      naam: "Hoveniersbedrijf Groenveld B.V.",
      postcode: "6121 AB",
      voornaam: undefined,
      achternaam: undefined,
    });

    await handler(importKlanten)(wereld.ctx, {
      klanten: [
        {
          naam: "Hoveniersbedrijf Groenveld B.V.",
          voornaam: "Piet",
          achternaam: "Houtermann",
          postcode: "6121 AB",
        },
      ],
    });

    const klant = lees(wereld.store, wereld.klantId);
    expect(klant.naam).toBe("Hoveniersbedrijf Groenveld B.V.");
    expect(klant.voornaam).toBeUndefined();
    expect(klant.achternaam).toBeUndefined();
  });
});

/**
 * Een klant die uit een offerte ontstaat, kreeg alleen een `naam` — terwijl
 * kantoor op `achternaam` sorteert en zoekt. Zelfde splitsregel als bij een
 * lead en bij de migratie (convex/lib/klantNaam.ts).
 */
describe("klanten.createFromOfferte — naamdelen", () => {
  it("vult voor- en achternaam bij een persoonsnaam", async () => {
    const wereld = bouwWereld();

    const id = (await handler(createFromOfferte)(wereld.ctx, {
      ...BASIS,
      naam: "Ellen Kuipers",
    })) as string;

    const klant = lees(wereld.store, id);
    expect(klant.naam).toBe("Ellen Kuipers");
    expect(klant.voornaam).toBe("Ellen");
    expect(klant.achternaam).toBe("Kuipers");
  });

  it("laat een bedrijfsnaam ongesplitst", async () => {
    const wereld = bouwWereld();

    const id = (await handler(createFromOfferte)(wereld.ctx, {
      ...BASIS,
      naam: "Dreessen Advocaten BV",
    })) as string;

    const klant = lees(wereld.store, id);
    expect(klant.naam).toBe("Dreessen Advocaten BV");
    expect(klant.voornaam).toBeUndefined();
    expect(klant.achternaam).toBeUndefined();
  });
});
