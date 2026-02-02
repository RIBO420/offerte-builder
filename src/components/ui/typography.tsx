import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Typography Component System
 *
 * Provides consistent text styling across the application.
 * Includes Heading, Text, Caption, and TextLabel components.
 */

// =============================================================================
// Heading Component
// =============================================================================

const headingVariants = cva("font-semibold tracking-tight", {
  variants: {
    level: {
      1: "text-3xl lg:text-4xl",
      2: "text-2xl lg:text-3xl",
      3: "text-xl lg:text-2xl",
      4: "text-lg lg:text-xl",
    },
  },
  defaultVariants: {
    level: 2,
  },
});

type HeadingLevel = 1 | 2 | 3 | 4;

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  level?: HeadingLevel;
  as?: `h${HeadingLevel}`;
}

/**
 * Heading component for consistent heading styles.
 *
 * @example
 * ```tsx
 * <Heading level={1}>Main Title</Heading>
 * <Heading level={2}>Section Title</Heading>
 * <Heading level={3}>Subsection</Heading>
 * <Heading level={4}>Small Heading</Heading>
 *
 * // Override the semantic element while keeping visual style
 * <Heading level={1} as="h2">Visually large, but h2</Heading>
 * ```
 */
export function Heading({
  level = 2,
  as,
  className,
  children,
  ...props
}: HeadingProps) {
  const Tag = as ?? (`h${level}` as `h${HeadingLevel}`);

  return (
    <Tag className={cn(headingVariants({ level }), className)} {...props}>
      {children}
    </Tag>
  );
}

// =============================================================================
// Text Component
// =============================================================================

const textVariants = cva("", {
  variants: {
    size: {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
    },
    variant: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      destructive: "text-destructive",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
  },
  defaultVariants: {
    size: "base",
    variant: "default",
    weight: "normal",
  },
});

export interface TextProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof textVariants> {
  as?: "p" | "span" | "div";
}

/**
 * Text component for body text with consistent sizing and colors.
 *
 * @example
 * ```tsx
 * <Text>Default paragraph text</Text>
 * <Text size="sm" variant="muted">Small muted helper text</Text>
 * <Text size="lg" weight="semibold">Large emphasized text</Text>
 * <Text as="span" variant="destructive">Error message</Text>
 * ```
 */
export function Text({
  size,
  variant,
  weight,
  as: Tag = "p",
  className,
  children,
  ...props
}: TextProps) {
  return (
    <Tag
      className={cn(textVariants({ size, variant, weight }), className)}
      {...props}
    >
      {children}
    </Tag>
  );
}

// =============================================================================
// Caption Component
// =============================================================================

export interface CaptionProps extends React.HTMLAttributes<HTMLSpanElement> {
  as?: "span" | "p" | "figcaption";
}

/**
 * Caption component for small descriptive text.
 * Uses text-xs size and muted foreground color.
 *
 * @example
 * ```tsx
 * <Caption>Last updated 2 hours ago</Caption>
 * <Caption as="figcaption">Image caption</Caption>
 * ```
 */
export function Caption({
  as: Tag = "span",
  className,
  children,
  ...props
}: CaptionProps) {
  return (
    <Tag
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    >
      {children}
    </Tag>
  );
}

// =============================================================================
// TextLabel Component
// =============================================================================

export interface TextLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  as?: "span" | "div" | "label";
  htmlFor?: string;
}

/**
 * TextLabel component for labeling form fields or content sections.
 * Uses text-sm size with medium font weight.
 *
 * Note: This is a visual label component. For form labels with accessibility
 * features, use the Label component from "@/components/ui/label" instead.
 *
 * @example
 * ```tsx
 * <TextLabel>Field Name</TextLabel>
 * <TextLabel as="label" htmlFor="input-id">Form Label</TextLabel>
 * ```
 */
export function TextLabel({
  as: Tag = "span",
  className,
  children,
  ...props
}: TextLabelProps) {
  return (
    <Tag
      className={cn("text-sm font-medium leading-none", className)}
      {...props}
    >
      {children}
    </Tag>
  );
}

// =============================================================================
// Exports
// =============================================================================

export { headingVariants, textVariants };
