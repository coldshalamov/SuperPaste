import { Check } from "lucide-react";

type ToastRailProps = {
  message: string;
};

export function ToastRail({ message }: ToastRailProps) {
  if (!message) return null;

  return (
    <aside aria-live="polite" className="toast-rail">
      <div className="toast-card flex items-center gap-2">
        <Check size={12} className="text-[var(--color-success)] shrink-0" />
        <span className="text-sm">{message}</span>
      </div>
    </aside>
  );
}
