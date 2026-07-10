"use client";

/**
 * "Wie is achter"-widget (PRD §2.6) — kantoor. Twee lijsten voor één dag:
 * - achterstanden: gepland bezoek zonder enige urenlog die dag;
 * - afwijkingen: wel gelogd, maar boven de instelbare drempel
 *   (>15 min of >20% — PRD-aanname, bevestiging Mickey §7.1).
 * Dit bewaakt de volledigheid waarop de facturatie-engine (§2.8) draait:
 * wat niet gelogd is, wordt niet gefactureerd.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  UserX,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function vandaagIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function schuifDag(datum: string, dagen: number): string {
  const d = new Date(`${datum}T00:00:00`);
  d.setDate(d.getDate() + dagen);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WieIsAchterWidget() {
  const [datum, setDatum] = useState(vandaagIso());
  const data = useQuery(api.urenSegmenten.getWieIsAchter, { datum });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Wie is achter</CardTitle>
            <CardDescription>
              Niet-gelogde bezoeken en afwijkingen boven de drempel
              {data
                ? ` (>${data.drempels.minuten} min of >${data.drempels.procent}%)`
                : ""}
              . Wat niet gelogd is, wordt niet gefactureerd.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDatum((d) => schuifDag(d, -1))}
              aria-label="Vorige dag"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{datum}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDatum((d) => schuifDag(d, 1))}
              aria-label="Volgende dag"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {data === undefined ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : data.achterstanden.length === 0 && data.afwijkingen.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Alles gelogd binnen de drempels voor deze dag.
          </p>
        ) : (
          <>
            {data.achterstanden.length > 0 && (
              <div>
                <h3 className="mb-1 flex items-center gap-1 text-sm font-semibold">
                  <UserX className="h-4 w-4 text-destructive" aria-hidden />
                  Achterstanden ({data.achterstanden.length})
                </h3>
                <ul className="flex flex-col gap-1">
                  {data.achterstanden.map((item) => (
                    <li
                      key={item.werkitemId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                    >
                      <span>
                        {item.klantNaam ?? item.naam}
                        {item.teamNaam && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            team {item.teamNaam}
                          </span>
                        )}
                      </span>
                      <Badge variant="destructive">niets gelogd</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.afwijkingen.length > 0 && (
              <div>
                <h3 className="mb-1 flex items-center gap-1 text-sm font-semibold">
                  <Clock className="h-4 w-4 text-orange-600" aria-hidden />
                  Afwijkingen ({data.afwijkingen.length})
                </h3>
                <ul className="flex flex-col gap-1">
                  {data.afwijkingen.map((item) => (
                    <li
                      key={item.werkitemId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                    >
                      <span>
                        {item.klantNaam ?? item.naam}
                        {item.teamNaam && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            team {item.teamNaam}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.gelogdeMinuten} van {item.geplandeMinuten} min (
                        {item.verschilProcent}% verschil)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Meerwerk-beoordeling (PRD §2.6) — kantoor/planning keurt veld-verzoeken:
 * tijd erbij (cascade schuift door) of als nieuwe opdracht in de bak.
 */
export function MeerwerkBeoordeling() {
  const verzoeken = useQuery(api.meerwerk.listVoorBeoordeling, {});
  const keurGoed = useMutation(api.meerwerk.keurGoed);
  const wijsAf = useMutation(api.meerwerk.wijsAf);

  const handleBesluit = async (
    id: (typeof verzoeken extends (infer T)[] | undefined ? T : never)["_id"],
    besluit: "tijd_erbij" | "nieuwe_opdracht" | "afwijzen"
  ) => {
    try {
      if (besluit === "afwijzen") {
        await wijsAf({ id });
        toast.success("Meerwerk-verzoek afgewezen");
      } else {
        await keurGoed({ id, besluit });
        toast.success(
          besluit === "tijd_erbij"
            ? "Goedgekeurd — tijd erbij, de dagkaart-cascade schuift door"
            : "Goedgekeurd — als nieuwe opdracht in de bak gezet"
        );
      }
    } catch (fout) {
      toast.error(fout instanceof Error ? fout.message : "Beoordelen is mislukt");
    }
  };

  if (verzoeken === undefined || verzoeken.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-orange-600" aria-hidden />
          Meerwerk-verzoeken uit het veld ({verzoeken.length})
        </CardTitle>
        <CardDescription>
          Meerwerk kan alleen ná akkoord van planning: tijd erbij (cascade
          schuift door) of als nieuwe opdracht in de bak.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {verzoeken.map((verzoek) => (
          <div
            key={verzoek._id}
            className="flex flex-col gap-2 rounded-md border p-2 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{verzoek.omschrijving}</span>
              <Badge variant="outline">
                ±{verzoek.geschatteMinuten ?? 0} min
              </Badge>
              <span className="text-xs text-muted-foreground">
                {verzoek.klantNaam ?? verzoek.werkitemNaam} — aangevraagd door{" "}
                {verzoek.aangevraagdDoorNaam ?? "veld"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => handleBesluit(verzoek._id, "tijd_erbij")}
              >
                Tijd erbij
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleBesluit(verzoek._id, "nieuwe_opdracht")}
              >
                Nieuwe opdracht in de bak
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleBesluit(verzoek._id, "afwijzen")}
              >
                Afwijzen
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
