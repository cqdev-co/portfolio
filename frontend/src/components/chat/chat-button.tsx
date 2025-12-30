"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { SparklesIcon } from "./chat-icons";
import { ChatPanel } from "./chat-panel";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Chat Button - matches navbar dock exactly */}
      <AnimatePresence mode="wait">
        {!isOpen && (
          <motion.div
            key="chat-button-container"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ 
              type: "spring", 
              damping: 20, 
              stiffness: 300 
            }}
            className={cn(
              // Match navbar positioning exactly
              "pointer-events-none fixed z-30",
              "bottom-0 mb-4",
              // Match navbar height & centering
              "h-full max-h-14",
              "flex items-center",
              // Position next to navbar (centered + offset)
              "left-1/2 translate-x-[calc(170px+8px)]"
            )}
          >
            {/* Button wrapper - matches Dock styling */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsOpen(true)}
                  className={cn(
                    "pointer-events-auto",
                    "flex size-10 items-center justify-center",
                    "rounded-full bg-background border cursor-pointer",
                    "[box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
                    "transform-gpu",
                    "dark:[border:1px_solid_rgba(255,255,255,.1)]",
                    "dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]",
                    "transition-all duration-200",
                    "hover:scale-105",
                    "focus:outline-none focus:ring-2 focus:ring-ring"
                  )}
                  aria-label="Open AI Chat"
                >
                  <SparklesIcon size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>AI Chat</p>
              </TooltipContent>
            </Tooltip>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <ChatPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
