import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CopyButton } from "@/components/ui/copy-button";

// Mock the toast-utils module
vi.mock("@/lib/toast-utils", () => ({
  showSuccessToast: vi.fn(),
}));

// Mock the Tooltip components to simplify rendering
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    children,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="tooltip-content">{children}</span>
  ),
}));

describe("CopyButton", () => {
  const mockWriteText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders with default aria-label 'Kopieer'", () => {
    render(<CopyButton value="test" />);
    const button = screen.getByRole("button", { name: "Kopieer" });
    expect(button).toBeInTheDocument();
  });

  it("renders with custom label for aria-label", () => {
    render(<CopyButton value="hello" label="Kopieer e-mail" />);
    const button = screen.getByRole("button", { name: "Kopieer e-mail" });
    expect(button).toBeInTheDocument();
  });

  it("copies value to clipboard on click", async () => {
    render(<CopyButton value="some-value-to-copy" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kopieer" }));
    });

    expect(mockWriteText).toHaveBeenCalledWith("some-value-to-copy");
  });

  it("shows success toast after copying", async () => {
    const { showSuccessToast } = await import("@/lib/toast-utils");
    render(<CopyButton value="test-value" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kopieer" }));
    });

    expect(showSuccessToast).toHaveBeenCalledWith(
      "Gekopieerd naar klembord"
    );
  });

  it("shows check icon after successful copy", async () => {
    const { container } = render(<CopyButton value="test" />);

    // Before click: should show Copy icon (lucide-copy)
    expect(container.querySelector(".lucide-copy")).toBeInTheDocument();
    expect(container.querySelector(".lucide-check")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kopieer" }));
    });

    // After click: should show Check icon (lucide-check)
    expect(container.querySelector(".lucide-check")).toBeInTheDocument();
    expect(container.querySelector(".lucide-copy")).not.toBeInTheDocument();
  });

  it("resets to copy icon after 2 seconds", async () => {
    const { container } = render(<CopyButton value="test" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kopieer" }));
    });

    // Should show check icon immediately after copy
    expect(container.querySelector(".lucide-check")).toBeInTheDocument();

    // Advance past the 2s timeout
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    // Should reset back to copy icon
    expect(container.querySelector(".lucide-copy")).toBeInTheDocument();
    expect(container.querySelector(".lucide-check")).not.toBeInTheDocument();
  });

  it("handles clipboard API failure gracefully", async () => {
    mockWriteText.mockRejectedValueOnce(new Error("Clipboard unavailable"));
    render(<CopyButton value="fail-value" />);

    // Should not throw
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kopieer" }));
    });

    expect(mockWriteText).toHaveBeenCalledWith("fail-value");
    // No error thrown, component still renders
    expect(
      screen.getByRole("button", { name: "Kopieer" })
    ).toBeInTheDocument();
  });

  it("copies empty string value", async () => {
    render(<CopyButton value="" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kopieer" }));
    });

    expect(mockWriteText).toHaveBeenCalledWith("");
  });

  it("copies long text value", async () => {
    const longValue = "A".repeat(10000);
    render(<CopyButton value={longValue} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kopieer" }));
    });

    expect(mockWriteText).toHaveBeenCalledWith(longValue);
  });

  it("renders tooltip content with default label", () => {
    render(<CopyButton value="test" />);
    const tooltip = screen.getByTestId("tooltip-content");
    expect(tooltip).toHaveTextContent("Kopieer");
  });

  it("renders tooltip content with custom label", () => {
    render(<CopyButton value="test" label="Kopieer ID" />);
    const tooltip = screen.getByTestId("tooltip-content");
    expect(tooltip).toHaveTextContent("Kopieer ID");
  });
});
