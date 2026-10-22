"use client";

import { useState, useRef, useCallback } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { PaginaReveal } from "@/components/pagina-reveal";
import { RequireAdmin } from "@/components/require-admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  BookOpen,
  Plus,
  Upload,
  Search,
  Package,
  Hammer,
  Flower2,
  Layers,
  MoreHorizontal,
  Edit,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Power,
} from "lucide-react";
import { useProducten, useUitgeschakeldeProducten } from "@/hooks/use-producten";
import { HERO_CATEGORIEEN } from "../../../../convex/lib/heroCategorie";
import { cn } from "@/lib/utils";
import { ArtikelBeschrijvingTip } from "./artikel-beschrijving-tip";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { LaadIndicator } from "@/components/ui/laad-indicator";
import { formatCurrency } from "@/lib/format/currency";
import { logger } from "@/lib/logger";

// Dynamic imports for heavy libraries (~400KB total)
// These are only needed when user imports a file
const parseCSV = async (file: File): Promise<Record<string, string>[]> => {
  const Papa = (await import("papaparse")).default;
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as Record<string, string>[]),
      error: (error) => reject(error),
    });
  });
};

const parseExcel = async (file: File): Promise<Record<string, string>[]> => {
  const ExcelJS = await import("exceljs");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          resolve([]);
          return;
        }

        const jsonData: Record<string, string>[] = [];
        const headers: string[] = [];

        // Get headers from first row
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell, colNumber) => {
          headers[colNumber - 1] = cell.text || `Column${colNumber}`;
        });

        // Process data rows
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header row

          const rowData: Record<string, string> = {};
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber - 1];
            if (header) {
              // Handle different cell value types
              const value = cell.value;
              if (value === null || value === undefined) {
                rowData[header] = "";
              } else if (typeof value === "object" && "result" in value) {
                // Formula cell - use the result
                rowData[header] = String(value.result ?? "");
              } else if (value instanceof Date) {
                // Date value
                rowData[header] = value.toISOString().split("T")[0];
              } else {
                rowData[header] = String(value);
              }
            }
          });

          // Only add non-empty rows
          if (Object.keys(rowData).length > 0) {
            jsonData.push(rowData);
          }
        });

        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

interface Product {
  _id: Id<"producten">;
  productnaam: string;
  categorie: string;
  inkoopprijs: number;
  verkoopprijs: number;
  eenheid: string;
  leverancier?: string;
  verliespercentage: number;
  isActief: boolean;
  omschrijving?: string;
}

interface NewProduct {
  productnaam: string;
  categorie: string;
  inkoopprijs: number;
  verkoopprijs: number;
  eenheid: string;
  leverancier: string;
  verliespercentage: number;
  /** Beschrijving die op offerte en factuur onder de regel komt */
  omschrijving?: string;
}

// Category icons mapping
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "Bestrating": Layers,
  "Zand en fundering": Package,
  "Houtwerk": Hammer,
  "Grond": Package,
  "Gras": Flower2,
  "Planten": Flower2,
  "Elektra": Package,
  "Afvoer": Package,
  // Fallback
  "default": Package,
};

function categorieVolgorde(categorie: string): number {
  if (categorie === "Overig") return Number.MAX_SAFE_INTEGER;
  const i = (HERO_CATEGORIEEN as readonly string[]).indexOf(categorie);
  return i >= 0 ? i : HERO_CATEGORIEEN.length;
}

