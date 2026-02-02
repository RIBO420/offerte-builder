"use client";

import { memo, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { type ScopeAfwijking, getScopeDisplayName } from "@/lib/nacalculatie-calculator";

// Dynamically import recharts to reduce initial bundle size
const BarChart = dynamic(
  () => import("recharts").then((mod) => mod.BarChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), {
  ssr: false,
});
const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => mod.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), {
  ssr: false,
});
const Legend = dynamic(() => import("recharts").then((mod) => mod.Legend), {
  ssr: false,
});
const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);
const ReferenceLine = dynamic(
  () => import("recharts").then((mod) => mod.ReferenceLine),
  { ssr: false }
);

interface VergelijkingChartProps {
  afwijkingen: ScopeAfwijking[];
  height?: number;
  showPercentage?: boolean;
}

function ChartSkeleton() {
  return (
    <div className="w-full h-[300px] flex items-center justify-center">
      <Skeleton className="w-full h-full" />
    </div>
  );
}

// Custom tooltip component
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

const CustomTooltip = memo(function CustomTooltip({
  active,
  payload,
  label,
}: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">
            {entry.value} {entry.dataKey.includes("Percentage") ? "%" : "uur"}
          </span>
        </div>
      ))}
    </div>
  );
});

export const VergelijkingChart = memo(function VergelijkingChart({
  afwijkingen,
  height = 350,
  showPercentage = false,
}: VergelijkingChartProps) {
  const chartData = useMemo(() => {
    return afwijkingen.map((a) => ({
      scope: getScopeDisplayName(a.scope),
      scopeKey: a.scope,
      gepland: a.geplandeUren,
      werkelijk: a.werkelijkeUren,
      afwijking: a.afwijkingUren,
      afwijkingPercentage: a.afwijkingPercentage,
    }));
  }, [afwijkingen]);

  if (afwijkingen.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Geen data beschikbaar voor grafiek.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Vergelijking Gepland vs Werkelijk
        </CardTitle>
        <CardDescription>
          {showPercentage
            ? "Afwijkingspercentage per scope"
            : "Uren per scope vergeleken met planning"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {showPercentage ? (
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis type="number" unit="%" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                <YAxis
                  dataKey="scope"
                  type="category"
                  width={100}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
                <Bar
                  dataKey="afwijkingPercentage"
                  name="Afwijking"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis
                  dataKey="scope"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                  label={{
                    value: "Uren",
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: "middle", fontSize: 12, fill: "hsl(var(--muted-foreground))" },
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: "10px", color: "hsl(var(--foreground))" }}
                  iconType="circle"
                  formatter={(value) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>}
                />
                <Bar
                  dataKey="gepland"
                  name="Gepland"
                  fill="hsl(var(--muted-foreground))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="werkelijk"
                  name="Werkelijk"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

// Alternative deviation-focused chart
export const AfwijkingChart = memo(function AfwijkingChart({
  afwijkingen,
  height = 300,
}: {
  afwijkingen: ScopeAfwijking[];
  height?: number;
}) {
  const chartData = useMemo(() => {
    return afwijkingen
      .map((a) => ({
        scope: getScopeDisplayName(a.scope),
        afwijking: a.afwijkingPercentage,
        fill:
          a.status === "good"
            ? "hsl(var(--chart-2))"
            : a.status === "warning"
              ? "hsl(var(--chart-4))"
              : "hsl(var(--destructive))",
      }))
      .sort((a, b) => Math.abs(b.afwijking) - Math.abs(a.afwijking));
  }, [afwijkingen]);

  if (afwijkingen.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Afwijkingen</CardTitle>
        <CardDescription>
          Gesorteerd op grootste afwijking
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 10, right: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} horizontal={false} />
              <XAxis
                type="number"
                unit="%"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                domain={["auto", "auto"]}
              />
              <YAxis
                dataKey="scope"
                type="category"
                width={100}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
              />
              <Tooltip
                formatter={(value) => [`${value}%`, "Afwijking"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
              />
              <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Bar dataKey="afwijking" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <rect key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

export default VergelijkingChart;
