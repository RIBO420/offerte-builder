"use client";

import { useQuery } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "../../../../convex/_generated/api";

export interface VrijeTeksten {
  aanhef?: string;
  voorwaarden?: string;
}

interface TekstblokKiezerProps {
  waarde: VrijeTeksten;
  onChange: (teksten: VrijeTeksten) => void;
}

/**
 * Tekstblokken kiezen uit de bibliotheek (PRD §2.5b): aanhef en voorwaarden.
 * Alleen kiezen/invoegen als platte tekst — er is bewust géén editor met
 * opmaak (principe 3: de huisstijl ligt vast in de template).
 */
export function TekstblokKiezer({ waarde, onChange }: TekstblokKiezerProps) {
  const aanhefBlokken = useQuery(api.tekstblokken.actief, {
    categorie: "aanhef",
  });
  const voorwaardenBlokken = useQuery(api.tekstblokken.actief, {
    categorie: "voorwaarden",
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tekstblokken</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Kiezer
          label="Aanhef"
          blokken={aanhefBlokken}
          gekozenTekst={waarde.aanhef}
          onKies={(inhoud) => onChange({ ...waarde, aanhef: inhoud })}
        />
        <Kiezer
          label="Voorwaarden"
          blokken={voorwaardenBlokken}
          gekozenTekst={waarde.voorwaarden}
          onKies={(inhoud) => onChange({ ...waarde, voorwaarden: inhoud })}
        />
      </CardContent>
    </Card>
  );
}

function Kiezer({
  label,
  blokken,
  gekozenTekst,
  onKies,
}: {
  label: string;
  blokken: Array<{ _id: string; naam: string; inhoud: string }> | undefined;
  gekozenTekst?: string;
  onKies: (inhoud: string | undefined) => void;
}) {
  const GEEN = "__geen__";
  const gekozenBlok = blokken?.find((b) => b.inhoud === gekozenTekst);

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <Select
        value={gekozenBlok?._id ?? (gekozenTekst ? "__aangepast__" : GEEN)}
        onValueChange={(id) => {
          if (id === GEEN) {
            onKies(undefined);
            return;
          }
          const blok = blokken?.find((b) => b._id === id);
          if (blok) onKies(blok.inhoud);
        }}
      >
        <SelectTrigger aria-label={`Kies ${label.toLowerCase()}-tekstblok`}>
          <SelectValue placeholder={`Kies een ${label.toLowerCase()}…`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={GEEN}>Geen</SelectItem>
          {gekozenTekst && !gekozenBlok && (
            <SelectItem value="__aangepast__" disabled>
              (eerder gekozen tekst)
            </SelectItem>
          )}
          {(blokken ?? []).map((blok) => (
            <SelectItem key={blok._id} value={blok._id}>
              {blok.naam}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {gekozenTekst && (
        <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
          {gekozenTekst}
        </p>
      )}
    </div>
  );
}
