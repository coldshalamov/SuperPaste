import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  finalizeCombo,
  queueSlot,
  queueSuper,
} from "../domain/combo-engine";
import { materializeImportedDocuments, parseImportExportPackText, serializePortableProfilePack } from "../domain/import-export";
import { AppSettings, Profile, SlotReference, createEmptyComboBuffer } from "../domain/models";
import { resolveProfile } from "../domain/profile-resolution";
import { loadPersistedDocuments, resolveSuperPasteAppDataDir, savePersistedDocuments } from "./store";

export type CliIo = {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

export type CliDependencies = {
  loadDocuments: typeof loadPersistedDocuments;
  saveDocuments: typeof savePersistedDocuments;
  readTextFile: typeof readFile;
  writeTextFile: typeof writeFile;
  cwd: () => string;
  appDataDir: () => string;
};

const defaultDependencies: CliDependencies = {
  loadDocuments: loadPersistedDocuments,
  saveDocuments: savePersistedDocuments,
  readTextFile: readFile,
  writeTextFile: writeFile,
  cwd: () => process.cwd(),
  appDataDir: () => resolveSuperPasteAppDataDir(),
};

function parseSlotReference(token: string): SlotReference | null {
  const match = /^([AB])([1-9]|0)$/i.exec(token.trim());
  if (!match) {
    return null;
  }

  const bankId = match[1]!.toUpperCase() as "A" | "B";
  const digit = match[2]!;
  const slotIndex = digit === "0" ? 9 : Number(digit) - 1;

  return {
    bankId,
    slotIndex,
  };
}

function printProfileSummary(profile: Profile) {
  const rules = profile.matchRules.map((rule) => `${rule.kind}:${rule.value}`).join(", ") || "no rules";
  return `${profile.id}\t${profile.kind}\textends=${profile.extendsProfileId ?? "-"}\trules=${rules}`;
}

function requireValue(value: string | undefined, label: string) {
  if (!value) {
    throw new Error(`Missing required ${label}.`);
  }

  return value;
}

function formatPreview(text: string, charCount: number, roughTokens: number) {
  return [`chars=${charCount}`, `tokens≈${roughTokens}`, "", text].join("\n");
}

export async function runSuperPasteCli(
  argv: string[],
  io: CliIo,
  dependencies: Partial<CliDependencies> = {},
) {
  const deps = { ...defaultDependencies, ...dependencies };
  const [group, command, ...rest] = argv;

  try {
    const { settingsDocument, profilesDocument } = await deps.loadDocuments(deps.appDataDir());
    const settings = settingsDocument.settings;
    const profiles = profilesDocument.profiles;

    if (group === "profiles" && command === "list") {
      profiles.forEach((profile) => io.stdout(printProfileSummary(profile)));
      return 0;
    }

    if (group === "profiles" && command === "activate") {
      const profileId = requireValue(rest[0], "profile id");
      const target = profiles.find((profile) => profile.id === profileId);
      if (!target) {
        throw new Error(`Unknown profile ${profileId}.`);
      }

      const nextSettings: AppSettings = {
        ...settings,
        activeProfileIdOverride: profileId,
      };
      await deps.saveDocuments(nextSettings, profiles, deps.appDataDir());
      io.stdout(`Activated profile ${profileId}.`);
      return 0;
    }

    if (group === "profiles" && command === "clear-override") {
      const nextSettings: AppSettings = {
        ...settings,
        activeProfileIdOverride: null,
      };
      await deps.saveDocuments(nextSettings, profiles, deps.appDataDir());
      io.stdout("Cleared manual profile override.");
      return 0;
    }

    if (group === "profiles" && command === "match") {
      const getFlag = (flag: string) => {
        const index = rest.indexOf(flag);
        return index >= 0 ? rest[index + 1] : "";
      };

      const resolved = resolveProfile(profiles, settings, {
        title: getFlag("--title"),
        processName: getFlag("--process"),
        processPath: getFlag("--process-path"),
        workspacePath: getFlag("--workspace"),
      });

      io.stdout(`${resolved.profile.id}\t${resolved.reason}`);
      return 0;
    }

    if (group === "packs" && command === "import") {
      const filePath = path.resolve(deps.cwd(), requireValue(rest[0], "pack file"));
      const text = await deps.readTextFile(filePath, "utf8");
      const pack = parseImportExportPackText(text);
      const documents = materializeImportedDocuments(pack, settings);
      await deps.saveDocuments(documents.settings, documents.profiles, deps.appDataDir());
      io.stdout(`Imported ${filePath}.`);
      return 0;
    }

    if (group === "packs" && command === "export") {
      const outputPath = path.resolve(deps.cwd(), rest[0] ?? "superpaste-content-pack.superpaste.json");
      await deps.writeTextFile(outputPath, serializePortableProfilePack(profiles), "utf8");
      io.stdout(`Exported ${outputPath}.`);
      return 0;
    }

    if (group === "preview") {
      const comboArgs = [...rest];
      const superIndex = comboArgs.indexOf("--super");
      const clipboardIndex = comboArgs.indexOf("--clipboard");
      const clipboardFileIndex = comboArgs.indexOf("--clipboard-file");
      const profileIndex = comboArgs.indexOf("--profile");

      const profileId = profileIndex >= 0 ? comboArgs[profileIndex + 1] : null;
      const resolved = profileId
        ? (() => {
            const explicit = profiles.find((profile) => profile.id === profileId);
            if (!explicit) {
              throw new Error(`Unknown profile ${profileId}.`);
            }

            return resolveProfile(
              profiles,
              { ...settings, activeProfileIdOverride: profileId },
              {
                title: "",
                processName: "",
                processPath: "",
                workspacePath: deps.cwd(),
              },
            );
          })()
        : resolveProfile(profiles, settings, {
            title: "",
            processName: "",
            processPath: "",
            workspacePath: deps.cwd(),
          });

      let clipboardText = "";
      if (clipboardIndex >= 0) {
        clipboardText = comboArgs[clipboardIndex + 1] ?? "";
      } else if (clipboardFileIndex >= 0) {
        const filePath = path.resolve(deps.cwd(), comboArgs[clipboardFileIndex + 1] ?? "");
        clipboardText = await deps.readTextFile(filePath, "utf8");
      }

      let comboState = createEmptyComboBuffer();
      for (const token of comboArgs) {
        const slotRef = parseSlotReference(token);
        if (slotRef) {
          comboState = queueSlot(comboState, slotRef);
        }
      }

      if (superIndex >= 0) {
        const superId = comboArgs[superIndex + 1];
        if (superId) {
          comboState = queueSuper(comboState, superId);
        }
      }

      const { finalized } = finalizeCombo(
        comboState,
        {
          bankA: resolved.effectiveBankA.slots,
          bankB: resolved.effectiveBankB.slots,
          supers: resolved.effectiveSupers,
          assembly: resolved.effectiveAssembly,
        },
        settings,
        {
          clipboard: clipboardText,
          profile: resolved.profile.name,
          active_app: "cli",
          date: new Date().toISOString().slice(0, 10),
        },
      );

      if (!finalized) {
        throw new Error("Preview produced no output.");
      }

      io.stdout(formatPreview(finalized.text, finalized.charCount, finalized.roughTokenCount));
      return 0;
    }

    io.stderr(
      [
        "Usage:",
        "  superpaste profiles list",
        "  superpaste profiles activate <profile-id>",
        "  superpaste profiles clear-override",
        "  superpaste profiles match --workspace <path> --title <title> --process <name>",
        "  superpaste packs import <file>",
        "  superpaste packs export [file]",
        "  superpaste preview A2 B4 --super checkout-bughunt-super [--profile therxspot]",
      ].join("\n"),
    );
    return 1;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : "Unknown CLI error.");
    return 1;
  }
}
