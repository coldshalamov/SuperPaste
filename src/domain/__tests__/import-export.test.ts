import { describe, expect, it } from "vitest";
import {
  createPortableProfilePack,
  materializeImportedDocuments,
  parseImportExportPackText,
  serializePortableProfilePack,
} from "../import-export";
import { createSeedDocuments } from "../seeds";

describe("portable profile packs", () => {
  it("round-trips recipe metadata and assembly configuration", () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const json = serializePortableProfilePack(seed.profilesDocument.profiles, "TheRxSpot example");
    const parsed = parseImportExportPackText(json);

    expect(parsed.format).toBe("superpaste-content-pack");
    expect(parsed.profiles[0]?.assembly?.joiner).toBe("\n\n");
    expect(parsed.profiles[1]?.supers[0]?.steps[0]).toEqual({
      type: "slot",
      slotRef: { bankId: "A", slotIndex: 2 },
    });
  });

  it("keeps machine-local settings when importing a portable content pack", () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const imported = parseImportExportPackText(
      JSON.stringify(createPortableProfilePack(seed.profilesDocument.profiles.slice(0, 1), "Workflow only")),
    );
    const currentSettings = {
      ...seed.settingsDocument.settings,
      activeProfileIdOverride: "therxspot",
    };

    const materialized = materializeImportedDocuments(imported, currentSettings);

    expect(materialized.settings.activeProfileIdOverride).toBe("therxspot");
    expect(materialized.profiles).toHaveLength(1);
  });
});
