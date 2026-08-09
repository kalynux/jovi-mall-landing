"use client";
/**
 * The Customer section's call to action: a disclosure whose panel previews the
 * conversation and then hands off to the WhatsApp bot.
 *
 * The panel itself is WhatsAppBotPanel, shared with the role picker modal. This
 * component owns only the trigger and the anchored positioning.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import WhatsAppBotPanel from "./WhatsAppBotPanel";

export default function WhatsAppDeepLinkPreview() {
  const [showPreview, setShowPreview] = useState(false);
  const t = useTranslations("customer.whatsapp");

  // Escape closes it — expected of a disclosure, and the panel now takes focus
  // when it opens, so a keyboard user needs a way back out.
  useEffect(() => {
    if (!showPreview) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && setShowPreview(false);
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showPreview]);

  return (
    <div className="relative">
      {/* CTA button */}
      <motion.button
        onClick={() => setShowPreview(!showPreview)}
        whileTap={{ scale: 0.97 }}
        className={cn(
          "flex items-center gap-3 px-5 py-3 rounded-2xl text-white font-display font-semibold text-sm",
          "shadow-glow-wa transition-all duration-200",
          "hover:shadow-[0_0_30px_rgba(37,211,102,0.4)] hover:scale-[1.02]",
          "bg-gradient-to-r from-wa-dark to-wa"
        )}
        aria-expanded={showPreview}
        aria-controls="wa-preview"
      >
        <MessageCircle className="w-5 h-5" />
        {t("cta")}
        <ChevronRight className={cn("w-4 h-4 transition-transform duration-200", showPreview ? "rotate-90" : "")} />
      </motion.button>

      {/* Preview panel. No role="tooltip" — a tooltip may not contain focusable
          content, and this holds a link and a close button. The
          trigger + aria-expanded + aria-controls trio already describes a
          disclosure, whose panel correctly carries no role of its own. */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            id="wa-preview"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 mt-2 w-[300px] sm:w-[340px] z-20"
          >
            <WhatsAppBotPanel onClose={() => setShowPreview(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
