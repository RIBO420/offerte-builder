import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BestratingForm } from "@/components/offerte/scope-forms/bestrating-form";
import type { BestratingData } from "@/types/offerte";

// ─── Mocks ──────────────────────────────────────────────────────────────────

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

vi.mock("@/hooks/use-smart-analytics", () => ({
  useScopePriceEstimate: () => ({
    priceRange: null,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-scope-form-sync", () => ({
  useFormValidationSync: vi.fn(),
  useFormValidationSyncNested: vi.fn(),
}));

// Mock crypto.randomUUID for zone creation
const mockRandomUUID = vi.fn(() => "test-uuid-1234");
vi.stubGlobal("crypto", { randomUUID: mockRandomUUID });

// ─── Helpers ────────────────────────────────────────────────────────────────

const defaultData: BestratingData = {
  oppervlakte: 0,
  typeBestrating: "tegel",
  snijwerk: "laag",
  onderbouw: {
    type: "zandbed",
    dikteOnderlaag: 5,
    opsluitbanden: false,
  },
};

function renderForm(
  overrides: Partial<BestratingData> = {},
  props: { onChange?: (d: BestratingData) => void; onValidationChange?: (v: boolean, e: Record<string, string>) => void } = {}
) {
  const onChange = props.onChange ?? vi.fn();
  const onValidationChange = props.onValidationChange ?? vi.fn();

  const data = {
    ...defaultData,
    ...overrides,
    onderbouw: {
      ...defaultData.onderbouw,
      ...(overrides.onderbouw ?? {}),
    },
  };

  const result = render(
    <TooltipProvider>
      <BestratingForm
        data={data}
        onChange={onChange}
        onValidationChange={onValidationChange}
      />
    </TooltipProvider>
  );

  return { ...result, onChange, onValidationChange };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("BestratingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Rendering ---

  it("renders without errors", () => {
    renderForm();
    expect(screen.getByText("Bestrating")).toBeInTheDocument();
  });

  it("displays the bestrating details card with description", () => {
    renderForm();
    expect(screen.getByText("Bestrating")).toBeInTheDocument();
    expect(
      screen.getByText("Tegels, klinkers of natuursteen")
    ).toBeInTheDocument();
  });

  it("renders the bestratingtype selector card", () => {
    renderForm();
    // "Type bestrating" appears both as the selector card title and form label
    const matches = screen.getAllByText("Type bestrating");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("Kies het type om automatisch de juiste fundering te berekenen")
    ).toBeInTheDocument();
  });

  it("shows all three bestratingtype radio options", () => {
    renderForm();
    expect(screen.getByText("Pad")).toBeInTheDocument();
    expect(screen.getByText("Oprit")).toBeInTheDocument();
    expect(screen.getByText("Terrein / Loods")).toBeInTheDocument();
  });

  it("shows descriptions for each bestratingtype option", () => {
    renderForm();
    expect(screen.getByText("Tuinpad, wandelpad of stoep")).toBeInTheDocument();
    expect(screen.getByText("Oprit of parkeerplaats voor auto's")).toBeInTheDocument();
    expect(screen.getByText("Bedrijfsterrein, loods of zwaar belast")).toBeInTheDocument();
  });

  // --- Form fields ---

  it("renders the oppervlakte input", () => {
    renderForm();
    const input = document.getElementById("bestrating-oppervlakte");
    expect(input).toBeInTheDocument();
  });

  it("renders the type bestrating select", () => {
    renderForm();
    const trigger = document.getElementById("bestrating-type");
    expect(trigger).toBeInTheDocument();
  });

  it("renders the snijwerk select", () => {
    renderForm();
    const trigger = document.getElementById("bestrating-snijwerk");
    expect(trigger).toBeInTheDocument();
  });

  it("shows snijwerk description text", () => {
    renderForm();
    expect(
      screen.getByText("Meer snijwerk = hogere arbeidsfactor")
    ).toBeInTheDocument();
  });

  // --- Onderbouw section ---

  it("renders the mandatory onderbouw section", () => {
    renderForm();
    expect(screen.getByText("Onderbouw (Verplicht)")).toBeInTheDocument();
    expect(
      screen.getByText("Wordt automatisch meegenomen in de offerte")
    ).toBeInTheDocument();
  });

  it("renders onderbouw type select", () => {
    renderForm();
    const trigger = document.getElementById("onderbouw-type");
    expect(trigger).toBeInTheDocument();
  });

  it("renders onderbouw dikte input", () => {
    renderForm();
    const input = document.getElementById("onderbouw-dikte");
    expect(input).toBeInTheDocument();
  });

  it("renders the opsluitbanden switch", () => {
    renderForm();
    expect(screen.getByText("Opsluitbanden")).toBeInTheDocument();
    expect(screen.getByText("Randafwerking met beton")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("shows onderbouw dikte description", () => {
    renderForm();
    expect(screen.getByText("Standaard: 5cm zand")).toBeInTheDocument();
  });

  // --- Zones section ---

  it("renders the bestratingzones card", () => {
    renderForm();
    expect(screen.getByText("Bestratingzones")).toBeInTheDocument();
  });

  it("shows the zone toevoegen button", () => {
    renderForm();
    expect(screen.getByText("Zone toevoegen")).toBeInTheDocument();
  });

  it("shows the empty zones message", () => {
    renderForm();
    expect(
      screen.getByText(/Nog geen zones toegevoegd/)
    ).toBeInTheDocument();
  });

  it("shows zones description", () => {
    renderForm();
    expect(
      screen.getByText(/Optioneel: definieer aparte zones/)
    ).toBeInTheDocument();
  });

  // --- Bestratingtype selection ---

  it("shows fundering visualisation when a bestratingtype is selected", async () => {
    renderForm();

    // Click on the "Pad" label which wraps the radio input
    const padLabel = screen.getByText("Pad");
    await userEvent.click(padLabel);

    await waitFor(() => {
      expect(screen.getByText("Berekende fundering")).toBeInTheDocument();
    });
  });

  // --- Default values ---

  it("renders with tegel as default type bestrating", () => {
    renderForm({ typeBestrating: "tegel" });
    // Radix Select renders both a visible trigger value and a hidden native option
    const matches = screen.getAllByText("Tegels");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders with laag as default snijwerk", () => {
    renderForm({ snijwerk: "laag" });
    const matches = screen.getAllByText("Laag (weinig hoeken)");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders with zandbed as default onderbouw type", () => {
    renderForm();
    const matches = screen.getAllByText("Zandbed");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  // --- Callbacks ---

  it("calls onChange when the opsluitbanden switch is toggled", async () => {
    const onChange = vi.fn();
    renderForm({ oppervlakte: 10 }, { onChange });

    const toggle = screen.getByRole("switch");
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          onderbouw: expect.objectContaining({ opsluitbanden: true }),
        })
      );
    });
  });

  it("calls onChange when zone toevoegen is clicked", async () => {
    const onChange = vi.fn();
    renderForm({}, { onChange });

    const addButton = screen.getByText("Zone toevoegen");
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          zones: expect.arrayContaining([
            expect.objectContaining({ id: "test-uuid-1234" }),
          ]),
        })
      );
    });
  });
});