function PrijsboekPageContent() {
  const { isLoading: isUserLoading } = useCurrentUser();
  const {
    producten,
    countByCategorie,
    isLoading: isProductenLoading,
    create,
    update,
    delete: deleteProduct,
    importProducts,
  } = useProducten();
  const uitgeschakeld = useUitgeschakeldeProducten();

  // Actief = wat in de artikelkiezer staat; uitgeschakeld = verwijderd of
  // weinig gebruikt in HERO, en hier weer aan te zetten
  const [weergave, setWeergave] = useState<"actief" | "uit">("actief");
  const zichtbareProducten =
    weergave === "actief" ? producten : uitgeschakeld.producten;

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [activeTab, setActiveTab] = useState("alle");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<NewProduct[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newProduct, setNewProduct] = useState<NewProduct>({
    productnaam: "",
    categorie: "Bestrating",
    inkoopprijs: 0,
    verkoopprijs: 0,
    eenheid: "stuk",
    leverancier: "",
    verliespercentage: 5,
  });

  const isLoading =
    isUserLoading ||
    (weergave === "actief" ? isProductenLoading : uitgeschakeld.isLoading);

  // Filter products (use debounced search value)
  const filteredProducts = zichtbareProducten.filter((product) => {
    const matchesSearch =
      debouncedSearchQuery === "" ||
      product.productnaam.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      (product.leverancier &&
        product.leverancier.toLowerCase().includes(debouncedSearchQuery.toLowerCase()));

    const matchesTab =
      activeTab === "alle" || product.categorie === activeTab;

    return matchesSearch && matchesTab;
  });

  // Categorieën in de volgorde van het werk (HERO-indeling), andere
  // alfabetisch daarachter en "Overig" altijd onderaan
  const uniqueCategories = [
    ...new Set(zichtbareProducten.map((p) => p.categorie)),
  ].sort((a, b) => categorieVolgorde(a) - categorieVolgorde(b) || a.localeCompare(b, "nl"));

  const categoryCounts = uniqueCategories.map((cat) => ({
    id: cat,
    naam: cat,
    icon: categoryIcons[cat] || categoryIcons["default"],
    count:
      weergave === "actief"
        ? countByCategorie[cat] || 0
        : zichtbareProducten.filter((p) => p.categorie === cat).length,
  }));

  const totalCount = zichtbareProducten.length;

  const categorieKeuzes = [
    { id: "alle", naam: "Alle artikelen", count: totalCount },
    ...categoryCounts,
  ];
  // Kaarten bovenaan: de vier grootste categorieën
  const grootsteCategorieen = [...categoryCounts]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const handleZetAan = async (product: Product) => {
    try {
      await update({ id: product._id, isActief: true });
      toast.success(`${product.productnaam} staat weer in de artikelkiezer`);
    } catch {
      toast.error("Aanzetten lukte niet. Probeer het opnieuw.");
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.productnaam) {
      toast.error("Vul een productnaam in");
      return;
    }

    setIsSaving(true);
    try {
      const omschrijving = newProduct.omschrijving?.trim() ?? "";
      if (selectedProduct) {
        await update({
          id: selectedProduct._id,
          ...newProduct,
          // Leeg maakt de beschrijving leeg (undefined zou hem laten staan)
          omschrijving,
        });
        toast.success("Product bijgewerkt");
      } else {
        await create({ ...newProduct, omschrijving: omschrijving || undefined });
        toast.success("Product toegevoegd");
      }
      setShowAddDialog(false);
      resetForm();
    } catch (error) {
      toast.error("Fout bij opslaan product");
      logger.error("Opslaan product mislukt", error, { module: "prijsboek" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setNewProduct({
      productnaam: product.productnaam,
      categorie: product.categorie,
      inkoopprijs: product.inkoopprijs,
      verkoopprijs: product.verkoopprijs,
      eenheid: product.eenheid,
      leverancier: product.leverancier || "",
      verliespercentage: product.verliespercentage,
      omschrijving: product.omschrijving ?? "",
    });
    setShowAddDialog(true);
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    try {
      await deleteProduct({ id: selectedProduct._id });
      toast.success("Artikel uitgezet");
      setShowDeleteDialog(false);
      setSelectedProduct(null);
    } catch (error) {
      toast.error("Uitzetten lukte niet. Probeer het opnieuw.");
      logger.error("Verwijderen product mislukt", error, {
        module: "prijsboek",
      });
    }
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setNewProduct({
      productnaam: "",
      categorie: "Bestrating",
      inkoopprijs: 0,
      verkoopprijs: 0,
      eenheid: "stuk",
      leverancier: "",
      verliespercentage: 5,
      omschrijving: "",
    });
  };

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setImportErrors([]);
      setImportPreview([]);

      const fileExtension = file.name.split(".").pop()?.toLowerCase();

      try {
        if (fileExtension === "csv") {
          // Dynamic import of papaparse
          const data = await parseCSV(file);
          processImportData(data);
        } else if (
          fileExtension === "xlsx" ||
          fileExtension === "xls"
        ) {
          // Dynamic import of exceljs
          const data = await parseExcel(file);
          processImportData(data);
        } else {
          setImportErrors(["Ongeldig bestandstype. Gebruik CSV of XLS/XLSX"]);
        }
      } catch (error) {
        setImportErrors([`Fout bij laden bestand: ${error}`]);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    []
  );

  const processImportData = (data: Record<string, string>[]) => {
    const errors: string[] = [];
    const products: NewProduct[] = [];

    const columnMappings: Record<string, string[]> = {
      productnaam: ["productnaam", "naam", "product", "omschrijving", "name", "description"],
      categorie: ["categorie", "category", "type", "groep"],
      inkoopprijs: ["inkoopprijs", "inkoop", "kostprijs", "purchase", "cost"],
      verkoopprijs: ["verkoopprijs", "verkoop", "prijs", "price", "sell"],
      eenheid: ["eenheid", "unit", "per"],
      leverancier: ["leverancier", "supplier", "vendor"],
      verliespercentage: ["verlies", "verliespercentage", "waste", "loss"],
    };

    const findColumn = (
      row: Record<string, string>,
      possibleNames: string[]
    ): string | undefined => {
      const lowerKeys = Object.keys(row).map((k) => k.toLowerCase());
      for (const name of possibleNames) {
        const index = lowerKeys.findIndex((k) => k.includes(name.toLowerCase()));
        if (index !== -1) {
          return Object.keys(row)[index];
        }
      }
      return undefined;
    };

    data.forEach((row, index) => {
      const productNameCol = findColumn(row, columnMappings.productnaam);
      const categorieCol = findColumn(row, columnMappings.categorie);
      const inkoopCol = findColumn(row, columnMappings.inkoopprijs);
      const verkoopCol = findColumn(row, columnMappings.verkoopprijs);
      const eenheidCol = findColumn(row, columnMappings.eenheid);
      const leverancierCol = findColumn(row, columnMappings.leverancier);
      const verliesCol = findColumn(row, columnMappings.verliespercentage);

      if (!productNameCol || !row[productNameCol]) {
        errors.push(`Rij ${index + 2}: Geen productnaam gevonden`);
        return;
      }

      const parsePrice = (value: string | undefined): number => {
        if (!value) return 0;
        const cleaned = value.toString().replace(/[€$,\s]/g, "").replace(",", ".");
        return parseFloat(cleaned) || 0;
      };

      const product: NewProduct = {
        productnaam: row[productNameCol],
        categorie: categorieCol ? row[categorieCol] || "materialen" : "materialen",
        inkoopprijs: inkoopCol ? parsePrice(row[inkoopCol]) : 0,
        verkoopprijs: verkoopCol ? parsePrice(row[verkoopCol]) : 0,
        eenheid: eenheidCol ? row[eenheidCol] || "stuk" : "stuk",
        leverancier: leverancierCol ? row[leverancierCol] || "" : "",
        verliespercentage: verliesCol
          ? parseFloat(row[verliesCol]) || 5
          : 5,
      };

      products.push(product);
    });

    setImportPreview(products);
    setImportErrors(errors);

    if (products.length > 0) {
      setShowImportDialog(true);
    }
  };

  const handleImport = async () => {
    if (importPreview.length === 0) return;

    setIsImporting(true);
    try {
      await importProducts(importPreview);
      toast.success(`${importPreview.length} producten geimporteerd`);
      setShowImportDialog(false);
      setImportPreview([]);
      setImportErrors([]);
    } catch (error) {
      toast.error("Fout bij importeren producten");
      logger.error("Importeren producten mislukt", error, {
        module: "prijsboek",
        aantalRijen: importPreview.length,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <PageHeader />

      {/* Eén reveal op de buitenkant; de blokken en tabelrijen eronder zijn
          gewone elementen en staan er dus ook als er nul animatieframes
          vallen. → src/components/pagina-reveal.tsx */}
      <PaginaReveal className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Prijsboek
            </h1>
            <p className="text-muted-foreground">
              Beheer je producten, materialen en prijzen
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import CSV/XLS
            </Button>
            <Dialog
              open={showAddDialog}
              onOpenChange={(open) => {
                setShowAddDialog(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Product Toevoegen
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {selectedProduct ? "Product Bewerken" : "Nieuw Product"}
                  </DialogTitle>
                  <DialogDescription>
                    Voeg een product toe aan je prijsboek
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Productnaam</Label>
                    <Input
                      value={newProduct.productnaam}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, productnaam: e.target.value })
                      }
                      placeholder="Bijv. Betonklinker 21x10,5x7"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Categorie</Label>
                      <Select
                        value={newProduct.categorie}
                        onValueChange={(value) =>
                          setNewProduct({ ...newProduct, categorie: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Kies categorie" />
                        </SelectTrigger>
                        <SelectContent>
                          {uniqueCategories.length > 0 ? (
                            uniqueCategories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem value="Bestrating">Bestrating</SelectItem>
                              <SelectItem value="Zand en fundering">Zand en fundering</SelectItem>
                              <SelectItem value="Houtwerk">Houtwerk</SelectItem>
                              <SelectItem value="Grond">Grond</SelectItem>
                              <SelectItem value="Gras">Gras</SelectItem>
                              <SelectItem value="Planten">Planten</SelectItem>
                              <SelectItem value="Elektra">Elektra</SelectItem>
                              <SelectItem value="Afvoer">Afvoer</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Eenheid</Label>
                      <Select
                        value={newProduct.eenheid}
                        onValueChange={(value) =>
                          setNewProduct({ ...newProduct, eenheid: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stuk">stuk</SelectItem>
                          <SelectItem value="m²">m²</SelectItem>
                          <SelectItem value="m³">m³</SelectItem>
                          <SelectItem value="m¹">m¹</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="liter">liter</SelectItem>
                          <SelectItem value="zak">zak</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Inkoopprijs</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newProduct.inkoopprijs}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            inkoopprijs: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Verkoopprijs</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newProduct.verkoopprijs}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            verkoopprijs: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Leverancier</Label>
                      <Input
                        value={newProduct.leverancier}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, leverancier: e.target.value })
                        }
                        placeholder="Optioneel"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Verlies %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={newProduct.verliespercentage}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            verliespercentage: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="product-omschrijving">
                      Beschrijving (komt op offerte en factuur)
                    </Label>
                    <Textarea
                      id="product-omschrijving"
                      value={newProduct.omschrijving ?? ""}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, omschrijving: e.target.value })
                      }
                      placeholder="Optioneel. Regels die met “- ” beginnen worden een opsomming."
                      className="max-h-48 min-h-20 text-sm leading-relaxed"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddDialog(false);
                      resetForm();
                    }}
                  >
                    Annuleren
                  </Button>
                  <Button onClick={handleAddProduct} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {selectedProduct ? "Bijwerken" : "Toevoegen"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Category stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {grootsteCategorieen.map((cat) => {
            const IconComponent = cat.icon;
            return (
              <Card
                key={cat.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setActiveTab(cat.id)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{cat.naam}</CardTitle>
                  <IconComponent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{cat.count}</div>
                      <p className="text-xs text-muted-foreground">producten</p>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search + actief/uitgeschakeld */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op productnaam of leverancier..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Tabs
            value={weergave}
            onValueChange={(waarde) => {
              setWeergave(waarde as "actief" | "uit");
              setActiveTab("alle");
            }}
          >
            <TabsList>
              <TabsTrigger value="actief">Actief</TabsTrigger>
              <TabsTrigger value="uit">
                Uitgeschakeld
                {uitgeschakeld.producten.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {uitgeschakeld.producten.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {weergave === "uit" && (
          <p className="text-sm text-muted-foreground">
            Deze artikelen staan niet in de artikelkiezer van de offerte. Zet een
            artikel aan om het weer te gebruiken.
          </p>
        )}

        {/* Categorieën + tabel: een lijst links op brede schermen, een
            keuzelijst op smalle. Een tabbalk met vijftien categorieën moest
            zijwaarts scrollen. */}
        <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <nav aria-label="Categorieën" className="hidden lg:block">
            <div className="sticky top-4 space-y-0.5">
              <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Categorieën
              </p>
              {categorieKeuzes.map((cat) => {
                const actief = activeTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveTab(cat.id)}
                    aria-current={actief ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      actief
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <span className="min-w-0 truncate">{cat.naam}</span>
                    <span className="shrink-0 text-xs tabular-nums">{cat.count}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="min-w-0 space-y-4">
            <div className="lg:hidden">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger aria-label="Categorie" className="w-full sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categorieKeuzes.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.naam} ({cat.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <LaadIndicator formaat="sectie" tekst="Laden…" />
                </CardContent>
              </Card>
            ) : filteredProducts.length > 0 ? (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      {activeTab === "alle" && (
                        <TableHead className="hidden md:table-cell">Categorie</TableHead>
                      )}
                      <TableHead className="hidden 2xl:table-cell">Leverancier</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Inkoop</TableHead>
                      <TableHead className="text-right">Verkoop</TableHead>
                      <TableHead className="hidden text-right 2xl:table-cell">Verlies %</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow
                        key={product._id}
                        className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                      >
                        <TableCell className="whitespace-normal">
                          <div className="min-w-0">
                            <p className="font-medium text-pretty">
                              {product.productnaam}
                              <ArtikelBeschrijvingTip
                                naam={product.productnaam}
                                tekst={product.omschrijving}
                              />
                            </p>
                            <p className="text-sm text-muted-foreground">
                              per {product.eenheid}
                            </p>
                          </div>
                        </TableCell>
                        {activeTab === "alle" && (
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="outline">
                              {product.categorie}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="hidden text-muted-foreground 2xl:table-cell">
                          {product.leverancier || "-"}
                        </TableCell>
                        <TableCell className="hidden text-right sm:table-cell">
                          {formatCurrency(product.inkoopprijs)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(product.verkoopprijs)}
                        </TableCell>
                        <TableCell className="hidden text-right 2xl:table-cell">
                          {product.verliespercentage}%
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" aria-label="Meer opties">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {weergave === "uit" && (
                                <DropdownMenuItem
                                  onClick={() => handleZetAan(product as Product)}
                                >
                                  <Power className="mr-2 h-4 w-4" />
                                  Aanzetten
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleEditProduct(product as Product)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Bewerken
                              </DropdownMenuItem>
                              {weergave === "actief" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedProduct(product as Product);
                                      setShowDeleteDialog(true);
                                    }}
                                  >
                                    <Power className="mr-2 h-4 w-4" />
                                    Uitzetten
                                  </DropdownMenuItem>
                                </>
                              )}
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
                  <BookOpen className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">
                    {searchQuery
                      ? "Geen resultaten"
                      : weergave === "uit"
                        ? "Geen uitgeschakelde artikelen"
                        : "Geen producten"}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
                    {searchQuery
                      ? `Geen producten gevonden voor "${searchQuery}"`
                      : weergave === "uit"
                        ? "Alle artikelen staan in de artikelkiezer."
                        : "Importeer een prijslijst of voeg handmatig producten toe."}
                  </p>
                  {!searchQuery && weergave === "actief" && (
                    <div className="mt-6 flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Import CSV/XLS
                      </Button>
                      <Button onClick={() => setShowAddDialog(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Product Toevoegen
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PaginaReveal>

      {/* Import Preview Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Preview
            </DialogTitle>
            <DialogDescription>
              Controleer de te importeren producten
            </DialogDescription>
          </DialogHeader>

          {importErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Waarschuwingen:</span>
              </div>
              <ul className="mt-2 text-sm text-destructive">
                {importErrors.slice(0, 5).map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
                {importErrors.length > 5 && (
                  <li>...en {importErrors.length - 5} meer</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead className="text-right">Inkoop</TableHead>
                  <TableHead className="text-right">Verkoop</TableHead>
                  <TableHead>Eenheid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreview.slice(0, 100).map((product, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {product.productnaam}
                    </TableCell>
                    <TableCell>{product.categorie}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(product.inkoopprijs)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(product.verkoopprijs)}
                    </TableCell>
                    <TableCell>{product.eenheid}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {importPreview.length > 100 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                ...en {importPreview.length - 100} meer producten
              </p>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-status-geaccepteerd-dot" />
              {importPreview.length} producten klaar om te importeren
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportDialog(false);
                  setImportPreview([]);
                  setImportErrors([]);
                }}
              >
                Annuleren
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Importeren
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Artikel uitzetten?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{selectedProduct?.productnaam}&quot; verdwijnt uit de
              artikelkiezer. Je vindt het terug onder Uitgeschakeld en kunt het
              daar weer aanzetten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedProduct(null)}>
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct}>
              Uitzetten
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function PrijsboekPage() {
  return (
    <RequireAdmin>
      <PrijsboekPageContent />
    </RequireAdmin>
  );
}
