import { ChangeEvent, useEffect, useMemo, useState } from "react";
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
  FileJson,
  Sliders,
  BookOpen,
  Puzzle,
  Wrench,
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
    name: "New combo super",
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
        slot.slotIndex === selection.slotIndex
          ? {
              ...slot,
              ...patch,
            }
          : slot,
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
  const [recipeSelectionId, setRecipeSelectionId] = useState<string>(profile.supers[0]?.id ?? NEW_RECIPE_ID);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft>(
    profile.supers[0] ? createRecipeDraftFromProfile(profile, profile.supers[0].id) : createEmptyRecipeDraft(),
  );
  const [recipeError, setRecipeError] = useState("");

  useEffect(() => {
    setProfileDraft(profile);
    setProfileDirty(false);
    const nextRecipeId = profile.supers[0]?.id ?? NEW_RECIPE_ID;
    setRecipeSelectionId(nextRecipeId);
    setRecipeDraft(
      nextRecipeId === NEW_RECIPE_ID ? createEmptyRecipeDraft() : createRecipeDraftFromProfile(profile, nextRecipeId),
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
    slotSelection.bankId === "A" ? settingsDraft.hotkeys.bankAPaste : settingsDraft.hotkeys.bankBPaste;
  const saveHotkeys =
    slotSelection.bankId === "A"
      ? settingsDraft.hotkeys.bankASaveClipboard
      : settingsDraft.hotkeys.bankBSaveClipboard;

  const quickProfileLabel = useMemo(() => {
    if (profileDraft.id === resolvedProfileId) {
      return "Editing active profile";
    }

    return "Editing inactive profile";
  }, [profileDraft.id, resolvedProfileId]);

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
      setRecipeError(error instanceof Error ? error.message : "Could not parse recipe steps.");
    }
  }

  return (
    <aside className="editor-column animate-slide-up scrollbar-thin">
      <article className="card">
        <header className="surface-header">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-bg-surface)]">
              <Sliders size={14} className="text-[var(--color-text-muted)]" />
            </div>
            <div>
              <p className="section-label">Editor</p>
              <h2>Loadout editor</h2>
            </div>
          </div>
          <span className={`badge text-xs ${profileDraft.id === resolvedProfileId ? "badge-accent-a" : ""}`}>
            {quickProfileLabel}
          </span>
        </header>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <label className="field-block">
            <span className="field-caption">Profile</span>
            <select onChange={(event) => onEditorProfileChange(event.target.value)} value={profileDraft.id}>
              {profiles.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
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

          <label className="field-block col-span-2">
            <span className="field-caption">Profile name</span>
            <input
              onChange={(event) => {
                setProfileDraft({
                  ...profileDraft,
                  name: event.target.value,
                });
                setProfileDirty(true);
              }}
              value={profileDraft.name}
            />
          </label>

          <label className="field-block col-span-2">
            <span className="field-caption">Profile description</span>
            <input
              onChange={(event) => {
                setProfileDraft({
                  ...profileDraft,
                  description: event.target.value,
                });
                setProfileDirty(true);
              }}
              value={profileDraft.description}
            />
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
            <span className="field-caption">Default joiner</span>
            <input
              onChange={(event) => {
                setProfileDraft({
                  ...profileDraft,
                  assembly: {
                    style: "markdown",
                    joiner: event.target.value,
                  },
                });
                setProfileDirty(true);
              }}
              value={profileDraft.assembly?.joiner ?? "\n\n"}
            />
          </label>

          <label className="field-block">
            <span className="field-caption">Parent profile</span>
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
              <option value="">No parent</option>
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
              {Array.from({ length: 10 }, (_, slotIndex) => (
                <option key={slotIndex} value={slotIndex}>
                  {slotSelection.bankId}
                  {getSlotHotkeyDigit(slotIndex)}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span className="field-caption">Enabled</span>
            <select
              onChange={(event) => {
                setProfileDraft(updateSelectedSlot(profileDraft, slotSelection, { enabled: event.target.value === "true" }));
                setProfileDirty(true);
              }}
              value={String(slot.enabled)}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>

          <label className="field-block col-span-2">
            <span className="field-caption">Slot label</span>
            <input
              onChange={(event) => {
                setProfileDraft(updateSelectedSlot(profileDraft, slotSelection, { label: event.target.value }));
                setProfileDirty(true);
              }}
              value={slot.label}
            />
          </label>

          <label className="field-block col-span-2">
            <span className="field-caption">Slot description</span>
            <input
              onChange={(event) => {
                setProfileDraft(updateSelectedSlot(profileDraft, slotSelection, { description: event.target.value }));
                setProfileDirty(true);
              }}
              value={slot.description}
            />
          </label>

          <label className="field-block col-span-2">
            <span className="field-caption">Slot content</span>
            <textarea
              onChange={(event) => {
                setProfileDraft(updateSelectedSlot(profileDraft, slotSelection, { content: event.target.value }));
                setProfileDirty(true);
              }}
              value={slot.content}
              className="font-mono text-sm"
            />
          </label>

          <label className="field-block">
            <span className="field-caption">Template mode</span>
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
              <option value="plain">Plain text</option>
              <option value="template">Template variables</option>
            </select>
          </label>

          <label className="field-block">
            <span className="field-caption">Assembly role</span>
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
            <span className="field-caption">Paste hotkey</span>
            <input
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
            <span className="field-caption">Save clipboard hotkey</span>
            <input
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

          {slotSelection.bankId === "B" ? (
            <label className="field-block">
              <span className="field-caption">Inheritance</span>
              <select
                onChange={(event) => {
                  setProfileDraft(
                    updateSelectedSlot(profileDraft, slotSelection, {
                      inheritanceMode: event.target.value as SlotDefinition["inheritanceMode"],
                    }),
                  );
                  setProfileDirty(true);
                }}
                value={slot.inheritanceMode}
              >
                <option value="inherit">Inherit global Bank B</option>
                <option value="override">Override locally</option>
              </select>
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-accent-a btn-sm" disabled={!profileDirty} onClick={() => void onSaveProfile(profileDraft)} type="button">
            <Save size={13} />
            Save profile
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={!profileDirty}
            onClick={() => {
              setProfileDraft(profile);
              setProfileDirty(false);
            }}
            type="button"
          >
            <RotateCcw size={13} />
            Revert
          </button>
        </div>
      </article>

      <article className="card">
        <header className="surface-header">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-bg-surface)]">
              <BookOpen size={14} className="text-[var(--color-text-muted)]" />
            </div>
            <div>
              <p className="section-label">Matching rules</p>
              <h2>Profile auto-switch logic</h2>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-2 mt-3">
          {profileDraft.matchRules.map((rule, index) => (
            <div className="grid grid-cols-[1.2fr_1.8fr_100px_auto_auto] gap-2 items-center" key={rule.id}>
              <select
                aria-label={`Rule ${index + 1} kind`}
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
                <option value="workspacePathEquals">Workspace path equals</option>
                <option value="workspacePathContains">Workspace path contains</option>
                <option value="processName">Process name</option>
                <option value="processPathContains">Process path contains</option>
                <option value="windowTitleContains">Window title contains</option>
              </select>

              <input
                aria-label={`Rule ${index + 1} value`}
                onChange={(event) => {
                  const nextRules = [...profileDraft.matchRules];
                  nextRules[index] = {
                    ...nextRules[index],
                    value: event.target.value,
                  };
                  setProfileDraft({ ...profileDraft, matchRules: nextRules });
                  setProfileDirty(true);
                }}
                value={rule.value}
              />

              <input
                aria-label={`Rule ${index + 1} weight`}
                onChange={(event) => {
                  const nextRules = [...profileDraft.matchRules];
                  nextRules[index] = {
                    ...nextRules[index],
                    weightBoost: Number(event.target.value) || 0,
                  };
                  setProfileDraft({ ...profileDraft, matchRules: nextRules });
                  setProfileDirty(true);
                }}
                type="number"
                value={rule.weightBoost}
              />

              <label className="flex items-center gap-1.5 text-[var(--color-text-muted)] text-xs cursor-pointer">
                <input
                  checked={rule.caseSensitive}
                  onChange={(event) => {
                    const nextRules = [...profileDraft.matchRules];
                    nextRules[index] = {
                      ...nextRules[index],
                      caseSensitive: event.target.checked,
                    };
                    setProfileDraft({ ...profileDraft, matchRules: nextRules });
                    setProfileDirty(true);
                  }}
                  type="checkbox"
                  className="w-auto"
                />
                Case
              </label>

              <button
                className="btn btn-sm btn-ghost btn-icon text-[var(--color-text-muted)]"
                onClick={() => {
                  setProfileDraft({
                    ...profileDraft,
                    matchRules: profileDraft.matchRules.filter((_, ruleIndex) => ruleIndex !== index),
                  });
                  setProfileDirty(true);
                }}
                type="button"
                title="Remove rule"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <button
            className="btn btn-sm"
            onClick={() => {
              setProfileDraft({
                ...profileDraft,
                matchRules: [...profileDraft.matchRules, createRule()],
              });
              setProfileDirty(true);
            }}
            type="button"
          >
            <Plus size={13} />
            Add rule
          </button>
          <button className="btn btn-accent-a btn-sm" disabled={!profileDirty} onClick={() => void onSaveProfile(profileDraft)} type="button">
            <Save size={13} />
            Save rules
          </button>
        </div>
      </article>

      <article className="card">
        <header className="surface-header">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-accent-a-dim)]">
              <Puzzle size={14} className="text-[var(--color-accent-a)]" />
            </div>
            <div>
              <p className="section-label !text-[var(--color-accent-a)]">Recipes</p>
              <h2>Supers / saved combos</h2>
            </div>
          </div>
          <span className="badge badge-accent-a text-xs">
            Capture current combo into a reusable move
          </span>
        </header>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <label className="field-block">
            <span className="field-caption">Recipe</span>
            <select onChange={(event) => setRecipeSelectionId(event.target.value)} value={recipeSelectionId}>
              <option value={NEW_RECIPE_ID}>New recipe</option>
              {profileDraft.supers.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span className="field-caption">Hotkey hint</span>
            <input
              onChange={(event) => setRecipeDraft({ ...recipeDraft, hotkeyHint: event.target.value })}
              placeholder="Optional metadata"
              value={recipeDraft.hotkeyHint}
            />
          </label>

          <label className="field-block col-span-2">
            <span className="field-caption">Recipe name</span>
            <input
              onChange={(event) => setRecipeDraft({ ...recipeDraft, name: event.target.value })}
              value={recipeDraft.name}
            />
          </label>

          <label className="field-block col-span-2">
            <span className="field-caption">Recipe description</span>
            <input
              onChange={(event) => setRecipeDraft({ ...recipeDraft, description: event.target.value })}
              value={recipeDraft.description}
            />
          </label>

          <label className="field-block">
            <span className="field-caption">Recipe joiner</span>
            <input
              onChange={(event) => setRecipeDraft({ ...recipeDraft, assemblyJoiner: event.target.value })}
              value={recipeDraft.assemblyJoiner}
            />
          </label>

          <label className="field-block col-span-2">
            <span className="field-caption">Steps</span>
            <textarea
              onChange={(event) => setRecipeDraft({ ...recipeDraft, stepText: event.target.value })}
              placeholder="A2 > B4 > super:checkout-bughunt-super"
              value={recipeDraft.stepText}
              className="font-mono text-sm"
              style={{ minHeight: "6rem" }}
            />
          </label>
        </div>

        {recipeError ? (
          <p className="flex items-center gap-1.5 mt-2 text-sm text-[var(--color-warning)]">
            <AlertTriangle size={13} />
            {recipeError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 mt-3">
          <button
            className="btn btn-sm"
            onClick={() => {
              const captured = recipeEntriesFromCombo(comboState);
              setRecipeDraft({
                ...recipeDraft,
                stepText: serializeRecipeSteps(captured),
              });
            }}
            type="button"
          >
            <Zap size={13} />
            Capture combo
          </button>
          <button className="btn btn-accent-a btn-sm" onClick={() => void handleSaveRecipe()} type="button">
            <Save size={13} />
            Save recipe
          </button>
          {recipeDraft.id ? (
            <button className="btn btn-danger btn-sm" onClick={() => void onDeleteRecipe(profileDraft.id, recipeDraft.id!)} type="button">
              <Trash2 size={13} />
              Delete
            </button>
          ) : null}
        </div>
      </article>

      <article className="card">
        <header className="surface-header">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-bg-surface)]">
              <Wrench size={14} className="text-[var(--color-text-muted)]" />
            </div>
            <div>
              <p className="section-label">Runtime</p>
              <h2>Runtime + hotkeys</h2>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 mt-3 settings-grid">
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
              <option value="true">Restore clipboard</option>
              <option value="false">Leave assembled text</option>
            </select>
          </label>

          <label className="field-block">
            <span className="field-caption">Hotkey state</span>
            <select
              onChange={(event) => {
                setSettingsDraft({
                  ...settingsDraft,
                  panicModeEnabled: event.target.value === "true",
                });
                setSettingsDirty(true);
              }}
              value={String(settingsDraft.panicModeEnabled)}
            >
              <option value="false">Live</option>
              <option value="true">Paused</option>
            </select>
          </label>

          <label className="field-block">
            <span className="field-caption">Finalize combo</span>
            <input
              onChange={(event) => {
                setSettingsDraft({
                  ...settingsDraft,
                  hotkeys: {
                    ...settingsDraft.hotkeys,
                    finalizeCombo: event.target.value,
                  },
                });
                setSettingsDirty(true);
              }}
              value={settingsDraft.hotkeys.finalizeCombo}
            />
          </label>

          <label className="field-block">
            <span className="field-caption">Cancel combo</span>
            <input
              onChange={(event) => {
                setSettingsDraft({
                  ...settingsDraft,
                  hotkeys: {
                    ...settingsDraft.hotkeys,
                    cancelCombo: event.target.value,
                  },
                });
                setSettingsDirty(true);
              }}
              value={settingsDraft.hotkeys.cancelCombo}
            />
          </label>

          <label className="field-block">
            <span className="field-caption">Replay last combo</span>
            <input
              onChange={(event) => {
                setSettingsDraft({
                  ...settingsDraft,
                  hotkeys: {
                    ...settingsDraft.hotkeys,
                    replayLastCombo: event.target.value,
                  },
                });
                setSettingsDirty(true);
              }}
              value={settingsDraft.hotkeys.replayLastCombo}
            />
          </label>

          <label className="field-block">
            <span className="field-caption">Toggle window</span>
            <input
              onChange={(event) => {
                setSettingsDraft({
                  ...settingsDraft,
                  hotkeys: {
                    ...settingsDraft.hotkeys,
                    toggleWindow: event.target.value,
                  },
                });
                setSettingsDirty(true);
              }}
              value={settingsDraft.hotkeys.toggleWindow}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-accent-a btn-sm" disabled={!settingsDirty} onClick={() => void onSaveSettings(settingsDraft)} type="button">
            <Save size={13} />
            Save runtime
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={!settingsDirty}
            onClick={() => {
              setSettingsDraft(settings);
              setSettingsDirty(false);
            }}
            type="button"
          >
            <RotateCcw size={13} />
            Revert
          </button>
        </div>
      </article>

      <article className="card">
        <header className="surface-header">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-bg-surface)]">
              <FileJson size={14} className="text-[var(--color-text-muted)]" />
            </div>
            <div>
              <p className="section-label">Portable packs</p>
              <h2>Import / export JSON</h2>
            </div>
          </div>
          <span className="badge text-xs">
            Portable packs keep local hotkeys and overrides intact
          </span>
        </header>

        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-sm" onClick={() => void onExportPack()} type="button">
            <Download size={13} />
            Export pack
          </button>

          <label className="btn btn-sm cursor-pointer">
            <Upload size={13} />
            Import file
            <input hidden onChange={(event) => void onImportFile(event)} type="file" />
          </label>

          <button className="btn btn-sm" onClick={() => void onApplyImportText()} type="button">
            <FileJson size={13} />
            Import pasted JSON
          </button>
        </div>

        <textarea
          className="mt-2 font-mono text-sm"
          onChange={(event) => onImportTextChange(event.target.value)}
          value={importExportText}
          style={{ minHeight: "6rem" }}
        />
      </article>
    </aside>
  );
}
