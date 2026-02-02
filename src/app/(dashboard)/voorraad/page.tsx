"use client";

import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { motion } from "framer-motion";
import { RequireAdmin } from "@/components/require-admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  Package,
  Search,
  AlertTriangle,
  MoreHorizontal,
  Edit,
  History,
  Loader2,
  Warehouse,
  TrendingDown,
  Euro,
} from "lucide-react";
import { toast } from "sonner";
import { VoorraadAdjustDialog, type VoorraadItem, type MutatieType } from "@/components/voorraad/voorraad-adjust-dialog";
import { VoorraadMutatiesDialog } from "@/components/voorraad/voorraad-mutaties-dialog";
import { useVoorraad, useVoorraadStats, useVoorraadMutaties, useVoorraadMutations } from "@/hooks/use-voorraad";
import type { Id } from "../../../../convex/_generated/dataModel";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function getStatusBadge(hoeveelheid: number, minVoorraad: number) {
  const percentage = (hoeveelheid / minVoorraad) * 100;

  if (percentage < 100) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Onder minimum
      </Badge>
    );
  } else if (percentage < 150) {
    return (
      <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
        Bijna minimum
      </Badge>
    );
  } else {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        Voldoende
      </Badge>
    );
  }
}

// Type for voorraad item from Convex (with product details)
interface ConvexVoorraadItem {
  _id: Id<"voorraad">;
  _creationTime: number;
  userId: Id<"users">;
  productId: Id<"producten">;
  hoeveelheid: number;
  minVoorraad?: number;
  maxVoorraad?: number;
  locatie?: string;
  notities?: string;
  laatsteBijwerking: number;
  product: {
    _id: Id<"producten">;
    productnaam: string;
    categorie: string;
    eenheid: string;
    inkoopprijs: number;
    verkoopprijs: number;
    isActief: boolean;
  } | null;
}

// Helper to convert Convex item to dialog format
function toDialogItem(item: ConvexVoorraadItem): VoorraadItem {
  return {
    _id: item._id,
    productnaam: item.product?.productnaam || "Onbekend product",
    hoeveelheid: item.hoeveelheid,
    eenheid: item.product?.eenheid || "stuks",
    minVoorraad: item.minVoorraad ?? 0,
    locatie: item.locatie || "Niet opgegeven",
    inkoopprijs: item.product?.inkoopprijs ?? 0,
  };
}

function VoorraadPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [showOnlyUnderMinimum, setShowOnlyUnderMinimum] = useState(false);

  // Convex hooks for real data
  const { voorraad, isLoading } = useVoorraad();
  const { stats: convexStats, isLoading: statsLoading } = useVoorraadStats();
  const { adjustStock } = useVoorraadMutations();

  // Dialog states
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showMutatiesDialog, setShowMutatiesDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VoorraadItem | null>(null);
  const [selectedVoorraadId, setSelectedVoorraadId] = useState<Id<"voorraad"> | null>(null);

  // Fetch mutaties for selected item
  const { mutaties: rawMutaties, isLoading: mutatiesLoading } = useVoorraadMutaties(selectedVoorraadId);

  // Filter items
  const filteredItems = useMemo(() => {
    return voorraad.filter((item) => {
      const productnaam = item.product?.productnaam || "";
      const locatie = item.locatie || "";

      const matchesSearch =
        debouncedSearchQuery === "" ||
        productnaam.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        locatie.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

      const minVoorraad = item.minVoorraad ?? 0;
      const matchesMinimumFilter = !showOnlyUnderMinimum || item.hoeveelheid < minVoorraad;

      return matchesSearch && matchesMinimumFilter;
    });
  }, [voorraad, debouncedSearchQuery, showOnlyUnderMinimum]);

  // Statistics from Convex
  const stats = useMemo(() => {
    return {
      totaalItems: convexStats?.aantalItems ?? 0,
      onderMinimum: convexStats?.aantalOnderMinimum ?? 0,
      totaleWaarde: convexStats?.totaleVoorraadwaarde ?? 0,
    };
  }, [convexStats]);

  const handleAdjustStock = async (data: {
    itemId: string;
    type: MutatieType;
    hoeveelheid: number;
    opmerking: string;
  }) => {
    try {
      await adjustStock({
        voorraadId: data.itemId as Id<"voorraad">,
        type: data.type,
        hoeveelheid: data.hoeveelheid,
        notities: data.opmerking || undefined,
      });
      toast.success("Voorraad succesvol aangepast");
    } catch (error) {
      console.error("Failed to adjust stock:", error);
      toast.error(error instanceof Error ? error.message : "Fout bij aanpassen voorraad");
    }
  };

  const handleOpenAdjustDialog = (item: ConvexVoorraadItem) => {
    setSelectedItem(toDialogItem(item));
    setShowAdjustDialog(true);
  };

  const handleOpenMutatiesDialog = (item: ConvexVoorraadItem) => {
    setSelectedItem(toDialogItem(item));
    setSelectedVoorraadId(item._id);
    setShowMutatiesDialog(true);
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
              <BreadcrumbPage>Voorraad</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Voorraad
            </h1>
            <p className="text-muted-foreground">
              Beheer je voorraad en volg mutaties
            </p>
          </div>
        </div>

        {/* Statistics cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Totaal Items</CardTitle>
              <Warehouse className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totaalItems}</div>
              <p className="text-xs text-muted-foreground">producten in voorraad</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Onder Minimum</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.onderMinimum}</div>
              <p className="text-xs text-muted-foreground">items moeten besteld worden</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Totale Waarde</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totaleWaarde)}</div>
              <p className="text-xs text-muted-foreground">inkoopwaarde voorraad</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op productnaam of locatie..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="underMinimum"
              checked={showOnlyUnderMinimum}
              onCheckedChange={(checked) => setShowOnlyUnderMinimum(checked === true)}
            />
            <Label htmlFor="underMinimum" className="text-sm cursor-pointer">
              Alleen onder minimum
            </Label>
          </div>
        </div>

        {/* Table */}
        {isLoading || statsLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                </div>
                <p className="text-muted-foreground animate-pulse">Laden...</p>
              </motion.div>
            </CardContent>
          </Card>
        ) : filteredItems.length > 0 ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Hoeveelheid</TableHead>
                  <TableHead className="text-right">Min. Voorraad</TableHead>
                  <TableHead>Locatie</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item, index) => {
                  const productnaam = item.product?.productnaam || "Onbekend product";
                  const eenheid = item.product?.eenheid || "stuks";
                  const inkoopprijs = item.product?.inkoopprijs ?? 0;
                  const minVoorraad = item.minVoorraad ?? 0;
                  const locatie = item.locatie || "Niet opgegeven";

                  return (
                    <motion.tr
                      key={item._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{productnaam}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(inkoopprijs)} per {eenheid}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.hoeveelheid} {eenheid}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {minVoorraad} {eenheid}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{locatie}</Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(item.hoeveelheid, minVoorraad)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" aria-label="Meer opties">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenAdjustDialog(item)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Voorraad aanpassen
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleOpenMutatiesDialog(item)}>
                              <History className="mr-2 h-4 w-4" />
                              Mutatie historie
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                {searchQuery || showOnlyUnderMinimum ? "Geen resultaten" : "Geen voorraad"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
                {searchQuery
                  ? `Geen producten gevonden voor "${searchQuery}"`
                  : showOnlyUnderMinimum
                  ? "Alle producten hebben voldoende voorraad"
                  : "Er zijn nog geen voorraad items toegevoegd."}
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Dialogs */}
      <VoorraadAdjustDialog
        open={showAdjustDialog}
        onOpenChange={setShowAdjustDialog}
        item={selectedItem}
        onSubmit={handleAdjustStock}
      />

      <VoorraadMutatiesDialog
        open={showMutatiesDialog}
        onOpenChange={(open) => {
          setShowMutatiesDialog(open);
          if (!open) {
            setSelectedVoorraadId(null);
          }
        }}
        productnaam={selectedItem?.productnaam || ""}
        eenheid={selectedItem?.eenheid || ""}
        mutaties={rawMutaties}
        isLoading={mutatiesLoading}
      />
    </>
  );
}

export default function VoorraadPage() {
  return (
    <RequireAdmin>
      <VoorraadPageContent />
    </RequireAdmin>
  );
}
