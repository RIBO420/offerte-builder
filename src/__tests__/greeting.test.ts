import { describe, it, expect, vi, afterEach } from "vitest";
import { getGreeting } from "@/lib/greeting";

describe("getGreeting", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("returns Goedemorgen before 12:00", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 28, 9, 0));
    expect(getGreeting("Ricardo")).toBe("Goedemorgen, Ricardo");
  });

  it("returns Goedemiddag between 12:00 and 18:00", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 28, 14, 0));
    expect(getGreeting("Ricardo")).toBe("Goedemiddag, Ricardo");
  });

  it("returns Goedenavond after 18:00", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 28, 20, 0));
    expect(getGreeting("Ricardo")).toBe("Goedenavond, Ricardo");
  });

  it("returns greeting without name when no name provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 28, 10, 0));
    expect(getGreeting()).toBe("Goedemorgen");
  });
});
