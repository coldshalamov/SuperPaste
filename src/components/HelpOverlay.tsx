import { useState } from "react";
import { Modal } from "./Modal";
import {
  Target,
  Flame,
  Zap,
  Copy,
  ClipboardPaste,
  Pin,
  RotateCcw,
  Save,
  Eye,
  MonitorUp,
  Pause,
  Keyboard,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import { type AppSettings } from "../domain/models";

type HelpOverlayProps = {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
};

type HotkeySection = {
  id: string;
  label: string;
  icon: React.ReactNode;
  accent: "a" | "b" | "neutral";
  rows: Array<{
    keys: string;
    action: string;
    detail?: string;
  }>;
};

const sections: HotkeySection[] = [
  {
    id: "bank-a",
    label: "Bank A - Context",
    icon: <Target size={14} />,
    accent: "a",
    rows: [
      {
        keys: "Ctrl + 1..0",
        action: "Paste slot",
        detail: "Fire context directly into the focused app. Numpad mirrors the same slots.",
      },
      {
        keys: "Ctrl + Shift + 1..0",
        action: "Save clipboard to slot",
        detail: "Highlight text, then bank it. SuperPaste triggers Ctrl+C first. Numpad mirrors the same slots.",
      },
    ],
  },
  {
    id: "bank-b",
    label: "Bank B - Workflow",
    icon: <Flame size={14} />,
    accent: "b",
      rows: [
      {
        keys: "Ctrl+Alt + 1..0",
        action: "Paste slot",
        detail: "Fire a workflow move into the focused app. Numpad mirrors the same slots.",
      },
      {
        keys: "Ctrl+Alt+Shift + 1..0",
        action: "Save clipboard to slot",
        detail: "Highlight text, then bank it. SuperPaste triggers Ctrl+C first. Numpad mirrors the same slots.",
      },
    ],
  },
  {
    id: "combos",
    label: "Combo & Queue",
    icon: <Zap size={14} />,
    accent: "neutral",
    rows: [
      {
        keys: "Alt + Enter",
        action: "Paste combo",
        detail: "Queue slots in the HUD, then fire the whole packet",
      },
      {
        keys: "Alt + Backspace",
        action: "Clear queue",
        detail: "Empty the combo buffer",
      },
      {
        keys: "Alt + /",
        action: "Replay last combo",
        detail: "Re-fire the last finalized combo",
      },
    ],
  },
  {
    id: "general",
    label: "Window & Controls",
    icon: <MonitorUp size={14} />,
    accent: "neutral",
    rows: [
      {
        keys: "Alt + `",
        action: "Toggle dock window",
        detail: "Show or hide the SuperPaste window",
      },
      {
        keys: "Alt + Pause",
        action: "Pause / Resume hotkeys",
        detail: "Suspend all global hotkeys temporarily",
      },
      {
        keys: "F1",
        action: "Open this help",
        detail: "Keyboard shortcut reference",
      },
    ],
  },
];

type TabId = "hotkeys" | "concepts" | "tips";

function KeyBadge({ text, variant }: { text: string; variant: "a" | "b" | "neutral" }) {
  const cls =
    variant === "a"
      ? "keycap-a"
      : variant === "b"
        ? "keycap-b"
        : "";

  return <span className={`keycap text-xs ${cls}`}>{text}</span>;
}

function HotkeySectionCard({ section }: { section: HotkeySection }) {
  const borderColor =
    section.accent === "a"
      ? "border-[var(--color-accent-a-border)]"
      : section.accent === "b"
        ? "border-[var(--color-accent-b-border)]"
        : "border-[var(--color-border)]";

  const iconColor =
    section.accent === "a"
      ? "text-[var(--color-accent-a)]"
      : section.accent === "b"
        ? "text-[var(--color-accent-b)]"
        : "text-[var(--color-text-muted)]";

  const iconBg =
    section.accent === "a"
      ? "bg-[var(--color-accent-a-dim)]"
      : section.accent === "b"
        ? "bg-[var(--color-accent-b-dim)]"
        : "bg-[var(--color-bg-surface)]";

  return (
    <div className={`rounded-[var(--radius-md)] border p-3 ${borderColor} bg-[var(--color-bg-elevated)]`}>
      <div className="flex items-center gap-2 mb-2.5">
        <div className={`flex items-center justify-center w-6 h-6 rounded-md ${iconBg}`}>
          <span className={iconColor}>{section.icon}</span>
        </div>
        <h3 className="text-sm font-semibold m-0">{section.label}</h3>
      </div>
      <div className="flex flex-col gap-2">
        {section.rows.map((row, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex gap-1 shrink-0 pt-0.5">
              {row.keys.split(" + ").map((part, j) => (
                <KeyBadge key={j} text={part.trim()} variant={section.accent} />
              ))}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium m-0 leading-tight">{row.action}</p>
              {row.detail ? (
                <p className="text-xs text-[var(--color-text-muted)] m-0 mt-0.5">{row.detail}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConceptsTab() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--radius-md)] border border-[var(--color-accent-a-border)] bg-[var(--color-accent-a-dim)] p-4">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Target size={14} className="text-[var(--color-accent-a)]" />
          Bank A is Context
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
          Repo maps, failing commands, touched files, logs, acceptance criteria. This bank is
          meant to be <strong>repo-specific</strong>. Each workspace profile can override its own Bank A.
        </p>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-accent-b-border)] bg-[var(--color-accent-b-dim)] p-4">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Flame size={14} className="text-[var(--color-accent-b)]" />
          Bank B is Workflow
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
          "Patch only", "Write tests first", "Summarize before edit". Stable workflow moves
          you want across repos. Bank B inherits from the global workflow profile by default.
        </p>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Zap size={14} className="text-[var(--color-accent-a)]" />
          Combos
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
          Queue slots from either bank, add supers, then paste the whole assembled packet
          into your coding agent. Latched stances automatically join every combo.
        </p>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-warning-border)] bg-[var(--color-warning-dim)] p-4">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Pin size={14} className="text-[var(--color-warning)]" />
          Stances
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
          Certain Bank B slots are good always-on rules. Latch them as stances and they
          auto-include in every future combo until you unlatch them.
        </p>
      </div>
    </div>
  );
}

