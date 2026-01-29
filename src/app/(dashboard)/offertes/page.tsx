"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Shovel,
  Trees,
  Search,
  Loader2,
  MoreHorizontal,
  Copy,
  Trash2,
  Eye,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { useCurrentUser } from "@/hooks/use-current-user";
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
    month: "short",
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

export default function OffertesPage() {
  const { isLoading: isUserLoading } = useCurrentUser();
  const { offertes, stats, isLoading: isOffertesLoading, delete: deleteOfferte, duplicate } = useOffertes();
  const { getNextNummer } = useInstellingen();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("alle");

  const isLoading = isUserLoading || isOffertesLoading;

  const filteredOffertes = offertes?.filter((offerte) => {
    const matchesSearch =
      searchQuery === "" ||
      offerte.klant.naam.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offerte.offerteNummer.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      activeTab === "alle" || offerte.status === activeTab;

    return matchesSearch && matchesStatus;
  });

  const handleDuplicate = async (offerteId: string) => {
    try {
      const newNummer = await getNextNummer();
      await duplicate({ id: offerteId as any, newOfferteNummer: newNummer });
      toast.success("Offerte gedupliceerd");
    } catch (error) {
      toast.error("Fout bij dupliceren offerte");
      console.error(error);
    }
  };

  const handleDelete = async (offerteId: string) => {
    if (!confirm("Weet je zeker dat je deze offerte wilt verwijderen?")) return;
    try {
      await deleteOfferte({ id: offerteId as any });
      toast.success("Offerte verwijderd");
    } catch (error) {
      toast.error("Fout bij verwijderen offerte");
      console.error(error);
    }
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
              <BreadcrumbPage>Offertes</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Offertes
            </h1>
            <p className="text-muted-foreground">
              Beheer al je aanleg- en onderhoudsoffertes
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/offertes/nieuw/onderhoud">
                <Trees className="mr-2 h-4 w-4" />
                Onderhoud
              </Link>
            </Button>
            <Button asChild>
              <Link href="/offertes/nieuw/aanleg">
                <Shovel className="mr-2 h-4 w-4" />
                Aanleg
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op klantnaam of offertenummer..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="alle">
              Alle
              <Badge variant="secondary" className="ml-2">
                {stats?.totaal || 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="concept">
              Concept
              {(stats?.concept || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.concept}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="verzonden">
              Verzonden
              {(stats?.verzonden || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.verzonden}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="geaccepteerd">
              Geaccepteerd
              {(stats?.geaccepteerd || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.geaccepteerd}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="afgewezen">
              Afgewezen
              {(stats?.afgewezen || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.afgewezen}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : filteredOffertes && filteredOffertes.length > 0 ? (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Nummer</TableHead>
                      <TableHead>Klant</TableHead>
                      <TableHead>Plaats</TableHead>
                      <TableHead>Bedrag</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOffertes.map((offerte) => (
                      <TableRow key={offerte._id}>
                        <TableCell>
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                              offerte.type === "aanleg"
                                ? "bg-primary/10"
                                : "bg-green-100"
                            }`}
                          >
                            {offerte.type === "aanleg" ? (
                              <Shovel className="h-4 w-4 text-primary" />
                            ) : (
                              <Trees className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            href={`/offertes/${offerte._id}`}
                            className="hover:underline"
                          >
                            {offerte.offerteNummer}
                          </Link>
                        </TableCell>
                        <TableCell>{offerte.klant.naam}</TableCell>
                        <TableCell>{offerte.klant.plaats}</TableCell>
                        <TableCell>
                          {formatCurrency(offerte.totalen.totaalInclBtw)}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[offerte.status]}>
                            {offerte.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(offerte.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/offertes/${offerte._id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Bekijken
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDuplicate(offerte._id)}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Dupliceren
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(offerte._id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Verwijderen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">
                    {searchQuery ? "Geen resultaten" : "Geen offertes"}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
                    {searchQuery
                      ? `Geen offertes gevonden voor "${searchQuery}"`
                      : "Je hebt nog geen offertes aangemaakt. Maak je eerste offerte aan om te beginnen."}
                  </p>
                  {!searchQuery && (
                    <div className="mt-6 flex gap-2">
                      <Button asChild>
                        <Link href="/offertes/nieuw/aanleg">
                          <Plus className="mr-2 h-4 w-4" />
                          Nieuwe Aanleg Offerte
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/offertes/nieuw/onderhoud">
                          <Plus className="mr-2 h-4 w-4" />
                          Nieuwe Onderhoud Offerte
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
