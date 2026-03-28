import { renderHook } from "@testing-library/react";
import { useAdminDashboardData } from "@/hooks/use-dashboard";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    dashboard: {
      getAdminDashboardData: "mock:getAdminDashboardData",
    },
  },
}));

const mockUseCurrentUser = vi.fn();
vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

describe("useAdminDashboardData", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseCurrentUser.mockReset();
  });

  it("skips query when user has no _id", () => {
    mockUseCurrentUser.mockReturnValue({ user: undefined });
    mockUseQuery.mockReturnValue(undefined);

    renderHook(() => useAdminDashboardData());

    // The second argument to useQuery should be "skip" when user has no _id
    expect(mockUseQuery).toHaveBeenCalledTimes(1);
    expect(mockUseQuery.mock.calls[0][1]).toBe("skip");
  });

  it("executes query with empty args when user has an _id", () => {
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue({ totalOffertes: 5 });

    renderHook(() => useAdminDashboardData());

    // The second argument should be {} (not "skip") when user has an _id
    expect(mockUseQuery).toHaveBeenCalledTimes(1);
    expect(mockUseQuery.mock.calls[0][1]).toEqual({});
  });

  it("returns isLoading true when user exists but data is not yet loaded", () => {
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue(undefined);

    const { result } = renderHook(() => useAdminDashboardData());

    expect(result.current.isLoading).toBe(true);
  });

  it("returns isLoading false when data has loaded", () => {
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue({ totalOffertes: 10, activeProjects: 3 });

    const { result } = renderHook(() => useAdminDashboardData());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.totalOffertes).toBe(10);
    expect(result.current.activeProjects).toBe(3);
  });

  it("returns isLoading false when user is not defined", () => {
    mockUseCurrentUser.mockReturnValue({ user: undefined });
    mockUseQuery.mockReturnValue(undefined);

    const { result } = renderHook(() => useAdminDashboardData());

    // user is undefined, so isLoading = (undefined !== undefined && ...) = false
    expect(result.current.isLoading).toBe(false);
  });

  it("spreads data properties onto the return object", () => {
    const dashboardData = {
      totalOffertes: 15,
      openOffertes: 3,
      revenue: 125000,
      activeProjects: 7,
    };
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue(dashboardData);

    const { result } = renderHook(() => useAdminDashboardData());

    expect(result.current.totalOffertes).toBe(15);
    expect(result.current.openOffertes).toBe(3);
    expect(result.current.revenue).toBe(125000);
    expect(result.current.activeProjects).toBe(7);
  });

  it("returns empty object spread when data is undefined", () => {
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue(undefined);

    const { result } = renderHook(() => useAdminDashboardData());

    // Should not crash — spreads empty object
    expect(result.current.isLoading).toBe(true);
  });

  it("memoizes the return value when inputs are stable", () => {
    const dashboardData = { totalOffertes: 5 };
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue(dashboardData);

    const { result, rerender } = renderHook(() => useAdminDashboardData());

    const firstResult = result.current;
    rerender();
    const secondResult = result.current;

    // useMemo should return the same object reference if deps haven't changed
    expect(firstResult).toBe(secondResult);
  });
});
