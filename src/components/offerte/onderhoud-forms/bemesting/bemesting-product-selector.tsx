"use client";

import type { UseFormReturn } from "react-hook-form";
import type { BemestingFormData } from "./schema";
import { Badge } from "@/components/ui/badge";
import { FormLabel, FormMessage } from "@/components/ui/form";

// ─── Props ────────────────────────────────────────────────────────────────────

interface BemestingProductSelectorProps {
  form: UseFormReturn<BemestingFormData>;
  product: string;
  productError?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BemestingProductSelector({ form, product, productError }: BemestingProductSelectorProps) {
  const isPremium = product === "premium";

  return (
    <div className="space-y-2">
      <FormLabel className="text-sm font-medium">Product</FormLabel>

      <div className="grid gap-2 sm:grid-cols-3">
        {/* Basis */}
        <button
          type="button"
          onClick={() => form.setValue("product", "basis", { shouldValidate: true })}
          className={`relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
            product === "basis"
              ? "border-green-400 bg-green-50 ring-1 ring-green-400"
              : "border-border hover:border-muted-foreground/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Basis</span>
            <Badge className="bg-green-100 text-green-800 border-green-200 border text-xs px-1.5 py-0">
              Standaard
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">Standaard bemesting</p>
        </button>

        {/* Premium — AANBEVOLEN */}
        <button
          type="button"
          onClick={() => form.setValue("product", "premium", { shouldValidate: true })}
          className={`relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
            product === "premium"
              ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
              : "border-border hover:border-muted-foreground/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Premium</span>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 border text-xs px-1.5 py-0">
              Aanbevolen
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">Langwerkend, 150 dagen</p>
        </button>

        {/* Bio */}
        <button
          type="button"
          onClick={() => form.setValue("product", "bio", { shouldValidate: true })}
          className={`relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
            product === "bio"
              ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
              : "border-border hover:border-muted-foreground/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Bio</span>
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 border text-xs px-1.5 py-0">
              Eco
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">Biologische bemesting</p>
        </button>
      </div>

      {/* Premium upsell card */}
      {isPremium && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-600 text-white text-xs">Meest gekozen</Badge>
            <span className="text-xs font-semibold text-blue-900">Premium bemesting</span>
          </div>
          <p className="text-xs text-blue-800">
            Premium bemesting werkt 150 dagen — de hele zomer geen omkijken naar!
          </p>
          <p className="text-xs text-blue-700 font-medium">
            Slechts een kleine meerprijs per m² voor maximaal resultaat.
          </p>
        </div>
      )}

      <FormMessage>{productError}</FormMessage>
    </div>
  );
}
