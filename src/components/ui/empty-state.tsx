"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline";
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8",
        className
      )}
    >
      {icon && (
        <div className="size-16 text-muted-foreground flex items-center justify-center [&>svg]:size-full">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mt-4 text-center">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-sm mt-2 max-w-sm text-center">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant={action.variant ?? "default"}
          onClick={action.onClick}
          className="mt-6"
        >
          {action.label}
        </Button>
      )}
      {secondaryAction && (
        <button
          type="button"
          onClick={secondaryAction.onClick}
          className="mt-3 text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
        >
          {secondaryAction.label}
        </button>
      )}
    </div>
  );
}

export type { EmptyStateProps, EmptyStateAction };
