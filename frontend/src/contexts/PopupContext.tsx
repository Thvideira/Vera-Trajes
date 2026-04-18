import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type PopupType = "success" | "error" | "warning" | "info";

export type ShowPopupOptions = {
  type: PopupType;
  title: string;
  message: string;
  mode?: "alert" | "confirm";
  confirmText?: string;
  cancelText?: string;
  /** Destaque vermelho no botão principal (ex.: exclusão) */
  danger?: boolean;
  autoCloseMs?: number;
  /** Padrão: true em alertas; confirmações críticas devem passar false */
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  onDismiss?: () => void;
};

type InternalPopup = ShowPopupOptions & {
  id: number;
  mode: "alert" | "confirm";
  confirmText: string;
  cancelText?: string;
  closeOnBackdrop: boolean;
  closeOnEscape: boolean;
  confirmResolve?: (value: boolean) => void;
};

let applyPopup: ((updater: (prev: InternalPopup | null) => InternalPopup | null) => void) | null =
  null;

function supersede(prev: InternalPopup | null): InternalPopup | null {
  if (prev?.confirmResolve) {
    prev.confirmResolve(false);
  }
  return null;
}

function normalizeAlert(input: ShowPopupOptions): InternalPopup {
  const closeOnBackdrop = input.closeOnBackdrop ?? true;
  const closeOnEscape = input.closeOnEscape ?? true;
  return {
    ...input,
    id: Date.now(),
    mode: input.mode ?? "alert",
    confirmText: input.confirmText ?? "OK",
    cancelText: input.cancelText,
    danger: input.danger,
    autoCloseMs: input.autoCloseMs,
    closeOnBackdrop,
    closeOnEscape,
  };
}

/** Pop-up de alerta (um botão ou dois em modo confirm manual). */
export function showPopup(input: ShowPopupOptions): void {
  applyPopup?.((prev) => {
    supersede(prev);
    return normalizeAlert({ ...input, mode: input.mode ?? "alert" });
  });
}

/** Confirmação assíncrona; retorna true se confirmar. Não fecha ao clicar fora nem com ESC. */
export function confirmAsync(
  input: Omit<ShowPopupOptions, "mode" | "closeOnBackdrop" | "closeOnEscape"> & {
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
  }
): Promise<boolean> {
  return new Promise((resolve) => {
    applyPopup?.((prev) => {
      supersede(prev);
      return {
        ...input,
        id: Date.now(),
        mode: "confirm",
        type: input.type ?? "warning",
        title: input.title,
        message: input.message,
        confirmText: input.confirmText ?? "Confirmar",
        cancelText: input.cancelText ?? "Cancelar",
        danger: input.danger ?? false,
        closeOnBackdrop: input.closeOnBackdrop ?? false,
        closeOnEscape: input.closeOnEscape ?? false,
        autoCloseMs: undefined,
        onDismiss: input.onDismiss,
        confirmResolve: resolve,
      };
    });
  });
}

type PopupContextValue = {
  showPopup: typeof showPopup;
  confirmAsync: typeof confirmAsync;
};

const PopupContext = createContext<PopupContextValue | null>(null);

export function usePopup(): PopupContextValue {
  const ctx = useContext(PopupContext);
  if (!ctx) {
    throw new Error("usePopup must be used within PopupProvider");
  }
  return ctx;
}

