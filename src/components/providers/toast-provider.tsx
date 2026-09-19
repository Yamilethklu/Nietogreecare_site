"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (payload: { title: string; description?: string; variant?: ToastVariant }) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="size-5 text-emerald-300" />,
  error: <AlertTriangle className="size-5 text-red-300" />,
  info: <Info className="size-5 text-gold-200" />,
};

const STYLES: Record<ToastVariant, string> = {
  success: "border-emerald-500/35 bg-emerald-950/50",
  error: "border-red-500/35 bg-red-950/50",
  info: "border-gold-500/35 bg-ink-900/90",
};

/** Notificaciones emergentes elegantes (verde bosque + negro + dorado). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback<ToastContextValue["toast"]>(
    ({ title, description, variant = "info" }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current, { id, title, description, variant }]);
      window.setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-3 px-4 sm:bottom-8 sm:right-8 sm:left-auto sm:items-end"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-luxury backdrop-blur-md",
              "animate-fade-up",
              STYLES[item.variant],
            )}
          >
            <div className="mt-0.5">{ICONS[item.variant]}</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{item.title}</p>
              {item.description && (
                <p className="mt-1 text-xs leading-relaxed text-ink-200/90">{item.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="rounded-full p-1 text-ink-400 transition-colors hover:text-white"
              aria-label="Cerrar notificacion"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  }
  return context;
}