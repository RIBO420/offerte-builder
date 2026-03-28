import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
  it("renders with required title only", () => {
    render(<EmptyState title="Geen resultaten" />);
    expect(
      screen.getByRole("heading", { name: "Geen resultaten" })
    ).toBeInTheDocument();
  });

  it("renders title and description", () => {
    render(
      <EmptyState
        title="Geen offertes"
        description="Er zijn nog geen offertes aangemaakt."
      />
    );
    expect(
      screen.getByRole("heading", { name: "Geen offertes" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Er zijn nog geen offertes aangemaakt.")
    ).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(
      <EmptyState
        title="Leeg"
        icon={<svg data-testid="test-icon" aria-hidden="true" />}
      />
    );
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("does not render icon wrapper when no icon provided", () => {
    const { container } = render(<EmptyState title="Leeg" />);
    // The icon wrapper div with size-16 should not exist
    const iconWrapper = container.querySelector(".size-16");
    expect(iconWrapper).toBeNull();
  });

  it("renders primary action button", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState
        title="Geen klanten"
        action={{ label: "Klant toevoegen", onClick: handleClick }}
      />
    );

    const button = screen.getByRole("button", { name: "Klant toevoegen" });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("renders primary action with outline variant", () => {
    render(
      <EmptyState
        title="Leeg"
        action={{
          label: "Actie",
          onClick: vi.fn(),
          variant: "outline",
        }}
      />
    );
    // The button should exist
    expect(
      screen.getByRole("button", { name: "Actie" })
    ).toBeInTheDocument();
  });

  it("renders secondary action", async () => {
    const handleSecondary = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState
        title="Leeg"
        secondaryAction={{
          label: "Meer informatie",
          onClick: handleSecondary,
        }}
      />
    );

    const secondaryButton = screen.getByRole("button", {
      name: "Meer informatie",
    });
    expect(secondaryButton).toBeInTheDocument();

    await user.click(secondaryButton);
    expect(handleSecondary).toHaveBeenCalledOnce();
  });

  it("renders both primary and secondary actions together", () => {
    render(
      <EmptyState
        title="Leeg"
        action={{ label: "Primair", onClick: vi.fn() }}
        secondaryAction={{ label: "Secundair", onClick: vi.fn() }}
      />
    );
    expect(
      screen.getByRole("button", { name: "Primair" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Secundair" })
    ).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    const { container } = render(<EmptyState title="Leeg" />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBe(0);
  });

  it("applies custom className", () => {
    const { container } = render(
      <EmptyState title="Leeg" className="my-custom-class" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("my-custom-class");
  });

  it("centers title text", () => {
    render(<EmptyState title="Gecentreerd" />);
    const heading = screen.getByRole("heading", { name: "Gecentreerd" });
    expect(heading).toHaveClass("text-center");
  });

  it("handles long title and description without breaking", () => {
    const longTitle = "Dit is een heel lange titel ".repeat(10).trim();
    const longDesc = "Een uitgebreide omschrijving ".repeat(20).trim();
    render(<EmptyState title={longTitle} description={longDesc} />);
    expect(screen.getByRole("heading")).toHaveTextContent(longTitle);
    expect(screen.getByText(longDesc)).toBeInTheDocument();
  });
});
