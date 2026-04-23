import { describe, expect, it, vi } from "vitest";
import { SuperPasteEngine } from "../superpaste-engine";
import { createSeedDocuments } from "../../domain/seeds";
import { ActiveWindowSnapshot } from "../../domain/models";

function makeWindow(snapshot: Partial<ActiveWindowSnapshot> = {}): ActiveWindowSnapshot {
  return {
    title: "",
    processName: "",
    processPath: "",
    workspacePath: "",
    ...snapshot,
  };
}

describe("SuperPasteEngine", () => {
  it("saves Bank A clipboard content into the matched workspace profile and persists it", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const persistDocuments = vi.fn().mockResolvedValue(undefined);
    const engine = new SuperPasteEngine(
      {
        activeWindowProvider: {
          getSnapshot: vi.fn().mockResolvedValue(
            makeWindow({
              title: "TheRxSpot.com - Visual Studio Code",
              processName: "Code.exe",
            }),
          ),
        },
        clipboardGateway: {
          readText: vi.fn().mockResolvedValue("captured clipboard"),
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        pasteEngine: {
          execute: vi.fn(),
        },
        persistDocuments,
      },
      {
        settings: seed.settingsDocument.settings,
        profiles: seed.profilesDocument.profiles,
      },
    );

    const snapshot = await engine.saveClipboardToSlot({ bankId: "A", slotIndex: 4 });

    expect(snapshot.profiles.find((profile) => profile.id === "therxspot")?.bankA.slots[4]?.content).toBe(
      "captured clipboard",
    );
    expect(snapshot.lastActionMessage).toMatch(/Saved TheRxSpot.com A5/i);
    expect(persistDocuments).toHaveBeenCalledTimes(1);
  });

  it("saves Bank B clipboard content into the global workflow profile by default", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const engine = new SuperPasteEngine(
      {
        activeWindowProvider: {
          getSnapshot: vi.fn().mockResolvedValue(
            makeWindow({
              title: "TheRxSpot.com - Visual Studio Code",
              processName: "Code.exe",
            }),
          ),
        },
        clipboardGateway: {
          readText: vi.fn().mockResolvedValue("workflow wrapper"),
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        pasteEngine: {
          execute: vi.fn(),
        },
        persistDocuments: vi.fn().mockResolvedValue(undefined),
      },
      {
        settings: seed.settingsDocument.settings,
        profiles: seed.profilesDocument.profiles,
      },
    );

    const snapshot = await engine.saveClipboardToSlot({ bankId: "B", slotIndex: 6 });

    expect(snapshot.profiles.find((profile) => profile.id === "global-workflow")?.bankB.slots[6]?.content).toBe(
      "workflow wrapper",
    );
  });

  it("preserves workflow slot template metadata when saving clipboard into an existing Bank B slot", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    seed.profilesDocument.profiles[0]!.bankB.slots[0] = {
      ...seed.profilesDocument.profiles[0]!.bankB.slots[0]!,
      templateMode: "template",
      assemblyMode: "wrap",
      content: "{{clipboard}}",
      enabled: true,
    };

    const engine = new SuperPasteEngine(
      {
        activeWindowProvider: {
          getSnapshot: vi.fn().mockResolvedValue(makeWindow({ processName: "Code.exe" })),
        },
        clipboardGateway: {
          readText: vi.fn().mockResolvedValue("fresh wrapper"),
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        pasteEngine: {
          execute: vi.fn(),
        },
        persistDocuments: vi.fn().mockResolvedValue(undefined),
      },
      {
        settings: seed.settingsDocument.settings,
        profiles: seed.profilesDocument.profiles,
      },
    );

    const snapshot = await engine.saveClipboardToSlot({ bankId: "B", slotIndex: 0 });
    const savedSlot = snapshot.profiles.find((profile) => profile.id === "global-workflow")?.bankB.slots[0]!;

    expect(savedSlot.content).toBe("fresh wrapper");
    expect(savedSlot.templateMode).toBe("template");
    expect(savedSlot.assemblyMode).toBe("wrap");
  });

  it("does not overwrite a slot when the clipboard is empty", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    seed.profilesDocument.profiles[1]!.bankA.slots[4] = {
      ...seed.profilesDocument.profiles[1]!.bankA.slots[4]!,
      label: "Existing repro",
      content: "Keep this content",
      enabled: true,
    };
    const persistDocuments = vi.fn().mockResolvedValue(undefined);
    const engine = new SuperPasteEngine(
      {
        activeWindowProvider: {
          getSnapshot: vi.fn().mockResolvedValue(
            makeWindow({
              title: "TheRxSpot.com - Visual Studio Code",
              processName: "Code.exe",
            }),
          ),
        },
        clipboardGateway: {
          readText: vi.fn().mockResolvedValue("   "),
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        pasteEngine: {
          execute: vi.fn(),
        },
        persistDocuments,
      },
      {
        settings: seed.settingsDocument.settings,
        profiles: seed.profilesDocument.profiles,
      },
    );

    const snapshot = await engine.saveClipboardToSlot({ bankId: "A", slotIndex: 4 });

    expect(snapshot.profiles.find((profile) => profile.id === "therxspot")?.bankA.slots[4]?.content).toBe(
      "Keep this content",
    );
    expect(snapshot.lastActionMessage).toMatch(/left unchanged/i);
    expect(persistDocuments).not.toHaveBeenCalled();
  });

  it("resolves profile from fresh active window data before direct slot paste", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const execute = vi.fn().mockResolvedValue({
      ok: true,
      message: "Pasted combo.",
    });
    const engine = new SuperPasteEngine(
      {
        activeWindowProvider: {
          getSnapshot: vi.fn().mockResolvedValue(
            makeWindow({
              title: "TheRxSpot.com - Visual Studio Code",
              processName: "Code.exe",
            }),
          ),
        },
        clipboardGateway: {
          readText: vi.fn().mockResolvedValue(""),
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        pasteEngine: {
          execute,
        },
        persistDocuments: vi.fn().mockResolvedValue(undefined),
      },
      {
        settings: seed.settingsDocument.settings,
        profiles: seed.profilesDocument.profiles,
      },
    );

    const snapshot = await engine.directPasteSlot({ bankId: "A", slotIndex: 2 });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        executionMode: "paste-now",
        restoreClipboard: true,
        text: expect.stringContaining("State the failing behavior"),
      }),
    );
    expect(snapshot.resolvedProfile.profile.id).toBe("therxspot");
    expect(snapshot.lastActionMessage).toMatch(/Pasted combo/i);
  });

  it("removes the last queued combo entry and finalizes in copy-only mode", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const execute = vi.fn().mockResolvedValue({
      ok: true,
      message: "Copied combo.",
    });
    const engine = new SuperPasteEngine(
      {
        activeWindowProvider: {
          getSnapshot: vi.fn().mockResolvedValue(
            makeWindow({
              title: "TheRxSpot.com - Visual Studio Code",
              processName: "Code.exe",
            }),
          ),
        },
        clipboardGateway: {
          readText: vi.fn().mockResolvedValue(""),
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        pasteEngine: {
          execute,
        },
        persistDocuments: vi.fn().mockResolvedValue(undefined),
      },
      {
        settings: seed.settingsDocument.settings,
        profiles: seed.profilesDocument.profiles,
      },
    );

    await engine.queueSlot({ bankId: "A", slotIndex: 2 });
    await engine.queueSlot({ bankId: "B", slotIndex: 5 });
    const afterRemove = await engine.removeLast();
    const afterFinalize = await engine.finalize("copy-only");

    expect(afterRemove.comboState.queuedEntries).toHaveLength(1);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        executionMode: "copy-only",
      }),
    );
    expect(afterFinalize.comboState.queuedEntries).toHaveLength(0);
    expect(afterFinalize.finalizedPreview).toContain("State the failing behavior");
  });

  it("replays the last finalized combo through the paste engine", async () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const execute = vi.fn().mockResolvedValue({
      ok: true,
      message: "Replayed combo.",
    });
    const engine = new SuperPasteEngine(
      {
        activeWindowProvider: {
          getSnapshot: vi.fn().mockResolvedValue(
            makeWindow({
              title: "TheRxSpot.com - Visual Studio Code",
              processName: "Code.exe",
            }),
          ),
        },
        clipboardGateway: {
          readText: vi.fn().mockResolvedValue(""),
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        pasteEngine: {
          execute,
        },
        persistDocuments: vi.fn().mockResolvedValue(undefined),
      },
      {
        settings: seed.settingsDocument.settings,
        profiles: seed.profilesDocument.profiles,
      },
    );

    await engine.queueSlot({ bankId: "A", slotIndex: 2 });
    await engine.finalize("copy-only");
    execute.mockClear();
    const replayed = await engine.replayLast();

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        executionMode: "paste-now",
        text: expect.stringContaining("State the failing behavior"),
      }),
    );
    expect(replayed.lastActionMessage).toBe("Replayed combo.");
  });
});
