"use client";

import { FileText, Users, Search, Package, Activity } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface EmptyStateWithActionProps {
  onAction?: () => void;
}

export function NoOffertes({ onAction }: EmptyStateWithActionProps) {
  return (
    <EmptyState
      icon={<FileText />}
      title="Nog geen offertes"
      description="Je hebt nog geen offertes aangemaakt. Maak je eerste offerte om te beginnen."
      action={
        onAction
          ? {
              label: "Nieuwe offerte",
              onClick: onAction,
            }
          : undefined
      }
    />
  );
}

export function NoKlanten({ onAction }: EmptyStateWithActionProps) {
  return (
    <EmptyState
      icon={<Users />}
      title="Nog geen klanten"
      description="Je hebt nog geen klanten toegevoegd. Voeg je eerste klant toe om offertes te kunnen maken."
      action={
        onAction
          ? {
              label: "Klant toevoegen",
              onClick: onAction,
            }
          : undefined
      }
    />
  );
}

export function NoSearchResults({ onAction }: EmptyStateWithActionProps) {
  return (
    <EmptyState
      icon={<Search />}
      title="Geen resultaten gevonden"
      description="We konden geen resultaten vinden voor je zoekopdracht. Probeer andere zoektermen."
      action={
        onAction
          ? {
              label: "Zoekopdracht wissen",
              onClick: onAction,
              variant: "outline",
            }
          : undefined
      }
    />
  );
}

export function NoPrijsboekItems({ onAction }: EmptyStateWithActionProps) {
  return (
    <EmptyState
      icon={<Package />}
      title="Geen items in prijsboek"
      description="Je prijsboek is nog leeg. Voeg producten en diensten toe om ze in offertes te gebruiken."
      action={
        onAction
          ? {
              label: "Item toevoegen",
              onClick: onAction,
            }
          : undefined
      }
    />
  );
}

export function NoRecentActivity({ onAction }: EmptyStateWithActionProps) {
  return (
    <EmptyState
      icon={<Activity />}
      title="Geen recente activiteit"
      description="Er is nog geen activiteit om te tonen. Begin met het aanmaken van offertes of klanten."
      action={
        onAction
          ? {
              label: "Aan de slag",
              onClick: onAction,
            }
          : undefined
      }
    />
  );
}
