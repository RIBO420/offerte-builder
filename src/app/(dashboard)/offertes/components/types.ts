import { Id } from "../../../../../convex/_generated/dataModel";
import type { OfferteStatus } from "@/lib/constants/statuses";

// Project info type for offerte rows
export type ProjectInfo = {
  _id: Id<"projecten">;
  naam: string;
  status: string;
} | null;

// Type for sortable offerte data
export type SortableOfferte = {
  _id: Id<"offertes">;
  type: "aanleg" | "onderhoud";
  offerteNummer: string;
  klantNaam: string;
  klantPlaats: string;
  bedrag: number;
  status: string;
  datum: number;
  // Original offerte reference
  original: {
    _id: Id<"offertes">;
    type: "aanleg" | "onderhoud";
    offerteNummer: string;
    klant: { naam: string; adres: string; plaats: string };
    totalen: { totaalInclBtw: number };
    status: string;
    updatedAt: number;
  };
};

// Memoized table row component to prevent unnecessary re-renders
export interface OfferteRowProps {
  offerte: {
    _id: Id<"offertes">;
    type: "aanleg" | "onderhoud";
    offerteNummer: string;
    klant: { naam: string; plaats: string };
    totalen: { totaalInclBtw: number };
    status: string;
    updatedAt: number;
  };
  projectInfo: ProjectInfo;
  isSelected: boolean;
  onToggleSelect: (id: Id<"offertes">) => void;
  onStatusChange: (id: string, newStatus: OfferteStatus) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (id: string) => void;
  reducedMotion: boolean;
  index: number;
}
