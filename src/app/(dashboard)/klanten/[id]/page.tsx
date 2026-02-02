"use client";

import { use } from "react";
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
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  Plus,
  Loader2,
  ArrowLeft,
  Shovel,
  Trees,
  StickyNote,
} from "lucide-react";
import { useKlantWithOffertes } from "@/hooks/use-klanten";
import { Id } from "../../../../../convex/_generated/dataModel";

const statusColors: Record<string, string> = {
  concept: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  voorcalculatie: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  verzonden: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  geaccepteerd: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  afgewezen: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

const statusLabels: Record<string, string> = {
  concept: "Concept",
  voorcalculatie: "Voorcalculatie",
  verzonden: "Verzonden",
  geaccepteerd: "Geaccepteerd",
  afgewezen: "Afgewezen",
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export default function KlantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { klant, isLoading } = useKlantWithOffertes(id as Id<"klanten">);

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
                <BreadcrumbLink href="/klanten">Klanten</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Laden...</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!klant) {
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
                <BreadcrumbLink href="/klanten">Klanten</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Niet gevonden</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <User className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">Klant niet gevonden</h2>
          <Button variant="outline" onClick={() => router.push("/klanten")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar klanten
          </Button>
        </div>
      </>
    );
  }

  type OfferteWithTotals = {
    _id: Id<"offertes">;
    status: string;
    offerteNummer: string;
    type: string;
    createdAt: number;
    totalen?: {
      totaalInclBtw?: number;
    };
  };

  const offertes: OfferteWithTotals[] = klant.offertes || [];
  const totalValue = offertes.reduce(
    (sum, o) => sum + (o.totalen?.totaalInclBtw || 0),
    0
  );
  const acceptedValue = offertes
    .filter((o) => o.status === "geaccepteerd")
    .reduce((sum, o) => sum + (o.totalen?.totaalInclBtw || 0), 0);

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
              <BreadcrumbLink href="/klanten">Klanten</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{klant.naam}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Terug naar klanten">
              <Link href="/klanten">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {klant.naam}
              </h1>
              <p className="text-muted-foreground">
                Klant sinds {formatDate(klant.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/offertes/nieuw/aanleg">
                <Shovel className="mr-2 h-4 w-4" />
                Aanleg Offerte
              </Link>
            </Button>
            <Button asChild>
              <Link href="/offertes/nieuw/onderhoud">
                <Trees className="mr-2 h-4 w-4" />
                Onderhoud Offerte
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Contact Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contactgegevens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Adres</p>
                  <p className="text-sm text-muted-foreground">
                    {klant.adres}
                    <br />
                    {klant.postcode} {klant.plaats}
                  </p>
                </div>
              </div>

              {klant.telefoon && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Telefoon</p>
                    <p className="text-sm text-muted-foreground">
                      {klant.telefoon}
                    </p>
                  </div>
                </div>
              )}

              {klant.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">E-mail</p>
                    <p className="text-sm text-muted-foreground">
                      {klant.email}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Statistieken
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold">{offertes.length}</p>
                  <p className="text-sm text-muted-foreground">Offertes</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {offertes.filter((o) => o.status === "geaccepteerd").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Geaccepteerd</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Totale waarde</span>
                  <span className="font-medium">{formatCurrency(totalValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Geaccepteerd</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(acceptedValue)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StickyNote className="h-5 w-5" />
                Notities
              </CardTitle>
            </CardHeader>
            <CardContent>
              {klant.notities ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {klant.notities}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Geen notities
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Offertes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Offertes</CardTitle>
                <CardDescription>
                  Alle offertes voor {klant.naam}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {offertes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Nog geen offertes</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Maak de eerste offerte voor deze klant aan.
                </p>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" asChild>
                    <Link href="/offertes/nieuw/aanleg">
                      <Shovel className="mr-2 h-4 w-4" />
                      Aanleg
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/offertes/nieuw/onderhoud">
                      <Trees className="mr-2 h-4 w-4" />
                      Onderhoud
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nummer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Bedrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offertes.map((offerte) => (
                    <TableRow key={offerte._id}>
                      <TableCell>
                        <Link
                          href={`/offertes/${offerte._id}`}
                          className="font-medium hover:underline"
                        >
                          {offerte.offerteNummer}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {offerte.type === "aanleg" ? (
                            <Shovel className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Trees className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="capitalize">{offerte.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(offerte.createdAt)}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[offerte.status]}>
                          {statusLabels[offerte.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(offerte.totalen?.totaalInclBtw || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
