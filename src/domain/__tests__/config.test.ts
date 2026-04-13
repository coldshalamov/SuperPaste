import { describe, expect, it } from "vitest";
import { createSeedDocuments } from "../seeds";
import { createDefaultHotkeys, detectHotkeyConflicts } from "../hotkeys";
import {
  createMachineSnapshotPack,
  createPortableProfilePack,
  parseImportExportPackText,
} from "../import-export";
import { parseProfilesDocument, parseSettingsDocument } from "../validation";

describe("config parsing and validation", () => {
  it("parses seeded settings and profiles", () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    expect(parseSettingsDocument(JSON.stringify(seed.settingsDocument)).settings.theme).toBe("dark");
    expect(parseProfilesDocument(JSON.stringify(seed.profilesDocument)).profiles).toHaveLength(2);
  });

  it("upgrades a legacy envelope without version fields", () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const legacy = {
      settings: seed.settingsDocument.settings,
    };

    const parsed = parseSettingsDocument(JSON.stringify(legacy));
    expect(parsed.version).toBe(1);
  });

  it("rejects circular profile inheritance", () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    seed.profilesDocument.profiles[0] = {
      ...seed.profilesDocument.profiles[0],
      extendsProfileId: "therxspot",
    };

    expect(() => parseProfilesDocument(JSON.stringify(seed.profilesDocument))).toThrow(/Circular profile inheritance/i);
  });

  it("round-trips an import/export pack", () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const pack = JSON.stringify(createPortableProfilePack(seed.profilesDocument.profiles, "Test pack"));

    const parsed = parseImportExportPackText(pack);
    expect(parsed.format).toBe("superpaste-content-pack");
    expect(parsed.profiles[1].id).toBe("therxspot");
  });

  it("still parses a machine snapshot import/export pack", () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const pack = JSON.stringify(createMachineSnapshotPack(seed.settingsDocument.settings, seed.profilesDocument.profiles));

    const parsed = parseImportExportPackText(pack);
    expect(parsed.format).toBe("superpaste-machine-snapshot");
    if (parsed.format !== "superpaste-machine-snapshot") {
      throw new Error("Expected a machine snapshot pack.");
    }

    expect(parsed.settings.theme).toBe("dark");
  });

  it("detects duplicate hotkeys", () => {
    const hotkeys = createDefaultHotkeys();
    hotkeys.finalizeCombo = hotkeys.cancelCombo;
    const conflicts = detectHotkeyConflicts(hotkeys);
    expect(conflicts.some((conflict) => conflict.binding === hotkeys.cancelCombo)).toBe(true);
  });

  it("ships the recommended default workflow moves", () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const workflowProfile = seed.profilesDocument.profiles.find((profile) => profile.id === "global-workflow");
    const labels = workflowProfile?.bankB.slots.filter((slot) => slot.enabled).map((slot) => slot.label) ?? [];

    expect(labels).toEqual(
      expect.arrayContaining([
        "Patch only",
        "Summarize before edit",
        "Write tests first",
        "Do not widen auth/security gates",
        "Output changed files only",
        "Repo sweep / bug hunt scaffold",
        "Explain root cause first",
      ]),
    );
  });
});
