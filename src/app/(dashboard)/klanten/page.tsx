"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
import {
  Users,
  Plus,
  Search,
  Loader2,
  Mail,
  Send,
  Phone,
  MapPin,
  Pencil,
  Archive,
  FileText,
  AlertTriangle,
  Bell,
  Upload,
  Globe,
  GlobeLock,
  ListTodo,
  MoreHorizontal,
} from "lucide-react";
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
import { TagInput } from "@/components/ui/tag-input";
import { toast } from "sonner";
import { useKlanten } from "@/hooks/use-klanten";
import { klantMatcht, zoekbareTekst, zoektermen } from "@/lib/klant-zoeken";
import { Id } from "../../../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { RelatieImportDialog } from "@/components/import/relatie-import-dialog";
import { BedrijfZoeken } from "@/components/klanten/bedrijf-zoeken";
import { AdresVeld } from "@/components/klanten/adres-veld";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useIsKantoor } from "@/hooks/use-users";
import {
  ExportDropdown,
  klantenExportColumns,
} from "@/components/export-dropdown";

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
  // TT-002: alleen gevuld bij een niet-particuliere klant
  contactpersoon?: string;
  kvkNummer?: string;
  btwNummer?: string;
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

/**
 * TT-002: de zakelijke velden horen alleen bij een niet-particuliere klant.
 * Bij "particulier" sturen we bewust lege strings mee (geen `undefined`): de
 * update-mutation slaat `undefined`-velden over, dus alleen zo wordt een
 * achtergebleven KvK-nummer ook echt gewist als je het type omzet.
 */
