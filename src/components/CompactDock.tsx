import {
  ComboBufferState,
  SlotBank,
  SlotDefinition,
  SlotReference,
  SuperRecipe,
  getSlotHotkeyDigit,
} from "../domain/models";
import {
  Zap,
  Copy,
  ClipboardPaste,
  Trash2,
  RotateCcw,
  X,
  Target,
  Flame,
  Eye,
  ChevronRight,
  Pin,
  Pencil,
  ListPlus,
} from "lucide-react";

type CompactDockProps = {
  bankA: SlotBank;
  bankB: SlotBank;
  supers: SuperRecipe[];
  activeBuffer: ComboBufferState;
  finalizedPreview: string;
  activeProfileName: string;
  profileReason: string;
  isPasteReady: boolean;
  isHotkeysPaused: boolean;
  hasHotkeyWarnings: boolean;
  onPasteSlot: (slotRef: SlotReference) => void;
  onEditSlot: (slotRef: SlotReference) => void;
  onQueueSlot: (slotRef: SlotReference) => void;
  onToggleStance: (slotRef: SlotReference) => void;
  onQueueSuper: (superId: string) => void;
  onCopyCombo: () => void;
  onPasteCombo: () => void;
  onCancelCombo: () => void;
  onRemoveLast: () => void;
  onReplayLast: () => void;
};

function slotPreview(slot: SlotDefinition) {
  if (!slot.content.trim()) return "Empty";
  return slot.content.trim().replace(/\s+/g, " ").slice(0, 72);
}

function queueLabel(
  entry: ComboBufferState["queuedEntries"][number],
  bankA: SlotBank,
  bankB: SlotBank,
  supers: SuperRecipe[],
) {
  if (entry.type === "super") {
    return supers.find((recipe) => recipe.id === entry.superId)?.name ?? `Super:${entry.superId}`;
  }
  if (!entry.slotRef) return "Slot";
  const ref = entry.slotRef;
  const bank = ref.bankId === "A" ? bankA : bankB;
  const slot = bank.slots.find((c) => c.slotIndex === ref.slotIndex);
  return slot?.label || `${ref.bankId}${getSlotHotkeyDigit(ref.slotIndex)}`;
}

function SlotTile({
  slot,
  bankId,
  activeBuffer,
  onPasteSlot,
  onEditSlot,
  onQueueSlot,
  onToggleStance,
}: {
  slot: SlotDefinition;
  bankId: "A" | "B";
  activeBuffer: ComboBufferState;
  onPasteSlot: (slotRef: SlotReference) => void;
  onEditSlot: (slotRef: SlotReference) => void;
  onQueueSlot: (slotRef: SlotReference) => void;
  onToggleStance: (slotRef: SlotReference) => void;
}) {
  const slotRef = { bankId: slot.bankId, slotIndex: slot.slotIndex } as const;
  const isStance = activeBuffer.activeStances.some(
    (s) => s.bankId === slot.bankId && s.slotIndex === slot.slotIndex,
  );
  const isBankA = bankId === "A";
  const isEmpty = !slot.enabled;

  return (
    <div
      className={`
        group relative flex flex-col gap-2 rounded-[var(--radius-lg)] p-3
        border transition-all duration-200 cursor-default
        ${isEmpty ? "opacity-50" : ""}
        ${isBankA
          ? "border-[var(--color-accent-a-border)] bg-[var(--color-accent-a-dim)] hover:bg-[rgba(91,142,255,0.08)]"
          : "border-[var(--color-accent-b-border)] bg-[var(--color-accent-b-dim)] hover:bg-[rgba(52,211,153,0.08)]"
        }
        ${isStance
          ? isBankA
            ? "shadow-[inset_0_0_0_1px_rgba(91,142,255,0.4),0_0_16px_rgba(91,142,255,0.1)]"
            : "shadow-[inset_0_0_0_1px_rgba(52,211,153,0.4),0_0_16px_rgba(52,211,153,0.1)]"
          : ""
        }
      `}
      style={{ minHeight: "120px" }}
    >
      <button
        aria-label={`Paste slot ${slot.bankId}${getSlotHotkeyDigit(slot.slotIndex)}`}
        className="flex flex-1 flex-col items-start gap-1.5 bg-transparent border-0 p-0 text-left cursor-pointer hover:bg-transparent"
        disabled={!slot.enabled}
        onClick={() => onPasteSlot(slotRef)}
        type="button"
      >
        <div className="flex w-full items-center justify-between gap-2">
          <span className={`keycap text-xs ${isBankA ? "keycap-a" : "keycap-b"}`}>
            {slot.bankId}{getSlotHotkeyDigit(slot.slotIndex)}
          </span>
          <span className={`badge text-[0.65rem] py-0 px-1.5 ${isBankA ? "badge-accent-a" : "badge-accent-b"}`}>
            {slot.kind}
          </span>
        </div>
        <strong className="text-sm font-medium leading-tight text-[var(--color-text)]">
          {slot.label || "Empty slot"}
        </strong>
        <span className="text-xs leading-relaxed text-[var(--color-text-muted)] line-clamp-2">
          {slotPreview(slot)}
        </span>
      </button>

      <div className="grid grid-cols-3 gap-1.5 mt-auto">
        <button
          className={`btn btn-sm ${isBankA ? "btn-accent-a" : "btn-accent-b"}`}
          onClick={() => onQueueSlot(slotRef)}
          type="button"
          title="Queue"
        >
          <ListPlus size={12} />
          <span className="hidden sm:inline">Queue</span>
        </button>
        {bankId === "B" ? (
          <button
            className={`btn btn-sm ${isStance ? "btn-warning" : "btn-ghost"}`}
            onClick={() => onToggleStance(slotRef)}
            type="button"
            title={isStance ? "Unlatch" : "Latch"}
          >
            <Pin size={12} className={isStance ? "rotate-45" : ""} />
            <span className="hidden sm:inline">{isStance ? "Unlatch" : "Latch"}</span>
          </button>
        ) : (
          <div />
        )}
        <button className="btn btn-sm btn-ghost" onClick={() => onEditSlot(slotRef)} type="button" title="Edit">
          <Pencil size={12} />
          <span className="hidden sm:inline">Edit</span>
        </button>
      </div>
    </div>
  );
}

