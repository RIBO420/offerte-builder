import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { VeldRegistratieLijst } from "@/components/uren/veld-registratie-lijst";
import { filterRegistraties, legeRegistratieFilters } from "@/lib/veld-registratie-filter";
const query = vi.fn();
const convex = { query };
vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: "user_test", orgId: "org_test" }) }));
vi.mock("convex/react", () => ({ useConvex: () => convex, useQuery: () => ({ scope: { userId: "user_test", orgId: "org_test" }, medewerkers: [{ id: "m1", naam: "Sam" }, { id: "m2", naam: "Kim" }], klanten: [{ id: "k1", naam: "Tuin Een" }, { id: "k2", naam: "Tuin Twee" }] }) }));
const row = (extra: Record<string, unknown> = {}) => ({ id: "s1", medewerkerId: "m1", medewerkerNaam: "Sam", klantId: "k1", klantNaam: "Tuin Een", werkitemId: "w1", werkitemNaam: "Snoeien", datum: "2026-01-31", categorie: "werken", werksoort: "onderhoud", status: "bevestigd", beginTijd: "08:00", eindTijd: "09:00", minuten: 60, ingevoerdDoorId: "u1", ingevoerdDoorNaam: "Voorman Bas", notitie: "Hek dicht", ...extra });
const result = (registraties: ReturnType<typeof row>[]) => ({ scope: { userId: "user_test", orgId: "org_test" }, registraties, afvoer: [{ bedragCent: 987654 }] });
beforeEach(() => query.mockReset());
describe("interactieve kantoorregistraties", () => {
  it("leest vrije periode in maandvensters en toont actor/tijd/werksoort zonder bedragen", async () => {
    query.mockResolvedValueOnce(result([row()])).mockResolvedValueOnce(result([row({ id: "s2", datum: "2026-02-01", medewerkerId: "m2", medewerkerNaam: "Kim", klantId: null, klantNaam: null, categorie: "laden" })]));
    render(<VeldRegistratieLijst van="2026-01-31" tot="2026-02-02" />);
    await screen.findByRole("list", { name: "Gevonden urenregistraties" });
    expect(query).toHaveBeenNthCalledWith(1, expect.anything(), { van: "2026-01-31", tot: "2026-01-31", bereik: "organisatie" });
    expect(query).toHaveBeenNthCalledWith(2, expect.anything(), { van: "2026-02-01", tot: "2026-02-02", bereik: "organisatie" });
    expect(screen.getAllByText("Ingevoerd door: Voorman Bas")).toHaveLength(2);
    expect(screen.getAllByText(/Werksoort: onderhoud/)).toHaveLength(2);
    expect(screen.getByText(/2 registraties · 2:00/)).toBeTruthy();
    expect(screen.queryByText(/987654|9.876|€/)).toBeNull();
  });
  it("combineert medewerker/klant/categorie zonder andere keuzelijsten weg te filteren", async () => {
    query.mockResolvedValue(result([row(), row({ id: "s2", medewerkerId: "m2", medewerkerNaam: "Kim", klantId: "k2", klantNaam: "Tuin Twee", categorie: "laden" })]));
    render(<VeldRegistratieLijst van="2026-01-31" tot="2026-01-31" />);
    await screen.findByRole("list", { name: "Gevonden urenregistraties" });
    fireEvent.change(screen.getByLabelText("Filter registraties op medewerker"), { target: { value: "m1" } });
    expect(within(screen.getByLabelText("Filter registraties op klant")).getByRole("option", { name: "Tuin Twee" })).toBeTruthy();
    expect(within(screen.getByLabelText("Filter registraties op categorie")).getByRole("option", { name: "Laden/lossen" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Filter registraties op klant"), { target: { value: "k2" } });
    expect(screen.getByText("Geen registraties voor deze filters.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Filters wissen" }));
    expect(within(screen.getByRole("list", { name: "Gevonden urenregistraties" })).getAllByRole("listitem")).toHaveLength(2);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("presenteert geen onvolledige periode als een latere maand faalt", async () => {
    query.mockResolvedValueOnce(result([row()])).mockRejectedValueOnce(new Error("Verbinding verbroken"));
    render(<VeldRegistratieLijst van="2026-01-31" tot="2026-02-02" />);
    await screen.findByText("Verbinding verbroken");
    expect(screen.queryByRole("list", { name: "Gevonden urenregistraties" })).toBeNull();
    expect(screen.getByText(/geen gedeeltelijke resultaten/)).toBeTruthy();
  });
  it("weigert onmogelijke datums en response uit een andere organisatie", async () => {
    query.mockResolvedValue({ ...result([row()]), scope: { userId: "user_test", orgId: "org_other" } });
    render(<VeldRegistratieLijst van="2026-01-31" tot="2026-01-31" />);
    await screen.findByText(/De organisatie is gewijzigd/);
    expect(screen.queryByText(/Voorman Bas/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Registraties vanaf"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Toon / vernieuw registraties" }));
    await waitFor(() => expect(screen.getByText("Kies een geldige periode")).toBeTruthy());
    expect(query).toHaveBeenCalledTimes(1);
  });
});
it("dedupliceert vensters en filtert zonder-klant en status voordat paginering plaatsvindt", () => {
  const a = { id: "a", medewerkerId: "m1", klantId: null, datum: "2026-01-31", beginTijd: "08:00", categorie: "laden", status: "ingediend" };
  const b = { ...a, id: "b", klantId: "k1", status: "bevestigd" };
  expect(filterRegistraties([a, a, b], { ...legeRegistratieFilters, klant: "zonder", status: "ingediend" })).toEqual([a]);
});
