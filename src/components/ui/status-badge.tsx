"use client";

import * as React from "react";
import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getStatusConfig, type OfferteStatus } from "@/lib/constants/statuses";

interface StatusBadgeProps {
  status: OfferteStatus | string;
  showIcon?: boolean;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "dot";
  className?: string;
}

const sizeClasses = {
  sm: {
    badge: "px-2 py-0.5 text-xs",
    icon: "h-3 w-3",
    dot: "h-1.5 w-1.5",
  },
  md: {
    badge: "px-2.5 py-1 text-sm",
    icon: "h-4 w-4",
    dot: "h-2 w-2",
  },
  lg: {
    badge: "px-3 py-1.5 text-base",
    icon: "h-5 w-5",
    dot: "h-2.5 w-2.5",
  },
};

export const StatusBadge = memo(function StatusBadge({
  status,
  showIcon = true,
  showTooltip = true,
  size = "md",
  variant = "default",
  className,
}: StatusBadgeProps) {
  // Memoize config lookup
  const config = useMemo(() => getStatusConfig(status), [status]);
  const Icon = config.icon;
  const sizes = sizeClasses[size];

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium transition-colors",
        sizes.badge,
        variant === "default" && [config.color.bg, config.color.text],
        variant === "outline" && [
          "bg-transparent border",
          config.color.text,
          config.color.border,
        ],
        variant === "dot" && "bg-transparent",
        className
      )}
    >
      {variant === "dot" ? (
        <span
          className={cn("rounded-full", sizes.dot, config.color.dot)}
          aria-hidden="true"
        />
      ) : showIcon ? (
        <Icon className={sizes.icon} aria-hidden="true" />
      ) : null}
      <span>{config.label}</span>
    </span>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

// Simplified dot indicator for compact displays
interface StatusDotProps {
  status: OfferteStatus | string;
  className?: string;
}

export const StatusDot = memo(function StatusDot({ status, className }: StatusDotProps) {
  const config = useMemo(() => getStatusConfig(status), [status]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-block h-2.5 w-2.5 rounded-full",
              config.color.dot,
              className
            )}
            aria-label={config.label}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export type { StatusBadgeProps, StatusDotProps };
