import { describe, expect, it, vi } from "vitest";
import { runSuperPasteCli } from "../commands";
import { createSeedDocuments } from "../../domain/seeds";

function makeIo() {
  return {
    stdout: vi.fn(),
    stderr: vi.fn(),
  };
}

describe("superpaste CLI", () => {
  it("lists profiles", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const io = makeIo();

    const exitCode = await runSuperPasteCli(["profiles", "list"], io, {
      loadDocuments: vi.fn().mockResolvedValue({
        appDataDir: "C:/AppData/com.superpaste.desktop",
        settingsDocument: seed.settingsDocument,
        profilesDocument: seed.profilesDocument,
      }),
    });

    expect(exitCode).toBe(0);
    expect(io.stdout).toHaveBeenCalledWith(expect.stringContaining("global-workflow"));
    expect(io.stdout).toHaveBeenCalledWith(expect.stringContaining("therxspot"));
  });

  it("activates a profile by updating local settings", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const io = makeIo();
    const saveDocuments = vi.fn().mockResolvedValue(undefined);

    const exitCode = await runSuperPasteCli(["profiles", "activate", "therxspot"], io, {
      loadDocuments: vi.fn().mockResolvedValue({
        appDataDir: "C:/AppData/com.superpaste.desktop",
        settingsDocument: seed.settingsDocument,
        profilesDocument: seed.profilesDocument,
      }),
      saveDocuments,
    });

    expect(exitCode).toBe(0);
    expect(saveDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ activeProfileIdOverride: "therxspot" }),
      seed.profilesDocument.profiles,
      expect.any(String),
    );
  });

  it("imports a portable content pack without overwriting local settings", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const io = makeIo();
    const saveDocuments = vi.fn().mockResolvedValue(undefined);
    const currentSettings = {
      ...seed.settingsDocument.settings,
      activeProfileIdOverride: "therxspot",
    };
    const packJson = JSON.stringify({
      format: "superpaste-content-pack",
      version: 1,
      exportedAtIso: "2026-04-13T00:00:00.000Z",
      packName: "Workflow only",
      profiles: seed.profilesDocument.profiles.slice(0, 1),
    });

    const exitCode = await runSuperPasteCli(["packs", "import", "workflow.superpaste.json"], io, {
      loadDocuments: vi.fn().mockResolvedValue({
        appDataDir: "C:/AppData/com.superpaste.desktop",
        settingsDocument: {
          ...seed.settingsDocument,
          settings: currentSettings,
        },
        profilesDocument: seed.profilesDocument,
      }),
      readTextFile: vi.fn().mockResolvedValue(packJson),
      saveDocuments,
      cwd: () => "C:/workspace",
    });

    expect(exitCode).toBe(0);
    expect(saveDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ activeProfileIdOverride: "therxspot" }),
      expect.arrayContaining([expect.objectContaining({ id: "global-workflow" })]),
      expect.any(String),
    );
  });

  it("previews a recipe with slot refs and reports meter data", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const io = makeIo();

    const exitCode = await runSuperPasteCli(["preview", "A2", "--super", "checkout-bughunt-super"], io, {
      loadDocuments: vi.fn().mockResolvedValue({
        appDataDir: "C:/AppData/com.superpaste.desktop",
        settingsDocument: seed.settingsDocument,
        profilesDocument: seed.profilesDocument,
      }),
      cwd: () => "C:/Users/93rob/Documents/GitHub/TheRxSpot.com",
    });

    expect(exitCode).toBe(0);
    expect(io.stdout).toHaveBeenCalledWith(expect.stringContaining("chars="));
    expect(io.stdout).toHaveBeenCalledWith(expect.stringContaining("State the failing behavior"));
  });

  it("fails profile activation when the profile id is missing", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const io = makeIo();

    const exitCode = await runSuperPasteCli(["profiles", "activate"], io, {
      loadDocuments: vi.fn().mockResolvedValue({
        appDataDir: "C:/AppData/com.superpaste.desktop",
        settingsDocument: seed.settingsDocument,
        profilesDocument: seed.profilesDocument,
      }),
    });

    expect(exitCode).toBe(1);
    expect(io.stderr).toHaveBeenCalledWith(expect.stringContaining("Missing required profile id"));
  });

  it("fails profile activation when the profile is unknown", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const io = makeIo();

    const exitCode = await runSuperPasteCli(["profiles", "activate", "unknown"], io, {
      loadDocuments: vi.fn().mockResolvedValue({
        appDataDir: "C:/AppData/com.superpaste.desktop",
        settingsDocument: seed.settingsDocument,
        profilesDocument: seed.profilesDocument,
      }),
    });

    expect(exitCode).toBe(1);
    expect(io.stderr).toHaveBeenCalledWith(expect.stringContaining("Unknown profile unknown"));
  });

  it("fails pack import when the JSON is invalid", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const io = makeIo();

    const exitCode = await runSuperPasteCli(["packs", "import", "broken.superpaste.json"], io, {
      loadDocuments: vi.fn().mockResolvedValue({
        appDataDir: "C:/AppData/com.superpaste.desktop",
        settingsDocument: seed.settingsDocument,
        profilesDocument: seed.profilesDocument,
      }),
      readTextFile: vi.fn().mockResolvedValue("{not-json"),
      cwd: () => "C:/workspace",
    });

    expect(exitCode).toBe(1);
    expect(io.stderr).toHaveBeenCalled();
  });

  it("fails preview when an explicit profile override is unknown", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const io = makeIo();

    const exitCode = await runSuperPasteCli(["preview", "A2", "--profile", "missing"], io, {
      loadDocuments: vi.fn().mockResolvedValue({
        appDataDir: "C:/AppData/com.superpaste.desktop",
        settingsDocument: seed.settingsDocument,
        profilesDocument: seed.profilesDocument,
      }),
      cwd: () => "C:/workspace",
    });

    expect(exitCode).toBe(1);
    expect(io.stderr).toHaveBeenCalledWith(expect.stringContaining("Unknown profile missing"));
  });

  it("fails preview when the referenced slot produces no output", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const io = makeIo();
    seed.profilesDocument.profiles[1]!.bankA.slots[7] = {
      ...seed.profilesDocument.profiles[1]!.bankA.slots[7]!,
      enabled: false,
      content: "",
    };

    const exitCode = await runSuperPasteCli(["preview", "A8", "--profile", "therxspot"], io, {
      loadDocuments: vi.fn().mockResolvedValue({
        appDataDir: "C:/AppData/com.superpaste.desktop",
        settingsDocument: seed.settingsDocument,
        profilesDocument: seed.profilesDocument,
      }),
      cwd: () => "C:/workspace",
    });

    expect(exitCode).toBe(1);
    expect(io.stderr).toHaveBeenCalledWith(expect.stringContaining("Preview produced no output"));
  });
});
