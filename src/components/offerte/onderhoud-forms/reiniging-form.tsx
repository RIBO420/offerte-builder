"use client";

import { useEffect } from "react";
import { useFormValidationSync } from "@/hooks/use-scope-form-sync";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Droplets } from "lucide-react";

import { ReinigingTerrasreinigingSectie } from "./reiniging-terrasreiniging-sectie";
import { ReinigingHogedrukAkkoord } from "./reiniging-hogedruk-akkoord";
import { ReinigingBladruimenSectie } from "./reiniging-bladruimen-sectie";
import { ReinigingOnkruidSectie } from "./reiniging-onkruid-sectie";
import { ReinigingAlgereinigingSectie } from "./reiniging-algereiniging-sectie";
import { ReinigingSamenvatting } from "./reiniging-samenvatting";

// ---------------------------------------------------------------------------
// Inline Zod schema — tijdelijk, wordt later door een andere agent vervangen
// door een import uit @/lib/validations/onderhoud-scopes
// ---------------------------------------------------------------------------

// Gebruik z.output voor het formulier type zodat de boolean defaults correct
// worden opgelost (boolean ipv boolean | undefined).
const reinigingBaseSchema = z.object({
  // Terrasreiniging
  terrasreinigingAan: z.boolean(),
  terrasType: z
    .enum(["keramisch", "beton", "klinkers", "natuursteen", "hout"])
    .optional(),
  terrasOppervlakte: z.number().min(0).optional(),

  // Hogedrukspuit akkoord (verplicht als terrasreinigingAan)
  hogedrukAkkoord: z.boolean(),
  hogedrukDatumAkkoord: z.string().optional(),

  // Bladruimen
  bladruimenAan: z.boolean(),
  bladruimenOppervlakte: z.number().min(0).optional(),
  bladruimenFrequentie: z.enum(["eenmalig", "seizoen"]).optional(),
  bladafvoerAan: z.boolean(),

  // Onkruidbestrijding bestrating
  onkruidBestratingAan: z.boolean(),
  onkruidOppervlakte: z.number().min(0).optional(),
  onkruidMethode: z
    .enum(["handmatig", "branden", "heet_water", "chemisch"])
    .optional(),

  // Algereiniging / mosbestrijding
  algereinigingAan: z.boolean(),
  algereinigingOppervlakte: z.number().min(0).optional(),
  algereinigingType: z
    .enum(["dak", "bestrating", "hekwerk", "muur"])
    .optional(),
});

// Type voor react-hook-form — afgeleid van het basisschema
// Geexporteerd zodat sub-componenten het kunnen importeren voor useFormContext
export type ReinigingFormData = z.infer<typeof reinigingBaseSchema>;

