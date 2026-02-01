"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, GraduationCap } from "lucide-react";

// Skills/scopes for hoveniersbedrijf
export const AVAILABLE_SKILLS = [
  { id: "grondwerk", label: "Grondwerk" },
  { id: "bestrating", label: "Bestrating" },
  { id: "borders", label: "Borders & Beplanting" },
  { id: "gras", label: "Gras & Gazon" },
  { id: "houtwerk", label: "Houtwerk & Schuttingen" },
  { id: "water_elektra", label: "Water & Elektra" },
  { id: "vijvers", label: "Vijvers & Waterpartijen" },
  { id: "snoeien", label: "Snoeien" },
  { id: "heggen", label: "Heggen & Hagen" },
  { id: "bomen", label: "Boomverzorging" },
  { id: "machines", label: "Machines & Materieel" },
  { id: "ontwerp", label: "Tuinontwerp" },
] as const;

export type SkillId = typeof AVAILABLE_SKILLS[number]["id"];

export const SKILL_LEVELS = [
  { value: "junior", label: "Junior", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  { value: "medior", label: "Medior", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300" },
  { value: "senior", label: "Senior", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
] as const;

export type SkillLevel = typeof SKILL_LEVELS[number]["value"];

export interface Skill {
  id: SkillId;
  level: SkillLevel;
}

interface SkillsSelectorProps {
  value: Skill[];
  onChange: (skills: Skill[]) => void;
  disabled?: boolean;
}

export function SkillsSelector({
  value,
  onChange,
  disabled = false,
}: SkillsSelectorProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<SkillId | "">("");
  const [selectedLevel, setSelectedLevel] = useState<SkillLevel>("medior");

  // Get available skills (not already selected)
  const availableSkills = AVAILABLE_SKILLS.filter(
    (skill) => !value.some((s) => s.id === skill.id)
  );

  const handleAddSkill = useCallback(() => {
    if (!selectedSkillId) return;

    const newSkill: Skill = {
      id: selectedSkillId,
      level: selectedLevel,
    };

    onChange([...value, newSkill]);
    setSelectedSkillId("");
    setSelectedLevel("medior");
  }, [selectedSkillId, selectedLevel, value, onChange]);

  const handleRemoveSkill = useCallback(
    (skillId: SkillId) => {
      onChange(value.filter((s) => s.id !== skillId));
    },
    [value, onChange]
  );

  const handleUpdateLevel = useCallback(
    (skillId: SkillId, newLevel: SkillLevel) => {
      onChange(
        value.map((s) => (s.id === skillId ? { ...s, level: newLevel } : s))
      );
    },
    [value, onChange]
  );

  const getSkillLabel = (skillId: SkillId) => {
    return AVAILABLE_SKILLS.find((s) => s.id === skillId)?.label || skillId;
  };

  const getLevelConfig = (level: SkillLevel) => {
    return SKILL_LEVELS.find((l) => l.value === level)!;
  };

  return (
    <div className="space-y-4">
      {/* Add skill controls */}
      {availableSkills.length > 0 && (
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[160px]">
            <Select
              value={selectedSkillId}
              onValueChange={(v) => setSelectedSkillId(v as SkillId)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer vaardigheid" />
              </SelectTrigger>
              <SelectContent>
                {availableSkills.map((skill) => (
                  <SelectItem key={skill.id} value={skill.id}>
                    {skill.label}
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
            disabled={disabled || !selectedSkillId}
          >
            <Plus className="h-4 w-4 mr-1" />
            Toevoegen
          </Button>
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
              Nog geen vaardigheden toegevoegd
            </motion.div>
          ) : (
            value.map((skill) => {
              const levelConfig = getLevelConfig(skill.level);
              return (
                <motion.div
                  key={skill.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-1 border"
                >
                  <span className="text-sm font-medium">
                    {getSkillLabel(skill.id)}
                  </span>
                  <Select
                    value={skill.level}
                    onValueChange={(v) =>
                      handleUpdateLevel(skill.id, v as SkillLevel)
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
                    className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRemoveSkill(skill.id)}
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

// Compact display component for showing skills (e.g., in table)
export function SkillBadges({ skills }: { skills: Skill[] }) {
  if (skills.length === 0) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {skills.slice(0, 3).map((skill) => {
        const levelConfig = SKILL_LEVELS.find((l) => l.value === skill.level)!;
        const skillLabel =
          AVAILABLE_SKILLS.find((s) => s.id === skill.id)?.label || skill.id;
        return (
          <Badge
            key={skill.id}
            variant="secondary"
            className={`${levelConfig.color} text-xs`}
            title={`${skillLabel} (${levelConfig.label})`}
          >
            {skillLabel}
          </Badge>
        );
      })}
      {skills.length > 3 && (
        <Badge variant="outline" className="text-xs">
          +{skills.length - 3}
        </Badge>
      )}
    </div>
  );
}
