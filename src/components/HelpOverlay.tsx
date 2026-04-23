import { useState } from "react";
import { Modal } from "./Modal";
import { Target, Flame, Keyboard, Lightbulb } from "lucide-react";
import { type AppSettings } from "../domain/models";

type HelpOverlayProps = {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
};

type TabId = "hotkeys" | "tips";

function KeyBadge({ text, variant }: { text: string; variant: "a" | "b" | "neutral" }) {
  const cls = variant === "a" ? "keycap-a" : variant === "b" ? "keycap-b" : "";
  return <span className={`keycap ${cls}`}>{text}</span>;
}

function HotkeyRow({
  keys,
  action,
  variant = "neutral",
}: {
  keys: string;
  action: string;
  variant?: "a" | "b" | "neutral";
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex gap-1 shrink-0">
        {keys.split(/\s*\+\s*/).map((part, i) => (
          <KeyBadge key={i} text={part.trim()} variant={variant} />
        ))}
      </div>
      <span className="text-xs text-[var(--color-text-secondary)]">{action}</span>
    </div>
  );
}

function compactSlotRange(bindings: string[]) {
  const first = bindings[0] ?? "";
  if (first.endsWith("Numpad1")) return first.replace(/Numpad1$/, "Numpad1..0");
  if (first.endsWith("1")) return first.replace(/1$/, "1..0");
  return first || "Unbound";
}

function HotkeysTab({ settings }: { settings: AppSettings }) {
  const captureAction = settings.experimental.autoQueueCaptures
    ? "Capture slot and queue it"
    : "Capture slot";

  return (
    <div className="flex flex-col gap-4">
      {/* Bank A */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Target size={12} className="text-[var(--color-accent-a)]" />
          <span className="text-xs font-semibold text-[var(--color-accent-a)]">
            Bank A - Context
          </span>
        </div>
        <div className="pl-4 border-l border-[var(--color-accent-a-border)]">
          <HotkeyRow keys={compactSlotRange(settings.hotkeys.bankAPaste)} action="Paste slot" variant="a" />
          <HotkeyRow keys={compactSlotRange(settings.hotkeys.bankASaveClipboard)} action={captureAction} variant="a" />
        </div>
      </div>

      {/* Bank B */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Flame size={12} className="text-[var(--color-accent-b)]" />
          <span className="text-xs font-semibold text-[var(--color-accent-b)]">
            Bank B - Workflow
          </span>
        </div>
        <div className="pl-4 border-l border-[var(--color-accent-b-border)]">
          <HotkeyRow keys={compactSlotRange(settings.hotkeys.bankBPaste)} action="Paste slot" variant="b" />
          <HotkeyRow
            keys={compactSlotRange(settings.hotkeys.bankBSaveClipboard)}
            action={captureAction}
            variant="b"
          />
        </div>
      </div>

      {/* General */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Keyboard size={12} className="text-[var(--color-text-muted)]" />
          <span className="text-xs font-semibold">General</span>
        </div>
        <div className="pl-4 border-l border-[var(--color-border)]">
          <HotkeyRow keys={settings.hotkeys.finalizeCombo} action="Paste combo" />
          <HotkeyRow keys={settings.hotkeys.cancelCombo} action="Clear queue" />
          <HotkeyRow keys={settings.hotkeys.replayLastCombo} action="Replay last combo" />
          <HotkeyRow keys={settings.hotkeys.toggleWindow} action="Toggle window" />
          <HotkeyRow keys={settings.hotkeys.panicToggle} action="Pause hotkeys" />
          <HotkeyRow keys="F1" action="This help" />
        </div>
      </div>

      <p className="text-[0.65rem] text-[var(--color-text-faint)] mt-2">
        Numpad mirrors number row slots. Customize in Editor &gt; Hotkeys.
      </p>
    </div>
  );
}

function TipsTab() {
  const tips = [
    {
      title: "Save fast",
      text: "Highlight text, press Ctrl+Shift+1..0 to bank it. SuperPaste copies for you.",
    },
    {
      title: "Clipboard preserved",
      text: "Slot paste swaps clipboard, fires Ctrl+V, then restores your original content.",
    },
    {
      title: "Stances",
      text: 'Latch Bank B slots as "stances" to auto-include them in every combo.',
    },
    {
      title: "Profile auto-switch",
      text: "Profiles switch based on active window and workspace. Bank A adapts per-repo.",
    },
    {
      title: "Replay",
      text: "Alt+/ re-fires the last finalized combo for iterative refinement.",
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {tips.map((tip, i) => (
        <div
          key={i}
          className="p-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)]"
        >
          <p className="text-xs font-medium m-0 mb-0.5">{tip.title}</p>
          <p className="text-[0.7rem] text-[var(--color-text-muted)] m-0 leading-relaxed">
            {tip.text}
          </p>
        </div>
      ))}
    </div>
  );
}

export function HelpOverlay({ open, onClose, settings }: HelpOverlayProps) {
  const [activeTab, setActiveTab] = useState<TabId>("hotkeys");

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "hotkeys", label: "Hotkeys", icon: <Keyboard size={12} /> },
    { id: "tips", label: "Tips", icon: <Lightbulb size={12} /> },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Help" width="max-w-sm">
      <div className="flex gap-1 mb-3 pb-2 border-b border-[var(--color-border-subtle)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`btn btn-xs ${activeTab === tab.id ? "btn-accent-a" : "btn-ghost"}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "hotkeys" && <HotkeysTab settings={settings} />}
      {activeTab === "tips" && <TipsTab />}
    </Modal>
  );
}
