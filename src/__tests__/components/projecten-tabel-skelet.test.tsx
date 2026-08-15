/**
 * Het skelet van de projectentabel.
 *
 * `/projecten` toonde een kale tussenstaat: de generieke `ListSkeleton` tekende
 * vijf losse kaartjes waar een tabel komt, dus het scherm sprong twee keer.
 * Wat hier vastligt is de reden dat dit skelet niet is nagebouwd maar van
 * dezelfde bouwstenen is gemaakt: zelfde kaart, zelfde tabel, zelfde vier
 * kolomkoppen. Zolang die gelijk zijn, zijn de eindafmetingen gelijk — gemeten
 * op de echte pagina: kopregel 40px, rij 49px, kaart = rijen×49 + 40 + 48
 * kaartpadding (11 rijen → 628,5px, 3 rijen → 236,5px).
 *
 * Het rijaantal komt uit de teller-query, die meestal eerder binnen is dan de
 * lijst zelf. Daarom is de klem eromheen (1…25) een gedragsafspraak en geen
 * detail: 0 rijen leest als een kapotte kaart, meer dan 25 belooft een lijst
 * die de eerste pagina niet kan waarmaken.
 */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ProjectenTabelSkelet } from "@/app/(dashboard)/projecten/components/projecten-tabel-skelet";

const rijen = () =>
  within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("ProjectenTabelSkelet", () => {
  it("meldt zich als laadstaat aan hulptechnologie", () => {
    render(<ProjectenTabelSkelet />);

    const staat = screen.getByRole("status");
    expect(staat).toHaveAttribute("aria-busy", "true");
    expect(staat).toHaveTextContent("Projecten laden…");
  });

  it("zet dezelfde vier kolomkoppen neer als de echte tabel", () => {
    render(<ProjectenTabelSkelet />);

    const koppen = screen.getAllByRole("columnheader").map((k) => k.textContent);
    expect(koppen).toEqual([
      "Project",
      "Status",
      "Aangemaakt",
      "Laatst gewijzigd",
    ]);
  });

  it("volgt de teller, zodat het skelet even hoog staat als de tabel", () => {
    render(<ProjectenTabelSkelet aantal={11} />);

    expect(rijen()).toHaveLength(11);
  });

  it("valt zonder teller terug op zes rijen", () => {
    render(<ProjectenTabelSkelet />);

    expect(rijen()).toHaveLength(6);
  });

  it("klemt op minstens één rij — een kaart zonder rijen leest als stuk", () => {
    render(<ProjectenTabelSkelet aantal={0} />);

    expect(rijen()).toHaveLength(1);
  });

  it("klemt op de paginagrootte van 25", () => {
    render(<ProjectenTabelSkelet aantal={400} />);

    expect(rijen()).toHaveLength(25);
  });
});
