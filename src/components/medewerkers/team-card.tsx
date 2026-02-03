"use client";

import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  MoreVertical,
  Pencil,
  Trash2,
  UserPlus,
  Clock,
  UserCheck,
  UserX,
} from "lucide-react";
import { Doc } from "../../../convex/_generated/dataModel";

// Type for team with medewerker details returned by listWithMedewerkers
type TeamWithMedewerkers = Doc<"teams"> & {
  medewerkersDetails: Doc<"medewerkers">[];
};

interface TeamCardProps {
  team: TeamWithMedewerkers;
  onEdit?: (team: TeamWithMedewerkers) => void;
  onDelete?: (team: TeamWithMedewerkers) => void;
  onAddMembers?: (team: TeamWithMedewerkers) => void;
  onToggleActive?: (team: TeamWithMedewerkers) => void;
  showStats?: boolean;
  totalUren?: number;
}

export function TeamCard({
  team,
  onEdit,
  onDelete,
  onAddMembers,
  onToggleActive,
  showStats = false,
  totalUren = 0,
}: TeamCardProps) {
  const activeMedewerkers = team.medewerkersDetails.filter((m) => m.isActief);
  const initials = team.naam
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={!team.isActief ? "opacity-60" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {team.naam}
                  {!team.isActief && (
                    <Badge variant="secondary" className="text-xs">
                      Inactief
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-sm">
                  {team.beschrijving || `${team.leden.length} teamleden`}
                </CardDescription>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" aria-label="Meer opties">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(team)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Bewerken
                  </DropdownMenuItem>
                )}
                {onAddMembers && (
                  <DropdownMenuItem onClick={() => onAddMembers(team)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Leden beheren
                  </DropdownMenuItem>
                )}
                {onToggleActive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onToggleActive(team)}>
                      {team.isActief ? (
                        <>
                          <UserX className="mr-2 h-4 w-4" />
                          Deactiveren
                        </>
                      ) : (
                        <>
                          <UserCheck className="mr-2 h-4 w-4" />
                          Activeren
                        </>
                      )}
                    </DropdownMenuItem>
                  </>
                )}
                {onDelete && !team.isActief && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(team)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Verwijderen
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Team Members */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Teamleden</span>
              <span>
                {activeMedewerkers.length} actief / {team.leden.length} totaal
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {team.medewerkersDetails.slice(0, 6).map((medewerker) => (
                <div
                  key={medewerker._id}
                  className="flex items-center gap-2 rounded-full bg-muted px-3 py-1"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {medewerker.naam
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={`text-sm ${!medewerker.isActief ? "text-muted-foreground line-through" : ""}`}
                  >
                    {medewerker.naam.split(" ")[0]}
                  </span>
                  {medewerker.functie && (
                    <Badge variant="outline" className="text-xs py-0 h-5">
                      {medewerker.functie}
                    </Badge>
                  )}
                </div>
              ))}
              {team.medewerkersDetails.length > 6 && (
                <div className="flex items-center justify-center rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                  +{team.medewerkersDetails.length - 6} meer
                </div>
              )}
              {team.medewerkersDetails.length === 0 && (
                <div className="flex items-center justify-center rounded-lg border border-dashed py-4 px-6 text-sm text-muted-foreground w-full">
                  Geen teamleden
                </div>
              )}
            </div>
          </div>

          {/* Stats (optional) */}
          {showStats && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Actief</span>
                </div>
                <p className="text-lg font-semibold">{activeMedewerkers.length}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Uren</span>
                </div>
                <p className="text-lg font-semibold">{totalUren.toFixed(1)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Compact version for lists
export function TeamCardCompact({
  team,
  onClick,
}: {
  team: TeamWithMedewerkers;
  onClick?: () => void;
}) {
  const activeMedewerkers = team.medewerkersDetails.filter((m) => m.isActief);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors ${
        !team.isActief ? "opacity-60" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h4 className="font-medium flex items-center gap-2">
            {team.naam}
            {!team.isActief && (
              <Badge variant="secondary" className="text-xs">
                Inactief
              </Badge>
            )}
          </h4>
          <p className="text-sm text-muted-foreground">
            {activeMedewerkers.length} actief van {team.leden.length} leden
          </p>
        </div>
      </div>

      {/* Member avatars preview */}
      <div className="flex -space-x-2">
        {team.medewerkersDetails.slice(0, 4).map((medewerker) => (
          <Avatar key={medewerker._id} className="h-8 w-8 border-2 border-background">
            <AvatarFallback className="text-xs">
              {medewerker.naam
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        ))}
        {team.medewerkersDetails.length > 4 && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted border-2 border-background text-xs text-muted-foreground">
            +{team.medewerkersDetails.length - 4}
          </div>
        )}
      </div>
    </motion.div>
  );
}
