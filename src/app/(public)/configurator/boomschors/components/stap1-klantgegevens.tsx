import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import type { KlantGegevens, FormErrors } from "./types";

// ---------------------------------------------------------------------------
// Stap 1: Klantgegevens
// ---------------------------------------------------------------------------

interface Stap1Props {
  gegevens: KlantGegevens;
  onChange: (gegevens: KlantGegevens) => void;
  errors: FormErrors;
}

export function Stap1Klantgegevens({ gegevens, onChange, errors }: Stap1Props) {
  function handleChange(field: keyof KlantGegevens, value: string) {
    onChange({ ...gegevens, [field]: value });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Uw gegevens</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Vul uw contactgegevens en afleveradres in.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="naam">
            Naam <span className="text-destructive">*</span>
          </Label>
          <Input
            id="naam"
            placeholder="Voor- en achternaam"
            value={gegevens.naam}
            onChange={(e) => handleChange("naam", e.target.value)}
            aria-invalid={!!errors.naam}
          />
          {errors.naam && (
            <p className="text-destructive text-xs">{errors.naam}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">
            E-mailadres <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="uw@email.nl"
            value={gegevens.email}
            onChange={(e) => handleChange("email", e.target.value)}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="text-destructive text-xs">{errors.email}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="telefoon">
            Telefoonnummer <span className="text-destructive">*</span>
          </Label>
          <Input
            id="telefoon"
            type="tel"
            placeholder="06-12345678"
            value={gegevens.telefoon}
            onChange={(e) => handleChange("telefoon", e.target.value)}
            aria-invalid={!!errors.telefoon}
          />
          {errors.telefoon && (
            <p className="text-destructive text-xs">{errors.telefoon}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <Separator className="my-2" />
          <p className="text-sm font-medium text-foreground mt-3 mb-4">
            Afleveradres
          </p>
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="adres">
            Straat en huisnummer <span className="text-destructive">*</span>
          </Label>
          <Input
            id="adres"
            placeholder="Voorbeeldstraat 12"
            value={gegevens.adres}
            onChange={(e) => handleChange("adres", e.target.value)}
            aria-invalid={!!errors.adres}
          />
          {errors.adres && (
            <p className="text-destructive text-xs">{errors.adres}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="postcode">
            Postcode <span className="text-destructive">*</span>
          </Label>
          <Input
            id="postcode"
            placeholder="1234 AB"
            value={gegevens.postcode}
            onChange={(e) => handleChange("postcode", e.target.value)}
            aria-invalid={!!errors.postcode}
          />
          {errors.postcode && (
            <p className="text-destructive text-xs">{errors.postcode}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="plaats">
            Plaats <span className="text-destructive">*</span>
          </Label>
          <Input
            id="plaats"
            placeholder="Amsterdam"
            value={gegevens.plaats}
            onChange={(e) => handleChange("plaats", e.target.value)}
            aria-invalid={!!errors.plaats}
          />
          {errors.plaats && (
            <p className="text-destructive text-xs">{errors.plaats}</p>
          )}
        </div>
      </div>
    </div>
  );
}
