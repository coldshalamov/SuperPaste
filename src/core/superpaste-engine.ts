import { FireMode } from "../domain/models";
import {
  ActiveWindowSnapshot,
  AppSettings,
  ComboBufferState,
  Profile,
  SlotDefinition,
  SlotReference,
} from "../domain/models";
import {
  cancelCombo,
  finalizeCombo,
  queueSlot,
  queueSuper,
  removeLastQueuedEntry,
  replayLast,
  toggleStance,
} from "../domain/combo-engine";
import { ResolvedProfile, resolveProfile } from "../domain/profile-resolution";
import { ClipboardGateway, PasteEngine, ActiveWindowProvider } from "../platform/contracts";

export interface SuperPasteEngineDependencies {
  activeWindowProvider: ActiveWindowProvider;
  clipboardGateway: ClipboardGateway;
  pasteEngine: PasteEngine;
  persistDocuments: (settings: AppSettings, profiles: Profile[]) => Promise<void>;
}

export interface SuperPasteEngineSeed {
  settings: AppSettings;
  profiles: Profile[];
  comboState?: ComboBufferState;
  activeWindow?: ActiveWindowSnapshot;
  finalizedPreview?: string;
  lastActionMessage?: string;
}

export interface SuperPasteEngineSnapshot {
  settings: AppSettings;
  profiles: Profile[];
  comboState: ComboBufferState;
  activeWindow: ActiveWindowSnapshot;
  resolvedProfile: ResolvedProfile;
  finalizedPreview: string;
  lastActionMessage: string;
}

type EngineState = {
  settings: AppSettings;
  profiles: Profile[];
  comboState: ComboBufferState;
  activeWindow: ActiveWindowSnapshot;
  finalizedPreview: string;
  lastActionMessage: string;
};

function emptyWindow(): ActiveWindowSnapshot {
  return {
    title: "",
    processName: "",
    processPath: "",
    workspacePath: "",
  };
}

function findSlot(slots: SlotDefinition[], slotRef: SlotReference) {
  return slots.find((slot) => slot.slotIndex === slotRef.slotIndex);
}

function updateProfileSlot(profiles: Profile[], profileId: string, slotRef: SlotReference, content: string) {
  return profiles.map((profile) => {
    if (profile.id !== profileId) {
      return profile;
    }

    const bankKey = slotRef.bankId === "A" ? "bankA" : "bankB";
    const bank = profile[bankKey];

    return {
      ...profile,
      [bankKey]: {
        ...bank,
        slots: bank.slots.map((slot) =>
          slot.slotIndex === slotRef.slotIndex
            ? {
                ...slot,
                content,
                enabled: true,
                inheritanceMode: "override",
              }
            : slot,
        ),
      },
    };
  });
}

export class SuperPasteEngine {
  private queue: Promise<void> = Promise.resolve();
  private state: EngineState;

  constructor(
    private readonly dependencies: SuperPasteEngineDependencies,
    seed: SuperPasteEngineSeed,
  ) {
    this.state = {
      settings: seed.settings,
      profiles: seed.profiles,
      comboState: seed.comboState ?? {
        queuedEntries: [],
        activeStances: [],
        lastFinalized: null,
      },
      activeWindow: seed.activeWindow ?? emptyWindow(),
      finalizedPreview: seed.finalizedPreview ?? "",
      lastActionMessage: seed.lastActionMessage ?? "SuperPaste ready.",
    };
  }

  snapshot(): SuperPasteEngineSnapshot {
    return this.buildSnapshot();
  }

  async replaceDocuments(settings: AppSettings, profiles: Profile[]) {
    return this.serialize(async () => {
      this.state = {
        ...this.state,
        settings,
        profiles,
      };

      return this.buildSnapshot();
    });
  }

  async refreshActiveWindow() {
    return this.serialize(async () => {
      await this.refreshActiveWindowInternal();
      return this.buildSnapshot();
    });
  }

