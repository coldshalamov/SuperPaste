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

describe("migrateHotkeysIfNeeded", () => {
  it("migrates legacy alt-based Bank A bindings to ctrl digit defaults", () => {
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

  it("migrates numpad defaults from older builds into ctrl digit defaults", () => {
    const legacy = createDefaultHotkeys();
    legacy.bankAPaste = [
      "Ctrl+Numpad0",
      "Ctrl+Numpad1",
      "Ctrl+Numpad2",
      "Ctrl+Numpad3",
      "Ctrl+Numpad4",
      "Ctrl+Numpad5",
      "Ctrl+Numpad6",
      "Ctrl+Numpad7",
      "Ctrl+Numpad8",
      "Ctrl+Numpad9",
    ];
    legacy.bankBPaste = [
      "Ctrl+Alt+Numpad0",
      "Ctrl+Alt+Numpad1",
      "Ctrl+Alt+Numpad2",
      "Ctrl+Alt+Numpad3",
      "Ctrl+Alt+Numpad4",
      "Ctrl+Alt+Numpad5",
      "Ctrl+Alt+Numpad6",
      "Ctrl+Alt+Numpad7",
      "Ctrl+Alt+Numpad8",
      "Ctrl+Alt+Numpad9",
    ];
    legacy.bankASaveClipboard = [
      "Ctrl+Shift+Numpad0",
      "Ctrl+Shift+Numpad1",
      "Ctrl+Shift+Numpad2",
      "Ctrl+Shift+Numpad3",
      "Ctrl+Shift+Numpad4",
      "Ctrl+Shift+Numpad5",
      "Ctrl+Shift+Numpad6",
      "Ctrl+Shift+Numpad7",
      "Ctrl+Shift+Numpad8",
      "Ctrl+Shift+Numpad9",
    ];
    legacy.bankBSaveClipboard = [
      "Ctrl+Alt+Shift+Numpad0",
      "Ctrl+Alt+Shift+Numpad1",
      "Ctrl+Alt+Shift+Numpad2",
      "Ctrl+Alt+Shift+Numpad3",
      "Ctrl+Alt+Shift+Numpad4",
      "Ctrl+Alt+Shift+Numpad5",
      "Ctrl+Alt+Shift+Numpad6",
      "Ctrl+Alt+Shift+Numpad7",
      "Ctrl+Alt+Shift+Numpad8",
      "Ctrl+Alt+Shift+Numpad9",
    ];

    const migrated = migrateHotkeysIfNeeded(legacy);
    const defaults = createDefaultHotkeys();

    expect(migrated.migrated).toBe(true);
    expect(migrated.hotkeys.bankAPaste).toEqual(defaults.bankAPaste);
    expect(migrated.hotkeys.bankBPaste).toEqual(defaults.bankBPaste);
    expect(migrated.hotkeys.bankASaveClipboard).toEqual(defaults.bankASaveClipboard);
    expect(migrated.hotkeys.bankBSaveClipboard).toEqual(defaults.bankBSaveClipboard);
  });
});
