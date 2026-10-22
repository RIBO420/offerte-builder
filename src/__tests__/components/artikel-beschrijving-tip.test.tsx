import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ArtikelBeschrijvingTip } from "@/app/(dashboard)/prijsboek/artikel-beschrijving-tip";

beforeAll(() => {
  // Radix-positionering meet met ResizeObserver; jsdom heeft die niet
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe("ArtikelBeschrijvingTip (prijsboek)", () => {
  it("zonder beschrijving geen icoon", () => {
    const { container } = render(<ArtikelBeschrijvingTip naam="Split" tekst="  " />);
    expect(container).toBeEmptyDOMElement();
  });

  it("toetsenbord: focus op het icoon toont de opgemaakte beschrijving", async () => {
    render(
      <ArtikelBeschrijvingTip
        naam="Renovatie gazon"
        tekst={"Wij verzorgen de renovatie.\n- \n\nVerticuteren \n- \n\nBezanden"}
      />
    );
    const knop = screen.getByRole("button", { name: "Beschrijving van Renovatie gazon" });
    await act(async () => knop.focus());
    expect(await screen.findAllByText("Wij verzorgen de renovatie.")).not.toHaveLength(0);
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      expect.arrayContaining(["Verticuteren", "Bezanden"])
    );
  });
});
