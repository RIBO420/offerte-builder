"use client";

/**
 * Het juiste scope-formulier bij een scope-id.
 *
 * De formulieren zelf zijn onaangeroerd overgenomen uit de wizard — inclusief
 * het funderings-lagendiagram in `bestrating-form` en de richtprijs-badges.
 * Ze brengen hun eigen kaart mee; het werkblad zet er alleen een kopstrip
 * boven en de berekende regels onder.
 */

import {
  GrondwerkForm,
  BestratingForm,
  ParkeerplaatsForm,
  BeregeningForm,
  BordersForm,
  GrasForm,
  HoutwerkForm,
  WaterElektraForm,
  SpecialsForm,
} from "@/components/offerte/scope-forms";
import {
  GrasOnderhoudForm,
  BordersOnderhoudForm,
  HeggenForm,
  BomenForm,
  OverigForm,
  ReinigingForm,
  BemestingForm,
  GazonanalyseForm,
  MollenbestrijdingForm,
} from "@/components/offerte/onderhoud-forms";
import type { WerkbankScopeId, WerkbankType } from "@/lib/werkbank";

type Wijzig = (data: unknown) => void;
type Valideer = (isValid: boolean, errors: Record<string, string>) => void;

interface WerkbankScopeFormulierProps {
  type: WerkbankType;
  scope: WerkbankScopeId;
  data: unknown;
  onChange: Wijzig;
  onValidationChange: Valideer;
}

export function WerkbankScopeFormulier({
  type,
  scope,
  data,
  onChange,
  onValidationChange,
}: WerkbankScopeFormulierProps) {
  // De formulieren hebben elk hun eigen datatype; het werkblad houdt scopeData
  // bewust generiek omdat het ook uit Convex (`v.any()`) terug kan komen.
  const props = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: data as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChange: onChange as any,
    onValidationChange,
  };

  if (type === "aanleg") {
    switch (scope) {
      case "grondwerk":
        return <GrondwerkForm {...props} />;
      case "bestrating":
        return <BestratingForm {...props} />;
      case "parkeerplaats":
        return <ParkeerplaatsForm {...props} />;
      case "beregening":
        return <BeregeningForm {...props} />;
      case "borders":
        return <BordersForm {...props} />;
      case "gras":
        return <GrasForm {...props} />;
      case "houtwerk":
        return <HoutwerkForm {...props} />;
      case "water_elektra":
        return <WaterElektraForm {...props} />;
      case "specials":
        return <SpecialsForm {...props} />;
      default:
        return null;
    }
  }

  switch (scope) {
    case "gras":
      return <GrasOnderhoudForm {...props} />;
    case "borders":
      return <BordersOnderhoudForm {...props} />;
    case "heggen":
      return <HeggenForm {...props} />;
    case "bomen":
      return <BomenForm {...props} />;
    case "overig":
      return <OverigForm {...props} />;
    case "reiniging":
      return <ReinigingForm {...props} />;
    case "bemesting":
      return <BemestingForm {...props} />;
    case "gazonanalyse":
      return <GazonanalyseForm {...props} />;
    case "mollenbestrijding":
      return <MollenbestrijdingForm {...props} />;
    default:
      return null;
  }
}
