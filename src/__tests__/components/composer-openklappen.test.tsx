/**
 * De composers van Tijdlijn en Taken zijn één regel die openklapt bij focus.
 * Dat gedrag is fragiel op één punt: de controls in de strip (Toewijzen,
 * Prioriteit) zijn Radix-selects die hun lijst in een portal renderen. Focus
 * verlaat daarmee de composer, en een naïeve `onBlur` klapt hem dan dicht —
 * precies terwijl je een medewerker aan het kiezen bent.
 *
 * Deze test legt vast dat dat niet gebeurt. Zonder deze test is het een
 * regressie die niemand merkt tot iemand een taak probeert toe te wijzen.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// jsdom kent de Pointer Capture-API niet; Radix' Select roept hem wél aan bij
// het openen. Zonder deze stubs gooit de klik een unhandled error naast de test.
beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
});

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ user: { role: "directie", naam: "Ricardo Bos" } }),
}));

vi.mock("@/hooks/use-foto-upload", () => ({
  useFotoUpload: () => ({
    uploadFotos: vi.fn(),
    verwijderFotoUitLijst: vi.fn(),
    reset: vi.fn(),
    voortgangen: [],
    storageIds: [],
    isBezig: false,
    fout: null,
  }),
  useFotoUrls: () => ({ urls: [] }),
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useMutation: () => vi.fn(),
    useQuery: (fn: unknown) => {
      const naam = fn === "skip" ? "skip" : getFunctionName(fn as never);
      if (naam === "klantTaken:listVoorKlant") return [];
      if (naam.startsWith("medewerkers:"))
        return [{ _id: "m1", naam: "Bart van der Heijden" }];
      if (naam === "tijdlijn:listWerkitemsVoorFilter")
        return [{ _id: "w1", naam: "Achtertuin Dorpsstraat 14" }];
      if (naam === "tijdlijn:chatHistorieVoorKlant") return [];
      if (naam === "tijdlijn:listVoorKlant") return [];
      return null;
    },
  };
});

/**
 * jsdom past geen Tailwind toe, dus `hidden` maakt een element daar niet
 * onzichtbaar voor RTL. We meten daarom de klasse op de dichtstbijzijnde
 * voorouder die hem draagt.
 */
function stripIsDicht(el: HTMLElement | null): boolean {
  const composer = el?.closest("[data-open]");
  return composer?.getAttribute("data-open") === "false";
}

describe("composer klapt open bij focus", () => {
  it("Taken: strip verschijnt bij focus en blijft staan als je de select opent", async () => {
    const { KlantTakenCard } = await import(
      "@/components/klanten/klant-taken-card"
    );
    const user = userEvent.setup();
    render(<KlantTakenCard klantId={"k1" as never} />);

    const veld = screen.getByPlaceholderText(/nieuwe taak/i);
    const trigger = () =>
      screen.getByRole("combobox", { name: /toewijzen/i }) as HTMLElement;

    expect(stripIsDicht(trigger())).toBe(true);

    await user.click(veld);
    await waitFor(() => expect(stripIsDicht(trigger())).toBe(false));

    // Vasthouden vóór het openen: Radix zet de rest van de pagina op
    // aria-hidden zodra de lijst openstaat, waardoor een rol-query de trigger
    // niet meer vindt. De composer zelf blijft gewoon in de DOM.
    const composer = trigger().closest("[data-open]");

    // Select openen mag de strip niet laten dichtklappen (portal steelt focus).
    await user.click(trigger());
    await waitFor(() =>
      expect(composer?.getAttribute("data-open")).toBe("true")
    );
  });

  it("Tijdlijn: strip verschijnt bij focus op het tekstveld", async () => {
    const { KlantTijdlijn } = await import(
      "@/components/tijdlijn/klant-tijdlijn"
    );
    const user = userEvent.setup();
    render(<KlantTijdlijn klantId={"k1" as never} toonPaneel />);

    const veld = screen.getByPlaceholderText(/besproken of afgesproken/i);
    const knop = () =>
      screen.getByRole("button", { name: /toevoegen/i }) as HTMLElement;

    expect(stripIsDicht(knop())).toBe(true);

    await user.click(veld);
    await waitFor(() => expect(stripIsDicht(knop())).toBe(false));
  });
});

/**
 * `SelectContent` staat in deze repo standaard op `position="item-aligned"`
 * (upstream shadcn gebruikt "popper"). Die modus rekent zelf top/left uit om de
 * lijst over de trigger te leggen, en bij de compacte h-7-triggers van de
 * composer kwam daar `top: 1167px` uit — ruim onder de vouw. De lijst opende
 * dus buiten beeld en je kon niets kiezen.
 *
 * jsdom doet geen layout, dus de positie zelf is hier niet te meten. Wat wél
 * meetbaar is: alleen in popper-modus rendert Radix zijn popper-wrapper. Dat is
 * precies het verschil dat de bug veroorzaakte.
 */
describe("keuzelijsten van de composer openen als popper", () => {
  it("Taken: toewijzen- en prioriteitslijst gebruiken de popper-positionering", async () => {
    const { KlantTakenCard } = await import(
      "@/components/klanten/klant-taken-card"
    );
    const user = userEvent.setup();
    render(<KlantTakenCard klantId={"k1" as never} />);

    await user.click(screen.getByPlaceholderText(/nieuwe taak/i));

    for (const naam of [/toewijzen/i, /prioriteit/i]) {
      await user.click(screen.getByRole("combobox", { name: naam }));
      await waitFor(() =>
        expect(
          document.querySelector("[data-radix-popper-content-wrapper]")
        ).not.toBeNull()
      );
      await user.keyboard("{Escape}");
    }
  });
});

/**
 * Het invoerveld is ~19px hoog in een regel van ~41px, en het icoon links is
 * geen invoerveld. Klikken op de regel deed daardoor niets, en omdat de knoppen
 * pas ná het openklappen bestaan leest dat als "de knoppen werken niet".
 */
describe("de hele composer-regel opent, niet alleen het invoerveld", () => {
  it("Taken: klik naast het invoerveld opent de composer", async () => {
    const { KlantTakenCard } = await import(
      "@/components/klanten/klant-taken-card"
    );
    const user = userEvent.setup();
    render(<KlantTakenCard klantId={"k1" as never} />);

    const veld = screen.getByPlaceholderText(/nieuwe taak/i);
    const regel = veld.closest("[data-open]") as HTMLElement;
    expect(regel.getAttribute("data-open")).toBe("false");

    await user.click(regel);

    await waitFor(() => expect(regel.getAttribute("data-open")).toBe("true"));
    expect(document.activeElement).toBe(veld);
  });

  it("Tijdlijn: klik naast het tekstveld opent de composer", async () => {
    const { KlantTijdlijn } = await import(
      "@/components/tijdlijn/klant-tijdlijn"
    );
    const user = userEvent.setup();
    render(<KlantTijdlijn klantId={"k1" as never} toonPaneel />);

    const veld = screen.getByPlaceholderText(/besproken of afgesproken/i);
    const regel = veld.closest("[data-open]") as HTMLElement;
    expect(regel.getAttribute("data-open")).toBe("false");

    await user.click(regel);

    await waitFor(() => expect(regel.getAttribute("data-open")).toBe("true"));
    expect(document.activeElement).toBe(veld);
  });
});
