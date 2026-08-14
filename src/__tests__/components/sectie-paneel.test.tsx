/**
 * De uitleg van een sectie hoorde eerst als alinea in de lege staat te staan.
 * Dat kostte elke dag ruimte voor iets wat je één keer leest, dus hij zit nu
 * achter een info-icoon in de kop. Deze test legt dat vast: de tekst mag pas
 * verschijnen als je erom vraagt.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SectieLegeStaat,
  SectiePaneel,
} from "@/components/ui/sectie-paneel";

beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
  // Radix positioneert de tooltip met een ResizeObserver; die bestaat niet in
  // jsdom, en zonder stub rendert de inhoud nooit.
  (globalThis as Record<string, unknown>).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const UITLEG =
  "Losse to-do's voor deze klant: terugbellen, offerte narekenen, materiaal bestellen.";

describe("SectiePaneel", () => {
  it("houdt de uitleg uit beeld tot je het info-icoon aanwijst", async () => {
    const user = userEvent.setup();
    render(
      <SectiePaneel titel="Taken" uitleg={UITLEG}>
        <SectieLegeStaat tekst="Nog geen taken." />
      </SectiePaneel>
    );

    // Lege staat is één korte regel, geen alinea.
    expect(screen.getByText("Nog geen taken.")).toBeInTheDocument();
    expect(screen.queryByText(UITLEG)).toBeNull();

    await user.hover(screen.getByRole("button", { name: /wat is taken/i }));

    await waitFor(() =>
      expect(screen.getAllByText(UITLEG).length).toBeGreaterThan(0)
    );
  });

  it("toont geen info-knop zonder uitleg", () => {
    render(
      <SectiePaneel titel="Taken">
        <SectieLegeStaat tekst="Nog geen taken." />
      </SectiePaneel>
    );

    expect(screen.queryByRole("button", { name: /wat is/i })).toBeNull();
  });

  it("toont de telling alleen als er iets te tellen valt", () => {
    const { rerender } = render(
      <SectiePaneel titel="Facturen" telling={0}>
        <div />
      </SectiePaneel>
    );
    expect(screen.queryByText("0")).toBeNull();

    rerender(
      <SectiePaneel titel="Facturen" telling={3}>
        <div />
      </SectiePaneel>
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
