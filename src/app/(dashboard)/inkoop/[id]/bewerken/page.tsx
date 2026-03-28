"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Package } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RequireRole } from "@/components/require-admin";
import { InkooporderForm } from "@/components/inkoop/inkooporder-form";

export default function BewerkInkooporderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const inkooporderId = id as Id<"inkooporders">;

  // Query existing inkooporder
  const inkooporderData = useQuery(
    api.inkooporders.getById,
    inkooporderId ? { id: inkooporderId } : "skip"
  );

  // Loading state
  if (inkooporderData === undefined) {
    return (
      <RequireRole allowedRoles={["directie", "projectleider", "materiaalman"]}>
        <PageHeader customLabels={{ [`/inkoop/${id}/bewerken`]: "Laden..." }} />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </RequireRole>
    );
  }

  // Not found state
  if (!inkooporderData) {
    return (
      <RequireRole allowedRoles={["directie", "projectleider", "materiaalman"]}>
        <PageHeader customLabels={{ [`/inkoop/${id}/bewerken`]: "Niet gevonden" }} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Package className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">Inkooporder niet gevonden</h2>
          <Button variant="outline" onClick={() => router.push("/inkoop")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar inkoop
          </Button>
        </div>
      </RequireRole>
    );
  }

  // Check if order can be edited (only in concept status)
  if (inkooporderData.status !== "concept") {
    return (
      <RequireRole allowedRoles={["directie", "projectleider", "materiaalman"]}>
        <PageHeader customLabels={{ [`/inkoop/${id}/bewerken`]: "Kan niet bewerken" }} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Package className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">Inkooporder kan niet bewerkt worden</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Deze inkooporder heeft status &quot;{inkooporderData.status}&quot; en kan niet meer worden bewerkt.
            Alleen inkooporders met status &quot;concept&quot; kunnen worden aangepast.
          </p>
          <Button variant="outline" onClick={() => router.push(`/inkoop/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar inkooporder
          </Button>
        </div>
      </RequireRole>
    );
  }

  // Transform data for form
  const defaultValues = {
    leverancierId: inkooporderData.leverancierId.toString(),
    projectId: inkooporderData.projectId?.toString() || "",
    verwachteLevertijd: inkooporderData.verwachteLevertijd
      ? new Date(inkooporderData.verwachteLevertijd)
      : undefined,
    notities: inkooporderData.notities || "",
    regels: inkooporderData.regels.map((regel) => ({
      id: regel.id,
      productId: regel.productId?.toString(),
      omschrijving: regel.omschrijving,
      hoeveelheid: regel.hoeveelheid,
      eenheid: regel.eenheid,
      prijsPerEenheid: regel.prijsPerEenheid,
      totaal: regel.totaal,
    })),
  };

  return (
    <RequireRole allowedRoles={["directie", "projectleider", "materiaalman"]}>
      <PageHeader customLabels={{ [`/inkoop/${id}`]: inkooporderData.orderNummer }} />

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Terug naar inkooporder">
            <Link href={`/inkoop/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              {inkooporderData.orderNummer} bewerken
            </h1>
            <p className="text-muted-foreground">
              Pas de inkooporder aan
            </p>
          </div>
        </div>

        {/* Form */}
        <InkooporderForm
          mode="edit"
          inkooporderId={inkooporderId}
          defaultValues={defaultValues}
        />
      </div>
    </RequireRole>
  );
}
