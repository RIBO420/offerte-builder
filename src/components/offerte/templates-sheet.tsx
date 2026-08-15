"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import {
  ArrowRight,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useShortcuts } from "@/components/providers/shortcuts-provider";
import { TemplateFormDialog } from "@/components/offerte/template-form-dialog";
import { useStandaardtuinen } from "@/hooks/use-standaardtuinen";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { getScopeDisplayName } from "@/lib/planning-templates";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface Template {
  _id: Id<"standaardtuinen">;
  naam: string;
  omschrijving?: string;
  type: "aanleg" | "onderhoud";
  scopes: string[];
  isSystem: boolean;
}

/**
 * Templates-ingang van de nieuwe-offerte-dropdown (masterplan A4).
 *
 * `standaardtuinen` + `createOfferteFromTemplate` lagen compleet klaar maar
 * werden nergens aangeroepen: sjablonen waren alleen te maken, niet terug te
 * vinden. Deze Sheet is dat ontbrekende gezicht — kiezen, beheren, aanmaken —
 * en sluit de kringloop met "Opslaan als template" op een bestaande offerte.
 *
 * Eén instantie, gemonteerd in de dashboard-layout; openen gaat via
 * `setShowTemplatesSheet` uit de shortcuts-context, die ook de klant meedraagt
 * als je vanuit een klantdossier begint.
 */
