"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Plus,
  Search,
  Loader2,
  UsersRound,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useTeams } from "@/hooks/use-teams";
import { useMedewerkers } from "@/hooks/use-medewerkers";
import { TeamCard } from "@/components/medewerkers/team-card";
import { TeamForm, MemberManagementForm } from "@/components/medewerkers/team-form";
import { Id } from "../../../../../convex/_generated/dataModel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Team = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Medewerker = any;

export default function TeamsPage() {
  const {
    teams,
    isLoading: teamsLoading,
    create,
    update,
    remove,
    hardDelete,
    addLid,
    removeLid,
  } = useTeams();
  const { medewerkers, isLoading: medewerkersLoading } = useMedewerkers();

  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLoading = teamsLoading || medewerkersLoading;

  // Filter teams based on search and active status
  const displayedTeams = useMemo(() => {
    let filtered = teams as Team[];

    if (showOnlyActive) {
      filtered = filtered.filter((t) => t.isActief);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.naam.toLowerCase().includes(term) ||
          t.beschrijving?.toLowerCase().includes(term) ||
          t.medewerkersDetails.some((m: { naam: string }) =>
            m.naam.toLowerCase().includes(term)
          )
      );
    }

    return filtered;
  }, [teams, searchTerm, showOnlyActive]);

  // Handlers
  const handleCreate = useCallback(
    async (data: { naam: string; beschrijving: string; leden: Id<"medewerkers">[] }) => {
      setIsSubmitting(true);
      try {
        await create({
          naam: data.naam,
          beschrijving: data.beschrijving || undefined,
          leden: data.leden,
        });
        toast.success("Team aangemaakt");
        setShowCreateDialog(false);
      } catch (error) {
        toast.error("Fout bij aanmaken team");
        console.error(error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [create]
  );

  const handleEdit = useCallback((team: Team) => {
    setSelectedTeam(team);
    setShowEditDialog(true);
  }, []);

  const handleUpdate = useCallback(
    async (data: { naam: string; beschrijving: string; leden: Id<"medewerkers">[] }) => {
      if (!selectedTeam) return;

      setIsSubmitting(true);
      try {
        await update(selectedTeam._id, {
          naam: data.naam,
          beschrijving: data.beschrijving || undefined,
          leden: data.leden,
        });
        toast.success("Team bijgewerkt");
        setShowEditDialog(false);
        setSelectedTeam(null);
      } catch (error) {
        toast.error("Fout bij bijwerken team");
        console.error(error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedTeam, update]
  );

  const handleToggleActive = useCallback(
    async (team: Team) => {
      try {
        await update(team._id, { isActief: !team.isActief });
        toast.success(
          team.isActief ? "Team gedeactiveerd" : "Team geactiveerd"
        );
      } catch (error) {
        toast.error("Fout bij wijzigen status");
        console.error(error);
      }
    },
    [update]
  );

  const handleManageMembers = useCallback((team: Team) => {
    setSelectedTeam(team);
    setShowMembersDialog(true);
  }, []);

  const handleAddMember = useCallback(
    async (medewerkerId: Id<"medewerkers">) => {
      if (!selectedTeam) return;
      try {
        await addLid(selectedTeam._id, medewerkerId);
        toast.success("Lid toegevoegd");
      } catch (error) {
        toast.error("Fout bij toevoegen lid");
        console.error(error);
      }
    },
    [selectedTeam, addLid]
  );

  const handleRemoveMember = useCallback(
    async (medewerkerId: Id<"medewerkers">) => {
      if (!selectedTeam) return;
      try {
        await removeLid(selectedTeam._id, medewerkerId);
        toast.success("Lid verwijderd");
      } catch (error) {
        toast.error("Fout bij verwijderen lid");
        console.error(error);
      }
    },
    [selectedTeam, removeLid]
  );

  const handleDeleteClick = useCallback((team: Team) => {
    setSelectedTeam(team);
    setShowDeleteDialog(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selectedTeam) return;

    setIsSubmitting(true);
    try {
      await hardDelete(selectedTeam._id);
      toast.success("Team verwijderd");
      setShowDeleteDialog(false);
      setSelectedTeam(null);
    } catch (error) {
      toast.error("Fout bij verwijderen team");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedTeam, hardDelete]);

  // Loading state
  if (isLoading) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/medewerkers">Medewerkers</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Teams</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            </div>
            <p className="text-muted-foreground animate-pulse">Laden...</p>
          </motion.div>
        </div>
      </>
    );
  }

  const totalTeams = (teams as Team[]).length;
  const activeTeams = (teams as Team[]).filter((t) => t.isActief).length;
  const totalMembers = (teams as Team[]).reduce(
    (sum, t) => sum + t.leden.length,
    0
  );

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/medewerkers">Medewerkers</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Teams</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Teams
              </h1>
              <p className="text-muted-foreground">
                Beheer je werkteams en teamleden
              </p>
            </div>
          </div>

          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuw Team
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <UsersRound className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeTeams}</p>
                  <p className="text-sm text-muted-foreground">Actieve Teams</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalMembers}</p>
                  <p className="text-sm text-muted-foreground">
                    Teamleden Totaal
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <Users className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {totalTeams > 0
                      ? (totalMembers / activeTeams).toFixed(1)
                      : 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Gem. Teamgrootte
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Teams List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UsersRound className="h-5 w-5" />
                  Teamoverzicht
                </CardTitle>
                <CardDescription>
                  {activeTeams} actief{activeTeams !== 1 ? "e" : ""} team
                  {activeTeams !== 1 ? "s" : ""} van {totalTeams} totaal
                </CardDescription>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-active-teams"
                    checked={showOnlyActive}
                    onCheckedChange={setShowOnlyActive}
                  />
                  <Label
                    htmlFor="show-active-teams"
                    className="text-sm whitespace-nowrap"
                  >
                    Alleen actief
                  </Label>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Zoek teams..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {displayedTeams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <UsersRound className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">
                  {searchTerm
                    ? "Geen teams gevonden"
                    : showOnlyActive
                      ? "Geen actieve teams"
                      : "Nog geen teams"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {searchTerm
                    ? `Geen resultaten voor "${searchTerm}"`
                    : showOnlyActive
                      ? "Zet 'Alleen actief' uit om alle teams te zien."
                      : "Maak je eerste team aan om medewerkers te groeperen."}
                </p>
                {!searchTerm && !showOnlyActive && (
                  <Button
                    className="mt-4"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Team aanmaken
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {displayedTeams.map((team) => (
                    <TeamCard
                      key={team._id}
                      team={team}
                      onEdit={handleEdit}
                      onDelete={handleDeleteClick}
                      onAddMembers={handleManageMembers}
                      onToggleActive={handleToggleActive}
                      showStats={false}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Create Team Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nieuw Team</DialogTitle>
            <DialogDescription>
              Maak een nieuw team aan en voeg medewerkers toe.
            </DialogDescription>
          </DialogHeader>
          <TeamForm
            medewerkers={medewerkers as Medewerker[]}
            onSubmit={handleCreate}
            onCancel={() => setShowCreateDialog(false)}
            isSubmitting={isSubmitting}
            mode="create"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Team Bewerken</DialogTitle>
            <DialogDescription>
              Wijzig de gegevens van {selectedTeam?.naam}.
            </DialogDescription>
          </DialogHeader>
          {selectedTeam && (
            <TeamForm
              initialData={selectedTeam}
              medewerkers={medewerkers as Medewerker[]}
              onSubmit={handleUpdate}
              onCancel={() => {
                setShowEditDialog(false);
                setSelectedTeam(null);
              }}
              isSubmitting={isSubmitting}
              mode="edit"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teamleden Beheren</DialogTitle>
            <DialogDescription>
              Voeg teamleden toe of verwijder ze uit {selectedTeam?.naam}.
            </DialogDescription>
          </DialogHeader>
          {selectedTeam && (
            <MemberManagementForm
              team={selectedTeam}
              medewerkers={medewerkers as Medewerker[]}
              onAddMember={handleAddMember}
              onRemoveMember={handleRemoveMember}
              onClose={() => {
                setShowMembersDialog(false);
                setSelectedTeam(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Team Verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {selectedTeam?.naam} definitief wilt
              verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
