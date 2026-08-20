/**
 * De Convex-backend leest `org_id` uit het JWT; Clerk vult dat claim alleen als
 * de sessie een *actieve* organisatie heeft. OrgGate is de plek waar dat
 * geregeld wordt, dus deze test legt de uitkomsten vast — plus het foutpad,
 * want een stille oneindige spinner is hier de ergste uitkomst.
 *
 * Sinds de console-storm van 20 aug hoort daar ook het geval bij waarin het
 * claim er wél is maar naar een organisatie wijst die Convex niet kent: de
 * gate moet dán blokkeren, want anders gooit elke query van de shell zijn
 * eigen "Organisatie niet gevonden".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OrgGate } from "@/components/providers/org-gate";

const useAuthMock = vi.fn();
const useOrganizationListMock = vi.fn();
const signOutMock = vi.fn();
const useQueryMock = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => useAuthMock(),
  useOrganizationList: () => useOrganizationListMock(),
  useClerk: () => ({ signOut: signOutMock }),
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

/** Minimale vorm van wat OrgGate uit useOrganizationList gebruikt. */
function organisatieLijst({
  isLoaded = true,
  isLoading = false,
  orgIds = [] as string[],
  setActive = vi.fn().mockResolvedValue(undefined),
}) {
  return {
    isLoaded,
    setActive,
    userMemberships: {
      isLoading,
      data: orgIds.map((id) => ({ organization: { id } })),
    },
  };
}

