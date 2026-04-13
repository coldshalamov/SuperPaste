import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProfilesDocument, createSettingsDocument } from "../domain/documents";
import { Profile, ProfilesDocument, SettingsDocument } from "../domain/models";
import { createSeedDocuments } from "../domain/seeds";
import { parseProfilesDocument, parseSettingsDocument } from "../domain/validation";

export type PersistedDocuments = {
  appDataDir: string;
  settingsDocument: SettingsDocument;
  profilesDocument: ProfilesDocument;
};

function resolveBaseAppDataDir() {
  return process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
}

export function resolveSuperPasteAppDataDir() {
  return path.join(resolveBaseAppDataDir(), "com.superpaste.desktop");
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeFileAtomic(filePath: string, content: string) {
  const tempPath = `${filePath}.tmp`;
  if (await exists(filePath)) {
    await fs.copyFile(filePath, `${filePath}.bak`);
  }
  await fs.writeFile(tempPath, content, "utf8");
  await fs.rename(tempPath, filePath);
}

async function quarantineInvalidFile(filePath: string) {
  const quarantinePath = `${filePath}.invalid-${Date.now()}`;
  await fs.copyFile(filePath, quarantinePath);
}

async function loadDocumentWithRecovery<T>(
  filePath: string,
  parse: (input: string) => T,
): Promise<{ document: T | null; repaired: boolean }> {
  const candidatePaths = [filePath, `${filePath}.bak`];
  let repaired = false;

  for (const candidatePath of candidatePaths) {
    if (!(await exists(candidatePath))) {
      continue;
    }

    const json = await fs.readFile(candidatePath, "utf8");

    try {
      return {
        document: parse(json),
        repaired: repaired || candidatePath !== filePath,
      };
    } catch {
      await quarantineInvalidFile(candidatePath);
      repaired = true;
    }
  }

  return {
    document: null,
    repaired,
  };
}

export async function loadPersistedDocuments(appDataDir = resolveSuperPasteAppDataDir()): Promise<PersistedDocuments> {
  await fs.mkdir(appDataDir, { recursive: true });
  const settingsPath = path.join(appDataDir, "settings.json");
  const profilesPath = path.join(appDataDir, "profiles.json");
  const seed = createSeedDocuments();
  const [loadedSettings, loadedProfiles] = await Promise.all([
    loadDocumentWithRecovery(settingsPath, parseSettingsDocument),
    loadDocumentWithRecovery(profilesPath, parseProfilesDocument),
  ]);
  const settingsDocument = loadedSettings.document ?? seed.settingsDocument;
  const profilesDocument = loadedProfiles.document ?? seed.profilesDocument;

  if (loadedSettings.repaired || !loadedSettings.document) {
    await writeFileAtomic(settingsPath, JSON.stringify(settingsDocument, null, 2));
  }

  if (loadedProfiles.repaired || !loadedProfiles.document) {
    await writeFileAtomic(profilesPath, JSON.stringify(profilesDocument, null, 2));
  }

  return {
    appDataDir,
    settingsDocument,
    profilesDocument,
  };
}

export async function savePersistedDocuments(
  settings: SettingsDocument["settings"],
  profiles: Profile[],
  appDataDir = resolveSuperPasteAppDataDir(),
) {
  await fs.mkdir(appDataDir, { recursive: true });
  const settingsPath = path.join(appDataDir, "settings.json");
  const profilesPath = path.join(appDataDir, "profiles.json");

  const settingsDocument = createSettingsDocument(settings);
  const profilesDocument = createProfilesDocument(profiles);

  await writeFileAtomic(settingsPath, JSON.stringify(settingsDocument, null, 2));
  await writeFileAtomic(profilesPath, JSON.stringify(profilesDocument, null, 2));

  return {
    appDataDir,
    settingsDocument,
    profilesDocument,
  };
}
