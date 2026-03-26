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
  Truck,
  Wrench,
  AlertTriangle,
  ShieldCheck,
  ShoppingCart,
  Package,
  ClipboardCheck,
  Calendar,
  Ban,
} from "lucide-react";

// ── Formatters ────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ts));
}

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// ── Main Component ────────────────────────────────────────────────────

export function MateriaalmanDashboard() {
  const stats = useQuery(api.materiaalmanDashboard.getMateriaalmanStats);

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status overzicht */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Vloot & Materieel</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard
            title="Voertuigen"
            icon={Truck}
            iconColor="text-blue-500"
            value={stats.vloot.actief}
            total={stats.vloot.totaal}
            label="actief"
            alerts={stats.vloot.inOnderhoud > 0 ? `${stats.vloot.inOnderhoud} in onderhoud` : undefined}
            alertColor="text-amber-500"
          />
          <StatusCard
            title="Machines"
            icon={Wrench}
            iconColor="text-purple-500"
            value={stats.machines.actief}
            total={stats.machines.totaal}
            label="actief"
          />
          <StatusCard
            title="Voorraad Alerts"
            icon={Package}
            iconColor={stats.voorraadAlerts > 0 ? "text-red-500" : "text-green-500"}
            value={stats.voorraadAlerts}
            label={stats.voorraadAlerts === 0 ? "alles op peil" : "onder minimum"}
          />
          <StatusCard
            title="QC Checks"
            icon={ClipboardCheck}
            iconColor={stats.qcStatus.afgekeurd > 0 ? "text-red-500" : "text-blue-500"}
            value={stats.qcStatus.open}
            label="open"
            alerts={stats.qcStatus.afgekeurd > 0 ? `${stats.qcStatus.afgekeurd} afgekeurd` : undefined}
            alertColor="text-red-500"
          />
        </div>
      </div>

      {/* Blokkades + Keuringen */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Blokkade overzicht */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Ban className="h-4 w-4 text-red-500" />
              Blokkades ({stats.blokkades.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.blokkades.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Alles inzetbaar
              </p>
            ) : (
              <div className="space-y-2">
                {stats.blokkades.map((b, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{b.naam}</p>
                      <p className="text-xs text-muted-foreground">{b.reden}</p>
                    </div>
                    <Badge
                      variant={b.prioriteit === "hoog" ? "destructive" : "secondary"}
                      className="text-[10px] shrink-0"
                    >
                      {b.prioriteit}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Keuringen kalender */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              Naderende Keuringen ({stats.naderendeKeuringen.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.naderendeKeuringen.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Geen keuringen komende 30 dagen
              </p>
            ) : (
              <div className="space-y-2">
                {stats.naderendeKeuringen.map((k, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {k.type === "apk" ? (
                        <ShieldCheck className="h-4 w-4 shrink-0 text-blue-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {k.kenteken} — {k.merk} {k.model}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {k.type === "apk" ? "APK" : "Verzekering"} — {formatDate(k.vervaldatum)}
                        </p>
                      </div>
                    </div>
                    {k.isVervallen ? (
                      <Badge variant="destructive" className="text-[10px] shrink-0">
                        Vervallen
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Binnenkort
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inkooporders */}
      {stats.inkooporders.open > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
              Openstaande Inkooporders ({stats.inkooporders.open})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.inkooporders.items.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{order.leverancier}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium">{fmt.format(order.totaal)}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function StatusCard({
  title,
  icon: Icon,
  iconColor,
  value,
  total,
  label,
  alerts,
  alertColor,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  value: number;
  total?: number;
  label: string;
  alerts?: string;
  alertColor?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold">
          {value}
          {total !== undefined && (
            <span className="text-sm font-normal text-muted-foreground">/{total}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {alerts && (
          <p className={`text-xs mt-1 ${alertColor ?? "text-amber-500"}`}>{alerts}</p>
        )}
      </CardContent>
    </Card>
  );
}
