/**
 * Offertedetail variant A: één primaire knop per status en de fasestrip.
 * De regels volgen `updateStatus` in convex/offertes.ts (validTransitions,
 * versturen is kantoor-only) — zie offerte-voortgang.ts.
 */
import { describe, it, expect } from "vitest";
import {
  bepaalVolgendeStap,
  bepaalFases,
  lijnVol,
  type VoortgangInvoer,
  type FaseInvoer,
} from "@/app/(dashboard)/offertes/[id]/components/offerte-voortgang";

const basis: VoortgangInvoer = {
  offerteId: "off_1",
  status: "concept",
  heeftVoorcalculatie: false,
  isVrij: false,
  isKantoor: true,
  project: null,
};

const stap = (over: Partial<VoortgangInvoer>) =>
  bepaalVolgendeStap({ ...basis, ...over });

describe("bepaalVolgendeStap", () => {
  it("concept zonder voorcalculatie → voorcalculatie invullen", () => {
    const { primair, secundair } = stap({});
    expect(primair).toEqual({
      soort: "link",
      label: "Voorcalculatie invullen",
      href: "/offertes/off_1/voorcalculatie",
      icoon: "voorcalculatie",
    });
    expect(secundair).toBeNull();
  });

  it("concept zonder voorcalculatie vraagt dat ook aan niet-kantoor", () => {
    expect(stap({ isKantoor: false }).primair?.label).toBe("Voorcalculatie invullen");
  });

  it("concept met voorcalculatie → versturen via de voorcalculatie-status", () => {
    expect(stap({ heeftVoorcalculatie: true }).primair).toMatchObject({
      soort: "status",
      label: "Versturen",
      doelStatus: "verzonden",
      via: "voorcalculatie",
    });
  });

  it("concept met voorcalculatie, niet-kantoor → alleen klaarzetten", () => {
    expect(stap({ heeftVoorcalculatie: true, isKantoor: false }).primair).toMatchObject({
      soort: "status",
      label: "Klaar voor verzending",
      doelStatus: "voorcalculatie",
    });
  });

  it("vrije offerte in concept → direct versturen, zonder tussenstap", () => {
    const { primair } = stap({ isVrij: true });
    expect(primair).toMatchObject({ soort: "status", doelStatus: "verzonden" });
    expect(primair && "via" in primair ? primair.via : undefined).toBeUndefined();
  });

  it("vrije offerte in concept, niet-kantoor → geen primaire knop", () => {
    expect(stap({ isVrij: true, isKantoor: false }).primair).toBeNull();
  });

  it("voorcalculatie → versturen (kantoor) of niets", () => {
    expect(stap({ status: "voorcalculatie", heeftVoorcalculatie: true }).primair).toMatchObject({
      label: "Versturen",
      doelStatus: "verzonden",
    });
    expect(
      stap({ status: "voorcalculatie", heeftVoorcalculatie: true, isKantoor: false }).primair
    ).toBeNull();
  });

  it("verzonden → akkoord als primair, afwijzen als tweede", () => {
    const { primair, secundair } = stap({ status: "verzonden", heeftVoorcalculatie: true });
    expect(primair).toMatchObject({ soort: "status", doelStatus: "geaccepteerd" });
    expect(secundair).toMatchObject({ soort: "status", doelStatus: "afgewezen" });
  });

  it("geaccepteerd zonder project → start project", () => {
    expect(stap({ status: "geaccepteerd", project: null }).primair).toEqual({
      soort: "link",
      label: "Start project",
      href: "/projecten/nieuw?offerte=off_1",
      icoon: "project",
    });
  });

  it("geaccepteerd met project → naar project", () => {
    expect(
      stap({ status: "geaccepteerd", project: { _id: "prj_9", status: "gepland" } }).primair
    ).toMatchObject({ label: "Naar project", href: "/projecten/prj_9" });
  });

  it("geaccepteerd terwijl het project nog laadt → nog geen knop", () => {
    expect(stap({ status: "geaccepteerd", project: undefined }).primair).toBeNull();
  });

  it("afgewezen → nieuwe versie", () => {
    expect(stap({ status: "afgewezen" }).primair).toEqual({
      soort: "nieuweVersie",
      label: "Nieuwe versie",
    });
  });
});

