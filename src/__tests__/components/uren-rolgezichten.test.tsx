/**
 * De rolgezichten van `/uren` (WS-C) — één route, drie gezichten.
 *
 * 1. **De rol kiest het gezicht**: kantoor → Controlekamer, voorman →
 *    ploegdag, veldrol → eigen week. De rolchecks van de queries leven in de
 *    backend; hier telt alleen dat niemand een half verkeerd scherm ziet.
 * 2. **De film is deeplinkbaar**: `?weergave=film&dag=…` toont de Ploegenfilm
 *    van precies die dag — "kijk even naar de dagfilm van donderdag" is één
 *    link.
 * 3. **De filmstrip draagt zijn status niet alleen in kleur**: elke dagtegel
 *    heeft de status ook als tekst.
 * 4. **"Ploegdag bevestigen voor N man" is een lus, geen magie**: per lid één
 *    `urenSegmenten:bevestigAlleVoorstellen`, met per man de uitkomst in
 *    beeld.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UrenGezicht } from "@/components/uren/uren-gezicht";
import { PloegenFilm } from "@/components/uren/ploegen-film";
import { PloegDagGezicht } from "@/components/uren/ploegdag-gezicht";

// ── Rol en URL zijn per test instelbaar ─────────────────────────────────────

let rol: string | null = "directie";
vi.mock("@/hooks/use-users", () => ({
  useCurrentUserRole: () => rol,
  useIsKantoor: () =>
    rol === "directie" || rol === "projectleider" || rol === "admin",
}));

let zoekParams = new URLSearchParams();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/uren",
  useSearchParams: () => zoekParams,
}));

// ── Convex: antwoorden per functienaam, aanroepen worden bijgehouden ────────

const queryAntwoorden = new Map<string, unknown>();
const queryArgs = new Map<string, unknown[]>();
const bevestigAlleVoorstellen = vi.fn(
  async (args: { medewerkerId?: string }) => ({
    bevestigd: args.medewerkerId === "m1" ? 2 : 1,
  })
);

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (fn: unknown, args?: unknown) => {
      const naam = getFunctionName(fn as never);
      const lijst = queryArgs.get(naam) ?? [];
      lijst.push(args);
      queryArgs.set(naam, lijst);
      if (args === "skip") return undefined;
      return queryAntwoorden.has(naam) ? queryAntwoorden.get(naam) : undefined;
    },
    useMutation: (fn: unknown) => {
      switch (getFunctionName(fn as never)) {
        case "urenSegmenten:bevestigAlleVoorstellen":
          return bevestigAlleVoorstellen;
        default:
          return vi.fn();
      }
    },
  };
});

const toastGoed = vi.fn();
const toastFout = vi.fn();
vi.mock("@/lib/toast-utils", () => ({
  showSuccessToast: (bericht: string) => toastGoed(bericht),
  showErrorToast: (bericht: string) => toastFout(bericht),
}));

// De export haalt xlsx-machinerie binnen; hier telt alleen dat het gezicht
// hem een plek geeft.
vi.mock("@/components/export-dropdown", () => ({
  ExportDropdown: () => <button type="button">Export naar loon</button>,
  urenExportColumns: [],
}));

// ── Vaste voorbeelddata (plan §2-contract) ──────────────────────────────────

const lid = (medewerkerId: string, naam: string, datum = "2026-08-11") => ({
  medewerkerId,
  naam,
  datum,
  totaalUren: 8.5,
  status: "ingediend" as const,
  segmenten: [
    { beginTijd: "07:00", eindTijd: "12:00", categorie: "werken" as const, label: "Dohmen" },
    { beginTijd: "12:00", eindTijd: "12:30", categorie: "pauze" as const },
    { beginTijd: "12:30", eindTijd: "16:00", categorie: "werken" as const, label: "Hermans" },
  ],
});

const CONTROLE_WEEK = {
  weekStart: "2026-08-10",
  weekLabel: "Week 33 · 10 t/m 16 augustus",
  achter: [],
  afwijkend: [],
  stil: [],
  gekweten: 0,
  weekstaat: [
    {
      medewerkerId: "m1",
      naam: "Lars Hendriks",
      ploegLabel: "Ploeg Lars",
      dagen: [
        { datum: "2026-08-10", uren: 8, status: "ingediend" as const },
        { datum: "2026-08-11", uren: 0, status: "leeg" as const },
      ],
      totaalUren: 8,
    },
  ],
  totalen: { uren: 0, indirect: 0, ingediend: 0, open: 0 },
};

const DAG_FILM = {
  datum: "2026-08-11",
  dagLabel: "dinsdag 11 augustus 2026",
  strip: [
    { datum: "2026-08-10", kortLabel: "ma 10 aug", status: "compleet" as const },
    { datum: "2026-08-11", kortLabel: "di 11 aug", status: "afwijkend" as const },
    { datum: "2026-08-12", kortLabel: "wo 12 aug", status: "open" as const },
  ],
  ploegen: [
    {
      teamId: "t1",
      naam: "Ploeg Lars",
      voermanNaam: "Lars Hendriks",
      busLabel: "VDL-38-H",
      stops: ["Dohmen · terras", "Hermans"],
      leden: [lid("m1", "Lars Hendriks"), lid("m2", "Kevin Bruls")],
    },
  ],
  los: [lid("m3", "Petra de Wit")],
  totaalZin: { uren: 42.5, indirect: 6.2, nietIngediend: 3 },
};

const PLOEG_DAG = {
  datum: "2026-08-14",
  dagLabel: "vrijdag 14 augustus 2026",
  ploeg: {
    teamId: "t1",
    naam: "Ploeg Lars",
    voermanNaam: "Lars Hendriks",
    busLabel: "VDL-38-H",
    stops: ["Dohmen · terras"],
  },
  leden: [
    { ...lid("m1", "Lars Hendriks", "2026-08-14"), status: "open" as const, openVoorstellen: 2, isEigenDag: true },
    { ...lid("m2", "Kevin Bruls", "2026-08-14"), status: "open" as const, openVoorstellen: 1, isEigenDag: false },
  ],
  totaalZin: { uren: 17, indirect: 0, nietIngediend: 2 },
};

const MIJN_WEEK = {
  weekStart: "2026-08-10",
  weekLabel: "Week 33 · 10 t/m 16 augustus",
  medewerker: { _id: "m2", naam: "Kevin Bruls" },
  dagen: [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const datum = `2026-08-${String(10 + i).padStart(2, "0")}`;
    return i === 0
      ? { ...lid("m2", "Kevin Bruls", datum) }
      : {
          medewerkerId: "m2",
          naam: "Kevin Bruls",
          datum,
          totaalUren: 0,
          status: "open" as const,
          segmenten: [],
        };
  }),
  correcties: [
    {
      datum: "2026-08-10",
      actie: "segment_gecorrigeerd",
      details: "Segment 07:00–12:00 bijgesteld door kantoor",
      createdAt: 1755400000000,
    },
  ],
};

beforeEach(() => {
  rol = "directie";
  zoekParams = new URLSearchParams();
  push.mockClear();
  bevestigAlleVoorstellen.mockClear();
  toastGoed.mockClear();
  toastFout.mockClear();
  queryArgs.clear();
  queryAntwoorden.clear();
  queryAntwoorden.set("urenControle:getControleWeek", CONTROLE_WEEK);
  queryAntwoorden.set("urenControle:getDagFilm", DAG_FILM);
  queryAntwoorden.set("urenControle:getPloegDag", PLOEG_DAG);
  queryAntwoorden.set("urenControle:getMijnWeek", MIJN_WEEK);
  queryAntwoorden.set("export:exportUren", []);
  queryAntwoorden.set("urenSegmenten:getUrenLogboek", []);
  queryAntwoorden.set("medewerkers:list", []);
  queryAntwoorden.set("urenRegistraties:listGlobal", []);
});

describe("Eén route, drie gezichten", () => {
  it("geeft kantoor de Controlekamer", () => {
    rol = "directie";
    render(<UrenGezicht />);
    expect(screen.getByText("Wie is achter?")).toBeInTheDocument();
    expect(screen.getByText("Wat wijkt af?")).toBeInTheDocument();
  });

  it("geeft de voorman de ploegdag met de groepshandeling", () => {
    rol = "voorman";
    render(<UrenGezicht />);
    expect(
      screen.getByRole("button", { name: /Ploegdag bevestigen voor 2 man/ })
    ).toBeInTheDocument();
    // Het kantoor-scherm hoort hier niet te staan.
    expect(screen.queryByText("Wie is achter?")).not.toBeInTheDocument();
  });

  it("geeft de medewerker zijn eigen week met kantoorcorrecties", () => {
    rol = "medewerker";
    render(<UrenGezicht />);
    expect(screen.getByText("Jouw week")).toBeInTheDocument();
    // De kantooractie staat gemarkeerd op de dagregel én in het logboekblok.
    expect(screen.getByText("Kantoor: gecorrigeerd")).toBeInTheDocument();
    expect(
      screen.getByText("Segment 07:00–12:00 bijgesteld door kantoor")
    ).toBeInTheDocument();
  });

  it("toont via ?weergave=film de Ploegenfilm van de gekozen dag", () => {
    rol = "directie";
    zoekParams = new URLSearchParams("weergave=film&dag=2026-08-11");
    render(<UrenGezicht />);

    expect(screen.getByText("Ploeg Lars")).toBeInTheDocument();
    expect(screen.getByText("Los van een ploeg")).toBeInTheDocument();
    // De query kreeg precies de dag uit de URL.
    expect(queryArgs.get("urenControle:getDagFilm")?.[0]).toEqual({
      datum: "2026-08-11",
    });
    // En de dagzin telt mensen, geen uren.
    expect(
      screen.getByText("42,5 uur, waarvan 6,2 indirect — 3 mensen nog niet ingediend.")
    ).toBeInTheDocument();
  });
});

describe("De filmstrip", () => {
  const renderFilm = () =>
    render(
      <PloegenFilm datum="2026-08-11" onKiesDag={vi.fn()} onSluit={vi.fn()} />
    );

  it("rendert elke werkdag als tegel met de status als tekst, niet alleen als stip", () => {
    renderFilm();
    const strip = screen.getByRole("navigation", { name: "Kies een dag" });
    expect(strip).toBeInTheDocument();

    // Drie tegels, elk met kortLabel + statustekst in de toegankelijke naam.
    expect(
      screen.getByRole("button", { name: "ma 10 aug — compleet" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "di 11 aug — wijkt af" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "wo 12 aug — nog open" })
    ).toBeInTheDocument();
  });

  it("markeert de gekozen dag en geeft een klik door aan de dagkiezer", async () => {
    const onKiesDag = vi.fn();
    render(
      <PloegenFilm datum="2026-08-11" onKiesDag={onKiesDag} onSluit={vi.fn()} />
    );

    expect(
      screen.getByRole("button", { name: "di 11 aug — wijkt af" })
    ).toHaveAttribute("aria-current", "date");

    await userEvent.click(
      screen.getByRole("button", { name: "ma 10 aug — compleet" })
    );
    expect(onKiesDag).toHaveBeenCalledWith("2026-08-10");
  });
});

describe("Ploegdag bevestigen voor N man", () => {
  it("loopt per lid over bevestigAlleVoorstellen en toont per man de uitkomst", async () => {
    render(<PloegDagGezicht />);

    await userEvent.click(
      screen.getByRole("button", { name: /Ploegdag bevestigen voor 2 man/ })
    );

    await waitFor(() => expect(bevestigAlleVoorstellen).toHaveBeenCalledTimes(2));
    expect(bevestigAlleVoorstellen).toHaveBeenNthCalledWith(1, {
      datum: "2026-08-14",
      medewerkerId: "m1",
    });
    expect(bevestigAlleVoorstellen).toHaveBeenNthCalledWith(2, {
      datum: "2026-08-14",
      medewerkerId: "m2",
    });

    // Per man de uitkomst (mock: m1 → 2 voorstellen, m2 → 1).
    expect(await screen.findByText("2 voorstellen bevestigd")).toBeInTheDocument();
    expect(screen.getByText("1 voorstel bevestigd")).toBeInTheDocument();
    expect(toastGoed).toHaveBeenCalledWith("Ploegdag bevestigd voor 2 man");
  });

  it("meldt een haperend lid zonder de rest tegen te houden", async () => {
    bevestigAlleVoorstellen.mockImplementationOnce(async () => {
      throw new Error("Deze dag is ingediend en op slot");
    });
    render(<PloegDagGezicht />);

    await userEvent.click(
      screen.getByRole("button", { name: /Ploegdag bevestigen voor 2 man/ })
    );

    await waitFor(() => expect(bevestigAlleVoorstellen).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText("Deze dag is ingediend en op slot")
    ).toBeInTheDocument();
    expect(screen.getByText("1 voorstel bevestigd")).toBeInTheDocument();
    expect(toastFout).toHaveBeenCalledWith(
      "Bevestigd voor 1 van 2 man — zie de regels per man"
    );
  });

  it("zet de knop op slot als er niets te bevestigen valt", () => {
    queryAntwoorden.set("urenControle:getPloegDag", {
      ...PLOEG_DAG,
      leden: PLOEG_DAG.leden.map((l) => ({ ...l, openVoorstellen: 0 })),
    });
    render(<PloegDagGezicht />);
    expect(
      screen.getByRole("button", { name: /Geen open voorstellen/ })
    ).toBeDisabled();
  });

  it("schakelt netjes om als er geen ploeg of koppeling is", () => {
    queryAntwoorden.set("urenControle:getPloegDag", null);
    render(<PloegDagGezicht />);
    expect(screen.getByText("Geen ploegdag gevonden")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Naar Veld" })).toHaveAttribute(
      "href",
      "/veld"
    );
  });
});
