"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Clock,
  Award,
  GraduationCap,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Euro,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Skill,
  AVAILABLE_SKILLS,
  SKILL_LEVELS,
} from "./skills-selector";
import {
  Certificaat,
  getCertificaatStatus,
} from "./certificaat-form";
import { Id } from "../../../convex/_generated/dataModel";

// Extended medewerker type with new fields
export interface MedewerkerExtended {
  _id: Id<"medewerkers">;
  naam: string;
  email?: string;
  telefoon?: string;
  functie?: string;
  uurtarief?: number;
  isActief: boolean;
  notities?: string;
  createdAt: number;
  updatedAt: number;
  // New fields
  contractType?: "fulltime" | "parttime" | "oproep" | "zzp";
  beschikbaarheid?: {
    werkdagen: string[]; // ["ma", "di", "wo", "do", "vr"]
    urenPerWeek?: number;
  };
  vaardigheden?: Skill[];
  certificaten?: Certificaat[];
  // Computed/linked data (for display)
  recenteProjecten?: Array<{
    id: string;
    naam: string;
    uren: number;
    datum: string;
  }>;
  totaalUren?: number;
  maandUren?: number;
}

interface MedewerkerDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medewerker: MedewerkerExtended | null;
}

const CONTRACT_TYPES = {
  fulltime: { label: "Fulltime", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
  parttime: { label: "Parttime", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  oproep: { label: "Oproepkracht", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300" },
  zzp: { label: "ZZP", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" },
};

const WERKDAGEN = [
  { key: "ma", label: "Ma" },
  { key: "di", label: "Di" },
  { key: "wo", label: "Wo" },
  { key: "do", label: "Do" },
  { key: "vr", label: "Vr" },
  { key: "za", label: "Za" },
  { key: "zo", label: "Zo" },
];

export function MedewerkerDetailDialog({
  open,
  onOpenChange,
  medewerker,
}: MedewerkerDetailDialogProps) {
  if (!medewerker) return null;

  const vaardigheden = medewerker.vaardigheden || [];
  const certificaten = medewerker.certificaten || [];
  const beschikbaarheid = medewerker.beschikbaarheid;
  const recenteProjecten = medewerker.recenteProjecten || [];

  // Calculate expired/expiring certificates
  const expiredCerts = certificaten.filter(
    (c) => getCertificaatStatus(c.vervalDatum).status === "expired"
  );
  const expiringCerts = certificaten.filter(
    (c) => getCertificaatStatus(c.vervalDatum).status === "expiring"
  );

  const getSkillLabel = (skillId: string) => {
    return AVAILABLE_SKILLS.find((s) => s.id === skillId)?.label || skillId;
  };

  const getLevelProgress = (level: string) => {
    switch (level) {
      case "junior":
        return 33;
      case "medior":
        return 66;
      case "senior":
        return 100;
      default:
        return 50;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl flex items-center gap-2">
                {medewerker.naam}
                <Badge
                  variant={medewerker.isActief ? "default" : "secondary"}
                  className="ml-2"
                >
                  {medewerker.isActief ? "Actief" : "Inactief"}
                </Badge>
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                {medewerker.functie && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    {medewerker.functie}
                  </span>
                )}
                {medewerker.contractType && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      CONTRACT_TYPES[medewerker.contractType].color
                    )}
                  >
                    {CONTRACT_TYPES[medewerker.contractType].label}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="profiel" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="profiel">Profiel</TabsTrigger>
            <TabsTrigger value="vaardigheden">
              Vaardigheden
              {vaardigheden.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">
                  {vaardigheden.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="certificaten">
              Certificaten
              {(expiredCerts.length > 0 || expiringCerts.length > 0) && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-1.5 text-xs",
                    expiredCerts.length > 0
                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
                  )}
                >
                  <AlertTriangle className="h-3 w-3" />
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="prestaties">Prestaties</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-4">
            {/* Profiel Tab */}
            <TabsContent value="profiel" className="mt-0 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Contact Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Contactgegevens
                  </h3>
                  <div className="grid gap-3">
                    {medewerker.email && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="text-sm">{medewerker.email}</span>
                      </div>
                    )}
                    {medewerker.telefoon && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="text-sm">{medewerker.telefoon}</span>
                      </div>
                    )}
                    {medewerker.uurtarief && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Euro className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="text-sm">
                          EUR {medewerker.uurtarief.toFixed(2)} / uur
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Beschikbaarheid */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Beschikbaarheid
                  </h3>
                  {beschikbaarheid ? (
                    <div className="space-y-3">
                      <div className="flex gap-1">
                        {WERKDAGEN.map((dag) => (
                          <div
                            key={dag.key}
                            className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors",
                              beschikbaarheid.werkdagen?.includes(dag.key)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {dag.label}
                          </div>
                        ))}
                      </div>
                      {beschikbaarheid.urenPerWeek && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{beschikbaarheid.urenPerWeek} uur per week</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Geen beschikbaarheid ingesteld
                    </p>
                  )}
                </div>

                {medewerker.notities && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Notities
                      </h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {medewerker.notities}
                      </p>
                    </div>
                  </>
                )}

                <Separator />

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    Toegevoegd:{" "}
                    {format(new Date(medewerker.createdAt), "d MMMM yyyy", {
                      locale: nl,
                    })}
                  </span>
                  <span>
                    Laatst bijgewerkt:{" "}
                    {format(new Date(medewerker.updatedAt), "d MMMM yyyy", {
                      locale: nl,
                    })}
                  </span>
                </div>
              </motion.div>
            </TabsContent>

            {/* Vaardigheden Tab */}
            <TabsContent value="vaardigheden" className="mt-0 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {vaardigheden.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">
                      Geen vaardigheden toegevoegd
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      Voeg vaardigheden toe bij het bewerken van deze medewerker
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {vaardigheden.map((skill) => {
                      const levelConfig = SKILL_LEVELS.find(
                        (l) => l.value === skill.level
                      );
                      return (
                        <div
                          key={skill.id}
                          className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">
                                {getSkillLabel(skill.id)}
                              </span>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-xs",
                                  levelConfig?.color
                                )}
                              >
                                {levelConfig?.label}
                              </Badge>
                            </div>
                            <Progress
                              value={getLevelProgress(skill.level)}
                              className="h-2"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </TabsContent>

            {/* Certificaten Tab */}
            <TabsContent value="certificaten" className="mt-0 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Warning banner for expired certificates */}
                {expiredCerts.length > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <div>
                      <p className="font-medium text-sm text-red-800 dark:text-red-300">
                        {expiredCerts.length} certificaat
                        {expiredCerts.length > 1 ? "en" : ""} verlopen
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {expiredCerts.map((c) => c.naam).join(", ")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Warning banner for expiring certificates */}
                {expiringCerts.length > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-medium text-sm text-amber-800 dark:text-amber-300">
                        {expiringCerts.length} certificaat
                        {expiringCerts.length > 1 ? "en" : ""} bijna verlopen
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {expiringCerts.map((c) => c.naam).join(", ")}
                      </p>
                    </div>
                  </div>
                )}

                {certificaten.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Award className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">
                      Geen certificaten toegevoegd
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      Voeg certificaten toe bij het bewerken van deze medewerker
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {certificaten.map((cert) => {
                      const status = getCertificaatStatus(cert.vervalDatum);
                      return (
                        <div
                          key={cert.id}
                          className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg"
                        >
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Award className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {cert.naam}
                              </span>
                              <Badge
                                variant="secondary"
                                className={cn("text-xs", status.className)}
                              >
                                {status.status === "expired" && (
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                )}
                                {status.status === "expiring" && (
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                )}
                                {status.status === "valid" && (
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                )}
                                {status.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3" />
                              <span>
                                Uitgegeven:{" "}
                                {format(
                                  new Date(cert.uitgifteDatum),
                                  "d MMM yyyy",
                                  { locale: nl }
                                )}
                              </span>
                              {cert.vervalDatum && (
                                <>
                                  <span>-</span>
                                  <span>
                                    Vervalt:{" "}
                                    {format(
                                      new Date(cert.vervalDatum),
                                      "d MMM yyyy",
                                      { locale: nl }
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </TabsContent>

            {/* Prestaties Tab */}
            <TabsContent value="prestaties" className="mt-0 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Clock className="h-4 w-4" />
                      Uren deze maand
                    </div>
                    <div className="text-2xl font-bold">
                      {medewerker.maandUren || 0}
                    </div>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      Totaal uren
                    </div>
                    <div className="text-2xl font-bold">
                      {medewerker.totaalUren || 0}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Recent Projects */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Recente Projecten
                  </h3>
                  {recenteProjecten.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Star className="h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Nog geen projecten
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recenteProjecten.map((project) => (
                        <div
                          key={project.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                        >
                          <div>
                            <span className="font-medium text-sm">
                              {project.naam}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {project.datum}
                            </span>
                          </div>
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            {project.uren} uur
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