beforeEach(() => {
  useAuthMock.mockReset();
  useOrganizationListMock.mockReset();
  signOutMock.mockReset();
  useQueryMock.mockReset();
  // Standaard: Convex kent de organisatie. Tests die het tegendeel onderzoeken
  // zetten dit zelf om.
  useQueryMock.mockReturnValue({ status: "ok" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OrgGate", () => {
  it("toont de no-access-staat zonder lidmaatschap", () => {
    useAuthMock.mockReturnValue({ orgId: null });
    useOrganizationListMock.mockReturnValue(organisatieLijst({ orgIds: [] }));

    render(
      <OrgGate>
        <p>Dashboard</p>
      </OrgGate>
    );

    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(
      screen.getByText(/nog niet aan een organisatie gekoppeld/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /uitloggen/i })
    ).toBeInTheDocument();
  });

  it("zet de enige organisatie actief als die er wel is maar nog niet actief", async () => {
    const setActive = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({ orgId: null });
    useOrganizationListMock.mockReturnValue(
      organisatieLijst({ orgIds: ["org_top_tuinen"], setActive })
    );

    render(
      <OrgGate laadstaat={<p>Bezig met laden</p>}>
        <p>Dashboard</p>
      </OrgGate>
    );

    await waitFor(() =>
      expect(setActive).toHaveBeenCalledWith({ organization: "org_top_tuinen" })
    );
    // Onderweg: geen dashboard en geen no-access-staat, alleen de laadstaat.
    expect(screen.getByText("Bezig met laden")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(screen.queryByText(/nog niet aan een organisatie gekoppeld/i)).toBeNull();
  });

  it("laat de dashboard-tree door zodra er een actieve organisatie is", () => {
    const setActive = vi.fn();
    useAuthMock.mockReturnValue({ orgId: "org_top_tuinen" });
    useOrganizationListMock.mockReturnValue(
      organisatieLijst({ orgIds: ["org_top_tuinen"], setActive })
    );

    render(
      <OrgGate>
        <p>Dashboard</p>
      </OrgGate>
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(setActive).not.toHaveBeenCalled();
  });

  it("toont de laadstaat zolang Clerk zelf nog niet geladen is", () => {
    useAuthMock.mockReturnValue({ orgId: null });
    useOrganizationListMock.mockReturnValue(
      organisatieLijst({ isLoaded: false, orgIds: [] })
    );

    render(
      <OrgGate laadstaat={<p>Bezig met laden</p>}>
        <p>Dashboard</p>
      </OrgGate>
    );

    // Géén flits van de no-access-staat voordat de lidmaatschappen binnen zijn.
    expect(screen.getByText("Bezig met laden")).toBeInTheDocument();
    expect(screen.queryByText(/nog niet aan een organisatie gekoppeld/i)).toBeNull();
  });

  it("valt terug op de no-access-staat als setActive mislukt", async () => {
    const fout = new Error("netwerk stuk");
    const setActive = vi.fn().mockRejectedValue(fout);
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    useAuthMock.mockReturnValue({ orgId: null });
    useOrganizationListMock.mockReturnValue(
      organisatieLijst({ orgIds: ["org_top_tuinen"], setActive })
    );

    render(
      <OrgGate laadstaat={<p>Bezig met laden</p>}>
        <p>Dashboard</p>
      </OrgGate>
    );

    await waitFor(() =>
      expect(
        screen.getByText(/nog niet aan een organisatie gekoppeld/i)
      ).toBeInTheDocument()
    );
    expect(logSpy).toHaveBeenCalled();
    // Geen herhaallus: één poging, daarna de nette staat.
    expect(setActive).toHaveBeenCalledTimes(1);
  });

  it("vraagt de Convex-toegangsstatus niet op zonder actief org-claim", () => {
    useAuthMock.mockReturnValue({ orgId: null });
    useOrganizationListMock.mockReturnValue(organisatieLijst({ orgIds: [] }));

    render(
      <OrgGate>
        <p>Dashboard</p>
      </OrgGate>
    );

    // Zonder claim weten we het antwoord al; de query hoort op "skip" te staan.
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), "skip");
  });

  it("houdt de children tegen zolang de toegangsvraag nog loopt", () => {
    useAuthMock.mockReturnValue({ orgId: "org_top_tuinen" });
    useOrganizationListMock.mockReturnValue(
      organisatieLijst({ orgIds: ["org_top_tuinen"] })
    );
    useQueryMock.mockReturnValue(undefined);

    render(
      <OrgGate laadstaat={<p>Bezig met laden</p>}>
        <p>Dashboard</p>
      </OrgGate>
    );

    // Dit is de plek waar de query-storm anders begon: de shell mag pas
    // mounten als vaststaat dat de organisatie bruikbaar is.
    expect(screen.getByText("Bezig met laden")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).toBeNull();
  });

  // De storm van 20 aug: een geldig JWT met org_391vh9…, maar geen rij in
  // `organisaties`. Voorheen kwam die gebruiker gewoon het dashboard in.
  it("stuurt naar geen-toegang als Convex de organisatie niet kent", () => {
    useAuthMock.mockReturnValue({ orgId: "org_onbekend" });
    useOrganizationListMock.mockReturnValue(
      organisatieLijst({ orgIds: ["org_onbekend"] })
    );
    useQueryMock.mockReturnValue({ status: "onbekende-organisatie" });

    render(
      <OrgGate laadstaat={<p>Bezig met laden</p>}>
        <p>Dashboard</p>
      </OrgGate>
    );

    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(
      screen.getByText(/niet bekend in het systeem/i)
    ).toBeInTheDocument();
    // Niet de uitnodigingszin: deze gebruiker kan er zelf niets aan doen.
    expect(
      screen.queryByText(/nog niet aan een organisatie gekoppeld/i)
    ).toBeNull();
  });

  it("stuurt naar geen-toegang als de organisatie op inactief staat", () => {
    useAuthMock.mockReturnValue({ orgId: "org_top_tuinen" });
    useOrganizationListMock.mockReturnValue(
      organisatieLijst({ orgIds: ["org_top_tuinen"] })
    );
    useQueryMock.mockReturnValue({ status: "inactieve-organisatie" });

    render(
      <OrgGate laadstaat={<p>Bezig met laden</p>}>
        <p>Dashboard</p>
      </OrgGate>
    );

    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(screen.getByText(/op inactief/i)).toBeInTheDocument();
  });

  it("wacht (geen no-access-flits) als het Convex-token nog geen org-claim heeft", () => {
    // Vlak na `setActive`: Clerk weet het al, het Convex-token nog niet.
    useAuthMock.mockReturnValue({ orgId: "org_top_tuinen" });
    useOrganizationListMock.mockReturnValue(
      organisatieLijst({ orgIds: ["org_top_tuinen"] })
    );
    useQueryMock.mockReturnValue({ status: "geen-organisatie" });

    render(
      <OrgGate laadstaat={<p>Bezig met laden</p>}>
        <p>Dashboard</p>
      </OrgGate>
    );

    expect(screen.getByText("Bezig met laden")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(screen.queryByText(/beheerder/i)).toBeNull();
  });
});