function BankPanel({
  bank,
  bankId,
  inheritanceBadge,
  activeBuffer,
  onPasteSlot,
  onEditSlot,
  onQueueSlot,
  onToggleStance,
}: {
  bank: SlotBank;
  bankId: "A" | "B";
  inheritanceBadge?: string;
  activeBuffer: ComboBufferState;
  onPasteSlot: (slotRef: SlotReference) => void;
  onEditSlot: (slotRef: SlotReference) => void;
  onQueueSlot: (slotRef: SlotReference) => void;
  onToggleStance: (slotRef: SlotReference) => void;
}) {
  const isBankA = bankId === "A";
  const Icon = isBankA ? Target : Flame;

  return (
    <article className={`card ${isBankA ? "card-glow-a" : "card-glow-b"}`}>
      <header className="surface-header">
        <div className="flex items-center gap-2.5">
          <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${isBankA ? "bg-[var(--color-accent-a-dim)]" : "bg-[var(--color-accent-b-dim)]"}`}>
            <Icon size={14} className={isBankA ? "text-[var(--color-accent-a)]" : "text-[var(--color-accent-b)]"} />
          </div>
          <div>
            <p className={`section-label ${isBankA ? "!text-[var(--color-accent-a)]" : "!text-[var(--color-accent-b)]"}`}>
              {isBankA ? "Bank A - Context" : "Bank B - Workflow"}
            </p>
            <h2 className="!font-semibold">{bank.name}</h2>
          </div>
        </div>
        {inheritanceBadge ? (
          <span className={`badge text-xs ${isBankA ? "badge-accent-a" : "badge-accent-b"}`}>
            {inheritanceBadge}
          </span>
        ) : null}
        {isBankA ? (
          <span className="dock-hint">
            Ctrl+Shift+1..0 saves here. Numpad mirrors the same slots.
          </span>
        ) : (
          <span className="dock-hint">
            Ctrl+Alt+Shift+1..0 saves here. Numpad mirrors the same slots.
          </span>
        )}
      </header>
      <div className="grid grid-cols-5 gap-2 mt-3 bank-grid">
        {bank.slots.map((slot) => (
          <SlotTile
            activeBuffer={activeBuffer}
            bankId={bankId}
            key={`${slot.bankId}-${slot.slotIndex}`}
            onEditSlot={onEditSlot}
            onPasteSlot={onPasteSlot}
            onQueueSlot={onQueueSlot}
            onToggleStance={onToggleStance}
            slot={slot}
          />
        ))}
      </div>
    </article>
  );
}

export function CompactDock({
  bankA,
  bankB,
  supers,
  activeBuffer,
  finalizedPreview,
  activeProfileName,
  profileReason,
  isPasteReady,
  isHotkeysPaused,
  hasHotkeyWarnings,
  onPasteSlot,
  onEditSlot,
  onQueueSlot,
  onToggleStance,
  onQueueSuper,
  onCopyCombo,
  onPasteCombo,
  onCancelCombo,
  onRemoveLast,
  onReplayLast,
}: CompactDockProps) {
  const totalChars = finalizedPreview.length;
  const roughTokens = Math.ceil(totalChars / 4);
  const hasQueue = activeBuffer.queuedEntries.length > 0 || activeBuffer.activeStances.length > 0;

  return (
    <section className="dock-column scrollbar-thin">
      <article className="card animate-slide-up">
        <header className="surface-header">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-accent-a-dim)]">
              <Zap size={16} className="text-[var(--color-accent-a)]" />
            </div>
            <div>
              <p className="section-label !text-[var(--color-accent-a)]">Combo HUD</p>
              <h2 className="text-base font-semibold">{activeProfileName}</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">
              {profileReason}
            </span>
            <span className={`badge ${isHotkeysPaused ? "badge-warning" : hasHotkeyWarnings ? "badge-warning" : "badge-accent-a"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isHotkeysPaused ? "bg-[var(--color-warning)]" : hasHotkeyWarnings ? "bg-[var(--color-warning)]" : "bg-[var(--color-accent-a)]"} ${!isHotkeysPaused && !hasHotkeyWarnings ? "animate-pulse-glow" : ""}`} />
              {isHotkeysPaused ? "Paused" : hasHotkeyWarnings ? "Degraded" : "Active"}
            </span>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]" aria-label="Current combo queue">
            {activeBuffer.queuedEntries.map((entry, i) => (
              <span
                className="badge badge-accent-a animate-scale-in flex items-center gap-1"
                key={`${queueLabel(entry, bankA, bankB, supers)}-${i}`}
              >
                <ChevronRight size={10} className="opacity-40" />
                {queueLabel(entry, bankA, bankB, supers)}
              </span>
            ))}
            {activeBuffer.activeStances.map((stance, i) => {
              const label = bankB.slots.find((s) => s.slotIndex === stance.slotIndex)?.label
                ?? `${stance.bankId}${getSlotHotkeyDigit(stance.slotIndex)}`;
              return (
                <span className="badge badge-accent-b animate-scale-in flex items-center gap-1" key={`stance-${stance.bankId}-${stance.slotIndex}-${i}`}>
                  <Pin size={10} className="rotate-45" />
                  {label}
                </span>
              );
            })}
            {!hasQueue ? (
              <span className="text-xs text-[var(--color-text-muted)] italic">
                No combo queued - select slots or fire a super
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] font-mono shrink-0">
            <span>{totalChars.toLocaleString()} chars</span>
            <span className="w-px h-3 bg-[var(--color-border)]" />
            <span>~{roughTokens.toLocaleString()} tokens</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-sm" onClick={onCopyCombo} type="button">
            <Copy size={13} />
            Copy
          </button>
          <button className="btn btn-sm btn-accent-a" disabled={!isPasteReady} onClick={onPasteCombo} type="button">
            <ClipboardPaste size={13} />
            Paste
          </button>
          <button className="btn btn-sm btn-ghost" onClick={onRemoveLast} type="button">
            <Trash2 size={13} />
            Remove last
          </button>
          <button className="btn btn-sm btn-ghost" onClick={onReplayLast} type="button">
            <RotateCcw size={13} />
            Replay
          </button>
          <button className="btn btn-sm btn-ghost text-[var(--color-text-muted)]" onClick={onCancelCombo} type="button">
            <X size={13} />
            Clear
          </button>
        </div>

        {supers.length > 0 ? (
          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
            <p className="section-label mb-2">Supers</p>
            <div className="flex flex-wrap gap-1.5">
              {supers.map((superRecipe) => (
                <button
                  className="badge badge-accent-a cursor-pointer hover:bg-[rgba(91,142,255,0.25)] transition-colors duration-150"
                  key={superRecipe.id}
                  onClick={() => onQueueSuper(superRecipe.id)}
                  type="button"
                >
                  <Flame size={10} />
                  {superRecipe.name}
                  {superRecipe.hotkeyHint ? (
                    <span className="opacity-50 ml-0.5">{superRecipe.hotkeyHint}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </article>

      <BankPanel
        activeBuffer={activeBuffer}
        bank={bankA}
        bankId="A"
        inheritanceBadge="Ctrl + 1..0"
        onEditSlot={onEditSlot}
        onPasteSlot={onPasteSlot}
        onQueueSlot={onQueueSlot}
        onToggleStance={onToggleStance}
      />

      <BankPanel
        activeBuffer={activeBuffer}
        bank={bankB}
        bankId="B"
        inheritanceBadge="Ctrl+Alt + 1..0"
        onEditSlot={onEditSlot}
        onPasteSlot={onPasteSlot}
        onQueueSlot={onQueueSlot}
        onToggleStance={onToggleStance}
      />

      <article className="card">
        <header className="surface-header">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-bg-surface)]">
              <Eye size={14} className="text-[var(--color-text-muted)]" />
            </div>
            <div>
              <p className="section-label">Preview</p>
              <h2>Assembled output</h2>
            </div>
          </div>
          <span className="badge text-xs">
            Ctrl+Shift+1..0 saves clipboard
          </span>
        </header>
        <div className="preview-surface scrollbar-thin">
          {finalizedPreview || (
            <span className="text-[var(--color-text-faint)] italic">
              Finalize a combo or fire a slot to preview the packet here.
            </span>
          )}
        </div>
      </article>
    </section>
  );
}
