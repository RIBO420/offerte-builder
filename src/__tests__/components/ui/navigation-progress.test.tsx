import { render, screen, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Track the pathname and searchParams mock values
let mockPathname = "/";
let mockSearchParams = new URLSearchParams();

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

// Import after mocks
import { NavigationProgress } from "@/components/ui/navigation-progress";

describe("NavigationProgress", () => {
  beforeEach(() => {
    mockPathname = "/";
    mockSearchParams = new URLSearchParams();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders nothing in idle state", () => {
    render(<NavigationProgress />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("renders progressbar when loading state is triggered by link click", () => {
    render(<NavigationProgress />);

    const link = document.createElement("a");
    link.href = "/offertes";
    document.body.appendChild(link);

    act(() => {
      link.click();
    });

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute("aria-label", "Pagina laden");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
    expect(progressbar).toHaveAttribute("aria-valuenow", "80");

    document.body.removeChild(link);
  });

  it("ignores clicks on external links", () => {
    render(<NavigationProgress />);

    const link = document.createElement("a");
    link.href = "https://example.com";
    document.body.appendChild(link);

    act(() => {
      link.click();
    });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    document.body.removeChild(link);
  });

  it("ignores clicks on hash links", () => {
    render(<NavigationProgress />);

    const link = document.createElement("a");
    link.href = "#section";
    document.body.appendChild(link);

    act(() => {
      link.click();
    });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    document.body.removeChild(link);
  });

  it("ignores clicks on mailto links", () => {
    render(<NavigationProgress />);

    const link = document.createElement("a");
    link.href = "mailto:info@example.com";
    document.body.appendChild(link);

    act(() => {
      link.click();
    });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    document.body.removeChild(link);
  });

  it("ignores clicks on links with target=_blank", () => {
    render(<NavigationProgress />);

    const link = document.createElement("a");
    link.href = "/offertes";
    link.target = "_blank";
    document.body.appendChild(link);

    act(() => {
      link.click();
    });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    document.body.removeChild(link);
  });

  it("ignores clicks on download links", () => {
    render(<NavigationProgress />);

    const link = document.createElement("a");
    link.href = "/offertes";
    link.setAttribute("download", "bestand.pdf");
    document.body.appendChild(link);

    act(() => {
      link.click();
    });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    document.body.removeChild(link);
  });

  it("has correct aria attributes on the progressbar", () => {
    render(<NavigationProgress />);

    const link = document.createElement("a");
    link.href = "/klanten";
    document.body.appendChild(link);

    act(() => {
      link.click();
    });

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-label", "Pagina laden");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");

    document.body.removeChild(link);
  });

  it("does not trigger loading when clicking link to same path", () => {
    render(<NavigationProgress />);

    const link = document.createElement("a");
    link.href = "/";
    document.body.appendChild(link);

    act(() => {
      link.click();
    });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    document.body.removeChild(link);
  });

  it("ignores clicks on non-link elements", () => {
    render(<NavigationProgress />);

    const button = document.createElement("button");
    document.body.appendChild(button);

    act(() => {
      button.click();
    });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    document.body.removeChild(button);
  });
});
