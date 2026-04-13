import { Info } from "lucide-react";

type ToastRailProps = {
  message: string;
};

export function ToastRail({ message }: ToastRailProps) {
  if (!message) return null;

  return (
    <aside aria-live="polite" className="toast-rail">
      <div className="toast-card flex items-center gap-2">
        <Info size={14} className="text-[var(--color-accent-a)] shrink-0" />
        {message}
      </div>
    </aside>
  );
}
