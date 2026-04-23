import { z } from "zod";

export const APP_SCHEMA_VERSION = 1;
export const SLOT_COUNT = 10;
export const SLOT_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

export const bankIdSchema = z.enum(["A", "B"]);
export const slotKindSchema = z.enum(["context", "workflow"]);
export const slotInheritanceModeSchema = z.enum(["inherit", "override"]);
export const templateModeSchema = z.enum(["plain", "template"]);
export const slotAssemblyModeSchema = z.enum(["append", "prepend", "wrap"]);
export const assemblyStyleSchema = z.enum(["plain", "markdown"]);
export const profileKindSchema = z.enum(["global", "workspace"]);
export const profileRuleKindSchema = z.enum([
  "workspacePathEquals",
  "workspacePathContains",
  "processName",
  "processPathContains",
  "windowTitleContains",
]);
export const comboEntryTypeSchema = z.enum(["slot", "super"]);
export const fireModeSchema = z.enum(["copy-only", "paste-now", "queue-only"]);
export const hotkeyStatusSchema = z.enum([
  "registered",
  "reserved",
  "duplicate",
  "invalid",
  "planned",
  "disabled-by-panic",
]);

export const slotReferenceSchema = z.object({
  bankId: bankIdSchema,
  slotIndex: z.number().int().min(0).max(SLOT_COUNT - 1),
});

export const slotDefinitionSchema = z.object({
  id: z.string().min(1),
  bankId: bankIdSchema,
  slotIndex: z.number().int().min(0).max(SLOT_COUNT - 1),
  kind: slotKindSchema,
  label: z.string().max(80).default(""),
  description: z.string().max(180).default(""),
  content: z.string().default(""),
  enabled: z.boolean().default(false),
  inheritanceMode: slotInheritanceModeSchema.default("override"),
  templateMode: templateModeSchema.default("plain"),
  assemblyMode: slotAssemblyModeSchema.default("append"),
  tags: z.array(z.string()).default([]),
});

export const assemblyConfigSchema = z.object({
  style: assemblyStyleSchema.default("markdown"),
  joiner: z.string().default("\n\n"),
});

export const slotBankSchema = z
  .object({
    bankId: bankIdSchema,
    name: z.string().min(1),
    slots: z.array(slotDefinitionSchema).length(SLOT_COUNT),
  })
  .superRefine((bank, ctx) => {
    const seen = new Set<number>();

    bank.slots.forEach((slot, index) => {
      if (slot.bankId !== bank.bankId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Slot ${slot.id} does not belong to bank ${bank.bankId}`,
          path: ["slots", index, "bankId"],
        });
      }

      if (seen.has(slot.slotIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate slot index ${slot.slotIndex} in bank ${bank.bankId}`,
          path: ["slots", index, "slotIndex"],
        });
      }

      seen.add(slot.slotIndex);
    });
  });

export const profileMatchRuleSchema = z.object({
  id: z.string().min(1),
  kind: profileRuleKindSchema,
  value: z.string().min(1),
  caseSensitive: z.boolean().default(false),
  weightBoost: z.number().int().default(0),
});

export const recipeEntrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("slot"),
    slotRef: slotReferenceSchema,
  }),
  z.object({
    type: z.literal("super"),
    superId: z.string().min(1),
  }),
]);

export const superRecipeSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object") {
      return raw;
    }

    const candidate = raw as Record<string, unknown>;
    if ("sequence" in candidate && !("steps" in candidate) && Array.isArray(candidate.sequence)) {
      return {
        ...candidate,
        steps: candidate.sequence.map((slotRef) => ({
          type: "slot",
          slotRef,
        })),
      };
    }

    return candidate;
  },
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().max(180).default(""),
    steps: z.array(recipeEntrySchema).min(1),
    applyStances: z.boolean().default(true),
    hotkeyHint: z.string().max(80).nullable().default(null),
    assembly: assemblyConfigSchema.nullable().default(null),
  }),
);

export const profileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: profileKindSchema,
  description: z.string().max(200).default(""),
  priority: z.number().int().default(0),
  extendsProfileId: z.string().nullable().default(null),
  matchRules: z.array(profileMatchRuleSchema).default([]),
  assembly: assemblyConfigSchema.nullable().default(null),
  bankA: slotBankSchema,
  bankB: slotBankSchema,
  supers: z.array(superRecipeSchema).default([]),
});

export const hotkeyMappingSchema = z.object({
  bankAPaste: z.array(z.string()).length(SLOT_COUNT),
  bankBPaste: z.array(z.string()).length(SLOT_COUNT),
  bankASaveClipboard: z.array(z.string()).length(SLOT_COUNT),
  bankBSaveClipboard: z.array(z.string()).length(SLOT_COUNT),
  finalizeCombo: z.string().min(1),
  cancelCombo: z.string().min(1),
  replayLastCombo: z.string().min(1),
  toggleWindow: z.string().min(1),
  panicToggle: z.string().min(1),
});

export const appSettingsSchema = z.object({
  schemaVersion: z.literal(APP_SCHEMA_VERSION),
  theme: z.literal("dark"),
  launchMode: z.enum(["dock"]),
  comboJoiner: z.string().default("\n\n"),
  restoreClipboardAfterPaste: z.boolean().default(true),
  panicModeEnabled: z.boolean().default(false),
  hotkeys: hotkeyMappingSchema,
  ui: z.object({
    compactDock: z.boolean().default(true),
    showComboHud: z.boolean().default(true),
    showTokenMeter: z.boolean().default(true),
    helpDismissed: z.boolean().default(false),
  }),
  experimental: z.object({
    chordMode: z.boolean().default(false),
    autoQueueCaptures: z.boolean().default(true),
  }),
  activeProfileIdOverride: z.string().nullable().default(null),
});

