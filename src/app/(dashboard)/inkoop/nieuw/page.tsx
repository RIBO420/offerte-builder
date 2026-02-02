"use client";

import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { RequireAdmin } from "@/components/require-admin";
import { InkooporderForm } from "@/components/inkoop/inkooporder-form";

export default function NieuweInkooporderPage() {
  return (
    <RequireAdmin>
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
              <BreadcrumbLink href="/inkoop">Inkoop</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Nieuwe inkooporder</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

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
    </RequireAdmin>
  );
}
