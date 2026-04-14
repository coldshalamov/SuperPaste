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
  Pin,
  Pencil,
  Plus,
  ChevronRight,
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
  if (!slot.content.trim()) return "Empty slot";
  return slot.content.trim().replace(/\s+/g, " ").slice(0, 60);
}

function queueLabel(
  entry: ComboBufferState["queuedEntries"][number],
  bankA: SlotBank,
  bankB: SlotBank,
  supers: SuperRecipe[],
) {
  if (entry.type === "super") {
    return supers.find((recipe) => recipe.id === entry.superId)?.name ?? entry.superId;
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
  const digit = getSlotHotkeyDigit(slot.slotIndex);

  const tileClasses = [
    "slot-tile",
    isEmpty && "is-empty",
    isBankA ? "is-bank-a" : "is-bank-b",
    isStance && "is-stance",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={tileClasses}>
      {/* Hover actions */}
      <div className="slot-tile-actions">
        <button
          className="btn btn-xs btn-ghost btn-icon"
          onClick={(e) => {
            e.stopPropagation();
            onQueueSlot(slotRef);
          }}
          type="button"
          title="Add to queue"
        >
          <Plus size={12} />
        </button>
        {bankId === "B" && (
          <button
            className={`btn btn-xs btn-icon ${isStance ? "btn-warning" : "btn-ghost"}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStance(slotRef);
            }}
            type="button"
            title={isStance ? "Unlatch stance" : "Latch as stance"}
          >
            <Pin size={12} className={isStance ? "rotate-45" : ""} />
          </button>
        )}
        <button
          className="btn btn-xs btn-ghost btn-icon"
          onClick={(e) => {
            e.stopPropagation();
            onEditSlot(slotRef);
          }}
          type="button"
          title="Edit slot"
        >
          <Pencil size={12} />
        </button>
      </div>

      {/* Main click area */}
      <button
        className="flex flex-1 flex-col items-start gap-1 bg-transparent border-0 p-0 text-left cursor-pointer"
        disabled={!slot.enabled}
        onClick={() => onPasteSlot(slotRef)}
        type="button"
        aria-label={`Paste slot ${slot.bankId}${digit}`}
      >
        <div className="flex items-center gap-1.5">
          <span className={`keycap text-[0.6rem] ${isBankA ? "keycap-a" : "keycap-b"}`}>
            {slot.bankId}
            {digit}
          </span>
          {isStance && (
            <span className="badge badge-warning text-[0.55rem] py-0 px-1">Stance</span>
          )}
        </div>
        <span className="text-xs font-medium text-[var(--color-text)] line-clamp-1 w-full">
          {slot.label || "Empty"}
        </span>
        <span className="text-[0.65rem] leading-snug text-[var(--color-text-muted)] line-clamp-2 w-full">
          {slotPreview(slot)}
        </span>
      </button>
    </div>
  );
}

function BankSection({
  bank,
  bankId,
  activeBuffer,
  onPasteSlot,
  onEditSlot,
  onQueueSlot,
  onToggleStance,
}: {
  bank: SlotBank;
  bankId: "A" | "B";
  activeBuffer: ComboBufferState;
  onPasteSlot: (slotRef: SlotReference) => void;
  onEditSlot: (slotRef: SlotReference) => void;
  onQueueSlot: (slotRef: SlotReference) => void;
  onToggleStance: (slotRef: SlotReference) => void;
}) {
  const isBankA = bankId === "A";
  const Icon = isBankA ? Target : Flame;
  const accentClass = isBankA ? "card-accent-a" : "card-accent-b";
  const iconColorClass = isBankA
    ? "text-[var(--color-accent-a)]"
    : "text-[var(--color-accent-b)]";
  const labelColorClass = isBankA
    ? "!text-[var(--color-accent-a)]"
    : "!text-[var(--color-accent-b)]";

  return (
    <article className={`card ${accentClass}`}>
      <div className="surface-header">
        <div className="flex items-center gap-2">
          <Icon size={14} className={iconColorClass} />
          <div>
            <span className={`section-label ${labelColorClass}`}>
              {isBankA ? "Bank A" : "Bank B"}
            </span>
            <h2 className="section-title">{bank.name}</h2>
          </div>
        </div>
        <span className="text-[0.6rem] text-[var(--color-text-faint)] font-mono">
          {isBankA ? "Ctrl+1..0" : "Ctrl+Alt+1..0"}
        </span>
      </div>

      <div className="bank-grid">
        {bank.slots.map((slot) => (
          <SlotTile
            key={`${slot.bankId}-${slot.slotIndex}`}
            slot={slot}
            bankId={bankId}
            activeBuffer={activeBuffer}
            onPasteSlot={onPasteSlot}
            onEditSlot={onEditSlot}
            onQueueSlot={onQueueSlot}
            onToggleStance={onToggleStance}
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
  isPasteReady,
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
  const hasQueue =
    activeBuffer.queuedEntries.length > 0 || activeBuffer.activeStances.length > 0;

  return (
    <section className="dock-column scrollbar-thin">
      {/* ============================================
          COMBO HUD
          ============================================ */}
      <article className="card">
        <div className="surface-header">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-[var(--color-accent-a)]" />
            <span className="section-title">Combo</span>
          </div>
          <div className="flex items-center gap-2 text-[0.65rem] text-[var(--color-text-muted)] font-mono">
            <span>{totalChars.toLocaleString()} chars</span>
            <span className="opacity-40">|</span>
            <span>~{roughTokens.toLocaleString()} tokens</span>
          </div>
        </div>

        {/* Queue display */}
        <div className="combo-queue">
          {activeBuffer.queuedEntries.map((entry, i) => (
            <div key={`${queueLabel(entry, bankA, bankB, supers)}-${i}`} className="combo-queue-item">
              {i > 0 && <ChevronRight size={10} className="text-[var(--color-text-faint)]" />}
              <span className="badge badge-accent-a">
                {queueLabel(entry, bankA, bankB, supers)}
              </span>
            </div>
          ))}
          {activeBuffer.activeStances.map((stance, i) => {
            const label =
              bankB.slots.find((s) => s.slotIndex === stance.slotIndex)?.label ??
              `${stance.bankId}${getSlotHotkeyDigit(stance.slotIndex)}`;
            return (
              <div
                key={`stance-${stance.bankId}-${stance.slotIndex}-${i}`}
                className="combo-queue-item"
              >
                <span className="badge badge-warning">
                  <Pin size={8} className="rotate-45" />
                  {label}
                </span>
              </div>
            );
          })}
          {!hasQueue && (
            <span className="text-xs text-[var(--color-text-faint)] italic">
              Click slots to add to combo
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <button className="btn btn-sm btn-ghost" onClick={onCopyCombo} type="button">
            <Copy size={12} />
            Copy
          </button>
          <button
            className="btn btn-sm btn-primary"
            disabled={!isPasteReady || !hasQueue}
            onClick={onPasteCombo}
            type="button"
          >
            <ClipboardPaste size={12} />
            Paste
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={onRemoveLast}
            type="button"
            disabled={!hasQueue}
          >
            <Trash2 size={12} />
          </button>
          <button className="btn btn-sm btn-ghost" onClick={onReplayLast} type="button">
            <RotateCcw size={12} />
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={onCancelCombo}
            type="button"
            disabled={!hasQueue}
          >
            <X size={12} />
          </button>
        </div>

        {/* Supers */}
        {supers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
            <span className="section-label block mb-1.5">Supers</span>
            <div className="flex flex-wrap gap-1">
              {supers.map((superRecipe) => (
                <button
                  key={superRecipe.id}
                  className="badge badge-accent-a cursor-pointer hover:bg-[rgba(91,142,255,0.15)] transition-colors"
                  onClick={() => onQueueSuper(superRecipe.id)}
                  type="button"
                >
                  <Zap size={8} />
                  {superRecipe.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* ============================================
          BANKS
          ============================================ */}
      <BankSection
        bank={bankA}
        bankId="A"
        activeBuffer={activeBuffer}
        onPasteSlot={onPasteSlot}
        onEditSlot={onEditSlot}
        onQueueSlot={onQueueSlot}
        onToggleStance={onToggleStance}
      />

      <BankSection
        bank={bankB}
        bankId="B"
        activeBuffer={activeBuffer}
        onPasteSlot={onPasteSlot}
        onEditSlot={onEditSlot}
        onQueueSlot={onQueueSlot}
        onToggleStance={onToggleStance}
      />

      {/* ============================================
          PREVIEW
          ============================================ */}
      <article className="card">
        <div className="surface-header">
          <span className="section-title">Preview</span>
        </div>
        <div className="preview-surface scrollbar-thin">
          {finalizedPreview || (
            <span className="text-[var(--color-text-faint)] italic text-xs">
              Paste or fire a slot to preview output
            </span>
          )}
        </div>
      </article>
    </section>
  );
}
