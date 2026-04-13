import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AppSettings,
  ComboBufferState,
  Profile,
  RecipeEntry,
  SlotDefinition,
  SlotReference,
  createEmptyComboBuffer,
  createEmptySlot,
  upsertSlotInBank,
} from "../domain/models";
import {
  materializeImportedDocuments,
  parseImportExportPackText,
  serializePortableProfilePack,
} from "../domain/import-export";
import { createProfilesDocument, createSettingsDocument } from "../domain/documents";
import { resolveProfile } from "../domain/profile-resolution";
import { createSeedDocuments } from "../domain/seeds";
import { detectHotkeyConflicts, migrateHotkeysIfNeeded } from "../domain/hotkeys";
import { parseProfilesDocument, parseSettingsDocument } from "../domain/validation";
import {
  createActiveWindowProvider,
  createClipboardGateway,
  createHotkeyRegistrar,
  createPasteEngine,
  createPersistencePort,
} from "../platform/desktop-system";
import {
  getNativeRuntimeSnapshot,
  isTauriRuntime,
  listenToAppCommand,
  listenToNativeStatus,
  openNativeTestHarnessWindow,
} from "../platform/tauri";
import { SuperPasteEngine } from "../core/superpaste-engine";

type SlotSelection = {
  bankId: "A" | "B";
  slotIndex: number;
};

export type ShellMode = "dock" | "editor";

const persistence = createPersistencePort();
const clipboard = createClipboardGateway();
const pasteEngine = createPasteEngine();
const activeWindowProvider = createActiveWindowProvider();
const hotkeyRegistrar = createHotkeyRegistrar();

async function readFileAsText(file: File) {
  return file.text();
}

function updateProfileSlot(
  profiles: Profile[],
  profileId: string,
  selection: SlotSelection,
  patch: Partial<SlotDefinition>,
) {
  return profiles.map((profile) => {
    if (profile.id !== profileId) {
      return profile;
    }

    const targetBank = selection.bankId === "A" ? profile.bankA : profile.bankB;

    return {
      ...profile,
      bankA:
        selection.bankId === "A"
          ? upsertSlotInBank(targetBank, {
              bankId: selection.bankId,
              slotIndex: selection.slotIndex,
              ...patch,
            })
          : profile.bankA,
      bankB:
        selection.bankId === "B"
          ? upsertSlotInBank(targetBank, {
              bankId: selection.bankId,
              slotIndex: selection.slotIndex,
              ...patch,
            })
          : profile.bankB,
    };
  });
}

