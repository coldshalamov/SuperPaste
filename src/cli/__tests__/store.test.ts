import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { createSeedDocuments } from "../../domain/seeds";
import { loadPersistedDocuments, savePersistedDocuments } from "../store";

const tempDirs: string[] = [];

async function createTempDir() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "superpaste-store-"));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
});

describe("CLI store recovery", () => {
  it("returns seed documents when no files exist yet", async () => {
    const appDataDir = await createTempDir();

    const loaded = await loadPersistedDocuments(appDataDir);

    expect(loaded.settingsDocument.settings.schemaVersion).toBe(1);
    expect(loaded.profilesDocument.profiles.length).toBeGreaterThan(0);
  });

  it("recovers profiles from a valid backup and rewrites the primary file", async () => {
    const appDataDir = await createTempDir();
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const profilesPath = path.join(appDataDir, "profiles.json");
    const backupPath = `${profilesPath}.bak`;

    await writeFile(profilesPath, "{not-json", "utf8");
    await writeFile(backupPath, JSON.stringify(seed.profilesDocument, null, 2), "utf8");

    const loaded = await loadPersistedDocuments(appDataDir);
    const rewrittenPrimary = await readFile(profilesPath, "utf8");

    expect(loaded.profilesDocument.profiles.map((profile) => profile.id)).toContain("therxspot");
    expect(JSON.parse(rewrittenPrimary).profiles[0].id).toBe(seed.profilesDocument.profiles[0]?.id);
  });

  it("falls back to seeded settings while preserving valid profiles when only settings are invalid", async () => {
    const appDataDir = await createTempDir();
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const settingsPath = path.join(appDataDir, "settings.json");
    const profilesPath = path.join(appDataDir, "profiles.json");

    await writeFile(settingsPath, "{broken", "utf8");
    await writeFile(profilesPath, JSON.stringify(seed.profilesDocument, null, 2), "utf8");

    const loaded = await loadPersistedDocuments(appDataDir);

    expect(loaded.settingsDocument.settings.theme).toBe(seed.settingsDocument.settings.theme);
    expect(loaded.profilesDocument.profiles.map((profile) => profile.id)).toEqual(
      seed.profilesDocument.profiles.map((profile) => profile.id),
    );
  });

  it("creates .bak snapshots when overwriting persisted documents", async () => {
    const appDataDir = await createTempDir();
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    await savePersistedDocuments(seed.settingsDocument.settings, seed.profilesDocument.profiles, appDataDir);

    const nextProfiles = seed.profilesDocument.profiles.map((profile) =>
      profile.id === "therxspot"
        ? {
            ...profile,
            description: "Updated profile description",
          }
        : profile,
    );

    await savePersistedDocuments(seed.settingsDocument.settings, nextProfiles, appDataDir);

    const profilesBackup = await readFile(path.join(appDataDir, "profiles.json.bak"), "utf8");
    expect(JSON.parse(profilesBackup).profiles.find((profile: { id: string }) => profile.id === "therxspot").description).toBe(
      seed.profilesDocument.profiles.find((profile) => profile.id === "therxspot")?.description,
    );
  });
});
