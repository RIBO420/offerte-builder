/**
 * B1 (eindschouw 14 aug 2026): in de vrij-editor gooide "Naar offerte" onbewaard
 * werk weg — het was een `<Link>` die meteen navigeerde. Een toegevoegde regel
 * was daarna definitief verdwenen (0 posten terug op de offerte).
 *
 * Deze test bewaakt de nieuwe volgorde: eerst opslaan bij openstaande
 * wijzigingen, dán navigeren — en niet navigeren als het opslaan mislukt, want
 * dan zou het werk alsnog weg zijn.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";

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

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/offertes/off_1/vrij",
  useSearchParams: () => new URLSearchParams(),
}));

// De klantstrip heeft een eigen zoek-/statistiekstapel; die staat los van wat
// hier op het spel staat.
vi.mock("@/components/offerte/klant-koppel-strip", () => ({
  KlantKoppelStrip: () => null,
}));

const offerte = {
  _id: "off_1",
  offerteNummer: "OFF-2026-049",
  type: "aanleg" as const,
  status: "concept" as const,
  bron: "vrij" as const,
  regels: [],
  vrijeTeksten: undefined,
  kortingOpTotaal: undefined,
  klant: undefined,
};

type OpslaanArgs = { id: string; regels: unknown[] };
const opslaan = vi.fn(async (_args: OpslaanArgs) => null);
vi.mock("convex/react", () => ({
  useMutation: () => opslaan,
  // Alleen de offerte-query heeft hier data nodig (herkenbaar aan `{ id }`);
  // tekstblokken en het artikelbestand mogen leeg blijven.
  useQuery: (_ref: unknown, args?: unknown) =>
    typeof args === "object" && args !== null && "id" in args
      ? offerte
      : undefined,
}));

const { default: VrijeOfferteEditorPage } = await import(
  "@/app/(dashboard)/offertes/[id]/vrij/page"
);

// De pagina leest `params` met `use()`; die suspense moet binnen een awaited
// `act` oplossen, anders blijft de fallback staan.
async function toonEditor() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <VrijeOfferteEditorPage params={Promise.resolve({ id: "off_1" })} />
      </Suspense>
    );
  });
}

beforeEach(() => {
  push.mockClear();
  opslaan.mockClear();
  opslaan.mockImplementation(async () => null);
});

describe("vrij-editor: weg navigeren met onbewaard werk", () => {
  it("bewaart een toegevoegde regel voordat 'Naar offerte' navigeert", async () => {
    const gebruiker = userEvent.setup();
    await toonEditor();

    await screen.findByText("Vrije offerte OFF-2026-049");
    await gebruiker.click(
      await screen.findByRole("button", { name: /vrije regel/i })
    );

    await gebruiker.click(screen.getByRole("button", { name: /naar offerte/i }));

    await waitFor(() => expect(opslaan).toHaveBeenCalledTimes(1));
    expect(opslaan.mock.calls[0][0]).toMatchObject({ id: "off_1" });
    expect(opslaan.mock.calls[0][0].regels).toHaveLength(1);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/offertes/off_1"));
    // Opslaan moet vóór de navigatie gebeurd zijn, niet erna.
    expect(opslaan.mock.invocationCallOrder[0]).toBeLessThan(
      push.mock.invocationCallOrder[0]
    );
  });

  it("navigeert niet als het opslaan mislukt — het werk blijft in beeld", async () => {
    opslaan.mockImplementation(async () => {
      throw new Error("Netwerk weg");
    });
    const gebruiker = userEvent.setup();
    await toonEditor();

    await screen.findByText("Vrije offerte OFF-2026-049");
    await gebruiker.click(
      await screen.findByRole("button", { name: /vrije regel/i })
    );
    await gebruiker.click(screen.getByRole("button", { name: /naar offerte/i }));

    await waitFor(() => expect(opslaan).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  it("navigeert zonder opslaan als er niets gewijzigd is", async () => {
    const gebruiker = userEvent.setup();
    await toonEditor();

    await screen.findByText("Vrije offerte OFF-2026-049");
    await gebruiker.click(screen.getByRole("button", { name: /naar offerte/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/offertes/off_1"));
    expect(opslaan).not.toHaveBeenCalled();
  });
});
