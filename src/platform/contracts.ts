import { ActiveWindowSnapshot, AppSettings, ComboBufferState } from "../domain/models";

export type PastePlan = {
  text: string;
  executionMode: "copy-only" | "paste-now" | "queue-only";
  restoreClipboard: boolean;
};

export type PasteResult = {
  ok: boolean;
  message: string;
  copiedText?: string;
};

export type RuntimeInfo = {
  appDataDir: string;
  storageDescription: string;
  nativeShellMode: string;
  nativePasteReady: boolean;
};

export interface ActiveWindowProvider {
  getSnapshot(): Promise<ActiveWindowSnapshot>;
}

export interface ClipboardGateway {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

export interface PasteEngine {
  execute(plan: PastePlan): Promise<PasteResult>;
}

export interface HotkeyRegistrar {
  describeBindings(settings: AppSettings): Promise<string>;
  panicDisabled(state: boolean): Promise<void>;
}

export interface PersistencePort {
  load(): Promise<{
    appDataDir: string;
    storageDescription: string;
    settingsJson: string | null;
    profilesJson: string | null;
  }>;
  save(settingsJson: string, profilesJson: string): Promise<void>;
}

export type AppRuntimeSnapshot = {
  comboState: ComboBufferState;
  runtimeInfo: RuntimeInfo;
};
