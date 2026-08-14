"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Check, Loader2 } from "lucide-react";

interface AanlegNavigationProps {
  currentStep: number;
  totalSteps: number;
  isStep1Valid: boolean;
  isStep2Valid: boolean;
  isSubmitting?: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSubmit?: () => void;
}

export function AanlegNavigation({
  currentStep,
  totalSteps,
  isStep1Valid,
  isStep2Valid,
  isSubmitting = false,
  onNext,
  onPrev,
  onSubmit,
}: AanlegNavigationProps) {
  // Get the label for the next button based on current step
  const getNextButtonLabel = () => {
    switch (currentStep) {
      case 0:
        return "Volgende: Klant & Scopes";
      case 1:
        return "Volgende: Scope Details";
      case 2:
        return "Volgende: Garantie";
      case 3:
        return "Volgende: Bevestigen";
      default:
        return "Volgende";
    }
  };

  // Get the label for the prev button based on current step
  const getPrevButtonLabel = () => {
    switch (currentStep) {
      case 1:
        return "Terug naar Template";
      case 2:
        return "Terug";
      case 3:
        return "Terug naar Scope Details";
      case 4:
        return "Terug naar Garantie";
      default:
        return "Terug";
    }
  };

  // Check if next button should be disabled
  const isNextDisabled = () => {
    switch (currentStep) {
      case 1:
        return !isStep1Valid;
      case 2:
        return !isStep2Valid;
      default:
        return false;
    }
  };

  // Don't render navigation for step 0 (template selection has its own navigation)
  if (currentStep === 0) {
    return null;
  }

  // Final step has different actions
  if (currentStep === totalSteps - 1) {
    return (
      <div className="space-y-3">
        <Button
          className="w-full"
          disabled={isSubmitting}
          onClick={onSubmit}
          size="lg"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Offerte Aanmaken
        </Button>

        {/* Eén primaire knop (WS6): terug en annuleren op tekstniveau */}
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={onPrev}
            className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {getPrevButtonLabel()}
          </button>
          <Link
            href="/offertes"
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Annuleren
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        className="w-full"
        disabled={isNextDisabled()}
        onClick={onNext}
      >
        {getNextButtonLabel()}
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>

      {/* Eén primaire knop (WS6): "Terug naar Template" en Annuleren zijn
          tekstlinks — drie gestapelde knoppen wedijverden om aandacht */}
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {getPrevButtonLabel()}
        </button>
        <Link
          href="/offertes"
          className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Annuleren
        </Link>
      </div>
    </div>
  );
}
