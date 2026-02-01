"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  CalendarIcon,
  Plus,
  Trash2,
  Award,
  AlertTriangle,
  ExternalLink,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Certificaat {
  id: string;
  naam: string;
  uitgifteDatum: string; // ISO date string
  vervalDatum?: string; // ISO date string
  documentUrl?: string;
}

interface CertificaatFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Certificaat | null;
  onSave: (certificaat: Certificaat) => void;
}

export function CertificaatFormDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
}: CertificaatFormDialogProps) {
  const [naam, setNaam] = useState("");
  const [uitgifteDatum, setUitgifteDatum] = useState<Date | undefined>();
  const [vervalDatum, setVervalDatum] = useState<Date | undefined>();
  const [documentUrl, setDocumentUrl] = useState("");

  const isEditMode = !!initialData;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (initialData) {
        setNaam(initialData.naam);
        setUitgifteDatum(new Date(initialData.uitgifteDatum));
        setVervalDatum(
          initialData.vervalDatum ? new Date(initialData.vervalDatum) : undefined
        );
        setDocumentUrl(initialData.documentUrl || "");
      } else {
        setNaam("");
        setUitgifteDatum(undefined);
        setVervalDatum(undefined);
        setDocumentUrl("");
      }
    }
  }, [open, initialData]);

  const handleSave = useCallback(() => {
    if (!naam.trim() || !uitgifteDatum) return;

    const certificaat: Certificaat = {
      id: initialData?.id || crypto.randomUUID(),
      naam: naam.trim(),
      uitgifteDatum: uitgifteDatum.toISOString().split("T")[0],
      vervalDatum: vervalDatum
        ? vervalDatum.toISOString().split("T")[0]
        : undefined,
      documentUrl: documentUrl.trim() || undefined,
    };

    onSave(certificaat);
    onOpenChange(false);
  }, [naam, uitgifteDatum, vervalDatum, documentUrl, initialData, onSave, onOpenChange]);

  const isFormValid = naam.trim() && uitgifteDatum;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Certificaat Bewerken" : "Nieuw Certificaat"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Pas de gegevens van het certificaat aan"
              : "Voeg een certificaat of diploma toe"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Naam */}
          <div className="grid gap-2">
            <Label htmlFor="cert-naam">Naam certificaat *</Label>
            <Input
              id="cert-naam"
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              placeholder="Bijv. VCA Basis, Groenkeur, BHV"
            />
          </div>

          {/* Uitgiftedatum */}
          <div className="grid gap-2">
            <Label>Uitgiftedatum *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !uitgifteDatum && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {uitgifteDatum
                    ? format(uitgifteDatum, "d MMMM yyyy", { locale: nl })
                    : "Selecteer datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={uitgifteDatum}
                  onSelect={setUitgifteDatum}
                  disabled={(date) => date > new Date()}
                  defaultMonth={uitgifteDatum}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Vervaldatum */}
          <div className="grid gap-2">
            <Label>Vervaldatum (optioneel)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !vervalDatum && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {vervalDatum
                    ? format(vervalDatum, "d MMMM yyyy", { locale: nl })
                    : "Selecteer datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={vervalDatum}
                  onSelect={setVervalDatum}
                  disabled={(date) =>
                    uitgifteDatum ? date < uitgifteDatum : false
                  }
                  defaultMonth={vervalDatum || uitgifteDatum}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Laat leeg als het certificaat geen vervaldatum heeft
            </p>
          </div>

          {/* Document URL */}
          <div className="grid gap-2">
            <Label htmlFor="cert-url">Document URL (optioneel)</Label>
            <Input
              id="cert-url"
              type="url"
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground">
              Link naar het gescande certificaat of document
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={!isFormValid}>
            {isEditMode ? "Bijwerken" : "Toevoegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to get certification expiry status
export function getCertificaatStatus(vervalDatum?: string): {
  status: "valid" | "expiring" | "expired";
  label: string;
  className: string;
} {
  if (!vervalDatum) {
    return {
      status: "valid",
      label: "Geldig",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    };
  }

  const now = new Date();
  const expiryDate = new Date(vervalDatum);
  const daysUntilExpiry = Math.ceil(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry < 0) {
    return {
      status: "expired",
      label: "Verlopen",
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    };
  }

  if (daysUntilExpiry <= 30) {
    return {
      status: "expiring",
      label: `Verloopt over ${daysUntilExpiry} dagen`,
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
    };
  }

  if (daysUntilExpiry <= 90) {
    return {
      status: "expiring",
      label: `Verloopt over ${Math.floor(daysUntilExpiry / 30)} maanden`,
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
    };
  }

  return {
    status: "valid",
    label: "Geldig",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  };
}

// Component for managing a list of certificates
interface CertificatenListProps {
  certificaten: Certificaat[];
  onChange: (certificaten: Certificaat[]) => void;
  disabled?: boolean;
}

export function CertificatenList({
  certificaten,
  onChange,
  disabled = false,
}: CertificatenListProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCertificaat, setEditingCertificaat] = useState<Certificaat | null>(
    null
  );

  const handleAdd = useCallback(
    (certificaat: Certificaat) => {
      onChange([...certificaten, certificaat]);
    },
    [certificaten, onChange]
  );

  const handleEdit = useCallback(
    (certificaat: Certificaat) => {
      onChange(
        certificaten.map((c) => (c.id === certificaat.id ? certificaat : c))
      );
      setEditingCertificaat(null);
    },
    [certificaten, onChange]
  );

  const handleRemove = useCallback(
    (id: string) => {
      onChange(certificaten.filter((c) => c.id !== id));
    },
    [certificaten, onChange]
  );

  return (
    <div className="space-y-4">
      {/* Certificate list */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {certificaten.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center border border-dashed rounded-lg"
            >
              <Award className="h-4 w-4" />
              Nog geen certificaten toegevoegd
            </motion.div>
          ) : (
            certificaten.map((cert) => {
              const status = getCertificaatStatus(cert.vervalDatum);
              return (
                <motion.div
                  key={cert.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center justify-between gap-2 p-3 bg-muted/30 rounded-lg border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Award className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {cert.naam}
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn("text-xs shrink-0", status.className)}
                        >
                          {status.status === "expired" && (
                            <AlertTriangle className="h-3 w-3 mr-1" />
                          )}
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          Uitgegeven:{" "}
                          {format(new Date(cert.uitgifteDatum), "d MMM yyyy", {
                            locale: nl,
                          })}
                        </span>
                        {cert.vervalDatum && (
                          <>
                            <span>-</span>
                            <span>
                              Vervalt:{" "}
                              {format(new Date(cert.vervalDatum), "d MMM yyyy", {
                                locale: nl,
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {cert.documentUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        asChild
                      >
                        <a
                          href={cert.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setEditingCertificaat(cert)}
                      disabled={disabled}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleRemove(cert.id)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Add button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowAddDialog(true)}
        disabled={disabled}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Certificaat Toevoegen
      </Button>

      {/* Add dialog */}
      <CertificaatFormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSave={handleAdd}
      />

      {/* Edit dialog */}
      <CertificaatFormDialog
        open={!!editingCertificaat}
        onOpenChange={(open) => !open && setEditingCertificaat(null)}
        initialData={editingCertificaat}
        onSave={handleEdit}
      />
    </div>
  );
}

// Compact display for showing certificates with expiry warnings
export function CertificaatBadges({ certificaten }: { certificaten: Certificaat[] }) {
  if (certificaten.length === 0) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  // Check for expiring/expired certificates
  const expiredCount = certificaten.filter(
    (c) => getCertificaatStatus(c.vervalDatum).status === "expired"
  ).length;
  const expiringCount = certificaten.filter(
    (c) => getCertificaatStatus(c.vervalDatum).status === "expiring"
  ).length;

  return (
    <div className="flex flex-wrap gap-1 items-center">
      <Badge variant="outline" className="text-xs">
        <Award className="h-3 w-3 mr-1" />
        {certificaten.length}
      </Badge>
      {expiredCount > 0 && (
        <Badge
          variant="secondary"
          className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          {expiredCount} verlopen
        </Badge>
      )}
      {expiringCount > 0 && (
        <Badge
          variant="secondary"
          className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          {expiringCount} bijna verlopen
        </Badge>
      )}
    </div>
  );
}
