import { renderHook } from "@testing-library/react";
import { useBeforeUnload } from "@/hooks/use-before-unload";

describe("useBeforeUnload", () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(window, "addEventListener");
    removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it("registers a beforeunload listener when hasUnsavedChanges is true", () => {
    renderHook(() => useBeforeUnload(true));

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function)
    );
  });

  it("does not register a listener when hasUnsavedChanges is false", () => {
    renderHook(() => useBeforeUnload(false));

    const beforeUnloadCalls = addEventListenerSpy.mock.calls.filter(
      (call) => call[0] === "beforeunload"
    );
    expect(beforeUnloadCalls).toHaveLength(0);
  });

  it("removes the listener on unmount", () => {
    const { unmount } = renderHook(() => useBeforeUnload(true));
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function)
    );
  });

  it("removes old listener and adds new one when toggling from false to true", () => {
    const { rerender } = renderHook(
      ({ unsaved }) => useBeforeUnload(unsaved),
      { initialProps: { unsaved: false } }
    );

    // No listener added initially
    const initialCalls = addEventListenerSpy.mock.calls.filter(
      (call) => call[0] === "beforeunload"
    );
    expect(initialCalls).toHaveLength(0);

    // Now enable
    rerender({ unsaved: true });

    const afterCalls = addEventListenerSpy.mock.calls.filter(
      (call) => call[0] === "beforeunload"
    );
    expect(afterCalls).toHaveLength(1);
  });

  it("removes listener when toggling from true to false", () => {
    const { rerender } = renderHook(
      ({ unsaved }) => useBeforeUnload(unsaved),
      { initialProps: { unsaved: true } }
    );

    rerender({ unsaved: false });

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function)
    );
  });

  it("calls preventDefault on the beforeunload event", () => {
    renderHook(() => useBeforeUnload(true));

    const handler = addEventListenerSpy.mock.calls.find(
      (call) => call[0] === "beforeunload"
    )?.[1] as EventListener;

    expect(handler).toBeDefined();

    const event = new Event("beforeunload");
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    handler(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("registers and removes the same function reference", () => {
    const { unmount } = renderHook(() => useBeforeUnload(true));

    const addedHandler = addEventListenerSpy.mock.calls.find(
      (call) => call[0] === "beforeunload"
    )?.[1];

    unmount();

    const removedHandler = removeEventListenerSpy.mock.calls.find(
      (call) => call[0] === "beforeunload"
    )?.[1];

    expect(addedHandler).toBe(removedHandler);
  });
});
