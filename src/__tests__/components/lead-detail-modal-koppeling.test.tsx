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
 * 5. **De kop is reactief.** Het bord geeft een momentopname mee; het modal
 *    leest de lead zelf live. Komt er een verse lead binnen mét klant, dan
 *    verschijnt de badge zonder dat de prop verandert.
 * 6. **Verdwenen lead sluit het modal.** Geeft de query `null` terug (de lead
 *    is gearchiveerd of niet meer van ons), dan volgt één melding en gaat het
 *    modal dicht — geen knoppen op een momentopname die nergens meer op slaat.
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
/** Wat `configuratorAanvragen:getById` teruggeeft; undefined = nog aan het laden. */
let verseLead: unknown = undefined;

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
      if (naam === "configuratorAanvragen:getById") return verseLead;
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

import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
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
  verseLead = undefined;
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

describe("Verse lead uit de query", () => {
  it("toont de klantbadge zodra de lead gekoppeld binnenkomt, zonder nieuwe prop", async () => {
    const bordSnapshot = maakLead();

    const { rerender } = render(
      <LeadDetailModal lead={bordSnapshot} open onClose={vi.fn()} />
    );

    // Zoals het bord hem kent: nog geen klant, dus de aanmaakknop staat er.
    expect(
      screen.getByRole("button", { name: /klant aanmaken/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /jan de vries/i })).toBeNull();

    // De mutatie is geslaagd; Convex levert de bijgewerkte lead. De prop is
    // exact dezelfde momentopname als hiervoor.
    verseLead = maakLead({
      gekoppeldKlantId: "klanten:k1" as Lead["gekoppeldKlantId"],
    });
    rerender(<LeadDetailModal lead={bordSnapshot} open onClose={vi.fn()} />);

    const badge = await screen.findByRole("link", { name: /jan de vries/i });
    expect(badge).toHaveAttribute("href", "/klanten/klanten:k1");
    expect(screen.queryByRole("button", { name: /klant aanmaken/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Klantacties" })
    ).toBeInTheDocument();
    // De duplicaatbanner hoort weg te zijn zodra er een klant hangt.
    expect(screen.queryByRole("button", { name: /^koppelen$/i })).toBeNull();
  });

  it("valt terug op de prop zolang de query nog laadt", () => {
    render(<LeadDetailModal lead={maakLead()} open onClose={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Jan de Vries" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /klant aanmaken/i })
    ).toBeInTheDocument();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("meldt en sluit zodra de lead weg is (query geeft null)", async () => {
    const onClose = vi.fn();
    verseLead = null;

    render(<LeadDetailModal lead={maakLead()} open onClose={onClose} />);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(showErrorToast).toHaveBeenCalledWith(
      "Deze lead is niet meer beschikbaar"
    );
  });

  it("meldt niet twee keer als de ouder nog even blijft renderen", async () => {
    const onClose = vi.fn();
    verseLead = null;

    const { rerender } = render(
      <LeadDetailModal lead={maakLead()} open onClose={onClose} />
    );
    // Een nieuwe pijl-functie per render: zonder ref-bewaking zou de effect
    // opnieuw lopen en een tweede toast afvuren.
    rerender(<LeadDetailModal lead={maakLead()} open onClose={onClose} />);

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("laat een dicht modal met rust", () => {
    const onClose = vi.fn();
    verseLead = null;

    render(<LeadDetailModal lead={maakLead()} open={false} onClose={onClose} />);

    expect(onClose).not.toHaveBeenCalled();
    expect(showErrorToast).not.toHaveBeenCalled();
  });
});
