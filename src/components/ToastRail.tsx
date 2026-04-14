import { useEffect, useState } from "react";
import { Check } from "lucide-react";

type ToastRailProps = {
  message: string;
};

const TOAST_VISIBLE_MS = 4000;

export function ToastRail({ message }: ToastRailProps) {
  const [visible, setVisible] = useState(false);
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (!message) return;
    setDisplayed(message);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), TOAST_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message]);

  if (!visible || !displayed) return null;

  return (
    <aside aria-live="polite" className="toast-rail">
      <div className="toast-card flex items-center gap-2">
        <Check size={12} className="text-[var(--color-success)] shrink-0" />
        <span className="text-sm">{displayed}</span>
      </div>
    </aside>
  );
}
