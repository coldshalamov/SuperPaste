import { describe, expect, it, vi } from "vitest";
import { ClipboardRestorePasteEngine } from "../clipboard-restore-paste-engine";

describe("ClipboardRestorePasteEngine", () => {
  it("restores the original clipboard after a successful paste", async () => {
    const writes: string[] = [];
    let clipboardText = "original clipboard";
    const engine = new ClipboardRestorePasteEngine(
      {
        readText: vi.fn().mockImplementation(async () => clipboardText),
        writeText: vi.fn().mockImplementation(async (text: string) => {
          clipboardText = text;
          writes.push(text);
        }),
      },
      {
        pasteCurrentClipboard: vi.fn().mockResolvedValue(undefined),
      },
    );

    const result = await engine.execute({
      text: "combo payload",
      executionMode: "paste-now",
      restoreClipboard: true,
    });

    expect(result.ok).toBe(true);
    expect(writes).toEqual(["combo payload", "original clipboard"]);
    expect(clipboardText).toBe("original clipboard");
  });

  it("restores the original clipboard even when paste fails", async () => {
    const writes: string[] = [];
    let clipboardText = "original clipboard";
    const engine = new ClipboardRestorePasteEngine(
      {
        readText: vi.fn().mockImplementation(async () => clipboardText),
        writeText: vi.fn().mockImplementation(async (text: string) => {
          clipboardText = text;
          writes.push(text);
        }),
      },
      {
        pasteCurrentClipboard: vi.fn().mockRejectedValue(new Error("sendinput failed")),
      },
    );

    const result = await engine.execute({
      text: "combo payload",
      executionMode: "paste-now",
      restoreClipboard: true,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/sendinput failed/i);
    expect(writes).toEqual(["combo payload", "original clipboard"]);
    expect(clipboardText).toBe("original clipboard");
  });

  it("serializes concurrent paste requests so clipboard transactions do not overlap", async () => {
    const writes: string[] = [];
    let clipboardText = "seed";
    let releaseFirstPaste!: () => void;
    const firstPaste = new Promise<void>((resolve) => {
      releaseFirstPaste = resolve;
    });
    const pasteCurrentClipboard = vi
      .fn()
      .mockImplementationOnce(async () => {
        await firstPaste;
      })
      .mockResolvedValueOnce(undefined);
    const engine = new ClipboardRestorePasteEngine(
      {
        readText: vi.fn().mockImplementation(async () => clipboardText),
        writeText: vi.fn().mockImplementation(async (text: string) => {
          clipboardText = text;
          writes.push(text);
        }),
      },
      {
        pasteCurrentClipboard,
      },
    );

    const first = engine.execute({
      text: "first payload",
      executionMode: "paste-now",
      restoreClipboard: true,
    });
    const second = engine.execute({
      text: "second payload",
      executionMode: "paste-now",
      restoreClipboard: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(writes).toEqual(["first payload"]);

    releaseFirstPaste();

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    expect(writes).toEqual(["first payload", "seed", "second payload", "seed"]);
    expect(clipboardText).toBe("seed");
  });
});
