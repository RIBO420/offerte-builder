import { Input } from "@/components/ui/input";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { KlantGegevens } from "./types";
import { Field } from "./field";
import { PoortWaarschuwing } from "./poort-waarschuwing";

export function Stap1Klantgegevens({
  data,
  errors,
  onChange,
}: {
  data: KlantGegevens;
  errors: Record<string, string>;
  onChange: (field: keyof KlantGegevens, value: string) => void;
}) {
  const poortBreedte = parseFloat(data.poortbreedte);
  const isTeSmall = !isNaN(poortBreedte) && poortBreedte < 60;

  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl">Uw gegevens</CardTitle>
        <CardDescription>
          Vul uw contactgegevens in. Wij gebruiken deze om de aanvraag te
          verwerken en contact met u op te nemen.
        </CardDescription>
      </CardHeader>

      <Field label="Volledige naam" error={errors.naam}>
        <Input
          placeholder="Jan de Vries"
          value={data.naam}
          onChange={(e) => onChange("naam", e.target.value)}
          className={cn(errors.naam && "border-red-400 focus-visible:ring-red-400")}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="E-mailadres" error={errors.email}>
          <Input
            type="email"
            placeholder="jan@email.nl"
            value={data.email}
            onChange={(e) => onChange("email", e.target.value)}
            className={cn(errors.email && "border-red-400 focus-visible:ring-red-400")}
          />
        </Field>
        <Field label="Telefoonnummer" error={errors.telefoon}>
          <Input
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
          placeholder="Tuinstraat 12"
          value={data.adres}
          onChange={(e) => onChange("adres", e.target.value)}
          className={cn(errors.adres && "border-red-400 focus-visible:ring-red-400")}
        />
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Postcode" error={errors.postcode}>
          <Input
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
              placeholder="Amsterdam"
              value={data.plaats}
              onChange={(e) => onChange("plaats", e.target.value)}
              className={cn(
                errors.plaats && "border-red-400 focus-visible:ring-red-400"
              )}
            />
          </Field>
        </div>
      </div>

      <Separator />

      <Field
        label="Poortbreedte"
        error={errors.poortbreedte}
        hulptekst="De breedte van de smalste doorgang naar uw tuin, in centimeters. Dit bepaalt welke machines we kunnen inzetten."
      >
        <div className="flex items-center gap-3">
          <Input
            type="number"
            placeholder="120"
            min={1}
            max={500}
            value={data.poortbreedte}
            onChange={(e) => onChange("poortbreedte", e.target.value)}
            className={cn(
              "max-w-36",
              (errors.poortbreedte || isTeSmall) &&
                "border-red-400 focus-visible:ring-red-400"
            )}
          />
          <span className="text-sm text-muted-foreground">cm</span>
        </div>
      </Field>

      <PoortWaarschuwing breedte={data.poortbreedte} />
    </div>
  );
}