function zakelijkeVelden(form: {
  klantType: KlantType;
  contactpersoon: string;
  kvkNummer: string;
  btwNummer: string;
}) {
  const zakelijk = form.klantType !== "particulier";
  return {
    contactpersoon: zakelijk ? form.contactpersoon.trim() : "",
    kvkNummer: zakelijk ? form.kvkNummer.trim() : "",
    btwNummer: zakelijk ? form.btwNummer.trim() : "",
  };
}

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const { klanten, isLoading, create, update, archive } = useKlanten();

  // Initialize filter state from URL search params
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  // Alleen nog voor de URL: het filteren zelf gebeurt direct op `searchTerm`.
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Export data query
  // Export is kantoor-functionaliteit (PRD §1.2): de query wordt voor andere
  // rollen niet aangeroepen (skip) zodat de pagina gewoon laadt.
  const isKantoor = useIsKantoor();
  const exportData = useQuery(
    api.export.exportKlanten,
    user?._id && isKantoor ? {} : "skip"
  );

  // CRM-005: Klanten met opvolgherinneringen
  const klantIdsMetHerinnering = useQuery(
    api.klanten.getKlantenMetHerinneringen,
    user?._id ? {} : "skip"
  );
  const herinneringSet = useMemo(
    () => new Set(klantIdsMetHerinnering ?? []),
    [klantIdsMetHerinnering]
  );

  // Openstaande taken per klant — één query voor de hele lijst, geen N+1.
  const openTakenPerKlant = useQuery(
    api.klantTaken.openTellingPerKlant,
    user?._id ? {} : "skip"
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
    klantType: "particulier" as KlantType,
    tags: [] as string[],
    // TT-002: alleen gebruikt bij een niet-particuliere klant
    contactpersoon: "",
    kvkNummer: "",
    btwNummer: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pipelineFilter, setPipelineFilter] = useState<PipelineStatus | "alle">(
    (searchParams.get("pipeline") as PipelineStatus | "alle") || "alle"
  );
  const [klantTypeFilter, setKlantTypeFilter] = useState<KlantType | "alle">(
    (searchParams.get("type") as KlantType | "alle") || "alle"
  );

  /**
   * De filters staan in de URL zodat je een zoekopdracht kunt delen of
   * terugvinden met de terugknop. Bijwerken gebeurt op de gedebouncede term en
   * niet per toetsaanslag: `router.replace` is een navigatie, en die per letter
   * afvuren gaf merkbare vertraging tijdens het typen.
   */
  const urlParams = useMemo(() => {
    const params = new URLSearchParams();
    if (pipelineFilter !== "alle") params.set("pipeline", pipelineFilter);
    if (klantTypeFilter !== "alle") params.set("type", klantTypeFilter);
    if (debouncedSearchTerm) params.set("q", debouncedSearchTerm);
    return params.toString();
  }, [pipelineFilter, klantTypeFilter, debouncedSearchTerm]);

  useEffect(() => {
    // Staat de URL al goed (o.a. bij het eerste renderen), dan niet navigeren.
    if (window.location.search.replace(/^\?/, "") === urlParams) return;
    router.replace(urlParams ? `?${urlParams}` : "/klanten", { scroll: false });
  }, [urlParams, router]);

  const handlePipelineFilterChange = useCallback((value: PipelineStatus | "alle") => {
    setPipelineFilter(value);
  }, []);

  const handleKlantTypeFilterChange = useCallback((value: KlantType | "alle") => {
    setKlantTypeFilter(value);
  }, []);

  const handleSearchTermChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  // Portal mutations
  const activatePortalMutation = useMutation(api.klanten.activatePortal);
  const deactivatePortalMutation = useMutation(api.klanten.deactivatePortal);
  const sendPortalInvitationMutation = useMutation(
    api.klanten.sendPortalInvitation
  );

  // Portaal-activatie is een externe handeling (de klant krijgt toegang tot
  // zijn dossier), daarom altijd eerst expliciet bevestigen — nooit direct
  // vanaf de knop in de tabel.
  const [portalKlant, setPortalKlant] = useState<Klant | null>(null);
  const [isActivatingPortal, setIsActivatingPortal] = useState(false);

  const handleActivatePortal = useCallback((klant: Klant) => {
    setPortalKlant(klant);
  }, []);

  const confirmActivatePortal = useCallback(async () => {
    if (!portalKlant) return;
    setIsActivatingPortal(true);
    try {
      await activatePortalMutation({ id: portalKlant._id });
      toast.success(`Portaal geactiveerd voor ${portalKlant.naam}.`);
      setPortalKlant(null);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Fout bij activeren portaal");
      }
    } finally {
      setIsActivatingPortal(false);
    }
  }, [activatePortalMutation, portalKlant]);

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

  const handleSendPortalInvitation = useCallback(async (klant: Klant) => {
    try {
      await sendPortalInvitationMutation({ id: klant._id });
      toast.success(
        `Wachtwoord-uitnodiging verstuurd naar ${klant.email}.`
      );
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Fout bij versturen uitnodiging");
      }
    }
  }, [sendPortalInvitationMutation]);


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

  /**
   * Zoekbare tekst per klant, één keer opgebouwd zolang de lijst niet wijzigt.
   * Zonder dit wordt bij elke toetsaanslag voor elke klant opnieuw een string
   * samengesteld.
   */
  const zoekIndex = useMemo(
    () =>
      new Map(
        klantenWithOptimisticUpdates.map((klant) => [
          klant._id,
          zoekbareTekst(klant),
        ])
      ),
    [klantenWithOptimisticUpdates]
  );

  const filteredKlanten: Klant[] = useMemo(() => {
    let base = klantenWithOptimisticUpdates as Klant[];

    // Client-side filteren op de al geladen lijst — zie lib/klant-zoeken.ts
    // voor waarom dit niet meer via een Convex-query loopt.
    const termen = zoektermen(searchTerm);
    if (termen.length > 0) {
      base = base.filter((klant) =>
        klantMatcht(zoekIndex.get(klant._id) ?? "", termen)
      );
    }

    if (pipelineFilter !== "alle") {
      base = base.filter((klant) => klant.pipelineStatus === pipelineFilter);
    }
    if (klantTypeFilter !== "alle") {
      base = base.filter((klant) => (klant.klantType ?? "particulier") === klantTypeFilter);
    }
    return base;
  }, [searchTerm, zoekIndex, klantenWithOptimisticUpdates, pipelineFilter, klantTypeFilter]);

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
      klantType: "particulier",
      tags: [],
      contactpersoon: "",
      kvkNummer: "",
      btwNummer: "",
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
        // notities bewust niet meegestuurd (deprecated, PRD §2.3)
        klantType: formData.klantType,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
        ...zakelijkeVelden(formData),
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
      klantType: klant.klantType ?? "particulier",
      tags: klant.tags ?? [],
      contactpersoon: klant.contactpersoon ?? "",
      kvkNummer: klant.kvkNummer ?? "",
      btwNummer: klant.btwNummer ?? "",
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
      // notities bewust niet meegestuurd: het veld is deprecated (PRD §2.3)
      // en een update mag bestaande (gemigreerde) inhoud niet wissen
      klantType: formData.klantType,
      tags: formData.tags,
      ...zakelijkeVelden(formData),
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

  // §5.2: Archiveren i.p.v. hard delete; hard delete alleen via de GDPR-flow
  const handleDelete = useCallback(async () => {
    if (!selectedKlant) return;

    const klantId = selectedKlant._id;

    // 1. Apply optimistic archive immediately
    setOptimisticDeletedIds((prev) => new Set(prev).add(klantId));

    // Close dialog and show feedback immediately
    setShowDeleteDialog(false);
    toast.success("Klant gearchiveerd");
    setSelectedKlant(null);

    try {
      // 2. Make actual server call
      await archive(klantId);

      // 3. Clear optimistic archive (server data will take over)
      setOptimisticDeletedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(klantId);
        return newSet;
      });
    } catch {
      // 4. Rollback on error
      setOptimisticDeletedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(klantId);
        return newSet;
      });
      toast.error("Fout bij archiveren klant");
    }
  }, [selectedKlant, archive]);

  const handleDeleteClick = useCallback((klant: Klant) => {
    setSelectedKlant(klant);
    setShowDeleteDialog(true);
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
        // Vaste breedtes: de tabel moet binnen de kaart passen zonder
        // zijwaarts scrollen — lange namen/adressen korten in.
        width: "w-[34%]",
        render: (klant) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/klanten/${klant._id}`}
                className="font-medium hover:underline truncate max-w-full"
                title={klant.naam}
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
              {/* Geen status = nog geen stadium, géén "Lead": deze lijst laat
                  leads juist weg (hoortInKlantenLijst) en na een import zou
                  anders élke klant als lead worden bestempeld. */}
              {klant.pipelineStatus && (
                <Badge className={`text-xs ${PIPELINE_COLORS[klant.pipelineStatus]}`}>
                  {PIPELINE_LABELS[klant.pipelineStatus]}
                </Badge>
              )}
              <Badge className={`text-xs ${KLANT_TYPE_COLORS[klant.klantType ?? "particulier"]}`}>
                {KLANT_TYPE_LABELS[klant.klantType ?? "particulier"]}
              </Badge>
              {(openTakenPerKlant?.[klant._id] ?? 0) > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-0.5"
                  title={`${openTakenPerKlant?.[klant._id]} openstaande ta${openTakenPerKlant?.[klant._id] === 1 ? "ak" : "ken"}`}
                >
                  <ListTodo className="h-3 w-3" />
                  {openTakenPerKlant?.[klant._id]}
                </Badge>
              )}
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
        header: "Adres",
        isSecondary: true,
        sortable: true,
        sortKey: "plaats",
        width: "w-[30%]",
        render: (klant) => {
          // Na een import kunnen adresvelden leeg zijn; zonder deze opbouw
          // toont de rij een losse komma in plaats van een leesbaar adres.
          const adresregel = [
            klant.adres,
            [klant.postcode, klant.plaats].filter(Boolean).join(" "),
          ]
            .filter(Boolean)
            .join(", ");

          if (!adresregel) {
            return (
              <span className="text-sm text-muted-foreground">
                Geen adres bekend
              </span>
            );
          }

          return (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
              <span className="truncate" title={adresregel}>
                {adresregel}
              </span>
            </div>
          );
        },
      },
      {
        key: "telefoon",
        header: "Telefoon",
        mobileLabel: "Tel",
        showInCard: true,
        sortable: true,
        sortKey: "telefoon",
        width: "w-[12%]",
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
        width: "w-[18%]",
        render: (klant) =>
          klant.email ? (
            <div className="flex items-center gap-1.5 text-sm">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground hidden sm:inline" />
              <span className="truncate" title={klant.email}>{klant.email}</span>
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
        // Twee besturingselementen (bewerken + menu) i.p.v. vijf losse iconen.
        // Vijf knoppen pasten niet: in `table-fixed` is een px-breedte géén
        // ondergrens — bij een smal venster schaalt de browser alle kolommen
        // proportioneel mee, waardoor de eerste knop buiten de cel viel.
        // Zijwaarts scrollen is geen optie, dus verhuizen de minder gebruikte
        // acties naar een menu.
        width: "w-[88px]",
        allowOverflow: true,
        render: (klant) => (
          <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-8 sm:w-8"
              aria-label={`${klant.naam} bewerken`}
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(klant);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-8 sm:w-8"
                  aria-label={`Meer acties voor ${klant.naam}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem asChild>
                  <Link href={`/klanten/${klant._id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    Details bekijken
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {klant.portalEnabled ? (
                  <DropdownMenuItem onClick={() => handleDeactivatePortal(klant)}>
                    <GlobeLock className="mr-2 h-4 w-4 text-green-600" />
                    Portaal deactiveren
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    disabled={!klant.email}
                    onClick={() => handleActivatePortal(klant)}
                  >
                    <Globe className="mr-2 h-4 w-4" />
                    {klant.email
                      ? "Portaal activeren"
                      : "Portaal activeren (e-mail ontbreekt)"}
                  </DropdownMenuItem>
                )}

                {!klant.clerkUserId && (
                  <DropdownMenuItem
                    disabled={!klant.email}
                    onClick={() => handleSendPortalInvitation(klant)}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {klant.email
                      ? "Wachtwoord-uitnodiging sturen"
                      : "Uitnodiging sturen (e-mail ontbreekt)"}
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => handleDeleteClick(klant)}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archiveren
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [handleEdit, handleDeleteClick, herinneringSet, openTakenPerKlant, handleActivatePortal, handleDeactivatePortal, handleSendPortalInvitation]
  );

  // TT-002: het klanttype bepaalt welke velden zinvol zijn. Particulieren
  // krijgen geen contactpersoon/KvK/BTW te zien.
  const isZakelijkeKlant = formData.klantType !== "particulier";

  const klantFormJsx = (
    <div className="grid gap-3">
      {/* TT-006: zoeken vult de velden hieronder; handmatig kan altijd. */}
      <BedrijfZoeken
        onGevonden={(bedrijf) =>
          setFormData((prev) => ({
            ...prev,
            naam: bedrijf.naam || prev.naam,
            adres: bedrijf.adres || prev.adres,
            postcode: bedrijf.postcode || prev.postcode,
            plaats: bedrijf.plaats || prev.plaats,
            telefoon: bedrijf.telefoon || prev.telefoon,
          }))
        }
      />

      {/* Type staat bewust bovenaan: die keuze stuurt de rest van het formulier. */}
      <div className="space-y-2">
        <Label htmlFor="klantType">Type klant *</Label>
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="naam">
            {isZakelijkeKlant ? "Bedrijfsnaam *" : "Naam *"}
          </Label>
          <Input
            id="naam"
            placeholder={isZakelijkeKlant ? "De Groene Tuin B.V." : "Jan Jansen"}
            value={formData.naam}
            onChange={(e) => setFormData({ ...formData, naam: e.target.value })}
          />
        </div>
        {isZakelijkeKlant && (
          <div className="space-y-2">
            <Label htmlFor="contactpersoon">Contactpersoon</Label>
            <Input
              id="contactpersoon"
              placeholder="Jan Jansen"
              value={formData.contactpersoon}
              onChange={(e) =>
                setFormData({ ...formData, contactpersoon: e.target.value })
              }
            />
          </div>
        )}
      </div>

      {isZakelijkeKlant && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="kvkNummer">KvK-nummer</Label>
            <Input
              id="kvkNummer"
              inputMode="numeric"
              placeholder="12345678"
              value={formData.kvkNummer}
              onChange={(e) =>
                setFormData({ ...formData, kvkNummer: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="btwNummer">BTW-nummer</Label>
            <Input
              id="btwNummer"
              placeholder="NL123456789B01"
              value={formData.btwNummer}
              onChange={(e) =>
                setFormData({ ...formData, btwNummer: e.target.value })
              }
            />
          </div>
        </div>
      )}

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
        {/* Suggesties in het veld zelf: bij een particulier begin je bij het
            adres, niet bij een bedrijfsnaam. */}
        <AdresVeld
          id="adres"
          waarde={formData.adres}
          onChange={(waarde) => setFormData({ ...formData, adres: waarde })}
          onAdresGekozen={(adres) =>
            setFormData((prev) => ({
              ...prev,
              adres: adres.adres,
              postcode: adres.postcode || prev.postcode,
              plaats: adres.plaats || prev.plaats,
            }))
          }
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

      {/* Notities-veld verwijderd (PRD §2.3): het vrije Notities-veld is
          uitgefaseerd — losse notities lopen via de klanttijdlijn op de
          klant-detailpagina. Bestaande inhoud is daarheen gemigreerd. */}

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
          {isKantoor && (
            <ExportDropdown
              getData={() => exportData ?? []}
              columns={klantenExportColumns}
              filename="klanten"
              sheetName="Klanten"
              disabled={!exportData || exportData.length === 0}
            />
          )}
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
            {klantFormJsx}
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
          onClick={() => handlePipelineFilterChange("alle")}
        >
          Alle ({klantenWithOptimisticUpdates.length})
        </Badge>
        {/* "lead" overslaan: hoortInKlantenLijst houdt leads uit deze lijst,
            dus die pil zou altijd (0) tonen. Leads leven op /leads. */}
        {ALL_PIPELINE_STATUSES.filter((status) => status !== "lead").map((status) => {
          const count = klantenWithOptimisticUpdates.filter(
            (k) => k.pipelineStatus === status
          ).length;
          return (
            <Badge
              key={status}
              className={`cursor-pointer transition-colors ${
                pipelineFilter === status
                  ? PIPELINE_COLORS[status]
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              onClick={() => handlePipelineFilterChange(status)}
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
            onClick={() => handleKlantTypeFilterChange("alle")}
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
                onClick={() => handleKlantTypeFilterChange(type)}
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
                {/* Bij een actieve selectie klopt "in je bestand" niet meer:
                    de teller volgt de selectie, niet het bestand (WS1 B6). */}
                {searchTerm || pipelineFilter !== "alle" || klantTypeFilter !== "alle"
                  ? `${filteredKlanten.length} van ${klantenWithOptimisticUpdates.length} klant${klantenWithOptimisticUpdates.length !== 1 ? "en" : ""}`
                  : `${filteredKlanten.length} klant${filteredKlanten.length !== 1 ? "en" : ""} in je bestand`}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek klanten..."
                value={searchTerm}
                onChange={(e) => handleSearchTermChange(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedKlanten.length === 0 ? (
            /* Drie lege-staat-varianten (WS1 B6): zoekterm, filter, echt leeg.
               Voorheen keek de conditie alleen naar searchTerm, waardoor een
               0-filterresultaat de first-use-copy toonde bij 27 klanten. */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">
                {searchTerm || pipelineFilter !== "alle" || klantTypeFilter !== "alle"
                  ? "Geen klanten gevonden"
                  : "Nog geen klanten"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {searchTerm
                  ? `Geen resultaten voor "${searchTerm}"`
                  : pipelineFilter !== "alle" || klantTypeFilter !== "alle"
                    ? "Geen klanten met deze status of dit type."
                    : "Voeg je eerste klant toe om te beginnen."}
              </p>
              {(searchTerm || pipelineFilter !== "alle" || klantTypeFilter !== "alle") && (
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {searchTerm && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSearchTermChange("")}
                    >
                      Zoekopdracht wissen
                    </Button>
                  )}
                  {(pipelineFilter !== "alle" || klantTypeFilter !== "alle") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handlePipelineFilterChange("alle");
                        handleKlantTypeFilterChange("alle");
                      }}
                    >
                      Filters wissen
                    </Button>
                  )}
                </div>
              )}
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
          {klantFormJsx}
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

      {/* Archive Confirmation (§5.2) */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Klant archiveren</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {selectedKlant?.naam} wilt archiveren? De
              klant verdwijnt uit de lijst en kan via het archief worden
              hersteld. Definitief verwijderen kan alleen via de GDPR-flow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Archive className="mr-2 h-4 w-4" />
              )}
              Archiveren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Portaal-activatie bevestiging — de klant krijgt hiermee toegang tot
          zijn eigen dossier, dus nooit met één klik vanuit de tabel. */}
      <AlertDialog
        open={portalKlant !== null}
        onOpenChange={(open) => {
          if (!open && !isActivatingPortal) setPortalKlant(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-green-600" />
              Klantportaal activeren
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Je staat op het punt het klantportaal te activeren voor{" "}
                  <span className="font-medium text-foreground">
                    {portalKlant?.naam}
                  </span>
                  {portalKlant?.email && (
                    <>
                      {" "}
                      (
                      <span className="font-medium text-foreground">
                        {portalKlant.email}
                      </span>
                      )
                    </>
                  )}
                  .
                </p>
                <p>Na activatie kan deze klant in het portaal meekijken met:</p>
                <ul className="list-disc space-y-0.5 pl-5">
                  <li>zijn offertes en facturen</li>
                  <li>de voortgang en foto&apos;s van zijn projecten</li>
                  <li>documenten en berichten</li>
                </ul>
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  Er wordt nu <span className="font-medium">nog geen e-mail</span>{" "}
                  verstuurd. De klant kan pas inloggen nadat je hierna
                  afzonderlijk de wachtwoord-uitnodiging verstuurt.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActivatingPortal}>
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isActivatingPortal}
              onClick={(e) => {
                // Voorkom auto-close: de dialog sluit pas als de mutation slaagt.
                e.preventDefault();
                void confirmActivatePortal();
              }}
            >
              {isActivatingPortal ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Globe className="mr-2 h-4 w-4" />
              )}
              Portaal activeren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import — gedeelde dialog, ook gebruikt op de leveranciers-pagina */}
      <RelatieImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        soort="klant"
      />
    </>
  );
}

// ============================================
// Main page — alleen Klanten (PRD §1.3: leads hebben een eigen
// menu-item /leads; de lead-funnel leeft daar op het kanban-bord)
// ============================================

function KlantenPageShell() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Oude tab-URL (/klanten?tab=leads) doorverwijzen naar het eigen menu-item
  const wilLeads = searchParams.get("tab") === "leads";
  useEffect(() => {
    if (wilLeads) {
      router.replace("/leads");
    }
  }, [wilLeads, router]);

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
            <p className="text-muted-foreground">Beheer je klantenbestand</p>
          </div>
        </div>

        <KlantenPageContent />
      </m.div>
    </>
  );
}

export default function KlantenPage() {
  return (
    <RequireRole allowedRoles={["directie", "projectleider"]}>
      <KlantenPageShell />
    </RequireRole>
  );
}
