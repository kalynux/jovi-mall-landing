"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CHAT_MESSAGES } from "@/lib/constants";
import { CheckCheck } from "lucide-react";

interface WhatsAppChatProps {
  autoPlay?: boolean;
  className?: string;
}

export default function WhatsAppChat({ autoPlay = true, className }: WhatsAppChatProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    if (!autoPlay) return;
    if (shouldReduce) { setVisibleCount(CHAT_MESSAGES.length); return; }

    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    const showNext = () => {
      if (i >= CHAT_MESSAGES.length) return;
      const msg = CHAT_MESSAGES[i];
      const isAI = msg.from === "ai";

      if (isAI) {
        setIsTyping(true);
        timer = setTimeout(() => {
          setIsTyping(false);
          setVisibleCount(i + 1);
          i++;
          timer = setTimeout(showNext, 900);
        }, 1200);
      } else {
        setVisibleCount(i + 1);
        i++;
        timer = setTimeout(showNext, 1400);
      }
    };

    timer = setTimeout(showNext, 600);
    return () => clearTimeout(timer);
  }, [autoPlay, shouldReduce]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleCount, isTyping]);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-3xl overflow-hidden shadow-2xl",
        "border border-[var(--border)] bg-[#ece5dd]",
        "dark:bg-[#0d1117]",
        className
      )}
      aria-label="WhatsApp conversation simulation"
      role="region"
    >
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#128C7E]">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-white font-bold text-sm font-display">J</span>
        </div>
        <div>
          <div className="text-white font-semibold text-sm font-display">Jovi Mall</div>
          <div className="text-white/70 text-xs flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-300 inline-block" />
            AI Shopping Assistant
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[260px] max-h-[340px]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.025'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
      >
        <AnimatePresence>
          {CHAT_MESSAGES.slice(0, visibleCount).map((msg, i) => {
            const isCustomer = msg.from === "customer";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={cn("flex", isCustomer ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm relative",
                    isCustomer
                      ? "bg-[#d9fdd3] text-gray-800 rounded-br-sm"
                      : "bg-white text-gray-800 rounded-bl-sm"
                  )}
                >
                  <p className="whitespace-pre-line text-xs sm:text-sm">{msg.text}</p>
                  <div className={cn("flex items-center gap-0.5 mt-0.5", isCustomer ? "justify-end" : "justify-start")}>
                    <span className="text-[9px] text-gray-400">{isCustomer ? "You" : "Jovi AI"} · now</span>
                    {isCustomer && <CheckCheck className="w-3 h-3 text-[#128C7E]" />}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-typing-1" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-typing-2" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-typing-3" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#f0f0f0] dark:bg-[#1a1a2e] border-t border-black/5">
        <div className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-gray-400">
          Type a message...
        </div>
        <div className="w-8 h-8 rounded-full bg-[#128C7E] flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
