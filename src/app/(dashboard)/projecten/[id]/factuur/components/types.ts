import { FileText, Eye, Send, CheckCircle } from "lucide-react";
import { FACTUUR_STATUS_CONFIG, statusClasses } from "@/lib/constants/statuses";

// Statuskleuren/-labels uit de centrale bron (WS4): zelfde status = zelfde kleur.
export const statusColors: Record<string, string> = Object.fromEntries(
  Object.entries(FACTUUR_STATUS_CONFIG).map(([key, config]) => [
    key,
    statusClasses(config),
  ])
);

export const statusLabels: Record<string, string> = Object.fromEntries(
  Object.entries(FACTUUR_STATUS_CONFIG).map(([key, config]) => [key, config.label])
);

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
