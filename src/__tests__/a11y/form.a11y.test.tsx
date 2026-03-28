import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, it, expect } from "vitest";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

describe("Form accessibility", () => {
  it("basic form with labeled inputs has no a11y violations", async () => {
    const { container } = render(
      <form aria-label="Klantgegevens">
        <div>
          <Label htmlFor="voornaam">Voornaam</Label>
          <Input id="voornaam" type="text" placeholder="Jan" />
        </div>
        <div>
          <Label htmlFor="achternaam">Achternaam</Label>
          <Input id="achternaam" type="text" placeholder="Jansen" />
        </div>
        <div>
          <Label htmlFor="email">E-mailadres</Label>
          <Input id="email" type="email" placeholder="jan@voorbeeld.nl" />
        </div>
        <Button type="submit">Opslaan</Button>
      </form>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("form with required fields has no a11y violations", async () => {
    const { container } = render(
      <form aria-label="Contactformulier">
        <div>
          <Label htmlFor="naam-required">
            Naam <span aria-label="verplicht">*</span>
          </Label>
          <Input id="naam-required" type="text" required aria-required="true" />
        </div>
        <div>
          <Label htmlFor="telefoon">Telefoonnummer</Label>
          <Input id="telefoon" type="tel" />
        </div>
        <Button type="submit">Versturen</Button>
      </form>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("form with fieldset and legend has no a11y violations", async () => {
    const { container } = render(
      <form aria-label="Adresgegevens">
        <fieldset>
          <legend>Adres</legend>
          <div>
            <Label htmlFor="straat">Straat</Label>
            <Input id="straat" type="text" />
          </div>
          <div>
            <Label htmlFor="postcode">Postcode</Label>
            <Input id="postcode" type="text" />
          </div>
          <div>
            <Label htmlFor="stad">Stad</Label>
            <Input id="stad" type="text" />
          </div>
        </fieldset>
        <Button type="submit">Opslaan</Button>
      </form>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("form with disabled fields has no a11y violations", async () => {
    const { container } = render(
      <form aria-label="Vergrendeld formulier">
        <div>
          <Label htmlFor="readonly-veld">Referentienummer</Label>
          <Input id="readonly-veld" type="text" disabled value="REF-2026-001" />
        </div>
        <Button disabled>Opslaan</Button>
      </form>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
