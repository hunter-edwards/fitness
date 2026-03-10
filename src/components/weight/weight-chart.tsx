"use client"

import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import { calculateEMA } from "@/lib/utils/calculations"
import { kgToLbs } from "@/lib/utils/units"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

interface WeightChartProps {
  entries: { date: string; weight_kg: number }[]
  unit: "metric" | "imperial"
}

interface ChartDataPoint {
  date: string
  dateLabel: string
  raw: number
  ema: number
}

function convertWeight(kg: number, unit: "metric" | "imperial"): number {
  return unit === "imperial" ? Number(kgToLbs(kg).toFixed(1)) : Number(kg.toFixed(1))
}

export function WeightChart({ entries, unit }: WeightChartProps) {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (entries.length === 0) return []

    // Sort oldest first for EMA calculation
    const sorted = [...entries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    const rawValues = sorted.map((e) => convertWeight(e.weight_kg, unit))
    const emaValues = calculateEMA(rawValues, 7)

    return sorted.map((entry, i) => ({
      date: entry.date,
      dateLabel: format(parseISO(entry.date), "MMM d"),
      raw: rawValues[i],
      ema: Number(emaValues[i].toFixed(1)),
    }))
  }, [entries, unit])

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No data to display. Log your first weight entry above.
      </div>
    )
  }

  const allValues = chartData.flatMap((d) => [d.raw, d.ema])
  const minVal = Math.floor(Math.min(...allValues) - 2)
  const maxVal = Math.ceil(Math.max(...allValues) + 2)
  const unitLabel = unit === "imperial" ? "lbs" : "kg"

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minVal, maxVal]}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val}`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const data = payload[0].payload as ChartDataPoint
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
                  <p className="font-medium">{format(parseISO(data.date), "MMM d, yyyy")}</p>
                  <p className="text-muted-foreground">
                    Weight: {data.raw} {unitLabel}
                  </p>
                  <p className="text-muted-foreground">
                    Trend: {data.ema} {unitLabel}
                  </p>
                </div>
              )
            }}
          />
          <Line
            type="monotone"
            dataKey="raw"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            dot={{ r: 3, fill: "hsl(var(--primary))" }}
            activeDot={{ r: 5 }}
            name="Weight"
          />
          <Line
            type="monotone"
            dataKey="ema"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2.5}
            dot={false}
            name="7-Day Trend"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
