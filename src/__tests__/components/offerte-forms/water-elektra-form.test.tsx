import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WaterElektraForm } from "@/components/offerte/scope-forms/water-elektra-form";
import type { WaterElektraData } from "@/types/offerte";

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

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const defaultData: WaterElektraData = {
  verlichting: "geen",
  aantalPunten: 0,
  sleuvenNodig: true,
};

function renderForm(
  overrides: Partial<WaterElektraData> = {},
  props: { onChange?: (d: WaterElektraData) => void; onValidationChange?: (v: boolean, e: Record<string, string>) => void } = {}
) {
  const onChange = props.onChange ?? vi.fn();
  const onValidationChange = props.onValidationChange ?? vi.fn();

  const result = render(
    <TooltipProvider>
      <WaterElektraForm
        data={{ ...defaultData, ...overrides }}
        onChange={onChange}
        onValidationChange={onValidationChange}
      />
    </TooltipProvider>
  );

  return { ...result, onChange, onValidationChange };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("WaterElektraForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    renderForm();
    expect(screen.getByText("Water / Elektra")).toBeInTheDocument();
  });

  it("displays card title and description", () => {
    renderForm();
    expect(screen.getByText("Water / Elektra")).toBeInTheDocument();
    expect(
      screen.getByText("Tuinverlichting, aansluitpunten en bekabeling")
    ).toBeInTheDocument();
  });

  it("renders all form field labels", () => {
    renderForm();
    expect(screen.getByText("Verlichting")).toBeInTheDocument();
    expect(screen.getByText("Aantal aansluitpunten")).toBeInTheDocument();
  });

  it("shows the description texts for fields", () => {
    renderForm();
    expect(
      screen.getByText("Sfeer- en functionele verlichting")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Stopcontacten, waterpunten, etc.")
    ).toBeInTheDocument();
  });

  it("shows the empty state hint when no elektra selected", () => {
    renderForm({ verlichting: "geen", aantalPunten: 0 });
    expect(
      screen.getByText("Selecteer verlichting of voeg aansluitpunten toe.")
    ).toBeInTheDocument();
  });

  it("shows verlichting select with default 'geen' value", () => {
    renderForm({ verlichting: "geen" });
    // Radix Select renders both a visible trigger value and a hidden native option
    const matches = screen.getAllByText("Geen verlichting");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows basis verlichting when selected", () => {
    renderForm({ verlichting: "basis" });
    const matches = screen.getAllByText("Basis (1-3 armaturen)");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows uitgebreid verlichting when selected", () => {
    renderForm({ verlichting: "uitgebreid" });
    const matches = screen.getAllByText("Uitgebreid (4+ armaturen)");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows the mandatory sleuven section when verlichting is selected", () => {
    renderForm({ verlichting: "basis", aantalPunten: 0 });
    expect(
      screen.getByText("Sleuven & Herstel (Verplicht)")
    ).toBeInTheDocument();
    expect(screen.getByText("Automatisch inbegrepen")).toBeInTheDocument();
  });

  it("shows the mandatory sleuven section when aantalPunten > 0", () => {
    renderForm({ verlichting: "geen", aantalPunten: 3 });
    expect(
      screen.getByText("Sleuven & Herstel (Verplicht)")
    ).toBeInTheDocument();
  });

  it("shows sleuven graven and herstelwerk labels when elektra active", () => {
    renderForm({ verlichting: "basis" });
    expect(screen.getByText("Sleuven graven")).toBeInTheDocument();
    expect(screen.getByText("Herstelwerk")).toBeInTheDocument();
  });

  it("calculates total punten correctly for basis verlichting", () => {
    // basis verlichting adds 2 punten, plus 3 custom = 5 total
    renderForm({ verlichting: "basis", aantalPunten: 3 });
    // Check the bekabeling estimate: 5 * 8 = 40m
    expect(screen.getByText(/~40 m/)).toBeInTheDocument();
  });

  it("calculates total punten correctly for uitgebreid verlichting", () => {
    // uitgebreid verlichting adds 5 punten, plus 2 custom = 7 total
    renderForm({ verlichting: "uitgebreid", aantalPunten: 2 });
    // Check the bekabeling estimate: 7 * 8 = 56m
    expect(screen.getByText(/~56 m/)).toBeInTheDocument();
  });

  it("shows 'Inbegrepen' labels in the mandatory section", () => {
    renderForm({ verlichting: "basis" });
    const inbegrepen = screen.getAllByText("Inbegrepen");
    expect(inbegrepen).toHaveLength(2); // sleuven graven + herstelwerk
  });

  it("has a verlichting select trigger element", () => {
    renderForm();
    const trigger = document.getElementById("elektra-verlichting");
    expect(trigger).toBeInTheDocument();
  });

  it("has an aantalPunten input element", () => {
    renderForm();
    const input = document.getElementById("elektra-punten");
    expect(input).toBeInTheDocument();
  });

  it("calls onChange when form fields are modified", async () => {
    const onChange = vi.fn();
    renderForm({ verlichting: "geen", aantalPunten: 0 }, { onChange });

    // Type into the aantalPunten input to trigger watch subscription
    const input = document.getElementById("elektra-punten") as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "3");

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });
});
