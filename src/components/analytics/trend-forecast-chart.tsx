"use client";

import { useState, memo, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface TrendData {
  maand: string;
  aanleg: number;
  onderhoud: number;
  totaal: number;
  omzet: number;
  movingAvgTotal?: number;
  movingAvgOmzet?: number;
}

interface ForecastData {
  maand: string;
  forecastTotal: number;
  forecastOmzet: number;
}

interface TrendForecastChartProps {
  data: TrendData[];
  forecast: ForecastData[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Theme-aware chart colors using CSS custom properties
const CHART_COLORS = {
  aanleg: "hsl(var(--chart-1))",
  onderhoud: "hsl(var(--chart-2))",
  totaal: "hsl(var(--chart-4))",
  movingAvg: "hsl(var(--chart-5))",
  forecast: "hsl(var(--chart-3))",
  forecastArea: "hsl(var(--chart-3) / 0.15)",
};

export const TrendForecastChart = memo(function TrendForecastChart({ data, forecast }: TrendForecastChartProps) {
  const [view, setView] = useState<"aantal" | "omzet">("aantal");
  const [showMovingAvg, setShowMovingAvg] = useState(true);
  const [showForecast, setShowForecast] = useState(true);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trend & Forecast
          </CardTitle>
          <CardDescription>Historische trend met voorspelling</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[350px] items-center justify-center text-muted-foreground">
            Geen data beschikbaar voor de geselecteerde periode
          </div>
        </CardContent>
      </Card>
    );
  }

  // Combine historical data with forecast
  const combinedData = [
    ...data.map((d) => ({
      ...d,
      isForecast: false,
      forecastTotal: null as number | null,
      forecastOmzet: null as number | null,
    })),
    ...(showForecast
      ? forecast.map((f) => ({
          maand: f.maand,
          aanleg: 0,
          onderhoud: 0,
          totaal: null as number | null,
          omzet: null as number | null,
          movingAvgTotal: null as number | null,
          movingAvgOmzet: null as number | null,
          isForecast: true,
          forecastTotal: f.forecastTotal,
          forecastOmzet: f.forecastOmzet,
        }))
      : []),
  ];

  // Find the last historical data point for the reference line
  const lastHistoricalIndex = data.length - 1;
  const lastHistoricalMonth = data[lastHistoricalIndex]?.maand;

  return (
    <Card>
      <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trend & Forecast
          </CardTitle>
          <CardDescription>
            Historische trend met 3-maanden voorspelling
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Tabs value={view} onValueChange={(v) => setView(v as "aantal" | "omzet")}>
            <TabsList>
              <TabsTrigger value="aantal">Aantal</TabsTrigger>
              <TabsTrigger value="omzet">Omzet</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {/* Toggle controls */}
        <div className="flex flex-wrap gap-6 mb-4 pb-4 border-b">
          <div className="flex items-center space-x-2">
            <Switch
              id="moving-avg"
              checked={showMovingAvg}
              onCheckedChange={setShowMovingAvg}
            />
            <Label htmlFor="moving-avg" className="text-sm cursor-pointer">
              Voortschrijdend gemiddelde
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="forecast"
              checked={showForecast}
              onCheckedChange={setShowForecast}
              disabled={forecast.length === 0}
            />
            <Label htmlFor="forecast" className="text-sm cursor-pointer">
              Forecast (3 maanden)
            </Label>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={combinedData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis
              dataKey="maand"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
              tickFormatter={view === "omzet" ? (v) => `€${(v / 1000).toFixed(0)}k` : undefined}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length > 0) {
                  const isForecast = payload[0]?.payload?.isForecast;
                  return (
                    <div className="rounded-lg border border-border bg-popover text-popover-foreground p-3 shadow-md">
                      <p className="font-medium mb-2">
                        {label}
                        {isForecast && (
                          <span className="ml-2 text-xs text-chart-3 font-normal">(Forecast)</span>
                        )}
                      </p>
                      {payload.map((entry, index) => {
                        if (entry.value === null || entry.value === undefined) return null;
                        const isOmzet = entry.dataKey?.toString().toLowerCase().includes("omzet");
                        return (
                          <p key={index} className="text-sm" style={{ color: entry.color }}>
                            {entry.name}: {isOmzet ? formatCurrency(entry.value as number) : entry.value}
                          </p>
                        );
                      })}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              wrapperStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value) => <span className="text-foreground">{value}</span>}
            />

            {/* Reference line at forecast boundary */}
            {showForecast && lastHistoricalMonth && (
              <ReferenceLine
                x={lastHistoricalMonth}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                label={{
                  value: "Nu",
                  position: "top",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 11,
                }}
              />
            )}

            {view === "aantal" ? (
              <>
                {/* Historical lines */}
                <Line
                  type="monotone"
                  dataKey="aanleg"
                  name="Aanleg"
                  stroke={CHART_COLORS.aanleg}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.aanleg, strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="onderhoud"
                  name="Onderhoud"
                  stroke={CHART_COLORS.onderhoud}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.onderhoud, strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />

                {/* Moving average */}
                {showMovingAvg && (
                  <Line
                    type="monotone"
                    dataKey="movingAvgTotal"
                    name="Gem. (3mnd)"
                    stroke={CHART_COLORS.movingAvg}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    connectNulls={false}
                  />
                )}

                {/* Forecast */}
                {showForecast && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="forecastTotal"
                      name="Forecast"
                      stroke={CHART_COLORS.forecast}
                      fill={CHART_COLORS.forecastArea}
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      dot={{ fill: CHART_COLORS.forecast, strokeWidth: 2, r: 4 }}
                      connectNulls={false}
                    />
                  </>
                )}
              </>
            ) : (
              <>
                {/* Revenue line */}
                <Line
                  type="monotone"
                  dataKey="omzet"
                  name="Omzet"
                  stroke={CHART_COLORS.totaal}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.totaal, strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />

                {/* Moving average */}
                {showMovingAvg && (
                  <Line
                    type="monotone"
                    dataKey="movingAvgOmzet"
                    name="Gem. (3mnd)"
                    stroke={CHART_COLORS.movingAvg}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    connectNulls={false}
                  />
                )}

                {/* Forecast */}
                {showForecast && (
                  <Area
                    type="monotone"
                    dataKey="forecastOmzet"
                    name="Forecast"
                    stroke={CHART_COLORS.forecast}
                    fill={CHART_COLORS.forecastArea}
                    strokeWidth={2}
                    strokeDasharray="8 4"
                    dot={{ fill: CHART_COLORS.forecast, strokeWidth: 2, r: 4 }}
                    connectNulls={false}
                  />
                )}
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Forecast summary */}
        {showForecast && forecast.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Forecast Samenvatting (komende 3 maanden)</h4>
            <div className="grid grid-cols-3 gap-4">
              {forecast.map((f, i) => (
                <div key={i} className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                  <div className="text-xs text-muted-foreground">{f.maand}</div>
                  <div className="font-semibold text-amber-700 dark:text-amber-400">
                    {view === "aantal" ? `${f.forecastTotal} offertes` : formatCurrency(f.forecastOmzet)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

