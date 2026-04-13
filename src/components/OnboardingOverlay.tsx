import { useState } from "react";
import {
  Target,
  Flame,
  Zap,
  ClipboardPaste,
  Pin,
  ChevronRight,
  ChevronLeft,
  X,
  Keyboard,
} from "lucide-react";
import { type AppSettings } from "../domain/models";

type OnboardingOverlayProps = {
  open: boolean;
  onClose: () => void;
  onDismiss: () => void;
  settings: AppSettings;
};

type Step = {
  title: string;
  body: React.ReactNode;
  illustration: React.ReactNode;
};

function KeyBadge({ text, variant }: { text: string; variant: "a" | "b" | "neutral" }) {
  const cls =
    variant === "a"
      ? "keycap-a"
      : variant === "b"
        ? "keycap-b"
        : "";

  return <span className={`keycap text-xs ${cls}`}>{text}</span>;
}

function BankIllustration() {
  return (
    <div className="flex gap-3 items-stretch">
      <div className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-accent-a-border)] bg-[var(--color-accent-a-dim)] p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <Target size={12} className="text-[var(--color-accent-a)]" />
          <span className="text-xs font-semibold text-[var(--color-accent-a)]">Bank A</span>
        </div>
        <span className="text-[0.65rem] text-[var(--color-text-muted)]">Context</span>
        <div className="flex flex-col gap-1 mt-1">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded px-2 py-1 bg-[rgba(91,142,255,0.08)] border border-[var(--color-accent-a-border)]">
              <span className="text-[0.6rem] text-[var(--color-accent-a)] font-mono">A{n}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-accent-b-border)] bg-[var(--color-accent-b-dim)] p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <Flame size={12} className="text-[var(--color-accent-b)]" />
          <span className="text-xs font-semibold text-[var(--color-accent-b)]">Bank B</span>
        </div>
        <span className="text-[0.65rem] text-[var(--color-text-muted)]">Workflow</span>
        <div className="flex flex-col gap-1 mt-1">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded px-2 py-1 bg-[rgba(52,211,153,0.08)] border border-[var(--color-accent-b-border)]">
              <span className="text-[0.6rem] text-[var(--color-accent-b)] font-mono">B{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComboIllustration() {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Zap size={12} className="text-[var(--color-accent-a)]" />
        <span className="text-xs font-semibold">Combo Queue</span>
      </div>
      <div className="flex gap-1.5">
        <span className="badge badge-accent-a text-[0.6rem]">A1 repo map</span>
        <ChevronRight size={10} className="text-[var(--color-text-faint)] self-center" />
        <span className="badge badge-accent-b text-[0.6rem]">B1 summarize</span>
        <ChevronRight size={10} className="text-[var(--color-text-faint)] self-center" />
        <span className="badge badge-accent-a text-[0.6rem]">A3 bug trail</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <Pin size={10} className="text-[var(--color-warning)]" />
        <span className="badge badge-warning text-[0.6rem]">Stance: Patch only</span>
      </div>
      <div className="text-center text-[0.6rem] text-[var(--color-text-muted)] mt-1">
        <ClipboardPaste size={10} className="inline mr-1" />
        Alt + Enter fires the whole packet
      </div>
    </div>
  );
}

