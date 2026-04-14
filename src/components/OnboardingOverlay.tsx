import { useState } from "react";
import { Target, Flame, Zap, ChevronRight, ChevronLeft, X } from "lucide-react";
import { type AppSettings } from "../domain/models";

type OnboardingOverlayProps = {
  open: boolean;
  onClose: () => void;
  onDismiss: () => void;
  settings: AppSettings;
};

type Step = {
  title: string;
  content: React.ReactNode;
};

function KeyBadge({ text, variant }: { text: string; variant: "a" | "b" | "neutral" }) {
  const cls = variant === "a" ? "keycap-a" : variant === "b" ? "keycap-b" : "";
  return <span className={`keycap ${cls}`}>{text}</span>;
}

const steps: Step[] = [
  {
    title: "Welcome to SuperPaste",
    content: (
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-accent-a-dim)] border border-[var(--color-accent-a-border)] mb-3">
          <Zap size={20} className="text-[var(--color-accent-a)]" />
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
          Assemble prompts for your AI coding assistant like a fighting game combo system.
        </p>
      </div>
    ),
  },
  {
    title: "Two Banks",
    content: (
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border border-[var(--color-accent-a-border)] bg-[var(--color-accent-a-dim)] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={12} className="text-[var(--color-accent-a)]" />
            <span className="text-xs font-semibold text-[var(--color-accent-a)]">Bank A</span>
          </div>
          <p className="text-[0.65rem] text-[var(--color-text-muted)] m-0">
            Context: repo maps, error logs, acceptance criteria. Adapts per-repo.
          </p>
        </div>
        <div className="flex-1 rounded-lg border border-[var(--color-accent-b-border)] bg-[var(--color-accent-b-dim)] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Flame size={12} className="text-[var(--color-accent-b)]" />
            <span className="text-xs font-semibold text-[var(--color-accent-b)]">Bank B</span>
          </div>
          <p className="text-[0.65rem] text-[var(--color-text-muted)] m-0">
            Workflow: "patch only", "write tests first". Carries across repos.
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "Paste Slots",
    content: (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex items-center gap-2">
          <KeyBadge text="Ctrl" variant="a" />
          <span className="text-sm">+</span>
          <KeyBadge text="1..0" variant="a" />
          <span className="text-xs text-[var(--color-text-muted)] ml-2">Bank A</span>
        </div>
        <div className="flex items-center gap-2">
          <KeyBadge text="Ctrl+Alt" variant="b" />
          <span className="text-sm">+</span>
          <KeyBadge text="1..0" variant="b" />
          <span className="text-xs text-[var(--color-text-muted)] ml-2">Bank B</span>
        </div>
        <p className="text-[0.65rem] text-[var(--color-text-faint)] m-0 text-center mt-1">
          Swaps clipboard, pastes, restores. Numpad mirrors slots.
        </p>
      </div>
    ),
  },
  {
    title: "Save to Slots",
    content: (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex items-center gap-2">
          <KeyBadge text="Ctrl+Shift" variant="a" />
          <span className="text-sm">+</span>
          <KeyBadge text="1..0" variant="a" />
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] m-0 text-center">
          Highlight text, then press to bank it. SuperPaste copies for you.
        </p>
      </div>
    ),
  },
  {
    title: "Build Combos",
    content: (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center gap-1.5 py-2">
          <span className="badge badge-accent-a text-[0.6rem]">A1</span>
          <ChevronRight size={10} className="text-[var(--color-text-faint)]" />
          <span className="badge badge-accent-b text-[0.6rem]">B1</span>
          <ChevronRight size={10} className="text-[var(--color-text-faint)]" />
          <span className="badge badge-accent-a text-[0.6rem]">A3</span>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] m-0 text-center">
          Click slots to queue them, then paste the whole packet.
        </p>
        <p className="text-[0.65rem] text-[var(--color-text-faint)] m-0 text-center">
          Press <KeyBadge text="Alt+Enter" variant="neutral" /> to fire.
        </p>
      </div>
    ),
  },
  {
    title: "Ready!",
    content: (
      <div className="text-center py-3">
        <p className="text-sm text-[var(--color-text-secondary)] m-0 mb-2">
          Start by saving context to Bank A, then fire workflow moves from Bank B.
        </p>
        <p className="text-[0.65rem] text-[var(--color-text-faint)] m-0">
          Press <KeyBadge text="F1" variant="neutral" /> anytime for the hotkey reference.
        </p>
      </div>
    ),
  },
];

export function OnboardingOverlay({ open, onClose, onDismiss }: OnboardingOverlayProps) {
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
        {/* Progress */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-200 ${
                  i <= currentStep
                    ? "w-5 bg-[var(--color-accent-a)]"
                    : "w-2 bg-[var(--color-border)]"
                }`}
              />
            ))}
          </div>
          <button
            className="btn btn-xs btn-ghost btn-icon"
            onClick={onClose}
            type="button"
            aria-label="Skip"
          >
            <X size={12} />
          </button>
        </div>

        {/* Content */}
        <h2 className="text-base font-semibold m-0 mb-2 text-center">{step.title}</h2>
        <div className="onboarding-illustration">{step.content}</div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <button
            className={`btn btn-xs btn-ghost ${isFirst ? "invisible" : ""}`}
            onClick={handleBack}
            type="button"
          >
            <ChevronLeft size={12} />
            Back
          </button>

          <span className="text-[0.65rem] text-[var(--color-text-faint)]">
            {currentStep + 1} / {steps.length}
          </span>

          <button className="btn btn-xs btn-primary" onClick={handleNext} type="button">
            {isLast ? "Get started" : "Next"}
            {!isLast && <ChevronRight size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}
