import { describe, expect, it } from "vitest";
import {
  createDefaultHotkeys,
  detectHotkeyConflicts,
  migrateHotkeysIfNeeded,
} from "../hotkeys";

describe("detectHotkeyConflicts", () => {
  it("flags duplicate bindings across hotkey scopes", () => {
    const hotkeys = createDefaultHotkeys();
    hotkeys.finalizeCombo = hotkeys.cancelCombo;

    expect(detectHotkeyConflicts(hotkeys)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          binding: hotkeys.cancelCombo,
          reasons: ["duplicate"],
        }),
      ]),
    );
  });

  it("flags reserved system bindings", () => {
    const hotkeys = createDefaultHotkeys();
    hotkeys.toggleWindow = "Alt+F4";
    hotkeys.panicToggle = "Ctrl+Alt+Delete";

    expect(detectHotkeyConflicts(hotkeys)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          binding: "Alt+F4",
          reasons: ["reserved"],
        }),
        expect.objectContaining({
          binding: "Ctrl+Alt+Delete",
          reasons: ["reserved"],
        }),
      ]),
    );
  });
});

describe("createDefaultHotkeys", () => {
  it("uses numpad keys as default slot bindings", () => {
    const defaults = createDefaultHotkeys();

    expect(defaults.bankAPaste[0]).toBe("Ctrl+Numpad1");
    expect(defaults.bankAPaste[9]).toBe("Ctrl+Numpad0");
    expect(defaults.bankASaveClipboard[0]).toBe("Ctrl+Shift+Numpad1");
    expect(defaults.bankBPaste[0]).toBe("Ctrl+Alt+Numpad1");
    expect(defaults.bankBSaveClipboard[0]).toBe("Ctrl+Alt+Shift+Numpad1");
  });

  it("uses numpad runtime combos", () => {
    const defaults = createDefaultHotkeys();

    expect(defaults.finalizeCombo).toBe("Ctrl+NumpadEnter");
    expect(defaults.cancelCombo).toBe("Ctrl+NumpadDecimal");
    expect(defaults.replayLastCombo).toBe("Ctrl+NumpadAdd");
    expect(defaults.toggleWindow).toBe("Ctrl+NumpadSubtract");
    expect(defaults.panicToggle).toBe("Ctrl+Pause");
  });

  it("has no Alt-only defaults", () => {
    const defaults = createDefaultHotkeys();
    const slotBindings = [
      ...defaults.bankAPaste,
      ...defaults.bankASaveClipboard,
    ];

    for (const binding of slotBindings) {
      expect(binding).not.toMatch(/^Alt\+/);
      expect(binding).not.toMatch(/^Alt\+Shift\+/);
    }
  });
});

