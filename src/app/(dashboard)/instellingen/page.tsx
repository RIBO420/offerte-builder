"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/components/ui/dialog";
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
  Calculator,
  Save,
  Loader2,
  Clock,
  Sliders,
  Plus,
  Edit,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useInstellingen } from "@/hooks/use-instellingen";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useNormuren } from "@/hooks/use-normuren";
import { useCorrectiefactoren } from "@/hooks/use-correctiefactoren";

const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gras",
  houtwerk: "Houtwerk",
  water_elektra: "Water/Elektra",
  gras_onderhoud: "Gras Onderhoud",
  borders_onderhoud: "Borders Onderhoud",
  heggen_onderhoud: "Heggen Onderhoud",
  bomen_onderhoud: "Bomen Onderhoud",
};

const typeLabels: Record<string, string> = {
  bereikbaarheid: "Bereikbaarheid",
  complexiteit: "Complexiteit",
  intensiteit: "Intensiteit",
  snijwerk: "Snijwerk",
  achterstalligheid: "Achterstalligheid",
  hoogteverschil: "Hoogteverschil",
  diepte: "Diepte",
  hoogte: "Hoogte",
  bodem: "Bodemtype",
  snoei: "Snoeitype",
};

const waardeLabels: Record<string, string> = {
  goed: "Goed",
  beperkt: "Beperkt",
  slecht: "Slecht",
  laag: "Laag",
  gemiddeld: "Gemiddeld",
  hoog: "Hoog",
  weinig: "Weinig",
  veel: "Veel",
  geen: "Geen",
  licht: "Licht",
  standaard: "Standaard",
  zwaar: "Zwaar",
  matig: "Matig",
  sterk: "Sterk",
  middel: "Middel",
  open: "Open",
  bedekt: "Bedekt",
  zijkanten: "Zijkanten",
  bovenkant: "Bovenkant",
  beide: "Beide",
};

interface Normuur {
  _id: string;
  activiteit: string;
  scope: string;
  normuurPerEenheid: number;
  eenheid: string;
  omschrijving?: string;
}

interface Correctiefactor {
  _id: string;
  type: string;
  waarde: string;
  factor: number;
  userId?: string;
}

