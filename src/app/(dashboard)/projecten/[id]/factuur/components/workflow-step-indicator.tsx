"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { workflowSteps } from "./types";

/**
 * De stappenbalk van de factuurflow.
 *
 * Was framer-motion met een stagger van 100 ms per stap. Dat betekende: valt
 * `requestAnimationFrame` stil (achtergrondtab, trage machine), dan blijft de
 * hele balk op `opacity: 0` staan — je ziet dan niet wáár in de flow je bent,
 * terwijl dat juist het enige is wat dit component doet.
 *
 * Nu CSS. De reveal draait met `fill-mode: none`, dus buiten de animatie geldt
 * altijd de eindstaat; de voortgangsstreep is een `transition` op `scale-x`,
 * en die interpoleert alleen maar naar een waarde die de stijl toch al heeft.
 * Zonder één frame staat de balk dus meteen goed.
 */
export function WorkflowStepIndicator({
  currentStep,
}: {
  currentStep: number;
  status: string | null;
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {workflowSteps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300 motion-safe:ease-out">
                <div
                  className={`
                    relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300
                    ${isCompleted ? "border-primary bg-primary text-primary-foreground" : ""}
                    ${isCurrent ? "border-primary bg-primary text-white ring-4 ring-primary/20" : ""}
                    ${isUpcoming ? "border-muted-foreground/30 bg-muted text-muted-foreground" : ""}
                  `}
                >
                  {isCompleted ? (
                    <div className="motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300">
                      <Check className="h-5 w-5" />
                    </div>
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-xs font-medium whitespace-nowrap
                    ${isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < workflowSteps.length - 1 && (
                <div className="flex-1 mx-2 h-0.5 rounded-full bg-muted-foreground/20 relative overflow-hidden">
                  {/* scaleX i.p.v. width (optimize O7): GPU-composited, geen
                      reflow per frame. Eindstanden zijn 0 of 1, dus de
                      border-radius vervormt in rust niet. Een `transition`
                      i.p.v. een JS-animatie: de eindwaarde staat in de klasse,
                      de overgang ernaartoe is de versiering. */}
                  <div
                    className={cn(
                      "absolute inset-0 origin-left bg-primary rounded-full transition-transform duration-500 ease-out motion-reduce:transition-none",
                      isCompleted ? "scale-x-100" : "scale-x-0"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
