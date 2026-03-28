"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { showSuccessToast } from "@/lib/toast-utils";

interface CopyButtonProps {
  /** The text value to copy to clipboard */
  value: string;
  /** Optional tooltip label (defaults to "Kopieer") */
  label?: string;
}

export function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      showSuccessToast("Gekopieerd naar klembord");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silently — clipboard API may not be available
    }
  }, [value]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
          aria-label={label ?? "Kopieer"}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label ?? "Kopieer"}</TooltipContent>
    </Tooltip>
  );
}
