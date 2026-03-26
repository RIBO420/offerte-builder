"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link2, FileText, Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { FleetGoSettings } from "@/components/wagenpark/fleetgo-settings";

interface KoppelingenTabProps {
  reducedMotion: boolean;
}

export function KoppelingenTab({ reducedMotion }: KoppelingenTabProps) {
  return (
    <motion.div
      key="koppelingen"
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
    >
      <TabsContent value="koppelingen" className="space-y-4" forceMount>
        <div className="space-y-6">
          {/* FleetGo Integration */}
          <FleetGoSettings
            isConfigured={false}
            onSave={async (apiKey) => {
              // TODO: Save API key to backend
              toast.success("FleetGo instellingen opgeslagen");
            }}
            onTestConnection={async (apiKey) => {
              // TODO: Test actual connection
              return apiKey.length > 10;
            }}
          />

          {/* Algemene Voorwaarden PDF (EML-003) */}
          <VoorwaardenCard />

          {/* Placeholder for future integrations */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Link2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Meer koppelingen</CardTitle>
                  <CardDescription>
                    Binnenkort beschikbaar: boekhoudpakketten, planning tools, en meer
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We werken aan integraties met populaire tools zoals Exact Online,
                Moneybird, en andere boekhoud- en planningssoftware.
                Neem contact op als je een specifieke integratie nodig hebt.
              </p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </motion.div>
  );
}

// ── Voorwaarden Upload Card ───────────────────────────────────────────

function VoorwaardenCard() {
  const voorwaarden = useQuery(api.instellingen.getVoorwaardenPdfUrl);
  const generateUrl = useMutation(api.instellingen.generateVoorwaardenUploadUrl);
  const updatePdf = useMutation(api.instellingen.updateVoorwaardenPdf);
  const removePdf = useMutation(api.instellingen.removeVoorwaardenPdf);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Alleen PDF bestanden zijn toegestaan");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Bestand mag maximaal 10 MB zijn");
      return;
    }

    setIsUploading(true);
    try {
      const uploadUrl = await generateUrl();
      await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      }).then(async (res) => {
        const { storageId } = await res.json();
        await updatePdf({ storageId, bestandsnaam: file.name });
      });
      toast.success("Voorwaarden PDF geüpload");
    } catch {
      toast.error("Upload mislukt");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    try {
      await removePdf();
      toast.success("Voorwaarden PDF verwijderd");
    } catch {
      toast.error("Verwijderen mislukt");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Algemene Voorwaarden</CardTitle>
            <CardDescription>
              Upload een PDF die automatisch wordt bijgevoegd bij offerte- en contracte-mails
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleUpload}
        />

        {voorwaarden?.url ? (
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-sm truncate">{voorwaarden.naam}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5">Vervangen</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={handleRemove}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            PDF uploaden
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
