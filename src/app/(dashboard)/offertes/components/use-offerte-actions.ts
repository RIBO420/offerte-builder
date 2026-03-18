"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { toast } from "sonner";
import { showDeleteToast } from "@/lib/toast-utils";
import type { SortableOfferte } from "./types";

export function useOfferteActions() {
  const router = useRouter();
  const {
    offertes,
    stats,
    isLoading: isOffertesLoading,
    delete: deleteOfferte,
    restore: restoreOfferte,
    duplicate,
    bulkUpdateStatus,
    bulkRemove,
    bulkRestore,
  } = useOffertes();
  const { getNextNummer } = useInstellingen();

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<Id<"offertes">>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<string>("");

  // Optimistic updates state
  const [optimisticStatusUpdates, setOptimisticStatusUpdates] = useState<Map<string, string>>(new Map());
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(new Set());

  const handleDuplicate = useCallback(async (offerteId: string) => {
    try {
      const newNummer = await getNextNummer();
      await duplicate({ id: offerteId as Id<"offertes">, newOfferteNummer: newNummer });
      toast.success("Offerte gedupliceerd");
    } catch {
      toast.error("Fout bij dupliceren offerte");
    }
  }, [getNextNummer, duplicate]);

  const handleDelete = useCallback(async (offerteId: string) => {
    const id = offerteId as Id<"offertes">;

    setOptimisticDeletedIds((prev) => new Set(prev).add(id));

    try {
      await deleteOfferte({ id });

      setOptimisticDeletedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });

      showDeleteToast(
        "Offerte verwijderd",
        async () => {
          await restoreOfferte({ id });
        }
      );
    } catch {
      setOptimisticDeletedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      toast.error("Fout bij verwijderen offerte");
    }
  }, [deleteOfferte, restoreOfferte]);

  const handleNavigate = useCallback((offerteId: string) => {
    router.push(`/offertes/${offerteId}`);
  }, [router]);

  // Bulk action handlers
  const toggleSelectAll = useCallback((sortedOffertes: SortableOfferte[]) => {
    if (sortedOffertes.length === 0) return;
    if (selectedIds.size === sortedOffertes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedOffertes.map((o) => o._id)));
    }
  }, [selectedIds.size]);

  const toggleSelect = useCallback((id: Id<"offertes">) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkStatusValue("");
  }, []);

  const handleBulkStatusChange = useCallback(async (status: string) => {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    const count = ids.length;

    setOptimisticStatusUpdates((prev) => {
      const newMap = new Map(prev);
      ids.forEach((id) => newMap.set(id, status));
      return newMap;
    });

    toast.success(`${count} offerte(s) bijgewerkt naar ${status}`);
    clearSelection();

    try {
      await bulkUpdateStatus({
        ids,
        status: status as "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen",
      });

      setOptimisticStatusUpdates((prev) => {
        const newMap = new Map(prev);
        ids.forEach((id) => newMap.delete(id));
        return newMap;
      });
    } catch (error) {
      setOptimisticStatusUpdates((prev) => {
        const newMap = new Map(prev);
        ids.forEach((id) => newMap.delete(id));
        return newMap;
      });
      const errorMessage = error instanceof Error ? error.message : "Fout bij bijwerken status";
      toast.error(errorMessage);
    }
  }, [selectedIds, bulkUpdateStatus, clearSelection]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const count = ids.length;

    setOptimisticDeletedIds((prev) => {
      const newSet = new Set(prev);
      ids.forEach((id) => newSet.add(id));
      return newSet;
    });

    clearSelection();
    setShowBulkDeleteDialog(false);

    try {
      await bulkRemove({ ids });

      setOptimisticDeletedIds((prev) => {
        const newSet = new Set(prev);
        ids.forEach((id) => newSet.delete(id));
        return newSet;
      });

      showDeleteToast(
        `${count} offerte(s) verwijderd`,
        async () => {
          await bulkRestore({ ids });
        }
      );
    } catch {
      setOptimisticDeletedIds((prev) => {
        const newSet = new Set(prev);
        ids.forEach((id) => newSet.delete(id));
        return newSet;
      });
      toast.error("Fout bij verwijderen offertes");
    }
  }, [selectedIds, bulkRemove, bulkRestore, clearSelection]);

  const handleExportCSV = useCallback((sortedOffertes: SortableOfferte[]) => {
    if (sortedOffertes.length === 0) return;
    const csvExportData = selectedIds.size > 0
      ? sortedOffertes.filter((o) => selectedIds.has(o._id))
      : sortedOffertes;

    const headers = ["Nummer", "Type", "Klant", "Adres", "Plaats", "Status", "Bedrag (incl. BTW)", "Datum"];
    const rows = csvExportData.map((o) => [
      o.offerteNummer,
      o.type,
      o.klantNaam,
      o.original.klant.adres,
      o.klantPlaats,
      o.status,
      o.bedrag.toFixed(2),
      new Date(o.datum).toLocaleDateString("nl-NL"),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `offertes-export-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast.success(`${csvExportData.length} offerte(s) geexporteerd`);
  }, [selectedIds]);

  return {
    offertes,
    stats,
    isOffertesLoading,
    // Selection
    selectedIds,
    showBulkDeleteDialog,
    setShowBulkDeleteDialog,
    bulkStatusValue,
    setBulkStatusValue,
    // Optimistic updates
    optimisticStatusUpdates,
    optimisticDeletedIds,
    // Actions
    handleDuplicate,
    handleDelete,
    handleNavigate,
    toggleSelectAll,
    toggleSelect,
    clearSelection,
    handleBulkStatusChange,
    handleBulkDelete,
    handleExportCSV,
  };
}
