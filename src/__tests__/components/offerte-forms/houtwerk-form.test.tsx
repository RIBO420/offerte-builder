import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HoutwerkForm } from "@/components/offerte/scope-forms/houtwerk-form";
import type { HoutwerkData } from "@/types/offerte";

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

const defaultData: HoutwerkData = {
  typeHoutwerk: "schutting",
  afmeting: 0,
  fundering: "standaard",
};

function renderForm(
  overrides: Partial<HoutwerkData> = {},
  props: { onChange?: (d: HoutwerkData) => void; onValidationChange?: (v: boolean, e: Record<string, string>) => void } = {}
) {
  const onChange = props.onChange ?? vi.fn();
  const onValidationChange = props.onValidationChange ?? vi.fn();

  const result = render(
    <TooltipProvider>
      <HoutwerkForm
        data={{ ...defaultData, ...overrides }}
        onChange={onChange}
        onValidationChange={onValidationChange}
      />
    </TooltipProvider>
  );

  return { ...result, onChange, onValidationChange };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("HoutwerkForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    renderForm();
    expect(screen.getByText("Houtwerk")).toBeInTheDocument();
  });

  it("displays card title and description", () => {
    renderForm();
    expect(screen.getByText("Houtwerk")).toBeInTheDocument();
    expect(
      screen.getByText("Schutting, vlonder of pergola")
    ).toBeInTheDocument();
  });

  it("renders all form field labels", () => {
    renderForm();
    expect(screen.getByText("Type houtwerk")).toBeInTheDocument();
    // For schutting, the afmeting label should be "Lengte"
    expect(screen.getByText("Lengte")).toBeInTheDocument();
    expect(screen.getByText("Fundering type")).toBeInTheDocument();
  });

  it("shows the mandatory fundering section", () => {
    renderForm();
    expect(screen.getByText("Fundering (Verplicht)")).toBeInTheDocument();
    expect(
      screen.getByText("Wordt automatisch meegenomen in de offerte")
    ).toBeInTheDocument();
  });

  it("shows Schutting as the default type", () => {
    renderForm({ typeHoutwerk: "schutting" });
    // Radix Select renders both a visible trigger value and a hidden native option
    const matches = screen.getAllByText("Schutting");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows standaard fundering description by default", () => {
    renderForm({ fundering: "standaard" });
    expect(
      screen.getByText("Geschikt voor standaard constructies")
    ).toBeInTheDocument();
  });

  it("shows zwaar fundering description when zwaar is selected", () => {
    renderForm({ fundering: "zwaar" });
    expect(
      screen.getByText("Aanbevolen voor hoge schuttingen of slappe grond")
    ).toBeInTheDocument();
  });

  it("shows correct afmeting label for schutting (Lengte)", () => {
    renderForm({ typeHoutwerk: "schutting" });
    expect(screen.getByText("Lengte")).toBeInTheDocument();
    expect(
      screen.getByText("Totale lengte van de schutting")
    ).toBeInTheDocument();
  });

  it("shows correct afmeting label for vlonder (Oppervlakte)", () => {
    renderForm({ typeHoutwerk: "vlonder" });
    expect(screen.getByText("Oppervlakte")).toBeInTheDocument();
    expect(screen.getByText("Totale oppervlakte")).toBeInTheDocument();
  });

  it("shows correct afmeting label for pergola (Oppervlakte)", () => {
    renderForm({ typeHoutwerk: "pergola" });
    expect(screen.getByText("Oppervlakte")).toBeInTheDocument();
  });

  it("does not show indication when afmeting is 0", () => {
    renderForm({ afmeting: 0 });
    expect(screen.queryByText(/Indicatie:/)).not.toBeInTheDocument();
  });

  it("shows palen/poeren indication for schutting when afmeting > 0", () => {
    // 10m / 1.8 = ceil(5.56) = 6 palen
    renderForm({ typeHoutwerk: "schutting", afmeting: 10 });
    expect(screen.getByText(/~6 palen\/poeren/)).toBeInTheDocument();
  });

  it("shows regelwerk/poeren indication for vlonder when afmeting > 0", () => {
    // 5m² * 3 = 15m regelwerk, ceil(5/0.6) = 9 poeren
    renderForm({ typeHoutwerk: "vlonder", afmeting: 5 });
    expect(screen.getByText(/~15m regelwerk/)).toBeInTheDocument();
    expect(screen.getByText(/~9 poeren/)).toBeInTheDocument();
  });

  it("shows staanders/poeren indication for pergola when afmeting > 0", () => {
    renderForm({ typeHoutwerk: "pergola", afmeting: 12 });
    expect(screen.getByText(/~4 staanders\/poeren/)).toBeInTheDocument();
  });

  it("calls onChange when form fields are modified", async () => {
    const onChange = vi.fn();
    renderForm({ typeHoutwerk: "schutting", afmeting: 5 }, { onChange });

    // Type into the afmeting input to trigger watch subscription
    const input = document.getElementById("houtwerk-afmeting") as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "10");

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });

  it("has a type select trigger element", () => {
    renderForm();
    const trigger = document.getElementById("houtwerk-type");
    expect(trigger).toBeInTheDocument();
  });

  it("has an afmeting input element", () => {
    renderForm();
    const input = document.getElementById("houtwerk-afmeting");
    expect(input).toBeInTheDocument();
  });

  it("has a fundering select trigger element", () => {
    renderForm();
    const trigger = document.getElementById("houtwerk-fundering");
    expect(trigger).toBeInTheDocument();
  });
});