  async queueSlot(slotRef: SlotReference) {
    return this.serialize(async () => {
      this.state = {
        ...this.state,
        comboState: queueSlot(this.state.comboState, slotRef),
        lastActionMessage: `Queued ${slotRef.bankId}${slotRef.slotIndex + 1}.`,
      };

      return this.buildSnapshot();
    });
  }

  async queueSuper(superId: string) {
    return this.serialize(async () => {
      this.state = {
        ...this.state,
        comboState: queueSuper(this.state.comboState, superId),
        lastActionMessage: `Queued super ${superId}.`,
      };

      return this.buildSnapshot();
    });
  }

  async toggleStance(slotRef: SlotReference) {
    return this.serialize(async () => {
      this.state = {
        ...this.state,
        comboState: toggleStance(this.state.comboState, slotRef),
        lastActionMessage: `Toggled stance ${slotRef.bankId}${slotRef.slotIndex + 1}.`,
      };

      return this.buildSnapshot();
    });
  }

  async removeLast() {
    return this.serialize(async () => {
      this.state = {
        ...this.state,
        comboState: removeLastQueuedEntry(this.state.comboState),
        lastActionMessage: "Removed the last queued combo entry.",
      };

      return this.buildSnapshot();
    });
  }

  async cancel() {
    return this.serialize(async () => {
      this.state = {
        ...this.state,
        comboState: cancelCombo(this.state.comboState),
        finalizedPreview: "",
        lastActionMessage: "Combo buffer cleared. Stances stay latched.",
      };

      return this.buildSnapshot();
    });
  }

  async replayLast() {
    return this.serialize(async () => {
      const last = replayLast(this.state.comboState);

      this.state = {
        ...this.state,
        finalizedPreview: last?.text ?? "",
        lastActionMessage: last ? "Loaded the last finalized combo preview." : "No combo replay available yet.",
      };

      return this.buildSnapshot();
    });
  }

  async finalize(executionMode: FireMode) {
    return this.serialize(async () => {
      await this.refreshActiveWindowInternal();
      const resolvedProfile = this.resolveCurrentProfile();
      const clipboard = await this.dependencies.clipboardGateway.readText().catch(() => "");
      const { finalized, nextState } = finalizeCombo(
        this.state.comboState,
        {
          bankA: resolvedProfile.effectiveBankA.slots,
          bankB: resolvedProfile.effectiveBankB.slots,
          supers: resolvedProfile.effectiveSupers,
          assembly: resolvedProfile.effectiveAssembly,
        },
        this.state.settings,
        {
          clipboard,
          profile: resolvedProfile.profile.name,
          active_app: this.state.activeWindow.processName || "unknown",
          date: new Date().toISOString().slice(0, 10),
        },
      );

      if (!finalized) {
        this.state = {
          ...this.state,
          lastActionMessage: "Nothing ready to fire yet. Queue a slot or stance first.",
        };
        return this.buildSnapshot();
      }

      const result = await this.dependencies.pasteEngine.execute({
        text: finalized.text,
        executionMode,
        restoreClipboard: executionMode === "paste-now" && this.state.settings.restoreClipboardAfterPaste,
      });

      this.state = {
        ...this.state,
        comboState: nextState,
        finalizedPreview: finalized.text,
        lastActionMessage: result.message,
      };

      return this.buildSnapshot();
    });
  }