describe("migrateHotkeysIfNeeded", () => {
  it("migrates legacy alt-based Bank A bindings to numpad defaults", () => {
    const legacy = createDefaultHotkeys();
    legacy.bankAPaste = ["Alt+1", "Alt+2", "Alt+3", "Alt+4", "Alt+5", "Alt+6", "Alt+7", "Alt+8", "Alt+9", "Alt+0"];
    legacy.bankASaveClipboard = [
      "Alt+Shift+1",
      "Alt+Shift+2",
      "Alt+Shift+3",
      "Alt+Shift+4",
      "Alt+Shift+5",
      "Alt+Shift+6",
      "Alt+Shift+7",
      "Alt+Shift+8",
      "Alt+Shift+9",
      "Alt+Shift+0",
    ];

    const migrated = migrateHotkeysIfNeeded(legacy);

    expect(migrated.migrated).toBe(true);
    expect(migrated.hotkeys.bankAPaste).toEqual(createDefaultHotkeys().bankAPaste);
    expect(migrated.hotkeys.bankASaveClipboard).toEqual(createDefaultHotkeys().bankASaveClipboard);
  });

  it("migrates old Ctrl+digit defaults to numpad defaults", () => {
    const legacy = createDefaultHotkeys();
    legacy.bankAPaste = ["Ctrl+1", "Ctrl+2", "Ctrl+3", "Ctrl+4", "Ctrl+5", "Ctrl+6", "Ctrl+7", "Ctrl+8", "Ctrl+9", "Ctrl+0"];
    legacy.bankBPaste = ["Ctrl+Alt+1", "Ctrl+Alt+2", "Ctrl+Alt+3", "Ctrl+Alt+4", "Ctrl+Alt+5", "Ctrl+Alt+6", "Ctrl+Alt+7", "Ctrl+Alt+8", "Ctrl+Alt+9", "Ctrl+Alt+0"];
    legacy.bankASaveClipboard = ["Ctrl+Shift+1", "Ctrl+Shift+2", "Ctrl+Shift+3", "Ctrl+Shift+4", "Ctrl+Shift+5", "Ctrl+Shift+6", "Ctrl+Shift+7", "Ctrl+Shift+8", "Ctrl+Shift+9", "Ctrl+Shift+0"];
    legacy.bankBSaveClipboard = ["Ctrl+Alt+Shift+1", "Ctrl+Alt+Shift+2", "Ctrl+Alt+Shift+3", "Ctrl+Alt+Shift+4", "Ctrl+Alt+Shift+5", "Ctrl+Alt+Shift+6", "Ctrl+Alt+Shift+7", "Ctrl+Alt+Shift+8", "Ctrl+Alt+Shift+9", "Ctrl+Alt+Shift+0"];

    const migrated = migrateHotkeysIfNeeded(legacy);
    const defaults = createDefaultHotkeys();

    expect(migrated.migrated).toBe(true);
    expect(migrated.hotkeys.bankAPaste).toEqual(defaults.bankAPaste);
    expect(migrated.hotkeys.bankBPaste).toEqual(defaults.bankBPaste);
    expect(migrated.hotkeys.bankASaveClipboard).toEqual(defaults.bankASaveClipboard);
    expect(migrated.hotkeys.bankBSaveClipboard).toEqual(defaults.bankBSaveClipboard);
  });

  it("migrates legacy Alt-based runtime combos to numpad combos", () => {
    const legacy = createDefaultHotkeys();
    legacy.finalizeCombo = "Alt+Enter";
    legacy.cancelCombo = "Alt+Backspace";
    legacy.replayLastCombo = "Alt+/";
    legacy.toggleWindow = "Alt+`";
    legacy.panicToggle = "Alt+Pause";

    const migrated = migrateHotkeysIfNeeded(legacy);
    const defaults = createDefaultHotkeys();

    expect(migrated.migrated).toBe(true);
    expect(migrated.hotkeys.finalizeCombo).toBe(defaults.finalizeCombo);
    expect(migrated.hotkeys.cancelCombo).toBe(defaults.cancelCombo);
    expect(migrated.hotkeys.replayLastCombo).toBe(defaults.replayLastCombo);
    expect(migrated.hotkeys.toggleWindow).toBe(defaults.toggleWindow);
    expect(migrated.hotkeys.panicToggle).toBe(defaults.panicToggle);
  });

  it("preserves custom bindings that do not match any legacy pattern", () => {
    const custom = createDefaultHotkeys();
    custom.bankAPaste = ["Ctrl+F1", "Ctrl+F2", "Ctrl+F3", "Ctrl+F4", "Ctrl+F5", "Ctrl+F6", "Ctrl+F7", "Ctrl+F8", "Ctrl+F9", "Ctrl+F10"];
    custom.bankBPaste = ["Ctrl+Alt+F1", "Ctrl+Alt+F2", "Ctrl+Alt+F3", "Ctrl+Alt+F4", "Ctrl+Alt+F5", "Ctrl+Alt+F6", "Ctrl+Alt+F7", "Ctrl+Alt+F8", "Ctrl+Alt+F9", "Ctrl+Alt+F10"];
    custom.bankASaveClipboard = ["Ctrl+Shift+F1", "Ctrl+Shift+F2", "Ctrl+Shift+F3", "Ctrl+Shift+F4", "Ctrl+Shift+F5", "Ctrl+Shift+F6", "Ctrl+Shift+F7", "Ctrl+Shift+F8", "Ctrl+Shift+F9", "Ctrl+Shift+F10"];
    custom.bankBSaveClipboard = ["Ctrl+Alt+Shift+F1", "Ctrl+Alt+Shift+F2", "Ctrl+Alt+Shift+F3", "Ctrl+Alt+Shift+F4", "Ctrl+Alt+Shift+F5", "Ctrl+Alt+Shift+F6", "Ctrl+Alt+Shift+F7", "Ctrl+Alt+Shift+F8", "Ctrl+Alt+Shift+F9", "Ctrl+Alt+Shift+F10"];
    custom.finalizeCombo = "Ctrl+Enter";
    custom.cancelCombo = "Ctrl+Escape";
    custom.replayLastCombo = "Ctrl+R";
    custom.toggleWindow = "Ctrl+`";
    custom.panicToggle = "Ctrl+Pause";

    const migrated = migrateHotkeysIfNeeded(custom);

    expect(migrated.migrated).toBe(false);
    expect(migrated.hotkeys.bankAPaste).toEqual(custom.bankAPaste);
  });
});
