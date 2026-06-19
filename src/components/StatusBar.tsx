import { Activity, Layers, Keyboard, AlertTriangle } from "lucide-react";

type StatusBarProps = {
  activeApp: string;
  comboCount: number;
  isManualOverride: boolean;
  hotkeyStatus: string;
  hotkeyWarnings: string[];
  nativeFailedBindings: string[];
  nativeResolvedProfileReason: string;
};

export function StatusBar({
  activeApp,
  comboCount,
  isManualOverride,
  hotkeyStatus,
  hotkeyWarnings,
  nativeFailedBindings,
  nativeResolvedProfileReason,
}: StatusBarProps) {
  return (
    <footer className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border-subtle)] pt-2 text-xs text-[var(--color-text-muted)]">
      <span className="flex items-center gap-1.5" title="Active window">
        <Activity size={11} className="opacity-60" />
        <span className="truncate max-w-[180px]">
          {activeApp || "Waiting..."}
        </span>
      </span>

      {comboCount > 0 && (
        <span className="flex items-center gap-1.5">
          <Layers size={11} className="opacity-60" />
          {comboCount} queued
        </span>
      )}

      <span className="flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isManualOverride
              ? "bg-[var(--color-warning)]"
              : "bg-[var(--color-text-faint)]"
          }`}
        />
        {isManualOverride ? "Manual" : "Auto"}
      </span>

      <span className="flex items-center gap-1.5" title="Hotkey status">
        <Keyboard size={11} className="opacity-60" />
        {hotkeyStatus}
      </span>

      {nativeResolvedProfileReason && (
        <span className="truncate max-w-[260px]" title={nativeResolvedProfileReason}>
          {nativeResolvedProfileReason}
        </span>
      )}

      {hotkeyWarnings.length > 0 && (
        <span
          className="flex items-center gap-1.5 text-[var(--color-warning)]"
          title={hotkeyWarnings.join("; ")}
        >
          <AlertTriangle size={11} />
          {hotkeyWarnings.length} conflict{hotkeyWarnings.length > 1 ? "s" : ""}
        </span>
      )}

      {nativeFailedBindings.length > 0 && (
        <span
          className="flex items-center gap-1.5 text-[var(--color-warning)]"
          title={nativeFailedBindings.join("; ")}
        >
          <AlertTriangle size={11} />
          {nativeFailedBindings.length} native failure{nativeFailedBindings.length > 1 ? "s" : ""}
        </span>
      )}
    </footer>
  );
}
