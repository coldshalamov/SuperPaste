import { describe, expect, it } from "vitest";
import { resolveProfile } from "../profile-resolution";
import { createSeedDocuments } from "../seeds";

describe("profile resolution", () => {
  it("prefers a workspace path match over title heuristics", () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");

    const resolved = resolveProfile(seed.profilesDocument.profiles, seed.settingsDocument.settings, {
      title: "VS Code - random.txt",
      processName: "code.exe",
      processPath: "C:/Program Files/Microsoft VS Code/Code.exe",
      workspacePath: "C:/Users/93rob/Documents/GitHub/TheRxSpot.com",
    });

    expect(resolved.profile.id).toBe("therxspot");
    expect(resolved.reason).toMatch(/workspacePathContains/i);
    expect(resolved.effectiveBankB.slots[0].label).toBe("Patch only");
  });

  it("falls back to the global profile when nothing matches", () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");

    const resolved = resolveProfile(seed.profilesDocument.profiles, seed.settingsDocument.settings, {
      title: "Notepad",
      processName: "notepad.exe",
      processPath: "C:/Windows/System32/notepad.exe",
      workspacePath: "",
    });

    expect(resolved.profile.id).toBe("global-workflow");
    expect(resolved.reason).toMatch(/Global profile fallback/i);
  });

  it("honors manual profile overrides", () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const settings = {
      ...seed.settingsDocument.settings,
      activeProfileIdOverride: "therxspot",
    };

    const resolved = resolveProfile(seed.profilesDocument.profiles, settings, {
      title: "Notepad",
      processName: "notepad.exe",
      processPath: "",
      workspacePath: "",
    });

    expect(resolved.profile.id).toBe("therxspot");
    expect(resolved.reason).toMatch(/Manual override/i);
  });
});
