import {
  APP_SCHEMA_VERSION,
  AppSettings,
  BankId,
  Profile,
  ProfilesDocument,
  SettingsDocument,
  SuperRecipe,
  RecipeEntry,
  createEmptyBank,
  upsertSlotInBank,
} from "./models";
import { createDefaultHotkeys } from "./hotkeys";

function fillBankEntries(
  bankId: BankId,
  name: string,
  inheritanceMode: "inherit" | "override",
  entries: Array<{
    slotIndex: number;
    label: string;
    description: string;
    content: string;
    enabled?: boolean;
    tags?: string[];
  }>,
) {
  return entries.reduce(
    (bank, entry) =>
      upsertSlotInBank(bank, {
        bankId,
        slotIndex: entry.slotIndex,
        label: entry.label,
        description: entry.description,
        content: entry.content,
        enabled: entry.enabled ?? true,
        tags: entry.tags ?? [],
        inheritanceMode,
      }),
    createEmptyBank(bankId, name, inheritanceMode),
  );
}

const globalSupers: SuperRecipe[] = [
  {
    id: "repo-bughunt-super",
    name: "Repo bughunt super",
    description: "Queue context + repo sweep + auth guardrails in one move.",
    steps: [
      { type: "slot", slotRef: { bankId: "A", slotIndex: 2 } },
      { type: "slot", slotRef: { bankId: "B", slotIndex: 5 } },
      { type: "slot", slotRef: { bankId: "B", slotIndex: 3 } },
    ] satisfies RecipeEntry[],
    applyStances: true,
    hotkeyHint: null,
    assembly: null,
  },
];

export const defaultSettings: AppSettings = {
  schemaVersion: APP_SCHEMA_VERSION,
  theme: "dark",
  launchMode: "dock",
  comboJoiner: "\n\n",
  restoreClipboardAfterPaste: true,
  panicModeEnabled: false,
  hotkeys: createDefaultHotkeys(),
  ui: {
    compactDock: true,
    showComboHud: true,
    showTokenMeter: true,
    helpDismissed: false,
  },
  experimental: {
    chordMode: false,
    autoQueueCaptures: true,
  },
  activeProfileIdOverride: null,
};

export const seededProfiles: Profile[] = [
  {
    id: "global-workflow",
    name: "Global workflow loadout",
    kind: "global",
    description: "Portable Bank B workflow moves shared across repos.",
    priority: 0,
    extendsProfileId: null,
    matchRules: [],
    assembly: {
      style: "markdown",
      joiner: "\n\n",
    },
    bankA: createEmptyBank("A", "Global context bank", "override"),
    bankB: fillBankEntries("B", "Workflow bank", "override", [
      {
        slotIndex: 0,
        label: "Patch only",
        description: "Tight fix scope and small diffs.",
        content:
          "Patch only what is required for the reported blocker. Keep the blast radius small and avoid broad refactors.",
        tags: ["stance"],
      },
      {
        slotIndex: 1,
        label: "Summarize before edit",
        description: "Restate intent before cutting code.",
        content:
          "Summarize the issue and intended fix before editing any files, then proceed with the smallest auditable patch.",
      },
      {
        slotIndex: 2,
        label: "Write tests first",
        description: "Bias toward red-green-refactor.",
        content:
          "Add or update focused tests first where practical, use them to lock the behavior, then implement the fix.",
      },
      {
        slotIndex: 3,
        label: "Do not widen auth/security gates",
        description: "Preserve security boundaries while fixing behavior.",
        content:
          "Do not widen authentication, authorization, or security gates as part of this change unless explicitly requested.",
        tags: ["stance"],
      },
      {
        slotIndex: 4,
        label: "Output changed files only",
        description: "Keep final response terse and audit-friendly.",
        content:
          "In the final response, list the changed files and the highest-signal behavior changes only. Avoid a blow-by-blow changelog.",
      },
      {
        slotIndex: 5,
        label: "Repo sweep / bug hunt scaffold",
        description: "Search broadly, then converge to a small patch.",
        content:
          "Do a repo sweep for adjacent call paths, likely breakpoints, and related tests before landing the minimal fix. Confirm the real source of failure before editing.",
      },
      {
        slotIndex: 6,
        label: "Explain root cause first",
        description: "Lead with the actual failure mechanism before the patch.",
        content:
          "Explain the root cause in plain language before proposing code changes. Separate symptom, trigger, and fix so the final answer is easy to trust.",
      },
    ]),
    supers: globalSupers,
  },
  {
    id: "therxspot",
    name: "TheRxSpot.com",
    kind: "workspace",
    description: "Example repo-aware profile with repo-specific Bank A context.",
    priority: 40,
    extendsProfileId: "global-workflow",
    matchRules: [
      {
        id: "workspace-contains-therxspot",
        kind: "workspacePathContains",
        value: "TheRxSpot.com",
        caseSensitive: false,
        weightBoost: 40,
      },
      {
        id: "title-contains-therxspot",
        kind: "windowTitleContains",
        value: "TheRxSpot.com",
        caseSensitive: false,
        weightBoost: 10,
      },
    ],
    assembly: {
      style: "markdown",
      joiner: "\n\n---\n\n",
    },
    bankA: fillBankEntries("A", "Repo context bank", "override", [
      {
        slotIndex: 0,
        label: "Repo map",
        description: "Key directories, conventions, and shared docs.",
        content:
          "Capture the relevant repo or module map, nearest AGENTS.md rules, and any docs or runbooks that constrain this edit.",
      },
      {
        slotIndex: 1,
        label: "Edited files context",
        description: "What changed recently and why it matters.",
        content:
          "Summarize the current file focus, changed call paths, and any touched tests or config that constrain this patch.",
      },
      {
        slotIndex: 2,
        label: "Repro + bug trail",
        description: "What fails, where, and what to verify.",
        content:
          "State the failing behavior, expected behavior, exact repro, and the likely stack or subsystem involved before changing code.",
      },
      {
        slotIndex: 3,
        label: "Logs / traces",
        description: "Paste the most useful logs or traces.",
        content:
          "Include the most relevant logs, stack traces, or screenshots and call out which lines are signal versus noise.",
      },
    ]),
    bankB: createEmptyBank("B", "Workflow bank overrides", "inherit"),
    supers: [
      {
        id: "checkout-bughunt-super",
        name: "Checkout bughunt super",
        description: "Repo context opener plus sweep and guardrails.",
        steps: [
          { type: "slot", slotRef: { bankId: "A", slotIndex: 2 } },
          { type: "slot", slotRef: { bankId: "B", slotIndex: 5 } },
          { type: "slot", slotRef: { bankId: "B", slotIndex: 3 } },
        ] satisfies RecipeEntry[],
        applyStances: true,
        hotkeyHint: "Ctrl+Alt+F1",
        assembly: {
          style: "markdown",
          joiner: "\n\n",
        },
      },
    ],
  },
];

export function createSeedDocuments(now = new Date().toISOString()) {
  const settingsDocument: SettingsDocument = {
    version: APP_SCHEMA_VERSION,
    savedAtIso: now,
    settings: defaultSettings,
  };

      const profilesDocument: ProfilesDocument = {
    version: APP_SCHEMA_VERSION,
    savedAtIso: now,
    profiles: seededProfiles,
  };

  return {
    settingsDocument,
    profilesDocument,
  };
}
