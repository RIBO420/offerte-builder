"use client";

/**
 * Platte-tekstveld voor documentteksten met een veldkiezer en een voorbeeld
 * (HERO-nabouw fase 2). Velden als {{klant.naam}} vult de app zelf in; het
 * voorbeeld laat zien hoe de tekst op het document komt. Gebruikt in de
 * tekstbibliotheek en bij het bewerken van de tekst op één document.
 */

import { useMemo, useRef, useState } from "react";
import { Braces } from "lucide-react";
import {
  PLACEHOLDERS,
  onbekendePlaceholders,
  placeholdersVoorSoort,
  voorbeeldWaarden,
  vulTekst,
  type DocumentSoort,
  type PlaceholderGroep,
  type TekstWaarden,
} from "@convex/lib/documentTekst";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DocumentTekstEditorProps {
  id: string;
  label: string;
  value: string;
  onChange: (waarde: string) => void;
  /** Soort bepaalt welke velden beschikbaar zijn; leeg = alle */
  documentSoort?: DocumentSoort;
  /** Echte waarden van het document; zonder = voorbeeldwaarden */
  waarden?: TekstWaarden;
  rows?: number;
  placeholder?: string;
}

const GROEP_VOLGORDE: PlaceholderGroep[] = [
  "Klant",
  "Document",
  "Offerte",
  "Factuur",
  "Bedrijf",
  "Medewerker",
];

export function DocumentTekstEditor({
  id,
  label,
  value,
  onChange,
  documentSoort,
  waarden,
  rows = 8,
  placeholder,
}: DocumentTekstEditorProps) {
  const veld = useRef<HTMLTextAreaElement>(null);
  const [kiezerOpen, setKiezerOpen] = useState(false);

  const beschikbaar = useMemo(
    () => placeholdersVoorSoort(documentSoort),
    [documentSoort]
  );
  const onbekend = useMemo(
    () => onbekendePlaceholders(value, documentSoort),
    [value, documentSoort]
  );
  const voorbeeld = useMemo(
    () => vulTekst(value, waarden ?? voorbeeldWaarden()),
    [value, waarden]
  );

  const voegIn = (sleutel: string) => {
    const tekst = `{{${sleutel}}}`;
    const el = veld.current;
    const start = el?.selectionStart ?? value.length;
    const eind = el?.selectionEnd ?? value.length;
    const nieuw = value.slice(0, start) + tekst + value.slice(eind);
    onChange(nieuw);
    setKiezerOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + tekst.length, start + tekst.length);
    });
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Popover open={kiezerOpen} onOpenChange={setKiezerOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Braces className="size-4" />
              Veld invoegen
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-80 w-72 overflow-y-auto p-2">
            {GROEP_VOLGORDE.map((groep) => {
              const items = beschikbaar.filter((p) => p.groep === groep);
              if (items.length === 0) return null;
              return (
                <div key={groep} className="mb-2 last:mb-0">
                  <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                    {groep}
                  </p>
                  {items.map((p) => (
                    <button
                      key={p.sleutel}
                      type="button"
                      onClick={() => voegIn(p.sleutel)}
                      className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <span>{p.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.voorbeeld.split("\n")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>
      <Textarea
        id={id}
        ref={veld}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={onbekend.length > 0}
        className="max-h-[50vh] overflow-y-auto font-mono text-sm"
      />
      {onbekend.length > 0 && (
        <p className="text-sm text-destructive">
          Onbekend veld: {onbekend.map((o) => `{{${o}}}`).join(", ")}.{" "}
          {onbekend.some((o) => PLACEHOLDERS.some((p) => p.sleutel === o))
            ? "Dit veld bestaat niet op deze documentsoort."
            : "Kies het veld via “Veld invoegen”."}
        </p>
      )}
      {value.trim().length > 0 && (
        <div className="grid gap-1">
          <p className="text-xs font-medium text-muted-foreground">
            {waarden ? "Zo komt het op het document" : "Voorbeeld met testgegevens"}
          </p>
          <p className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
            {voorbeeld.tekst}
          </p>
          {waarden && voorbeeld.ontbrekend.length > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Nog niet ingevuld: {voorbeeld.ontbrekend.join(", ")}. Zonder deze
              gegevens kan het document niet verstuurd worden.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
