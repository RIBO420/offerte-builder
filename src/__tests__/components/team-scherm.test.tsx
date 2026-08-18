/**
 * `/team` voegt het personeelsdossier en het accountbeheer samen. Wat daarbij
 * stuk kan gaan zonder dat je het ziet, staat hier vast:
 *
 * 1. **De accountstatus is af te lezen per rij** — geen account, uitgenodigd,
 *    of een account mét rol. Dat is de hele reden dat de twee lijsten één
 *    scherm werden.
 * 2. **Een projectleider leest mee, hij schrijft niet.** De knoppen die hij
 *    toch niet mag indrukken bestaan niet, in plaats van uitgegrijsd te zijn.
 * 3. **De Accounts-tab legt zichzelf uit.** Hij is de restcategorie, geen
 *    tweede ingang voor nieuwe collega's — die regel moet in beeld staan.
 * 4. **De uitnodigen-dialoog deelt alleen uitnodigbare rollen uit.** `klant`,
 *    `admin` en `viewer` staan er niet in; de server weigert ze ook, en een
 *    keuze die pas ná het versturen sneuvelt is de slechtste van de twee.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// jsdom kent de Pointer Capture-API niet; Radix (Select, DropdownMenu) wél.
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

// De tabs krijgen hun gegevens als prop; de enige Convex-aanraking die
// overblijft is `MedewerkerForm`, dat bij het openen een mutation opvraagt.
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
  useAction: () => vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { TeamTab } from "@/app/(dashboard)/team/team-tab";
import { AccountsTab } from "@/app/(dashboard)/team/accounts-tab";
import { UitnodigenDialog } from "@/app/(dashboard)/team/components/uitnodigen-dialog";
import { UITNODIGBARE_ROLLEN, type Teamlid, type useTeam } from "@/hooks/use-team";
import type { UserWithDetails } from "@/hooks/use-users";

// ── Testgegevens ────────────────────────────────────────────────────────────

function teamlid(overschrijf: Partial<Teamlid> & { naam: string }): Teamlid {
  return {
    _id: `m-${overschrijf.naam}`,
    _creationTime: 0,
    isActief: true,
    createdAt: 0,
    updatedAt: 0,
    accountStatus: "geen",
    account: null,
    ...overschrijf,
  } as unknown as Teamlid;
}

const zonderAccount = teamlid({
  naam: "Bram Bakker",
  functie: "Hovenier",
  contractType: "fulltime",
  uurtarief: 42.5,
  accountStatus: "geen",
});

const uitgenodigd = teamlid({
  naam: "Nadia Nauta",
  functie: "Voorman",
  contractType: "parttime",
  accountStatus: "uitgenodigd",
  uitnodigingEmail: "nadia@toptuinen.nl",
});

const metAccount = teamlid({
  naam: "Sander Smit",
  functie: "Projectleider",
  contractType: "fulltime",
  accountStatus: "actief",
  account: {
    id: "u-sander" as UserWithDetails["_id"],
    email: "sander@toptuinen.nl",
    role: "projectleider",
  },
});

const uitDienst = teamlid({
  naam: "Otto Oud",
  isActief: false,
  accountStatus: "geen",
});

const losAccount: UserWithDetails = {
  _id: "u-los" as UserWithDetails["_id"],
  clerkId: "clerk_los",
  email: "boekhouding@extern.nl",
  name: "Externe Boekhouder",
  role: "materiaalman",
  createdAt: Date.UTC(2026, 0, 15),
};

/** Een `useTeam()`-retour zonder Convex eronder. */
function nepTeam(
  overschrijf: Partial<ReturnType<typeof useTeam>> = {}
): ReturnType<typeof useTeam> {
  return {
    teamleden: [zonderAccount, uitgenodigd, metAccount, uitDienst],
    losseAccounts: [losAccount],
    isLoading: false,
    stuurUitnodiging: vi.fn(),
    trekUitnodigingIn: vi.fn(),
    trekToegangIn: vi.fn(),
    wijzigRol: vi.fn(),
    verwijderAccount: vi.fn(),
    uitDienst: vi.fn(),
    inDienst: vi.fn(),
    ...overschrijf,
  } as unknown as ReturnType<typeof useTeam>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * `ResponsiveTable` zet de tabel én de mobiele kaarten allebei in de DOM; welke
 * je ziet bepaalt CSS. jsdom rekent geen media-queries uit, dus elke query naar
 * een rij vindt zonder scope twee treffers. Rij-assertions gaan daarom door de
 * tabel; menu's die Radix in een portal hangt blijven op `screen`.
 */
const inTabel = () => within(screen.getByRole("table"));

/** De tabelrij van één persoon — voor "staat dít bij díe naam". */
function rijVan(naam: string): HTMLElement {
  return inTabel().getByText(naam).closest("tr") as HTMLElement;
}

// ── Team-tab ────────────────────────────────────────────────────────────────

describe("TeamTab", () => {
  it("toont per collega zijn dossier én zijn app-toegang", () => {
    render(
      <TeamTab
        team={nepTeam()}
        magSchrijven
        filter="in_dienst"
        onFilterChange={vi.fn()}
      />
    );

    // Alle drie de toegangsstaten naast elkaar leesbaar, elk bij de juiste rij.
    expect(within(rijVan("Bram Bakker")).getByText("Geen account")).toBeInTheDocument();
    expect(within(rijVan("Nadia Nauta")).getByText("Uitgenodigd")).toBeInTheDocument();
    // Bij een bestaand account telt de rol, niet het woord "actief".
    expect(
      within(rijVan("Sander Smit")).getAllByText("Projectleider").length
    ).toBeGreaterThan(0);

    // Dossiergegevens die kantoor hier komt halen.
    expect(within(rijVan("Bram Bakker")).getByText("Fulltime")).toBeInTheDocument();
    expect(within(rijVan("Bram Bakker")).getByText("€ 42,50")).toBeInTheDocument();

    // `in_dienst` laat de oud-collega buiten beeld.
    expect(screen.queryByText("Otto Oud")).toBeNull();
  });

  it("filtert op openstaande uitnodigingen", () => {
    render(
      <TeamTab
        team={nepTeam()}
        magSchrijven
        filter="uitgenodigd"
        onFilterChange={vi.fn()}
      />
    );

    expect(inTabel().getByText("Nadia Nauta")).toBeInTheDocument();
    expect(screen.queryByText("Bram Bakker")).toBeNull();
    expect(screen.queryByText("Sander Smit")).toBeNull();
  });

  it("geeft een projectleider leesrechten en geen schrijfknoppen", async () => {
    const gebruiker = userEvent.setup();
    render(
      <TeamTab
        team={nepTeam()}
        magSchrijven={false}
        filter="in_dienst"
        onFilterChange={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /nieuwe collega/i })).toBeNull();

    await gebruiker.click(
      inTabel().getByRole("button", { name: "Acties voor Bram Bakker" })
    );

    // Lezen mag; uitnodigen, bewerken en uit dienst melden bestaan niet.
    expect(
      await screen.findByRole("menuitem", { name: /dossier openen/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /bewerken/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /uitnodigen/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /uit dienst/i })).toBeNull();
  });

  it("biedt directie per accountstatus de bijpassende toegangsactie", async () => {
    const gebruiker = userEvent.setup();
    render(
      <TeamTab
        team={nepTeam()}
        magSchrijven
        filter="in_dienst"
        onFilterChange={vi.fn()}
      />
    );

    // Zonder account: uitnodigen, en niets om in te trekken.
    await gebruiker.click(
      inTabel().getByRole("button", { name: "Acties voor Bram Bakker" })
    );
    expect(
      await screen.findByRole("menuitem", { name: /^uitnodigen$/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /toegang intrekken/i })
    ).toBeNull();
    await gebruiker.keyboard("{Escape}");

    // Mét account: rol wijzigen en toegang intrekken, geen uitnodiging meer.
    await gebruiker.click(
      inTabel().getByRole("button", { name: "Acties voor Sander Smit" })
    );
    expect(
      await screen.findByRole("menuitem", { name: /toegang intrekken/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^uitnodigen$/i })).toBeNull();
  });

  it("houdt de lege staat compact en biedt de eerste collega aan", () => {
    render(
      <TeamTab
        team={nepTeam({ teamleden: [] })}
        magSchrijven
        filter="in_dienst"
        onFilterChange={vi.fn()}
      />
    );

    expect(screen.getByText("Nog geen collega's.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /collega toevoegen/i })
    ).toBeInTheDocument();
  });
});

// ── Accounts-tab ────────────────────────────────────────────────────────────

describe("AccountsTab", () => {
  it("toont losse accounts met de uitleg waarom ze hier staan", () => {
    render(<AccountsTab team={nepTeam()} />);

    const rij = within(
      inTabel().getByText("Externe Boekhouder").closest("tr") as HTMLElement
    );
    expect(rij.getByText("boekhouding@extern.nl")).toBeInTheDocument();
    expect(rij.getByText("Materiaalman")).toBeInTheDocument();
    expect(
      screen.getByText(/nieuwe collega's nodig je uit via de team-tab/i)
    ).toBeInTheDocument();
  });

  it("biedt per account precies rol wijzigen en verwijderen", async () => {
    const gebruiker = userEvent.setup();
    render(<AccountsTab team={nepTeam()} />);

    await gebruiker.click(
      inTabel().getByRole("button", { name: "Acties voor Externe Boekhouder" })
    );

    expect(
      await screen.findByRole("menuitem", { name: /rol wijzigen/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /account verwijderen/i })
    ).toBeInTheDocument();
  });

  it("meldt het als lege lijst dat dit juist goed nieuws is", () => {
    render(<AccountsTab team={nepTeam({ losseAccounts: [] })} />);

    expect(
      screen.getByText("Elk account hoort bij een collega.")
    ).toBeInTheDocument();
  });
});

// ── Uitnodigen-dialoog ──────────────────────────────────────────────────────

describe("UitnodigenDialog", () => {
  function toon(props: Partial<Parameters<typeof UitnodigenDialog>[0]> = {}) {
    return render(
      <UitnodigenDialog
        open
        onOpenChange={vi.fn()}
        medewerkerNaam="Bram Bakker"
        bestaandeAccounts={[]}
        onVersturen={vi.fn()}
        {...props}
      />
    );
  }

  it("deelt alleen uitnodigbare rollen uit", async () => {
    const gebruiker = userEvent.setup();
    toon();

    await gebruiker.click(
      screen.getByRole("combobox", { name: /rol in de app/i })
    );

    const lijst = await screen.findByRole("listbox");
    const opties = within(lijst)
      .getAllByRole("option")
      .map((optie) => optie.textContent?.trim());

    expect(opties).toHaveLength(UITNODIGBARE_ROLLEN.length);
    expect(opties).toEqual(
      expect.arrayContaining([
        "Directie",
        "Projectleider",
        "Voorman",
        "Medewerker (veld)",
        "Onderaannemer / ZZP",
        "Materiaalman",
      ])
    );

    // De rollen die de server weigert komen hier niet eens in beeld.
    expect(opties).not.toContain("Klant");
    expect(opties.some((label) => label?.includes("oud"))).toBe(false);
  });

  it("waarschuwt dat een bestaand account zijn hogere rol houdt", () => {
    toon({
      standaardEmail: "sander@toptuinen.nl",
      bestaandeAccounts: [
        { ...losAccount, email: "sander@toptuinen.nl", role: "directie" },
      ],
    });

    expect(
      screen.getByText(/die rol blijft staan/i)
    ).toBeInTheDocument();
  });
});
