"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

export type PDFGenerationStep =
  | "preparing" // Data voorbereiden
  | "generating" // PDF genereren
  | "uploading" // Uploaden naar storage
  | "complete" // Klaar
  | "error"; // Fout opgetreden

interface PDFProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStep: PDFGenerationStep;
  progress?: number; // 0-100, optioneel voor generating step
  error?: string;
  onRetry?: () => void;
  onDownload?: () => void;
  downloadUrl?: string;
}

const STEP_LABELS: Record<PDFGenerationStep, string> = {
  preparing: "Gegevens voorbereiden...",
  generating: "PDF genereren...",
  uploading: "Bestand uploaden...",
  complete: "PDF is klaar!",
  error: "Er ging iets mis",
};

const STEPS: Array<{ key: PDFGenerationStep; label: string }> = [
  { key: "preparing", label: "Data voorbereiden" },
  { key: "generating", label: "PDF genereren" },
  { key: "uploading", label: "Uploaden" },
  { key: "complete", label: "Klaar" },
];

function getStepIndex(step: PDFGenerationStep): number {
  if (step === "error") return -1;
  return STEPS.findIndex((s) => s.key === step);
}

function StepIcon({
  step,
  currentStep,
  index,
}: {
  step: (typeof STEPS)[number];
  currentStep: PDFGenerationStep;
  index: number;
}) {
  const currentIndex = getStepIndex(currentStep);
  const isComplete = currentIndex > index || currentStep === "complete";
  const isActive = currentIndex === index && currentStep !== "error";
  const isError = currentStep === "error" && currentIndex === index;

  if (isComplete) {
    return (
      <CheckCircle2
        className="h-5 w-5 text-green-600 dark:text-green-500"
        aria-hidden="true"
      />
    );
  }

  if (isActive) {
    return (
      <Loader2
        className="h-5 w-5 animate-spin text-primary"
        aria-hidden="true"
      />
    );
  }

  if (isError) {
    return (
      <XCircle
        className="h-5 w-5 text-destructive"
        aria-hidden="true"
      />
    );
  }

  return (
    <Circle
      className="h-5 w-5 text-muted-foreground/40"
      aria-hidden="true"
    />
  );
}

export function PDFProgressModal({
  open,
  onOpenChange,
  currentStep,
  progress,
  error,
  onRetry,
  onDownload,
  downloadUrl,
}: PDFProgressModalProps) {
  const isGenerating =
    currentStep !== "complete" && currentStep !== "error";

  // Prevent closing during generation
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isGenerating) {
      return; // Don't allow closing during generation
    }
    onOpenChange(newOpen);
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, "_blank");
    }
    onDownload?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isGenerating}
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (isGenerating) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isGenerating) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {currentStep === "error"
              ? "PDF generatie mislukt"
              : currentStep === "complete"
                ? "PDF succesvol gegenereerd"
                : "PDF wordt gegenereerd"}
          </DialogTitle>
          <DialogDescription>
            {STEP_LABELS[currentStep]}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Steps indicator */}
          <div className="space-y-3">
            {STEPS.map((step, index) => {
              const currentIndex = getStepIndex(currentStep);
              const isActive =
                currentIndex === index && currentStep !== "error";
              const isComplete =
                currentIndex > index || currentStep === "complete";

              return (
                <div
                  key={step.key}
                  className={cn(
                    "flex items-center gap-3 transition-opacity",
                    currentIndex < index && currentStep !== "error"
                      ? "opacity-40"
                      : "opacity-100"
                  )}
                >
                  <StepIcon
                    step={step}
                    currentStep={currentStep}
                    index={index}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isComplete && "text-green-600 dark:text-green-500",
                      isActive && "text-primary",
                      currentStep === "error" &&
                        currentIndex === index &&
                        "text-destructive"
                    )}
                  >
                    {step.label}
                  </span>

                  {/* Show progress percentage for generating step */}
                  {isActive &&
                    step.key === "generating" &&
                    typeof progress === "number" && (
                      <span className="ml-auto text-sm text-muted-foreground">
                        {Math.round(progress)}%
                      </span>
                    )}
                </div>
              );
            })}
          </div>

          {/* Progress bar for generating step */}
          {currentStep === "generating" && typeof progress === "number" && (
            <div className="mt-4">
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Error message */}
          {currentStep === "error" && error && (
            <div className="mt-4 rounded-md bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Success message */}
          {currentStep === "complete" && (
            <div className="mt-4 rounded-md bg-green-50 p-3 dark:bg-green-950/30">
              <p className="text-sm text-green-700 dark:text-green-400">
                Je PDF is klaar om te downloaden.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {currentStep === "error" && onRetry && (
            <Button onClick={onRetry} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Opnieuw proberen
            </Button>
          )}

          {currentStep === "complete" && (downloadUrl || onDownload) && (
            <Button onClick={handleDownload} variant="default">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          )}

          {(currentStep === "complete" || currentStep === "error") && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Sluiten
            </Button>
          )}
        </DialogFooter>

        {/* Screen reader announcement */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {STEP_LABELS[currentStep]}
          {currentStep === "generating" &&
            typeof progress === "number" &&
            ` ${Math.round(progress)} procent`}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Inline PDF Progress component for buttons/toolbars
interface InlinePDFProgressProps {
  step: PDFGenerationStep;
  progress?: number;
  className?: string;
}

export function InlinePDFProgress({
  step,
  progress,
  className,
}: InlinePDFProgressProps) {
  const isGenerating = step !== "complete" && step !== "error";

  if (step === "complete") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-sm",
          className
        )}
      >
        <CheckCircle2
          className="h-4 w-4 text-green-600 dark:text-green-500"
          aria-hidden="true"
        />
        <span className="text-green-700 dark:text-green-400">
          PDF klaar
        </span>
      </span>
    );
  }

  if (step === "error") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-sm",
          className
        )}
      >
        <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
        <span className="text-destructive">Fout opgetreden</span>
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-sm", className)}
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="h-4 w-4 animate-spin text-primary"
        aria-hidden="true"
      />
      <span className="text-muted-foreground">
        {step === "preparing" && "Voorbereiden..."}
        {step === "generating" &&
          (typeof progress === "number"
            ? `Genereren... ${Math.round(progress)}%`
            : "Genereren...")}
        {step === "uploading" && "Uploaden..."}
      </span>
    </span>
  );
}
