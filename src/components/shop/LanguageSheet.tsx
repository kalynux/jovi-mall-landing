"use client";

import { BottomSheet, Icon } from "@/components/shop/ds";
import { LOCALES, useLocale } from "@/lib/i18n-provider";

/**
 * The language picker: a bottom sheet on a phone, a centred dialog on `sm+` —
 * the house shape, from `BottomSheet`.
 *
 * The account screen used to *display* the current language and leave switching
 * to the marketing site's navbar, which the app bundle does not contain. So in
 * the app the row named a setting nobody could change from any screen that
 * ships.
 *
 * Each language is written in its own name — someone looking for Portuguese is
 * looking for "Português", not for the word "Portuguese" in a language they
 * cannot read.
 */
export function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale, setLocale, pending } = useLocale();

  return (
    <BottomSheet open={open} onClose={onClose} title="Language">
      <div style={{ display: "flex", flexDirection: "column" }}>
        {LOCALES.map((option) => {
          const selected = option.code === locale;
          return (
            <button
              key={option.code}
              type="button"
              disabled={pending}
              /* The switch is a navigation to the same route in another
                 language, so the sheet closes on the way out rather than
                 waiting for a round trip it cannot see the end of. */
              onClick={() => {
                setLocale(option.code);
                onClose();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "13px 4px",
                background: "transparent",
                border: "none",
                cursor: pending ? "wait" : "pointer",
                textAlign: "start",
                opacity: pending && !selected ? 0.5 : 1,
              }}
            >
              <span
                /* The endonym carries its own script, so the row is written in
                   its own direction rather than inheriting the page's. */
                dir={option.dir}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 15,
                  fontWeight: selected ? 800 : 600,
                  color: selected ? "var(--brand-hover)" : "var(--text-strong)",
                }}
              >
                {option.label}
              </span>
              {selected && <Icon name="check" size={19} style={{ color: "var(--brand)" }} />}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
