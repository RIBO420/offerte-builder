"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, GraduationCap, Award } from "lucide-react";

// Skills/scopes for hoveniersbedrijf matching the system scopes
export const AVAILABLE_SCOPES = [
  { id: "grondwerk", label: "Grondwerk" },
  { id: "bestrating", label: "Bestrating" },
  { id: "borders", label: "Borders & Beplanting" },
  { id: "gras", label: "Gras & Gazon" },
  { id: "houtwerk", label: "Houtwerk & Schuttingen" },
  { id: "water_elektra", label: "Water & Elektra" },
  { id: "specials", label: "Specials" },
  { id: "gras_onderhoud", label: "Gras Onderhoud" },
  { id: "borders_onderhoud", label: "Borders Onderhoud" },
  { id: "heggen", label: "Heggen & Hagen" },
  { id: "bomen", label: "Boomverzorging" },
  { id: "overig", label: "Overig" },
] as const;

export type ScopeId = typeof AVAILABLE_SCOPES[number]["id"];

export const SKILL_LEVELS = [
  { value: "junior", label: "Junior", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  { value: "midlevel", label: "Midlevel", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300" },
  { value: "senior", label: "Senior", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
] as const;

export type SkillLevel = "junior" | "midlevel" | "senior";

// Matches the Convex schema
export interface Specialisatie {
  scope: string;
  niveau: SkillLevel;
  gecertificeerd?: boolean;
}

interface SkillsSelectorProps {
  value: Specialisatie[];
  onChange: (specialisaties: Specialisatie[]) => void;
  disabled?: boolean;
}

export function SkillsSelector({
  value,
  onChange,
  disabled = false,
}: SkillsSelectorProps) {
  const [selectedScope, setSelectedScope] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<SkillLevel>("midlevel");
  const [isCertified, setIsCertified] = useState(false);

  // Get available scopes (not already selected)
  const availableScopes = AVAILABLE_SCOPES.filter(
    (scope) => !value.some((s) => s.scope === scope.id)
  );

  const handleAddSkill = useCallback(() => {
    if (!selectedScope) return;

    const newSpec: Specialisatie = {
      scope: selectedScope,
      niveau: selectedLevel,
      gecertificeerd: isCertified || undefined,
    };

    onChange([...value, newSpec]);
    setSelectedScope("");
    setSelectedLevel("midlevel");
    setIsCertified(false);
  }, [selectedScope, selectedLevel, isCertified, value, onChange]);

  const handleRemoveSkill = useCallback(
    (scope: string) => {
      onChange(value.filter((s) => s.scope !== scope));
    },
    [value, onChange]
  );

  const handleUpdateLevel = useCallback(
    (scope: string, newLevel: SkillLevel) => {
      onChange(
        value.map((s) => (s.scope === scope ? { ...s, niveau: newLevel } : s))
      );
    },
    [value, onChange]
  );

  const handleToggleCertified = useCallback(
    (scope: string) => {
      onChange(
        value.map((s) =>
          s.scope === scope
            ? { ...s, gecertificeerd: !s.gecertificeerd || undefined }
            : s
        )
      );
    },
    [value, onChange]
  );

  const getScopeLabel = (scopeId: string) => {
    return AVAILABLE_SCOPES.find((s) => s.id === scopeId)?.label || scopeId;
  };

  const getLevelConfig = (level: SkillLevel) => {
    return SKILL_LEVELS.find((l) => l.value === level)!;
  };

  return (
    <div className="space-y-4">
      {/* Add skill controls */}
      {availableScopes.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[160px]">
              <Select
                value={selectedScope}
                onValueChange={setSelectedScope}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer specialisatie" />
                </SelectTrigger>
                <SelectContent>
                  {availableScopes.map((scope) => (
                    <SelectItem key={scope.id} value={scope.id}>
                      {scope.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[120px]">
              <Select
                value={selectedLevel}
                onValueChange={(v) => setSelectedLevel(v as SkillLevel)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SKILL_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAddSkill}
              disabled={disabled || !selectedScope}
            >
              <Plus className="h-4 w-4 mr-1" />
              Toevoegen
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="certified"
              checked={isCertified}
              onCheckedChange={(checked) => setIsCertified(checked === true)}
              disabled={disabled}
            />
            <Label
              htmlFor="certified"
              className="text-sm font-normal cursor-pointer"
            >
              Gecertificeerd voor deze specialisatie
            </Label>
          </div>
        </div>
      )}

      {/* Selected skills */}
      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {value.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-muted-foreground py-2"
            >
              <GraduationCap className="h-4 w-4" />
              Nog geen specialisaties toegevoegd
            </motion.div>
          ) : (
            value.map((spec) => {
              const levelConfig = getLevelConfig(spec.niveau);
              return (
                <motion.div
                  key={spec.scope}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-1 border"
                >
                  <span className="text-sm font-medium">
                    {getScopeLabel(spec.scope)}
                  </span>
                  <Select
                    value={spec.niveau}
                    onValueChange={(v) =>
                      handleUpdateLevel(spec.scope, v as SkillLevel)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-6 w-auto px-2 text-xs border-0 bg-transparent">
                      <Badge
                        variant="secondary"
                        className={`${levelConfig.color} text-xs`}
                      >
                        {levelConfig.label}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {SKILL_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          <Badge
                            variant="secondary"
                            className={`${level.color} text-xs`}
                          >
                            {level.label}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => handleToggleCertified(spec.scope)}
                    disabled={disabled}
                    title={spec.gecertificeerd ? "Certificering verwijderen" : "Markeer als gecertificeerd"}
                  >
                    <Award className={`h-3.5 w-3.5 ${spec.gecertificeerd ? "text-green-600" : "text-muted-foreground/50"}`} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRemoveSkill(spec.scope)}
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Compact display component for showing specialisaties in table
export function SpecialisatieBadges({ specialisaties }: { specialisaties?: Specialisatie[] }) {
  if (!specialisaties || specialisaties.length === 0) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {specialisaties.slice(0, 3).map((spec) => {
        const levelConfig = SKILL_LEVELS.find((l) => l.value === spec.niveau)!;
        const scopeLabel =
          AVAILABLE_SCOPES.find((s) => s.id === spec.scope)?.label || spec.scope;
        return (
          <Badge
            key={spec.scope}
            variant="secondary"
            className={`${levelConfig.color} text-xs`}
            title={`${scopeLabel} (${levelConfig.label})${spec.gecertificeerd ? " - Gecertificeerd" : ""}`}
          >
            {scopeLabel}
            {spec.gecertificeerd && <Award className="h-2.5 w-2.5 ml-0.5" />}
          </Badge>
        );
      })}
      {specialisaties.length > 3 && (
        <Badge variant="outline" className="text-xs">
          +{specialisaties.length - 3}
        </Badge>
      )}
    </div>
  );
}
