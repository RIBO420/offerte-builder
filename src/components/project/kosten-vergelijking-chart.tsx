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

interface KostenVergelijkingData {
  gepland: number;
  werkelijk: number;
  afwijking: number;
  afwijkingPercentage: number;
}

interface KostenVergelijkingChartProps {
  materiaal: KostenVergelijkingData;
  arbeid: KostenVergelijkingData;
  machine: KostenVergelijkingData;
  overig?: KostenVergelijkingData;
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

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
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
});

const typeLabels: Record<string, string> = {
  materiaal: "Materiaal",
  arbeid: "Arbeid",
  machine: "Machine",
  overig: "Overig",
};

export const KostenVergelijkingChart = memo(function KostenVergelijkingChart({
  materiaal,
  arbeid,
  machine,
  overig,
  height = 350,
  showPercentage = false,
}: KostenVergelijkingChartProps) {
  const chartData = useMemo(() => {
    const data = [
      {
        type: "Materiaal",
        key: "materiaal",
        gepland: materiaal.gepland,
        werkelijk: materiaal.werkelijk,
        afwijking: materiaal.afwijking,
        afwijkingPercentage: materiaal.afwijkingPercentage,
      },
      {
        type: "Arbeid",
        key: "arbeid",
        gepland: arbeid.gepland,
        werkelijk: arbeid.werkelijk,
        afwijking: arbeid.afwijking,
        afwijkingPercentage: arbeid.afwijkingPercentage,
      },
      {
        type: "Machine",
        key: "machine",
        gepland: machine.gepland,
        werkelijk: machine.werkelijk,
        afwijking: machine.afwijking,
        afwijkingPercentage: machine.afwijkingPercentage,
      },
    ];

    if (overig && (overig.gepland > 0 || overig.werkelijk > 0)) {
      data.push({
        type: "Overig",
        key: "overig",
        gepland: overig.gepland,
        werkelijk: overig.werkelijk,
        afwijking: overig.afwijking,
        afwijkingPercentage: overig.afwijkingPercentage,
      });
    }

    return data;
  }, [materiaal, arbeid, machine, overig]);

  const hasData = chartData.some((d) => d.gepland > 0 || d.werkelijk > 0);

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Geen kosten data beschikbaar voor grafiek.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Kosten: Gepland vs Werkelijk
        </CardTitle>
        <CardDescription>
          Vergelijking van geplande en werkelijke kosten per type
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <XAxis
                dataKey="type"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                tickFormatter={(value) => `\u20AC${value.toLocaleString("nl-NL")}`}
                label={{
                  value: "Kosten (EUR)",
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
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

// Alternative deviation-focused chart
interface KostenAfwijkingChartProps {
  materiaal: KostenVergelijkingData;
  arbeid: KostenVergelijkingData;
  machine: KostenVergelijkingData;
  overig?: KostenVergelijkingData;
  height?: number;
}

export const KostenAfwijkingChart = memo(function KostenAfwijkingChart({
  materiaal,
  arbeid,
  machine,
  overig,
  height = 300,
}: KostenAfwijkingChartProps) {
  const chartData = useMemo(() => {
    const data = [
      {
        type: "Materiaal",
        afwijking: materiaal.afwijkingPercentage,
        fill: getColorForDeviation(materiaal.afwijkingPercentage),
      },
      {
        type: "Arbeid",
        afwijking: arbeid.afwijkingPercentage,
        fill: getColorForDeviation(arbeid.afwijkingPercentage),
      },
      {
        type: "Machine",
        afwijking: machine.afwijkingPercentage,
        fill: getColorForDeviation(machine.afwijkingPercentage),
      },
    ];

    if (overig && (overig.gepland > 0 || overig.werkelijk > 0)) {
      data.push({
        type: "Overig",
        afwijking: overig.afwijkingPercentage,
        fill: getColorForDeviation(overig.afwijkingPercentage),
      });
    }

    return data.sort((a, b) => Math.abs(b.afwijking) - Math.abs(a.afwijking));
  }, [materiaal, arbeid, machine, overig]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Afwijkingen per Type</CardTitle>
        <CardDescription>
          Procentuele afwijking van het budget
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
                dataKey="type"
                type="category"
                width={80}
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

// Helper function to get color based on deviation percentage
function getColorForDeviation(percentage: number): string {
  const absPercentage = Math.abs(percentage);
  if (absPercentage <= 5) {
    return "hsl(var(--chart-2))"; // green
  }
  if (absPercentage <= 15) {
    return "hsl(var(--chart-4))"; // yellow/orange
  }
  return "hsl(var(--destructive))"; // red
}

export default KostenVergelijkingChart;