function useSteps(): Step[] {
  return [
    {
      title: "Welcome to SuperPaste",
      illustration: (
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-accent-a-dim)] border border-[var(--color-accent-a-border)] mb-3">
            <Zap size={28} className="text-[var(--color-accent-a)]" />
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] m-0 max-w-xs mx-auto leading-relaxed">
            Assemble coding-agent prompts like a fighting-game combo system.
            Two banks. Quick slots. One packet.
          </p>
        </div>
      ),
      body: (
        <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
          SuperPaste lets you store repo context and workflow moves in organized banks,
          then fire them individually or assemble them into combos for your coding agent.
          Everything stays local on your machine.
        </p>
      ),
    },
    {
      title: "Two banks: Context and Workflow",
      illustration: <BankIllustration />,
      body: (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
            <strong className="text-[var(--color-accent-a)]">Bank A</strong> holds repo-specific
            context: file maps, error logs, bug repros, acceptance criteria.
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
            <strong className="text-[var(--color-accent-b)]">Bank B</strong> holds stable workflow
            moves: "Patch only", "Write tests first", "Do not widen auth gates".
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
            Bank A adapts per repo. Bank B carries across repos.
          </p>
        </div>
      ),
    },
    {
      title: "Paste from slots",
      illustration: (
        <div className="flex flex-col gap-2 items-center py-3">
          <div className="flex items-center gap-2">
            <KeyBadge text="Ctrl" variant="a" />
            <span className="text-lg text-[var(--color-text-muted)]">+</span>
            <KeyBadge text="1..0" variant="a" />
          </div>
          <span className="text-xs text-[var(--color-accent-a)]">Bank A slots</span>
          <div className="flex items-center gap-2 mt-2">
            <KeyBadge text="Ctrl+Alt" variant="b" />
            <span className="text-lg text-[var(--color-text-muted)]">+</span>
            <KeyBadge text="1..0" variant="b" />
          </div>
          <span className="text-xs text-[var(--color-accent-b)]">Bank B slots</span>
          <p className="text-xs text-[var(--color-text-muted)] mt-2 m-0 max-w-[220px]">
            Swaps clipboard, synthesizes Ctrl+V, restores your original clipboard
          </p>
        </div>
      ),
      body: (
        <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
          Press <KeyBadge text="Ctrl+1..0" variant="a" /> to paste a
          Bank A slot directly into whatever app is focused. Press{" "}
          <KeyBadge text="Ctrl+Alt" variant="b" /> + <KeyBadge text="#" variant="b" /> for Bank B.
          The numpad mirrors the same slots, and your existing clipboard is preserved and restored automatically.
        </p>
      ),
    },
    {
      title: "Save clipboard to slots",
      illustration: (
        <div className="flex flex-col gap-2 items-center py-3">
          <div className="flex items-center gap-1.5">
            <KeyBadge text="Ctrl+Shift" variant="a" />
            <span className="text-lg text-[var(--color-text-muted)]">+</span>
            <KeyBadge text="1..0" variant="a" />
          </div>
          <span className="text-xs text-[var(--color-text-muted)] mt-1">Highlight, then bank it</span>
          <div className="mt-3 flex items-center gap-1.5 opacity-50">
            <KeyBadge text="Ctrl+Alt+Shift" variant="b" />
            <span className="text-lg text-[var(--color-text-muted)]">+</span>
            <KeyBadge text="#" variant="b" />
          </div>
          <span className="text-xs text-[var(--color-text-muted)] mt-1">For Bank B slots</span>
        </div>
      ),
      body: (
        <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
          Highlight text in the focused app, then press{" "}
          <KeyBadge text="Ctrl+Shift+1..0" variant="a" /> to save
          it into a Bank A slot. SuperPaste triggers the copy for you, the numpad mirrors the same slots, and you can still
          edit slots directly in the Editor view.
        </p>
      ),
    },
    {
      title: "Build combos",
      illustration: <ComboIllustration />,
      body: (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
            Queue slots from either bank using the Queue button on each tile.
            Add supers for multi-step recipes. Then hit the Paste button or{" "}
            <KeyBadge text="Alt+Enter" variant="neutral" /> to fire the whole packet.
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
            Latched stances (the Pin icon on Bank B slots) auto-include in every combo
            until you unlatch them.
          </p>
        </div>
      ),
    },
    {
      title: "You're ready",
      illustration: (
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-accent-b-dim)] border border-[var(--color-accent-b-border)] mb-3">
            <Keyboard size={28} className="text-[var(--color-accent-b)]" />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] m-0">
            Press F1 anytime to reopen this reference
          </p>
        </div>
      ),
      body: (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
            Start by saving some repo context into Bank A, then fire workflow moves
            from Bank B. Queue them into combos when you need to send a full packet.
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
            Hit <KeyBadge text="F1" variant="neutral" /> anytime to reopen the hotkey reference,
            or click the help button in the header.
          </p>
        </div>
      ),
    },
  ];
}

export function OnboardingOverlay({ open, onClose, onDismiss }: OnboardingOverlayProps) {
  const steps = useSteps();
  const [currentStep, setCurrentStep] = useState(0);
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  if (!open) return null;

  function handleNext() {
    if (isLast) {
      onDismiss();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (!isFirst) {
      setCurrentStep((s) => s - 1);
    }
  }

  const step = steps[currentStep];

  return (
    <div className="onboarding-backdrop animate-fade-in">
      <div className="onboarding-card animate-scale-in">
        <div className="flex items-center justify-between mb-1">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i <= currentStep
                    ? "w-6 bg-[var(--color-accent-a)]"
                    : "w-3 bg-[var(--color-border)]"
                }`}
              />
            ))}
          </div>
          <button
            className="btn btn-sm btn-ghost btn-icon"
            onClick={onClose}
            type="button"
            aria-label="Skip onboarding"
          >
            <X size={14} />
          </button>
        </div>

        <div className="onboarding-illustration">
          {step.illustration}
        </div>

        <h2 className="text-lg font-semibold m-0 mb-2">{step.title}</h2>
        {step.body}

        <div className="flex items-center justify-between mt-5">
          <button
            className={`btn btn-sm btn-ghost ${isFirst ? "invisible" : ""}`}
            onClick={handleBack}
            type="button"
            disabled={isFirst}
          >
            <ChevronLeft size={13} />
            Back
          </button>

          <span className="text-xs text-[var(--color-text-faint)]">
            {currentStep + 1} / {steps.length}
          </span>

          <button
            className="btn btn-sm btn-accent-a"
            onClick={handleNext}
            type="button"
          >
            {isLast ? "Get started" : "Next"}
            {!isLast ? <ChevronRight size={13} /> : null}
          </button>
        </div>
      </div>
    </div>
  );
}
