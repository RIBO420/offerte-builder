/**
 * De Gevarenzone wist in één klap alle werkdata. Wat daarbij stuk kan gaan
 * zonder dat je het ziet, staat hier vast:
 *
 * 1. **Alleen directie ziet de ingang.** Geen uitgegrijsd linkje — voor wie er
 *    niet bij mag bestaat "Geavanceerd beheer" niet.
 * 2. **De knop luistert naar het letterlijke woord.** " opschonen" en
 *    "opschonen" zijn géén bevestiging; alleen exact `OPSCHONEN` telt.
 * 3. **De server krijgt hetzelfde woord.** `start({ bevestiging: "OPSCHONEN" })`
 *    — de mutation weigert al het andere.
 * 4. **Nul is klaar.** De backend houdt geen status bij; zakt de telling naar
 *    nul na een gestarte ronde, dan is dát het eindsignaal (toast + sluiten).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// jsdom kent de Pointer Capture-API niet; Radix (Dialog) wél.
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

// ── Convex, rol en toast onder controle ─────────────────────────────────────

type Preview =
  | undefined
  | {
      telling: Record<string, number>;
      totaal: number;
      fullScanTabellen: string[];
    };

let previewWaarde: Preview;
const startMutatie = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (_fn: unknown, args: unknown) =>
    args === "skip" ? undefined : previewWaarde,
  useMutation: () => startMutatie,
  useAction: () => vi.fn(),
}));

let isDirectie = true;
vi.mock("@/hooks/use-users", () => ({
  useIsAdmin: () => isDirectie,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import {
  GeavanceerdBeheer,
  Gevarenzone,
  maakRegels,
} from "@/app/(dashboard)/instellingen/components/gevarenzone";

const VOLLE_PREVIEW = {
  telling: { offertes: 12, facturen: 3, notification_log: 40 },
  totaal: 55,
  fullScanTabellen: ["notification_log", "demoSeed"],
};

const LEGE_PREVIEW = {
  telling: {},
  totaal: 0,
  fullScanTabellen: ["notification_log", "demoSeed"],
};

beforeEach(() => {
  vi.clearAllMocks();
  isDirectie = true;
  previewWaarde = VOLLE_PREVIEW;
  startMutatie.mockResolvedValue({ gestart: true });
});

/** Opent de sectie en daarna de dialoog. */
async function openDialoog(gebruiker: ReturnType<typeof userEvent.setup>) {
  await gebruiker.click(screen.getByRole("button", { name: /geavanceerd beheer/i }));
  await gebruiker.click(
    screen.getByRole("button", { name: /werkdata opschonen/i })
  );
  return screen.getByRole("button", { name: /definitief wissen/i });
}

// ── Ingang ──────────────────────────────────────────────────────────────────

describe("GeavanceerdBeheer", () => {
  it("bestaat niet voor wie geen directie is", () => {
    isDirectie = false;
    render(<GeavanceerdBeheer />);

    expect(screen.queryByText(/geavanceerd beheer/i)).toBeNull();
    expect(screen.queryByText(/gevarenzone/i)).toBeNull();
  });

  it("klapt de Gevarenzone pas uit na een klik van directie", async () => {
    const gebruiker = userEvent.setup();
    render(<GeavanceerdBeheer />);

    // Zichtbaar, maar dichtgeklapt: de sectie hangt er nog niet onder.
    expect(screen.queryByText("Gevarenzone")).toBeNull();

    await gebruiker.click(
      screen.getByRole("button", { name: /geavanceerd beheer/i })
    );

    expect(screen.getByText("Gevarenzone")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /werkdata opschonen/i })
    ).toBeInTheDocument();
  });
});

// ── Bevestiging ─────────────────────────────────────────────────────────────

