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
  /**
   * Compacte variant: één regel met een klein icoon ernaast in plaats van een
   * gecentreerd blok van ~180px hoog.
   *
   * Op een overzichtspagina met meerdere secties (klantdossier) stapelen die
   * grote blokken op tot een pagina die eindeloos doorloopt terwijl er niets
   * te zien is. Een lege sectie hoort de kleinste sectie te zijn, niet de
   * grootste.
   */
  compact?: boolean;
}

/**
 * Beperkt blad-lijnmotief in merkgroen (WS10, critique "merk-delight"):
 * alleen in de compacte variant, en alleen als de aanroeper geen eigen icoon
 * meegeeft. Decoratief (aria-hidden), lijnwerk op currentColor.
 */
function BladMotief() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0 text-primary/70"
    >
      <path d="M2.5 13.5C2.5 7.5 6.5 3 13.5 2.5 13 9.5 8.5 13.5 2.5 13.5Z" />
      <path d="M3.5 12.5C6 9.5 8.5 7 12 3.9" />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 py-3 text-sm",
          className
        )}
      >
        {icon ? (
          <div className="size-4 shrink-0 text-muted-foreground [&>svg]:size-full">
            {icon}
          </div>
        ) : (
          <BladMotief />
        )}
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{title}</span>
          {description && <span className="ml-1.5">{description}</span>}
        </p>
        {action && (
          <Button
            size="sm"
            variant={action.variant ?? "outline"}
            onClick={action.onClick}
            className="ml-auto"
          >
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    );
  }

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
