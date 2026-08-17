/**
 * De gesprekscomposer op het klantdossier (klantdossier v7, WS4).
 *
 * Twee productregels uit de klantbriefing staan of vallen met deze test:
 *
 * 1. **Taken worden nooit zonder bevestiging aangemaakt.** De analyse levert
 *    voorstellen; pas een klik op "Vastleggen en taken aanmaken" schrijft, en
 *    dan alleen wat aangevinkt staat. Een uitgevinkt voorstel mag niet
 *    stiekem toch meegaan.
 * 2. **Vastleggen blokkeert nooit op de AI.** Faalt de analyse-action, dan
 *    wordt het gesprek alsnog vastgelegd — met een rustige melding, geen
 *    foutscherm en zonder dat de getypte tekst verloren gaat.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// jsdom kent de Pointer Capture-API niet; Radix (de checkbox) roept hem wél aan.
beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});

const analyseer = vi.fn();
/** Argument mee-typen: de tests lezen `mock.calls[0][0]` uit. */
const legVast = vi.fn(async (_args: Record<string, unknown>) => ({
  entryId: "t1",
  taakIds: [] as string[],
}));
const toastFout = vi.fn();
const toastGoed = vi.fn();

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useAction: (fn: unknown) =>
      getFunctionName(fn as never) === "gesprekAnalyse:analyseer"
        ? analyseer
        : vi.fn(),
    useMutation: (fn: unknown) =>
      getFunctionName(fn as never) === "tijdlijn:legGesprekVast"
        ? legVast
        : vi.fn(),
    useQuery: () => null,
  };
});

vi.mock("@/lib/toast-utils", () => ({
  showErrorToast: (bericht: string) => toastFout(bericht),
  showSuccessToast: (bericht: string) => toastGoed(bericht),
}));

const GESPREK =
  "Mevrouw wil een schetsontwerp zien en volgende week terugbellen.";

async function toonComposer() {
  const { GesprekComposer } = await import(
    "@/components/klanten/dossier/gesprek-composer"
  );
  render(<GesprekComposer klantId={"klanten:1" as never} />);
}

/** Typen + op Vastleggen drukken; daarna staat de analyse te draaien. */
async function legVoor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("Wat is er besproken?"));
  await user.paste(GESPREK);
  await user.click(screen.getByRole("button", { name: "Vastleggen" }));
}

beforeEach(() => {
  analyseer.mockReset();
  legVast.mockClear();
  toastFout.mockClear();
  toastGoed.mockClear();
});

