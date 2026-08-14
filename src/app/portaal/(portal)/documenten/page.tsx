"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Download, FileText, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortaalDocumentenPage() {
  const documenten = useQuery(api.portaal.getDocumenten);

  if (!documenten) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const hasOffertes = documenten.offertes.length > 0;
  const hasFacturen = documenten.facturen.length > 0;
  const hasDocuments = hasOffertes || hasFacturen;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">
          Documenten
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Download uw offertes en facturen als PDF.
        </p>
      </div>

      {!hasDocuments ? (
        <Card className="p-8 bg-card border-border text-center">
          <Download className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Er zijn nog geen documenten beschikbaar.
          </p>
        </Card>
      ) : (
        <>
          {/* Offertes section */}
          {hasOffertes && (
            <Card className="bg-card border-border">
              <div className="p-5 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h2 className="text-[15px] font-semibold text-foreground">
                    Offertes
                  </h2>
                </div>
              </div>
              <Separator className="bg-border" />
              <div className="p-5 pt-3">
                {documenten.offertes.map((offerte, i) => (
                  <div
                    key={offerte._id}
                    className={`flex items-center justify-between py-3 ${
                      i < documenten.offertes.length - 1
                        ? "border-b border-border"
                        : ""
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {offerte.offerteNummer}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {offerte.type === "aanleg" ? "Aanleg" : "Onderhoud"} &middot;{" "}
                        {new Date(offerte.createdAt).toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="text-foreground dark:text-primary hover:bg-accent"
                    >
                      <a
                        href={`/portaal/offertes/${offerte._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-4 w-4 mr-1.5" />
                        Bekijk PDF
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Facturen section */}
          {hasFacturen && (
            <Card className="bg-card border-border">
              <div className="p-5 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-accent-warm" />
                  <h2 className="text-[15px] font-semibold text-foreground">
                    Facturen
                  </h2>
                </div>
              </div>
              <Separator className="bg-border" />
              <div className="p-5 pt-3">
                {documenten.facturen.map((factuur, i) => (
                  <div
                    key={factuur._id}
                    className={`flex items-center justify-between py-3 ${
                      i < documenten.facturen.length - 1
                        ? "border-b border-border"
                        : ""
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {factuur.factuurnummer}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {new Date(factuur.createdAt).toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="text-foreground dark:text-primary hover:bg-accent"
                    >
                      <a
                        href={`/portaal/facturen/${factuur._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-4 w-4 mr-1.5" />
                        Bekijk PDF
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
