import { ChangeEvent, useEffect, useState } from "react";
import {
  AppSettings,
  ComboBufferState,
  Profile,
  RecipeEntry,
  SlotDefinition,
  getSlotHotkeyDigit,
} from "../domain/models";
import { parseRecipeSteps, serializeRecipeSteps } from "../domain/recipes";
import {
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Upload,
  Download,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Zap,
} from "lucide-react";

type SlotSelection = {
  bankId: "A" | "B";
  slotIndex: number;
};

type RecipeDraft = {
  id: string | null;
  name: string;
  description: string;
  assemblyJoiner: string;
  hotkeyHint: string;
  stepText: string;
};

type EditorShellProps = {
  settings: AppSettings;
  profiles: Profile[];
  resolvedProfileId: string;
  editorProfileId: string;
  slotSelection: SlotSelection;
  comboState: ComboBufferState;
  importExportText: string;
  onEditorProfileChange: (profileId: string) => void;
  onSelectSlot: (selection: SlotSelection) => void;
  onSaveProfile: (profile: Profile) => Promise<void>;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onSaveRecipe: (
    profileId: string,
    recipeId: string | null,
    patch: {
      name: string;
      description: string;
      steps: RecipeEntry[];
      assemblyJoiner: string;
      hotkeyHint: string;
    },
  ) => Promise<void>;
  onDeleteRecipe: (profileId: string, recipeId: string) => Promise<void>;
  onExportPack: () => Promise<void>;
  onImportFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onImportTextChange: (value: string) => void;
  onApplyImportText: () => Promise<void>;
};

const NEW_RECIPE_ID = "__new_recipe__";

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  badge,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[var(--color-border-subtle)] last:border-b-0">
      <button
        className="collapse-header w-full text-left"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown size={12} className="text-[var(--color-text-muted)]" />
          ) : (
            <ChevronRight size={12} className="text-[var(--color-text-muted)]" />
          )}
          <span className="section-title text-sm">{title}</span>
        </div>
        {badge}
      </button>
      {isOpen && <div className="pb-3">{children}</div>}
    </div>
  );
}

function createRule() {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    kind: "workspacePathContains" as const,
    value: "",
    caseSensitive: false,
    weightBoost: 0,
  };
}

function createEmptyRecipeDraft(): RecipeDraft {
  return {
    id: null,
    name: "New super",
    description: "",
    assemblyJoiner: "\n\n",
    hotkeyHint: "",
    stepText: "",
  };
}

function createRecipeDraftFromProfile(profile: Profile, recipeId: string) {
  const recipe = profile.supers.find((entry) => entry.id === recipeId);
  if (!recipe) {
    return createEmptyRecipeDraft();
  }

  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    assemblyJoiner: recipe.assembly?.joiner ?? profile.assembly?.joiner ?? "\n\n",
    hotkeyHint: recipe.hotkeyHint ?? "",
    stepText: serializeRecipeSteps(recipe.steps),
  };
}

function recipeEntriesFromCombo(comboState: ComboBufferState) {
  const explicitEntries = comboState.queuedEntries.flatMap<RecipeEntry>((entry) => {
    if (entry.type === "slot" && entry.slotRef) {
      return [{ type: "slot", slotRef: entry.slotRef }];
    }
    if (entry.type === "super" && entry.superId) {
      return [{ type: "super", superId: entry.superId }];
    }
    return [];
  });

  const stanceEntries = comboState.activeStances.map<RecipeEntry>((slotRef) => ({
    type: "slot",
    slotRef,
  }));

  return [...explicitEntries, ...stanceEntries];
}

function updateSelectedSlot(
  profile: Profile,
  selection: SlotSelection,
  patch: Partial<SlotDefinition>,
) {
  const bankKey = selection.bankId === "A" ? "bankA" : "bankB";
  const bank = profile[bankKey];

  return {
    ...profile,
    [bankKey]: {
      ...bank,
      slots: bank.slots.map((slot) =>
        slot.slotIndex === selection.slotIndex ? { ...slot, ...patch } : slot,
      ),
    },
  };
}

