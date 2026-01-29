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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  FileText,
  Edit,
  Send,
  ArrowLeft,
  Loader2,
  Shovel,
  Trees,
  User,
  MapPin,
  Phone,
  Mail,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  Trash2,
} from "lucide-react";
import { useOfferte, useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { PDFDownloadButton } from "@/components/pdf";
import { Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

const statusColors: Record<string, string> = {
  concept: "bg-gray-100 text-gray-800",
  definitief: "bg-blue-100 text-blue-800",
  verzonden: "bg-yellow-100 text-yellow-800",
  geaccepteerd: "bg-green-100 text-green-800",
  afgewezen: "bg-red-100 text-red-800",
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

export default function OfferteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { offerte, isLoading } = useOfferte(id as Id<"offertes">);
  const { updateStatus, delete: deleteOfferte, duplicate } = useOffertes();
  const { getNextNummer, instellingen } = useInstellingen();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (
    newStatus: "concept" | "definitief" | "verzonden" | "geaccepteerd" | "afgewezen"
  ) => {
    if (!offerte) return;
    setIsUpdating(true);
    try {
      await updateStatus({ id: offerte._id, status: newStatus });
      toast.success(`Status gewijzigd naar ${statusLabels[newStatus]}`);
    } catch (error) {
      toast.error("Fout bij wijzigen status");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDuplicate = async () => {
    if (!offerte) return;
    try {
      const newNummer = await getNextNummer();
      await duplicate({ id: offerte._id, newOfferteNummer: newNummer });
      toast.success("Offerte gedupliceerd");
    } catch (error) {
      toast.error("Fout bij dupliceren offerte");
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!offerte) return;
    try {
      await deleteOfferte({ id: offerte._id });
      toast.success("Offerte verwijderd");
      router.push("/offertes");
    } catch (error) {
      toast.error("Fout bij verwijderen offerte");
      console.error(error);
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

        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Offerte laden...</p>
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

        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                Offerte niet gevonden
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                De offerte met ID &quot;{id}&quot; bestaat niet of je hebt geen
                toegang.
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

  const bereikbaarheidLabels: Record<string, string> = {
    goed: "Goed",
    beperkt: "Beperkt",
    slecht: "Slecht",
  };

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
              <BreadcrumbPage>{offerte.offerteNummer}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/offertes">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  offerte.type === "aanleg" ? "bg-primary/10" : "bg-green-100"
                }`}
              >
                {offerte.type === "aanleg" ? (
                  <Shovel className="h-5 w-5 text-primary" />
                ) : (
                  <Trees className="h-5 w-5 text-green-600" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">
                    {offerte.offerteNummer}
                  </h1>
                  <Badge className={statusColors[offerte.status]}>
                    {statusLabels[offerte.status]}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  {offerte.type === "aanleg" ? "Aanleg" : "Onderhoud"} offerte •
                  Aangemaakt op {formatDate(offerte.createdAt)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isUpdating}>
                  {isUpdating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Clock className="mr-2 h-4 w-4" />
                  )}
                  Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleStatusChange("concept")}>
                  <Clock className="mr-2 h-4 w-4" />
                  Concept
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleStatusChange("definitief")}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Definitief
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleStatusChange("verzonden")}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Verzonden
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleStatusChange("geaccepteerd")}
                >
                  <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                  Geaccepteerd
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleStatusChange("afgewezen")}
                >
                  <XCircle className="mr-2 h-4 w-4 text-red-600" />
                  Afgewezen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" asChild>
              <Link href={`/offertes/${id}/bewerken`}>
                <Edit className="mr-2 h-4 w-4" />
                Bewerken
              </Link>
            </Button>

            <PDFDownloadButton
              offerte={offerte}
              bedrijfsgegevens={instellingen?.bedrijfsgegevens}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="mr-2 h-4 w-4" />
                  Dupliceren
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Verwijderen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left column - Details */}
          <div className="space-y-4 lg:col-span-2">
            {/* Klantgegevens */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Klantgegevens
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Naam
                  </p>
                  <p className="text-lg font-semibold">{offerte.klant.naam}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Adres
                  </p>
                  <p className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {offerte.klant.adres}, {offerte.klant.postcode}{" "}
                    {offerte.klant.plaats}
                  </p>
                </div>
                {offerte.klant.email && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      E-mail
                    </p>
                    <p className="flex items-center gap-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {offerte.klant.email}
                    </p>
                  </div>
                )}
                {offerte.klant.telefoon && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Telefoon
                    </p>
                    <p className="flex items-center gap-1">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {offerte.klant.telefoon}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scopes */}
            {offerte.scopes && offerte.scopes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Werkzaamheden</CardTitle>
                  <CardDescription>
                    Geselecteerde scopes voor deze offerte
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {offerte.scopes.map((scope) => (
                      <Badge key={scope} variant="secondary">
                        {scopeLabels[scope] || scope}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">
                      Bereikbaarheid:{" "}
                      <span className="font-medium text-foreground">
                        {bereikbaarheidLabels[offerte.algemeenParams.bereikbaarheid]}
                      </span>
                    </p>
                    {offerte.algemeenParams.achterstalligheid && (
                      <p className="text-sm text-muted-foreground">
                        Achterstalligheid:{" "}
                        <span className="font-medium text-foreground capitalize">
                          {offerte.algemeenParams.achterstalligheid}
                        </span>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Regels */}
            <Card>
              <CardHeader>
                <CardTitle>Offerteregels</CardTitle>
                <CardDescription>
                  {offerte.regels.length > 0
                    ? `${offerte.regels.length} regel${offerte.regels.length === 1 ? "" : "s"}`
                    : "Nog geen regels toegevoegd"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {offerte.regels.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Omschrijving</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead className="text-right">Hoeveelheid</TableHead>
                        <TableHead className="text-right">Prijs</TableHead>
                        <TableHead className="text-right">Totaal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offerte.regels.map((regel) => (
                        <TableRow key={regel.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{regel.omschrijving}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {regel.type}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {scopeLabels[regel.scope] || regel.scope}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {regel.hoeveelheid} {regel.eenheid}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(regel.prijsPerEenheid)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(regel.totaal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">
                      Er zijn nog geen regels toegevoegd aan deze offerte.
                    </p>
                    <Button asChild className="mt-4">
                      <Link href={`/offertes/${id}/bewerken`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Regels toevoegen
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notities */}
            {offerte.notities && (
              <Card>
                <CardHeader>
                  <CardTitle>Notities</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {offerte.notities}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column - Totals */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Totalen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Materiaalkosten</span>
                  <span>{formatCurrency(offerte.totalen.materiaalkosten)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Arbeidskosten</span>
                  <span>{formatCurrency(offerte.totalen.arbeidskosten)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    ({offerte.totalen.totaalUren} uur)
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotaal</span>
                  <span>{formatCurrency(offerte.totalen.subtotaal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Marge ({offerte.totalen.margePercentage}%)
                  </span>
                  <span>{formatCurrency(offerte.totalen.marge)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Totaal excl. BTW</span>
                  <span>{formatCurrency(offerte.totalen.totaalExBtw)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BTW (21%)</span>
                  <span>{formatCurrency(offerte.totalen.btw)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Totaal incl. BTW</span>
                  <span>{formatCurrency(offerte.totalen.totaalInclBtw)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tijdlijn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Aangemaakt</span>
                  <span>{formatDate(offerte.createdAt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Laatst gewijzigd
                  </span>
                  <span>{formatDate(offerte.updatedAt)}</span>
                </div>
                {offerte.verzondenAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Verzonden</span>
                    <span>{formatDate(offerte.verzondenAt)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Offerte verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je offerte {offerte.offerteNummer} wilt
              verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
