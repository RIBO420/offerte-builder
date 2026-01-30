import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateAriaId,
  prefersReducedMotion,
  KEYBOARD_KEYS,
  ARIA_MESSAGES,
} from "@/lib/accessibility";

describe("generateAriaId", () => {
  it("generates unique IDs with default prefix", () => {
    const id1 = generateAriaId();
    const id2 = generateAriaId();

    expect(id1).toMatch(/^aria-\d+$/);
    expect(id2).toMatch(/^aria-\d+$/);
    expect(id1).not.toBe(id2);
  });

  it("uses custom prefix", () => {
    const id = generateAriaId("modal");
    expect(id).toMatch(/^modal-\d+$/);
  });
});

describe("prefersReducedMotion", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Mock matchMedia since jsdom doesn't have it
    window.matchMedia = vi.fn();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("returns true when prefers-reduced-motion is set", () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: true,
    } as MediaQueryList);

    expect(prefersReducedMotion()).toBe(true);
  });

  it("returns false when prefers-reduced-motion is not set", () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: false,
    } as MediaQueryList);

    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("KEYBOARD_KEYS", () => {
  it("has all expected keys", () => {
    expect(KEYBOARD_KEYS.ENTER).toBe("Enter");
    expect(KEYBOARD_KEYS.SPACE).toBe(" ");
    expect(KEYBOARD_KEYS.ESCAPE).toBe("Escape");
    expect(KEYBOARD_KEYS.TAB).toBe("Tab");
    expect(KEYBOARD_KEYS.ARROW_UP).toBe("ArrowUp");
    expect(KEYBOARD_KEYS.ARROW_DOWN).toBe("ArrowDown");
    expect(KEYBOARD_KEYS.ARROW_LEFT).toBe("ArrowLeft");
    expect(KEYBOARD_KEYS.ARROW_RIGHT).toBe("ArrowRight");
    expect(KEYBOARD_KEYS.HOME).toBe("Home");
    expect(KEYBOARD_KEYS.END).toBe("End");
  });
});

describe("ARIA_MESSAGES", () => {
  it("has Dutch loading messages", () => {
    expect(ARIA_MESSAGES.loading).toBe("Laden...");
    expect(ARIA_MESSAGES.loaded).toBe("Inhoud geladen");
    expect(ARIA_MESSAGES.saved).toBe("Opgeslagen");
    expect(ARIA_MESSAGES.deleted).toBe("Verwijderd");
  });

  it("has Dutch form messages", () => {
    expect(ARIA_MESSAGES.formInvalid).toBe("Formulier bevat fouten");
    expect(ARIA_MESSAGES.formValid).toBe("Formulier is correct ingevuld");
  });

  it("has dynamic message functions", () => {
    expect(ARIA_MESSAGES.itemSelected("Product")).toBe("Product geselecteerd");
    expect(ARIA_MESSAGES.itemsSelected(5)).toBe("5 items geselecteerd");
    expect(ARIA_MESSAGES.pageChanged(3)).toBe("Pagina 3");
    expect(ARIA_MESSAGES.sortedBy("Naam", "asc")).toBe(
      "Gesorteerd op Naam, oplopend"
    );
    expect(ARIA_MESSAGES.sortedBy("Naam", "desc")).toBe(
      "Gesorteerd op Naam, aflopend"
    );
  });

  it("has search results messages", () => {
    expect(ARIA_MESSAGES.searchResults(0)).toBe("Geen resultaten gevonden");
    expect(ARIA_MESSAGES.searchResults(1)).toBe("1 resultaat gevonden");
    expect(ARIA_MESSAGES.searchResults(10)).toBe("10 resultaten gevonden");
  });
});
