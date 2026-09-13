"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/shop/ds";
import { errorFeedback } from "@/lib/native/haptics";

export type ToastVariant = "success" | "error";

interface ToastContextValue {
  /** Confirm something worked. */
  flash: (message: string) => void;
  /**
   * Report a failure. Held longer than a success toast — a message you need to
   * read and act on should not vanish at the same speed as "Added to cart".
   */
  flashError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION: Record<ToastVariant, number> = { success: 2200, error: 4500 };

const STYLE: Record<ToastVariant, { icon: IconName; iconColor: string; background: string }> = {
  success: {
    icon: "circle-check-big",
    iconColor: "var(--green-400)",
    background: "var(--gray-900)",
  },
  error: {
    icon: "circle-alert",
    iconColor: "#fff",
    background: "var(--danger)",
  },
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, variant: ToastVariant) => {
    /**
     * A failure gets a buzz as well as a banner.
     *
     * The toast is the only signal something went wrong, and on a phone it
     * appears above the tab bar where a thumb often is. The haptic is what
     * catches someone already moving on — and it is fired here, once, rather
     * than at each of the couple of dozen `flashError` call sites.
     *
     * Fire-and-forget, silent on the web, and silent for anyone with reduced
     * motion on.
     */
    if (variant === "error") void errorFeedback();

    setToast({ message, variant });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), DURATION[variant]);
  }, []);

  const flash = useCallback((message: string) => show(message, "success"), [show]);
  const flashError = useCallback((message: string) => show(message, "error"), [show]);

  const style = toast ? STYLE[toast.variant] : STYLE.success;

  return (
    <ToastContext.Provider value={{ flash, flashError }}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            // Failures are announced assertively so a screen-reader user is not
            // told the save failed only after they have moved on.
            role={toast.variant === "error" ? "alert" : "status"}
            aria-live={toast.variant === "error" ? "assertive" : "polite"}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            // `bottom` lives in the class, not here: below `md` it has to clear
            // the tab bar, and an inline value would outrank the media query.
            className="shop-toast"
            style={{
              position: "fixed",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 500,
              display: "flex",
              alignItems: "center",
              gap: 9,
              background: style.background,
              color: "#fff",
              borderRadius: "var(--radius-md)",
              padding: "11px 16px",
              fontSize: 13.5,
              fontWeight: 600,
              boxShadow: "var(--shadow-lg)",
              maxWidth: "calc(100vw - 32px)",
            }}
          >
            <Icon name={style.icon} size={18} style={{ color: style.iconColor, flexShrink: 0 }} />
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}
