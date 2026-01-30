"use client";

import { motion } from "framer-motion";
import { LucideIcon, FileText, Users, Search, FolderOpen, AlertCircle } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: {
    icon: 32,
    title: "text-base",
    description: "text-sm",
    padding: "p-6",
  },
  md: {
    icon: 48,
    title: "text-lg",
    description: "text-sm",
    padding: "p-8",
  },
  lg: {
    icon: 64,
    title: "text-xl",
    description: "text-base",
    padding: "p-12",
  },
};

export function EnhancedEmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = "md",
}: EmptyStateProps) {
  const config = sizeConfig[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "flex flex-col items-center text-center",
        config.padding,
        "rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10",
        className
      )}
    >
      {/* Animated Icon Container */}
      <motion.div
        className="relative mb-6"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
        
        {/* Icon background */}
        <div className="relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 p-4">
          <Icon
            className="text-emerald-500"
            style={{ width: config.icon, height: config.icon }}
          />
        </div>
      </motion.div>

      {/* Title */}
      <h3 className={cn("font-semibold text-foreground mb-2", config.title)}>
        {title}
      </h3>

      {/* Description */}
      <p className={cn("text-muted-foreground max-w-sm mb-6", config.description)}>
        {description}
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {action && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={action.onClick}
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
            >
              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
              {action.label}
            </Button>
          </motion.div>
        )}
        {secondaryAction && (
          <Button variant="outline" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// Pre-configured empty states voor common scenarios
export function EmptyOffertes({ onCreate }: { onCreate: () => void }) {
  return (
    <EnhancedEmptyState
      icon={FileText}
      title="Nog geen offertes"
      description="Start met je eerste offerte en zie hier je overzicht. Het duurt maar een paar minuten."
      action={{
        label: "Nieuwe offerte maken",
        onClick: onCreate,
        icon: FileText,
      }}
      size="lg"
    />
  );
}

export function EmptyKlanten({ onCreate }: { onCreate: () => void }) {
  return (
    <EnhancedEmptyState
      icon={Users}
      title="Nog geen klanten"
      description="Voeg je eerste klant toe om snel offertes te kunnen maken."
      action={{
        label: "Klant toevoegen",
        onClick: onCreate,
        icon: Users,
      }}
    />
  );
}

export function EmptySearch({ onClear }: { onClear: () => void }) {
  return (
    <EnhancedEmptyState
      icon={Search}
      title="Geen resultaten gevonden"
      description="Probeer andere zoektermen of filters."
      action={{
        label: "Filters wissen",
        onClick: onClear,
        icon: Search,
      }}
      size="sm"
    />
  );
}

export function EmptyStateError({
  onRetry,
  title = "Er is iets misgegaan",
  description = "Probeer het opnieuw of neem contact op met support.",
}: {
  onRetry: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <EnhancedEmptyState
      icon={AlertCircle}
      title={title}
      description={description}
      action={{
        label: "Opnieuw proberen",
        onClick: onRetry,
      }}
      size="md"
    />
  );
}

// Loading empty state (shows skeleton)
export function EmptyStateLoading() {
  return (
    <div className="flex flex-col items-center justify-center p-12 rounded-2xl bg-white/5 border border-white/10">
      <motion.div
        className="w-16 h-16 rounded-2xl bg-emerald-500/10 mb-4"
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <div className="w-32 h-4 bg-white/10 rounded mb-2" />
      <div className="w-48 h-3 bg-white/5 rounded" />
    </div>
  );
}
