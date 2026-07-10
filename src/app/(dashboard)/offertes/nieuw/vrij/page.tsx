"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { PenLine, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useKlanten } from "@/hooks/use-klanten";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

/**
 * Route 2 — vrije offerte (PRD §2.5b): klant kiezen, dan door naar de
 * regel-editor. De offerte wordt direct als concept aangemaakt zodat de
 * editor op een bestaand offerte-record werkt (zelfde record en zelfde
 * PDF-template als de wizards — "twee routes, één uitgang").
 */
export default function NieuweVrijeOffertePage() {
  const router = useRouter();
  const { klanten, isLoading } = useKlanten();
  const getNextOfferteNummer = useMutation(api.instellingen.getNextOfferteNummer);
  const createOfferte = useMutation(api.offertes.create);

  const [klantId, setKlantId] = useState<string>("");
  const [type, setType] = useState<"aanleg" | "onderhoud">("aanleg");
  const [bezig, setBezig] = useState(false);

  const start = async () => {
    const klant = klanten.find((k) => k._id === klantId);
    if (!klant) {
      toast.error("Kies eerst een klant");
      return;
    }
    setBezig(true);
    try {
      const offerteNummer = await getNextOfferteNummer({});
      const id = await createOfferte({
        type,
        offerteNummer,
        bron: "vrij",
        klantId: klant._id as Id<"klanten">,
        klant: {
          naam: klant.naam,
          adres: klant.adres,
          postcode: klant.postcode,
          plaats: klant.plaats,
          email: klant.email ?? undefined,
          telefoon: klant.telefoon ?? undefined,
        },
        algemeenParams: { bereikbaarheid: "goed" },
      });
      router.push(`/offertes/${id}/vrij`);
    } catch (e) {
      toast.error("Offerte aanmaken mislukt", {
        description: e instanceof Error ? e.message : undefined,
      });
      setBezig(false);
    }
  };

  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Vrije offerte
          </h1>
          <p className="text-muted-foreground">
            Regel-editor: artikelen aanklikken of vrije regels typen, prijs en
            marge per regel. Voor alles wat niet in een pakket past.
          </p>
        </div>
        <div className="max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PenLine className="h-5 w-5" />
            Voor wie is de offerte?
          </CardTitle>
          <CardDescription>
            Kies de klant en het soort werk; daarna bouw je de offerte regel
            voor regel op.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="klant-select">
              Klant
            </label>
            <Select value={klantId} onValueChange={setKlantId}>
              <SelectTrigger id="klant-select" aria-label="Kies klant">
                <SelectValue
                  placeholder={isLoading ? "Klanten laden…" : "Kies een klant"}
                />
              </SelectTrigger>
              <SelectContent>
                {klanten.map((klant) => (
                  <SelectItem key={klant._id} value={klant._id}>
                    {klant.naam} — {klant.plaats}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="type-select">
              Soort werk
            </label>
            <Select
              value={type}
              onValueChange={(t) => setType(t as "aanleg" | "onderhoud")}
            >
              <SelectTrigger id="type-select" aria-label="Kies soort werk">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aanleg">
                  Aanleg / eenmalige klus / maatwerk
                </SelectItem>
                <SelectItem value="onderhoud">Onderhoud</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Bij onderhoud kan kantoor de regels bij acceptatie aan een
              concept-contract koppelen.
            </p>
          </div>
          <Button
            onClick={start}
            disabled={!klantId || bezig}
            className="w-full"
          >
            {bezig ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Naar de regel-editor
          </Button>
          {!klantId && !isLoading && (
            <p className="text-center text-xs text-muted-foreground">
              Kies eerst een klant om verder te gaan.
            </p>
          )}
        </CardContent>
      </Card>
        </div>
      </div>
    </>
  );
}
