import { Input } from "@/components/ui/input";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { KlantGegevens } from "./types";
import { Field } from "./field";

/* WS9: dit is nu de slotstap — NAW pas ná de prijsindicatie (keuzepunt 5). */
export function StapKlantgegevens({
  data,
  errors,
  onChange,
}: {
  data: KlantGegevens;
  errors: Record<string, string>;
  onChange: (field: keyof KlantGegevens, value: string) => void;
}) {
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

      <Field label="Volledige naam" error={errors.naam}>
        <Input
          required
          aria-required
          placeholder="Jan de Vries"
          value={data.naam}
          onChange={(e) => onChange("naam", e.target.value)}
          className={cn(errors.naam && "border-red-400 focus-visible:ring-red-400")}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="E-mailadres" error={errors.email}>
          <Input
            required
            aria-required
            type="email"
            placeholder="jan@email.nl"
            value={data.email}
            onChange={(e) => onChange("email", e.target.value)}
            className={cn(errors.email && "border-red-400 focus-visible:ring-red-400")}
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
            className={cn(
              errors.telefoon && "border-red-400 focus-visible:ring-red-400"
            )}
          />
        </Field>
      </div>

      <Field label="Straat en huisnummer" error={errors.adres}>
        <Input
          required
          aria-required
          placeholder="Tuinstraat 12"
          value={data.adres}
          onChange={(e) => onChange("adres", e.target.value)}
          className={cn(errors.adres && "border-red-400 focus-visible:ring-red-400")}
        />
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Postcode" error={errors.postcode}>
          <Input
            required
            aria-required
            placeholder="1234 AB"
            value={data.postcode}
            onChange={(e) => onChange("postcode", e.target.value)}
            className={cn(
              errors.postcode && "border-red-400 focus-visible:ring-red-400"
            )}
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
              className={cn(
                errors.plaats && "border-red-400 focus-visible:ring-red-400"
              )}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
