import { renderHook } from "@testing-library/react";
import { useNotifications, useUnreadNotificationCount } from "@/hooks/use-notifications";

// We mock the entire hook module's dependencies: convex/react, the api import, and useCurrentUser.
// The key challenge is that Convex FunctionReferences are Proxy objects.
// We use vi.fn() for useQuery/useMutation and control returns per-test.

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    notifications: {
      list: "mock:list",
      getUnreadCount: "mock:getUnreadCount",
      markAsRead: "mock:markAsRead",
      markAllAsRead: "mock:markAllAsRead",
      dismiss: "mock:dismiss",
    },
  },
}));

const mockUseCurrentUser = vi.fn();
vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

describe("useNotifications", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockUseCurrentUser.mockReset();
    // Default: return vi.fn() for all mutations
    mockUseMutation.mockReturnValue(vi.fn());
  });

  it("returns empty defaults when user has no _id (queries are skipped)", () => {
    mockUseCurrentUser.mockReturnValue({ user: undefined });
    mockUseQuery.mockReturnValue(undefined);

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications).toEqual([]);
    expect(result.current.hasUnread).toBe(false);
    expect(result.current.unreadCounts).toEqual({
      offerte: 0, chat: 0, project: 0, system: 0, total: 0,
    });
  });

  it("passes skip when user has no _id", () => {
    mockUseCurrentUser.mockReturnValue({ user: undefined });
    mockUseQuery.mockReturnValue(undefined);

    renderHook(() => useNotifications());

    // Both useQuery calls should receive "skip" as second arg
    expect(mockUseQuery).toHaveBeenCalledTimes(2);
    expect(mockUseQuery.mock.calls[0][1]).toBe("skip");
    expect(mockUseQuery.mock.calls[1][1]).toBe("skip");
  });

  it("passes limit and includeRead to list query when user exists", () => {
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue(undefined);

    renderHook(() => useNotifications({ limit: 10, includeRead: false }));

    // First useQuery call is for the list — check its second arg
    expect(mockUseQuery.mock.calls[0][1]).toEqual({
      limit: 10,
      includeRead: false,
    });
  });

  it("uses default limit 50 and includeRead true", () => {
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue(undefined);

    renderHook(() => useNotifications());

    // First useQuery call is for the list — check its second arg
    expect(mockUseQuery.mock.calls[0][1]).toEqual({
      limit: 50,
      includeRead: true,
    });
  });

  it("returns notifications data when loaded", () => {
    const notificationsList = [
      { _id: "n1", message: "Nieuwe offerte", type: "offerte" },
      { _id: "n2", message: "Nieuw bericht", type: "chat" },
    ];
    const unreadCounts = { offerte: 1, chat: 1, project: 0, system: 0, total: 2 };

    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    // useQuery is called twice: first for list, then for unreadCount
    mockUseQuery
      .mockReturnValueOnce(notificationsList)
      .mockReturnValueOnce(unreadCounts);

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications).toEqual(notificationsList);
    expect(result.current.unreadCounts).toEqual(unreadCounts);
    expect(result.current.hasUnread).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns default unreadCounts when data is undefined", () => {
    mockUseCurrentUser.mockReturnValue({ user: undefined });
    mockUseQuery.mockReturnValue(undefined);

    const { result } = renderHook(() => useNotifications());

    expect(result.current.unreadCounts).toEqual({
      offerte: 0, chat: 0, project: 0, system: 0, total: 0,
    });
  });

  it("calls markAsRead mutation with notification ID", async () => {
    const mockMarkAsRead = vi.fn().mockResolvedValue(undefined);
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue([]);
    // useMutation is called 3 times: markAsRead, markAllAsRead, dismiss
    mockUseMutation
      .mockReturnValueOnce(mockMarkAsRead)
      .mockReturnValueOnce(vi.fn())
      .mockReturnValueOnce(vi.fn());

    const { result } = renderHook(() => useNotifications());

    await result.current.markAsRead("notif123" as never);

    expect(mockMarkAsRead).toHaveBeenCalledWith({ notificationId: "notif123" });
  });

  it("calls markAllAsRead mutation", async () => {
    const mockMarkAllAsRead = vi.fn().mockResolvedValue(undefined);
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue([]);
    mockUseMutation
      .mockReturnValueOnce(vi.fn())
      .mockReturnValueOnce(mockMarkAllAsRead)
      .mockReturnValueOnce(vi.fn());

    const { result } = renderHook(() => useNotifications());

    await result.current.markAllAsRead();

    expect(mockMarkAllAsRead).toHaveBeenCalledWith({});
  });

  it("calls dismiss mutation with notification ID", async () => {
    const mockDismiss = vi.fn().mockResolvedValue(undefined);
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue([]);
    mockUseMutation
      .mockReturnValueOnce(vi.fn())
      .mockReturnValueOnce(vi.fn())
      .mockReturnValueOnce(mockDismiss);

    const { result } = renderHook(() => useNotifications());

    await result.current.dismiss("notif456" as never);

    expect(mockDismiss).toHaveBeenCalledWith({ notificationId: "notif456" });
  });

  it("reports isLoading when user exists but notifications undefined", () => {
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue(undefined);

    const { result } = renderHook(() => useNotifications());

    expect(result.current.isLoading).toBeTruthy();
  });

  it("reports hasUnread false when total is 0", () => {
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery
      .mockReturnValueOnce([])
      .mockReturnValueOnce({ offerte: 0, chat: 0, project: 0, system: 0, total: 0 });

    const { result } = renderHook(() => useNotifications());

    expect(result.current.hasUnread).toBe(false);
  });

  it("returns empty notifications array when query returns undefined", () => {
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue(undefined);

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications).toEqual([]);
  });
});

