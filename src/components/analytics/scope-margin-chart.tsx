"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ScopeMargeData {
  scope: string;
  totaal: number;
  marge: number;
  margePercentage: number;
  count: number;
}

interface ScopeMarginChartProps {
  data: ScopeMargeData[];
}

// Scope display names in Dutch
const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  beplanting: "Beplanting",
  grasveld: "Grasveld",
  schutting: "Schutting",
  vijver: "Vijver",
  verlichting: "Verlichting",
  irrigatie: "Irrigatie",
  snoeiwerk: "Snoeiwerk",
  onkruid: "Onkruidbestrijding",
  bemesting: "Bemesting",
  gazon: "Gazononderhoud",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Color scale based on margin percentage
function getMargeColor(percentage: number): string {
  if (percentage >= 30) return "hsl(142.1, 76.2%, 36.3%)"; // Green
  if (percentage >= 20) return "hsl(142.1, 76.2%, 46.3%)"; // Light green
  if (percentage >= 10) return "hsl(45, 93%, 47%)"; // Amber
  return "hsl(0, 72%, 51%)"; // Red
}

export function ScopeMarginChart({ data }: ScopeMarginChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Marge per Scope</CardTitle>
          <CardDescription>Gemiddelde marge percentage per werksoort</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Geen scope data beschikbaar
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    displayName: scopeLabels[item.scope] ?? item.scope,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marge per Scope</CardTitle>
        <CardDescription>Marge percentage per werksoort (geaccepteerde offertes)</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              type="number"
              domain={[0, 50]}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis
              type="category"
              dataKey="displayName"
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
              width={75}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const item = payload[0].payload as ScopeMargeData & { displayName: string };
                  return (
                    <div className="rounded-lg border bg-card p-3 shadow-md">
                      <p className="font-medium">{item.displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        Marge: <span className="font-medium text-foreground">{item.margePercentage}%</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Totaal: <span className="font-medium text-foreground">{formatCurrency(item.totaal)}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Aantal: <span className="font-medium text-foreground">{item.count} offertes</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="margePercentage" name="Marge %" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getMargeColor(entry.margePercentage)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
