"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KlantGegevens } from "./types";

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  verplicht?: boolean;
  hulptekst?: string;
}

export function Field({ label, error, children, verplicht = true, hulptekst }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className={cn("text-sm font-medium", error && "text-destructive")}>
        {label}
        {verplicht && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
      {hulptekst && !error && (
        <p className="text-xs text-muted-foreground">{hulptekst}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Poort Waarschuwing — hoort bij de poortbreedte in de specificatiestap
// ---------------------------------------------------------------------------

export function PoortWaarschuwing({ breedte }: { breedte: string }) {
  const waarde = parseFloat(breedte);
  if (!breedte || isNaN(waarde) || waarde >= 80) return null;

  if (waarde < 60) {
    return (
      <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/30 rounded-lg text-sm">
        <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-destructive">Te smal voor onze machines</p>
          <p className="text-destructive mt-0.5">
            Helaas kunnen wij hier niet werken met onze machines bij een poortbreedte
            van minder dan 60 cm. Neem contact met ons op voor een maatwerkoplossing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-status-herinnering border border-status-herinnering-border rounded-lg text-sm">
      <AlertTriangle className="h-5 w-5 text-status-herinnering-dot flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-status-herinnering-text">Let op: handmatig werk vereist</p>
        <p className="text-status-herinnering-text mt-0.5">
          Bij een poortbreedte van minder dan 80 cm kunnen niet al onze machines
          worden ingezet. Er is een toeslag van 25% van toepassing voor extra
          handmatig werk.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slotstap: Uw gegevens (WS9 — NAW pas ná de prijsindicatie, keuzepunt 5)
// ---------------------------------------------------------------------------

interface StapKlantgegevensProps {
  data: KlantGegevens;
  errors: Record<string, string>;
  onChange: (field: keyof KlantGegevens, value: string) => void;
}

export function StapKlantgegevens({
  data,
  errors,
  onChange,
}: StapKlantgegevensProps) {
  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl font-display">Uw gegevens</CardTitle>
        <CardDescription>
          Bijna klaar — waar mogen we de indicatie naartoe sturen? Wij gebruiken
          uw gegevens alleen om de aanvraag te verwerken en contact met u op te
          nemen.
        </CardDescription>
      </CardHeader>

      {/* Naam */}
      <Field label="Volledige naam" error={errors.naam}>
        <Input
          required
          aria-required
          placeholder="Jan de Vries"
          value={data.naam}
          onChange={(e) => onChange("naam", e.target.value)}
          className={cn(errors.naam && "border-destructive focus-visible:ring-destructive")}
        />
      </Field>

      {/* Email + Telefoon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="E-mailadres" error={errors.email}>
          <Input
            required
            aria-required
            type="email"
            placeholder="jan@email.nl"
            value={data.email}
            onChange={(e) => onChange("email", e.target.value)}
            className={cn(errors.email && "border-destructive focus-visible:ring-destructive")}
          />
        </Field>
        <Field label="Telefoonnummer" error={errors.telefoon}>
          <Input
            required
            aria-required
            type="tel"
            placeholder="06-12345678"
            value={data.telefoon}
            onChange={(e) => onChange("telefoon", e.target.value)}
            className={cn(errors.telefoon && "border-destructive focus-visible:ring-destructive")}
          />
        </Field>
      </div>

      {/* Adres */}
      <Field label="Straat en huisnummer" error={errors.adres}>
        <Input
          required
          aria-required
          placeholder="Tuinstraat 12"
          value={data.adres}
          onChange={(e) => onChange("adres", e.target.value)}
          className={cn(errors.adres && "border-destructive focus-visible:ring-destructive")}
        />
      </Field>

      {/* Postcode + Plaats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Postcode" error={errors.postcode}>
          <Input
            required
            aria-required
            placeholder="1234 AB"
            value={data.postcode}
            onChange={(e) => onChange("postcode", e.target.value)}
            className={cn(errors.postcode && "border-destructive focus-visible:ring-destructive")}
          />
        </Field>
        <div className="col-span-1 sm:col-span-2">
          <Field label="Plaats" error={errors.plaats}>
            <Input
              required
              aria-required
              placeholder="Echt"
              value={data.plaats}
              onChange={(e) => onChange("plaats", e.target.value)}
              className={cn(errors.plaats && "border-destructive focus-visible:ring-destructive")}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