describe("GesprekComposer: de analyse stelt voor, de gebruiker beslist", () => {
  it("toont voorstellen en legt alleen de aangevinkte taken vast", async () => {
    analyseer.mockResolvedValue({
      herkend: true,
      taken: [
        { titel: "Terugbellen over ontwerp", deadline: "2026-08-25", confidence: 0.9 },
        { titel: "Offerte vlonder versturen", deadline: null, confidence: 0.8 },
        // Onder de drempel van 0,6: staat standaard uit en mag niet meegaan.
        { titel: "Foto's nasturen", deadline: null, confidence: 0.3 },
      ],
    });
    const user = userEvent.setup();
    await toonComposer();
    await legVoor(user);

    expect(await screen.findByText(/3 voorgestelde taken gevonden/)).toBeInTheDocument();

    const zeker = screen.getByRole("checkbox", { name: "Terugbellen over ontwerp" });
    const twijfel = screen.getByRole("checkbox", { name: "Foto's nasturen" });
    expect(zeker).toBeChecked();
    expect(twijfel).not.toBeChecked();

    // Eén zekere eruit vinken: hij mag daarna niet meer in de mutation zitten.
    await user.click(screen.getByRole("checkbox", { name: "Offerte vlonder versturen" }));

    await user.click(
      screen.getByRole("button", { name: "Vastleggen en taken aanmaken" })
    );

    await waitFor(() => expect(legVast).toHaveBeenCalledTimes(1));
    expect(legVast).toHaveBeenCalledWith({
      klantId: "klanten:1",
      kanaal: "telefoon",
      eventType: "handmatig",
      tekst: GESPREK,
      taken: [{ titel: "Terugbellen over ontwerp", deadline: "2026-08-25" }],
    });
    expect(toastGoed).toHaveBeenCalledWith("Gesprek vastgelegd, 1 taak aangemaakt");
    // Veld leeg en analysepaneel weg: klaar voor het volgende gesprek.
    expect(screen.getByLabelText("Wat is er besproken?")).toHaveValue("");
    expect(screen.queryByText(/voorgestelde/)).not.toBeInTheDocument();
  });

  it("legt met 'Alleen gesprek vastleggen' geen enkele taak aan", async () => {
    analyseer.mockResolvedValue({
      herkend: true,
      taken: [{ titel: "Terugbellen over ontwerp", deadline: null, confidence: 0.95 }],
    });
    const user = userEvent.setup();
    await toonComposer();
    await legVoor(user);

    await screen.findByText(/1 voorgestelde taak gevonden/);
    await user.click(
      screen.getByRole("button", { name: "Alleen gesprek vastleggen" })
    );

    await waitFor(() => expect(legVast).toHaveBeenCalledTimes(1));
    expect(legVast.mock.calls[0][0]).toMatchObject({ taken: [] });
    expect(toastGoed).toHaveBeenCalledWith("Gesprek vastgelegd op de tijdlijn");
  });

  it("kiest het kanaal en eventType op basis van de typechip", async () => {
    analyseer.mockResolvedValue({ herkend: true, taken: [] });
    const user = userEvent.setup();
    await toonComposer();

    await user.click(screen.getByRole("radio", { name: "Afspraak" }));
    await legVoor(user);

    await waitFor(() => expect(legVast).toHaveBeenCalledTimes(1));
    // Afspraak en Notitie delen kanaal "intern"; het eventType houdt ze uit
    // elkaar, anders is een bezoek later niet terug te vinden.
    expect(legVast.mock.calls[0][0]).toMatchObject({
      kanaal: "intern",
      eventType: "afspraak",
    });
  });
});

describe("GesprekComposer: de AI mag het vastleggen nooit tegenhouden", () => {
  it("legt het gesprek alsnog vast als de analyse-action faalt", async () => {
    analyseer.mockRejectedValue(new Error("Anthropic ligt plat"));
    const user = userEvent.setup();
    await toonComposer();
    await legVoor(user);

    await waitFor(() => expect(legVast).toHaveBeenCalledTimes(1));
    expect(legVast.mock.calls[0][0]).toMatchObject({
      tekst: GESPREK,
      taken: [],
    });
    // Een rustige melding, geen foutscherm.
    expect(toastGoed).toHaveBeenCalledWith(
      "Gesprek vastgelegd — geen taken herkend"
    );
    expect(toastFout).not.toHaveBeenCalled();
    expect(screen.queryByText(/voorgestelde/)).not.toBeInTheDocument();
  });

  it("doet hetzelfde als de analyse niets herkent", async () => {
    analyseer.mockResolvedValue({ herkend: false, taken: [] });
    const user = userEvent.setup();
    await toonComposer();
    await legVoor(user);

    await waitFor(() => expect(legVast).toHaveBeenCalledTimes(1));
    expect(toastGoed).toHaveBeenCalledWith(
      "Gesprek vastgelegd — geen taken herkend"
    );
  });

  it("houdt de getypte tekst vast als het vastleggen zelf mislukt", async () => {
    analyseer.mockResolvedValue({ herkend: false, taken: [] });
    legVast.mockRejectedValueOnce(new Error("Netwerkfout"));
    const user = userEvent.setup();
    await toonComposer();
    await legVoor(user);

    await waitFor(() => expect(toastFout).toHaveBeenCalledWith("Netwerkfout"));
    // De getypte tekst is het enige wat niet opnieuw te maken is.
    expect(screen.getByLabelText("Wat is er besproken?")).toHaveValue(GESPREK);
  });

  it("vraagt eerst om tekst en roept de analyse niet aan op een leeg veld", async () => {
    const user = userEvent.setup();
    await toonComposer();

    await user.click(screen.getByRole("button", { name: "Vastleggen" }));

    expect(toastFout).toHaveBeenCalledWith("Vul eerst in wat er besproken is");
    expect(analyseer).not.toHaveBeenCalled();
    expect(legVast).not.toHaveBeenCalled();
  });
});
