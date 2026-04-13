import { useMemo, useState } from "react";
import { createDefaultHotkeys } from "../domain/hotkeys";
import { FlaskConical, RotateCcw, Trash2 } from "lucide-react";

const samplePayload = [
  "# SuperPaste harness",
  "",
  "- Focus this textarea.",
  "- Fire slot hotkeys here.",
  "- Confirm clipboard restore after each paste.",
].join("\n");

export function TestHarnessWindow() {
  const [text, setText] = useState(samplePayload);
  const hotkeys = useMemo(() => createDefaultHotkeys(), []);

  return (
    <main className="test-harness-shell">
      <header className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-warning-dim)]">
              <FlaskConical size={15} className="text-[var(--color-warning)]" />
            </div>
            <div>
              <p className="section-label !text-[var(--color-warning)]">Manual smoke target</p>
              <h1 className="text-lg font-bold m-0">Test Harness</h1>
            </div>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] ml-[42px]">
            Keep this textarea focused, then validate direct paste, save-to-slot, and clipboard restore.
          </p>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={() => setText(samplePayload)} type="button">
            <RotateCcw size={13} />
            Seed sample
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setText("")} type="button">
            <Trash2 size={13} />
            Clear
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-[1.2fr_0.8fr]">
        <article className="card">
          <h2 className="text-sm font-semibold m-0 mb-2">Focus target</h2>
          <textarea
            aria-label="Test harness input"
            autoFocus
            className="font-mono text-sm"
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            style={{ minHeight: "320px" }}
            value={text}
          />
        </article>

        <article className="card">
          <h2 className="text-sm font-semibold m-0 mb-3">What to verify</h2>
          <ol className="m-0 pl-5 flex flex-col gap-2.5 text-[var(--color-text-secondary)] text-sm">
            <li>Paste Bank A with <code className="keycap text-[0.7rem] mx-0.5">{hotkeys.bankAPaste[0]}</code> through <code className="keycap text-[0.7rem] mx-0.5">{hotkeys.bankAPaste[9]}</code>.</li>
            <li>Paste Bank B with <code className="keycap text-[0.7rem] mx-0.5">{hotkeys.bankBPaste[0]}</code> through <code className="keycap text-[0.7rem] mx-0.5">{hotkeys.bankBPaste[9]}</code>.</li>
            <li>Highlight text, then save it into slots with the Shift variants and confirm persistence in the editor.</li>
            <li>Trigger rapid repeats and confirm pasted text stays ordered with clipboard restore.</li>
            <li>Toggle pause mode and confirm slot hotkeys no longer fire until resumed.</li>
          </ol>
        </article>
      </section>
    </main>
  );
}
