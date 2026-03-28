import { renderHook, act } from "@testing-library/react";
import { useWizardAutosave } from "@/hooks/use-wizard-autosave";

describe("useWizardAutosave", () => {
  const storageKey = "offerte-wizard-test-key";

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(Date, "now").mockReturnValue(1711612800000); // Fixed timestamp
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with the provided initial data and step", () => {
    const { result } = renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: { scope: "grondwerk" },
        initialStep: 0,
      })
    );

    expect(result.current.data).toEqual({ scope: "grondwerk" });
    expect(result.current.step).toBe(0);
    expect(result.current.hasDraft).toBe(false);
    expect(result.current.draftAge).toBeNull();
    expect(result.current.showRestoreDialog).toBe(false);
  });

  it("detects an existing valid draft on mount", () => {
    // Store a draft that is NOT expired (5 minutes ago)
    const draft = {
      data: { scope: "bestrating" },
      step: 2,
      timestamp: Date.now() - 5 * 60 * 1000,
      type: "aanleg",
    };
    localStorage.setItem(storageKey, JSON.stringify(draft));

    const { result } = renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: { scope: "grondwerk" },
      })
    );

    expect(result.current.hasDraft).toBe(true);
    expect(result.current.draftAge).toBe("5 minuten geleden");
    expect(result.current.showRestoreDialog).toBe(true);
    // Data should still be initialData until user restores
    expect(result.current.data).toEqual({ scope: "grondwerk" });
  });

  it("removes expired drafts on mount", () => {
    // Store a draft older than 24 hours
    const draft = {
      data: { scope: "bestrating" },
      step: 2,
      timestamp: Date.now() - 25 * 60 * 60 * 1000,
      type: "aanleg",
    };
    localStorage.setItem(storageKey, JSON.stringify(draft));

    const { result } = renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: { scope: "grondwerk" },
      })
    );

    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("removes drafts with wrong type on mount", () => {
    const draft = {
      data: { scope: "bestrating" },
      step: 2,
      timestamp: Date.now() - 5 * 60 * 1000,
      type: "onderhoud",
    };
    localStorage.setItem(storageKey, JSON.stringify(draft));

    const { result } = renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: { scope: "grondwerk" },
      })
    );

    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("restores draft data and step when restoreDraft is called", () => {
    const draft = {
      data: { scope: "bestrating", klant: "Jan" },
      step: 3,
      timestamp: Date.now() - 10 * 60 * 1000,
      type: "aanleg",
    };
    localStorage.setItem(storageKey, JSON.stringify(draft));

    const { result } = renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: { scope: "grondwerk" },
      })
    );

    act(() => {
      result.current.restoreDraft();
    });

    expect(result.current.data).toEqual({ scope: "bestrating", klant: "Jan" });
    expect(result.current.step).toBe(3);
    expect(result.current.showRestoreDialog).toBe(false);
    expect(result.current.hasDraft).toBe(false);
  });

  it("discards draft and removes from localStorage", () => {
    const draft = {
      data: { scope: "bestrating" },
      step: 2,
      timestamp: Date.now() - 5 * 60 * 1000,
      type: "aanleg",
    };
    localStorage.setItem(storageKey, JSON.stringify(draft));

    const { result } = renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: { scope: "grondwerk" },
      })
    );

    act(() => {
      result.current.discardDraft();
    });

    expect(result.current.showRestoreDialog).toBe(false);
    expect(result.current.hasDraft).toBe(false);
    expect(result.current.draftAge).toBeNull();
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("saves to localStorage when data changes", () => {
    const { result } = renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: { scope: "grondwerk" },
      })
    );

    act(() => {
      result.current.setData({ scope: "bestrating" });
    });

    const stored = JSON.parse(localStorage.getItem(storageKey)!);
    expect(stored.data).toEqual({ scope: "bestrating" });
    expect(stored.type).toBe("aanleg");
  });

  it("saves to localStorage when step changes", () => {
    const { result } = renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: { scope: "grondwerk" },
      })
    );

    // Need to change data too so it doesn't match initial
    act(() => {
      result.current.setData({ scope: "bestrating" });
    });

    act(() => {
      result.current.setStep(3);
    });

    const stored = JSON.parse(localStorage.getItem(storageKey)!);
    expect(stored.step).toBe(3);
  });

  it("does not save when still on initial step with initial data", () => {
    renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: { scope: "grondwerk" },
        initialStep: 0,
      })
    );

    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("supports functional updates via setData", () => {
    const { result } = renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: { count: 0 },
      })
    );

    act(() => {
      result.current.setData((prev: { count: number }) => ({
        count: prev.count + 1,
      }));
    });

    expect(result.current.data).toEqual({ count: 1 });
  });

  it("clearDraft removes from localStorage without affecting current data", () => {
    const { result } = renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: { scope: "grondwerk" },
      })
    );

    // Change data so it saves
    act(() => {
      result.current.setData({ scope: "bestrating" });
    });

    expect(localStorage.getItem(storageKey)).not.toBeNull();

    act(() => {
      result.current.clearDraft();
    });

    expect(localStorage.getItem(storageKey)).toBeNull();
    // Current data should remain untouched
    expect(result.current.data).toEqual({ scope: "bestrating" });
  });

  it("handles corrupted localStorage data gracefully", () => {
    localStorage.setItem(storageKey, "not valid json{{{");

    const { result } = renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: { scope: "grondwerk" },
      })
    );

    expect(result.current.hasDraft).toBe(false);
    // Corrupted data should be removed
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("formats draft age correctly for different time ranges", () => {
    // Test "zojuist" (< 1 minute)
    const recentDraft = {
      data: { scope: "test" },
      step: 0,
      timestamp: Date.now() - 30 * 1000, // 30 seconds ago
      type: "aanleg",
    };
    localStorage.setItem(storageKey, JSON.stringify(recentDraft));

    const { result: r1, unmount: u1 } = renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: {},
      })
    );
    expect(r1.current.draftAge).toBe("zojuist");
    u1();

    // Test hours
    const hoursDraft = {
      data: { scope: "test" },
      step: 0,
      timestamp: Date.now() - 3 * 60 * 60 * 1000, // 3 hours ago
      type: "aanleg",
    };
    localStorage.setItem(storageKey, JSON.stringify(hoursDraft));

    const { result: r2 } = renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: {},
      })
    );
    expect(r2.current.draftAge).toBe("3 uur geleden");
  });

  it("respects custom expiration hours", () => {
    // Draft is 5 hours old
    const draft = {
      data: { scope: "test" },
      step: 0,
      timestamp: Date.now() - 5 * 60 * 60 * 1000,
      type: "aanleg",
    };
    localStorage.setItem(storageKey, JSON.stringify(draft));

    // With 4-hour expiration, this should be expired
    const { result } = renderHook(() =>
      useWizardAutosave({
        key: "test-key",
        type: "aanleg",
        initialData: {},
        expirationHours: 4,
      })
    );

    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });
});
