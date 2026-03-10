"use client"

import { useEffect, useState } from "react"
import { subDays, format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TrendingUp, TrendingDown, Minus, Flame, Dumbbell,
  Zap, Brain, Loader2, Scale, UtensilsCrossed, Target,
} from "lucide-react"
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from "recharts"
import { calculateEMA } from "@/lib/utils/calculations"

interface WeightData {
  date: string
  weight_kg: number
}

interface NutritionData {
  date: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface WorkoutData {
  date: string
  volume: number
  duration: number
}

const TIME_RANGES = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
]

const MACRO_COLORS = ["#3b82f6", "#ef4444", "#f59e0b"]

export default function InsightsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [range, setRange] = useState(30)
  const [loading, setLoading] = useState(true)
  const [weights, setWeights] = useState<WeightData[]>([])
  const [nutrition, setNutrition] = useState<NutritionData[]>([])
  const [workouts, setWorkouts] = useState<WorkoutData[]>([])
  const [calorieTarget, setCalorieTarget] = useState<number | null>(null)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)

    const from = format(subDays(new Date(), range), "yyyy-MM-dd")

    Promise.all([
      supabase
        .from("weight_entries")
        .select("date, weight_kg")
        .eq("user_id", user.id)
        .gte("date", from)
        .order("date", { ascending: true }),
      supabase
        .from("meals")
        .select("date, meal_items(calories, protein_g, carbs_g, fat_g)")
        .eq("user_id", user.id)
        .gte("date", from)
        .order("date", { ascending: true }),
      supabase
        .from("workouts")
        .select("date, total_volume_kg, duration_minutes")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("date", from)
        .order("date", { ascending: true }),
      supabase
        .from("nutrition_targets")
        .select("calories")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single(),
    ]).then(([wRes, nRes, woRes, tRes]) => {
      setWeights(wRes.data || [])

      // Aggregate nutrition by day
      type MealRow = { date: string; meal_items: { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }[] }
      const meals = (nRes.data || []) as MealRow[]
      const nutMap: Record<string, NutritionData> = {}
      meals.forEach((m) => {
        if (!nutMap[m.date]) nutMap[m.date] = { date: m.date, calories: 0, protein: 0, carbs: 0, fat: 0 }
        ;(m.meal_items || []).forEach((item) => {
          nutMap[m.date].calories += item.calories || 0
          nutMap[m.date].protein += item.protein_g || 0
          nutMap[m.date].carbs += item.carbs_g || 0
          nutMap[m.date].fat += item.fat_g || 0
        })
      })
      setNutrition(Object.values(nutMap).sort((a, b) => a.date.localeCompare(b.date)))

      setWorkouts(
        (woRes.data || []).map((w) => ({
          date: w.date,
          volume: w.total_volume_kg || 0,
          duration: w.duration_minutes || 0,
        }))
      )
      setCalorieTarget(tRes.data?.calories || null)
      setLoading(false)
    })
  }, [user, supabase, range])

  // Compute insights
  const weightValues = weights.map((w) => w.weight_kg * 2.20462) // to lbs
  const weightEma = calculateEMA(weightValues, 7)
  const weightChartData = weights.map((w, i) => ({
    date: format(new Date(w.date), "MM/dd"),
    raw: Number((w.weight_kg * 2.20462).toFixed(1)),
    trend: Number(weightEma[i]?.toFixed(1)),
  }))

  const avgCalories = nutrition.length > 0
    ? Math.round(nutrition.reduce((s, n) => s + n.calories, 0) / nutrition.length)
    : 0
  const avgProtein = nutrition.length > 0
    ? Math.round(nutrition.reduce((s, n) => s + n.protein, 0) / nutrition.length)
    : 0

  const totalProtein = nutrition.reduce((s, n) => s + n.protein, 0)
  const totalCarbs = nutrition.reduce((s, n) => s + n.carbs, 0)
  const totalFat = nutrition.reduce((s, n) => s + n.fat, 0)
  const macroTotal = totalProtein + totalCarbs + totalFat
  const macroData = macroTotal > 0 ? [
    { name: "Protein", value: Math.round((totalProtein / macroTotal) * 100) },
    { name: "Carbs", value: Math.round((totalCarbs / macroTotal) * 100) },
    { name: "Fat", value: Math.round((totalFat / macroTotal) * 100) },
  ] : []

  const weeklyVolume = workouts.reduce((s, w) => s + (w.volume * 2.20462), 0)
  const workoutsPerWeek = workouts.length > 0
    ? Number((workouts.length / (range / 7)).toFixed(1))
    : 0

  const calorieChartData = nutrition.map((n) => ({
    date: format(new Date(n.date), "MM/dd"),
    calories: Math.round(n.calories),
  }))

  const calorieAdherence = calorieTarget && nutrition.length > 0
    ? Math.round(
        (nutrition.filter((n) =>
          Math.abs(n.calories - calorieTarget) / calorieTarget < 0.1
        ).length / nutrition.length) * 100
      )
    : null

  let weightChange: number | null = null
  let weightTrend: "up" | "down" | "flat" = "flat"
  if (weights.length >= 2) {
    const first = weights[0].weight_kg * 2.20462
    const last = weights[weights.length - 1].weight_kg * 2.20462
    weightChange = Number((last - first).toFixed(1))
    weightTrend = weightChange > 0.5 ? "up" : weightChange < -0.5 ? "down" : "flat"
  }

  async function fetchAiInsight() {
    setAiLoading(true)
    try {
      const res = await fetch("/api/insights/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: range }),
      })
      if (!res.ok) throw new Error("Failed to get AI insight")
      const data = await res.json()
      setAiInsight(data.analysis)
    } catch {
      setAiInsight("AI analysis is not available. Set your ANTHROPIC_API_KEY in environment variables.")
    } finally {
      setAiLoading(false)
    }
  }

  const TrendIcon = weightTrend === "up" ? TrendingUp : weightTrend === "down" ? TrendingDown : Minus

  return (
    <>
      <Header title="Insights" />
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="hidden lg:block">
            <h1 className="text-3xl font-bold">Insights</h1>
            <p className="text-muted-foreground">Analytics across all your fitness data</p>
          </div>
          <div className="flex gap-1">
            {TIME_RANGES.map((r) => (
              <Button
                key={r.days}
                variant={range === r.days ? "default" : "outline"}
                size="sm"
                onClick={() => setRange(r.days)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <CardHeader className="pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Scale className="h-3 w-3" /> Weight Change
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {weightChange !== null ? `${weightChange > 0 ? "+" : ""}${weightChange}` : "—"}
                  </span>
                  <span className="text-sm text-muted-foreground">lbs</span>
                  <TrendIcon className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Flame className="h-3 w-3" /> Avg Calories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{avgCalories}</span>
                  <span className="text-sm text-muted-foreground">/day</span>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Dumbbell className="h-3 w-3" /> Workouts/Week
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{workoutsPerWeek}</span>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <UtensilsCrossed className="h-3 w-3" /> Avg Protein
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{avgProtein}g</span>
                  <span className="text-sm text-muted-foreground">/day</span>
                </CardContent>
              </Card>
            </div>

            {/* Weight Trend Chart */}
            {weightChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Weight Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={weightChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                      <YAxis fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} domain={["dataMin - 2", "dataMax + 2"]} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--card-foreground))" }} />
                      <Line type="monotone" dataKey="raw" stroke="hsl(var(--primary))" strokeWidth={1} dot={{ r: 3 }} name="Weight" />
                      <Line type="monotone" dataKey="trend" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="7-Day Trend" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Calorie Chart */}
            {calorieChartData.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Daily Calories</CardTitle>
                  {calorieAdherence !== null && (
                    <Badge variant={calorieAdherence >= 80 ? "default" : "secondary"}>
                      {calorieAdherence}% adherence
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={calorieChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                      <YAxis fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--card-foreground))" }} />
                      <Bar dataKey="calories" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Macro Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {macroData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Macro Split</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center">
                    <ResponsiveContainer width={200} height={200}>
                      <PieChart>
                        <Pie
                          data={macroData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {macroData.map((_, i) => (
                            <Cell key={i} fill={MACRO_COLORS[i]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--card-foreground))" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 ml-4">
                      {macroData.map((m, i) => (
                        <div key={m.name} className="flex items-center gap-2 text-sm">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: MACRO_COLORS[i] }} />
                          <span>{m.name}: {m.value}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Correlations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-4 w-4" /> Key Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {calorieAdherence !== null && (
                    <div className="flex items-start gap-2 text-sm">
                      <Target className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <span>
                        You hit your calorie target within 10% on <strong>{calorieAdherence}%</strong> of days.
                        {calorieAdherence >= 80 ? " Great consistency!" : " Try to stay closer to your target."}
                      </span>
                    </div>
                  )}
                  {weightChange !== null && avgCalories > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <Scale className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <span>
                        Weight changed <strong>{weightChange > 0 ? "+" : ""}{weightChange} lbs</strong> with an average of{" "}
                        <strong>{avgCalories} cal/day</strong>.
                      </span>
                    </div>
                  )}
                  {workoutsPerWeek > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <Dumbbell className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <span>
                        Averaging <strong>{workoutsPerWeek} workouts/week</strong>.
                        {workoutsPerWeek >= 4 ? " Solid training frequency!" : workoutsPerWeek >= 3 ? " Good consistency." : " Try to increase your frequency."}
                      </span>
                    </div>
                  )}
                  {avgProtein > 0 && weights.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <UtensilsCrossed className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <span>
                        Protein intake: <strong>{avgProtein}g/day</strong>
                        {weights.length > 0 && (
                          <> ({(avgProtein / (weights[weights.length - 1].weight_kg * 2.20462) ).toFixed(1)}g per lb bodyweight)</>
                        )}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* AI Insights */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-4 w-4" /> AI Analysis
                </CardTitle>
                <Button size="sm" variant="outline" onClick={fetchAiInsight} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze"}
                </Button>
              </CardHeader>
              <CardContent>
                {aiInsight ? (
                  <div className="text-sm whitespace-pre-wrap">{aiInsight}</div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click &quot;Analyze&quot; to get AI-powered insights from your data. Requires an Anthropic API key.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
