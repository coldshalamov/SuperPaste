import { HotkeyConflict, SLOT_DIGITS } from "./models";

export type HotkeyMapping = ReturnType<typeof createDefaultHotkeys>;

const NUMPAD_SLOT_DIGITS = ["Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5", "Numpad6", "Numpad7", "Numpad8", "Numpad9", "Numpad0"] as const;

function buildNumpadSlotHotkeys(prefix: string) {
  return NUMPAD_SLOT_DIGITS.map((key) => `${prefix}${key}`);
}

export function buildDefaultSlotHotkeys(prefix: string) {
  return SLOT_DIGITS.map((digit) => `${prefix}${digit}`);
}

function buildZeroFirstSlotHotkeys(prefix: string) {
  return ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map(
    (digit) => `${prefix}${digit}`,
  );
}

const LEGACY_BANK_A_PASTE = buildDefaultSlotHotkeys("Alt+");
const LEGACY_BANK_A_SAVE = buildDefaultSlotHotkeys("Alt+Shift+");
const LEGACY_CTRL_BANK_A_PASTE = buildDefaultSlotHotkeys("Ctrl+");
const LEGACY_CTRL_BANK_B_PASTE = buildDefaultSlotHotkeys("Ctrl+Alt+");
const LEGACY_CTRL_BANK_A_SAVE = buildDefaultSlotHotkeys("Ctrl+Shift+");
const LEGACY_CTRL_BANK_B_SAVE = buildDefaultSlotHotkeys("Ctrl+Alt+Shift+");
const LEGACY_NUMPAD_BANK_A_PASTE = buildDefaultSlotHotkeys("Ctrl+Numpad");
const LEGACY_NUMPAD_BANK_B_PASTE = buildDefaultSlotHotkeys("Ctrl+Alt+Numpad");
const LEGACY_NUMPAD_BANK_A_SAVE = buildDefaultSlotHotkeys("Ctrl+Shift+Numpad");
const LEGACY_NUMPAD_BANK_B_SAVE = buildDefaultSlotHotkeys("Ctrl+Alt+Shift+Numpad");
const LEGACY_ZERO_FIRST_BANK_A_PASTE = buildZeroFirstSlotHotkeys("Ctrl+Numpad");
const LEGACY_ZERO_FIRST_BANK_B_PASTE = buildZeroFirstSlotHotkeys("Ctrl+Alt+Numpad");
const LEGACY_ZERO_FIRST_BANK_A_SAVE = buildZeroFirstSlotHotkeys("Ctrl+Shift+Numpad");
const LEGACY_ZERO_FIRST_BANK_B_SAVE = buildZeroFirstSlotHotkeys("Ctrl+Alt+Shift+Numpad");
const DEFAULT_BANK_A_PASTE = buildNumpadSlotHotkeys("Ctrl+");
const DEFAULT_BANK_B_PASTE = buildNumpadSlotHotkeys("Ctrl+Alt+");
const DEFAULT_BANK_A_SAVE = buildNumpadSlotHotkeys("Ctrl+Shift+");
const DEFAULT_BANK_B_SAVE = buildNumpadSlotHotkeys("Ctrl+Alt+Shift+");

const LEGACY_RUNTIME_COMBOS = {
  finalizeCombo: "Alt+Enter",
  cancelCombo: "Alt+Backspace",
  replayLastCombo: "Alt+/",
  toggleWindow: "Alt+`",
  panicToggle: "Alt+Pause",
} as const;

