"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  History,
  FileText,
  Plus,
  Edit,
  RefreshCcw,
  Clock,
  RotateCcw,
  Eye,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useOfferte } from "@/hooks/use-offertes";
import { useOfferteVersions } from "@/hooks/use-offerte-versions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { OfferteHistorySkeleton } from "@/components/skeletons";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  if (hours < 24) return `${hours} uur geleden`;
  if (days === 1) return "Gisteren";
  if (days < 7) return `${days} dagen geleden`;
  return formatDateTime(timestamp);
}

const actieIcons: Record<string, typeof History> = {
  aangemaakt: Plus,
  gewijzigd: Edit,
  status_gewijzigd: RefreshCcw,
  regels_gewijzigd: FileText,
  teruggedraaid: RotateCcw,
};

const actieColors: Record<string, string> = {
  aangemaakt: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  gewijzigd: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  status_gewijzigd: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  regels_gewijzigd: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  teruggedraaid: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

const statusLabels: Record<string, string> = {
  concept: "Concept",
  definitief: "Definitief",
  verzonden: "Verzonden",
  geaccepteerd: "Geaccepteerd",
  afgewezen: "Afgewezen",
};

const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  houtwerk: "Houtwerk",
  schuttingen: "Schuttingen",
  waterpartijen: "Waterpartijen",
  verlichting: "Verlichting",
  gras: "Gras",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
};

type VersionSnapshot = {
  status: string;
  klant: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
  };
  algemeenParams: {
    bereikbaarheid: string;
    achterstalligheid?: string;
  };
  scopes?: string[];
  scopeData?: unknown;
  totalen: {
    materiaalkosten: number;
    arbeidskosten: number;
    totaalUren: number;
    subtotaal: number;
    marge: number;
    margePercentage: number;
    totaalExBtw: number;
    btw: number;
    totaalInclBtw: number;
  };
  regels: Array<{
    id: string;
    scope: string;
    omschrijving: string;
    eenheid: string;
    hoeveelheid: number;
    prijsPerEenheid: number;
    totaal: number;
    type: string;
  }>;
  notities?: string;
};

type Version = {
  _id: Id<"offerte_versions">;
  offerteId: Id<"offertes">;
  userId: Id<"users">;
  versieNummer: number;
  snapshot: VersionSnapshot;
  actie: string;
  omschrijving: string;
  createdAt: number;
};

