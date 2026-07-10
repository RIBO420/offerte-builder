"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Camera,
  Inbox,
  Loader2,
  MessageSquare,
  Send,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PortaalContextThread } from "@/components/portaal/portaal-context-thread";

type MeldingFormType = "serviceverzoek" | "klacht";

function getMeldingStatusConfig(status: string) {
  switch (status) {
    case "opgelost":
      return {
        label: "Opgelost",
        className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
      };
    case "in_behandeling":
      return {
        label: "In behandeling",
        className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
      };
    case "wacht_op_derden":
      return {
        label: "Wacht op derden",
        className: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800",
      };
    case "nieuw":
    default:
      return {
        label: "Ontvangen",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
      };
  }
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

const MAX_FOTOS = 10;

function MeldingForm() {
  const [type, setType] = useState<MeldingFormType>("serviceverzoek");
  const [beschrijving, setBeschrijving] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.portaal.generatePortaalUploadUrl);
  const dienMeldingIn = useMutation(api.portaal.dienMeldingIn);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const nieuwe = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...nieuwe].slice(0, MAX_FOTOS));
  };

  const handleSubmit = async () => {
    if (!beschrijving.trim()) {
      toast.error("Vul een omschrijving in");
      return;
    }
    setSubmitting(true);
    try {
      // Foto's uploaden via het bestaande Convex-storage-pad
      const storageIds: string[] = [];
      for (const file of files) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error("Upload mislukt");
        const { storageId } = (await res.json()) as { storageId: string };
        storageIds.push(storageId);
      }

      await dienMeldingIn({
        type,
        beschrijving: beschrijving.trim(),
        fotos: storageIds.length > 0 ? storageIds : undefined,
      });

      setBeschrijving("");
      setFiles([]);
      toast.success(
        "Uw melding is verstuurd. U ontvangt een bevestiging per e-mail."
      );
    } catch {
      toast.error("Melding versturen is niet gelukt. Probeer het opnieuw.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a]">
      <CardHeader>
        <CardTitle className="text-lg text-gray-900 dark:text-white">
          Nieuwe melding
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300">
            Waar gaat het om?
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("serviceverzoek")}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                type === "serviceverzoek"
                  ? "border-[#4ADE80] bg-[#4ADE80]/10"
                  : "border-gray-200 dark:border-[#2a3e2a] hover:border-gray-300"
              )}
            >
              <Wrench className="h-5 w-5 text-[#4ADE80] shrink-0 mt-0.5" />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  Serviceverzoek
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Een verzoek om werk of service in uw tuin
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setType("klacht")}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                type === "klacht"
                  ? "border-[#4ADE80] bg-[#4ADE80]/10"
                  : "border-gray-200 dark:border-[#2a3e2a] hover:border-gray-300"
              )}
            >
              <AlertCircle className="h-5 w-5 text-[#4ADE80] shrink-0 mt-0.5" />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  Klacht
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Iets is niet naar wens — vertel het ons
                </span>
              </span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="melding-omschrijving" className="text-gray-700 dark:text-gray-300">
            Omschrijving
          </Label>
          <Textarea
            id="melding-omschrijving"
            value={beschrijving}
            onChange={(e) => setBeschrijving(e.target.value)}
            placeholder="Beschrijf zo duidelijk mogelijk wat er aan de hand is..."
            rows={4}
            maxLength={2000}
            className="border-gray-200 dark:border-[#2a3e2a]"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300">
            Foto&apos;s (optioneel)
          </Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-gray-200 dark:border-[#2a3e2a]"
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= MAX_FOTOS}
            >
              <Camera className="h-4 w-4 mr-1.5" />
              Foto toevoegen
            </Button>
            {files.map((file, i) => (
              <span
                key={`${file.name}-${i}`}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs text-gray-700 dark:text-gray-300"
              >
                {file.name}
                <button
                  type="button"
                  aria-label={`Verwijder ${file.name}`}
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting || !beschrijving.trim()}
          className="bg-[#4ADE80] hover:bg-[#3BC96F] text-black"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-1.5" />
          )}
          Melding versturen
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PortaalMeldingenPage() {
  const meldingen = useQuery(api.portaal.getMeldingen);
  const [openThreadFor, setOpenThreadFor] =
    useState<Id<"servicemeldingen"> | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[#4ADE80]/10 p-2">
          <AlertCircle className="h-6 w-6 text-[#4ADE80]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Meldingen
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Dien een serviceverzoek of klacht in en volg de status
          </p>
        </div>
      </div>

      <MeldingForm />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Uw meldingen
        </h2>
        {meldingen === undefined ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : meldingen.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-3">
              <Inbox className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              U heeft nog geen meldingen ingediend.
            </p>
          </div>
        ) : (
          meldingen.map((melding) => {
            const statusConfig = getMeldingStatusConfig(melding.status);
            const isOpen = openThreadFor === melding._id;
            return (
              <Card
                key={melding._id}
                className="border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a]"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {melding.type === "klacht"
                          ? "Klacht"
                          : melding.type === "serviceverzoek"
                            ? "Serviceverzoek"
                            : "Melding"}
                        {" · "}
                        {formatDate(melding.createdAt)}
                        {melding.fotos.length > 0 && (
                          <> · {melding.fotos.length} foto&apos;s</>
                        )}
                      </p>
                      <p className="text-sm text-gray-900 dark:text-white mt-1 whitespace-pre-wrap">
                        {melding.beschrijving}
                      </p>
                    </div>
                    <Badge className={cn("shrink-0 border", statusConfig.className)}>
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-200 dark:border-[#2a3e2a]"
                      onClick={() =>
                        setOpenThreadFor(isOpen ? null : melding._id)
                      }
                    >
                      <MessageSquare className="h-4 w-4 mr-1.5" />
                      {isOpen ? "Gesprek verbergen" : "Gesprek"}
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="mt-4">
                      <PortaalContextThread meldingId={melding._id} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