function iconForType(type: PopupType) {
  const common = { width: 28, height: 28, viewBox: "0 0 24 24" as const };
  switch (type) {
    case "success":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "error":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case "warning":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "info":
    default:
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

function toneClasses(type: PopupType): { iconWrap: string; icon: string } {
  switch (type) {
    case "success":
      return {
        iconWrap: "bg-success/15 text-[#1b5e20]",
        icon: "text-[#1b5e20]",
      };
    case "error":
      return {
        iconWrap: "bg-error/15 text-[#c62828]",
        icon: "text-[#c62828]",
      };
    case "warning":
      return {
        iconWrap: "bg-warning/15 text-warning-fg",
        icon: "text-warning-fg",
      };
    case "info":
    default:
      return {
        iconWrap: "bg-info/15 text-[#1565c0]",
        icon: "text-[#1565c0]",
      };
  }
}

function PopupLayer({
  popup,
  leaving,
  primaryRef,
  onBackdropPointerDown,
  onConfirm,
  onCancel,
}: {
  popup: InternalPopup;
  leaving: boolean;
  primaryRef: React.RefObject<HTMLButtonElement | null>;
  onBackdropPointerDown: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const tones = toneClasses(popup.type);
  const isConfirm = popup.mode === "confirm";

  return (
    <div
      className={`popup-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/55 backdrop-blur-[2px] ${leaving ? "popup-overlay--leave" : ""}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onBackdropPointerDown();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-title"
        aria-describedby="popup-desc"
        className={`popup-dialog relative w-full max-w-[min(100%,420px)] rounded-2xl border border-line bg-surface p-5 shadow-xl ${leaving ? "popup-dialog--leave" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones.iconWrap}`}
          >
            <span className={tones.icon}>{iconForType(popup.type)}</span>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id="popup-title"
              className="text-lg font-semibold text-foreground"
            >
              {popup.title}
            </h2>
            <p
              id="popup-desc"
              className="mt-2 text-sm leading-relaxed text-muted whitespace-pre-wrap"
            >
              {popup.message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {isConfirm && (
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={onCancel}
            >
              {popup.cancelText ?? "Cancelar"}
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            className={
              popup.danger
                ? "inline-flex w-full items-center justify-center rounded-xl border-2 border-red-200 bg-surface px-4 py-2.5 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 sm:w-auto"
                : "btn-primary w-full sm:w-auto"
            }
            onClick={onConfirm}
          >
            {popup.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PopupProvider({ children }: { children: ReactNode }) {
  const [popup, setPopup] = useState<InternalPopup | null>(null);
  const [leaving, setLeaving] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primaryBtnRef = useRef<HTMLButtonElement>(null);
  const pendingDismissRef = useRef<(() => void) | null>(null);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const clearAutoClose = useCallback(() => {
    if (autoCloseRef.current) {
      clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
  }, []);

  const finalizeClose = useCallback(() => {
    clearLeaveTimer();
    setLeaving(false);
    setPopup(null);
    pendingDismissRef.current = null;
  }, [clearLeaveTimer]);

  const runDismiss = useCallback(() => {
    const fn = pendingDismissRef.current;
    pendingDismissRef.current = null;
    fn?.();
  }, []);

  const startClose = useCallback(
    (after?: () => void) => {
      clearAutoClose();
      pendingDismissRef.current = after ?? null;
      setLeaving(true);
      clearLeaveTimer();
      leaveTimerRef.current = setTimeout(() => {
        leaveTimerRef.current = null;
        runDismiss();
        finalizeClose();
      }, 230);
    },
    [clearAutoClose, clearLeaveTimer, finalizeClose, runDismiss]
  );

  const closeFromUser = useCallback(
    (confirmed: boolean) => {
      const p = popup;
      if (!p || leaving) return;
      if (p.mode === "confirm" && p.confirmResolve) {
        const res = p.confirmResolve;
        const onDismiss = p.onDismiss;
        startClose(() => {
          res(confirmed);
          onDismiss?.();
        });
        return;
      }
      startClose(() => {
        p.onDismiss?.();
      });
    },
    [leaving, popup, startClose]
  );

  useEffect(() => {
    applyPopup = (updater) => {
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
      if (autoCloseRef.current) {
        clearTimeout(autoCloseRef.current);
        autoCloseRef.current = null;
      }
      setLeaving(false);
      setPopup((prev) => updater(prev));
    };
    return () => {
      applyPopup = null;
    };
  }, []);

  useEffect(() => {
    if (!popup || leaving) {
      clearAutoClose();
      return;
    }
    const ms = popup.autoCloseMs;
    if (!ms || popup.mode === "confirm") return;
    autoCloseRef.current = setTimeout(() => {
      autoCloseRef.current = null;
      closeFromUser(false);
    }, ms);
    return () => clearAutoClose();
  }, [popup, leaving, closeFromUser, clearAutoClose]);

  useLayoutEffect(() => {
    if (!popup || leaving) return;
    primaryBtnRef.current?.focus();
  }, [popup, leaving]);

  useEffect(() => {
    if (!popup || leaving) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!popup.closeOnEscape) return;
      e.preventDefault();
      if (popup.mode === "confirm") {
        closeFromUser(false);
      } else {
        closeFromUser(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popup, leaving, closeFromUser]);

  const onBackdrop = useCallback(() => {
    if (!popup?.closeOnBackdrop || leaving) return;
    closeFromUser(false);
  }, [popup, leaving, closeFromUser]);

  const ctx: PopupContextValue = {
    showPopup,
    confirmAsync,
  };

  const layer =
    popup &&
    createPortal(
      <PopupLayer
        popup={popup}
        leaving={leaving}
        primaryRef={primaryBtnRef}
        onBackdropPointerDown={onBackdrop}
        onCancel={() => closeFromUser(false)}
        onConfirm={() => closeFromUser(popup.mode === "confirm")}
      />,
      document.body
    );

  return (
    <PopupContext.Provider value={ctx}>
      {children}
      {layer}
    </PopupContext.Provider>
  );
}
