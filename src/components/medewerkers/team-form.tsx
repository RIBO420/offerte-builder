"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Search,
  Loader2,
  Users,
  UserPlus,
  X,
  Check,
  UserCheck,
  UserX,
} from "lucide-react";
import { Id, Doc } from "../../../convex/_generated/dataModel";

// Type for medewerker - using Doc for full type safety
type Medewerker = Doc<"medewerkers">;

// Type for team (basic, without medewerker details)
type Team = Doc<"teams">;

interface TeamFormData {
  naam: string;
  beschrijving: string;
  leden: Id<"medewerkers">[];
}

// Zod schema for team form
const teamFormSchema = z.object({
  naam: z.string().min(1, "Teamnaam is verplicht"),
  beschrijving: z.string().optional(),
  leden: z.array(z.string()),
});

type TeamFormSchemaData = z.infer<typeof teamFormSchema>;

interface TeamFormProps {
  initialData?: Partial<Team>;
  medewerkers: Medewerker[];
  onSubmit: (data: TeamFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
}

export function TeamForm({
  initialData,
  medewerkers,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = "create",
}: TeamFormProps) {
  const form = useForm<TeamFormSchemaData>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
      naam: initialData?.naam || "",
      beschrijving: initialData?.beschrijving || "",
      leden: (initialData?.leden as string[]) || [],
    },
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  const ledenValue = form.watch("leden");

