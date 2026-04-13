import { ActiveWindowSnapshot, AppSettings } from "../domain/models";
import { ClipboardGateway, PasteEngine, PastePlan, PasteResult, PersistencePort } from "./contracts";

const SETTINGS_STORAGE_KEY = "superpaste.settings";
const PROFILES_STORAGE_KEY = "superpaste.profiles";

export class BrowserPersistencePort implements PersistencePort {
  async load() {
    return {
      appDataDir: "browser://localStorage",
      storageDescription: "Browser fallback storage",
      settingsJson: window.localStorage.getItem(SETTINGS_STORAGE_KEY),
      profilesJson: window.localStorage.getItem(PROFILES_STORAGE_KEY),
    };
  }

  async save(settingsJson: string, profilesJson: string) {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, settingsJson);
    window.localStorage.setItem(PROFILES_STORAGE_KEY, profilesJson);
  }
}

export class BrowserActiveWindowProvider {
  async getSnapshot(): Promise<ActiveWindowSnapshot> {
    return {
      title: document.title,
      processName: "browser-preview",
      processPath: "",
      workspacePath: "",
    };
  }
}

export class BrowserClipboardGateway implements ClipboardGateway {
  async readText() {
    return navigator.clipboard?.readText?.() ?? "";
  }

  async writeText(text: string) {
    await navigator.clipboard.writeText(text);
  }
}

export class BrowserPasteEngine implements PasteEngine {
  async execute(plan: PastePlan): Promise<PasteResult> {
    if (plan.executionMode === "queue-only") {
      return {
        ok: true,
        message: "Combo assembled and queued only.",
      };
    }

    if (plan.executionMode === "paste-now") {
      return {
        ok: false,
        message: "Native paste injection is planned for the next pass. Use Copy combo for now.",
      };
    }

    return {
      ok: true,
      message: "Combo copied to clipboard.",
      copiedText: plan.text,
    };
  }
}

export class BrowserHotkeyRegistrar {
  async describeBindings(settings: AppSettings) {
    return `Planned hotkeys: ${settings.hotkeys.bankAPaste[0]} for A1, ${settings.hotkeys.bankBPaste[0]} for B1, ${settings.hotkeys.finalizeCombo} to fire.`;
  }

  async panicDisabled() {
    return;
  }
}
