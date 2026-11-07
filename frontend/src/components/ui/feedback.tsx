import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./primitives";

export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }

    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [open, onClose]);

  return (
    <dialog
      aria-labelledby={titleId}
      className="ds-dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      ref={dialogRef}
    >
      <div className="flex items-start justify-between gap-4 border-b border-charcoal/8 px-6 py-5">
        <h2 className="text-lg font-bold text-charcoal" id={titleId}>
          {title}
        </h2>
        <button
          aria-label="Close dialog"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-cream hover:text-charcoal"
          onClick={onClose}
          type="button"
        >
          <span aria-hidden="true" className="text-xl leading-none">
            ×
          </span>
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
      {actions ? (
        <div className="flex flex-wrap justify-end gap-3 border-t border-charcoal/8 bg-cream/60 px-6 py-4">
          {actions}
        </div>
      ) : null}
    </dialog>
  );
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  return (
    <Modal
      actions={
        <>
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            variant={destructive ? "destructive" : "primary"}
          >
            {confirmLabel}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title={title}
    >
      <p className="text-sm leading-6 text-slate-600">{description}</p>
    </Modal>
  );
}

export function Toast({
  message,
  tone = "success",
  duration = 4000,
  onDismiss,
}: {
  message: string;
  tone?: "success" | "error" | "info";
  duration?: number;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (duration <= 0) return;
    const timeout = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timeout);
  }, [duration, onDismiss]);

  const styles = {
    success: "border-emerald-200 bg-[#f2f7ef] text-forest",
    error: "border-[#efc8c3] bg-[#fbefed] text-[#873c35]",
    info: "border-[#c9dce4] bg-[#eff6f8] text-[#355463]",
  };

  return (
    <div
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`animate-rise-in flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 shadow-soft ${styles[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <p className="text-sm font-medium">{message}</p>
      <button
        aria-label="Dismiss notification"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-black/5"
        onClick={onDismiss}
        type="button"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ×
        </span>
      </button>
    </div>
  );
}