export default function OfferteHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { offerte, isLoading: offerteLoading } = useOfferte(id as Id<"offertes">);
  const { versions, isLoading: versionsLoading, rollback } = useOfferteVersions(
    id as Id<"offertes">
  );
  const { user } = useCurrentUser();

  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [rollbackVersion, setRollbackVersion] = useState<Version | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const isLoading = offerteLoading || versionsLoading;

  const handleRollback = async () => {
    if (!rollbackVersion || !user) return;

    setIsRollingBack(true);
    try {
      await rollback(rollbackVersion._id, user._id);
      toast.success(`Teruggedraaid naar versie ${rollbackVersion.versieNummer}`);
      setRollbackVersion(null);
      router.push(`/offertes/${id}`);
    } catch (error) {
      toast.error("Fout bij terugdraaien");
      console.error(error);
    } finally {
      setIsRollingBack(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/offertes">Offertes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Laden...</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
          <OfferteHistorySkeleton />
        </div>
      </>
    );
  }

  if (!offerte) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/offertes">Offertes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Niet gevonden</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                Offerte niet gevonden
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                De offerte met ID &quot;{id}&quot; bestaat niet.
              </p>
              <Button asChild className="mt-4">
                <Link href="/offertes">Terug naar Offertes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/offertes">Offertes</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/offertes/${id}`}>
                {offerte.offerteNummer}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Geschiedenis</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/offertes/${id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <History className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Versiegeschiedenis
                </h1>
                <p className="text-muted-foreground">
                  {offerte.offerteNummer} • {versions.length} versie
                  {versions.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Version Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Tijdlijn</CardTitle>
            <CardDescription>
              Alle wijzigingen aan deze offerte, van nieuw naar oud
            </CardDescription>
          </CardHeader>
          <CardContent>
            {versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  Geen versiegeschiedenis beschikbaar
                </p>
              </div>
            ) : (
              <div className="relative">
                {versions.map((version, index) => {
                  const Icon = actieIcons[version.actie] || Edit;
                  const isFirst = index === 0;
                  const isLast = index === versions.length - 1;

                  return (
                    <div
                      key={version._id}
                      className={cn(
                        "relative flex gap-4",
                        !isLast && "pb-8"
                      )}
                    >
                      {/* Timeline line */}
                      {!isLast && (
                        <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-border" />
                      )}

                      {/* Icon */}
                      <div
                        className={cn(
                          "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-background",
                          actieColors[version.actie] || "bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge
                            variant={isFirst ? "default" : "secondary"}
                            className="shrink-0"
                          >
                            v{version.versieNummer}
                          </Badge>
                          <span className="font-medium">
                            {version.omschrijving}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatRelativeTime(version.createdAt)}
                          </span>
                          <span>•</span>
                          <span>
                            Status: {statusLabels[version.snapshot.status]}
                          </span>
                          <span>•</span>
                          <span>
                            {formatCurrency(version.snapshot.totalen.totaalInclBtw)}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedVersion(version as Version)}
                          >
                            <Eye className="mr-2 h-3.5 w-3.5" />
                            Bekijken
                          </Button>
                          {!isFirst && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRollbackVersion(version as Version)}
                            >
                              <RotateCcw className="mr-2 h-3.5 w-3.5" />
                              Herstellen
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Version Detail Dialog */}
      <Dialog
        open={!!selectedVersion}
        onOpenChange={() => setSelectedVersion(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Versie {selectedVersion?.versieNummer}
              <Badge variant="secondary">
                {selectedVersion?.actie && statusLabels[selectedVersion.snapshot.status]}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {selectedVersion && formatDateTime(selectedVersion.createdAt)}
              {" • "}
              {selectedVersion?.omschrijving}
            </DialogDescription>
          </DialogHeader>

          {selectedVersion && (
            <div className="space-y-6">
              {/* Klantgegevens */}
              <div>
                <h4 className="font-medium mb-2">Klantgegevens</h4>
                <div className="grid gap-2 text-sm bg-muted/50 p-3 rounded-lg">
                  <p>
                    <span className="text-muted-foreground">Naam:</span>{" "}
                    {selectedVersion.snapshot.klant.naam}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Adres:</span>{" "}
                    {selectedVersion.snapshot.klant.adres},{" "}
                    {selectedVersion.snapshot.klant.postcode}{" "}
                    {selectedVersion.snapshot.klant.plaats}
                  </p>
                </div>
              </div>

              {/* Scopes */}
              {selectedVersion.snapshot.scopes &&
                selectedVersion.snapshot.scopes.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Werkzaamheden</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedVersion.snapshot.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary">
                          {scopeLabels[scope] || scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              {/* Regels */}
              {selectedVersion.snapshot.regels.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">
                    Regels ({selectedVersion.snapshot.regels.length})
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Omschrijving</TableHead>
                          <TableHead className="text-right">Hoeveelheid</TableHead>
                          <TableHead className="text-right">Totaal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedVersion.snapshot.regels.slice(0, 10).map((regel) => (
                          <TableRow key={regel.id}>
                            <TableCell>
                              <p className="font-medium">{regel.omschrijving}</p>
                              <p className="text-xs text-muted-foreground">
                                {scopeLabels[regel.scope] || regel.scope}
                              </p>
                            </TableCell>
                            <TableCell className="text-right">
                              {regel.hoeveelheid} {regel.eenheid}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(regel.totaal)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {selectedVersion.snapshot.regels.length > 10 && (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="text-center text-muted-foreground"
                            >
                              + {selectedVersion.snapshot.regels.length - 10} meer
                              regels
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Totalen */}
              <div>
                <h4 className="font-medium mb-2">Totalen</h4>
                <div className="bg-muted/50 p-3 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Materiaalkosten</span>
                    <span>
                      {formatCurrency(selectedVersion.snapshot.totalen.materiaalkosten)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Arbeidskosten</span>
                    <span>
                      {formatCurrency(selectedVersion.snapshot.totalen.arbeidskosten)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotaal</span>
                    <span>
                      {formatCurrency(selectedVersion.snapshot.totalen.subtotaal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Marge ({selectedVersion.snapshot.totalen.margePercentage}%)
                    </span>
                    <span>
                      {formatCurrency(selectedVersion.snapshot.totalen.marge)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Totaal incl. BTW</span>
                    <span>
                      {formatCurrency(selectedVersion.snapshot.totalen.totaalInclBtw)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation */}
      <AlertDialog
        open={!!rollbackVersion}
        onOpenChange={() => setRollbackVersion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Versie herstellen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je de offerte wilt terugdraaien naar versie{" "}
              {rollbackVersion?.versieNummer}? De huidige gegevens worden eerst
              opgeslagen als nieuwe versie, dus je kunt dit ongedaan maken.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingBack}>
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRollback} disabled={isRollingBack}>
              {isRollingBack ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Herstellen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
