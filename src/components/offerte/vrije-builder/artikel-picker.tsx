"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Search, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "../../../../convex/_generated/api";
import { formatCurrency } from "@/lib/format";
import type { PickerProduct } from "../../../../convex/vrijeOfferteBerekening";

interface ArtikelPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Aanklikken vult de regel direct (PRD §2.5b) */
  onSelect: (product: PickerProduct) => void;
}

/**
 * Artikel-picker (PRD §2.5b): zoekveld + lijst gesorteerd op gebruiksteller
 * ("116× gebruikt" bovenaan). Toont naam, prijs, korte omschrijving en teller.
 */
export function ArtikelPicker({ open, onOpenChange, onSelect }: ArtikelPickerProps) {
  const [zoekterm, setZoekterm] = useState("");
  const producten = useQuery(
    api.producten.picker,
    open ? { zoekterm: zoekterm || undefined } : "skip"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Artikel kiezen</DialogTitle>
          <DialogDescription>
            Aanklikken vult de regel met naam, eenheid, inkoopprijs en btw-code.
            Meest gebruikte artikelen staan bovenaan.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Zoek artikel…"
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
            className="pl-8"
            aria-label="Zoek artikel"
          />
        </div>
        <div className="max-h-80 overflow-y-auto divide-y rounded-md border">
          {producten === undefined ? (
            <p className="p-4 text-sm text-muted-foreground">Laden…</p>
          ) : producten.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Geen artikelen gevonden.
            </p>
          ) : (
            producten.map((product) => (
              <button
                key={product._id}
                type="button"
                onClick={() => {
                  onSelect(product as PickerProduct);
                  onOpenChange(false);
                  setZoekterm("");
                }}
                className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted/60 focus:bg-muted/60 focus:outline-none"
              >
                <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {product.productnaam}
                    </span>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {product.gebruiksteller}× gebruikt
                    </Badge>
                  </span>
                  {product.omschrijving && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {product.omschrijving}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  {product.prijsOpRegel || !product.inkoopprijs
                    ? "prijs op regel"
                    : formatCurrency(product.inkoopprijs)}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
