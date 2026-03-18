import { FileText, Eye, Send, CheckCircle } from "lucide-react";

// Factuur status colors - WCAG AA compliant (4.5:1 contrast ratio)
export const statusColors: Record<string, string> = {
  concept: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  definitief: "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  verzonden: "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  betaald: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200",
  vervallen: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200",
};

// Factuur status labels
export const statusLabels: Record<string, string> = {
  concept: "Concept",
  definitief: "Definitief",
  verzonden: "Verzonden",
  betaald: "Betaald",
  vervallen: "Vervallen",
};

// Workflow steps for the invoice process
export const workflowSteps = [
  { id: "genereer", label: "Genereer", icon: FileText },
  { id: "controleer", label: "Controleer", icon: Eye },
  { id: "verstuur", label: "Verstuur", icon: Send },
  { id: "betaald", label: "Betaald", icon: CheckCircle },
];

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Get current workflow step based on factuur status
export function getWorkflowStep(status: string | null): number {
  if (!status) return 0;
  switch (status) {
    case "concept":
      return 1;
    case "definitief":
      return 2;
    case "verzonden":
      return 3;
    case "betaald":
      return 4;
    case "vervallen":
      return 3; // Same as verzonden but with warning
    default:
      return 0;
  }
}