function TipsTab() {
  const tips = [
    {
      icon: <Save size={14} />,
      text: (
        <>
          <strong>Save fast:</strong> Highlight text, then press{" "}
          <KeyBadge text="Ctrl+Shift" variant="a" /> <KeyBadge text="1..0" variant="a" /> to bank it.
          SuperPaste sends Ctrl+C for you, and the numpad mirrors the same slots if that is more comfortable.
        </>
      ),
    },
    {
      icon: <Eye size={14} />,
      text: (
        <>
          <strong>Clipboard is safe:</strong> When you fire a slot, SuperPaste swaps the clipboard,
          synthesizes Ctrl+V, then restores your original clipboard content automatically.
        </>
      ),
    },
    {
      icon: <Copy size={14} />,
      text: (
        <>
          <strong>Copy vs Paste:</strong> "Copy" in the combo HUD copies the assembled combo to your
          clipboard without pasting. Use it when you want to paste manually or into a different app.
        </>
      ),
    },
    {
      icon: <Pause size={14} />,
      text: (
        <>
          <strong>Pause hotkeys:</strong> If SuperPaste hotkeys conflict with another app, hit the
          Pause button or <KeyBadge text="Alt+Pause" variant="neutral" /> to suspend all global hotkeys.
        </>
      ),
    },
    {
      icon: <ClipboardPaste size={14} />,
      text: (
        <>
          <strong>Profile switching:</strong> SuperPaste auto-switches profiles based on your active
          window and workspace path. Bank A adapts per-repo; Bank B inherits from your global workflow profile.
        </>
      ),
    },
    {
      icon: <RotateCcw size={14} />,
      text: (
        <>
          <strong>Replay combos:</strong> Hit <KeyBadge text="Alt+/" variant="neutral" /> to re-fire the
          last finalized combo. Great for iterative prompt refinement.
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {tips.map((tip, i) => (
        <div key={i} className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[var(--color-bg-surface)] shrink-0 mt-0.5">
            <span className="text-[var(--color-text-muted)]">{tip.icon}</span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
            {tip.text}
          </p>
        </div>
      ))}
    </div>
  );
}

export function HelpOverlay({ open, onClose }: HelpOverlayProps) {
  const [activeTab, setActiveTab] = useState<TabId>("hotkeys");

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "hotkeys", label: "Hotkeys", icon: <Keyboard size={13} /> },
    { id: "concepts", label: "Concepts", icon: <BookOpen size={13} /> },
    { id: "tips", label: "Tips", icon: <Lightbulb size={13} /> },
  ];

  return (
    <Modal open={open} onClose={onClose} title="SuperPaste Help" width="max-w-xl">
      <div className="flex gap-1 mb-4 border-b border-[var(--color-border-subtle)] pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`btn btn-sm ${activeTab === tab.id ? "btn-accent-a" : "btn-ghost"}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "hotkeys" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[var(--color-text-muted)] m-0 -mt-1">
            These are the default hotkeys. You can customize them in the Editor under Runtime &amp; Hotkeys.
          </p>
          {sections.map((section) => (
            <HotkeySectionCard key={section.id} section={section} />
          ))}
        </div>
      )}

      {activeTab === "concepts" && <ConceptsTab />}

      {activeTab === "tips" && <TipsTab />}
    </Modal>
  );
}
