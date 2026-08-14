"use client";

import { FileText, Users, Search, Package, Activity, Shovel, Trees, ArrowRight, Lightbulb, CheckCircle2, FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface EmptyStateWithActionProps {
  onAction?: () => void;
}

export function NoOffertes(_props: EmptyStateWithActionProps) {
  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <FileText className="h-10 w-10 text-primary" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold tracking-tight">
                Welkom bij Top Tuinen OS
              </h2>
              <p className="mt-2 text-muted-foreground">
                Begin met het maken van je eerste offerte. Kies tussen een aanleg- of onderhoudsofferte
                en volg de wizard voor een snelle en complete offerte.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Start Options */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
          <Link href="/offertes/nieuw/aanleg" className="block">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Shovel className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    Aanleg Offerte
                  </CardTitle>
                  <CardDescription>
                    Voor tuinaanleg projecten
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Grondwerk, bestrating, borders
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Houtwerk, verlichting, specials
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Automatische urenberekening
                </li>
              </ul>
              <div className="mt-4 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Start aanleg offerte
                <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
          <Link href="/offertes/nieuw/onderhoud" className="block">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Trees className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    Onderhoud Offerte
                  </CardTitle>
                  <CardDescription>
                    Voor tuinonderhoud contracten
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Gras, borders, heggen onderhoud
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Bomen snoei, bladruimen
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Periodieke werkzaamheden
                </li>
              </ul>
              <div className="mt-4 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Start onderhoud offerte
                <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Tips Section */}
      <Card className="bg-status-herinnering/40 border-status-herinnering-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-status-herinnering-text" />
            Tips voor je eerste offerte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-status-herinnering-text font-bold shrink-0">1.</span>
              <span><strong>Snelstart pakketten:</strong> Kies een vooraf ingesteld pakket voor veelvoorkomende projecten.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-status-herinnering-text font-bold shrink-0">2.</span>
              <span><strong>Klantgegevens:</strong> Selecteer een bestaande klant of voer nieuwe gegevens in.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-status-herinnering-text font-bold shrink-0">3.</span>
              <span><strong>Voorcalculatie:</strong> Na het aanmaken kun je de teamplanning en geschatte duur bepalen.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
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
    <div className="space-y-8">
      {/* Welcome Section */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <FolderKanban className="h-10 w-10 text-primary" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold tracking-tight">
                Nog geen projecten
              </h2>
              <p className="mt-2 text-muted-foreground">
                Projecten worden aangemaakt vanuit geaccepteerde offertes.
                Accepteer een offerte om een project te starten met voorcalculatie, planning en nacalculatie.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Start Option */}
      <Card className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
        <Link href="/offertes?status=geaccepteerd" className="block">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">
                  Bekijk Geaccepteerde Offertes
                </CardTitle>
                <CardDescription>
                  Start een project vanuit een geaccepteerde offerte
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Voorcalculatie uit offerte wordt overgenomen
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Plan taken en team
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Registreer uren en maak nacalculatie
              </li>
            </ul>
            <div className="mt-4 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Bekijk offertes
              <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          </CardContent>
        </Link>
      </Card>

      {/* Tips Section */}
      <Card className="bg-status-gepland/40 border-status-gepland-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-status-gepland-text" />
            Workflow tip
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-status-gepland-text font-bold shrink-0">1.</span>
              <span><strong>Offerte:</strong> Maak een offerte aan en vul de voorcalculatie in.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-status-gepland-text font-bold shrink-0">2.</span>
              <span><strong>Verzend:</strong> Stuur de offerte naar de klant en wacht op acceptatie.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-status-gepland-text font-bold shrink-0">3.</span>
              <span><strong>Project:</strong> Na acceptatie start je een project voor planning en uitvoering.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
