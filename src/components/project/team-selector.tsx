"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, X, Clock } from "lucide-react";

interface TeamSelectorProps {
  teamGrootte: 2 | 3 | 4;
  teamleden: string[];
  effectieveUrenPerDag: number;
  onTeamGrootteChange: (size: 2 | 3 | 4) => void;
  onTeamledenChange: (leden: string[]) => void;
  onEffectieveUrenChange: (uren: number) => void;
  disabled?: boolean;
}

export function TeamSelector({
  teamGrootte,
  teamleden,
  effectieveUrenPerDag,
  onTeamGrootteChange,
  onTeamledenChange,
  onEffectieveUrenChange,
  disabled = false,
}: TeamSelectorProps) {
  const [newTeamlid, setNewTeamlid] = useState("");

  const handleAddTeamlid = useCallback(() => {
    if (newTeamlid.trim() && teamleden.length < teamGrootte) {
      onTeamledenChange([...teamleden, newTeamlid.trim()]);
      setNewTeamlid("");
    }
  }, [newTeamlid, teamleden, teamGrootte, onTeamledenChange]);

  const handleRemoveTeamlid = useCallback(
    (index: number) => {
      const updated = teamleden.filter((_, i) => i !== index);
      onTeamledenChange(updated);
    },
    [teamleden, onTeamledenChange]
  );

  const handleTeamGrootteChange = useCallback(
    (value: string) => {
      const size = parseInt(value) as 2 | 3 | 4;
      onTeamGrootteChange(size);
      // Trim teamleden if new size is smaller
      if (teamleden.length > size) {
        onTeamledenChange(teamleden.slice(0, size));
      }
    },
    [onTeamGrootteChange, teamleden, onTeamledenChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTeamlid();
      }
    },
    [handleAddTeamlid]
  );

  const teamCapaciteitPerDag = teamGrootte * effectieveUrenPerDag;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Configuratie
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Team Size */}
        <div className="space-y-2">
          <Label htmlFor="team-grootte">Teamgrootte</Label>
          <Select
            value={teamGrootte.toString()}
            onValueChange={handleTeamGrootteChange}
            disabled={disabled}
          >
            <SelectTrigger id="team-grootte" className="w-full">
              <SelectValue placeholder="Selecteer teamgrootte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 personen</SelectItem>
              <SelectItem value="3">3 personen</SelectItem>
              <SelectItem value="4">4 personen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Effective Hours */}
        <div className="space-y-2">
          <Label htmlFor="effectieve-uren" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Effectieve uren per dag
          </Label>
          <Input
            id="effectieve-uren"
            type="number"
            min={4}
            max={10}
            step={0.5}
            value={effectieveUrenPerDag}
            onChange={(e) => onEffectieveUrenChange(parseFloat(e.target.value))}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Standaard 7 uur (exclusief pauzes en reistijd)
          </p>
        </div>

        {/* Team Capacity Summary */}
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-sm font-medium">Team Capaciteit</p>
          <p className="text-2xl font-bold text-primary">
            {teamCapaciteitPerDag} uur/dag
          </p>
          <p className="text-xs text-muted-foreground">
            {teamGrootte} personen x {effectieveUrenPerDag} uur/dag
          </p>
        </div>

        {/* Team Members (Optional) */}
        <div className="space-y-2">
          <Label>Teamleden (optioneel)</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {teamleden.map((lid, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {lid}
                {!disabled && (
                  <button
                    onClick={() => handleRemoveTeamlid(index)}
                    className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    aria-label={`Verwijder ${lid}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
            {teamleden.length === 0 && (
              <span className="text-sm text-muted-foreground">
                Geen teamleden toegevoegd
              </span>
            )}
          </div>
          {teamleden.length < teamGrootte && !disabled && (
            <div className="flex gap-2">
              <Input
                placeholder="Naam teamlid"
                value={newTeamlid}
                onChange={(e) => setNewTeamlid(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleAddTeamlid}
                disabled={!newTeamlid.trim() || disabled}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {teamleden.length}/{teamGrootte} teamleden toegevoegd
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
