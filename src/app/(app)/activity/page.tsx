"use client"

import { useEffect, useState } from "react"
import { format, subDays } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Footprints, Clock, ArrowUpRight, Loader2, Smartphone, Flame } from "lucide-react"
import { toast } from "sonner"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from "recharts"

interface ActivityEntry {
  id: string
  date: string
  steps: number | null
  active_minutes: number | null
  distance_km: number | null
  flights_climbed: number | null
  notes: string | null
  source: string | null
  active_calories: number | null
  workout_calories: number | null
  heart_rate_avg: number | null
  heart_rate_resting: number | null
}

export default function ActivityPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const today = format(new Date(), "yyyy-MM-dd")

  // Form state
  const [date, setDate] = useState(today)
  const [steps, setSteps] = useState("")
  const [activeMinutes, setActiveMinutes] = useState("")
  const [distanceKm, setDistanceKm] = useState("")
  const [flights, setFlights] = useState("")

  useEffect(() => {
    if (!user) return
    const from = format(subDays(new Date(), 30), "yyyy-MM-dd")
    supabase
      .from("activity_entries")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", from)
      .order("date", { ascending: true })
      .then(({ data }) => {
        setEntries(data || [])
        setLoading(false)
      })
  }, [user, supabase])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    // Delete existing entry for this date, then insert new one
    await supabase
      .from("activity_entries")
      .delete()
      .eq("user_id", user.id)
      .eq("date", date)

    const payload = {
      user_id: user.id,
      date,
      steps: steps ? parseInt(steps) : null,
      active_minutes: activeMinutes ? parseInt(activeMinutes) : null,
      distance_km: distanceKm ? parseFloat(distanceKm) : null,
      flights_climbed: flights ? parseInt(flights) : null,
    }
    const { error } = await supabase.from("activity_entries").insert(payload)

    if (error) {
      toast.error("Failed to save activity")
    } else {
      toast.success("Activity saved!")
      setSteps("")
      setActiveMinutes("")
      setDistanceKm("")
      setFlights("")
      // Refresh
      const from = format(subDays(new Date(), 30), "yyyy-MM-dd")
      const { data } = await supabase
        .from("activity_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", from)
        .order("date", { ascending: true })
      setEntries(data || [])
    }
    setSaving(false)
  }

  const chartData = entries.map((e) => ({
    date: format(new Date(e.date), "MM/dd"),
    steps: e.steps || 0,
    activeMinutes: e.active_minutes || 0,
  }))

  const todayEntry = entries.find((e) => e.date === today)
  const avgSteps = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + (e.steps || 0), 0) / entries.length)
    : 0

  return (
    <>
      <Header title="Activity" />
      <div className="p-4 lg:p-8 space-y-6">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold">Activity</h1>
          <p className="text-muted-foreground">Track daily steps, active minutes, and more</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
              <Footprints className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">
                {todayEntry?.steps?.toLocaleString() || "—"}
              </span>
              <p className="text-xs text-muted-foreground">
                steps
                {todayEntry?.source === "apple_health" && (
                  <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0">
                    <Smartphone className="h-2.5 w-2.5 mr-0.5" />
                    Synced
                  </Badge>
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">30-Day Avg</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{avgSteps.toLocaleString()}</span>
              <p className="text-xs text-muted-foreground">steps/day</p>
            </CardContent>
          </Card>
          {todayEntry?.active_calories != null && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Cal</CardTitle>
                <Flame className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">
                  {todayEntry.active_calories.toLocaleString()}
                </span>
                <p className="text-xs text-muted-foreground">kcal burned</p>
              </CardContent>
            </Card>
          )}
          {todayEntry?.heart_rate_resting != null && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Resting HR</CardTitle>
                <Clock className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">
                  {todayEntry.heart_rate_resting}
                </span>
                <p className="text-xs text-muted-foreground">bpm</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Steps (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    fontSize={10}
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    fontSize={10}
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--card-foreground))",
                    }}
                  />
                  <Bar dataKey="steps" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Log Activity Form */}
        <Card>
          <CardHeader>
            <CardTitle>Log Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="act-date">Date</Label>
                <Input
                  id="act-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="steps">Steps</Label>
                  <Input
                    id="steps"
                    type="number"
                    placeholder="10000"
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="active-min">Active Minutes</Label>
                  <Input
                    id="active-min"
                    type="number"
                    placeholder="45"
                    value={activeMinutes}
                    onChange={(e) => setActiveMinutes(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distance">Distance (mi)</Label>
                  <Input
                    id="distance"
                    type="number"
                    step="0.1"
                    placeholder="3.5"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flights">Flights Climbed</Label>
                  <Input
                    id="flights"
                    type="number"
                    placeholder="10"
                    value={flights}
                    onChange={(e) => setFlights(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Activity
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