export function EditorShell({
  settings,
  profiles,
  resolvedProfileId,
  editorProfileId,
  slotSelection,
  comboState,
  importExportText,
  onApplyImportText,
  onEditorProfileChange,
  onExportPack,
  onImportFile,
  onImportTextChange,
  onSaveProfile,
  onSaveRecipe,
  onDeleteRecipe,
  onSaveSettings,
  onSelectSlot,
}: EditorShellProps) {
  const profile = profiles.find((entry) => entry.id === editorProfileId) ?? profiles[0];
  const [profileDraft, setProfileDraft] = useState<Profile>(profile);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(settings);
  const [profileDirty, setProfileDirty] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [recipeSelectionId, setRecipeSelectionId] = useState<string>(
    profile.supers[0]?.id ?? NEW_RECIPE_ID,
  );
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft>(
    profile.supers[0]
      ? createRecipeDraftFromProfile(profile, profile.supers[0].id)
      : createEmptyRecipeDraft(),
  );
  const [recipeError, setRecipeError] = useState("");

  useEffect(() => {
    setProfileDraft(profile);
    setProfileDirty(false);
    const nextRecipeId = profile.supers[0]?.id ?? NEW_RECIPE_ID;
    setRecipeSelectionId(nextRecipeId);
    setRecipeDraft(
      nextRecipeId === NEW_RECIPE_ID
        ? createEmptyRecipeDraft()
        : createRecipeDraftFromProfile(profile, nextRecipeId),
    );
    setRecipeError("");
  }, [profile]);

  useEffect(() => {
    setSettingsDraft(settings);
    setSettingsDirty(false);
  }, [settings]);

  useEffect(() => {
    setRecipeDraft(
      recipeSelectionId === NEW_RECIPE_ID
        ? createEmptyRecipeDraft()
        : createRecipeDraftFromProfile(profileDraft, recipeSelectionId),
    );
    setRecipeError("");
  }, [profileDraft, recipeSelectionId]);

  const bank = slotSelection.bankId === "A" ? profileDraft.bankA : profileDraft.bankB;
  const slot = bank.slots.find((entry) => entry.slotIndex === slotSelection.slotIndex)!;

  const pasteHotkeys =
    slotSelection.bankId === "A"
      ? settingsDraft.hotkeys.bankAPaste
      : settingsDraft.hotkeys.bankBPaste;
  const saveHotkeys =
    slotSelection.bankId === "A"
      ? settingsDraft.hotkeys.bankASaveClipboard
      : settingsDraft.hotkeys.bankBSaveClipboard;

  const isEditingActive = profileDraft.id === resolvedProfileId;

  async function handleSaveRecipe() {
    try {
      const steps = parseRecipeSteps(recipeDraft.stepText);
      await onSaveRecipe(profileDraft.id, recipeDraft.id, {
        name: recipeDraft.name,
        description: recipeDraft.description,
        steps,
        assemblyJoiner: recipeDraft.assemblyJoiner,
        hotkeyHint: recipeDraft.hotkeyHint,
      });
      setRecipeError("");
    } catch (error) {
      setRecipeError(error instanceof Error ? error.message : "Invalid steps");
    }
  }

  async function handleSaveAll() {
    if (profileDirty) await onSaveProfile(profileDraft);
    if (settingsDirty) await onSaveSettings(settingsDraft);
  }

  const hasPendingChanges = profileDirty || settingsDirty;

  return (
    <aside className="editor-column scrollbar-thin">
      {/* ============================================
          PROFILE HEADER
          ============================================ */}
      <article className="card">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex-1">
            <select
              className="w-full"
              onChange={(event) => onEditorProfileChange(event.target.value)}
              value={profileDraft.id}
            >
              {profiles.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>
          <span
            className={`badge text-[0.6rem] ${isEditingActive ? "badge-success" : ""}`}
          >
            {isEditingActive ? "Active" : "Inactive"}
          </span>
        </div>

        {hasPendingChanges && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-[var(--color-warning-dim)] border border-[var(--color-warning-border)]">
            <span className="text-xs text-[var(--color-warning)]">Unsaved changes</span>
            <div className="flex-1" />
            <button
              className="btn btn-xs btn-warning"
              onClick={() => void handleSaveAll()}
              type="button"
            >
              <Save size={11} />
              Save all
            </button>
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => {
                setProfileDraft(profile);
                setSettingsDraft(settings);
                setProfileDirty(false);
                setSettingsDirty(false);
              }}
              type="button"
            >
              <RotateCcw size={11} />
            </button>
          </div>
        )}

        {/* ============================================
            SLOT EDITOR
            ============================================ */}
        <CollapsibleSection title="Slot Editor">
          <div className="grid grid-cols-2 gap-2">
            <label className="field-block">
              <span className="field-caption">Bank</span>
              <select
                onChange={(event) =>
                  onSelectSlot({
                    bankId: event.target.value as "A" | "B",
                    slotIndex: slotSelection.slotIndex,
                  })
                }
                value={slotSelection.bankId}
              >
                <option value="A">Bank A</option>
                <option value="B">Bank B</option>
              </select>
            </label>

            <label className="field-block">
              <span className="field-caption">Slot</span>
              <select
                onChange={(event) =>
                  onSelectSlot({
                    bankId: slotSelection.bankId,
                    slotIndex: Number(event.target.value),
                  })
                }
                value={slotSelection.slotIndex}
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i} value={i}>
                    {slotSelection.bankId}
                    {getSlotHotkeyDigit(i)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-block col-span-2">
              <span className="field-caption">Label</span>
              <input
                onChange={(event) => {
                  setProfileDraft(
                    updateSelectedSlot(profileDraft, slotSelection, {
                      label: event.target.value,
                    }),
                  );
                  setProfileDirty(true);
                }}
                value={slot.label}
                placeholder="Slot name"
              />
            </label>

            <label className="field-block col-span-2">
              <span className="field-caption">Content</span>
              <textarea
                onChange={(event) => {
                  setProfileDraft(
                    updateSelectedSlot(profileDraft, slotSelection, {
                      content: event.target.value,
                    }),
                  );
                  setProfileDirty(true);
                }}
                value={slot.content}
                className="font-mono text-xs"
                rows={5}
              />
            </label>

            <label className="field-block">
              <span className="field-caption">Template</span>
              <select
                onChange={(event) => {
                  setProfileDraft(
                    updateSelectedSlot(profileDraft, slotSelection, {
                      templateMode: event.target.value as SlotDefinition["templateMode"],
                    }),
                  );
                  setProfileDirty(true);
                }}
                value={slot.templateMode}
              >
                <option value="plain">Plain</option>
                <option value="template">Variables</option>
              </select>
            </label>

            <label className="field-block">
              <span className="field-caption">Assembly</span>
              <select
                onChange={(event) => {
                  setProfileDraft(
                    updateSelectedSlot(profileDraft, slotSelection, {
                      assemblyMode: event.target.value as SlotDefinition["assemblyMode"],
                    }),
                  );
                  setProfileDirty(true);
                }}
                value={slot.assemblyMode}
              >
                <option value="append">Append</option>
                <option value="prepend">Prepend</option>
                <option value="wrap">Wrap</option>
              </select>
            </label>

            <label className="field-block">
              <span className="field-caption">Enabled</span>
              <select
                onChange={(event) => {
                  setProfileDraft(
                    updateSelectedSlot(profileDraft, slotSelection, {
                      enabled: event.target.value === "true",
                    }),
                  );
                  setProfileDirty(true);
                }}
                value={String(slot.enabled)}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>

            {slotSelection.bankId === "B" && (
              <label className="field-block">
                <span className="field-caption">Inherit</span>
                <select
                  onChange={(event) => {
                    setProfileDraft(
                      updateSelectedSlot(profileDraft, slotSelection, {
                        inheritanceMode: event.target
                          .value as SlotDefinition["inheritanceMode"],
                      }),
                    );
                    setProfileDirty(true);
                  }}
                  value={slot.inheritanceMode}
                >
                  <option value="inherit">Global</option>
                  <option value="override">Override</option>
                </select>
              </label>
            )}
          </div>
        </CollapsibleSection>

        {/* ============================================
            PROFILE SETTINGS
            ============================================ */}
        <CollapsibleSection title="Profile Settings" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <label className="field-block col-span-2">
              <span className="field-caption">Name</span>
              <input
                onChange={(event) => {
                  setProfileDraft({ ...profileDraft, name: event.target.value });
                  setProfileDirty(true);
                }}
                value={profileDraft.name}
              />
            </label>

            <label className="field-block">
              <span className="field-caption">Scope</span>
              <select
                onChange={(event) => {
                  setProfileDraft({
                    ...profileDraft,
                    kind: event.target.value as Profile["kind"],
                  });
                  setProfileDirty(true);
                }}
                value={profileDraft.kind}
              >
                <option value="global">Global</option>
                <option value="workspace">Workspace</option>
              </select>
            </label>

            <label className="field-block">
              <span className="field-caption">Priority</span>
              <input
                onChange={(event) => {
                  setProfileDraft({
                    ...profileDraft,
                    priority: Number(event.target.value) || 0,
                  });
                  setProfileDirty(true);
                }}
                type="number"
                value={profileDraft.priority}
              />
            </label>

            <label className="field-block">
              <span className="field-caption">Parent</span>
              <select
                onChange={(event) => {
                  setProfileDraft({
                    ...profileDraft,
                    extendsProfileId: event.target.value || null,
                  });
                  setProfileDirty(true);
                }}
                value={profileDraft.extendsProfileId ?? ""}
              >
                <option value="">None</option>
                {profiles
                  .filter((entry) => entry.id !== profileDraft.id)
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="field-block">
              <span className="field-caption">Joiner</span>
              <input
                onChange={(event) => {
                  setProfileDraft({
                    ...profileDraft,
                    assembly: { style: "markdown", joiner: event.target.value },
                  });
                  setProfileDirty(true);
                }}
                value={profileDraft.assembly?.joiner ?? "\n\n"}
                placeholder="\n\n"
              />
            </label>
          </div>
        </CollapsibleSection>

        {/* ============================================
            MATCH RULES
            ============================================ */}
        <CollapsibleSection
          title="Match Rules"
          defaultOpen={false}
          badge={
            profileDraft.matchRules.length > 0 && (
              <span className="badge text-[0.55rem]">
                {profileDraft.matchRules.length}
              </span>
            )
          }
        >
          <div className="flex flex-col gap-2">
            {profileDraft.matchRules.map((rule, index) => (
              <div key={rule.id} className="grid grid-cols-[1fr_1.5fr_auto] gap-1.5 items-center">
                <select
                  className="text-xs"
                  onChange={(event) => {
                    const nextRules = [...profileDraft.matchRules];
                    nextRules[index] = {
                      ...nextRules[index],
                      kind: event.target.value as Profile["matchRules"][number]["kind"],
                    };
                    setProfileDraft({ ...profileDraft, matchRules: nextRules });
                    setProfileDirty(true);
                  }}
                  value={rule.kind}
                >
                  <option value="workspacePathEquals">Path =</option>
                  <option value="workspacePathContains">Path ~</option>
                  <option value="processName">Process</option>
                  <option value="processPathContains">Proc path</option>
                  <option value="windowTitleContains">Title ~</option>
                </select>

                <input
                  className="text-xs"
                  onChange={(event) => {
                    const nextRules = [...profileDraft.matchRules];
                    nextRules[index] = { ...nextRules[index], value: event.target.value };
                    setProfileDraft({ ...profileDraft, matchRules: nextRules });
                    setProfileDirty(true);
                  }}
                  value={rule.value}
                  placeholder="Match value"
                />

                <button
                  className="btn btn-xs btn-ghost btn-icon"
                  onClick={() => {
                    setProfileDraft({
                      ...profileDraft,
                      matchRules: profileDraft.matchRules.filter((_, i) => i !== index),
                    });
                    setProfileDirty(true);
                  }}
                  type="button"
                  title="Remove"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}

            <button
              className="btn btn-xs btn-ghost"
              onClick={() => {
                setProfileDraft({
                  ...profileDraft,
                  matchRules: [...profileDraft.matchRules, createRule()],
                });
                setProfileDirty(true);
              }}
              type="button"
            >
              <Plus size={11} />
              Add rule
            </button>
          </div>
        </CollapsibleSection>
      </article>

      {/* ============================================
          SUPERS / RECIPES
          ============================================ */}
      <article className="card">
        <div className="surface-header">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-[var(--color-accent-a)]" />
            <span className="section-title">Supers</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <label className="field-block">
            <span className="field-caption">Recipe</span>
            <select
              onChange={(event) => setRecipeSelectionId(event.target.value)}
              value={recipeSelectionId}
            >
              <option value={NEW_RECIPE_ID}>+ New</option>
              {profileDraft.supers.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span className="field-caption">Name</span>
            <input
              onChange={(event) =>
                setRecipeDraft({ ...recipeDraft, name: event.target.value })
              }
              value={recipeDraft.name}
            />
          </label>

          <label className="field-block col-span-2">
            <span className="field-caption">
              Steps <span className="opacity-50">(A1 &gt; B2 &gt; super:name)</span>
            </span>
            <textarea
              onChange={(event) =>
                setRecipeDraft({ ...recipeDraft, stepText: event.target.value })
              }
              value={recipeDraft.stepText}
              className="font-mono text-xs"
              rows={3}
              placeholder="A1 > A2 > B1"
            />
          </label>
        </div>

        {recipeError && (
          <p className="flex items-center gap-1.5 mb-2 text-xs text-[var(--color-warning)]">
            <AlertTriangle size={11} />
            {recipeError}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          <button
            className="btn btn-xs btn-ghost"
            onClick={() => {
              const captured = recipeEntriesFromCombo(comboState);
              setRecipeDraft({ ...recipeDraft, stepText: serializeRecipeSteps(captured) });
            }}
            type="button"
          >
            <Zap size={11} />
            Capture
          </button>
          <button
            className="btn btn-xs btn-accent-a"
            onClick={() => void handleSaveRecipe()}
            type="button"
          >
            <Save size={11} />
            Save
          </button>
          {recipeDraft.id && (
            <button
              className="btn btn-xs btn-danger"
              onClick={() => void onDeleteRecipe(profileDraft.id, recipeDraft.id!)}
              type="button"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </article>

      {/* ============================================
          HOTKEYS
          ============================================ */}
      <article className="card">
        <CollapsibleSection title="Hotkeys" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <label className="field-block">
              <span className="field-caption">Paste hotkey</span>
              <input
                className="text-xs font-mono"
                onChange={(event) => {
                  const nextBindings = [...pasteHotkeys];
                  nextBindings[slotSelection.slotIndex] = event.target.value;
                  setSettingsDraft({
                    ...settingsDraft,
                    hotkeys: {
                      ...settingsDraft.hotkeys,
                      ...(slotSelection.bankId === "A"
                        ? { bankAPaste: nextBindings }
                        : { bankBPaste: nextBindings }),
                    },
                  });
                  setSettingsDirty(true);
                }}
                value={pasteHotkeys[slotSelection.slotIndex]}
              />
            </label>

            <label className="field-block">
              <span className="field-caption">Save hotkey</span>
              <input
                className="text-xs font-mono"
                onChange={(event) => {
                  const nextBindings = [...saveHotkeys];
                  nextBindings[slotSelection.slotIndex] = event.target.value;
                  setSettingsDraft({
                    ...settingsDraft,
                    hotkeys: {
                      ...settingsDraft.hotkeys,
                      ...(slotSelection.bankId === "A"
                        ? { bankASaveClipboard: nextBindings }
                        : { bankBSaveClipboard: nextBindings }),
                    },
                  });
                  setSettingsDirty(true);
                }}
                value={saveHotkeys[slotSelection.slotIndex]}
              />
            </label>

            <label className="field-block">
              <span className="field-caption">Finalize</span>
              <input
                className="text-xs font-mono"
                onChange={(event) => {
                  setSettingsDraft({
                    ...settingsDraft,
                    hotkeys: { ...settingsDraft.hotkeys, finalizeCombo: event.target.value },
                  });
                  setSettingsDirty(true);
                }}
                value={settingsDraft.hotkeys.finalizeCombo}
              />
            </label>

            <label className="field-block">
              <span className="field-caption">Cancel</span>
              <input
                className="text-xs font-mono"
                onChange={(event) => {
                  setSettingsDraft({
                    ...settingsDraft,
                    hotkeys: { ...settingsDraft.hotkeys, cancelCombo: event.target.value },
                  });
                  setSettingsDirty(true);
                }}
                value={settingsDraft.hotkeys.cancelCombo}
              />
            </label>

            <label className="field-block">
              <span className="field-caption">Replay</span>
              <input
                className="text-xs font-mono"
                onChange={(event) => {
                  setSettingsDraft({
                    ...settingsDraft,
                    hotkeys: { ...settingsDraft.hotkeys, replayLastCombo: event.target.value },
                  });
                  setSettingsDirty(true);
                }}
                value={settingsDraft.hotkeys.replayLastCombo}
              />
            </label>

            <label className="field-block">
              <span className="field-caption">Dock</span>
              <input
                className="text-xs font-mono"
                onChange={(event) => {
                  setSettingsDraft({
                    ...settingsDraft,
                    hotkeys: { ...settingsDraft.hotkeys, toggleWindow: event.target.value },
                  });
                  setSettingsDirty(true);
                }}
                value={settingsDraft.hotkeys.toggleWindow}
              />
            </label>

            <label className="field-block">
              <span className="field-caption">Panic</span>
              <input
                className="text-xs font-mono"
                onChange={(event) => {
                  setSettingsDraft({
                    ...settingsDraft,
                    hotkeys: { ...settingsDraft.hotkeys, panicToggle: event.target.value },
                  });
                  setSettingsDirty(true);
                }}
                value={settingsDraft.hotkeys.panicToggle}
              />
            </label>

            <label className="field-block">
              <span className="field-caption">Clipboard restore</span>
              <select
                onChange={(event) => {
                  setSettingsDraft({
                    ...settingsDraft,
                    restoreClipboardAfterPaste: event.target.value === "true",
                  });
                  setSettingsDirty(true);
                }}
                value={String(settingsDraft.restoreClipboardAfterPaste)}
              >
                <option value="true">Restore</option>
                <option value="false">Keep</option>
              </select>
            </label>

            <label className="field-block">
              <span className="field-caption">Captured clips</span>
              <select
                onChange={(event) => {
                  setSettingsDraft({
                    ...settingsDraft,
                    experimental: {
                      ...settingsDraft.experimental,
                      autoQueueCaptures: event.target.value === "true",
                    },
                  });
                  setSettingsDirty(true);
                }}
                value={String(settingsDraft.experimental.autoQueueCaptures)}
              >
                <option value="true">Queue</option>
                <option value="false">Save only</option>
              </select>
            </label>
          </div>
        </CollapsibleSection>
      </article>

      {/* ============================================
          IMPORT / EXPORT
          ============================================ */}
      <article className="card">
        <CollapsibleSection title="Import / Export" defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => void onExportPack()}
              type="button"
            >
              <Download size={11} />
              Export
            </button>

            <label className="btn btn-xs btn-ghost cursor-pointer">
              <Upload size={11} />
              Import
              <input hidden onChange={(event) => void onImportFile(event)} type="file" />
            </label>

            <button
              className="btn btn-xs btn-ghost"
              onClick={() => void onApplyImportText()}
              type="button"
            >
              Apply JSON
            </button>
          </div>

          <textarea
            className="font-mono text-xs"
            onChange={(event) => onImportTextChange(event.target.value)}
            value={importExportText}
            rows={4}
            placeholder="Paste pack JSON here..."
          />
        </CollapsibleSection>
      </article>
    </aside>
  );
}
