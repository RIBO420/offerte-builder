/**
 * Klantkoppeling in het leaddetail (klantfeedback augustus, Task 12).
 *
 * 1. **Koppelen via de duplicaatbanner is bezet zolang de mutatie loopt.**
 *    Knop disabled + spinner; een tweede klik doet niets. Daarna weer vrij.
 * 2. **Ontkoppelen in het klantmenu idem.** Het menu blijft open zolang het
 *    loopt, het item is disabled en toont een spinner.
 * 3. **De klantbadge sluit het modal.** Wie via de badge naar het dossier gaat
 *    en terugnavigeert, ziet het bord zonder oud modal.
 * 4. **Legacy-gewonnen lead: de toast noemt het werkitem.** koppelKlant
 *    promoveert dan via promoveerLead en geeft een werkitemId terug.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// jsdom kent de Pointer Capture-API niet; Radix (Dialog, DropdownMenu) wél.
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

// ── Convex, dialogen en toasts onder controle ───────────────────────────────

const koppelKlant = vi.fn();
const ontkoppelKlant = vi.fn();

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useMutation: (fn: unknown) => {
      const naam = getFunctionName(fn as never);
      if (naam === "configuratorAanvragen:koppelKlant") return koppelKlant;
      if (naam === "configuratorAanvragen:ontkoppelKlant") return ontkoppelKlant;
      return vi.fn();
    },
    useQuery: (fn: unknown, args: unknown) => {
      if (args === "skip") return undefined;
      const naam = getFunctionName(fn as never);
      if (naam === "leadActiviteiten:listByLead") return [];
      if (naam === "users:listUsersWithDetails") return [];
      if (naam === "klanten:getVoorSelector")
        return { _id: "klanten:k1", naam: "Jan de Vries" };
      if (naam === "klanten:checkDuplicates")
        return [{ _id: "klanten:k1", naam: "Jan de Vries", matchType: "email" }];
      return undefined;
    },
  };
});

// Het nieuwe-klant-dialoog is van een andere taak; hier alleen een stub.
vi.mock("@/components/klanten/nieuwe-klant-dialog", () => ({
  NieuweKlantDialog: () => null,
}));

vi.mock("@/lib/toast-utils", () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

import { showSuccessToast } from "@/lib/toast-utils";
import { LeadDetailModal } from "@/components/leads/lead-detail-modal";
import type { Lead } from "@/components/leads/lead-card";

function maakLead(overrides: Partial<Lead> = {}): Lead {
  return {
    _id: "configuratorAanvragen:lead1",
    _creationTime: 1,
    orgId: "organisaties:org1",
    referentie: "CFG-0001",
    type: "aanleg",
    klantNaam: "Jan de Vries",
    klantEmail: "jan@devries.nl",
    klantTelefoon: "0612345678",
    klantAdres: "Dorpsstraat 1",
    klantPostcode: "1234AB",
    klantPlaats: "Ede",
    specificaties: {},
    indicatiePrijs: 5000,
    pipelineStatus: "nieuw",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as unknown as Lead;
}

/** Een belofte die de test zelf pas afrondt: zo is de bezet-staat te zien. */
function uitgesteld<T>() {
  let los!: (waarde: T) => void;
  const belofte = new Promise<T>((resolve) => {
    los = resolve;
  });
  return { belofte, los };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Koppelen via de duplicaatbanner", () => {
  it("is bezet zolang koppelKlant loopt: disabled, spinner, geen dubbele aanroep", async () => {
    const gebruiker = userEvent.setup();
    const { belofte, los } = uitgesteld<{ werkitemId: null }>();
    koppelKlant.mockReturnValue(belofte);

    render(<LeadDetailModal lead={maakLead()} open onClose={vi.fn()} />);

    const knop = screen.getByRole("button", { name: /^koppelen$/i });
    expect(knop).not.toBeDisabled();
    expect(knop.querySelector(".animate-spin")).toBeNull();

    await gebruiker.click(knop);

    expect(knop).toBeDisabled();
    expect(knop.querySelector(".animate-spin")).not.toBeNull();
    await gebruiker.click(knop);
    expect(koppelKlant).toHaveBeenCalledTimes(1);
    expect(koppelKlant).toHaveBeenCalledWith({
      id: "configuratorAanvragen:lead1",
      klantId: "klanten:k1",
    });

    los({ werkitemId: null });
    await waitFor(() => expect(knop).not.toBeDisabled());
    expect(knop.querySelector(".animate-spin")).toBeNull();
    expect(showSuccessToast).toHaveBeenCalledWith("Klant gekoppeld aan deze lead");
  });

  it("noemt het werkitem als een legacy-gewonnen lead bij koppelen gepromoveerd is", async () => {
    const gebruiker = userEvent.setup();
    koppelKlant.mockResolvedValue({ werkitemId: "projecten:w1" });

    render(
      <LeadDetailModal
        lead={maakLead({ pipelineStatus: "gewonnen" })}
        open
        onClose={vi.fn()}
      />
    );

    await gebruiker.click(screen.getByRole("button", { name: /^koppelen$/i }));

    await waitFor(() =>
      expect(showSuccessToast).toHaveBeenCalledWith(
        "Klant gekoppeld en eerste werkitem aangemaakt"
      )
    );
  });
});

describe("Gekoppelde klant", () => {
  const gekoppeld = () =>
    maakLead({ gekoppeldKlantId: "klanten:k1" as Lead["gekoppeldKlantId"] });

  it("Ontkoppelen is bezet zolang ontkoppelKlant loopt: item disabled met spinner, menu blijft open", async () => {
    const gebruiker = userEvent.setup();
    const { belofte, los } = uitgesteld<null>();
    ontkoppelKlant.mockReturnValue(belofte);

    render(<LeadDetailModal lead={gekoppeld()} open onClose={vi.fn()} />);

    await gebruiker.click(screen.getByRole("button", { name: "Klantacties" }));
    const item = await screen.findByRole("menuitem", { name: /ontkoppelen/i });
    expect(item).not.toHaveAttribute("aria-disabled", "true");

    await gebruiker.click(item);

    expect(ontkoppelKlant).toHaveBeenCalledWith({ id: "configuratorAanvragen:lead1" });
    const bezigItem = screen.getByRole("menuitem", { name: /ontkoppelen/i });
    expect(bezigItem).toHaveAttribute("aria-disabled", "true");
    expect(bezigItem.querySelector(".animate-spin")).not.toBeNull();

    los(null);
    await waitFor(() =>
      expect(showSuccessToast).toHaveBeenCalledWith("Klantkoppeling verwijderd")
    );
    expect(ontkoppelKlant).toHaveBeenCalledTimes(1);
  });

  it("de klantbadge linkt naar het dossier en sluit het modal", async () => {
    const gebruiker = userEvent.setup();
    const onClose = vi.fn();

    render(<LeadDetailModal lead={gekoppeld()} open onClose={onClose} />);

    const badge = screen.getByRole("link", { name: /jan de vries/i });
    expect(badge).toHaveAttribute("href", "/klanten/klanten:k1");
    // jsdom navigeert niet echt; de klik zelf is wat we willen zien.
    badge.addEventListener("click", (event) => event.preventDefault());

    await gebruiker.click(badge);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
