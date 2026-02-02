"use client";

import { useState, useRef, useCallback } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { motion } from "framer-motion";
import { RequireAdmin } from "@/components/require-admin";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Trash2,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useProducten } from "@/hooks/use-producten";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";

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
  const XLSX = await import("xlsx");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as Record<string, string>[];
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

interface Product {
  _id: string;
  productnaam: string;
  categorie: string;
  inkoopprijs: number;
  verkoopprijs: number;
  eenheid: string;
  leverancier?: string;
  verliespercentage: number;
  isActief: boolean;
}

interface NewProduct {
  productnaam: string;
  categorie: string;
  inkoopprijs: number;
  verkoopprijs: number;
  eenheid: string;
  leverancier: string;
  verliespercentage: number;
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

  const isLoading = isUserLoading || isProductenLoading;

  // Filter products (use debounced search value)
  const filteredProducts = producten.filter((product) => {
    const matchesSearch =
      debouncedSearchQuery === "" ||
      product.productnaam.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      (product.leverancier &&
        product.leverancier.toLowerCase().includes(debouncedSearchQuery.toLowerCase()));

    const matchesTab =
      activeTab === "alle" || product.categorie === activeTab;

    return matchesSearch && matchesTab;
  });

  // Get unique categories from actual products
  const uniqueCategories = [...new Set(producten.map(p => p.categorie))].sort();

  const categoryCounts = uniqueCategories.map((cat) => ({
    id: cat,
    naam: cat,
    icon: categoryIcons[cat] || categoryIcons["default"],
    count: countByCategorie[cat] || 0,
  }));

  const totalCount = producten.length;

  const handleAddProduct = async () => {
    if (!newProduct.productnaam) {
      toast.error("Vul een productnaam in");
      return;
    }

    setIsSaving(true);
    try {
      if (selectedProduct) {
        await update({
          id: selectedProduct._id as any,
          ...newProduct,
        });
        toast.success("Product bijgewerkt");
      } else {
        await create(newProduct);
        toast.success("Product toegevoegd");
      }
      setShowAddDialog(false);
      resetForm();
    } catch (error) {
      toast.error("Fout bij opslaan product");
      console.error(error);
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
    });
    setShowAddDialog(true);
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    try {
      await deleteProduct({ id: selectedProduct._id as any });
      toast.success("Product verwijderd");
      setShowDeleteDialog(false);
      setSelectedProduct(null);
    } catch (error) {
      toast.error("Fout bij verwijderen product");
      console.error(error);
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
          // Dynamic import of xlsx
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
      console.error(error);
    } finally {
      setIsImporting(false);
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
              <BreadcrumbPage>Prijsboek</BreadcrumbPage>
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
              Prijsboek
            </h1>
            <p className="text-muted-foreground">
              Beheer je producten, materialen en prijzen
            </p>
          </div>
          <div className="flex gap-2">
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
        <div className="grid gap-4 md:grid-cols-4">
          {categoryCounts.slice(0, 4).map((cat) => {
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

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op productnaam of leverancier..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs & Table */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="alle">
              Alle producten
              <Badge variant="secondary" className="ml-2">
                {totalCount}
              </Badge>
            </TabsTrigger>
            {categoryCounts.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id}>
                {cat.naam}
                {cat.count > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {cat.count}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {isLoading ? (
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
            ) : filteredProducts.length > 0 ? (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Categorie</TableHead>
                      <TableHead>Leverancier</TableHead>
                      <TableHead className="text-right">Inkoop</TableHead>
                      <TableHead className="text-right">Verkoop</TableHead>
                      <TableHead className="text-right">Verlies %</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product, index) => (
                      <motion.tr
                        key={product._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.productnaam}</p>
                            <p className="text-sm text-muted-foreground">
                              per {product.eenheid}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {product.categorie}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {product.leverancier || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(product.inkoopprijs)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(product.verkoopprijs)}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.verliespercentage}%
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEditProduct(product as any)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Bewerken
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedProduct(product as any);
                                  setShowDeleteDialog(true);
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Verwijderen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">
                    {searchQuery ? "Geen resultaten" : "Geen producten"}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
                    {searchQuery
                      ? `Geen producten gevonden voor "${searchQuery}"`
                      : "Importeer een prijslijst of voeg handmatig producten toe."}
                  </p>
                  {!searchQuery && (
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
          </TabsContent>
        </Tabs>
      </motion.div>

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
              <CheckCircle className="h-4 w-4 text-green-600" />
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
            <AlertDialogTitle>Product verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je &quot;{selectedProduct?.productnaam}&quot; wilt
              verwijderen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedProduct(null)}>
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
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

export default function PrijsboekPage() {
  return (
    <RequireAdmin>
      <PrijsboekPageContent />
    </RequireAdmin>
  );
}