export function useSuperPasteApp() {
  const seed = useMemo(() => createSeedDocuments(), []);
  const engineRef = useRef<SuperPasteEngine | null>(null);
  const [engineEpoch, setEngineEpoch] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(seed.settingsDocument.settings);
  const [profiles, setProfiles] = useState<Profile[]>(seed.profilesDocument.profiles);
  const [comboState, setComboState] = useState<ComboBufferState>(createEmptyComboBuffer());
  const [runtime, setRuntime] = useState({
    appDataDir: "",
    storageDescription: "Loading...",
    nativeShellMode: "In-process bridge",
    nativePasteReady: false,
  });
  const [activeWindow, setActiveWindow] = useState({
    title: "",
    processName: "",
    processPath: "",
    workspacePath: "",
  });
  const [finalizedPreview, setFinalizedPreview] = useState("");
  const [lastActionMessage, setLastActionMessage] = useState("Booting SuperPaste...");
  const [editorProfileId, setEditorProfileId] = useState("global-workflow");
  const [slotSelection, setSlotSelection] = useState<SlotSelection>({ bankId: "A", slotIndex: 0 });
  const [shellMode, setShellMode] = useState<ShellMode>("dock");
  const [importExportText, setImportExportText] = useState(
    serializePortableProfilePack(seed.profilesDocument.profiles, "Seed SuperPaste profiles"),
  );
  const [hotkeySummary, setHotkeySummary] = useState("Loading hotkey plan...");
  const settingsRef = useRef(settings);
  const profilesRef = useRef(profiles);

  const resolvedProfile = useMemo(
    () => resolveProfile(profiles, settings, activeWindow),
    [activeWindow, profiles, settings],
  );
  const hotkeyConflicts = useMemo(() => detectHotkeyConflicts(settings.hotkeys), [settings.hotkeys]);
  const hotkeyStatus = useMemo(() => {
    if (!hotkeyConflicts.length) {
      return hotkeySummary;
    }

    return `${hotkeySummary} Warning: ${hotkeyConflicts.length} local conflict${
      hotkeyConflicts.length === 1 ? "" : "s"
    } detected.`;
  }, [hotkeyConflicts.length, hotkeySummary]);

  const selectedProfile = profiles.find((profile) => profile.id === editorProfileId) ?? profiles[0];
  const selectedBank = slotSelection.bankId === "A" ? selectedProfile?.bankA : selectedProfile?.bankB;
  const selectedSlot =
    selectedBank?.slots.find((slot) => slot.slotIndex === slotSelection.slotIndex) ??
    createEmptySlot(slotSelection.bankId, slotSelection.slotIndex, slotSelection.bankId === "B" ? "inherit" : "override");

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  function syncFromEngine(snapshot: ReturnType<SuperPasteEngine["snapshot"]>) {
    setSettings(snapshot.settings);
    setProfiles(snapshot.profiles);
    setComboState(snapshot.comboState);
    setActiveWindow(snapshot.activeWindow);
    setFinalizedPreview(snapshot.finalizedPreview);
    setLastActionMessage(snapshot.lastActionMessage);
  }

  function replaceProfileInCollection(sourceProfiles: Profile[], nextProfile: Profile) {
    return sourceProfiles.map((profile) => (profile.id === nextProfile.id ? nextProfile : profile));
  }

  async function refreshNativeRuntimeState() {
    if (!isTauriRuntime()) {
      return;
    }

    const nativeRuntime = await getNativeRuntimeSnapshot();
    setRuntime((current) => ({
      ...current,
      appDataDir: nativeRuntime.appDataDir,
      nativePasteReady: nativeRuntime.nativePasteReady,
    }));
    setHotkeySummary(nativeRuntime.hotkeySummary);
    setSettings((current) =>
      current.panicModeEnabled === nativeRuntime.panicModeEnabled
        ? current
        : {
            ...current,
            panicModeEnabled: nativeRuntime.panicModeEnabled,
          },
    );
    setLastActionMessage(nativeRuntime.lastStatusMessage);
  }

  async function persist(nextSettings: AppSettings, nextProfiles: Profile[]) {
    const settingsDocument = createSettingsDocument(nextSettings);
    const profilesDocument = createProfilesDocument(nextProfiles);

    await persistence.save(JSON.stringify(settingsDocument, null, 2), JSON.stringify(profilesDocument, null, 2));
    const snapshot = await engineRef.current?.replaceDocuments(nextSettings, nextProfiles);
    if (snapshot) {
      syncFromEngine(snapshot);
    } else {
      setSettings(nextSettings);
      setProfiles(nextProfiles);
    }
    await refreshNativeRuntimeState();
  }

  function describeError(error: unknown) {
    return error instanceof Error ? error.message : "Unknown error.";
  }

  useEffect(() => {
    let active = true;

    async function boot() {
      const persisted = await persistence.load();
      let loadedSettingsDocument = seed.settingsDocument;
      let loadedProfilesDocument = seed.profilesDocument;
      let bootMessage = "Starter loadout ready. Bank A holds repo context, Bank B holds workflow moves.";
      let shouldWriteSeed = persisted.settingsJson === null || persisted.profilesJson === null;

      if (!shouldWriteSeed) {
        try {
          loadedSettingsDocument = parseSettingsDocument(persisted.settingsJson);
          loadedProfilesDocument = parseProfilesDocument(persisted.profilesJson);
        } catch (error) {
          shouldWriteSeed = true;
          bootMessage =
            error instanceof Error
              ? `Recovered from invalid local config and restored the default loadout. ${error.message}`
              : "Recovered from invalid local config and restored the default loadout.";
        }
      }

      if (shouldWriteSeed) {
        await persistence.save(
          JSON.stringify(seed.settingsDocument, null, 2),
          JSON.stringify(seed.profilesDocument, null, 2),
        );
        loadedSettingsDocument = seed.settingsDocument;
        loadedProfilesDocument = seed.profilesDocument;
      }

      const { hotkeys: migratedHotkeys, migrated } = migrateHotkeysIfNeeded(loadedSettingsDocument.settings.hotkeys);
      if (migrated) {
        loadedSettingsDocument = {
          ...loadedSettingsDocument,
          settings: { ...loadedSettingsDocument.settings, hotkeys: migratedHotkeys },
        };
        bootMessage = "Migrated hotkey bindings to Ctrl-based defaults. See Help (F1) for updated shortcuts.";
        await persistence.save(
          JSON.stringify(loadedSettingsDocument, null, 2),
          JSON.stringify(loadedProfilesDocument, null, 2),
        );
      }

      const engine = new SuperPasteEngine(
        {
          activeWindowProvider,
          clipboardGateway: clipboard,
          pasteEngine,
          persistDocuments: async (nextSettings, nextProfiles) => {
            const settingsDocument = createSettingsDocument(nextSettings);
            const profilesDocument = createProfilesDocument(nextProfiles);
            await persistence.save(JSON.stringify(settingsDocument, null, 2), JSON.stringify(profilesDocument, null, 2));
          },
        },
        {
          settings: loadedSettingsDocument.settings,
          profiles: loadedProfilesDocument.profiles,
          lastActionMessage: bootMessage,
        },
      );
      engineRef.current = engine;
      setEngineEpoch((current) => current + 1);
      const snapshot = await engine.refreshActiveWindow();
      const hotkeys = await hotkeyRegistrar.describeBindings(loadedSettingsDocument.settings);

      if (!active) {
        return;
      }

      syncFromEngine(snapshot);
      setEditorProfileId(loadedProfilesDocument.profiles[0]?.id ?? "global-workflow");
      setImportExportText(
        serializePortableProfilePack(loadedProfilesDocument.profiles),
      );
      setHotkeySummary(hotkeys);
      setRuntime({
        appDataDir: persisted.appDataDir,
        storageDescription: persisted.storageDescription,
        nativeShellMode: isTauriRuntime()
          ? "Tauri UI shell + Windows native coordinator"
          : "Browser preview shell",
        nativePasteReady: isTauriRuntime(),
      });

      await refreshNativeRuntimeState();
    }

    void boot();

    return () => {
      active = false;
    };
  }, [activeWindowProvider, clipboard, hotkeyRegistrar, pasteEngine, persistence, seed]);

  useEffect(() => {
    if (!profiles.some((profile) => profile.id === editorProfileId) && profiles[0]) {
      setEditorProfileId(profiles[0].id);
    }
  }, [editorProfileId, profiles]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    const interval = window.setInterval(() => {
      void engine.refreshActiveWindow().then(syncFromEngine).catch(() => undefined);
    }, 1500);

    return () => window.clearInterval(interval);
  }, [engineEpoch]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    void listenToNativeStatus((payload) => {
      setLastActionMessage(payload.message);
      setActiveWindow(payload.activeWindow);
      setSettings((current) =>
        current.panicModeEnabled === payload.panicModeEnabled
          ? current
          : {
              ...current,
              panicModeEnabled: payload.panicModeEnabled,
            },
      );
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    void listenToAppCommand(async (payload) => {
      switch (payload.action) {
        case "show-dock":
          setShellMode("dock");
          break;
        case "show-editor":
          setShellMode("editor");
          break;
        case "toggle-hotkeys":
          await saveSettings({
            ...settingsRef.current,
            panicModeEnabled: !settingsRef.current.panicModeEnabled,
          });
          break;
        case "switch-profile":
          await setManualProfileOverride(payload.profileId ?? null);
          if (payload.profileId) {
            setEditorProfileId(payload.profileId);
          }
          break;
        default:
          break;
      }
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  async function queueSelectedSlot(slotRef: SlotReference) {
    try {
      const snapshot = await engineRef.current?.queueSlot(slotRef);
      if (snapshot) {
        syncFromEngine(snapshot);
      }
    } catch (error) {
      setLastActionMessage(`Could not queue ${slotRef.bankId}${slotRef.slotIndex + 1}. ${describeError(error)}`);
    }
  }

  async function queueSelectedSuper(superId: string) {
    try {
      const snapshot = await engineRef.current?.queueSuper(superId);
      if (snapshot) {
        syncFromEngine(snapshot);
      }
    } catch (error) {
      setLastActionMessage(`Could not queue recipe ${superId}. ${describeError(error)}`);
    }
  }

  async function toggleSelectedStance(slotRef: SlotReference) {
    try {
      const snapshot = await engineRef.current?.toggleStance(slotRef);
      if (snapshot) {
        syncFromEngine(snapshot);
      }
    } catch (error) {
      setLastActionMessage(`Could not toggle stance ${slotRef.bankId}${slotRef.slotIndex + 1}. ${describeError(error)}`);
    }
  }

  async function copyCombo() {
    try {
      const snapshot = await engineRef.current?.finalize("copy-only");
      if (snapshot) {
        syncFromEngine(snapshot);
      }
    } catch (error) {
      setLastActionMessage(`Could not copy combo. ${describeError(error)}`);
    }
  }

  async function pasteCombo() {
    try {
      const snapshot = await engineRef.current?.finalize("paste-now");
      if (snapshot) {
        syncFromEngine(snapshot);
      }
    } catch (error) {
      setLastActionMessage(`Could not paste combo. ${describeError(error)}`);
    }
  }

  async function removeLast() {
    try {
      const snapshot = await engineRef.current?.removeLast();
      if (snapshot) {
        syncFromEngine(snapshot);
      }
    } catch (error) {
      setLastActionMessage(`Could not remove the last queued entry. ${describeError(error)}`);
    }
  }

  async function cancelCombo() {
    try {
      const snapshot = await engineRef.current?.cancel();
      if (snapshot) {
        syncFromEngine(snapshot);
      }
    } catch (error) {
      setLastActionMessage(`Could not clear the combo buffer. ${describeError(error)}`);
    }
  }

  async function replayLastCombo() {
    try {
      const snapshot = await engineRef.current?.replayLast();
      if (snapshot) {
        syncFromEngine(snapshot);
      }
    } catch (error) {
      setLastActionMessage(`Could not replay the last combo. ${describeError(error)}`);
    }
  }

  async function updateSlot(patch: Partial<SlotDefinition>) {
    if (!selectedProfile) {
      return;
    }

    try {
      const nextProfiles = updateProfileSlot(profiles, selectedProfile.id, slotSelection, patch);
      await persist(settingsRef.current, nextProfiles);
      setLastActionMessage(`Saved ${selectedProfile.name} ${slotSelection.bankId}${slotSelection.slotIndex + 1}.`);
    } catch (error) {
      setLastActionMessage(`Could not save the selected slot. ${describeError(error)}`);
    }
  }

  async function saveProfile(nextProfile: Profile) {
    try {
      const nextProfiles = replaceProfileInCollection(profilesRef.current, nextProfile);
      await persist(settings, nextProfiles);
      setLastActionMessage(`Saved profile ${nextProfile.name}.`);
    } catch (error) {
      setLastActionMessage(`Could not save profile ${nextProfile.name}. ${describeError(error)}`);
    }
  }

  async function saveSettings(nextSettings: AppSettings) {
    try {
      await persist(nextSettings, profilesRef.current);
      const nextConflicts = detectHotkeyConflicts(nextSettings.hotkeys);
      setLastActionMessage(
        nextConflicts.length
          ? `Settings saved with ${nextConflicts.length} hotkey warning${nextConflicts.length === 1 ? "" : "s"}.`
          : "Settings saved.",
      );
    } catch (error) {
      setLastActionMessage(`Could not save settings. ${describeError(error)}`);
    }
  }

  async function setManualProfileOverride(profileId: string | null) {
    try {
      const nextSettings = {
        ...settingsRef.current,
        activeProfileIdOverride: profileId,
      };
      await persist(nextSettings, profilesRef.current);
      setLastActionMessage(profileId ? `Manual profile override set to ${profileId}.` : "Profile override cleared.");
    } catch (error) {
      setLastActionMessage(`Could not change the manual profile override. ${describeError(error)}`);
    }
  }

  async function pasteSlot(slotRef: SlotReference) {
    try {
      const snapshot = await engineRef.current?.directPasteSlot(slotRef);
      if (snapshot) {
        syncFromEngine(snapshot);
      }
    } catch (error) {
      setLastActionMessage(`Could not paste ${slotRef.bankId}${slotRef.slotIndex + 1}. ${describeError(error)}`);
    }
  }

  function editSlot(selection: SlotSelection, profileId?: string) {
    setShellMode("editor");
    if (profileId) {
      setEditorProfileId(profileId);
    }
    setSlotSelection(selection);
  }

  async function exportPack() {
    try {
      const json = serializePortableProfilePack(profiles, `${resolvedProfile.profile.name} profile pack`);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "superpaste-content-pack.superpaste.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setImportExportText(json);
      setLastActionMessage("Exported a portable SuperPaste profile pack.");
    } catch (error) {
      setLastActionMessage(`Could not export the profile pack. ${describeError(error)}`);
    }
  }

  async function importPackFromFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await readFileAsText(file);
      const pack = parseImportExportPackText(text);
      const documents = materializeImportedDocuments(pack, settings);
      await persist(documents.settings, documents.profiles);
      setImportExportText(serializePortableProfilePack(documents.profiles));
      setLastActionMessage(`Imported ${file.name}.`);
    } catch (error) {
      setLastActionMessage(`Could not import ${file.name}. ${describeError(error)}`);
    }
  }

  async function applyImportText() {
    if (!importExportText.trim()) {
      return;
    }

    try {
      const pack = parseImportExportPackText(importExportText);
      const documents = materializeImportedDocuments(pack, settings);
      await persist(documents.settings, documents.profiles);
      setLastActionMessage("Applied pack JSON into the local loadout.");
    } catch (error) {
      setLastActionMessage(`Could not apply the pack JSON. ${describeError(error)}`);
    }
  }

  async function saveRecipe(
    profileId: string,
    recipeId: string | null,
    patch: {
      name: string;
      description: string;
      steps: RecipeEntry[];
      assemblyJoiner: string;
      hotkeyHint: string;
    },
  ) {
    try {
      const nextProfiles = profiles.map((profile) => {
        if (profile.id !== profileId) {
          return profile;
        }

        const nextRecipe = {
          id: recipeId ?? `recipe-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          name: patch.name,
          description: patch.description,
          steps: patch.steps,
          applyStances: true,
          hotkeyHint: patch.hotkeyHint.trim() || null,
          assembly: {
            style: "markdown" as const,
            joiner: patch.assemblyJoiner,
          },
        };

        return {
          ...profile,
          supers: [...profile.supers.filter((entry) => entry.id !== nextRecipe.id), nextRecipe],
        };
      });

      await persist(settings, nextProfiles);
      setLastActionMessage(`Saved recipe ${patch.name}.`);
    } catch (error) {
      setLastActionMessage(`Could not save recipe ${patch.name}. ${describeError(error)}`);
    }
  }

  async function deleteRecipe(profileId: string, recipeId: string) {
    try {
      const nextProfiles = profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              supers: profile.supers.filter((entry) => entry.id !== recipeId),
            }
          : profile,
      );

      await persist(settings, nextProfiles);
      setLastActionMessage("Deleted recipe.");
    } catch (error) {
      setLastActionMessage(`Could not delete the recipe. ${describeError(error)}`);
    }
  }

  async function openTestHarness() {
    try {
      if (isTauriRuntime()) {
        await openNativeTestHarnessWindow();
      } else {
        window.open(`${window.location.pathname}?view=harness`, "_blank", "width=720,height=560");
      }
      setLastActionMessage("Opened the local test harness window.");
    } catch (error) {
      setLastActionMessage(`Could not open the test harness. ${describeError(error)}`);
    }
  }

  return {
    settings,
    profiles,
    comboState,
    runtime,
    activeWindow,
    resolvedProfile,
    finalizedPreview,
    lastActionMessage,
    shellMode,
    setShellMode,
    editorProfileId,
    setEditorProfileId,
    slotSelection,
    setSlotSelection,
    queueSlot: queueSelectedSlot,
    queueSuper: queueSelectedSuper,
    toggleStance: toggleSelectedStance,
    pasteSlot,
    editSlot,
    copyCombo,
    pasteCombo,
    removeLast,
    cancelCombo,
    replayLast: replayLastCombo,
    updateSlot,
    saveProfile,
    saveSettings,
    setManualProfileOverride,
    exportPack,
    importPackFromFile,
    applyImportText,
    saveRecipe,
    deleteRecipe,
    openTestHarness,
    importExportText,
    setImportExportText,
    hotkeySummary: hotkeyStatus,
    hotkeyConflicts,
    selectedSlot,
  };
}
