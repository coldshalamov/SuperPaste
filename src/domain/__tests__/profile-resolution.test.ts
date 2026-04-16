import { describe, expect, it } from "vitest";
import { resolveProfile } from "../profile-resolution";
import { createSeedDocuments } from "../seeds";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

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

  it("breaks circular profile inheritance without crashing", () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const profiles = clone(seed.profilesDocument.profiles);
    const globalProfile = profiles.find((profile) => profile.id === "global-workflow");

    if (!globalProfile) {
      throw new Error("global profile missing in seed data");
    }

    const cycleA = {
      ...clone(globalProfile),
      id: "cycle-a",
      name: "Cycle A",
      kind: "workspace" as const,
      extendsProfileId: "cycle-b",
      matchRules: [],
    };
    const cycleB = {
      ...clone(globalProfile),
      id: "cycle-b",
      name: "Cycle B",
      kind: "workspace" as const,
      extendsProfileId: "cycle-a",
      matchRules: [],
    };

    const resolved = resolveProfile(
      [globalProfile, cycleA, cycleB],
      {
        ...clone(seed.settingsDocument.settings),
        activeProfileIdOverride: "cycle-a",
      },
      {
        title: "Notepad",
        processName: "notepad.exe",
        processPath: "",
        workspacePath: "",
      },
    );

    expect(resolved.profile.id).toBe("cycle-a");
    expect(resolved.effectiveBankA.slots).toHaveLength(10);
    expect(resolved.effectiveBankB.slots).toHaveLength(10);
  });

  it("lets child profiles override parent supers with the same id", () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const profiles = clone(seed.profilesDocument.profiles);
    const globalProfile = profiles.find((profile) => profile.id === "global-workflow");
    const workspaceProfile = profiles.find((profile) => profile.id === "therxspot");

    if (!globalProfile || !workspaceProfile) {
      throw new Error("expected seed profiles missing");
    }

    globalProfile.supers = [
      {
        ...globalProfile.supers[0]!,
        id: "shared-super",
        name: "Parent shared super",
      },
    ];
    workspaceProfile.supers = [
      {
        ...workspaceProfile.supers[0]!,
        id: "shared-super",
        name: "Workspace shared super",
      },
    ];

    const resolved = resolveProfile(
      profiles,
      clone(seed.settingsDocument.settings),
      {
        title: "VS Code - TheRxSpot.com",
        processName: "code.exe",
        processPath: "C:/Program Files/Microsoft VS Code/Code.exe",
        workspacePath: "C:/Users/93rob/Documents/GitHub/TheRxSpot.com",
      },
    );

    const sharedSupers = resolved.effectiveSupers.filter((recipe) => recipe.id === "shared-super");
    expect(sharedSupers).toHaveLength(1);
    expect(sharedSupers[0]?.name).toBe("Workspace shared super");
  });
});
