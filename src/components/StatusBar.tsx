import { Activity, Layers, Keyboard, AlertTriangle } from "lucide-react";

type StatusBarProps = {
  activeApp: string;
  comboCount: number;
  profileModeLabel: string;
  hotkeyStatus: string;
  hotkeyWarnings: string[];
};

export function StatusBar({ activeApp, comboCount, profileModeLabel, hotkeyStatus, hotkeyWarnings }: StatusBarProps) {
  return (
    <footer className="flex flex-wrap items-center gap-4 border-t border-[var(--color-border-subtle)] pt-3 text-xs text-[var(--color-text-muted)]">
      <span className="flex items-center gap-1.5">
        <Activity size={12} />
        {activeApp || "Waiting for active window"}
      </span>
      <span className="flex items-center gap-1.5">
        <Layers size={12} />
        Queue: {comboCount}
      </span>
      <span>{profileModeLabel}</span>
      <span className="flex items-center gap-1.5">
        <Keyboard size={12} />
        {hotkeyStatus}
      </span>
      {hotkeyWarnings.length ? (
        <span className="flex items-center gap-1.5 text-[var(--color-warning)]">
          <AlertTriangle size={12} />
          {hotkeyWarnings.join("; ")}
        </span>
      ) : null}
    </footer>
  );
}
