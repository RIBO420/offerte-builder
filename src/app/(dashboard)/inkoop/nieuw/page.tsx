"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RequireRole } from "@/components/require-admin";
import { InkooporderForm } from "@/components/inkoop/inkooporder-form";

export default function NieuweInkooporderPage() {
  return (
    <RequireRole allowedRoles={["directie", "projectleider", "materiaalman"]}>
      <PageHeader />

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Terug naar inkoop">
            <Link href="/inkoop">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Nieuwe inkooporder
            </h1>
            <p className="text-muted-foreground">
              Maak een nieuwe inkooporder aan voor materialen
            </p>
          </div>
        </div>

        {/* Form */}
        <InkooporderForm mode="create" />
      </div>
    </RequireRole>
  );
}
