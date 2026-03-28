import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  SaveIndicator,
  CompactSaveIndicator,
} from "@/components/ui/save-indicator";

describe("SaveIndicator", () => {
  it("shows saving state with spinner text", () => {
    render(
      <SaveIndicator isSaving={true} isDirty={false} lastSaved={null} />
    );
    expect(screen.getByText("Opslaan...")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has accessible description for saving state", () => {
    render(
      <SaveIndicator isSaving={true} isDirty={false} lastSaved={null} />
    );
    expect(
      screen.getByText("Wijzigingen worden opgeslagen")
    ).toBeInTheDocument();
    // The sr-only text should exist
    const srOnly = screen.getByText("Wijzigingen worden opgeslagen");
    expect(srOnly).toHaveClass("sr-only");
  });

  it("shows dirty state with unsaved changes message", () => {
    render(
      <SaveIndicator isSaving={false} isDirty={true} lastSaved={null} />
    );
    expect(
      screen.getByText("Niet-opgeslagen wijzigingen")
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has accessible description for dirty state", () => {
    render(
      <SaveIndicator isSaving={false} isDirty={true} lastSaved={null} />
    );
    expect(
      screen.getByText("Er zijn niet-opgeslagen wijzigingen")
    ).toBeInTheDocument();
  });

  it("shows saved state with formatted time", () => {
    const savedDate = new Date(2026, 2, 28, 14, 30); // 14:30
    render(
      <SaveIndicator
        isSaving={false}
        isDirty={false}
        lastSaved={savedDate}
      />
    );
    // The formatted time should appear
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status.textContent).toContain("Opgeslagen om");
  });

  it("returns null when no state applies", () => {
    const { container } = render(
      <SaveIndicator isSaving={false} isDirty={false} lastSaved={null} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("saving takes priority over dirty", () => {
    render(
      <SaveIndicator isSaving={true} isDirty={true} lastSaved={null} />
    );
    expect(screen.getByText("Opslaan...")).toBeInTheDocument();
    expect(
      screen.queryByText("Niet-opgeslagen wijzigingen")
    ).not.toBeInTheDocument();
  });

  it("dirty takes priority over saved", () => {
    const savedDate = new Date();
    render(
      <SaveIndicator
        isSaving={false}
        isDirty={true}
        lastSaved={savedDate}
      />
    );
    expect(
      screen.getByText("Niet-opgeslagen wijzigingen")
    ).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(
      <SaveIndicator
        isSaving={true}
        isDirty={false}
        lastSaved={null}
        className="my-custom-class"
      />
    );
    expect(screen.getByRole("status")).toHaveClass("my-custom-class");
  });

  it("uses aria-live polite for status updates", () => {
    render(
      <SaveIndicator isSaving={true} isDirty={false} lastSaved={null} />
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});

describe("CompactSaveIndicator", () => {
  it("returns null when no state applies", () => {
    const { container } = render(
      <CompactSaveIndicator
        isSaving={false}
        isDirty={false}
        lastSaved={null}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows spinner with title when saving", () => {
    render(
      <CompactSaveIndicator
        isSaving={true}
        isDirty={false}
        lastSaved={null}
      />
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("title", "Opslaan...");
  });

  it("shows orange dot with title when dirty", () => {
    render(
      <CompactSaveIndicator
        isSaving={false}
        isDirty={true}
        lastSaved={null}
      />
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute(
      "title",
      "Niet-opgeslagen wijzigingen"
    );
  });

  it("shows check with title when saved", () => {
    const savedDate = new Date(2026, 2, 28, 9, 15);
    render(
      <CompactSaveIndicator
        isSaving={false}
        isDirty={false}
        lastSaved={savedDate}
      />
    );
    const status = screen.getByRole("status");
    expect(status.getAttribute("title")).toContain("Opgeslagen om");
  });

  it("has sr-only text for screen readers", () => {
    render(
      <CompactSaveIndicator
        isSaving={true}
        isDirty={false}
        lastSaved={null}
      />
    );
    const srText = screen.getByText("Opslaan...");
    expect(srText).toHaveClass("sr-only");
  });

  it("saving state takes priority over dirty in compact mode", () => {
    render(
      <CompactSaveIndicator
        isSaving={true}
        isDirty={true}
        lastSaved={null}
      />
    );
    expect(screen.getByRole("status")).toHaveAttribute(
      "title",
      "Opslaan..."
    );
  });

  it("applies custom className", () => {
    render(
      <CompactSaveIndicator
        isSaving={true}
        isDirty={false}
        lastSaved={null}
        className="compact-class"
      />
    );
    expect(screen.getByRole("status")).toHaveClass("compact-class");
  });
});
