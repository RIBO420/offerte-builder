/**
 * De fotoviewer voor tijdlijn-bijlagen. Foto's waren eerder kale <img>'s: niet
 * aanklikbaar, niet met Tab bereikbaar, en niet groter te bekijken.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FotoViewer } from "@/components/ui/foto-viewer";

beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
});

const FOTOS = [
  { url: "https://voorbeeld.test/1.jpg", alt: "Foto 1" },
  { url: "https://voorbeeld.test/2.jpg", alt: "Foto 2" },
  { url: "https://voorbeeld.test/3.jpg", alt: "Foto 3" },
];

/** Bootst de aanroeper na: miniaturen die de viewer op een index openen. */
function Proefopstelling({ fotos = FOTOS }: { fotos?: typeof FOTOS }) {
  const [index, setIndex] = useState<number | null>(null);
  return (
    <div>
      {fotos.map((foto, i) => (
        <button key={foto.url} type="button" onClick={() => setIndex(i)}>
          {`open ${i + 1}`}
        </button>
      ))}
      <FotoViewer fotos={fotos} index={index} onIndexChange={setIndex} />
    </div>
  );
}

describe("FotoViewer", () => {
  it("is dicht zolang er geen index is", () => {
    render(<Proefopstelling />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opent op de aangeklikte foto en toont de teller", async () => {
    const user = userEvent.setup();
    render(<Proefopstelling />);

    await user.click(screen.getByText("open 2"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByAltText("Foto 2")).toHaveAttribute(
      "src",
      "https://voorbeeld.test/2.jpg"
    );
    expect(screen.getByText("2 van 3")).toBeInTheDocument();
  });

  it("bladert met de pijltjestoetsen en loopt rond", async () => {
    const user = userEvent.setup();
    render(<Proefopstelling />);
    await user.click(screen.getByText("open 3"));
    await screen.findByRole("dialog");

    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByAltText("Foto 1")).toBeInTheDocument()
    );

    await user.keyboard("{ArrowLeft}");
    await waitFor(() =>
      expect(screen.getByAltText("Foto 3")).toBeInTheDocument()
    );
  });

  it("bladert met de pijlknoppen", async () => {
    const user = userEvent.setup();
    render(<Proefopstelling />);
    await user.click(screen.getByText("open 1"));
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Volgende foto" }));
    await waitFor(() =>
      expect(screen.getByAltText("Foto 2")).toBeInTheDocument()
    );
  });

  it("toont geen pijlen of teller bij één foto", async () => {
    const user = userEvent.setup();
    render(<Proefopstelling fotos={[FOTOS[0]]} />);
    await user.click(screen.getByText("open 1"));
    await screen.findByRole("dialog");

    expect(screen.queryByRole("button", { name: /vorige foto/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /volgende foto/i })).toBeNull();
    expect(screen.queryByText(/van 1/)).toBeNull();
  });

  it("sluit met Escape en zet de focus terug op de miniatuur", async () => {
    const user = userEvent.setup();
    render(<Proefopstelling />);
    const knop = screen.getByText("open 2");
    await user.click(knop);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Zonder deze herstelstap beland je op <body> en ben je je plek kwijt.
    await waitFor(() => expect(document.activeElement).toBe(knop));
  });
});
