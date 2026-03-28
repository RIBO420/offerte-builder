import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create a controllable mock for the connection state
let mockConnectionState = {
  isWebSocketConnected: true,
  hasEverConnected: true,
};

vi.mock("convex/react", () => ({
  useConvexConnectionState: () => mockConnectionState,
}));

import { ConnectionStatus } from "@/components/ui/connection-status";

describe("ConnectionStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockConnectionState = {
      isWebSocketConnected: true,
      hasEverConnected: true,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when connected normally", () => {
    const { container } = render(<ConnectionStatus />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when never connected yet", () => {
    mockConnectionState = {
      isWebSocketConnected: false,
      hasEverConnected: false,
    };
    const { container } = render(<ConnectionStatus />);
    expect(container.innerHTML).toBe("");
  });

  it("shows disconnected banner when connection is lost", () => {
    mockConnectionState = {
      isWebSocketConnected: false,
      hasEverConnected: true,
    };
    render(<ConnectionStatus />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(
      screen.getByText(
        "Geen internetverbinding. Wijzigingen worden opgeslagen zodra je weer online bent."
      )
    ).toBeInTheDocument();
  });

  it("uses assertive aria-live for connection alerts", () => {
    mockConnectionState = {
      isWebSocketConnected: false,
      hasEverConnected: true,
    };
    render(<ConnectionStatus />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveAttribute("aria-atomic", "true");
  });

  it("shows reconnected banner when connection restores", () => {
    // Start disconnected
    mockConnectionState = {
      isWebSocketConnected: false,
      hasEverConnected: true,
    };
    const { rerender } = render(<ConnectionStatus />);

    expect(
      screen.getByText(
        "Geen internetverbinding. Wijzigingen worden opgeslagen zodra je weer online bent."
      )
    ).toBeInTheDocument();

    // Reconnect
    mockConnectionState = {
      isWebSocketConnected: true,
      hasEverConnected: true,
    };
    rerender(<ConnectionStatus />);

    expect(
      screen.getByText("Verbinding hersteld")
    ).toBeInTheDocument();
  });

  it("hides reconnected banner after 3 seconds", () => {
    // Start disconnected
    mockConnectionState = {
      isWebSocketConnected: false,
      hasEverConnected: true,
    };
    const { rerender } = render(<ConnectionStatus />);

    // Reconnect
    mockConnectionState = {
      isWebSocketConnected: true,
      hasEverConnected: true,
    };
    rerender(<ConnectionStatus />);

    expect(screen.getByText("Verbinding hersteld")).toBeInTheDocument();

    // Advance past the 3s dismiss timer
    act(() => {
      vi.advanceTimersByTime(3100);
    });

    expect(
      screen.queryByText("Verbinding hersteld")
    ).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    mockConnectionState = {
      isWebSocketConnected: false,
      hasEverConnected: true,
    };
    render(<ConnectionStatus className="custom-class" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("custom-class");
  });

  it("has data-slot attribute for styling hooks", () => {
    mockConnectionState = {
      isWebSocketConnected: false,
      hasEverConnected: true,
    };
    render(<ConnectionStatus />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-slot", "connection-status");
  });

  it("does not show reconnected banner on first connection", () => {
    // Start as never connected
    mockConnectionState = {
      isWebSocketConnected: false,
      hasEverConnected: false,
    };
    const { rerender } = render(<ConnectionStatus />);

    // First connection
    mockConnectionState = {
      isWebSocketConnected: true,
      hasEverConnected: true,
    };
    rerender(<ConnectionStatus />);

    // Should not show "Verbinding hersteld" since it was the first connection
    expect(
      screen.queryByText("Verbinding hersteld")
    ).not.toBeInTheDocument();
  });
});
