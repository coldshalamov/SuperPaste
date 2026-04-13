import { ClipboardGateway, PasteEngine, PastePlan, PasteResult } from "./contracts";

export interface ClipboardPasteTransport {
  pasteCurrentClipboard(): Promise<void>;
}

export class ClipboardRestorePasteEngine implements PasteEngine {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly clipboard: ClipboardGateway,
    private readonly transport: ClipboardPasteTransport,
  ) {}

  async execute(plan: PastePlan): Promise<PasteResult> {
    return this.serialize(async () => {
      if (plan.executionMode === "queue-only") {
        return {
          ok: true,
          message: "Combo assembled and queued only.",
        };
      }

      if (plan.executionMode === "copy-only") {
        await this.clipboard.writeText(plan.text);
        return {
          ok: true,
          message: "Combo copied to clipboard.",
          copiedText: plan.text,
        };
      }

      let originalClipboard = "";
      let clipboardCaptured = false;

      try {
        if (plan.restoreClipboard) {
          originalClipboard = await this.clipboard.readText();
          clipboardCaptured = true;
        }

        await this.clipboard.writeText(plan.text);
        await this.transport.pasteCurrentClipboard();

        return {
          ok: true,
          message: "Pasted combo.",
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Paste failed.",
        };
      } finally {
        if (plan.restoreClipboard && clipboardCaptured) {
          await this.clipboard.writeText(originalClipboard);
        }
      }
    });
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
