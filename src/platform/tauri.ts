import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ActiveWindowSnapshot } from "../domain/models";

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type NativePersistenceSnapshot = {
  appDataDir: string;
  settingsJson: string | null;
  profilesJson: string | null;
};

export type NativeRuntimeSnapshot = {
  appDataDir: string;
  hotkeySummary: string;
  lastStatusMessage: string;
  activeWindow: ActiveWindowSnapshot;
  nativePasteReady: boolean;
  panicModeEnabled: boolean;
  degradedMode: boolean;
  registeredBindingCount: number;
  failedBindingCount: number;
  activeProfileOverrideId?: string | null;
  lastEditorProfileId?: string | null;
  resolvedProfileId: string;
  resolvedProfileReason: string;
};

export type NativeDiagnosticsSnapshot = {
  appDataDir: string;
  lastStatusMessage: string;
  activeWindow: ActiveWindowSnapshot;
  hotkeySummary: string;
  degradedMode: boolean;
  currentHotkeys: Record<string, unknown>;
  registeredBindings: string[];
  failedBindings: string[];
  activeProfileOverrideId?: string | null;
  lastEditorProfileId?: string | null;
  resolvedProfileId: string;
  resolvedProfileReason: string;
  recentLogEntries: string[];
};

export type NativeStatusPayload = {
  message: string;
  activeWindow: ActiveWindowSnapshot;
  panicModeEnabled: boolean;
};

export type AppCommandPayload = {
  action:
    | "paste-combo"
    | "cancel-combo"
    | "replay-last-combo"
    | "show-dock"
    | "show-editor"
    | "toggle-hotkeys"
    | "switch-profile"
    | "queue-slot";
  profileId?: string | null;
  bankId?: "A" | "B" | null;
  slotIndex?: number | null;
};

export type NativePastePlan = {
  text: string;
  executionMode: "copy-only" | "paste-now" | "queue-only";
  restoreClipboard: boolean;
};

export type NativePasteResult = {
  ok: boolean;
  message: string;
  copiedText?: string;
};

export async function loadNativePersistenceSnapshot() {
  return invoke<NativePersistenceSnapshot>("load_persistence_snapshot");
}

export async function saveNativePersistenceSnapshot(settingsJson: string, profilesJson: string) {
  return invoke<void>("save_persistence_snapshot", {
    settingsJson,
    profilesJson,
  });
}

export async function refreshNativeRuntime() {
  return invoke<NativeRuntimeSnapshot>("refresh_native_runtime");
}

export async function getNativeRuntimeSnapshot() {
  return invoke<NativeRuntimeSnapshot>("get_native_runtime_snapshot");
}

export async function getNativeDiagnosticsSnapshot() {
  return invoke<NativeDiagnosticsSnapshot>("get_native_diagnostics_snapshot");
}

export async function getNativeActiveWindowSnapshot() {
  return invoke<ActiveWindowSnapshot>("get_active_window_snapshot");
}

export async function readSystemClipboardText() {
  return invoke<string>("read_system_clipboard_text");
}

export async function writeSystemClipboardText(text: string) {
  return invoke<void>("write_system_clipboard_text", { text });
}

export async function executeNativePastePlan(plan: NativePastePlan) {
  return invoke<NativePasteResult>("execute_native_paste_plan", { plan });
}

export async function setNativeEditorProfileHint(profileId: string | null) {
  return invoke<void>("set_editor_profile_hint", { profileId });
}

export async function openNativeTestHarnessWindow() {
  return invoke<void>("open_test_harness_window");
}

export async function listenToNativeStatus(
  callback: (payload: NativeStatusPayload) => void,
) {
  return listen<NativeStatusPayload>("native-status", (event) => callback(event.payload));
}

export async function listenToAppCommand(
  callback: (payload: AppCommandPayload) => void,
) {
  return listen<AppCommandPayload>("app-command", (event) => callback(event.payload));
}
