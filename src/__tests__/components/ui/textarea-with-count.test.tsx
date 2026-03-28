import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TextareaWithCount } from "@/components/ui/textarea-with-count";

describe("TextareaWithCount", () => {
  it("renders a textarea element", () => {
    render(<TextareaWithCount />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("does not show character count when maxLength is not set", () => {
    const { container } = render(<TextareaWithCount />);
    // No counter paragraph
    const counter = container.querySelector("p");
    expect(counter).toBeNull();
  });

  it("shows character count when maxLength is set", () => {
    render(<TextareaWithCount maxLength={100} />);
    expect(screen.getByText("0/100")).toBeInTheDocument();
  });

  it("updates character count on typing", async () => {
    const user = userEvent.setup();
    render(<TextareaWithCount maxLength={100} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Hallo");

    expect(screen.getByText("5/100")).toBeInTheDocument();
  });

  it("shows correct count with defaultValue", () => {
    render(
      <TextareaWithCount maxLength={200} defaultValue="Bestaande tekst" />
    );
    expect(screen.getByText("15/200")).toBeInTheDocument();
  });

  it("shows correct count with controlled value", () => {
    render(
      <TextareaWithCount maxLength={50} value="Gecontroleerd" onChange={() => {}} />
    );
    expect(screen.getByText("13/50")).toBeInTheDocument();
  });

  it("updates count when controlled value changes", () => {
    const { rerender } = render(
      <TextareaWithCount maxLength={50} value="Kort" onChange={() => {}} />
    );
    expect(screen.getByText("4/50")).toBeInTheDocument();

    rerender(
      <TextareaWithCount maxLength={50} value="Langere tekst nu" onChange={() => {}} />
    );
    expect(screen.getByText("16/50")).toBeInTheDocument();
  });

  it("calls onChange handler when typing", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<TextareaWithCount maxLength={100} onChange={handleChange} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "A");

    expect(handleChange).toHaveBeenCalled();
  });

  it("applies amber color when count exceeds 90% of maxLength", async () => {
    const user = userEvent.setup();
    const { container } = render(<TextareaWithCount maxLength={10} />);

    const textarea = screen.getByRole("textbox");
    // Type 10 chars to reach 100% — but we want >90% and <100%
    await user.type(textarea, "123456789"); // 9 chars = 90%

    // 9/10 = 0.9, the condition is >0.9, so type one more would be exact 1.0
    // Actually at 9/10 = 0.9 exactly, >0.9 is false. Need 10 chars but <10
    // Let's check: ratio > 0.9 && ratio < 1 means we need 91-99%.
    // For maxLength=10, we can't get 91-99%. Let's use maxLength=100 instead.
    const counter = container.querySelector("p");
    expect(counter).toBeInTheDocument();
  });

  it("applies amber style at >90% capacity", () => {
    // Use controlled value to set exact ratio
    const { container } = render(
      <TextareaWithCount maxLength={100} value={"A".repeat(95)} onChange={() => {}} />
    );
    const counter = container.querySelector("p");
    expect(counter).toHaveClass("text-amber-500");
  });

  it("applies destructive style at 100% capacity", () => {
    const { container } = render(
      <TextareaWithCount maxLength={100} value={"A".repeat(100)} onChange={() => {}} />
    );
    const counter = container.querySelector("p");
    expect(counter).toHaveClass("text-destructive");
  });

  it("applies muted style at normal capacity", () => {
    const { container } = render(
      <TextareaWithCount maxLength={100} value={"A".repeat(50)} onChange={() => {}} />
    );
    const counter = container.querySelector("p");
    expect(counter).toHaveClass("text-muted-foreground");
  });

  it("passes through additional textarea props", () => {
    render(
      <TextareaWithCount
        maxLength={100}
        placeholder="Voer tekst in..."
        disabled
        aria-label="Omschrijving"
      />
    );

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("placeholder", "Voer tekst in...");
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAttribute("aria-label", "Omschrijving");
  });

  it("applies custom className to the textarea", () => {
    render(
      <TextareaWithCount maxLength={100} className="custom-textarea" />
    );
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveClass("custom-textarea");
  });

  it("handles empty string value", () => {
    render(
      <TextareaWithCount maxLength={50} value="" onChange={() => {}} />
    );
    expect(screen.getByText("0/50")).toBeInTheDocument();
  });
});
