/**
 * `NumberInput` toont de voorloopnul niet meer tijdens het typen.
 *
 * Het veld start op zijn default (meestal `0`) en die staat niet geselecteerd,
 * dus wie op het werkblad "50" in het oppervlakteveld typte zag "050" tot hij
 * het veld verliet. Omdat het bewust `type="text"` + `inputmode="decimal"` is
 * (CLAUDE.md) doet de browser dat niet voor ons.
 *
 * Het decimaalgedrag is hier het echte risico: dit component zit onder alle
 * oppervlakte-, lengte-, uren- en bedragvelden, en "0." en "0,5" moeten
 * tussenstappen blijven die je kúnt typen. Vandaar dat beide kanten hieronder
 * vastliggen.
 */
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AreaInput, NumberInput } from "@/components/ui/number-input";

/** Gestuurd veld, zoals de scope-formulieren het gebruiken. */
function Proef({
  start = 0,
  onChange,
}: {
  start?: number;
  onChange?: (waarde: number) => void;
}) {
  const [waarde, setWaarde] = useState(start);
  return (
    <AreaInput
      value={waarde}
      onChange={(nieuw) => {
        setWaarde(nieuw);
        onChange?.(nieuw);
      }}
      aria-label="Oppervlakte"
    />
  );
}

const veld = () => screen.getByLabelText("Oppervlakte") as HTMLInputElement;

describe("NumberInput — voorloopnul", () => {
  it("laat de default-0 verdwijnen zodra je een cijfer typt", async () => {
    const gebruiker = userEvent.setup();
    render(<Proef />);

    await gebruiker.click(veld());
    await gebruiker.keyboard("50");

    expect(veld().value).toBe("50");
  });

  it("houdt een enkele 0 heel zolang er geen cijfer achter komt", async () => {
    const gebruiker = userEvent.setup();
    render(<Proef />);

    await gebruiker.click(veld());

    expect(veld().value).toBe("0");
  });

  it("breekt het decimaalgedrag niet: 0. en 0.5 blijven typbaar", async () => {
    const gebruiker = userEvent.setup();
    render(<Proef />);

    await gebruiker.click(veld());
    await gebruiker.keyboard(".");
    expect(veld().value).toBe("0.");

    await gebruiker.keyboard("5");
    expect(veld().value).toBe("0.5");
  });

  it("laat een dubbel getikte nul de decimaal niet opeten", async () => {
    const gebruiker = userEvent.setup();
    render(<Proef />);

    await gebruiker.click(veld());
    await gebruiker.keyboard("0.5");

    // "00.5" → "0.5", nooit ".5"
    expect(veld().value).toBe("0.5");
  });

  it("meldt de getypte waarde ongewijzigd door aan de aanroeper", async () => {
    const gebruiker = userEvent.setup();
    const gemeld = vi.fn();
    render(<Proef onChange={gemeld} />);

    await gebruiker.click(veld());
    await gebruiker.keyboard("50");
    await gebruiker.tab();

    expect(gemeld).toHaveBeenCalledWith(50);
    expect(veld().value).toBe("50");
  });

  it("laat een negatief getal negatief blijven", async () => {
    const gebruiker = userEvent.setup();
    render(
      <NumberInput
        value={0}
        min={-100}
        onChange={() => {}}
        aria-label="Oppervlakte"
      />
    );

    await gebruiker.clear(veld());
    await gebruiker.keyboard("-05");

    expect(veld().value).toBe("-5");
  });
});
