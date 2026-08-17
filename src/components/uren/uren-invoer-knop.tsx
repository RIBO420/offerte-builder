"use client";

/**
 * "Uren invoeren" op de Controlekamer — voor kantoor dat handmatig uren voor
 * een medewerker wil schrijven (melding Ricardo 17 aug: "als admin moet ik
 * ook uren kunnen invoeren voor mensen").
 *
 * Bewust géén tweede invoerformulier: de popover kiest alleen wíe en wélke
 * dag, en stuurt dan door naar Mijn dag (`/veld?dag=…&medewerker=…`) — de ene
 * invoer-engine met voorstellen, overlapbewaking en het dag-indienen. Kantoor
 * mag daar al voor iedereen schrijven; dit maakt de ingang expliciet.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

function vandaagISO(): string {
  const nu = new Date();
  const maand = `${nu.getMonth() + 1}`.padStart(2, "0");
  const dag = `${nu.getDate()}`.padStart(2, "0");
  return `${nu.getFullYear()}-${maand}-${dag}`;
}

export function UrenInvoerKnop() {
  const router = useRouter();
  const medewerkers = useQuery(api.medewerkers.list, {});
  const [open, setOpen] = useState(false);
  const [medewerkerId, setMedewerkerId] = useState<string>("");
  const [datum, setDatum] = useState(vandaagISO());

  const lijst = useMemo(
    () =>
      (medewerkers ?? [])
        .slice()
        .sort((a, b) => a.naam.localeCompare(b.naam)),
    [medewerkers]
  );

  const ga = () => {
    if (!medewerkerId) return;
    setOpen(false);
    router.push(`/veld?dag=${datum}&medewerker=${medewerkerId}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Plus className="size-3.5" />
          Uren invoeren
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="text-sm font-medium">Voor wie en welke dag?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Je schrijft in Mijn dag, in de dag van de gekozen medewerker.
        </p>
        <Select value={medewerkerId} onValueChange={setMedewerkerId}>
          <SelectTrigger
            size="sm"
            aria-label="Medewerker"
            className="mt-2.5 w-full"
          >
            <span className="truncate">
              {lijst.find((m) => m._id === medewerkerId)?.naam ??
                "Kies een medewerker"}
            </span>
          </SelectTrigger>
          {/* position="popper": de item-aligned modus opent bij compacte
              triggers buiten beeld (zelfde valkuil als de taken-composer). */}
          <SelectContent position="popper">
            {lijst.map((medewerker) => (
              <SelectItem key={medewerker._id} value={medewerker._id}>
                {medewerker.naam}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          aria-label="Dag"
          className="mt-2 h-8"
        />
        <Button
          type="button"
          size="sm"
          className="mt-2.5 w-full"
          disabled={!medewerkerId}
          onClick={ga}
        >
          Naar de dag
        </Button>
      </PopoverContent>
    </Popover>
  );
}
