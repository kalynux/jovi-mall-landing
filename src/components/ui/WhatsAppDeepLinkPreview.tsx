"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, ChevronRight, X, ShieldCheck } from "lucide-react";
import { BRAND } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export default function WhatsAppDeepLinkPreview() {
  const [showPreview, setShowPreview] = useState(false);
  const t = useTranslations("customer.whatsapp");
  const waUrl = `https://wa.me/${BRAND.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(t("previewUserMsg"))}`;

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

      {/* Preview panel */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            id="wa-preview"
            role="tooltip"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 mt-2 w-[300px] sm:w-[340px] z-20"
          >
            <div className="glass border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#128C7E]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-white font-bold text-xs">J</span>
                  </div>
                  <div>
                    <div className="text-white text-xs font-semibold font-display">{BRAND.name}</div>
                    <div className="text-white/60 text-[9px]">{t("business")}</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-white/70 hover:text-white transition-colors"
                  aria-label={t("closePreview")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Message preview */}
              <div className="p-4 bg-[#ece5dd] dark:bg-[#0d1117]">
                <div className="bg-white rounded-xl rounded-bl-none p-3 shadow-sm max-w-[90%]">
                  <p className="text-xs text-gray-800 font-medium">{t("previewWelcome")}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    {t("previewMsg")}
                  </p>
                  <span className="text-[9px] text-gray-400 block mt-1 text-right">{t("previewTime")}</span>
                </div>

                <div className="mt-2 bg-[#d9fdd3] rounded-xl rounded-br-none p-3 shadow-sm ml-auto max-w-[85%]">
                  <p className="text-xs text-gray-700 italic">
                    &ldquo;{t("previewUserMsg")}&rdquo;
                  </p>
                </div>
              </div>

              {/* Trust indicator + open button */}
              <div className="p-3 border-t border-[var(--border)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                  <ShieldCheck className="w-3 h-3 text-wa-dark" />
                  {t("trust")}
                </div>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-display font-semibold text-wa-dark hover:text-wa hover:underline transition-colors"
                >
                  {t("openWhatsApp")}
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
