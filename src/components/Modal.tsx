import { useEffect, useRef } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: string;
  children: React.ReactNode;
};

export function Modal({
  open,
  onClose,
  title,
  width = "max-w-md",
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-container ${width} animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-header">
          <h2 className="text-sm font-semibold m-0">{title}</h2>
          <button
            className="btn btn-sm btn-ghost btn-icon"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </header>
        <div className="modal-body scrollbar-thin">{children}</div>
      </div>
      <dialog ref={dialogRef} className="sr-only" aria-hidden="true" />
    </div>
  );
}
