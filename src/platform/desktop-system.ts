import { AppSettings } from "../domain/models";
import {
  BrowserActiveWindowProvider,
  BrowserClipboardGateway,
  BrowserHotkeyRegistrar,
  BrowserPasteEngine,
  BrowserPersistencePort,
} from "./browser-system";
import { ClipboardGateway, PasteEngine, PastePlan, PersistencePort } from "./contracts";
import {
  executeNativePastePlan,
  getNativeActiveWindowSnapshot,
  getNativeRuntimeSnapshot,
  isTauriRuntime,
  loadNativePersistenceSnapshot,
  readSystemClipboardText,
  refreshNativeRuntime,
  saveNativePersistenceSnapshot,
  writeSystemClipboardText,
} from "./tauri";

class TauriPersistencePort implements PersistencePort {
  async load() {
    const snapshot = await loadNativePersistenceSnapshot();

    return {
      ...snapshot,
      storageDescription: "AppData persistence via Tauri command bridge",
    };
  }

  async save(settingsJson: string, profilesJson: string) {
    await saveNativePersistenceSnapshot(settingsJson, profilesJson);
    await refreshNativeRuntime();
  }
}

class TauriActiveWindowProvider {
  async getSnapshot() {
    return getNativeActiveWindowSnapshot();
  }
}

class TauriClipboardGateway implements ClipboardGateway {
  async readText() {
    return readSystemClipboardText();
  }

  async writeText(text: string) {
    await writeSystemClipboardText(text);
  }
}

class TauriPasteEngine implements PasteEngine {
  async execute(plan: PastePlan) {
    return executeNativePastePlan(plan);
  }
}

class TauriHotkeyRegistrar {
  async describeBindings() {
    const runtime = await getNativeRuntimeSnapshot();
    return runtime.hotkeySummary;
  }

  async panicDisabled(_state: boolean) {
    await refreshNativeRuntime();
  }
}

export function createPersistencePort(): PersistencePort {
  return isTauriRuntime() ? new TauriPersistencePort() : new BrowserPersistencePort();
}

export function createActiveWindowProvider() {
  return isTauriRuntime() ? new TauriActiveWindowProvider() : new BrowserActiveWindowProvider();
}

export function createClipboardGateway() {
  return isTauriRuntime() ? new TauriClipboardGateway() : new BrowserClipboardGateway();
}

export function createPasteEngine() {
  return isTauriRuntime() ? new TauriPasteEngine() : new BrowserPasteEngine();
}

export function createHotkeyRegistrar() {
  return isTauriRuntime() ? new TauriHotkeyRegistrar() : new BrowserHotkeyRegistrar();
}

export async function describeHotkeys(settings: AppSettings) {
  return createHotkeyRegistrar().describeBindings(settings);
}
