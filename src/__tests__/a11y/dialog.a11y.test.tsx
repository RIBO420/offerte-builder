import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, it, expect } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

describe("Dialog accessibility", () => {
  it("open dialog with title and description has no a11y violations", async () => {
    const { container } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Offerte verwijderen</DialogTitle>
            <DialogDescription>
              Weet u zeker dat u deze offerte wilt verwijderen? Dit kan niet
              ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline">Annuleren</Button>
            <Button variant="destructive">Verwijderen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("dialog with form content has no a11y violations", async () => {
    const { container } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Klant toevoegen</DialogTitle>
            <DialogDescription>
              Vul de gegevens in om een nieuwe klant toe te voegen.
            </DialogDescription>
          </DialogHeader>
          <form>
            <label htmlFor="naam">Naam</label>
            <input id="naam" type="text" />
          </form>
          <DialogFooter>
            <Button type="submit">Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