  async directPasteSlot(slotRef: SlotReference) {
    return this.serialize(async () => {
      await this.refreshActiveWindowInternal();
      const resolvedProfile = this.resolveCurrentProfile();
      const clipboard = await this.dependencies.clipboardGateway.readText().catch(() => "");
      const slot = this.resolveEffectiveSlot(resolvedProfile, slotRef);

      if (!slot?.enabled || !slot.content.trim()) {
        this.state = {
          ...this.state,
          lastActionMessage: `Slot ${slotRef.bankId}${slotRef.slotIndex + 1} is empty.`,
        };
        return this.buildSnapshot();
      }

      const { finalized, nextState } = finalizeCombo(
        {
          queuedEntries: [{ type: "slot", slotRef }],
          activeStances: this.state.comboState.activeStances,
          lastFinalized: this.state.comboState.lastFinalized,
        },
        {
          bankA: resolvedProfile.effectiveBankA.slots,
          bankB: resolvedProfile.effectiveBankB.slots,
          supers: resolvedProfile.effectiveSupers,
          assembly: resolvedProfile.effectiveAssembly,
        },
        this.state.settings,
        {
          clipboard,
          profile: resolvedProfile.profile.name,
          active_app: this.state.activeWindow.processName || "unknown",
          date: new Date().toISOString().slice(0, 10),
        },
      );

      if (!finalized) {
        this.state = {
          ...this.state,
          lastActionMessage: `Slot ${slotRef.bankId}${slotRef.slotIndex + 1} did not produce any text.`,
        };
        return this.buildSnapshot();
      }

      const result = await this.dependencies.pasteEngine.execute({
        text: finalized.text,
        executionMode: "paste-now",
        restoreClipboard: this.state.settings.restoreClipboardAfterPaste,
      });

      this.state = {
        ...this.state,
        comboState: {
          ...this.state.comboState,
          lastFinalized: nextState.lastFinalized,
        },
        finalizedPreview: finalized.text,
        lastActionMessage: result.message,
      };

      return this.buildSnapshot();
    });
  }

  async saveClipboardToSlot(slotRef: SlotReference) {
    return this.serialize(async () => {
      await this.refreshActiveWindowInternal();
      const resolvedProfile = this.resolveCurrentProfile();
      const clipboard = await this.dependencies.clipboardGateway.readText();
      if (!clipboard.trim()) {
        this.state = {
          ...this.state,
          lastActionMessage: `Clipboard was empty. ${slotRef.bankId}${slotRef.slotIndex + 1} was left unchanged.`,
        };
        return this.buildSnapshot();
      }
      const targetProfileId =
        slotRef.bankId === "B"
          ? this.state.profiles.find((profile) => profile.kind === "global")?.id ?? resolvedProfile.profile.id
          : resolvedProfile.profile.id;
      const targetProfileName =
        this.state.profiles.find((profile) => profile.id === targetProfileId)?.name ?? resolvedProfile.profile.name;
      const nextProfiles = updateProfileSlot(this.state.profiles, targetProfileId, slotRef, clipboard);

      await this.dependencies.persistDocuments(this.state.settings, nextProfiles);

      this.state = {
        ...this.state,
        profiles: nextProfiles,
        lastActionMessage: `Saved ${targetProfileName} ${slotRef.bankId}${slotRef.slotIndex + 1}.`,
      };

      return this.buildSnapshot();
    });
  }

  private resolveEffectiveSlot(resolvedProfile: ResolvedProfile, slotRef: SlotReference) {
    return findSlot(slotRef.bankId === "A" ? resolvedProfile.effectiveBankA.slots : resolvedProfile.effectiveBankB.slots, slotRef);
  }

  private resolveCurrentProfile() {
    return resolveProfile(this.state.profiles, this.state.settings, this.state.activeWindow);
  }

  private async refreshActiveWindowInternal() {
    this.state = {
      ...this.state,
      activeWindow: await this.dependencies.activeWindowProvider.getSnapshot(),
    };
  }

  private buildSnapshot(): SuperPasteEngineSnapshot {
    return {
      settings: this.state.settings,
      profiles: this.state.profiles,
      comboState: this.state.comboState,
      activeWindow: this.state.activeWindow,
      resolvedProfile: this.resolveCurrentProfile(),
      finalizedPreview: this.state.finalizedPreview,
      lastActionMessage: this.state.lastActionMessage,
    };
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
