"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { m } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Search,
  Loader2,
  Shield,
  Eye,
  Link2,
  Link2Off,
  ShieldCheck,
  ShieldAlert,
  Crown,
  ClipboardList,
  HardHat,
  Wrench,
  UserRound,
  Handshake,
  Package,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useUsers, useIsAdmin, UserWithDetails, UserRole } from "@/hooks/use-users";
import { Id } from "../../../../convex/_generated/dataModel";

// Role display configuration — all 7 new roles + legacy backward compat
const roleConfig: Record<UserRole, { label: string; badgeClass: string; icon: React.ElementType }> = {
  directie: { label: "Directie / Admin", badgeClass: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800", icon: Crown },
  projectleider: { label: "Projectleider", badgeClass: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800", icon: ClipboardList },
  voorman: { label: "Voorman", badgeClass: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800", icon: HardHat },
  medewerker: { label: "Medewerker (veld)", badgeClass: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800", icon: Wrench },
  klant: { label: "Klant", badgeClass: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800", icon: UserRound },
  onderaannemer_zzp: { label: "Onderaannemer / ZZP", badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800", icon: Handshake },
  materiaalman: { label: "Materiaalman", badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800", icon: Package },
  // Legacy roles — still displayed correctly if present in DB
  admin: { label: "Admin (oud)", badgeClass: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800", icon: ShieldCheck },
  viewer: { label: "Viewer (oud)", badgeClass: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800", icon: Eye },
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
    },
  },
};

export default function GebruikersPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const { users, availableMedewerkers, isLoading, updateRole, linkToMedewerker, deleteUser } = useUsers();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [selectedMedewerkerId, setSelectedMedewerkerId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter users based on search (use debounced value) - MUST be before any conditional returns
  const displayedUsers = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return users;

    const term = debouncedSearchTerm.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        (user.linkedMedewerkerNaam?.toLowerCase().includes(term) ?? false)
    );
  }, [users, debouncedSearchTerm]);

  // Calculate stats grouped by function
  const stats = useMemo(() => {
    const beheer = users.filter(
      (u) => u.role === "directie" || u.role === "projectleider" || u.role === "admin"
    ).length;
    const veldwerk = users.filter(
      (u) =>
        u.role === "voorman" ||
        u.role === "medewerker" ||
        u.role === "onderaannemer_zzp" ||
        u.role === "materiaalman"
    ).length;
    const extern = users.filter(
      (u) => u.role === "klant" || u.role === "viewer"
    ).length;
    const linked = users.filter((u) => u.linkedMedewerkerId).length;

    return { beheer, veldwerk, extern, linked, total: users.length };
  }, [users]);

  // Handle role change
  const handleRoleChange = useCallback(
    async (userId: Id<"users">, newRole: UserRole) => {
      try {
        await updateRole(userId, newRole);
        toast.success("Rol bijgewerkt");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Fout bij bijwerken rol"
        );
      }
    },
    [updateRole]
  );

  // Handle opening link dialog
  const handleOpenLinkDialog = useCallback((user: UserWithDetails) => {
    setSelectedUser(user);
    setSelectedMedewerkerId(user.linkedMedewerkerId ?? "none");
    setShowLinkDialog(true);
  }, []);

  // Handle linking user to medewerker
  const handleLinkMedewerker = useCallback(async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      const medewerkerId =
        selectedMedewerkerId === "none"
          ? undefined
          : (selectedMedewerkerId as Id<"medewerkers">);

      await linkToMedewerker(selectedUser._id, medewerkerId);
      toast.success(
        medewerkerId
          ? "Gebruiker gekoppeld aan medewerker"
          : "Koppeling verwijderd"
      );
      setShowLinkDialog(false);
      setSelectedUser(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Fout bij koppelen"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedUser, selectedMedewerkerId, linkToMedewerker]);

  // Handle delete user
  const handleDeleteClick = useCallback((user: UserWithDetails) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedUser) return;
    setIsDeleting(true);
    try {
      await deleteUser(selectedUser._id);
      toast.success(`Gebruiker ${selectedUser.name} verwijderd uit systeem en Clerk`);
      setShowDeleteDialog(false);
      setSelectedUser(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Fout bij verwijderen gebruiker"
      );
    } finally {
      setIsDeleting(false);
    }
  }, [selectedUser, deleteUser]);

  // Redirect non-admins using useEffect (AFTER all hooks to follow React rules)
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push("/dashboard");
    }
  }, [isLoading, isAdmin, router]);

  // Show loading while checking permission or redirecting
  if (!isLoading && !isAdmin) {
    return null;
  }

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

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
                <BreadcrumbPage>Gebruikers</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <m.div
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
          </m.div>
        </div>
      </>
    );
  }

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
              <BreadcrumbPage>Gebruikers</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Page Header */}
        <m.div variants={itemVariants} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Gebruikersbeheer
              </h1>
              <p className="text-muted-foreground">
                Beheer gebruikers, rollen en koppelingen
              </p>
            </div>
          </div>
        </m.div>

        {/* Stats Cards */}
        <m.div variants={itemVariants} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Beheer</CardTitle>
              <Crown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.beheer}</div>
              <p className="text-xs text-muted-foreground">directie + projectleiders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Veldwerk</CardTitle>
              <HardHat className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.veldwerk}</div>
              <p className="text-xs text-muted-foreground">voorman, medewerkers, ZZP, materiaal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Extern</CardTitle>
              <UserRound className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.extern}</div>
              <p className="text-xs text-muted-foreground">klanten</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gekoppeld</CardTitle>
              <Link2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.linked}</div>
              <p className="text-xs text-muted-foreground">aan medewerker profiel</p>
            </CardContent>
          </Card>
        </m.div>

        {/* Users Table */}
        <m.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Gebruikerslijst
                  </CardTitle>
                  <CardDescription>
                    {displayedUsers.length} gebruiker
                    {displayedUsers.length !== 1 ? "s" : ""} weergegeven
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Zoek gebruikers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {displayedUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">
                    {searchTerm ? "Geen gebruikers gevonden" : "Nog geen gebruikers"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {searchTerm
                      ? `Geen resultaten voor "${searchTerm}"`
                      : "Er zijn nog geen gebruikers in het systeem."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naam</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Gekoppeld aan</TableHead>
                        <TableHead>Aangemaakt</TableHead>
                        <TableHead className="text-right">Acties</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedUsers.map((user) => {
                        const config = roleConfig[user.role] ?? roleConfig.medewerker;
                        const RoleIcon = config.icon;

                        return (
                          <TableRow key={user._id}>
                            <TableCell className="font-medium">
                              {user.name}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Select
                                value={user.role}
                                onValueChange={(value) =>
                                  handleRoleChange(user._id, value as UserRole)
                                }
                              >
                                <SelectTrigger className="w-full sm:w-[200px]">
                                  <SelectValue>
                                    <div className="flex items-center gap-2">
                                      <RoleIcon className="h-4 w-4" />
                                      <span>{config.label}</span>
                                    </div>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="directie">
                                    <div className="flex items-center gap-2">
                                      <Crown className="h-4 w-4 text-red-600" />
                                      <span>Directie / Admin</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="projectleider">
                                    <div className="flex items-center gap-2">
                                      <ClipboardList className="h-4 w-4 text-blue-600" />
                                      <span>Projectleider</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="voorman">
                                    <div className="flex items-center gap-2">
                                      <HardHat className="h-4 w-4 text-orange-600" />
                                      <span>Voorman</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="medewerker">
                                    <div className="flex items-center gap-2">
                                      <Wrench className="h-4 w-4 text-green-600" />
                                      <span>Medewerker (veld)</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="klant">
                                    <div className="flex items-center gap-2">
                                      <UserRound className="h-4 w-4 text-purple-600" />
                                      <span>Klant</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="onderaannemer_zzp">
                                    <div className="flex items-center gap-2">
                                      <Handshake className="h-4 w-4 text-yellow-600" />
                                      <span>Onderaannemer / ZZP</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="materiaalman">
                                    <div className="flex items-center gap-2">
                                      <Package className="h-4 w-4 text-cyan-600" />
                                      <span>Materiaalman</span>
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {user.linkedMedewerkerNaam ? (
                                <Badge variant="secondary" className="gap-1">
                                  <Link2 className="h-3 w-3" />
                                  {user.linkedMedewerkerNaam}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  Niet gekoppeld
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{formatDate(user.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenLinkDialog(user)}
                                  title={
                                    user.linkedMedewerkerId
                                      ? "Koppeling wijzigen"
                                      : "Koppelen aan medewerker"
                                  }
                                >
                                  {user.linkedMedewerkerId ? (
                                    <Link2 className="h-4 w-4" />
                                  ) : (
                                    <Link2Off className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(user)}
                                  title="Gebruiker verwijderen"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </m.div>

        {/* Info Card */}
        <m.div variants={itemVariants}>
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-5 w-5" />
                Over rollen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Directie / Admin:</strong> Volledige toegang tot alle functies, kan gebruikers, medewerkers en instellingen beheren.
              </p>
              <p>
                <strong className="text-foreground">Projectleider:</strong> Beheert projecten, offertes, klanten en planning. Leest rapportages.
              </p>
              <p>
                <strong className="text-foreground">Voorman:</strong> Beheert veldwerk: uren, toolbox meetings. Leest planning en projecten.
              </p>
              <p>
                <strong className="text-foreground">Medewerker (veld):</strong> Eigen uren, verlof, chat en toegewezen projecten (lezen).
              </p>
              <p>
                <strong className="text-foreground">Klant:</strong> Alleen-lezen toegang tot eigen offertes, facturen en projecten.
              </p>
              <p>
                <strong className="text-foreground">Onderaannemer / ZZP:</strong> Eigen uren en facturen, leest toegewezen projecten.
              </p>
              <p>
                <strong className="text-foreground">Materiaalman:</strong> Beheert voorraad en wagenpark, leest inkoop en projecten.
              </p>
            </CardContent>
          </Card>
        </m.div>
      </m.div>

      {/* Link to Medewerker Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Koppelen aan Medewerker</DialogTitle>
            <DialogDescription>
              Koppel {selectedUser?.name} aan een medewerker profiel. Gekoppelde
              gebruikers kunnen alleen hun eigen gegevens zien.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select
              value={selectedMedewerkerId}
              onValueChange={setSelectedMedewerkerId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer medewerker..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Geen koppeling</span>
                </SelectItem>
                {selectedUser?.linkedMedewerkerId && (
                  <SelectItem value={selectedUser.linkedMedewerkerId}>
                    {selectedUser.linkedMedewerkerNaam} (huidige)
                  </SelectItem>
                )}
                {availableMedewerkers.map((medewerker) => (
                  <SelectItem key={medewerker._id} value={medewerker._id}>
                    <div className="flex flex-col">
                      <span>{medewerker.naam}</span>
                      {medewerker.functie && (
                        <span className="text-xs text-muted-foreground">
                          {medewerker.functie}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLinkDialog(false)}
            >
              Annuleren
            </Button>
            <Button onClick={handleLinkMedewerker} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gebruiker verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je <strong>{selectedUser?.name}</strong> ({selectedUser?.email}) wilt verwijderen?
              Dit verwijdert de gebruiker uit het systeem én uit Clerk. Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
