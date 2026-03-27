"use client";

import { useState, useCallback, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { m } from "framer-motion";
import { RequireRole } from "@/components/require-admin";
import { PageHeader } from "@/components/page-header";
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
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveTable,
  ResponsiveColumn,
} from "@/components/ui/responsive-table";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  Plus,
  Search,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Trash2,
  FileText,
  AlertTriangle,
  Bell,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileUp,
  Globe,
  GlobeLock,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import { toast } from "sonner";
import { useKlanten, useKlantenSearch } from "@/hooks/use-klanten";
import { Id } from "../../../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  parseKlantenFile,
  getSampleKlantCSV,
  type KlantParseResult,
} from "@/lib/klant-import-parser";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useIsAdmin } from "@/hooks/use-users";
import {
  ExportDropdown,
  klantenExportColumns,
} from "@/components/export-dropdown";
import { KanbanBoard } from "@/components/leads/kanban-board";
import { PipelineStats } from "@/components/leads/pipeline-stats";
import { LeadDetailModal } from "@/components/leads/lead-detail-modal";
import { NieuweLeadDialog } from "@/components/leads/nieuwe-lead-dialog";
import type { Lead } from "@/components/leads/lead-card";

type PipelineStatus = "lead" | "offerte_verzonden" | "getekend" | "in_uitvoering" | "opgeleverd" | "onderhoud";

type KlantType = "particulier" | "zakelijk" | "vve" | "gemeente" | "overig";

type Klant = {
  _id: Id<"klanten">;
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email?: string;
  telefoon?: string;
  notities?: string;
  pipelineStatus?: PipelineStatus;
  klantType?: KlantType;
  tags?: string[];
  portalEnabled?: boolean;
  clerkUserId?: string;
  createdAt: number;
  updatedAt: number;
};

const KLANT_TYPE_LABELS: Record<KlantType, string> = {
  particulier: "Particulier",
  zakelijk: "Zakelijk",
  vve: "VvE",
  gemeente: "Gemeente",
  overig: "Overig",
};

