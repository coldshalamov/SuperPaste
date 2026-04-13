import fs from "node:fs/promises";
import path from "node:path";
import { createPortableProfilePack } from "../src/domain/import-export.ts";
import { createEmptyBank, upsertSlotInBank } from "../src/domain/models.ts";
import { createSeedDocuments } from "../src/domain/seeds.ts";

const repoRoot = path.resolve(import.meta.dirname, "..");
const packsDir = path.join(repoRoot, "packs");

const seed = createSeedDocuments("2026-04-13T12:52:20.799Z");
const profiles = seed.profilesDocument.profiles;
const globalProfile = profiles.find((profile) => profile.id === "global-workflow");
const workspaceTemplateBase = profiles.find((profile) => profile.id === "therxspot");

if (!globalProfile || !workspaceTemplateBase) {
  throw new Error("Seed profiles are missing required release defaults.");
}

const examplePack = createPortableProfilePack(profiles, "Example SuperPaste profiles");
const workflowOnlyPack = createPortableProfilePack([globalProfile], "Workflow-only starter pack");

const repoStarterProfile = {
  ...workspaceTemplateBase,
  id: "repo-starter-template",
  name: "Repo starter template",
  description: "Copy this workspace profile and replace the match rules, repo name, and Bank A context with your own project.",
  matchRules: [
    {
      id: "workspace-contains-your-repo",
      kind: "workspacePathContains" as const,
      value: "your-repo-name",
      caseSensitive: false,
      weightBoost: 35,
    },
    {
      id: "title-contains-your-repo",
      kind: "windowTitleContains" as const,
      value: "your-repo-name",
      caseSensitive: false,
      weightBoost: 10,
    },
  ],
  bankA: [
    {
      slotIndex: 0,
      label: "Repo map",
      description: "Top-level modules, conventions, and docs that matter for edits.",
      content: "List the directories, nearest AGENTS.md instructions, build commands, and docs that shape work in this repo.",
    },
    {
      slotIndex: 1,
      label: "Failing command",
      description: "The one command, page, or flow that currently breaks.",
      content: "State the exact failing command, screen, route, or workflow plus the expected outcome.",
    },
    {
      slotIndex: 2,
      label: "Touched files",
      description: "The current files under review or likely blast radius.",
      content: "List the files already changed or most likely involved, and why each one matters.",
    },
    {
      slotIndex: 3,
      label: "Logs and traces",
      description: "Signal-rich logs, traces, or screenshots.",
      content: "Paste the most useful logs, stack traces, screenshots, or timestamps and call out the lines that matter.",
    },
    {
      slotIndex: 4,
      label: "Acceptance checks",
      description: "The checks that prove the fix is real.",
      content: "Write the exact tests, smoke checks, or manual verification steps that must pass before shipping.",
    },
  ].reduce(
    (bank, entry) =>
      upsertSlotInBank(bank, {
        bankId: "A",
        slotIndex: entry.slotIndex,
        label: entry.label,
        description: entry.description,
        content: entry.content,
        enabled: true,
        inheritanceMode: "override",
        tags: [],
      }),
    createEmptyBank("A", "Repo context bank", "override"),
  ),
  supers: [
    {
      id: "repo-bughunt-super",
      name: "Repo bughunt super",
      description: "Context opener plus sweep and guardrails for a new repo.",
      steps: [
        { type: "slot" as const, slotRef: { bankId: "A" as const, slotIndex: 1 } },
        { type: "slot" as const, slotRef: { bankId: "A" as const, slotIndex: 4 } },
        { type: "slot" as const, slotRef: { bankId: "B" as const, slotIndex: 5 } },
        { type: "slot" as const, slotRef: { bankId: "B" as const, slotIndex: 6 } },
      ],
      applyStances: true,
      hotkeyHint: null,
      assembly: {
        style: "markdown" as const,
        joiner: "\n\n---\n\n",
      },
    },
  ],
};

const repoStarterPack = createPortableProfilePack([globalProfile, repoStarterProfile], "Repo starter template pack");

await fs.mkdir(packsDir, { recursive: true });
await fs.writeFile(path.join(packsDir, "example-profile-pack.superpaste.json"), `${JSON.stringify(examplePack, null, 2)}\n`);
await fs.writeFile(path.join(packsDir, "workflow-only.superpaste.json"), `${JSON.stringify(workflowOnlyPack, null, 2)}\n`);
await fs.writeFile(
  path.join(packsDir, "repo-starter-template.superpaste.json"),
  `${JSON.stringify(repoStarterPack, null, 2)}\n`,
);

console.log("Release packs written.");
