"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArchiveRestore, FileText, FolderKanban, User, Inbox } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

interface HerstelRijProps {
  icon: React.ReactNode;
  titel: string;
  subtitel: string;
  onHerstel: () => Promise<void>;
}

function HerstelRij({ icon, titel, subtitel, onHerstel }: HerstelRijProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      await onHerstel();
      toast.success("Hersteld");
    } catch {
      toast.error("Herstellen mislukt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="text-muted-foreground shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{titel}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitel}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={busy}
        aria-label={`${titel} herstellen`}
      >
        <ArchiveRestore className="mr-2 h-4 w-4" />
        Herstellen
      </Button>
    </div>
  );
}

/**
 * §5.2: Herstel-sectie voor gearchiveerde items.
 * Toont recent gearchiveerde offertes, projecten, klanten en leads
 * met een herstel-knop per item. Hard delete blijft alleen bereikbaar
 * via de bestaande GDPR-flow.
 */
export function GearchiveerdeItems() {
  const { user } = useCurrentUser();
  const skip = user?._id ? {} : ("skip" as const);

  const deletedItems = useQuery(api.softDelete.getDeletedItems, skip);
  const archivedKlanten = useQuery(api.klanten.listArchived, skip);
  const archivedLeads = useQuery(api.configuratorAanvragen.listArchived, skip);

  const restoreOfferte = useMutation(api.offertes.restore);
  const restoreProject = useMutation(api.projecten.restore);
  const restoreKlant = useMutation(api.klanten.restoreArchived);
  const restoreLead = useMutation(api.configuratorAanvragen.herstelGearchiveerd);

  const offertes = deletedItems?.offertes ?? [];
  const projecten = deletedItems?.projecten ?? [];
  const klanten = archivedKlanten ?? [];
  const leads = archivedLeads ?? [];

  const totaal =
    offertes.length + projecten.length + klanten.length + leads.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ArchiveRestore className="h-4 w-4" />
          Recent gearchiveerd
          <Badge variant="secondary">{totaal}</Badge>
        </CardTitle>
        <CardDescription>
          Gearchiveerde offertes, projecten, klanten en leads. Offertes en
          projecten worden na 30 dagen definitief opgeruimd; klanten en leads
          blijven bewaard tot ze worden hersteld.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {totaal === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Inbox className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Geen gearchiveerde items
            </p>
          </div>
        )}

        {offertes.map((o) => (
          <HerstelRij
            key={o._id}
            icon={<FileText className="h-4 w-4" />}
            titel={`Offerte ${o.offerteNummer} — ${o.klantNaam}`}
            subtitel={`Gearchiveerd op ${formatDate(o.deletedAt)} · nog ${Math.max(o.daysUntilPermanentDelete, 0)} dagen te herstellen`}
            onHerstel={async () => {
              await restoreOfferte({ id: o._id as Id<"offertes"> });
            }}
          />
        ))}

        {projecten.map((p) => (
          <HerstelRij
            key={p._id}
            icon={<FolderKanban className="h-4 w-4" />}
            titel={`Project ${p.naam} — ${p.klantNaam}`}
            subtitel={`Gearchiveerd op ${formatDate(p.deletedAt)} · nog ${Math.max(p.daysUntilPermanentDelete, 0)} dagen te herstellen`}
            onHerstel={async () => {
              await restoreProject({ id: p._id as Id<"projecten"> });
            }}
          />
        ))}

        {klanten.map((k) => (
          <HerstelRij
            key={k._id}
            icon={<User className="h-4 w-4" />}
            titel={`Klant ${k.naam}`}
            subtitel={
              k.archivedAt
                ? `Gearchiveerd op ${formatDate(k.archivedAt)}${k.plaats ? ` · ${k.plaats}` : ""}`
                : (k.plaats ?? "")
            }
            onHerstel={async () => {
              await restoreKlant({ id: k._id });
            }}
          />
        ))}

        {leads.map((l) => (
          <HerstelRij
            key={l._id}
            icon={<Inbox className="h-4 w-4" />}
            titel={`Lead ${l.klantNaam}`}
            subtitel={
              l.archivedAt
                ? `Gearchiveerd op ${formatDate(l.archivedAt)} · ${l.referentie}`
                : l.referentie
            }
            onHerstel={async () => {
              await restoreLead({ id: l._id });
            }}
          />
        ))}
      </CardContent>
    </Card>
  );
}
