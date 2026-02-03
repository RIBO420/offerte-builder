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
      <div className="space-y-2">
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

        <Button variant="outline" className="w-full" onClick={onPrev}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          {getPrevButtonLabel()}
        </Button>

        <Button variant="ghost" className="w-full" asChild>
          <Link href="/offertes">Annuleren</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        disabled={isNextDisabled()}
        onClick={onNext}
      >
        {getNextButtonLabel()}
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>

      <Button variant="outline" className="w-full" onClick={onPrev}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        {getPrevButtonLabel()}
      </Button>

      <Button variant="ghost" className="w-full" asChild>
        <Link href="/offertes">Annuleren</Link>
      </Button>
    </div>
  );
}
