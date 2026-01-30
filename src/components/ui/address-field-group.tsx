"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AddressValue {
  straat?: string
  huisnummer?: string
  postcode?: string
  plaats?: string
}

interface AddressFieldGroupProps {
  value?: AddressValue
  onChange?: (address: AddressValue) => void
  errors?: Partial<Record<keyof AddressValue, string>>
  disabled?: boolean
  className?: string
  id?: string
}

const AddressFieldGroup = React.forwardRef<HTMLDivElement, AddressFieldGroupProps>(
  (
    {
      value = {},
      onChange,
      errors = {},
      disabled = false,
      className,
      id,
    },
    ref
  ) => {
    const generatedId = React.useId()
    const baseId = id || generatedId

  const handleChange = (field: keyof AddressValue, fieldValue: string) => {
    onChange?.({
      ...value,
      [field]: fieldValue,
    })
  }

  // Format Dutch postcode: 1234 AB
  const formatPostcode = (input: string): string => {
    // Remove all spaces and convert to uppercase
    const cleaned = input.replace(/\s/g, "").toUpperCase()

    // If we have 4+ characters, insert space after the numbers
    if (cleaned.length >= 4) {
      const numbers = cleaned.slice(0, 4)
      const letters = cleaned.slice(4, 6)
      if (letters) {
        return `${numbers} ${letters}`
      }
      return numbers
    }

    return cleaned
  }

  const handlePostcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPostcode(e.target.value)
    // Limit to 7 characters (4 digits + space + 2 letters)
    if (formatted.length <= 7) {
      handleChange("postcode", formatted)
    }
  }

    const hasError = (field: keyof AddressValue) => !!errors[field]

    return (
      <div
        ref={ref}
        data-slot="address-field-group"
        className={cn("grid gap-4", className)}
      >
      {/* Row 1: Straat + Huisnummer */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
        <div className="grid gap-2">
          <Label
            htmlFor={`${baseId}-straat`}
            className={cn(hasError("straat") && "text-destructive")}
          >
            Straat
          </Label>
          <Input
            id={`${baseId}-straat`}
            type="text"
            value={value.straat || ""}
            onChange={(e) => handleChange("straat", e.target.value)}
            disabled={disabled}
            placeholder="Voorbeeldstraat"
            aria-invalid={hasError("straat")}
            aria-describedby={hasError("straat") ? `${baseId}-straat-error` : undefined}
          />
          {errors.straat && (
            <p
              id={`${baseId}-straat-error`}
              className="text-destructive text-sm"
              role="alert"
            >
              {errors.straat}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label
            htmlFor={`${baseId}-huisnummer`}
            className={cn(hasError("huisnummer") && "text-destructive")}
          >
            Nr.
          </Label>
          <Input
            id={`${baseId}-huisnummer`}
            type="text"
            value={value.huisnummer || ""}
            onChange={(e) => handleChange("huisnummer", e.target.value)}
            disabled={disabled}
            placeholder="123a"
            className="w-full sm:w-24"
            aria-invalid={hasError("huisnummer")}
            aria-describedby={hasError("huisnummer") ? `${baseId}-huisnummer-error` : undefined}
          />
          {errors.huisnummer && (
            <p
              id={`${baseId}-huisnummer-error`}
              className="text-destructive text-sm"
              role="alert"
            >
              {errors.huisnummer}
            </p>
          )}
        </div>
      </div>

      {/* Row 2: Postcode + Plaats */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4">
        <div className="grid gap-2">
          <Label
            htmlFor={`${baseId}-postcode`}
            className={cn(hasError("postcode") && "text-destructive")}
          >
            Postcode
          </Label>
          <Input
            id={`${baseId}-postcode`}
            type="text"
            value={value.postcode || ""}
            onChange={handlePostcodeChange}
            disabled={disabled}
            placeholder="1234 AB"
            className="w-full sm:w-28"
            aria-invalid={hasError("postcode")}
            aria-describedby={hasError("postcode") ? `${baseId}-postcode-error` : undefined}
          />
          {errors.postcode && (
            <p
              id={`${baseId}-postcode-error`}
              className="text-destructive text-sm"
              role="alert"
            >
              {errors.postcode}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label
            htmlFor={`${baseId}-plaats`}
            className={cn(hasError("plaats") && "text-destructive")}
          >
            Plaats
          </Label>
          <Input
            id={`${baseId}-plaats`}
            type="text"
            value={value.plaats || ""}
            onChange={(e) => handleChange("plaats", e.target.value)}
            disabled={disabled}
            placeholder="Amsterdam"
            aria-invalid={hasError("plaats")}
            aria-describedby={hasError("plaats") ? `${baseId}-plaats-error` : undefined}
          />
          {errors.plaats && (
            <p
              id={`${baseId}-plaats-error`}
              className="text-destructive text-sm"
              role="alert"
            >
              {errors.plaats}
            </p>
          )}
        </div>
      </div>
    </div>
    )
  }
)

AddressFieldGroup.displayName = "AddressFieldGroup"

export { AddressFieldGroup }
export type { AddressFieldGroupProps, AddressValue }
