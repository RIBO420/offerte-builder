import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RegelBeschrijving } from "@/components/offerte/vrije-builder/regel-beschrijving";

describe("RegelBeschrijving (beschrijving op offerte in de vrije editor)", () => {
  it("ingeklapt: toont een voorproefje van de eerste regel", () => {
    render(<RegelBeschrijving tekst={"Wij verzorgen de renovatie.\n- Verticuteren"} onChange={vi.fn()} />);
    const knop = screen.getByRole("button", { name: /Beschrijving op offerte/ });
    expect(knop).toHaveAttribute("aria-expanded", "false");
    expect(knop).toHaveTextContent("Wij verzorgen de renovatie.");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("zonder tekst: knop om een beschrijving toe te voegen", () => {
    render(<RegelBeschrijving tekst={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Beschrijving toevoegen/ })).toBeInTheDocument();
  });

  it("uitklappen, aanpassen en weghalen", () => {
    const onChange = vi.fn();
    render(<RegelBeschrijving tekst="Oude tekst" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Beschrijving op offerte/ }));
    const veld = screen.getByRole("textbox", { name: "Beschrijving op offerte" });
    expect(veld).toHaveValue("Oude tekst");

    fireEvent.change(veld, { target: { value: "Nieuwe tekst" } });
    expect(onChange).toHaveBeenLastCalledWith("Nieuwe tekst");

    fireEvent.change(veld, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(undefined);

    fireEvent.click(screen.getByRole("button", { name: "Weghalen" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