const faseBasis: FaseInvoer = {
  status: "concept",
  heeftVoorcalculatie: false,
  isVrij: false,
  project: null,
};

const fases = (over: Partial<FaseInvoer>) => bepaalFases({ ...faseBasis, ...over });
const staten = (over: Partial<FaseInvoer>) =>
  fases(over).map((f) => `${f.id}:${f.staat}`);

describe("bepaalFases", () => {
  it("concept zonder voorcalculatie: voorcalculatie is de volgende stap", () => {
    expect(staten({})).toEqual([
      "concept:klaar",
      "voorcalculatie:nu",
      "verzonden:open",
      "besluit:open",
      "project:open",
    ]);
  });

  it("concept met voorcalculatie: versturen is de volgende stap", () => {
    expect(staten({ heeftVoorcalculatie: true })).toEqual([
      "concept:klaar",
      "voorcalculatie:klaar",
      "verzonden:nu",
      "besluit:open",
      "project:open",
    ]);
  });

  it("verzonden: datum op de verzonden-fase, besluit is de volgende stap", () => {
    const f = fases({ status: "verzonden", heeftVoorcalculatie: true, verzondenAt: 123 });
    expect(f.find((x) => x.id === "verzonden")).toMatchObject({ staat: "klaar", datum: 123 });
    expect(f.find((x) => x.id === "besluit")?.staat).toBe("nu");
  });

  it("geaccepteerd zonder project: 'Project starten' is de volgende stap", () => {
    const f = fases({
      status: "geaccepteerd",
      heeftVoorcalculatie: true,
      customerResponse: { status: "geaccepteerd", respondedAt: 456 },
    });
    expect(f.find((x) => x.id === "besluit")).toMatchObject({ staat: "klaar", datum: 456 });
    expect(f.at(-1)).toMatchObject({ id: "project", label: "Project starten", staat: "nu" });
  });

  it("geaccepteerd met project: alles gehaald, projectstatus als detail", () => {
    const f = fases({
      status: "geaccepteerd",
      heeftVoorcalculatie: true,
      project: { _id: "p", status: "gepland" },
      projectStatusLabel: "Gepland",
    });
    expect(f.every((x) => x.staat === "klaar")).toBe(true);
    expect(f.at(-1)).toMatchObject({ label: "Project", detail: "Gepland" });
  });

  it("geaccepteerd terwijl het project laadt: geen markering", () => {
    const f = fases({ status: "geaccepteerd", heeftVoorcalculatie: true, project: undefined });
    expect(f.some((x) => x.staat === "nu")).toBe(false);
  });

  it("afgewezen: rode besluitfase, geen projectfase", () => {
    const f = fases({
      status: "afgewezen",
      heeftVoorcalculatie: true,
      customerResponse: { status: "afgewezen", respondedAt: 789 },
    });
    expect(f.map((x) => x.id)).toEqual(["concept", "voorcalculatie", "verzonden", "besluit"]);
    expect(f.at(-1)).toMatchObject({ label: "Afgewezen", staat: "afgewezen", datum: 789 });
    expect(f.some((x) => x.staat === "nu")).toBe(false);
  });

  it("geen klantdatum als de klant niet zelf reageerde", () => {
    const f = fases({
      status: "geaccepteerd",
      customerResponse: { status: "bekeken", respondedAt: 1 },
    });
    expect(f.find((x) => x.id === "besluit")?.datum).toBeUndefined();
  });

  it("vrije offerte zonder voorcalculatie slaat die fase over", () => {
    expect(fases({ isVrij: true }).map((x) => x.id)).toEqual([
      "concept",
      "verzonden",
      "besluit",
      "project",
    ]);
    expect(fases({ isVrij: true })[1].staat).toBe("nu");
  });

  it("lijnVol volgt de fase waar de lijn naartoe loopt", () => {
    const f = fases({ heeftVoorcalculatie: true });
    expect(lijnVol(f, 1)).toBe(true);
    expect(lijnVol(f, 2)).toBe(false);
  });
});
