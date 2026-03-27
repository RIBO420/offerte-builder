"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SendHorizonal } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function ChatInput({
  onSend,
  placeholder = "Typ een bericht...",
  disabled = false,
}: ChatInputProps) {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !disabled;

  const resetTextarea = React.useCallback(() => {
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, []);

  const handleSend = React.useCallback(() => {
    if (!canSend) return;
    onSend(trimmed);
    resetTextarea();
    textareaRef.current?.focus();
  }, [canSend, onSend, trimmed, resetTextarea]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInput = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = 160;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
    },
    []
  );

  return (
    <div
      className={cn(
        "flex items-end gap-2 border-t bg-background p-3",
        "dark:border-border"
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        aria-label={placeholder}
        className={cn(
          "flex-1 resize-none rounded-xl border bg-transparent px-3.5 py-2.5 text-sm",
          "placeholder:text-muted-foreground",
          "border-input dark:bg-input/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "min-h-[42px] max-h-[160px]"
        )}
      />
      <Button
        type="button"
        size="icon"
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Bericht verzenden"
        className="shrink-0 rounded-xl"
      >
        <SendHorizonal className="size-4" />
      </Button>
    </div>
  );
}

export { ChatInput };
export type { ChatInputProps };
