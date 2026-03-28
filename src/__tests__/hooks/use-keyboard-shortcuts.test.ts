import { renderHook, act } from "@testing-library/react";
import {
  useKeyboardShortcuts,
  useSequenceShortcuts,
  isMac,
  formatShortcut,
  formatSequenceShortcut,
  getModifierKey,
  getShiftKey,
  getAltKey,
  type Shortcut,
  type SequenceShortcut,
} from "@/hooks/use-keyboard-shortcuts";

// Helper to dispatch keyboard events on document
function pressKey(options: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  target?: EventTarget;
}) {
  const event = new KeyboardEvent("keydown", {
    key: options.key,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
    bubbles: true,
    cancelable: true,
  });

  // If a target is specified, we need to use Object.defineProperty
  // since target is read-only on the native event
  if (options.target) {
    Object.defineProperty(event, "target", {
      value: options.target,
      writable: false,
    });
  }

  document.dispatchEvent(event);
  return event;
}

describe("useKeyboardShortcuts", () => {
  it("triggers action when matching key is pressed", () => {
    const action = vi.fn();
    const shortcuts: Shortcut[] = [{ key: "k", action }];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    pressKey({ key: "k" });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("matches keys case-insensitively", () => {
    const action = vi.fn();
    const shortcuts: Shortcut[] = [{ key: "k", action }];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    pressKey({ key: "K" });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("requires ctrl modifier when specified (non-Mac)", () => {
    // Force non-Mac platform
    Object.defineProperty(navigator, "platform", {
      value: "Win32",
      configurable: true,
    });

    const action = vi.fn();
    const shortcuts: Shortcut[] = [{ key: "k", ctrl: true, action }];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Without ctrl — should NOT trigger
    pressKey({ key: "k" });
    expect(action).not.toHaveBeenCalled();

    // With ctrl — should trigger
    pressKey({ key: "k", ctrlKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("requires meta (Cmd) on Mac when ctrl or meta is specified", () => {
    Object.defineProperty(navigator, "platform", {
      value: "MacIntel",
      configurable: true,
    });

    const action = vi.fn();
    const shortcuts: Shortcut[] = [{ key: "k", meta: true, action }];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Ctrl on Mac should NOT trigger
    pressKey({ key: "k", ctrlKey: true });
    expect(action).not.toHaveBeenCalled();

    // Meta (Cmd) on Mac should trigger
    pressKey({ key: "k", metaKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("requires shift modifier when specified", () => {
    const action = vi.fn();
    const shortcuts: Shortcut[] = [{ key: "n", shift: true, action }];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    pressKey({ key: "n" });
    expect(action).not.toHaveBeenCalled();

    pressKey({ key: "n", shiftKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("requires alt modifier when specified", () => {
    const action = vi.fn();
    const shortcuts: Shortcut[] = [{ key: "p", alt: true, action }];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    pressKey({ key: "p" });
    expect(action).not.toHaveBeenCalled();

    pressKey({ key: "p", altKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("ignores shortcuts when focused in an input element", () => {
    const action = vi.fn();
    const shortcuts: Shortcut[] = [{ key: "k", action }];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const input = document.createElement("input");
    document.body.appendChild(input);

    pressKey({ key: "k", target: input });

    expect(action).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("ignores shortcuts when focused in a textarea", () => {
    const action = vi.fn();
    const shortcuts: Shortcut[] = [{ key: "k", action }];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    pressKey({ key: "k", target: textarea });

    expect(action).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it("allows shortcuts in input when allowInInput is true", () => {
    const action = vi.fn();
    const shortcuts: Shortcut[] = [
      { key: "k", action, allowInInput: true },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const input = document.createElement("input");
    document.body.appendChild(input);

    pressKey({ key: "k", target: input });

    expect(action).toHaveBeenCalledTimes(1);
    document.body.removeChild(input);
  });

  it("does not trigger when wrong modifier keys are pressed", () => {
    const action = vi.fn();
    // No modifiers expected
    const shortcuts: Shortcut[] = [{ key: "k", action }];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Pressing with ctrl when not expected should NOT trigger
    pressKey({ key: "k", ctrlKey: true });
    expect(action).not.toHaveBeenCalled();

    // Pressing with shift when not expected should NOT trigger
    pressKey({ key: "k", shiftKey: true });
    expect(action).not.toHaveBeenCalled();
  });

  it("removes event listener on unmount", () => {
    const action = vi.fn();
    const shortcuts: Shortcut[] = [{ key: "k", action }];

    const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));

    unmount();

    pressKey({ key: "k" });

    expect(action).not.toHaveBeenCalled();
  });

  it("handles multiple shortcuts matching different keys", () => {
    const action1 = vi.fn();
    const action2 = vi.fn();
    const shortcuts: Shortcut[] = [
      { key: "a", action: action1 },
      { key: "b", action: action2 },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    pressKey({ key: "a" });
    expect(action1).toHaveBeenCalledTimes(1);
    expect(action2).not.toHaveBeenCalled();

    pressKey({ key: "b" });
    expect(action2).toHaveBeenCalledTimes(1);
  });
});

describe("useSequenceShortcuts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("triggers action when full sequence is pressed", () => {
    const action = vi.fn();
    const shortcuts: SequenceShortcut[] = [
      { sequence: ["g", "d"], action },
    ];

    renderHook(() => useSequenceShortcuts(shortcuts));

    // Each key press must be wrapped in act() so that the state update
    // from the first key (pendingKeys) is flushed before the second key
    act(() => {
      pressKey({ key: "g" });
    });
    act(() => {
      pressKey({ key: "d" });
    });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("does not trigger on partial sequence", () => {
    const action = vi.fn();
    const shortcuts: SequenceShortcut[] = [
      { sequence: ["g", "d"], action },
    ];

    renderHook(() => useSequenceShortcuts(shortcuts));

    pressKey({ key: "g" });

    expect(action).not.toHaveBeenCalled();
  });

  it("resets sequence after timeout", () => {
    const action = vi.fn();
    const shortcuts: SequenceShortcut[] = [
      { sequence: ["g", "d"], action },
    ];

    renderHook(() => useSequenceShortcuts(shortcuts, 500));

    pressKey({ key: "g" });

    act(() => {
      vi.advanceTimersByTime(600);
    });

    pressKey({ key: "d" });

    expect(action).not.toHaveBeenCalled();
  });

  it("returns pending keys during a sequence", () => {
    const action = vi.fn();
    const shortcuts: SequenceShortcut[] = [
      { sequence: ["g", "d"], action },
    ];

    const { result } = renderHook(() => useSequenceShortcuts(shortcuts));

    expect(result.current.pendingKeys).toEqual([]);

    act(() => {
      pressKey({ key: "g" });
    });

    expect(result.current.pendingKeys).toEqual(["g"]);
  });

  it("clears pending keys after successful match", () => {
    const action = vi.fn();
    const shortcuts: SequenceShortcut[] = [
      { sequence: ["g", "d"], action },
    ];

    const { result } = renderHook(() => useSequenceShortcuts(shortcuts));

    act(() => {
      pressKey({ key: "g" });
    });
    act(() => {
      pressKey({ key: "d" });
    });

    expect(result.current.pendingKeys).toEqual([]);
    expect(action).toHaveBeenCalled();
  });

  it("ignores sequences when modifier keys are pressed", () => {
    const action = vi.fn();
    const shortcuts: SequenceShortcut[] = [
      { sequence: ["g", "d"], action },
    ];

    renderHook(() => useSequenceShortcuts(shortcuts));

    pressKey({ key: "g", ctrlKey: true });
    pressKey({ key: "d" });

    expect(action).not.toHaveBeenCalled();
  });

  it("cleans up on unmount", () => {
    const action = vi.fn();
    const shortcuts: SequenceShortcut[] = [
      { sequence: ["g", "d"], action },
    ];

    const { unmount } = renderHook(() => useSequenceShortcuts(shortcuts));

    unmount();

    pressKey({ key: "g" });
    pressKey({ key: "d" });

    expect(action).not.toHaveBeenCalled();
  });
});

describe("utility functions", () => {
  describe("isMac", () => {
    it("returns true on Mac platform", () => {
      Object.defineProperty(navigator, "platform", {
        value: "MacIntel",
        configurable: true,
      });
      expect(isMac()).toBe(true);
    });

    it("returns false on Windows platform", () => {
      Object.defineProperty(navigator, "platform", {
        value: "Win32",
        configurable: true,
      });
      expect(isMac()).toBe(false);
    });
  });

  describe("formatShortcut", () => {
    it("formats a simple key shortcut", () => {
      Object.defineProperty(navigator, "platform", {
        value: "Win32",
        configurable: true,
      });

      expect(formatShortcut({ key: "k" })).toBe("K");
    });

    it("formats ctrl+key on Windows", () => {
      Object.defineProperty(navigator, "platform", {
        value: "Win32",
        configurable: true,
      });

      expect(formatShortcut({ key: "k", ctrl: true })).toBe("Ctrl+K");
    });

    it("formats cmd+key on Mac", () => {
      Object.defineProperty(navigator, "platform", {
        value: "MacIntel",
        configurable: true,
      });

      const result = formatShortcut({ key: "k", meta: true });
      expect(result).toContain("K");
      // Mac uses the command symbol
      expect(result).toContain("\u2318");
    });

    it("formats multiple modifiers", () => {
      Object.defineProperty(navigator, "platform", {
        value: "Win32",
        configurable: true,
      });

      expect(formatShortcut({ key: "s", ctrl: true, shift: true })).toBe(
        "Ctrl+Shift+S"
      );
    });
  });

  describe("formatSequenceShortcut", () => {
    it("formats a two-key sequence", () => {
      expect(formatSequenceShortcut(["g", "d"])).toBe("G then D");
    });

    it("formats a three-key sequence", () => {
      expect(formatSequenceShortcut(["g", "p", "l"])).toBe("G then P then L");
    });
  });

  describe("getModifierKey", () => {
    it("returns Ctrl on Windows", () => {
      Object.defineProperty(navigator, "platform", {
        value: "Win32",
        configurable: true,
      });
      expect(getModifierKey()).toBe("Ctrl");
    });

    it("returns command symbol on Mac", () => {
      Object.defineProperty(navigator, "platform", {
        value: "MacIntel",
        configurable: true,
      });
      expect(getModifierKey()).toBe("\u2318");
    });
  });

  describe("getShiftKey", () => {
    it("returns Shift on Windows", () => {
      Object.defineProperty(navigator, "platform", {
        value: "Win32",
        configurable: true,
      });
      expect(getShiftKey()).toBe("Shift");
    });
  });

  describe("getAltKey", () => {
    it("returns Alt on Windows", () => {
      Object.defineProperty(navigator, "platform", {
        value: "Win32",
        configurable: true,
      });
      expect(getAltKey()).toBe("Alt");
    });

    it("returns option symbol on Mac", () => {
      Object.defineProperty(navigator, "platform", {
        value: "MacIntel",
        configurable: true,
      });
      expect(getAltKey()).toBe("\u2325");
    });
  });
});
