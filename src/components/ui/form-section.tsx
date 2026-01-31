"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"

// ============================================================================
// FormSection Component
// ============================================================================

interface FormSectionProps {
  title: string
  description?: string
  icon?: React.ReactNode
  children: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  className?: string
}

const FormSection = React.forwardRef<HTMLDivElement, FormSectionProps>(
  (
    {
      title,
      description,
      icon,
      children,
      collapsible = false,
      defaultOpen = true,
      className,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(defaultOpen)

  const headerContent = (
    <div className="flex items-start gap-3">
      {icon && (
        <div className="text-muted-foreground mt-0.5 shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold leading-none tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-muted-foreground text-sm mt-1.5">
            {description}
          </p>
        )}
      </div>
      {collapsible && (
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      )}
    </div>
  )

  if (collapsible) {
    return (
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className={cn(
          "bg-muted/50 rounded-lg border border-border/80",
          className
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full p-4 text-left hover:bg-muted/50 transition-colors rounded-t-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {headerContent}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <div className="px-4 pb-4 pt-0">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

    return (
      <div
        ref={ref}
        data-slot="form-section"
        className={cn(
          "bg-muted/50 rounded-lg border border-border/80 p-4",
          className
        )}
      >
        <div className="mb-4">
          {headerContent}
        </div>
        {children}
      </div>
    )
  }
)

FormSection.displayName = "FormSection"

// ============================================================================
// FormRow Component
// ============================================================================

interface FormRowProps {
  children: React.ReactNode
  columns?: 1 | 2 | 3 | 4
  gap?: "sm" | "md" | "lg"
  className?: string
}

const gapStyles = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
}

const columnStyles = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
}

const FormRow = React.forwardRef<HTMLDivElement, FormRowProps>(
  ({ children, columns = 2, gap = "md", className }, ref) => (
    <div
      ref={ref}
      data-slot="form-row"
      className={cn(
        "grid",
        columnStyles[columns],
        gapStyles[gap],
        className
      )}
    >
      {children}
    </div>
  )
)

FormRow.displayName = "FormRow"

// ============================================================================
// FormDivider Component
// ============================================================================

interface FormDividerProps {
  label?: string
  className?: string
}

const FormDivider = React.forwardRef<HTMLDivElement, FormDividerProps>(
  ({ label, className }, ref) => {
    if (label) {
      return (
        <div
          ref={ref}
          data-slot="form-divider"
          className={cn("relative my-4", className)}
        >
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-muted/50 px-2 text-xs text-muted-foreground uppercase tracking-wider">
              {label}
            </span>
          </div>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        data-slot="form-divider"
        className={cn("my-4 border-t border-border", className)}
      />
    )
  }
)

FormDivider.displayName = "FormDivider"

// ============================================================================
// FieldGroup Component
// ============================================================================

interface FieldGroupProps {
  label: string
  description?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
  htmlFor?: string
}

const FieldGroup = React.forwardRef<HTMLDivElement, FieldGroupProps>(
  ({ label, description, error, required, children, className, htmlFor }, ref) => {
    const id = React.useId()
    const fieldId = htmlFor || id
    const descriptionId = `${fieldId}-description`
    const errorId = `${fieldId}-error`

    return (
      <div
        ref={ref}
        data-slot="field-group"
        className={cn("grid gap-2", className)}
      >
        <Label htmlFor={fieldId} className={cn(error && "text-destructive")}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {description && (
          <p
            id={descriptionId}
            className="text-muted-foreground text-sm -mt-1"
          >
            {description}
          </p>
        )}
        <div
          className="[&>*]:w-full"
          aria-describedby={
            error
              ? `${descriptionId} ${errorId}`
              : description
              ? descriptionId
              : undefined
          }
        >
          {children}
        </div>
        {error && (
          <p
            id={errorId}
            className="text-destructive text-sm"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

FieldGroup.displayName = "FieldGroup"

export { FormSection, FormRow, FormDivider, FieldGroup }
export type { FormSectionProps, FormRowProps, FormDividerProps, FieldGroupProps }