describe("Gevarenzone — bevestigen", () => {
  it("houdt de wisknop uit tot er letterlijk OPSCHONEN staat", async () => {
    const gebruiker = userEvent.setup();
    render(<GeavanceerdBeheer />);
    const wisknop = await openDialoog(gebruiker);

    expect(wisknop).toBeDisabled();

    const veld = screen.getByPlaceholderText("Typ OPSCHONEN om te bevestigen");

    // Kleine letters zijn geen bevestiging.
    await gebruiker.type(veld, "opschonen");
    expect(wisknop).toBeDisabled();

    // Een voorloopspatie evenmin.
    await gebruiker.clear(veld);
    await gebruiker.type(veld, " OPSCHONEN");
    expect(wisknop).toBeDisabled();

    await gebruiker.clear(veld);
    await gebruiker.type(veld, "OPSCHONEN");
    expect(wisknop).toBeEnabled();
  });

  it("stuurt het letterlijke woord naar de server", async () => {
    const gebruiker = userEvent.setup();
    render(<GeavanceerdBeheer />);
    const wisknop = await openDialoog(gebruiker);

    await gebruiker.type(
      screen.getByPlaceholderText("Typ OPSCHONEN om te bevestigen"),
      "OPSCHONEN"
    );
    await gebruiker.click(wisknop);

    expect(startMutatie).toHaveBeenCalledWith({ bevestiging: "OPSCHONEN" });
  });

  it("laat de knop uit als er niets te wissen valt en legt uit waarom", async () => {
    previewWaarde = LEGE_PREVIEW;
    const gebruiker = userEvent.setup();
    render(<GeavanceerdBeheer />);
    const wisknop = await openDialoog(gebruiker);

    expect(wisknop).toBeDisabled();
    expect(
      screen.getByText(/er is geen werkdata om op te schonen/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/de knop blijft daarom uit/i)).toBeInTheDocument();
  });

  it("toont de reden als de server de start weigert", async () => {
    startMutatie.mockRejectedValue({ data: "Alleen directie mag opschonen." });
    const gebruiker = userEvent.setup();
    render(<GeavanceerdBeheer />);
    const wisknop = await openDialoog(gebruiker);

    await gebruiker.type(
      screen.getByPlaceholderText("Typ OPSCHONEN om te bevestigen"),
      "OPSCHONEN"
    );
    await gebruiker.click(wisknop);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Alleen directie mag opschonen."
    );
  });
});

// ── Voortgang en afloop ─────────────────────────────────────────────────────

describe("Gevarenzone — voortgang", () => {
  it("meldt succes zodra de telling na een gestarte ronde op nul staat", async () => {
    const gebruiker = userEvent.setup();
    const { rerender } = render(<Gevarenzone />);

    await gebruiker.click(
      screen.getByRole("button", { name: /werkdata opschonen/i })
    );
    await gebruiker.type(
      screen.getByPlaceholderText("Typ OPSCHONEN om te bevestigen"),
      "OPSCHONEN"
    );
    await gebruiker.click(
      screen.getByRole("button", { name: /definitief wissen/i })
    );

    // Halverwege: het bevestigingsveld is weg, de voortgang staat in beeld.
    previewWaarde = { ...VOLLE_PREVIEW, totaal: 20 };
    rerender(<Gevarenzone />);
    expect(
      await screen.findByText(/nog 20 van 55 te gaan/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Typ OPSCHONEN om te bevestigen")
    ).toBeNull();

    // Nul = klaar: toast en dialoog dicht.
    previewWaarde = LEGE_PREVIEW;
    rerender(<Gevarenzone />);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Werkdata opgeschoond");
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// ── Vertaling van tabelnamen ────────────────────────────────────────────────

describe("maakRegels", () => {
  it("bundelt tabellen tot categorieën, zonder lege regels", () => {
    const regels = maakRegels(
      { offertes: 2, offerte_versions: 3, facturen: 1, projecten: 0 },
      []
    );

    expect(regels).toEqual([
      { label: "Offertes en offertemail", aantal: 5, heleInstallatie: false },
      { label: "Facturen en betalingen", aantal: 1, heleInstallatie: false },
    ]);
  });

  it("markeert de categorie die deployment-breed wordt gewist", () => {
    const regels = maakRegels({ notification_log: 7 }, [
      "notification_log",
      "demoSeed",
    ]);

    expect(regels).toEqual([
      {
        label: "Meldingen, logboeken en demodata",
        aantal: 7,
        heleInstallatie: true,
      },
    ]);
  });

  it("laat een onbekende tabel niet stilletjes verdwijnen", () => {
    expect(maakRegels({ ietsNieuws: 4 }, [])).toEqual([
      { label: "Overige werkdata", aantal: 4, heleInstallatie: false },
    ]);
  });
});
