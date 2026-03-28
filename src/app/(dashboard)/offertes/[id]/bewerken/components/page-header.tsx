"use client";

import { PageHeader as GlobalPageHeader } from "@/components/page-header";

interface PageHeaderProps {
  offerteId?: string;
  offerteNummer?: string;
}

export function PageHeader({ offerteId, offerteNummer }: PageHeaderProps) {
  const customLabels: Record<string, string> = {};
  if (offerteId && offerteNummer) {
    customLabels[`/offertes/${offerteId}`] = offerteNummer;
  }

  return <GlobalPageHeader customLabels={customLabels} />;
}
