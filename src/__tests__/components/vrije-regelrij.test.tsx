/**
 * De regelrij in de vrije editor stond "op elkaar gecropt": elk getal had een
 * −/+ stepper tegen een piepklein veldje geplakt, zeven clusters naast elkaar.
 *
 * Deze test bewaakt de drie afspraken van het herontwerp:
 * 1. geen stepperknoppen meer op de regelvelden (ruimte gaat naar de velden);
 * 2. geen afgekapte placeholder waar de marge niet berekend kán worden;
 * 3. de rij mag stapelen, maar nooit zijwaarts scrollen (harde regel 1).
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, within } from "@testing-library/react";

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
  } as unknown as typeof ResizeObserver;
});

// De artikelpicker haalt zijn eigen bestand op; die staat hier los van.
vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}));

const { VrijeRegelEditor } = await import(
  "@/components/offerte/vrije-builder/vrije-regel-editor"
);
type Regel = Parameters<typeof VrijeRegelEditor>[0]["regels"][number];

const basisRegel: Regel = {
  id: "r1",
  scope: "Werkzaamheden",
  omschrijving: "Vlonder douglas",
  eenheid: "m2",
  hoeveelheid: 12,
  prijsPerEenheid: 85,
  totaal: 1020,
  type: "materiaal",
  btwCode: 21,
  inkoopprijsPerEenheid: 50,
  margePercentage: 41.2,
};

function toonRij(regel: Regel = basisRegel) {
  render(<VrijeRegelEditor regels={[regel]} onChange={vi.fn()} />);
  return screen.getByTestId("vrije-regel");
}

describe("vrije regelrij", () => {
  it("zet de invoervolgorde neer zonder stepperknoppen op de getalvelden", () => {
    const rij = toonRij();

    // Alles wat een hovenier invult zit in één rij, in werkvolgorde.
    for (const naam of [
      "Omschrijving",
      "Soort regel",
      "Aantal",
      "Eenheid",
      "Inkoopprijs per eenheid",
      "Marge percentage",
      "Verkoopprijs per eenheid",
      "Korting percentage per regel",
      "Btw-code",
    ]) {
      expect(within(rij).getByLabelText(naam)).toBeInTheDocument();
    }

    // Geen −/+ meer: niemand klikt €1.250 bij elkaar.
    expect(
      within(rij).queryByRole("button", { name: /verhoog waarde/i })
    ).toBeNull();
    expect(
      within(rij).queryByRole("button", { name: /verlaag waarde/i })
    ).toBeNull();

    // Het regeltotaal is de uitkomst van de rij en staat erin, niet ernaast.
    expect(within(rij).getByText("Regeltotaal")).toBeInTheDocument();
    expect(within(rij).getByText(/1\.020/)).toBeInTheDocument();
  });

  it("toont bij 'prijs op regel' een kort veld met de uitleg in de tooltip", () => {
    const rij = toonRij({
      ...basisRegel,
      inkoopprijsPerEenheid: undefined,
      margePercentage: undefined,
      prijsOpRegel: true,
    });

    const marge = within(rij).getByLabelText(
      "Marge niet beschikbaar: prijs op regel"
    );
    // Kort genoeg om heel in het veld te passen; de uitleg hangt in `title`.
    expect((marge as HTMLInputElement).value).toBe("n.v.t.");
    expect(marge).toHaveAttribute("title", expect.stringContaining("marge"));
  });

  it("laat de rij stapelen in plaats van zijwaarts scrollen", () => {
    const rij = toonRij();

    // De rij meet zichzelf (container-query), niet het scherm.
    expect(rij.className).toContain("@container/regel");

    const stroken = rij.querySelectorAll("div.flex");
    const wrapbaar = Array.from(stroken).filter((el) =>
      el.className.includes("flex-wrap")
    );
    expect(wrapbaar.length).toBeGreaterThanOrEqual(2);

    // Geen eigen zijwaartse scrollbak.
    expect(rij.querySelector("[class*='overflow-x']")).toBeNull();

    // Het totaal zakt op een smalle rij naar een eigen regel onder de velden.
    expect(within(rij).getByText("Regeltotaal").parentElement?.className).toContain(
      "@max-[40rem]/regel:w-full"
    );
  });
});
