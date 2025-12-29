"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Model = {
  id: string;
  name: string;
  size: string;
};

type ChatModelSelectorProps = {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
};

export function ChatModelSelector({ 
  selectedModel, 
  onModelChange 
}: ChatModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch("/api/chat/models");
        const data = await response.json();
        setModels(data.models || []);
      } catch (error) {
        console.error("Failed to fetch models:", error);
        setModels([
          { id: "gpt-oss:120b", name: "GPT-OSS (120b)", size: "65GB" },
          { id: "gpt-oss:20b", name: "GPT-OSS (20b)", size: "14GB" },
        ]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchModels();
  }, []);

  const selectedModelInfo = models.find((m) => m.id === selectedModel);
  const displayName = selectedModelInfo?.name || formatModelId(selectedModel);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isLoading}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5",
            "text-[11px] text-muted-foreground",
            "rounded border border-transparent",
            "transition-colors duration-150",
            "hover:bg-muted hover:text-foreground",
            "focus:outline-none",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <>
              <span className="max-w-[100px] truncate">{displayName}</span>
              <ChevronDown className="size-3 opacity-60" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start"
        side="bottom"
        sideOffset={4}
        className={cn(
          "w-[200px] max-h-[280px] overflow-y-auto",
          "z-[100]"
        )}
        // Prevent scroll lock on body
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {models.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => {
              onModelChange(model.id);
              setIsOpen(false);
            }}
            className={cn(
              "flex items-center justify-between gap-2 cursor-pointer",
              selectedModel === model.id && "bg-muted"
            )}
          >
            <div className="flex flex-col min-w-0">
              <span className="text-xs truncate">{model.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {model.size}
              </span>
            </div>
            {selectedModel === model.id && (
              <Check className="size-3 shrink-0 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatModelId(id: string): string {
  const parts = id.split(":");
  return parts[0]
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