export function createDefaultHotkeys() {
  return {
    bankAPaste: [...DEFAULT_BANK_A_PASTE],
    bankBPaste: [...DEFAULT_BANK_B_PASTE],
    bankASaveClipboard: [...DEFAULT_BANK_A_SAVE],
    bankBSaveClipboard: [...DEFAULT_BANK_B_SAVE],
    finalizeCombo: "Ctrl+NumpadEnter",
    cancelCombo: "Ctrl+NumpadDecimal",
    replayLastCombo: "Ctrl+NumpadAdd",
    toggleWindow: "Ctrl+NumpadSubtract",
    panicToggle: "Ctrl+Pause",
  };
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function matchesAnyPattern(bindings: string[], patterns: string[][]) {
  return patterns.some((pattern) => arraysEqual(bindings, pattern));
}

function matchesRuntimeCombos(hotkeys: HotkeyMapping): boolean {
  return (
    hotkeys.finalizeCombo === LEGACY_RUNTIME_COMBOS.finalizeCombo &&
    hotkeys.cancelCombo === LEGACY_RUNTIME_COMBOS.cancelCombo &&
    hotkeys.replayLastCombo === LEGACY_RUNTIME_COMBOS.replayLastCombo &&
    hotkeys.toggleWindow === LEGACY_RUNTIME_COMBOS.toggleWindow &&
    hotkeys.panicToggle === LEGACY_RUNTIME_COMBOS.panicToggle
  );
}

export function migrateHotkeysIfNeeded(hotkeys: HotkeyMapping): { hotkeys: HotkeyMapping; migrated: boolean } {
  const defaults = createDefaultHotkeys();
  const nextHotkeys: HotkeyMapping = {
    ...hotkeys,
    bankAPaste: hotkeys.bankAPaste,
    bankBPaste: hotkeys.bankBPaste,
    bankASaveClipboard: hotkeys.bankASaveClipboard,
    bankBSaveClipboard: hotkeys.bankBSaveClipboard,
  };

  let migrated = false;

  if (
    matchesAnyPattern(hotkeys.bankAPaste, [
      LEGACY_BANK_A_PASTE,
      LEGACY_CTRL_BANK_A_PASTE,
      LEGACY_NUMPAD_BANK_A_PASTE,
      LEGACY_ZERO_FIRST_BANK_A_PASTE,
    ])
  ) {
    nextHotkeys.bankAPaste = [...DEFAULT_BANK_A_PASTE];
    migrated = true;
  }

  if (
    matchesAnyPattern(hotkeys.bankBPaste, [
      LEGACY_CTRL_BANK_B_PASTE,
      LEGACY_NUMPAD_BANK_B_PASTE,
      LEGACY_ZERO_FIRST_BANK_B_PASTE,
    ])
  ) {
    nextHotkeys.bankBPaste = [...DEFAULT_BANK_B_PASTE];
    migrated = true;
  }

  if (
    matchesAnyPattern(hotkeys.bankASaveClipboard, [
      LEGACY_BANK_A_SAVE,
      LEGACY_CTRL_BANK_A_SAVE,
      LEGACY_NUMPAD_BANK_A_SAVE,
      LEGACY_ZERO_FIRST_BANK_A_SAVE,
    ])
  ) {
    nextHotkeys.bankASaveClipboard = [...DEFAULT_BANK_A_SAVE];
    migrated = true;
  }

  if (
    matchesAnyPattern(hotkeys.bankBSaveClipboard, [
      LEGACY_CTRL_BANK_B_SAVE,
      LEGACY_NUMPAD_BANK_B_SAVE,
      LEGACY_ZERO_FIRST_BANK_B_SAVE,
    ])
  ) {
    nextHotkeys.bankBSaveClipboard = [...DEFAULT_BANK_B_SAVE];
    migrated = true;
  }

  if (matchesRuntimeCombos(hotkeys)) {
    nextHotkeys.finalizeCombo = defaults.finalizeCombo;
    nextHotkeys.cancelCombo = defaults.cancelCombo;
    nextHotkeys.replayLastCombo = defaults.replayLastCombo;
    nextHotkeys.toggleWindow = defaults.toggleWindow;
    nextHotkeys.panicToggle = defaults.panicToggle;
    migrated = true;
  }

  if (!migrated) {
    return { hotkeys, migrated: false };
  }

  return {
    hotkeys: nextHotkeys,
    migrated: true,
  };
}

export function detectHotkeyConflicts(hotkeys: ReturnType<typeof createDefaultHotkeys>) {
  const usage = new Map<string, string[]>();

  Object.entries(hotkeys).forEach(([scope, value]) => {
    if (Array.isArray(value)) {
      value.forEach((binding) => {
        usage.set(binding, [...(usage.get(binding) ?? []), scope]);
      });
      return;
    }

    usage.set(value, [...(usage.get(value) ?? []), scope]);
  });

  const conflicts: HotkeyConflict[] = [];

  usage.forEach((owners, binding) => {
    if (owners.length > 1) {
      conflicts.push({
        binding,
        reasons: ["duplicate"],
      });
    }

    if (binding.startsWith("Alt+F4") || binding.startsWith("Ctrl+Alt+Delete")) {
      conflicts.push({
        binding,
        reasons: ["reserved"],
      });
    }
  });

  return conflicts;
}
