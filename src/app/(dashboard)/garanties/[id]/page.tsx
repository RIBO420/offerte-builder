"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Calendar,
  User,
  FolderKanban,
  Wrench,
  Clock,
  FileText,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Id } from "../../../../../convex/_generated/dataModel";

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}-${month}-${year}`;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const prioriteitConfig: Record<string, { label: string; color: string }> = {
  laag: { label: "Laag", color: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  normaal: { label: "Normaal", color: "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  hoog: { label: "Hoog", color: "bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  urgent: { label: "Urgent", color: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  nieuw: { label: "Nieuw", color: "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  in_behandeling: { label: "In behandeling", color: "bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  ingepland: { label: "Ingepland", color: "bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  afgehandeld: { label: "Afgehandeld", color: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200" },
};

export default function GarantieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useCurrentUser();

  const garantie = useQuery(
    api.garanties.getById,
    user?._id ? { id: id as Id<"garanties"> } : "skip"
  );

  if (isUserLoading || garantie === undefined) {
    return null; // loading.tsx handles
  }

  if (!garantie) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <Shield className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Garantie niet gevonden</h2>
          <Button variant="outline" onClick={() => router.push("/garanties")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar overzicht
          </Button>
        </div>
      </>
    );
  }

  const days = daysUntil(garantie.eindDatum);
  const totalDays = Math.ceil(
    (new Date(garantie.eindDatum).getTime() -
      new Date(garantie.startDatum).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const elapsedDays = totalDays - days;
  const progressPercent =
    garantie.status === "verlopen"
      ? 100
      : Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

  return (
    <>
      <PageHeader
        customLabels={{
          [`/garanties/${id}`]: garantie.projectNaam,
        }}
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Back button + title */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/garanties")}
              aria-label="Terug naar garanties"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {garantie.projectNaam}
              </h1>
              <p className="text-muted-foreground">
                Garantie voor {garantie.klantNaam}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  `/servicemeldingen?garantieId=${id}`
                )
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Nieuwe melding
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column — 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Garantie period card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Garantieperiode
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span>{formatDate(garantie.startDatum)}</span>
                  <span>{formatDate(garantie.eindDatum)}</span>
                </div>
                {/* Progress bar */}
                <div className="relative h-4 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all ${
                      garantie.status === "verlopen"
                        ? "bg-red-500"
                        : days <= 30
                        ? "bg-red-500"
                        : days <= 180
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {garantie.garantiePeriodeInMaanden} maanden garantie
                  </span>
                  <span>
                    {garantie.status === "verlopen"
                      ? "Verlopen"
                      : days > 0
                      ? `${days} dagen resterend`
                      : "Verloopt vandaag"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Voorwaarden */}
            {garantie.voorwaarden && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Voorwaarden
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {garantie.voorwaarden}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Servicemeldingen */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Servicemeldingen
                  </CardTitle>
                  <CardDescription>
                    {garantie.meldingen.length} melding(en) gekoppeld aan deze
                    garantie
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/servicemeldingen?garantieId=${id}`
                    )
                  }
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Melding
                </Button>
              </CardHeader>
              <CardContent>
                {garantie.meldingen.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <Wrench className="h-8 w-8 mb-2" />
                    <p className="text-sm">
                      Geen servicemeldingen voor deze garantie
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Beschrijving</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Prioriteit</TableHead>
                        <TableHead>Datum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {garantie.meldingen.map((m) => (
                        <TableRow
                          key={m._id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            router.push(`/servicemeldingen/${m._id}`)
                          }
                        >
                          <TableCell className="font-medium max-w-xs truncate">
                            {m.beschrijving}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                statusConfig[m.status]?.color ?? ""
                              }
                            >
                              {statusConfig[m.status]?.label ?? m.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                prioriteitConfig[m.prioriteit]?.color ?? ""
                              }
                            >
                              {prioriteitConfig[m.prioriteit]?.label ??
                                m.prioriteit}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(m.createdAt).toLocaleDateString("nl-NL")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column — 1/3 */}
          <div className="space-y-6">
            {/* Countdown */}
            <Card
              className={`border-2 ${
                garantie.status === "verlopen"
                  ? "border-red-200 dark:border-red-800"
                  : days <= 30
                  ? "border-red-200 dark:border-red-800"
                  : days <= 180
                  ? "border-yellow-200 dark:border-yellow-800"
                  : "border-green-200 dark:border-green-800"
              }`}
            >
              <CardContent className="pt-6 text-center">
                {garantie.status === "verlopen" ? (
                  <>
                    <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-red-600">Verlopen</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Garantie is verlopen
                    </p>
                  </>
                ) : (
                  <>
                    <ShieldCheck
                      className={`h-12 w-12 mx-auto mb-2 ${
                        days <= 30
                          ? "text-red-500"
                          : days <= 180
                          ? "text-yellow-500"
                          : "text-green-500"
                      }`}
                    />
                    <p className="text-3xl font-bold">{days}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      dagen resterend
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Project info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <FolderKanban className="h-4 w-4" />
                  Project
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium">{garantie.projectNaam}</p>
                <Badge variant="outline">{garantie.projectStatus}</Badge>
                <Link
                  href={`/projecten/${garantie.projectId}`}
                  className="block text-sm text-primary hover:underline mt-2"
                >
                  Naar project →
                </Link>
              </CardContent>
            </Card>

            {/* Klant info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4" />
                  Klant
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{garantie.klantNaam}</p>
                {garantie.klantAdres && (
                  <p className="text-muted-foreground">{garantie.klantAdres}</p>
                )}
                {garantie.klantEmail && (
                  <p className="text-muted-foreground">{garantie.klantEmail}</p>
                )}
                {garantie.klantTelefoon && (
                  <p className="text-muted-foreground">
                    {garantie.klantTelefoon}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Notities */}
            {garantie.notities && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    Notities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {garantie.notities}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