export function TemplatesSheet() {
  const router = useRouter();
  const { showTemplatesSheet, setShowTemplatesSheet, nieuweOfferteKlantId } =
    useShortcuts();

  const { templates, isLoading, delete: verwijderTemplate } = useStandaardtuinen();
  const createOfferteFromTemplate = useMutation(
    api.standaardtuinen.createOfferteFromTemplate
  );

  const [zoekterm, setZoekterm] = useState("");
  const [bezigMet, setBezigMet] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [teBewerken, setTeBewerken] = useState<Template | undefined>(undefined);
  const [teVerwijderen, setTeVerwijderen] = useState<Template | null>(null);

  const lijst = templates as Template[];
  const gefilterd = useMemo(() => {
    const term = zoekterm.trim().toLowerCase();
    if (!term) return lijst;
    return lijst.filter(
      (t) =>
        t.naam.toLowerCase().includes(term) ||
        (t.omschrijving ?? "").toLowerCase().includes(term)
    );
  }, [lijst, zoekterm]);

  const gebruik = async (template: Template) => {
    setBezigMet(template._id);
    try {
      const offerteId = await createOfferteFromTemplate({
        templateId: template._id,
        klantId: nieuweOfferteKlantId ?? undefined,
      });
      setShowTemplatesSheet(false);
      toast.success(`Offerte gestart vanuit "${template.naam}"`);
      router.push(`/offertes/${offerteId}`);
    } catch (fout) {
      toast.error("Offerte aanmaken mislukt", {
        description: getMutationErrorMessage(fout),
      });
    } finally {
      setBezigMet(null);
    }
  };

  const verwijder = async (template: Template) => {
    try {
      await verwijderTemplate(template._id);
      toast.success(`Template "${template.naam}" verwijderd`);
    } catch (fout) {
      toast.error("Verwijderen mislukt", {
        description: getMutationErrorMessage(fout),
      });
    } finally {
      setTeVerwijderen(null);
    }
  };

  return (
    <>
      <Sheet open={showTemplatesSheet} onOpenChange={setShowTemplatesSheet}>
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 sm:max-w-md"
          aria-describedby={undefined}
        >
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="font-display text-lg">Templates</SheetTitle>
            <SheetDescription>
              Vaste samenstellingen van werkzaamheden. Kies er een en de offerte
              staat klaar; klant en hoeveelheden vul je daarna in.
            </SheetDescription>
          </SheetHeader>

          <div className="flex items-center gap-2 border-b px-5 py-3">
            {lijst.length > 5 && (
              <Input
                value={zoekterm}
                onChange={(e) => setZoekterm(e.target.value)}
                placeholder="Zoek een template…"
                aria-label="Zoek een template"
                className="h-9"
              />
            )}
            <Button
              size="sm"
              variant="outline"
              className="ml-auto shrink-0"
              onClick={() => {
                setTeBewerken(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nieuwe template
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : lijst.length === 0 ? (
              <LegeStaat
                onNieuw={() => {
                  setTeBewerken(undefined);
                  setFormOpen(true);
                }}
              />
            ) : gefilterd.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Geen template gevonden voor &ldquo;{zoekterm}&rdquo;.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {gefilterd.map((template) => (
                  <li
                    key={template._id}
                    className="rounded-lg border bg-card p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm leading-tight font-medium">
                            {template.naam}
                          </span>
                          <Badge
                            variant="secondary"
                            className="px-1.5 py-0 text-[10px] font-normal"
                          >
                            {template.type === "aanleg" ? "Aanleg" : "Onderhoud"}
                          </Badge>
                          {template.isSystem && (
                            <Badge
                              variant="outline"
                              className="px-1.5 py-0 text-[10px] font-normal"
                            >
                              Systeem
                            </Badge>
                          )}
                        </div>
                        {template.omschrijving && (
                          <p className="mt-1 text-xs leading-snug text-muted-foreground">
                            {template.omschrijving}
                          </p>
                        )}
                        <ScopeTags scopes={template.scopes} />
                      </div>
                      {!template.isSystem && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0 text-muted-foreground"
                              aria-label={`Beheer ${template.naam}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                setTeBewerken(template);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Hernoemen en aanpassen
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setTeVerwijderen(template)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Verwijderen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <div className="mt-2.5 flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => void gebruik(template)}
                        disabled={bezigMet !== null}
                      >
                        {bezigMet === template._id ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="mr-2 h-3.5 w-3.5" />
                        )}
                        Gebruik deze
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TemplateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        template={teBewerken}
      />

      <AlertDialog
        open={teVerwijderen !== null}
        onOpenChange={(open) => !open && setTeVerwijderen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Template &ldquo;{teVerwijderen?.naam}&rdquo; verwijderen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Alleen het sjabloon verdwijnt. Offertes die je er eerder mee hebt
              gestart blijven ongewijzigd bestaan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => teVerwijderen && void verwijder(teVerwijderen)}
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Maximaal vier tags; de rest wordt geteld zodat de rij één regel blijft. */
function ScopeTags({ scopes }: { scopes: string[] }) {
  if (scopes.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Nog geen werkzaamheden — dit sjabloon begint blanco.
      </p>
    );
  }
  const zichtbaar = scopes.slice(0, 4);
  const rest = scopes.length - zichtbaar.length;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {zichtbaar.map((scope) => (
        <span
          key={scope}
          className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
        >
          {getScopeDisplayName(scope)}
        </span>
      ))}
      {rest > 0 && (
        <span className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground">
          +{rest}
        </span>
      )}
    </div>
  );
}

function LegeStaat({ onNieuw }: { onNieuw: () => void }) {
  return (
    <div className="rounded-lg border border-dashed px-5 py-8 text-center">
      <LayoutTemplate
        className="mx-auto size-6 text-muted-foreground"
        aria-hidden="true"
      />
      <p className="mt-3 text-sm font-medium">Nog geen templates</p>
      <p className="mx-auto mt-1 max-w-[34ch] text-xs leading-relaxed text-muted-foreground">
        Een template bewaart een vaste samenstelling werkzaamheden — bijvoorbeeld
        &ldquo;standaard stadstuin&rdquo; of &ldquo;onderhoud maandelijks&rdquo;.
        De snelste manier om er een te maken: open een offerte die goed in elkaar
        zit en kies daar <span className="font-medium">Opslaan als template</span>.
      </p>
      <Button size="sm" variant="outline" className="mt-4" onClick={onNieuw}>
        <Plus className="mr-2 h-4 w-4" />
        Template aanmaken
      </Button>
    </div>
  );
}
