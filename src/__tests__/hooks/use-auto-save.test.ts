import { renderHook, act } from "@testing-library/react";
import { useAutoSave } from "@/hooks/use-auto-save";

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with correct initial state", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAutoSave({ data: { name: "test" }, onSave })
    );

    expect(result.current.isSaving).toBe(false);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.lastSaved).toBeNull();
    expect(result.current.lastSavedAt).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("does not mark as dirty on initial render", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAutoSave({ data: { value: 42 }, onSave })
    );

    expect(result.current.isDirty).toBe(false);
  });

  it("marks as dirty when data changes", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave({ data, onSave }),
      { initialProps: { data: { name: "Jan" } } }
    );

    rerender({ data: { name: "Piet" } });

    expect(result.current.isDirty).toBe(true);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it("auto-saves after debounce period when data changes", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave({ data, onSave, debounceMs: 1000 }),
      { initialProps: { data: { name: "Jan" } } }
    );

    rerender({ data: { name: "Piet" } });

    // Not saved yet
    expect(onSave).not.toHaveBeenCalled();

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(onSave).toHaveBeenCalledWith({ name: "Piet" });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.lastSaved).toBeInstanceOf(Date);
  });

  it("resets debounce timer on subsequent data changes", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ data }) => useAutoSave({ data, onSave, debounceMs: 1000 }),
      { initialProps: { data: { v: 1 } } }
    );

    rerender({ data: { v: 2 } });

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    // Change data again before timer fires
    rerender({ data: { v: 3 } });

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    // Should not have saved yet (timer reset)
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(onSave).toHaveBeenCalledWith({ v: 3 });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("saveNow triggers an immediate save and clears pending debounce", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave({ data, onSave, debounceMs: 5000 }),
      { initialProps: { data: { v: 1 } } }
    );

    rerender({ data: { v: 2 } });
    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      await result.current.saveNow();
    });

    expect(onSave).toHaveBeenCalledWith({ v: 2 });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.lastSaved).toBeInstanceOf(Date);

    // Advancing time should NOT trigger another save (debounce was cleared)
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("does not auto-save when enabled is false", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ data, enabled }) => useAutoSave({ data, onSave, debounceMs: 500, enabled }),
      { initialProps: { data: { v: 1 }, enabled: false } }
    );

    rerender({ data: { v: 2 }, enabled: false });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("captures errors from failed saves", async () => {
    const saveError = new Error("Network error");
    const onSave = vi.fn().mockRejectedValue(saveError);

    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave({ data, onSave, debounceMs: 500 }),
      { initialProps: { data: { v: 1 } } }
    );

    rerender({ data: { v: 2 } });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.error).toEqual(saveError);
    expect(result.current.isSaving).toBe(false);
  });

  it("wraps non-Error thrown values in an Error object", async () => {
    const onSave = vi.fn().mockRejectedValue("string error");

    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave({ data, onSave, debounceMs: 500 }),
      { initialProps: { data: { v: 1 } } }
    );

    rerender({ data: { v: 2 } });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("Save failed");
  });

  it("clears error on next data change", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave({ data, onSave, debounceMs: 500 }),
      { initialProps: { data: { v: 1 } } }
    );

    // Trigger error
    rerender({ data: { v: 2 } });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.error).not.toBeNull();

    // Change data again — error should be cleared
    rerender({ data: { v: 3 } });
    expect(result.current.error).toBeNull();
  });

  it("uses default debounce of 2000ms", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ data }) => useAutoSave({ data, onSave }),
      { initialProps: { data: { v: 1 } } }
    );

    rerender({ data: { v: 2 } });

    await act(async () => {
      vi.advanceTimersByTime(1999);
    });
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(onSave).toHaveBeenCalled();
  });

  it("cleans up debounce timer on unmount", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { rerender, unmount } = renderHook(
      ({ data }) => useAutoSave({ data, onSave, debounceMs: 1000 }),
      { initialProps: { data: { v: 1 } } }
    );

    rerender({ data: { v: 2 } });
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not update state after unmount", async () => {
    const onSave = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    const { result, rerender, unmount } = renderHook(
      ({ data }) => useAutoSave({ data, onSave, debounceMs: 100 }),
      { initialProps: { data: { v: 1 } } }
    );

    rerender({ data: { v: 2 } });

    // Start the save
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Unmount while save is in progress
    unmount();

    // Resolve the save promise
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Should not throw (no state updates after unmount)
    expect(onSave).toHaveBeenCalled();
  });

  it("provides lastSavedAt as alias for lastSaved", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave({ data, onSave, debounceMs: 100 }),
      { initialProps: { data: { v: 1 } } }
    );

    rerender({ data: { v: 2 } });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.lastSavedAt).toBe(result.current.lastSaved);
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });
});
