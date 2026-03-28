import { renderHook, act } from "@testing-library/react";
import { useLongPress } from "@/hooks/use-long-press";
import React from "react";

// Helper to create synthetic React events
function createMouseEvent(
  type: string,
  overrides: Partial<React.MouseEvent> = {}
): React.MouseEvent {
  return {
    button: 0,
    clientX: 100,
    clientY: 200,
    nativeEvent: new MouseEvent(type),
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as React.MouseEvent;
}

function createTouchEvent(
  type: string,
  x = 100,
  y = 200
): React.TouchEvent {
  return {
    touches: [{ clientX: x, clientY: y }],
    nativeEvent: new TouchEvent(type),
    preventDefault: vi.fn(),
  } as unknown as React.TouchEvent;
}

describe("useLongPress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with isPressed false and progress 0", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    expect(result.current.isPressed).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it("sets isPressed to true on mouse down", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    act(() => {
      result.current.onMouseDown(createMouseEvent("mousedown"));
    });

    expect(result.current.isPressed).toBe(true);
  });

  it("triggers onLongPress after the delay on mouse down", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ onLongPress, delay: 500 })
    );

    act(() => {
      result.current.onMouseDown(createMouseEvent("mousedown"));
    });

    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledWith(
      expect.any(MouseEvent),
      expect.objectContaining({ x: 100, y: 200 })
    );
  });

  it("calls onPress (not onLongPress) when released before delay", () => {
    const onLongPress = vi.fn();
    const onPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ onLongPress, onPress, delay: 500 })
    );

    act(() => {
      result.current.onMouseDown(createMouseEvent("mousedown"));
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      result.current.onMouseUp(createMouseEvent("mouseup"));
    });

    expect(onLongPress).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress if long press was already triggered", () => {
    const onLongPress = vi.fn();
    const onPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ onLongPress, onPress, delay: 500 })
    );

    act(() => {
      result.current.onMouseDown(createMouseEvent("mousedown"));
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      result.current.onMouseUp(createMouseEvent("mouseup"));
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("cancels long press when mouse leaves", () => {
    const onLongPress = vi.fn();
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ onLongPress, onCancel, delay: 500 })
    );

    act(() => {
      result.current.onMouseDown(createMouseEvent("mousedown"));
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      result.current.onMouseLeave(createMouseEvent("mouseleave"));
    });

    expect(result.current.isPressed).toBe(false);
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Advancing time should not trigger long press
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("cancels long press when touch moves beyond threshold", () => {
    const onLongPress = vi.fn();
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ onLongPress, onCancel, delay: 500, threshold: 10 })
    );

    act(() => {
      result.current.onTouchStart(createTouchEvent("touchstart", 100, 200));
    });

    expect(result.current.isPressed).toBe(true);

    // Move beyond threshold (> 10px)
    act(() => {
      result.current.onTouchMove(createTouchEvent("touchmove", 115, 200));
    });

    expect(result.current.isPressed).toBe(false);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not cancel when touch moves within threshold", () => {
    const onLongPress = vi.fn();
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ onLongPress, onCancel, delay: 500, threshold: 10 })
    );

    act(() => {
      result.current.onTouchStart(createTouchEvent("touchstart", 100, 200));
    });

    // Move within threshold (< 10px)
    act(() => {
      result.current.onTouchMove(createTouchEvent("touchmove", 105, 203));
    });

    expect(result.current.isPressed).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("handles touch start and end for long press", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ onLongPress, delay: 300 })
    );

    act(() => {
      result.current.onTouchStart(createTouchEvent("touchstart", 50, 75));
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onLongPress).toHaveBeenCalledWith(
      expect.any(TouchEvent),
      expect.objectContaining({ x: 50, y: 75 })
    );
  });

  it("prevents default on context menu and triggers onLongPress", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    const event = createMouseEvent("contextmenu");

    act(() => {
      result.current.onContextMenu(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onLongPress).toHaveBeenCalledWith(
      expect.any(MouseEvent),
      { x: 100, y: 200 }
    );
  });

  it("ignores non-left mouse button clicks", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    act(() => {
      result.current.onMouseDown(
        createMouseEvent("mousedown", { button: 2 } as Partial<React.MouseEvent>)
      );
    });

    expect(result.current.isPressed).toBe(false);
  });

  it("cleans up timers on unmount", () => {
    const onLongPress = vi.fn();
    const { result, unmount } = renderHook(() =>
      useLongPress({ onLongPress, delay: 500 })
    );

    act(() => {
      result.current.onMouseDown(createMouseEvent("mousedown"));
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("resets progress to 0 after release", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ onLongPress, delay: 500 })
    );

    act(() => {
      result.current.onMouseDown(createMouseEvent("mousedown"));
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    act(() => {
      result.current.onMouseUp(createMouseEvent("mouseup"));
    });

    expect(result.current.progress).toBe(0);
    expect(result.current.isPressed).toBe(false);
  });

  it("uses default delay of 500ms", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    act(() => {
      result.current.onMouseDown(createMouseEvent("mousedown"));
    });

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
});
