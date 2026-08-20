"use client";

import type { ReactNode } from "react";
import { FileText, Users, Search, Package, Activity, FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateWithActionProps {
  onAction?: () => void;
}

/**
 * Lege lijst op een overzichtspagina: één rustige meldingskaart — icoon,
 * titel, één zin. De acties (nieuwe offerte, offertes bekijken) zitten al in
 * de paginakop; die hier herhalen als grote klik-kaarten en tips maakt van
 * "er is niets" het drukste scherm van de app.
 */
function LegeLijstKaart({
  icoon,
  titel,
  omschrijving,
}: {
  icoon: ReactNode;
  titel: string;
  omschrijving: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 px-6 py-8 text-center sm:flex-row sm:gap-6 sm:text-left">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary [&>svg]:size-7">
          {icoon}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{titel}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{omschrijving}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function NoOffertes(_props: EmptyStateWithActionProps) {
  return (
    <LegeLijstKaart
      icoon={<FileText />}
      titel="Nog geen offertes"
      omschrijving="Maak je eerste offerte via de knop Nieuwe offerte rechtsboven — kies aanleg of onderhoud en volg de wizard."
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

export function NoProjecten(_props: EmptyStateWithActionProps) {
  return (
    <LegeLijstKaart
      icoon={<FolderKanban />}
      titel="Nog geen projecten"
      omschrijving="Projecten worden aangemaakt vanuit geaccepteerde offertes. Accepteer een offerte om een project te starten met voorcalculatie, planning en nacalculatie."
    />
  );
}
