"use client";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function DashboardNotFound() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 items-center justify-center p-4 md:p-6">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-10 px-8">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileQuestion className="h-8 w-8 text-muted-foreground" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight mb-2">
              Pagina niet gevonden
            </h1>

            <p className="text-muted-foreground mb-8">
              De pagina die je zoekt bestaat niet of is verplaatst.
              Controleer de URL of ga terug naar het overzicht.
            </p>

            <Button asChild>
              <Link href="/offertes">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Terug naar offertes
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
