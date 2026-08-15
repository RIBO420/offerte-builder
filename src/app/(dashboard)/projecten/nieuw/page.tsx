"use client";
import { klantNaam } from "@convex/lib/offerteKlant";
import { heeftVoorcalculatieStap } from "@convex/acceptatieRegels";

import { Suspense, useCallback, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PaginaReveal, REVEAL_KLASSE } from "@/components/pagina-reveal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  FolderKanban,
  FileText,
  User,
  MapPin,
  ChevronRight,
  AlertCircle,
  Calculator,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { formatCurrency } from "@/lib/format/currency";
import { LaadIndicator } from "@/components/ui/laad-indicator";

export default function NieuwProjectPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <NieuwProjectPageContent />
    </Suspense>
  );
}

function PageLoader() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 items-center justify-center">
        <LaadIndicator formaat="pagina" />
      </div>
    </>
  );
}

function NieuwProjectPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isUserLoading } = useCurrentUser();

  const offerteId = searchParams.get("offerte") as Id<"offertes"> | null;

  // Get offerte if provided
  const offerte = useQuery(
    api.offertes.get,
    offerteId && user?._id ? { id: offerteId } : "skip"
  );

  // Check if project already exists
  const existingProject = useQuery(
    api.projecten.getByOfferte,
    offerteId && user?._id ? { offerteId } : "skip"
  );

  // Voorcalculatie van de offerte — alleen de aanleg-wizard kent die stap
  // (vrije offertes en onderhoud hebben per ontwerp geen record). Zonder deze
  // check kreeg de gebruiker pas ná het klikken een serverfout te zien.
  const voorcalculatie = useQuery(
    api.voorcalculaties.getByOfferte,
    offerteId && user?._id ? { offerteId } : "skip"
  );

  // Create project mutation
  const createProject = useMutation(api.projecten.create);

  const [projectNaam, setProjectNaam] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isLoading =
    isUserLoading ||
    (offerteId && (offerte === undefined || voorcalculatie === undefined));

  // Ontbreekt de voorcalculatie waar de flow die wél voorschrijft, dan is de
  // voorcalculatiepagina de volgende stap — niet de knop hieronder.
  const voorcalculatieOntbreekt =
    offerte !== null &&
    offerte !== undefined &&
    heeftVoorcalculatieStap(offerte) &&
    voorcalculatie === null;

  // Default project name
  const defaultNaam = offerte
    ? `Project ${offerte.offerteNummer} - ${klantNaam(offerte.klant)}`
    : "";

  const handleCreate = useCallback(async () => {
    if (!offerteId) {
      toast.error("Selecteer een offerte");
      return;
    }

    setIsCreating(true);
    try {
      const projectId = await createProject({
        offerteId,
        naam: projectNaam || defaultNaam,
      });
      toast.success("Project aangemaakt - start met planning");
      // Projects now start at "gepland" status, voorcalculatie is at offerte level
      router.push(`/projecten/${projectId}/planning`);
    } catch (error) {
      const melding = getMutationErrorMessage(error);
      // Check if it's a duplicate project error (race condition)
      if (melding.includes("bestaat al een project")) {
        toast.info("Er bestaat al een project voor deze offerte", {
          description: "Je wordt doorgestuurd naar het bestaande project.",
        });
        // Trigger a re-fetch which will redirect automatically
        setIsRedirecting(true);
        return;
      }
      // Ontbrekende voorcalculatie is geen doodlopende weg: wijs de pagina aan
      if (melding.includes("voorcalculatie")) {
        toast.error("Eerst de voorcalculatie invullen", {
          description:
            "Deze offerte heeft nog geen voorcalculatie. Vul die eerst in bij de offerte, daarna kun je het project starten.",
          action: {
            label: "Naar voorcalculatie",
            onClick: () => router.push(`/offertes/${offerteId}/voorcalculatie`),
          },
        });
        return;
      }
      toast.error(melding);
    } finally {
      setIsCreating(false);
    }
  }, [offerteId, projectNaam, defaultNaam, createProject, router]);

  // Redirect if project already exists
  useEffect(() => {
    if (existingProject && !isRedirecting) {
      setIsRedirecting(true);
      toast.info("Er bestaat al een project voor deze offerte", {
        description: "Je wordt doorgestuurd naar het bestaande project.",
      });
      router.replace(`/projecten/${existingProject._id}`);
    }
  }, [existingProject, isRedirecting, router]);

  if (isLoading || existingProject || isRedirecting) {
    return <PageLoader />;
  }

  return (
    <>
      <PageHeader />

      <PaginaReveal className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className={`flex items-center gap-4 ${REVEAL_KLASSE}`}>
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Terug naar projecten">
            <Link href="/projecten">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Nieuw Project
              </h1>
              <p className="text-muted-foreground">
                Maak een project aan vanuit een geaccepteerde offerte
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Offerte Info */}
          <div className={REVEAL_KLASSE}>
            {offerte ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Geselecteerde Offerte
                  </CardTitle>
                  <CardDescription>{offerte.offerteNummer}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Klant
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <p className="font-semibold">{klantNaam(offerte.klant)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Adres
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm">
                          {offerte.klant?.plaats ?? "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Offertebedrag
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(offerte.totalen.totaalInclBtw)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-muted-foreground">
                        Type
                      </p>
                      <p className="font-medium">
                        {offerte.type === "aanleg" ? "Aanleg" : "Onderhoud"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">
                    Geen offerte geselecteerd
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground text-center">
                    Ga naar de offertepagina en selecteer een geaccepteerde
                    offerte om een project aan te maken.
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/offertes?status=geaccepteerd">
                      Naar Offertes
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Project Form */}
          <div className={REVEAL_KLASSE}>
            <Card>
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
                <CardDescription>
                  Geef het project een naam en maak het aan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="project-naam">Projectnaam</Label>
                  <Input
                    id="project-naam"
                    placeholder={defaultNaam || "Voer een projectnaam in"}
                    value={projectNaam}
                    onChange={(e) => setProjectNaam(e.target.value)}
                    disabled={!offerte}
                  />
                  <p className="text-xs text-muted-foreground">
                    Laat leeg om de standaard naam te gebruiken
                  </p>
                </div>

                {voorcalculatieOntbreekt ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    <p className="font-medium mb-1 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      Eerst de voorcalculatie
                    </p>
                    <p className="text-muted-foreground">
                      Deze offerte doorloopt de voorcalculatiestap, maar er is
                      nog geen voorcalculatie ingevuld. Vul die eerst in bij de
                      offerte; daarna kun je het project starten.
                    </p>
                  </div>
                ) : offerte ? (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="font-medium text-muted-foreground mb-1">
                      Voorcalculatie uit offerte
                    </p>
                    <p className="text-muted-foreground">
                      {voorcalculatie
                        ? "De voorcalculatiegegevens worden overgenomen uit de offerte en zijn beschikbaar als referentie in het project."
                        : "Deze offerte kent geen voorcalculatiestap; het project start zonder voorcalculatiegegevens."}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {voorcalculatieOntbreekt && offerteId ? (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      size="lg"
                      asChild
                    >
                      <Link href={`/offertes/${offerteId}/voorcalculatie`}>
                        <Calculator className="mr-2 h-4 w-4" />
                        Naar voorcalculatie
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      onClick={handleCreate}
                      disabled={!offerte || isCreating}
                      size="lg"
                    >
                      {isCreating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FolderKanban className="mr-2 h-4 w-4" />
                      )}
                      Project Aanmaken
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    asChild
                  >
                    <Link href="/projecten">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Terug naar Projecten
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PaginaReveal>
    </>
  );
}
