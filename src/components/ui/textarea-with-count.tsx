"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

interface TextareaWithCountProps
  extends React.ComponentProps<typeof Textarea> {
  maxLength?: number;
}

const TextareaWithCount = React.forwardRef<
  HTMLTextAreaElement,
  TextareaWithCountProps
>(({ maxLength, onChange, value, defaultValue, className, ...props }, ref) => {
  const [charCount, setCharCount] = React.useState(() => {
    const initial = (value ?? defaultValue ?? "") as string;
    return initial.length;
  });

  // Keep charCount in sync when value is controlled externally
  React.useEffect(() => {
    if (value !== undefined) {
      setCharCount((value as string).length);
    }
  }, [value]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      onChange?.(e);
    },
    [onChange]
  );

  const ratio = maxLength ? charCount / maxLength : 0;

  return (
    <div className="space-y-1">
      <Textarea
        ref={ref}
        className={className}
        value={value}
        defaultValue={defaultValue}
        maxLength={maxLength}
        onChange={handleChange}
        {...props}
      />
      {maxLength !== undefined && (
        <p
          className={cn(
            "text-xs text-right",
            ratio > 0.9 && ratio < 1
              ? "text-amber-500"
              : ratio >= 1
                ? "text-destructive"
                : "text-muted-foreground"
          )}
        >
          {charCount}/{maxLength}
        </p>
      )}
    </div>
  );
});

TextareaWithCount.displayName = "TextareaWithCount";

export { TextareaWithCount };
export type { TextareaWithCountProps };