  // Filter medewerkers based on search and active status
  const filteredMedewerkers = useMemo(() => {
    let filtered = medewerkers;

    if (showOnlyActive) {
      filtered = filtered.filter((m) => m.isActief);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.naam.toLowerCase().includes(term) ||
          m.email?.toLowerCase().includes(term) ||
          m.functie?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [medewerkers, searchTerm, showOnlyActive]);

  // Selected medewerkers with full details
  const selectedMedewerkers = useMemo(() => {
    return ledenValue
      .map((id) => medewerkers.find((m) => m._id === id))
      .filter((m): m is Medewerker => m !== undefined);
  }, [ledenValue, medewerkers]);

  const toggleMedewerker = (medewerkerId: Id<"medewerkers">) => {
    const currentLeden = form.getValues("leden");
    const newLeden = currentLeden.includes(medewerkerId)
      ? currentLeden.filter((id) => id !== medewerkerId)
      : [...currentLeden, medewerkerId];
    form.setValue("leden", newLeden);
  };

  const handleFormSubmit = async (data: TeamFormSchemaData) => {
    if (!data.naam.trim()) return;
    await onSubmit({
      naam: data.naam,
      beschrijving: data.beschrijving || "",
      leden: data.leden as Id<"medewerkers">[],
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="naam"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teamnaam *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="bijv. Aanleg Team 1"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="beschrijving"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Beschrijving</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Optionele beschrijving van het team..."
                    rows={2}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Member Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <FormLabel className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Teamleden
              <Badge variant="secondary">{ledenValue.length}</Badge>
            </FormLabel>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowOnlyActive(!showOnlyActive)}
              className="text-xs"
            >
              {showOnlyActive ? (
                <>
                  <UserCheck className="mr-1 h-3 w-3" />
                  Alleen actief
                </>
              ) : (
                <>
                  <Users className="mr-1 h-3 w-3" />
                  Alle medewerkers
                </>
              )}
            </Button>
          </div>

          {/* Selected members preview */}
          {selectedMedewerkers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <AnimatePresence mode="popLayout">
                {selectedMedewerkers.map((medewerker) => (
                  <motion.div
                    key={medewerker._id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2 py-1"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px]">
                        {medewerker.naam
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{medewerker.naam.split(" ")[0]}</span>
                    <button
                      type="button"
                      onClick={() => toggleMedewerker(medewerker._id)}
                      className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek medewerkers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Medewerker list */}
          <ScrollArea className="h-[200px] rounded-md border">
            <div className="p-2 space-y-1">
              {filteredMedewerkers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {searchTerm
                      ? "Geen medewerkers gevonden"
                      : "Geen medewerkers beschikbaar"}
                  </p>
                </div>
              ) : (
                filteredMedewerkers.map((medewerker) => {
                  const isSelected = ledenValue.includes(medewerker._id);
                  return (
                    <motion.div
                      key={medewerker._id}
                      initial={false}
                      animate={{
                        backgroundColor: isSelected
                          ? "hsl(var(--primary) / 0.1)"
                          : "transparent",
                      }}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                        !medewerker.isActief ? "opacity-60" : ""
                      }`}
                      onClick={() => toggleMedewerker(medewerker._id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleMedewerker(medewerker._id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {medewerker.naam
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" title={medewerker.naam}>
                          {medewerker.naam}
                        </p>
                        <p className="text-xs text-muted-foreground truncate" title={medewerker.functie || medewerker.email || undefined}>
                          {medewerker.functie || medewerker.email || "-"}
                        </p>
                      </div>
                      {!medewerker.isActief && (
                        <Badge variant="secondary" className="text-xs">
                          Inactief
                        </Badge>
                      )}
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuleren
          </Button>
          <Button type="submit" disabled={isSubmitting || !form.watch("naam").trim()}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Team Aanmaken
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Opslaan
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Simplified member management form (for adding/removing members from existing team)
interface MemberManagementFormProps {
  team: Team;
  medewerkers: Medewerker[];
  onAddMember: (medewerkerId: Id<"medewerkers">) => Promise<void>;
  onRemoveMember: (medewerkerId: Id<"medewerkers">) => Promise<void>;
  onClose: () => void;
}

export function MemberManagementForm({
  team,
  medewerkers,
  onAddMember,
  onRemoveMember,
  onClose,
}: MemberManagementFormProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingMember, setLoadingMember] = useState<string | null>(null);

  const filteredMedewerkers = useMemo(() => {
    const activeMedewerkers = medewerkers.filter((m) => m.isActief);
    if (!searchTerm.trim()) return activeMedewerkers;

    const term = searchTerm.toLowerCase();
    return activeMedewerkers.filter(
      (m) =>
        m.naam.toLowerCase().includes(term) ||
        m.email?.toLowerCase().includes(term) ||
        m.functie?.toLowerCase().includes(term)
    );
  }, [medewerkers, searchTerm]);

  const handleToggle = async (medewerker: Medewerker) => {
    const isMember = team.leden.includes(medewerker._id);
    setLoadingMember(medewerker._id);
    try {
      if (isMember) {
        await onRemoveMember(medewerker._id);
      } else {
        await onAddMember(medewerker._id);
      }
    } finally {
      setLoadingMember(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>
          {team.leden.length} {team.leden.length === 1 ? "lid" : "leden"} in{" "}
          {team.naam}
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Zoek medewerkers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[300px] rounded-md border">
        <div className="p-2 space-y-1">
          {filteredMedewerkers.map((medewerker) => {
            const isMember = team.leden.includes(medewerker._id);
            const isLoading = loadingMember === medewerker._id;

            return (
              <div
                key={medewerker._id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  isMember
                    ? "bg-primary/5 border-primary/20"
                    : "bg-background border-transparent hover:border-border"
                } transition-colors`}
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback>
                    {medewerker.naam
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{medewerker.naam}</p>
                  <p className="text-xs text-muted-foreground">
                    {medewerker.functie || medewerker.email || "-"}
                  </p>
                </div>
                <Button
                  variant={isMember ? "secondary" : "outline"}
                  size="sm"
                  disabled={isLoading}
                  onClick={() => handleToggle(medewerker)}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isMember ? (
                    <>
                      <UserX className="mr-1 h-3 w-3" />
                      Verwijderen
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-1 h-3 w-3" />
                      Toevoegen
                    </>
                  )}
                </Button>
              </div>
            );
          })}

          {filteredMedewerkers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchTerm
                  ? "Geen medewerkers gevonden"
                  : "Geen actieve medewerkers beschikbaar"}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex justify-end pt-2">
        <Button variant="outline" onClick={onClose}>
          Sluiten
        </Button>
      </div>
    </div>
  );
}
