/**
 * Portaalprofiel: voorvullen en opslaan (klantfeedback augustus, follow-up).
 *
 * Sinds `portaal.updateProfile` adres, postcode en plaats keurt, is een leeg
 * formulier geen schoonheidsfoutje meer: de klant die alleen zijn telefoon
 * wijzigde kreeg "Adres is verplicht" terug. Deze test legt vast dat het
 * formulier begint met wat er in het klantdossier staat, dat het alleen de
 * gewijzigde velden meestuurt en dat een ongeldige invoer dezelfde
 * Nederlandse melding onder het veld toont als het kantoorformulier.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const updateProfile = vi.fn();
/** Wat `portaal:getMijnProfiel` teruggeeft; undefined = nog aan het laden. */
let profiel: unknown;

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useMutation: (fn: unknown) => {
      const naam = getFunctionName(fn as never);
      if (naam === "portaal:updateProfile") return updateProfile;
      return vi.fn();
    },
    useQuery: (fn: unknown) => {
      const naam = getFunctionName(fn as never);
      if (naam === "portaal:getMijnProfiel") return profiel;
      return undefined;
    },
  };
});

// Het Clerk-beveiligingsblok en het portaalthema horen bij andere schermen.
vi.mock("@clerk/nextjs", () => ({ UserProfile: () => null }));
vi.mock("@/components/portaal/portaal-theme-provider", () => ({
  usePortaalTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import PortaalProfielPage from "@/app/portaal/(portal)/profiel/page";

const KLANT = {
  naam: "Jan de Vries",
  email: "jan@devries.nl",
  telefoon: "0612345678",
  adres: "Dorpsstraat 1",
  postcode: "1234 AB",
  plaats: "Utrecht",
};

beforeEach(() => {
  vi.clearAllMocks();
  profiel = { ...KLANT };
  updateProfile.mockResolvedValue(undefined);
});

describe("Portaalprofiel voorvullen", () => {
  it("vult naam, telefoon en het hele adres uit het klantdossier", () => {
    render(<PortaalProfielPage />);

    expect(screen.getByLabelText("Naam")).toHaveValue("Jan de Vries");
    expect(screen.getByLabelText("Telefoon")).toHaveValue("0612345678");
    expect(screen.getByLabelText("Adres")).toHaveValue("Dorpsstraat 1");
    expect(screen.getByLabelText("Postcode")).toHaveValue("1234 AB");
    expect(screen.getByLabelText("Plaats")).toHaveValue("Utrecht");
    expect(screen.getByLabelText(/e-mailadres/i)).toHaveValue("jan@devries.nl");
  });

  it("toont het skelet zolang de query nog laadt", () => {
    profiel = undefined;

    render(<PortaalProfielPage />);

    expect(screen.queryByLabelText("Adres")).toBeNull();
  });

  it("stuurt alleen het gewijzigde veld mee", async () => {
    const gebruiker = userEvent.setup();
    render(<PortaalProfielPage />);

    const telefoon = screen.getByLabelText("Telefoon");
    await gebruiker.clear(telefoon);
    await gebruiker.type(telefoon, "0687654321");
    await gebruiker.click(screen.getByRole("button", { name: /opslaan/i }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    expect(updateProfile).toHaveBeenCalledWith({
      naam: undefined,
      telefoon: "0687654321",
      adres: undefined,
      postcode: undefined,
      plaats: undefined,
    });
  });

  it("weigert een leeg adres met dezelfde melding als het kantoorformulier", async () => {
    const gebruiker = userEvent.setup();
    render(<PortaalProfielPage />);

    await gebruiker.clear(screen.getByLabelText("Adres"));
    await gebruiker.click(screen.getByRole("button", { name: /opslaan/i }));

    expect(await screen.findByText("Adres is verplicht")).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();

    // Typen haalt de melding weer weg.
    await gebruiker.type(screen.getByLabelText("Adres"), "Kerkstraat 2");
    expect(screen.queryByText("Adres is verplicht")).toBeNull();
  });

  it("weigert een ongeldige postcode", async () => {
    const gebruiker = userEvent.setup();
    render(<PortaalProfielPage />);

    const postcode = screen.getByLabelText("Postcode");
    await gebruiker.clear(postcode);
    await gebruiker.type(postcode, "abc");
    await gebruiker.click(screen.getByRole("button", { name: /opslaan/i }));

    expect(
      await screen.findByText("Ongeldige postcode (bijv. 1234 AB)")
    ).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
