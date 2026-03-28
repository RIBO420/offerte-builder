import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GrondwerkForm } from "@/components/offerte/scope-forms/grondwerk-form";
import type { GrondwerkData } from "@/types/offerte";

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
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const defaultData: GrondwerkData = {
  oppervlakte: 0,
  diepte: "standaard",
  afvoerGrond: false,
};

function renderForm(
  overrides: Partial<GrondwerkData> = {},
  props: { onChange?: (d: GrondwerkData) => void; onValidationChange?: (v: boolean, e: Record<string, string>) => void } = {}
) {
  const onChange = props.onChange ?? vi.fn();
  const onValidationChange = props.onValidationChange ?? vi.fn();

  const result = render(
    <TooltipProvider>
      <GrondwerkForm
        data={{ ...defaultData, ...overrides }}
        onChange={onChange}
        onValidationChange={onValidationChange}
      />
    </TooltipProvider>
  );

  return { ...result, onChange, onValidationChange };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("GrondwerkForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    renderForm();
    expect(screen.getByText("Grondwerk")).toBeInTheDocument();
  });

  it("displays the card title and description", () => {
    renderForm();
    expect(screen.getByText("Grondwerk")).toBeInTheDocument();
    expect(
      screen.getByText("Ontgraven, afvoer en machine-uren")
    ).toBeInTheDocument();
  });

  it("renders all form field labels", () => {
    renderForm();
    expect(screen.getByText("Oppervlakte")).toBeInTheDocument();
    expect(screen.getByText("Diepte")).toBeInTheDocument();
    expect(screen.getByText("Afvoer grond")).toBeInTheDocument();
  });

  it("renders the diepte select with default value", () => {
    renderForm({ diepte: "standaard" });
    // Radix Select renders both a visible trigger value and a hidden native option
    const matches = screen.getAllByText("Standaard (15-30 cm)");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the diepte description text", () => {
    renderForm();
    expect(
      screen.getByText("Diepte bepaalt de benodigde machine-uren en arbeid")
    ).toBeInTheDocument();
  });

  it("renders the afvoer grond description", () => {
    renderForm();
    expect(
      screen.getByText("Grond afvoeren naar depot")
    ).toBeInTheDocument();
  });

  it("uses provided default values", () => {
    renderForm({ diepte: "zwaar" });
    const matches = screen.getAllByText("Zwaar (30+ cm)");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows licht diepte when selected as default", () => {
    renderForm({ diepte: "licht" });
    const matches = screen.getAllByText("Licht (0-15 cm)");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("does not show estimated volume when afvoer is off", () => {
    renderForm({ oppervlakte: 50, afvoerGrond: false });
    expect(screen.queryByText(/Geschatte afvoer/)).not.toBeInTheDocument();
  });

  it("shows estimated volume when afvoer is enabled and oppervlakte > 0", () => {
    // With standaard diepte (0.25 multiplier) and 50m², expected = 12.5 m³
    renderForm({ oppervlakte: 50, afvoerGrond: true, diepte: "standaard" });
    expect(screen.getByText(/Geschatte afvoer.*12\.5 m³/)).toBeInTheDocument();
  });

  it("calculates estimated volume correctly for licht diepte", () => {
    // With licht diepte (0.15 multiplier) and 100m², expected = 15.0 m³
    renderForm({ oppervlakte: 100, afvoerGrond: true, diepte: "licht" });
    expect(screen.getByText(/Geschatte afvoer.*15\.0 m³/)).toBeInTheDocument();
  });

  it("calculates estimated volume correctly for zwaar diepte", () => {
    // With zwaar diepte (0.40 multiplier) and 20m², expected = 8.0 m³
    renderForm({ oppervlakte: 20, afvoerGrond: true, diepte: "zwaar" });
    expect(screen.getByText(/Geschatte afvoer.*8\.0 m³/)).toBeInTheDocument();
  });

  it("calls onChange when the switch is toggled", async () => {
    const onChange = vi.fn();
    renderForm({ oppervlakte: 10 }, { onChange });

    const toggle = screen.getByRole("switch");
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ afvoerGrond: true })
      );
    });
  });

  it("has an oppervlakte input element", () => {
    renderForm();
    const input = document.getElementById("grondwerk-oppervlakte");
    expect(input).toBeInTheDocument();
  });

  it("has a diepte select trigger", () => {
    renderForm();
    const trigger = document.getElementById("grondwerk-diepte");
    expect(trigger).toBeInTheDocument();
  });
});