export const settingsDocumentSchema = z.object({
  version: z.literal(APP_SCHEMA_VERSION),
  savedAtIso: z.string(),
  settings: appSettingsSchema,
});

export const profilesDocumentSchema = z.object({
  version: z.literal(APP_SCHEMA_VERSION),
  savedAtIso: z.string(),
  profiles: z.array(profileSchema).min(1),
});

export const portableProfilePackSchema = z.object({
  format: z.literal("superpaste-content-pack"),
  version: z.literal(APP_SCHEMA_VERSION),
  exportedAtIso: z.string(),
  packName: z.string().max(120).default("SuperPaste profile pack"),
  profiles: z.array(profileSchema).min(1),
});

export const machineSnapshotPackSchema = z.object({
  format: z.literal("superpaste-machine-snapshot"),
  version: z.literal(APP_SCHEMA_VERSION),
  exportedAtIso: z.string(),
  settings: appSettingsSchema,
  profiles: z.array(profileSchema).min(1),
});

export const legacyImportExportPackSchema = z.object({
  format: z.literal("superpaste-pack"),
  version: z.literal(APP_SCHEMA_VERSION),
  exportedAtIso: z.string(),
  settings: appSettingsSchema,
  profiles: z.array(profileSchema).min(1),
});

export const importExportPackSchema = z.union([
  portableProfilePackSchema,
  machineSnapshotPackSchema,
  legacyImportExportPackSchema,
]);

export const comboBufferEntrySchema = z.object({
  type: comboEntryTypeSchema,
  slotRef: slotReferenceSchema.optional(),
  superId: z.string().optional(),
});

export const comboBufferStateSchema = z.object({
  queuedEntries: z.array(comboBufferEntrySchema).default([]),
  activeStances: z.array(slotReferenceSchema).default([]),
  lastFinalized: z
    .object({
      text: z.string(),
      charCount: z.number().int().nonnegative(),
      roughTokenCount: z.number().int().nonnegative(),
      sequence: z.array(slotReferenceSchema),
      createdAtIso: z.string(),
    })
    .nullable()
    .default(null),
});

export const activeWindowSnapshotSchema = z.object({
  title: z.string().default(""),
  processName: z.string().default(""),
  processPath: z.string().default(""),
  workspacePath: z.string().default(""),
});

export const hotkeyConflictSchema = z.object({
  binding: z.string(),
  reasons: z.array(hotkeyStatusSchema),
});

export type BankId = z.infer<typeof bankIdSchema>;
export type SlotInheritanceMode = z.infer<typeof slotInheritanceModeSchema>;
export type SlotAssemblyMode = z.infer<typeof slotAssemblyModeSchema>;
export type FireMode = z.infer<typeof fireModeSchema>;
export type SlotReference = z.infer<typeof slotReferenceSchema>;
export type SlotDefinition = z.infer<typeof slotDefinitionSchema>;
export type SlotBank = z.infer<typeof slotBankSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type SuperRecipe = z.infer<typeof superRecipeSchema>;
export type RecipeEntry = z.infer<typeof recipeEntrySchema>;
export type AssemblyConfig = z.infer<typeof assemblyConfigSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type SettingsDocument = z.infer<typeof settingsDocumentSchema>;
export type ProfilesDocument = z.infer<typeof profilesDocumentSchema>;
export type ImportExportPack = z.infer<typeof importExportPackSchema>;
export type ComboBufferState = z.infer<typeof comboBufferStateSchema>;
export type ActiveWindowSnapshot = z.infer<typeof activeWindowSnapshotSchema>;
export type HotkeyConflict = z.infer<typeof hotkeyConflictSchema>;

export function getSlotHotkeyDigit(slotIndex: number) {
  return SLOT_DIGITS[slotIndex] ?? "?";
}

export function getSlotKey(slot: SlotReference) {
  return `${slot.bankId}${slot.slotIndex}`;
}

export function createEmptySlot(
  bankId: BankId,
  slotIndex: number,
  inheritanceMode: SlotInheritanceMode,
): SlotDefinition {
  return {
    id: `${bankId}${slotIndex}`,
    bankId,
    slotIndex,
    kind: bankId === "A" ? "context" : "workflow",
    label: "",
    description: "",
    content: "",
    enabled: false,
    inheritanceMode,
    templateMode: "plain",
    assemblyMode: "append",
    tags: [],
  };
}

export function createEmptyBank(
  bankId: BankId,
  name: string,
  inheritanceMode: SlotInheritanceMode,
): SlotBank {
  return {
    bankId,
    name,
    slots: Array.from({ length: SLOT_COUNT }, (_, slotIndex) =>
      createEmptySlot(bankId, slotIndex, inheritanceMode),
    ),
  };
}

export function createEmptyComboBuffer(): ComboBufferState {
  return {
    queuedEntries: [],
    activeStances: [],
    lastFinalized: null,
  };
}

export function upsertSlotInBank(bank: SlotBank, patch: Partial<SlotDefinition> & SlotReference): SlotBank {
  return {
    ...bank,
    slots: bank.slots.map((slot) =>
      slot.slotIndex === patch.slotIndex
        ? {
            ...slot,
            ...patch,
          }
        : slot,
    ),
  };
}

export function mergeBanks(parentBank: SlotBank, childBank: SlotBank): SlotBank {
  return {
    bankId: childBank.bankId,
    name: childBank.name || parentBank.name,
    slots: parentBank.slots.map((parentSlot) => {
      const childSlot = childBank.slots.find((slot) => slot.slotIndex === parentSlot.slotIndex);
      if (!childSlot || childSlot.inheritanceMode === "inherit") {
        return parentSlot;
      }

      return childSlot;
    }),
  };
}
