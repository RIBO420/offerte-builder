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
 * 3. **Geen opname zonder melding aan de klant** (WS5). De opnameknop opent
 *    de meldingszin; pas de bevestiging dát je hem hebt uitgesproken zet de
 *    microfoon aan. Er is geen tweede weg naar `getUserMedia`.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** Wordt per test opnieuw gezet; de spion ís de opnamegate-test. */
const getUserMedia = vi.fn();
const spoorGestopt = vi.fn();

/** Zo min mogelijk MediaRecorder: starten, stoppen, klaar. */
class NepMediaRecorder {
  static isTypeSupported = () => true;
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["x"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

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

  // jsdom heeft geen microfoon en geen MediaRecorder; allebei erin zetten,
  // zodat de composer de echte weg loopt in plaats van "niet ondersteund".
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  (globalThis as unknown as Record<string, unknown>).MediaRecorder =
    NepMediaRecorder;
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
  spoorGestopt.mockClear();
  getUserMedia.mockReset();
  getUserMedia.mockResolvedValue({
    getTracks: () => [{ stop: spoorGestopt }],
  });
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

describe("GesprekComposer: geen opname zonder melding aan de klant", () => {
  const MELDINGSZIN = /Ik zet je even op de luidspreker/;

  it("zet de microfoon pas aan ná de bevestiging dat de melding gedaan is", async () => {
    const user = userEvent.setup();
    await toonComposer();

    // Vóór de knop is er geen meldingszin en dus ook geen weg naar de mic.
    expect(screen.queryByText(MELDINGSZIN)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Gesprek opnemen/ }));

    // Openklappen toont de melding — en verder niets: geen microfoon, geen
    // timer, geen Stop-knop.
    expect(screen.getByText(MELDINGSZIN)).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /Stop/ })
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Melding gedaan, start opname" })
    );

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    // Nu pas de opnamestaat: teller op nul en een Stop-knop.
    expect(await screen.findByRole("button", { name: /Stop/ })).toBeVisible();
    expect(screen.getByText("0:00")).toBeInTheDocument();
    // De meldingszin blijft in beeld zolang er opgenomen wordt.
    expect(screen.getByText(MELDINGSZIN)).toBeInTheDocument();
  });

  it("laat Annuleren de melding wegklappen zonder ooit op te nemen", async () => {
    const user = userEvent.setup();
    await toonComposer();

    await user.click(screen.getByRole("button", { name: /Gesprek opnemen/ }));
    await user.click(screen.getByRole("button", { name: "Annuleren" }));

    expect(screen.queryByText(MELDINGSZIN)).not.toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
    // De opnameknop staat er weer, klaar voor een volgende poging.
    expect(
      screen.getByRole("button", { name: /Gesprek opnemen/ })
    ).toBeInTheDocument();
  });

  it("houdt het rustig als de microfoon geweigerd wordt", async () => {
    getUserMedia.mockRejectedValue(new Error("NotAllowedError"));
    const user = userEvent.setup();
    await toonComposer();

    await user.click(screen.getByRole("button", { name: /Gesprek opnemen/ }));
    await user.click(
      screen.getByRole("button", { name: "Melding gedaan, start opname" })
    );

    await waitFor(() =>
      expect(toastFout).toHaveBeenCalledWith(
        "Geen toegang tot de microfoon. Sta opnemen toe in je browser en probeer het opnieuw."
      )
    );
    // Geen foutscherm: het paneel klapt dicht en je kunt gewoon typen.
    expect(screen.queryByText(MELDINGSZIN)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Wat is er besproken?")).toBeEnabled();
    expect(legVast).not.toHaveBeenCalled();
  });
});