// Volledig schema met cross-field validaties via superRefine
const reinigingSchema = reinigingBaseSchema.superRefine((data, ctx) => {
  if (data.terrasreinigingAan) {
    if (!data.terrasType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["terrasType"],
        message: "Selecteer een terras-type",
      });
    }
    if (!data.terrasOppervlakte || data.terrasOppervlakte <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["terrasOppervlakte"],
        message: "Voer een geldige oppervlakte in",
      });
    }
    if (!data.hogedrukAkkoord) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hogedrukAkkoord"],
        message: "Klant akkoord is verplicht bij terrasreiniging",
      });
    }
  }
  if (data.bladruimenAan) {
    if (!data.bladruimenOppervlakte || data.bladruimenOppervlakte <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bladruimenOppervlakte"],
        message: "Voer een geldige oppervlakte in",
      });
    }
    if (!data.bladruimenFrequentie) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bladruimenFrequentie"],
        message: "Selecteer een frequentie",
      });
    }
  }
  if (data.onkruidBestratingAan) {
    if (!data.onkruidOppervlakte || data.onkruidOppervlakte <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["onkruidOppervlakte"],
        message: "Voer een geldige oppervlakte in",
      });
    }
    if (!data.onkruidMethode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["onkruidMethode"],
        message: "Selecteer een methode",
      });
    }
  }
  if (data.algereinigingAan) {
    if (
      !data.algereinigingOppervlakte ||
      data.algereinigingOppervlakte <= 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["algereinigingOppervlakte"],
        message: "Voer een geldige oppervlakte in",
      });
    }
    if (!data.algereinigingType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["algereinigingType"],
        message: "Selecteer een type",
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface ReinigingFormProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

// ---------------------------------------------------------------------------
// Helper: vandaag als ISO-datumstring
// ---------------------------------------------------------------------------

function vandaagAlsISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Hoofd-component (form provider wrapper)
// ---------------------------------------------------------------------------

export function ReinigingForm({
  data,
  onChange,
  onValidationChange,
}: ReinigingFormProps) {
  const form = useForm<ReinigingFormData>({
    resolver: zodResolver(reinigingSchema),
    defaultValues: {
      terrasreinigingAan:
        typeof data.terrasreinigingAan === "boolean"
          ? data.terrasreinigingAan
          : false,
      terrasType: (data.terrasType as ReinigingFormData["terrasType"]) ?? undefined,
      terrasOppervlakte:
        typeof data.terrasOppervlakte === "number"
          ? data.terrasOppervlakte
          : 0,

      hogedrukAkkoord:
        typeof data.hogedrukAkkoord === "boolean" ? data.hogedrukAkkoord : false,
      hogedrukDatumAkkoord:
        typeof data.hogedrukDatumAkkoord === "string"
          ? data.hogedrukDatumAkkoord
          : vandaagAlsISO(),

      bladruimenAan:
        typeof data.bladruimenAan === "boolean" ? data.bladruimenAan : false,
      bladruimenOppervlakte:
        typeof data.bladruimenOppervlakte === "number"
          ? data.bladruimenOppervlakte
          : 0,
      bladruimenFrequentie:
        (data.bladruimenFrequentie as ReinigingFormData["bladruimenFrequentie"]) ?? undefined,
      bladafvoerAan:
        typeof data.bladafvoerAan === "boolean" ? data.bladafvoerAan : false,

      onkruidBestratingAan:
        typeof data.onkruidBestratingAan === "boolean"
          ? data.onkruidBestratingAan
          : false,
      onkruidOppervlakte:
        typeof data.onkruidOppervlakte === "number"
          ? data.onkruidOppervlakte
          : 0,
      onkruidMethode:
        (data.onkruidMethode as ReinigingFormData["onkruidMethode"]) ?? undefined,

      algereinigingAan:
        typeof data.algereinigingAan === "boolean"
          ? data.algereinigingAan
          : false,
      algereinigingOppervlakte:
        typeof data.algereinigingOppervlakte === "number"
          ? data.algereinigingOppervlakte
          : 0,
      algereinigingType:
        (data.algereinigingType as ReinigingFormData["algereinigingType"]) ?? undefined,
    },
    mode: "onChange",
  });

  const {
    formState: { errors, isValid },
    watch,
  } = form;

  // Sync form values naar parent
  useEffect(() => {
    const subscription = watch((values) => {
      onChange({
        terrasreinigingAan: values.terrasreinigingAan ?? false,
        terrasType: values.terrasType ?? null,
        terrasOppervlakte: values.terrasOppervlakte ?? 0,
        hogedrukAkkoord: values.hogedrukAkkoord ?? false,
        hogedrukDatumAkkoord: values.hogedrukDatumAkkoord ?? vandaagAlsISO(),
        bladruimenAan: values.bladruimenAan ?? false,
        bladruimenOppervlakte: values.bladruimenOppervlakte ?? 0,
        bladruimenFrequentie: values.bladruimenFrequentie ?? null,
        bladafvoerAan: values.bladafvoerAan ?? false,
        onkruidBestratingAan: values.onkruidBestratingAan ?? false,
        onkruidOppervlakte: values.onkruidOppervlakte ?? 0,
        onkruidMethode: values.onkruidMethode ?? null,
        algereinigingAan: values.algereinigingAan ?? false,
        algereinigingOppervlakte: values.algereinigingOppervlakte ?? 0,
        algereinigingType: values.algereinigingType ?? null,
      });
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // Validatiestatus doorgeven aan parent
  useFormValidationSync(errors, isValid, onValidationChange);

  const terrasreinigingAan = watch("terrasreinigingAan");

  return (
    <Form {...form}>
      <form>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Reinigingswerkzaamheden</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Terrasreiniging, bladruimen, onkruidbestrijding en algereiniging
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-0">
              <ReinigingTerrasreinigingSectie />
              {terrasreinigingAan && <ReinigingHogedrukAkkoord />}
              <ReinigingBladruimenSectie />
              <ReinigingOnkruidSectie />
              <ReinigingAlgereinigingSectie />
              <ReinigingSamenvatting />
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  );
}
