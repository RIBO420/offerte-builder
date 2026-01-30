"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MonthlyData {
  maand: string;
  omzet: number;
}

interface QuarterlyData {
  kwartaal: string;
  omzet: number;
  count: number;
}

interface RevenueChartProps {
  monthlyData: MonthlyData[];
  quarterlyData: QuarterlyData[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const CHART_COLOR = "hsl(45, 93%, 47%)";

export function RevenueChart({ monthlyData, quarterlyData }: RevenueChartProps) {
  const [view, setView] = useState<"maand" | "kwartaal">("maand");

  const data = view === "maand" ? monthlyData : quarterlyData;
  const dataKey = view === "maand" ? "maand" : "kwartaal";

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Omzet</CardTitle>
            <CardDescription>Omzet van geaccepteerde offertes</CardDescription>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as "maand" | "kwartaal")}>
            <TabsList>
              <TabsTrigger value="maand">Maand</TabsTrigger>
              <TabsTrigger value="kwartaal">Kwartaal</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Geen omzet data beschikbaar
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Omzet</CardTitle>
          <CardDescription>Omzet van geaccepteerde offertes</CardDescription>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as "maand" | "kwartaal")}>
          <TabsList>
            <TabsTrigger value="maand">Maand</TabsTrigger>
            <TabsTrigger value="kwartaal">Kwartaal</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey={dataKey}
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis
              tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <Tooltip
              formatter={(value) => [formatCurrency(value as number), "Omzet"]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Bar
              dataKey="omzet"
              name="Omzet"
              fill={CHART_COLOR}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
