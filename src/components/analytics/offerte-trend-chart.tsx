"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TrendData {
  maand: string;
  aanleg: number;
  onderhoud: number;
  totaal: number;
  omzet: number;
}

interface OfferteTrendChartProps {
  data: TrendData[];
}

const CHART_COLORS = {
  aanleg: "hsl(221.2, 83.2%, 53.3%)",
  onderhoud: "hsl(142.1, 76.2%, 36.3%)",
};

export function OfferteTrendChart({ data }: OfferteTrendChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Offertes per Maand</CardTitle>
          <CardDescription>Trend van aanleg en onderhoud offertes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Geen data beschikbaar voor de geselecteerde periode
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Offertes per Maand</CardTitle>
        <CardDescription>Trend van aanleg en onderhoud offertes</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="maand"
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="aanleg"
              name="Aanleg"
              stroke={CHART_COLORS.aanleg}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.aanleg, strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="onderhoud"
              name="Onderhoud"
              stroke={CHART_COLORS.onderhoud}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.onderhoud, strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