const KLANT_TYPE_COLORS: Record<KlantType, string> = {
  particulier: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  zakelijk: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  vve: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  gemeente: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  overig: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const ALL_KLANT_TYPES: KlantType[] = ["particulier", "zakelijk", "vve", "gemeente", "overig"];

const PIPELINE_LABELS: Record<PipelineStatus, string> = {
  lead: "Lead",
  offerte_verzonden: "Offerte verzonden",
  getekend: "Getekend",
  in_uitvoering: "In uitvoering",
  opgeleverd: "Opgeleverd",
  onderhoud: "Onderhoud",
};

const PIPELINE_COLORS: Record<PipelineStatus, string> = {
  lead: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  offerte_verzonden: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  getekend: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  in_uitvoering: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  opgeleverd: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  onderhoud: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const ALL_PIPELINE_STATUSES: PipelineStatus[] = [
  "lead",
  "offerte_verzonden",
  "getekend",
  "in_uitvoering",
  "opgeleverd",
  "onderhoud",
];

function KlantenPageContent() {
  const { user } = useCurrentUser();
  const { klanten, isLoading, create, update, remove } = useKlanten();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const { results: searchResults } = useKlantenSearch(debouncedSearchTerm);

  // Export data query
  const exportData = useQuery(api.export.exportKlanten, user?._id ? {} : "skip");

  // CRM-005: Klanten met opvolgherinneringen
  const klantIdsMetHerinnering = useQuery(
    api.klanten.getKlantenMetHerinneringen,
    user?._id ? {} : "skip"
  );
  const herinneringSet = useMemo(
    () => new Set(klantIdsMetHerinnering ?? []),
    [klantIdsMetHerinnering]
  );

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedKlant, setSelectedKlant] = useState<{
    _id: Id<"klanten">;
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
    notities?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    naam: "",
    adres: "",
    postcode: "",
    plaats: "",
    email: "",
    telefoon: "",
    notities: "",
    klantType: "particulier" as KlantType,
    tags: [] as string[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pipelineFilter, setPipelineFilter] = useState<PipelineStatus | "alle">("alle");
  const [klantTypeFilter, setKlantTypeFilter] = useState<KlantType | "alle">("alle");

  // Portal mutations
  const activatePortalMutation = useMutation(api.klanten.activatePortal);
  const deactivatePortalMutation = useMutation(api.klanten.deactivatePortal);

  const handleActivatePortal = useCallback(async (klant: Klant) => {
    try {
      await activatePortalMutation({ id: klant._id });
      toast.success(`Portaal geactiveerd voor ${klant.naam}. Een uitnodiging wordt verstuurd.`);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Fout bij activeren portaal");
      }
    }
  }, [activatePortalMutation]);

  const handleDeactivatePortal = useCallback(async (klant: Klant) => {
    try {
      await deactivatePortalMutation({ id: klant._id });
      toast.success(`Portaal gedeactiveerd voor ${klant.naam}`);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Fout bij deactiveren portaal");
      }
    }
  }, [deactivatePortalMutation]);

  // Import state
  const importKlantenMutation = useMutation(api.klanten.importKlanten);
  const [importParseResult, setImportParseResult] = useState<KlantParseResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // CRM-003: Fetch all existing tags for autocomplete
  const allTags = useQuery(api.klanten.getAllTags, user?._id ? {} : "skip");

  // CRM-007: Debounced duplicate check for form fields
  const debouncedEmail = useDebounce(formData.email, 500);
  const debouncedTelefoon = useDebounce(formData.telefoon, 500);
  const debouncedNaam = useDebounce(formData.naam, 500);
  const debouncedPostcode = useDebounce(formData.postcode, 500);

  const hasDuplicateCheckInput = !!(debouncedEmail || debouncedTelefoon || (debouncedNaam && debouncedPostcode));
  const duplicates = useQuery(
    api.klanten.checkDuplicates,
    hasDuplicateCheckInput && user?._id
      ? {
          email: debouncedEmail || undefined,
          telefoon: debouncedTelefoon || undefined,
          naam: debouncedNaam || undefined,
          postcode: debouncedPostcode || undefined,
          excludeId: selectedKlant?._id,
        }
      : "skip"
  );

  // Optimistic updates state
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(new Set());
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, Partial<Klant>>>(new Map());

  // Apply optimistic updates to klanten
  const klantenWithOptimisticUpdates = useMemo(() => {
    if (!klanten) return [];
    return klanten
      .filter((klant) => !optimisticDeletedIds.has(klant._id))
      .map((klant) => {
        const updates = optimisticUpdates.get(klant._id);
        if (updates) {
          return { ...klant, ...updates };
        }
        return klant;
      });
  }, [klanten, optimisticDeletedIds, optimisticUpdates]);

  const filteredKlanten: Klant[] = useMemo(() => {
    let base = (debouncedSearchTerm ? searchResults : klantenWithOptimisticUpdates) as Klant[];
    if (pipelineFilter !== "alle") {
      base = base.filter((klant) => (klant.pipelineStatus ?? "lead") === pipelineFilter);
    }
    if (klantTypeFilter !== "alle") {
      base = base.filter((klant) => (klant.klantType ?? "particulier") === klantTypeFilter);
    }
    return base;
  }, [debouncedSearchTerm, searchResults, klantenWithOptimisticUpdates, pipelineFilter, klantTypeFilter]);

  // Apply sorting to klanten
  const { sortedData: sortedKlanten, sortConfig, toggleSort } = useTableSort<Klant>(
    filteredKlanten,
    "naam"
  );

  const resetForm = useCallback(() => {
    setFormData({
      naam: "",
      adres: "",
      postcode: "",
      plaats: "",
      email: "",
      telefoon: "",
      notities: "",
      klantType: "particulier",
      tags: [],
    });
  }, []);

  const handleAdd = useCallback(async () => {
    if (!formData.naam || !formData.adres || !formData.postcode || !formData.plaats) {
      toast.error("Vul alle verplichte velden in");
      return;
    }

    setIsSubmitting(true);
    try {
      await create({
        naam: formData.naam,
        adres: formData.adres,
        postcode: formData.postcode,
        plaats: formData.plaats,
        email: formData.email || undefined,
        telefoon: formData.telefoon || undefined,
        notities: formData.notities || undefined,
        klantType: formData.klantType,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
      });
      toast.success("Klant toegevoegd");
      setShowAddDialog(false);
      resetForm();
    } catch {
      toast.error("Fout bij toevoegen klant");
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, create, resetForm]);

  const handleEdit = useCallback((klant: Klant | null) => {
    if (!klant) return;
    setSelectedKlant(klant);
    setFormData({
      naam: klant.naam,
      adres: klant.adres,
      postcode: klant.postcode,
      plaats: klant.plaats,
      email: klant.email || "",
      telefoon: klant.telefoon || "",
      notities: klant.notities || "",
      klantType: klant.klantType ?? "particulier",
      tags: klant.tags ?? [],
    });
    setShowEditDialog(true);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!selectedKlant) return;

    const updatedData = {
      naam: formData.naam,
      adres: formData.adres,
      postcode: formData.postcode,
      plaats: formData.plaats,
      email: formData.email || undefined,
      telefoon: formData.telefoon || undefined,
      notities: formData.notities || undefined,
      klantType: formData.klantType,
      tags: formData.tags,
    };

    // 1. Apply optimistic update immediately
    setOptimisticUpdates((prev) => {
      const newMap = new Map(prev);
      newMap.set(selectedKlant._id, updatedData);
      return newMap;
    });

    // Close dialog and show feedback immediately
    setShowEditDialog(false);
    toast.success("Klant bijgewerkt");
    const klantId = selectedKlant._id;
    setSelectedKlant(null);
    resetForm();

    try {
      // 2. Make actual server call
      await update(klantId, updatedData);

      // 3. Clear optimistic update (server data will take over)
      setOptimisticUpdates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(klantId);
        return newMap;
      });
    } catch {
      // 4. Rollback on error
      setOptimisticUpdates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(klantId);
        return newMap;
      });
      toast.error("Fout bij bijwerken klant");
    }
  }, [selectedKlant, formData, update, resetForm]);

  const handleDelete = useCallback(async () => {
    if (!selectedKlant) return;

    const klantId = selectedKlant._id;

    // 1. Apply optimistic delete immediately
    setOptimisticDeletedIds((prev) => new Set(prev).add(klantId));

    // Close dialog and show feedback immediately
    setShowDeleteDialog(false);
    toast.success("Klant verwijderd");
    setSelectedKlant(null);

    try {
      // 2. Make actual server call
      await remove(klantId);

      // 3. Clear optimistic delete (server data will take over)
      setOptimisticDeletedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(klantId);
        return newSet;
      });
    } catch (error) {
      // 4. Rollback on error
      setOptimisticDeletedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(klantId);
        return newSet;
      });
      if (error instanceof Error && error.message.includes("gekoppelde offertes")) {
        toast.error(error.message);
      } else {
        toast.error("Fout bij verwijderen klant");
      }
    }
  }, [selectedKlant, remove]);

  const handleDeleteClick = useCallback((klant: Klant) => {
    setSelectedKlant(klant);
    setShowDeleteDialog(true);
  }, []);

  // Import handlers
  const handleFileSelect = useCallback(async (file: File) => {
    setIsParsing(true);
    setImportResult(null);
    try {
      const result = await parseKlantenFile(file);
      setImportParseResult(result);
    } catch {
      toast.error("Fout bij verwerken bestand");
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleImportDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleImportFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleImportSubmit = useCallback(async () => {
    if (!importParseResult || importParseResult.entries.length === 0) return;

    setIsImporting(true);
    try {
      const result = await importKlantenMutation({
        klanten: importParseResult.entries.map((entry) => ({
          naam: entry.naam,
          email: entry.email,
          telefoon: entry.telefoon,
          adres: entry.adres,
          postcode: entry.postcode,
          plaats: entry.plaats,
          klantType: entry.klantType,
        })),
      });
      setImportResult(result);
      if (result.imported > 0) {
        toast.success(`${result.imported} klant${result.imported !== 1 ? "en" : ""} geimporteerd`);
      }
    } catch {
      toast.error("Fout bij importeren klanten");
    } finally {
      setIsImporting(false);
    }
  }, [importParseResult, importKlantenMutation]);

  const handleImportDialogClose = useCallback((open: boolean) => {
    if (!open) {
      setImportParseResult(null);
      setImportResult(null);
      setIsDragOver(false);
    }
    setShowImportDialog(open);
  }, []);

  const handleDownloadSampleCSV = useCallback(() => {
    const csv = getSampleKlantCSV();
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "klanten-voorbeeld.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Column configuration for ResponsiveTable
  const columns: ResponsiveColumn<Klant, keyof Klant>[] = useMemo(
    () => [
      {
        key: "naam",
        header: "Naam",
        isPrimary: true,
        sortable: true,
        sortKey: "naam",
        render: (klant) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/klanten/${klant._id}`}
                className="font-medium hover:underline"
              >
                {klant.naam}
              </Link>
              {/* CRM-005: Opvolgherinnering indicator */}
              {herinneringSet.has(klant._id) && (
                <span title="Opvolging nodig" className="relative flex h-5 w-5 items-center justify-center">
                  <Bell className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                </span>
              )}
              <Badge className={`text-xs ${PIPELINE_COLORS[klant.pipelineStatus ?? "lead"]}`}>
                {PIPELINE_LABELS[klant.pipelineStatus ?? "lead"]}
              </Badge>
              <Badge className={`text-xs ${KLANT_TYPE_COLORS[klant.klantType ?? "particulier"]}`}>
                {KLANT_TYPE_LABELS[klant.klantType ?? "particulier"]}
              </Badge>
              {klant.portalEnabled && klant.clerkUserId && (
                <Badge className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <Globe className="h-3 w-3 mr-0.5" />
                  Portaal actief
                </Badge>
              )}
              {klant.portalEnabled && !klant.clerkUserId && (
                <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  <Globe className="h-3 w-3 mr-0.5" />
                  Uitgenodigd
                </Badge>
              )}
            </div>
            {klant.tags && klant.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {klant.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "plaats",
        header: "Plaats",
        isSecondary: true,
        sortable: true,
        sortKey: "plaats",
        render: (klant) => (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 hidden sm:inline" />
            <span className="truncate max-w-[200px] sm:max-w-none" title={`${klant.adres}, ${klant.postcode} ${klant.plaats}`}>
              {klant.adres}, {klant.postcode} {klant.plaats}
            </span>
          </div>
        ),
      },
      {
        key: "telefoon",
        header: "Telefoon",
        mobileLabel: "Tel",
        showInCard: true,
        sortable: true,
        sortKey: "telefoon",
        render: (klant) =>
          klant.telefoon ? (
            <div className="flex items-center gap-1.5 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
              <span>{klant.telefoon}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        key: "email",
        header: "E-mail",
        mobileLabel: "Email",
        showInCard: true,
        sortable: true,
        sortKey: "email",
        render: (klant) =>
          klant.email ? (
            <div className="flex items-center gap-1.5 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
              <span className="truncate max-w-[150px]" title={klant.email}>{klant.email}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        key: "acties",
        header: "Acties",
        align: "right",
        showInCard: true,
        mobileLabel: "",
        render: (klant) => (
          <TooltipProvider>
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Bekijk details">
                <Link href={`/klanten/${klant._id}`}>
                  <FileText className="h-4 w-4" />
                </Link>
              </Button>
              {/* Portal activate/deactivate button */}
              {klant.portalEnabled ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 sm:h-8 sm:w-8"
                      aria-label="Portaal deactiveren"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeactivatePortal(klant);
                      }}
                    >
                      <GlobeLock className="h-4 w-4 text-green-600" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Portaal deactiveren</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 sm:h-8 sm:w-8"
                      aria-label="Portaal activeren"
                      disabled={!klant.email}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleActivatePortal(klant);
                      }}
                    >
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {klant.email
                      ? "Portaal activeren"
                      : "Voeg eerst een e-mailadres toe"}
                  </TooltipContent>
                </Tooltip>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-8 sm:w-8"
                aria-label="Bewerken"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(klant);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-8 sm:w-8"
                aria-label="Verwijderen"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(klant);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </TooltipProvider>
        ),
      },
    ],
    [handleEdit, handleDeleteClick, herinneringSet, handleActivatePortal, handleDeactivatePortal]
  );

  const KlantForm = () => (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="naam">Naam *</Label>
          <Input
            id="naam"
            placeholder="Jan Jansen"
            value={formData.naam}
            onChange={(e) => setFormData({ ...formData, naam: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="klantType">Type klant</Label>
          <Select
            value={formData.klantType}
            onValueChange={(value) =>
              setFormData({ ...formData, klantType: value as KlantType })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecteer type" />
            </SelectTrigger>
            <SelectContent>
              {ALL_KLANT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {KLANT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="telefoon">Telefoon</Label>
          <Input
            id="telefoon"
            placeholder="06-12345678"
            value={formData.telefoon}
            onChange={(e) =>
              setFormData({ ...formData, telefoon: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="jan@voorbeeld.nl"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="adres">Adres *</Label>
        <Input
          id="adres"
          placeholder="Hoofdstraat 1"
          value={formData.adres}
          onChange={(e) => setFormData({ ...formData, adres: e.target.value })}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="postcode">Postcode *</Label>
          <Input
            id="postcode"
            placeholder="1234 AB"
            value={formData.postcode}
            onChange={(e) =>
              setFormData({ ...formData, postcode: e.target.value })
            }
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="plaats">Plaats *</Label>
          <Input
            id="plaats"
            placeholder="Amsterdam"
            value={formData.plaats}
            onChange={(e) => setFormData({ ...formData, plaats: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        <TagInput
          value={formData.tags}
          onChange={(tags) => setFormData({ ...formData, tags })}
          suggestions={allTags ?? []}
          placeholder="Typ een tag en druk Enter..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notities">Notities</Label>
        <Textarea
          id="notities"
          placeholder="Extra informatie over de klant..."
          value={formData.notities}
          onChange={(e) =>
            setFormData({ ...formData, notities: e.target.value })
          }
          rows={3}
        />
      </div>

      {/* CRM-007: Duplicate warning */}
      {duplicates && duplicates.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Mogelijke duplicaat gevonden
              </p>
              {duplicates.map((dup) => (
                <div key={dup._id} className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <span>
                    <strong>{dup.naam}</strong>
                    {" — match op "}
                    {dup.matchType === "email" ? "e-mail" : dup.matchType === "telefoon" ? "telefoonnummer" : "naam + postcode"}
                  </span>
                  <Link
                    href={`/klanten/${dup._id}`}
                    className="text-xs underline hover:text-amber-900 dark:hover:text-amber-100"
                    target="_blank"
                  >
                    Bekijk
                  </Link>
                </div>
              ))}
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Je kunt alsnog doorgaan als dit geen duplicaat is.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <m.div
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
        </m.div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          <ExportDropdown
            getData={() => exportData ?? []}
            columns={klantenExportColumns}
            filename="klanten"
            sheetName="Klanten"
            disabled={!exportData || exportData.length === 0}
          />
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importeren
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe Klant
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nieuwe Klant</DialogTitle>
              <DialogDescription>
                Voeg een nieuwe klant toe aan je klantenbestand.
              </DialogDescription>
            </DialogHeader>
            <KlantForm />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
              >
                Annuleren
              </Button>
              <Button onClick={handleAdd} disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Toevoegen
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Pipeline filter */}
      <div className="flex flex-wrap gap-2">
        <Badge
          className={`cursor-pointer transition-colors ${
            pipelineFilter === "alle"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          onClick={() => setPipelineFilter("alle")}
        >
          Alle ({klantenWithOptimisticUpdates.length})
        </Badge>
        {ALL_PIPELINE_STATUSES.map((status) => {
          const count = klantenWithOptimisticUpdates.filter(
            (k) => (k.pipelineStatus ?? "lead") === status
          ).length;
          return (
            <Badge
              key={status}
              className={`cursor-pointer transition-colors ${
                pipelineFilter === status
                  ? PIPELINE_COLORS[status]
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              onClick={() => setPipelineFilter(status)}
            >
              {PIPELINE_LABELS[status]} ({count})
            </Badge>
          );
        })}
      </div>

      {/* CRM-003: Klant type filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground font-medium">Type:</span>
        <div className="flex flex-wrap gap-2">
          <Badge
            className={`cursor-pointer transition-colors ${
              klantTypeFilter === "alle"
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            onClick={() => setKlantTypeFilter("alle")}
          >
            Alle
          </Badge>
          {ALL_KLANT_TYPES.map((type) => {
            const count = klantenWithOptimisticUpdates.filter(
              (k) => (k.klantType ?? "particulier") === type
            ).length;
            return (
              <Badge
                key={type}
                className={`cursor-pointer transition-colors ${
                  klantTypeFilter === type
                    ? KLANT_TYPE_COLORS[type]
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                onClick={() => setKlantTypeFilter(type)}
              >
                {KLANT_TYPE_LABELS[type]} ({count})
              </Badge>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Klantenlijst
              </CardTitle>
              <CardDescription>
                {filteredKlanten.length} klant{filteredKlanten.length !== 1 ? "en" : ""}{pipelineFilter !== "alle" ? ` (${PIPELINE_LABELS[pipelineFilter]})` : ""} in je bestand
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek klanten..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedKlanten.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">
                {searchTerm
                  ? "Geen klanten gevonden"
                  : "Nog geen klanten"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {searchTerm
                  ? `Geen resultaten voor "${searchTerm}"`
                  : "Voeg je eerste klant toe om te beginnen."}
              </p>
            </div>
          ) : (
            <ResponsiveTable
              data={sortedKlanten}
              columns={columns}
              keyExtractor={(klant) => klant._id}
              emptyMessage={
                searchTerm
                  ? `Geen resultaten voor "${searchTerm}"`
                  : "Voeg je eerste klant toe om te beginnen."
              }
              mobileBreakpoint="md"
              sortConfig={sortConfig}
              onSort={toggleSort}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Klant Bewerken</DialogTitle>
            <DialogDescription>
              Pas de gegevens van {selectedKlant?.naam} aan.
            </DialogDescription>
          </DialogHeader>
          <KlantForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Klant Verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {selectedKlant?.naam} wilt verwijderen? Deze
              actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={handleImportDialogClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Klanten Importeren
            </DialogTitle>
            <DialogDescription>
              Upload een CSV bestand met klantgegevens. Duplicaten worden automatisch overgeslagen.
            </DialogDescription>
          </DialogHeader>

          {/* Import result state */}
          {importResult && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Import voltooid
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 text-center">
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">{importResult.imported}</p>
                    <p className="text-xs text-green-600 dark:text-green-500">Geimporteerd</p>
                  </div>
                  <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-center">
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{importResult.skipped}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">Overgeslagen (duplicaat)</p>
                  </div>
                  <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-center">
                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">{importResult.errors.length}</p>
                    <p className="text-xs text-red-600 dark:text-red-500">Fouten</p>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Fouten:</p>
                    <ul className="text-xs text-red-600 dark:text-red-500 space-y-0.5 max-h-32 overflow-y-auto">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => handleImportDialogClose(false)}>Sluiten</Button>
              </DialogFooter>
            </div>
          )}

          {/* Parse + upload state */}
          {!importResult && (
            <div className="space-y-4">
              {/* File drop zone */}
              <div
                className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleImportDrop}
              >
                {isParsing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Bestand verwerken...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <FileUp className="h-8 w-8 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-medium">Sleep een CSV bestand hierheen</p>
                      <p className="text-xs text-muted-foreground">of klik om een bestand te selecteren</p>
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      className="absolute inset-0 cursor-pointer opacity-0"
                      onChange={handleImportFileInput}
                    />
                  </div>
                )}
              </div>

              {/* Sample CSV download */}
              <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                <div className="text-sm">
                  <p className="font-medium">Voorbeeld CSV</p>
                  <p className="text-xs text-muted-foreground">Download een voorbeeldbestand met het juiste formaat</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadSampleCSV}>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Download
                </Button>
              </div>

              {/* Parse errors */}
              {importParseResult && importParseResult.errors.length > 0 && (
                <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-1.5 mb-1">
                    <XCircle className="h-4 w-4" />
                    Validatiefouten
                  </p>
                  <ul className="text-xs text-red-600 dark:text-red-500 space-y-0.5 max-h-32 overflow-y-auto">
                    {importParseResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Parse warnings */}
              {importParseResult && importParseResult.warnings.length > 0 && (
                <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1">
                    <AlertCircle className="h-4 w-4" />
                    Waarschuwingen
                  </p>
                  <ul className="text-xs text-amber-600 dark:text-amber-500 space-y-0.5 max-h-24 overflow-y-auto">
                    {importParseResult.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview table */}
              {importParseResult && importParseResult.entries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Voorbeeld ({importParseResult.entries.length} klant{importParseResult.entries.length !== 1 ? "en" : ""} gevonden)
                  </p>
                  <div className="rounded-md border overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">#</th>
                          <th className="px-3 py-2 text-left font-medium">Naam</th>
                          <th className="px-3 py-2 text-left font-medium">E-mail</th>
                          <th className="px-3 py-2 text-left font-medium">Telefoon</th>
                          <th className="px-3 py-2 text-left font-medium">Adres</th>
                          <th className="px-3 py-2 text-left font-medium">Postcode</th>
                          <th className="px-3 py-2 text-left font-medium">Plaats</th>
                          <th className="px-3 py-2 text-left font-medium">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {importParseResult.entries.slice(0, 50).map((entry, i) => (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-1.5 font-medium">{entry.naam}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{entry.email || "-"}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{entry.telefoon || "-"}</td>
                            <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[120px]">{entry.adres}</td>
                            <td className="px-3 py-1.5">{entry.postcode}</td>
                            <td className="px-3 py-1.5">{entry.plaats}</td>
                            <td className="px-3 py-1.5">
                              <Badge className={`text-[10px] ${KLANT_TYPE_COLORS[entry.klantType]}`}>
                                {KLANT_TYPE_LABELS[entry.klantType]}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importParseResult.entries.length > 50 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        ...en nog {importParseResult.entries.length - 50} meer
                      </p>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => handleImportDialogClose(false)}>
                  Annuleren
                </Button>
                <Button
                  onClick={handleImportSubmit}
                  disabled={!importParseResult || importParseResult.entries.length === 0 || isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {isImporting
                    ? "Bezig met importeren..."
                    : `${importParseResult?.entries.length ?? 0} klant${(importParseResult?.entries.length ?? 0) !== 1 ? "en" : ""} importeren`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================
// Leads tab content (Kanban board)
// ============================================

function LeadsTabContent() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [nieuweLeadOpen, setNieuweLeadOpen] = useState(false);

  const leads = useQuery(api.configuratorAanvragen.listByPipeline);

  if (leads === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setNieuweLeadOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe Lead
        </Button>
      </div>

      <KanbanBoard
        leads={leads}
        onLeadClick={(lead) => {
          setSelectedLead(lead);
          setDetailOpen(true);
        }}
      />

      <div className="mt-6">
        <PipelineStats />
      </div>

      <LeadDetailModal
        lead={selectedLead}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedLead(null);
        }}
      />

      <NieuweLeadDialog
        open={nieuweLeadOpen}
        onClose={() => setNieuweLeadOpen(false)}
      />
    </>
  );
}

// ============================================
// Main page with Klanten / Leads tabs
// ============================================

function KlantenPageWithTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const activeTab = searchParams.get("tab") || "klanten";

  const aantalNieuweAanvragen = useQuery(
    api.configuratorAanvragen.countByStatus,
    isAdmin ? {} : "skip"
  );

  const handleTabChange = (tab: string) => {
    router.push(`/klanten${tab === "klanten" ? "" : `?tab=${tab}`}`, { scroll: false });
  };

  return (
    <>
      <PageHeader />
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Klanten</h1>
            <p className="text-muted-foreground">Beheer je klantenbestand en leads</p>
          </div>
        </div>

        {isAdmin ? (
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="klanten">Klanten</TabsTrigger>
              <TabsTrigger value="leads" className="flex items-center gap-2">
                Leads
                {aantalNieuweAanvragen !== undefined && aantalNieuweAanvragen > 0 && (
                  <Badge variant="default" className="text-xs h-5 min-w-5 px-1 bg-blue-600 hover:bg-blue-600">
                    {aantalNieuweAanvragen}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <div className="mt-6 flex flex-col gap-6">
              {activeTab === "klanten" ? <KlantenPageContent /> : <LeadsTabContent />}
            </div>
          </Tabs>
        ) : (
          <KlantenPageContent />
        )}
      </m.div>
    </>
  );
}

export default function KlantenPage() {
  return (
    <RequireRole allowedRoles={["directie", "projectleider"]}>
      <KlantenPageWithTabs />
    </RequireRole>
  );
}