describe("useUnreadNotificationCount", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockUseCurrentUser.mockReset();
  });

  it("returns zero counts when user is not loaded", () => {
    mockUseCurrentUser.mockReturnValue({ user: undefined });
    mockUseQuery.mockReturnValue(undefined);

    const { result } = renderHook(() => useUnreadNotificationCount());

    expect(result.current.total).toBe(0);
    expect(result.current.offerte).toBe(0);
    expect(result.current.chat).toBe(0);
    expect(result.current.project).toBe(0);
    expect(result.current.system).toBe(0);
  });

  it("returns actual counts when data is loaded", () => {
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue({
      total: 5, offerte: 2, chat: 1, project: 1, system: 1,
    });

    const { result } = renderHook(() => useUnreadNotificationCount());

    expect(result.current.total).toBe(5);
    expect(result.current.offerte).toBe(2);
    expect(result.current.chat).toBe(1);
  });

  it("reports isLoading when user exists but counts not loaded", () => {
    mockUseCurrentUser.mockReturnValue({ user: { _id: "user123" } });
    mockUseQuery.mockReturnValue(undefined);

    const { result } = renderHook(() => useUnreadNotificationCount());

    expect(result.current.isLoading).toBeTruthy();
  });

  it("reports isLoading false when user is not authenticated", () => {
    mockUseCurrentUser.mockReturnValue({ user: undefined });
    mockUseQuery.mockReturnValue(undefined);

    const { result } = renderHook(() => useUnreadNotificationCount());

    expect(result.current.isLoading).toBeFalsy();
  });

  it("skips query when user has no _id", () => {
    mockUseCurrentUser.mockReturnValue({ user: undefined });
    mockUseQuery.mockReturnValue(undefined);

    renderHook(() => useUnreadNotificationCount());

    // The second argument should be "skip" when user has no _id
    expect(mockUseQuery).toHaveBeenCalledTimes(1);
    expect(mockUseQuery.mock.calls[0][1]).toBe("skip");
  });
});
