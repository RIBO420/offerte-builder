"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStandaardtuinen } from "@/hooks/use-standaardtuinen";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { getScopeDisplayName } from "@/lib/planning-templates";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * De werkzaamheden waaruit een sjabloon kan bestaan. TT-004: dit zijn scopes
 * bínnen de twee offertetypen, geen nieuwe typen. Bewust hier herhaald en niet
 * geïmporteerd uit de werkblad-routes: dit sjabloonformulier hoort bij de
 * entree en moet niet meeveranderen met het scope-palet.
 */
export const TEMPLATE_SCOPES: Record<"aanleg" | "onderhoud", string[]> = {
  aanleg: [
    "grondwerk",
    "bestrating",
    "parkeerplaats",
    "beregening",
    "borders",
    "gras",
    "houtwerk",
    "water_elektra",
    "specials",
  ],
  onderhoud: [
    "gras",
    "borders",
    "heggen",
    "bomen",
    "reiniging",
    "bemesting",
    "gazonanalyse",
    "mollenbestrijding",
    "overig",
  ],
};

export interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Meegeven = bewerken; weglaten = nieuw sjabloon. */
  template?: {
    _id: Id<"standaardtuinen">;
    naam: string;
    omschrijving?: string;
    type: "aanleg" | "onderhoud";
    scopes: string[];
  };
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  template,
}: TemplateFormDialogProps) {
  const { create, update } = useStandaardtuinen();
  const bewerken = Boolean(template);

  const [naam, setNaam] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [type, setType] = useState<"aanleg" | "onderhoud">("aanleg");
  const [scopes, setScopes] = useState<string[]>([]);
  const [bezig, setBezig] = useState(false);

  // Bij openen de velden zetten: bewerken start bij het sjabloon, nieuw leeg.
  useEffect(() => {
    if (!open) return;
    setNaam(template?.naam ?? "");
    setOmschrijving(template?.omschrijving ?? "");
    setType(template?.type ?? "aanleg");
    setScopes(template?.scopes ?? []);
  }, [open, template]);

  const toggleScope = (scope: string) =>
    setScopes((huidig) =>
      huidig.includes(scope)
        ? huidig.filter((s) => s !== scope)
        : [...huidig, scope]
    );

  const opslaan = async () => {
    const schoneNaam = naam.trim();
    if (!schoneNaam) return;
    setBezig(true);
    try {
      if (template) {
        await update(template._id, {
          naam: schoneNaam,
          omschrijving: omschrijving.trim(),
          scopes,
        });
        toast.success("Template bijgewerkt");
      } else {
        await create({
          naam: schoneNaam,
          omschrijving: omschrijving.trim() || undefined,
          type,
          scopes,
          defaultWaarden: {},
        });
        toast.success("Template aangemaakt");
      }
      onOpenChange(false);
    } catch (fout) {
      toast.error("Opslaan mislukt", {
        description: getMutationErrorMessage(fout),
      });
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !bezig && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            {bewerken ? "Template bewerken" : "Nieuwe template"}
          </DialogTitle>
          <DialogDescription>
            Een template bewaart het soort werk en de werkzaamheden, niet de
            klant of de prijzen. Je begint er een offerte mee die alleen nog
            ingevuld hoeft te worden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="template-naam">Naam</Label>
            <Input
              id="template-naam"
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              placeholder="Bijv. Strakke stadstuin"
              disabled={bezig}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-omschrijving">
              Omschrijving <span className="text-muted-foreground">(optioneel)</span>
            </Label>
            <Textarea
              id="template-omschrijving"
              value={omschrijving}
              onChange={(e) => setOmschrijving(e.target.value)}
              placeholder="Waarvoor gebruik je dit sjabloon?"
              rows={2}
              disabled={bezig}
            />
          </div>

          {!bewerken && (
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Soort werk</span>
              <div className="flex gap-2">
                {(["aanleg", "onderhoud"] as const).map((optie) => (
                  <Button
                    key={optie}
                    type="button"
                    variant={type === optie ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setType(optie);
                      setScopes([]);
                    }}
                    disabled={bezig}
                  >
                    {optie === "aanleg" ? "Aanleg" : "Onderhoud"}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Werkzaamheden</legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {TEMPLATE_SCOPES[type].map((scope) => {
                const id = `template-scope-${scope}`;
                const aan = scopes.includes(scope);
                return (
                  <label
                    key={scope}
                    htmlFor={id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 text-sm",
                      !aan && "text-muted-foreground"
                    )}
                  >
                    <Checkbox
                      id={id}
                      checked={aan}
                      onCheckedChange={() => toggleScope(scope)}
                      disabled={bezig}
                    />
                    {getScopeDisplayName(scope)}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={bezig}
          >
            Annuleren
          </Button>
          <Button onClick={() => void opslaan()} disabled={bezig || !naam.trim()}>
            {bezig ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {bewerken ? "Opslaan" : "Template aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