export default function InstellingenPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const { instellingen, isLoading: isSettingsLoading, update } = useInstellingen();
  const {
    normuren,
    scopes,
    isLoading: isNormurenLoading,
    create: createNormuur,
    update: updateNormuur,
    delete: deleteNormuur,
  } = useNormuren();
  const {
    factoren,
    types,
    isLoading: isFactorenLoading,
    upsert: upsertFactor,
    reset: resetFactor,
    initDefaults,
  } = useCorrectiefactoren();

  const [isSaving, setIsSaving] = useState(false);
  const [activeScope, setActiveScope] = useState<string>("alle");
  const [activeType, setActiveType] = useState<string>("alle");

  // Normuur dialog state
  const [showNormuurDialog, setShowNormuurDialog] = useState(false);
  const [editingNormuur, setEditingNormuur] = useState<Normuur | null>(null);
  const [normuurForm, setNormuurForm] = useState({
    activiteit: "",
    scope: "grondwerk",
    normuurPerEenheid: 0,
    eenheid: "m²",
    omschrijving: "",
  });
  const [showDeleteNormuurDialog, setShowDeleteNormuurDialog] = useState(false);
  const [normuurToDelete, setNormuurToDelete] = useState<Normuur | null>(null);

  // Factor edit state
  const [editingFactor, setEditingFactor] = useState<Correctiefactor | null>(null);
  const [factorValue, setFactorValue] = useState<number>(1);

  // Tarieven state
  const [tarieven, setTarieven] = useState({
    uurtarief: 45,
    standaardMargePercentage: 15,
    btwPercentage: 21,
  });

  // Scope marges state
  const [scopeMarges, setScopeMarges] = useState<{
    grondwerk?: number;
    bestrating?: number;
    borders?: number;
    gras?: number;
    houtwerk?: number;
    water_elektra?: number;
    specials?: number;
    gras_onderhoud?: number;
    borders_onderhoud?: number;
    heggen?: number;
    bomen?: number;
    overig?: number;
  }>({});

  // Load settings into form when data arrives
  useEffect(() => {
    if (instellingen) {
      setTarieven({
        uurtarief: instellingen.uurtarief,
        standaardMargePercentage: instellingen.standaardMargePercentage,
        btwPercentage: instellingen.btwPercentage,
      });
      if (instellingen.scopeMarges) {
        setScopeMarges(instellingen.scopeMarges);
      }
    }
  }, [instellingen]);

  // Initialize system defaults if needed
  useEffect(() => {
    if (factoren && factoren.length === 0) {
      initDefaults({});
    }
  }, [factoren, initDefaults]);

  const isLoading = isUserLoading || isSettingsLoading;

  const handleSaveTarieven = async () => {
    setIsSaving(true);
    try {
      await update({
        uurtarief: tarieven.uurtarief,
        standaardMargePercentage: tarieven.standaardMargePercentage,
        scopeMarges: scopeMarges,
        btwPercentage: tarieven.btwPercentage,
      });
      toast.success("Tarieven opgeslagen");
    } catch (error) {
      toast.error("Fout bij opslaan tarieven");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Normuur handlers
  const handleOpenNormuurDialog = (normuur?: Normuur) => {
    if (normuur) {
      setEditingNormuur(normuur);
      setNormuurForm({
        activiteit: normuur.activiteit,
        scope: normuur.scope,
        normuurPerEenheid: normuur.normuurPerEenheid,
        eenheid: normuur.eenheid,
        omschrijving: normuur.omschrijving || "",
      });
    } else {
      setEditingNormuur(null);
      setNormuurForm({
        activiteit: "",
        scope: activeScope !== "alle" ? activeScope : "grondwerk",
        normuurPerEenheid: 0,
        eenheid: "m²",
        omschrijving: "",
      });
    }
    setShowNormuurDialog(true);
  };

  const handleSaveNormuur = async () => {
    if (!normuurForm.activiteit) {
      toast.error("Vul een activiteit in");
      return;
    }

    setIsSaving(true);
    try {
      if (editingNormuur) {
        await updateNormuur({
          id: editingNormuur._id as any,
          ...normuurForm,
        });
        toast.success("Normuur bijgewerkt");
      } else {
        await createNormuur(normuurForm);
        toast.success("Normuur toegevoegd");
      }
      setShowNormuurDialog(false);
    } catch (error) {
      toast.error("Fout bij opslaan normuur");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNormuur = async () => {
    if (!normuurToDelete) return;

    try {
      await deleteNormuur({ id: normuurToDelete._id as any });
      toast.success("Normuur verwijderd");
      setShowDeleteNormuurDialog(false);
      setNormuurToDelete(null);
    } catch (error) {
      toast.error("Fout bij verwijderen normuur");
      console.error(error);
    }
  };

  // Factor handlers
  const handleEditFactor = (factor: Correctiefactor) => {
    setEditingFactor(factor);
    setFactorValue(factor.factor);
  };

  const handleSaveFactor = async () => {
    if (!editingFactor) return;

    setIsSaving(true);
    try {
      await upsertFactor({
        type: editingFactor.type,
        waarde: editingFactor.waarde,
        factor: factorValue,
      });
      toast.success("Factor bijgewerkt");
      setEditingFactor(null);
    } catch (error) {
      toast.error("Fout bij opslaan factor");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetFactor = async (factor: Correctiefactor) => {
    try {
      await resetFactor(factor.type, factor.waarde);
      toast.success("Factor gereset naar standaard");
    } catch (error) {
      toast.error("Fout bij resetten factor");
      console.error(error);
    }
  };

  // Filter normuren
  const filteredNormuren =
    activeScope === "alle"
      ? normuren
      : normuren.filter((n) => n.scope === activeScope);

  // Filter factoren
  const filteredFactoren =
    activeType === "alle"
      ? factoren
      : factoren.filter((f) => f.type === activeType);

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
                <BreadcrumbPage>Instellingen</BreadcrumbPage>
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
              <BreadcrumbPage>Instellingen</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Instellingen
          </h1>
          <p className="text-muted-foreground">
            Beheer je tarieven, normuren en correctiefactoren
          </p>
        </div>

        <Tabs defaultValue="tarieven" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tarieven" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Tarieven
            </TabsTrigger>
            <TabsTrigger value="normuren" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Normuren
            </TabsTrigger>
            <TabsTrigger value="factoren" className="flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              Correctiefactoren
            </TabsTrigger>
          </TabsList>

          {/* Tarieven Tab */}
          <TabsContent value="tarieven" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tarieven</CardTitle>
                <CardDescription>
                  Stel je uurtarieven en standaard marges in
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="uurtarief">Uurtarief</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">
                        &euro;
                      </span>
                      <Input
                        id="uurtarief"
                        type="number"
                        step="0.01"
                        className="pl-7"
                        placeholder="45.00"
                        value={tarieven.uurtarief}
                        onChange={(e) =>
                          setTarieven({ ...tarieven, uurtarief: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Standaard uurtarief voor arbeid
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="marge">Standaard marge</Label>
                    <div className="relative">
                      <Input
                        id="marge"
                        type="number"
                        step="1"
                        className="pr-7"
                        placeholder="15"
                        value={tarieven.standaardMargePercentage}
                        onChange={(e) =>
                          setTarieven({
                            ...tarieven,
                            standaardMargePercentage: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="absolute right-3 top-2.5 text-muted-foreground">
                        %
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Marge bovenop kostenprijs
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="btw">BTW percentage</Label>
                    <div className="relative">
                      <Input
                        id="btw"
                        type="number"
                        step="1"
                        className="pr-7"
                        placeholder="21"
                        value={tarieven.btwPercentage}
                        onChange={(e) =>
                          setTarieven({
                            ...tarieven,
                            btwPercentage: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="absolute right-3 top-2.5 text-muted-foreground">
                        %
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Standaard BTW tarief
                    </p>
                  </div>
                </div>

                {/* Scope Marges Section */}
                <div className="pt-4 border-t">
                  <div className="mb-3">
                    <h4 className="text-sm font-medium">Marge per scope</h4>
                    <p className="text-xs text-muted-foreground">
                      Optioneel: stel verschillende marges in per type werkzaamheid. Laat leeg voor standaard marge.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs font-medium text-muted-foreground">Aanleg</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { key: "grondwerk", label: "Grondwerk" },
                        { key: "bestrating", label: "Bestrating" },
                        { key: "borders", label: "Borders" },
                        { key: "gras", label: "Gazon" },
                        { key: "houtwerk", label: "Houtwerk" },
                        { key: "water_elektra", label: "Verlichting" },
                        { key: "specials", label: "Specials" },
                      ].map(({ key, label }) => (
                        <div key={key} className="space-y-1">
                          <Label htmlFor={`marge-${key}`} className="text-xs">{label}</Label>
                          <div className="relative">
                            <Input
                              id={`marge-${key}`}
                              type="number"
                              step="1"
                              className="h-8 text-sm pr-6"
                              placeholder={String(tarieven.standaardMargePercentage)}
                              value={scopeMarges[key as keyof typeof scopeMarges] ?? ""}
                              onChange={(e) =>
                                setScopeMarges({
                                  ...scopeMarges,
                                  [key]: e.target.value ? parseInt(e.target.value) : undefined,
                                })
                              }
                            />
                            <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-xs font-medium text-muted-foreground pt-2">Onderhoud</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { key: "gras_onderhoud", label: "Gras" },
                        { key: "borders_onderhoud", label: "Borders" },
                        { key: "heggen", label: "Heggen" },
                        { key: "bomen", label: "Bomen" },
                        { key: "overig", label: "Overig" },
                      ].map(({ key, label }) => (
                        <div key={key} className="space-y-1">
                          <Label htmlFor={`marge-${key}`} className="text-xs">{label}</Label>
                          <div className="relative">
                            <Input
                              id={`marge-${key}`}
                              type="number"
                              step="1"
                              className="h-8 text-sm pr-6"
                              placeholder={String(tarieven.standaardMargePercentage)}
                              value={scopeMarges[key as keyof typeof scopeMarges] ?? ""}
                              onChange={(e) =>
                                setScopeMarges({
                                  ...scopeMarges,
                                  [key]: e.target.value ? parseInt(e.target.value) : undefined,
                                })
                              }
                            />
                            <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveTarieven} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Opslaan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Normuren Tab */}
          <TabsContent value="normuren" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Normuren</CardTitle>
                    <CardDescription>
                      Standaard uren per activiteit voor berekeningen
                    </CardDescription>
                  </div>
                  <Button onClick={() => handleOpenNormuurDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Normuur toevoegen
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Scope filter */}
                <div className="mb-4">
                  <Select value={activeScope} onValueChange={setActiveScope}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter op scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle scopes</SelectItem>
                      {scopes.map((scope) => (
                        <SelectItem key={scope} value={scope}>
                          {scopeLabels[scope] || scope}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isNormurenLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredNormuren.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Activiteit</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead className="text-right">Normuur</TableHead>
                        <TableHead>Eenheid</TableHead>
                        <TableHead>Omschrijving</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredNormuren.map((normuur) => (
                        <TableRow key={normuur._id}>
                          <TableCell className="font-medium">
                            {normuur.activiteit}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {scopeLabels[normuur.scope] || normuur.scope}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {normuur.normuurPerEenheid}
                          </TableCell>
                          <TableCell>{normuur.eenheid}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">
                            {normuur.omschrijving || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenNormuurDialog(normuur as any)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setNormuurToDelete(normuur as any);
                                  setShowDeleteNormuurDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">
                      Geen normuren gevonden
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => handleOpenNormuurDialog()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Eerste normuur toevoegen
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Correctiefactoren Tab */}
          <TabsContent value="factoren" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Correctiefactoren</CardTitle>
                <CardDescription>
                  Factoren die normuren aanpassen op basis van omstandigheden
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Type filter */}
                <div className="mb-4">
                  <Select value={activeType} onValueChange={setActiveType}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter op type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle types</SelectItem>
                      {types.map((type) => (
                        <SelectItem key={type} value={type}>
                          {typeLabels[type] || type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isFactorenLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredFactoren.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Waarde</TableHead>
                        <TableHead className="text-right">Factor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[150px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFactoren.map((factor) => (
                        <TableRow key={factor._id}>
                          <TableCell className="font-medium">
                            {typeLabels[factor.type] || factor.type}
                          </TableCell>
                          <TableCell>
                            {waardeLabels[factor.waarde] || factor.waarde}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingFactor?._id === factor._id ? (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-20 text-right"
                                value={factorValue}
                                onChange={(e) =>
                                  setFactorValue(parseFloat(e.target.value) || 0)
                                }
                              />
                            ) : (
                              <span
                                className={
                                  factor.factor !== 1
                                    ? factor.factor > 1
                                      ? "text-orange-600 font-medium"
                                      : "text-green-600 font-medium"
                                    : ""
                                }
                              >
                                {factor.factor.toFixed(2)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {factor.userId ? (
                              <Badge variant="secondary">Aangepast</Badge>
                            ) : (
                              <Badge variant="outline">Standaard</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {editingFactor?._id === factor._id ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleSaveFactor}
                                    disabled={isSaving}
                                  >
                                    {isSaving ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Save className="h-4 w-4 text-green-600" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingFactor(null)}
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditFactor(factor as any)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  {factor.userId && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleResetFactor(factor as any)}
                                      title="Reset naar standaard"
                                    >
                                      <RotateCcw className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Sliders className="h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">
                      Geen correctiefactoren gevonden
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Normuur Dialog */}
      <Dialog open={showNormuurDialog} onOpenChange={setShowNormuurDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingNormuur ? "Normuur bewerken" : "Nieuwe normuur"}
            </DialogTitle>
            <DialogDescription>
              Voeg een standaard normuur toe voor berekeningen
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Activiteit</Label>
              <Input
                value={normuurForm.activiteit}
                onChange={(e) =>
                  setNormuurForm({ ...normuurForm, activiteit: e.target.value })
                }
                placeholder="Bijv. Tegels leggen"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Scope</Label>
                <Select
                  value={normuurForm.scope}
                  onValueChange={(value) =>
                    setNormuurForm({ ...normuurForm, scope: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(scopeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Eenheid</Label>
                <Select
                  value={normuurForm.eenheid}
                  onValueChange={(value) =>
                    setNormuurForm({ ...normuurForm, eenheid: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m²">m²</SelectItem>
                    <SelectItem value="m³">m³</SelectItem>
                    <SelectItem value="m">m (strekkend)</SelectItem>
                    <SelectItem value="stuk">stuk</SelectItem>
                    <SelectItem value="uur">uur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Normuur per eenheid</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={normuurForm.normuurPerEenheid}
                onChange={(e) =>
                  setNormuurForm({
                    ...normuurForm,
                    normuurPerEenheid: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Aantal uren per {normuurForm.eenheid}
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Omschrijving (optioneel)</Label>
              <Input
                value={normuurForm.omschrijving}
                onChange={(e) =>
                  setNormuurForm({ ...normuurForm, omschrijving: e.target.value })
                }
                placeholder="Extra toelichting"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNormuurDialog(false)}
            >
              Annuleren
            </Button>
            <Button onClick={handleSaveNormuur} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editingNormuur ? "Bijwerken" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Normuur Dialog */}
      <AlertDialog
        open={showDeleteNormuurDialog}
        onOpenChange={setShowDeleteNormuurDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Normuur verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je &quot;{normuurToDelete?.activiteit}&quot; wilt
              verwijderen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNormuurToDelete(null)}>
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNormuur}
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
