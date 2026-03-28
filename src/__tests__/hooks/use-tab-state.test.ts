import { renderHook, act } from "@testing-library/react";
import { useTabState } from "@/hooks/use-tab-state";

// Mock next/navigation
const mockPush = vi.fn();
const mockGet = vi.fn();
const mockToString = vi.fn().mockReturnValue("");
const mockPathname = "/offertes";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: mockGet,
    toString: mockToString,
  }),
  usePathname: () => mockPathname,
}));

describe("useTabState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null);
    mockToString.mockReturnValue("");
  });

  it("returns the default tab when no tab param exists in the URL", () => {
    mockGet.mockReturnValue(null);

    const { result } = renderHook(() => useTabState("alle"));

    expect(result.current[0]).toBe("alle");
  });

  it("returns the tab from URL search params when present", () => {
    mockGet.mockReturnValue("actief");

    const { result } = renderHook(() => useTabState("alle"));

    expect(result.current[0]).toBe("actief");
  });

  it("navigates to URL with tab param when setting a non-default tab", () => {
    mockToString.mockReturnValue("");

    const { result } = renderHook(() => useTabState("alle"));

    act(() => {
      result.current[1]("actief");
    });

    expect(mockPush).toHaveBeenCalledWith("/offertes?tab=actief");
  });

  it("removes the tab param when setting the default tab", () => {
    mockToString.mockReturnValue("tab=actief");

    const { result } = renderHook(() => useTabState("alle"));

    act(() => {
      result.current[1]("alle");
    });

    // Setting to default should produce a clean URL without tab param
    expect(mockPush).toHaveBeenCalledWith("/offertes");
  });

  it("preserves other search params when setting tab", () => {
    mockToString.mockReturnValue("search=tuin&page=2");

    const { result } = renderHook(() => useTabState("alle"));

    act(() => {
      result.current[1]("concept");
    });

    // Should include existing params plus the new tab
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("search=tuin")
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("page=2")
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("tab=concept")
    );
  });

  it("returns a readonly tuple", () => {
    const { result } = renderHook(() => useTabState("alle"));

    // TypeScript enforces this, but we can verify the structure
    expect(result.current).toHaveLength(2);
    expect(typeof result.current[0]).toBe("string");
    expect(typeof result.current[1]).toBe("function");
  });
});
