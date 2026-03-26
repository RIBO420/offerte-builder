"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Users,
  Truck,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Calendar,
} from "lucide-react";

export function VoormanDashboard() {
  const stats = useQuery(api.voormanDashboard.getVoormanStats);

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stats.projecten.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Calendar className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Geen projecten gepland voor vandaag</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dagplanning header */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Dagplanning — {new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
        </h3>

        {/* Project cards */}
        <div className="space-y-4">
          {stats.projecten.map((project) => (
            <Card key={project!.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{project!.naam}</CardTitle>
                    {project!.klantNaam && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {project!.klantNaam}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {project!.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Team */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Team ({project!.team.length})
                    </span>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {project!.team.map((lid) => (
                      <div
                        key={lid.id}
                        className="flex items-center justify-between rounded-md border px-2.5 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{lid.naam}</p>
                          {lid.functie && (
                            <p className="text-[10px] text-muted-foreground">{lid.functie}</p>
                          )}
                        </div>
                        {lid.heeftUren ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Voertuigen */}
                {project!.voertuigen.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                    {project!.voertuigen.map((v, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {v!.kenteken} — {v!.merk} {v!.model}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Open taken */}
                {project!.taken.open > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Taken ({project!.taken.open}/{project!.taken.totaal} open)
                      </span>
                    </div>
                    <div className="space-y-1">
                      {project!.taken.items.map((taak, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs rounded-md bg-muted/50 px-2.5 py-1.5"
                        >
                          <span>{taak.naam}</span>
                          <Badge
                            variant={taak.status === "gestart" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {taak.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Uren overzicht */}
      {stats.urenOverzicht.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Uren Overzicht Team</h3>
          <Card>
            <CardContent className="pt-4">
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {stats.urenOverzicht.map((mw) => (
                  <div
                    key={mw.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{mw.naam}</p>
                      <p className="text-[10px] text-muted-foreground">{mw.functie}</p>
                    </div>
                    <Badge
                      variant={mw.ingevuld ? "default" : "destructive"}
                      className="text-[10px] shrink-0"
                    >
                      {mw.ingevuld ? "Ingevuld" : "Niet ingevuld"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
