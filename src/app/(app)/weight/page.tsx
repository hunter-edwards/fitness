"use client"

import { useEffect, useState, useCallback } from "react"
import { subDays } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { WeightForm } from "@/components/weight/weight-form"
import { WeightChart } from "@/components/weight/weight-chart"
import { WeightHistory } from "@/components/weight/weight-history"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TIME_RANGES } from "@/lib/constants"
import { kgToLbs } from "@/lib/utils/units"
import { TrendingUp, TrendingDown, Minus, Scale } from "lucide-react"

interface WeightEntry {
  id: string
  date: string
  weight_kg: number
  body_fat_pct: number | null
  notes: string | null
}

export default function WeightPage() {
  const { user, loading: authLoading } = useAuth()
  const [entries, setEntries] = useState<WeightEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("30d")
  const supabase = createClient()

  const fetchEntries = useCallback(async () => {
    if (!user) return

    setLoading(true)
    const selectedRange = TIME_RANGES.find((r) => r.value === timeRange)
    const days = selectedRange?.days ?? 30

    let query = supabase
      .from("weight_entries")
      .select("id, date, weight_kg, body_fat_pct, notes")
      .eq("user_id", user.id)
      .order("date", { ascending: false })

    if (timeRange !== "all") {
      const cutoff = subDays(new Date(), days).toISOString().split("T")[0]
      query = query.gte("date", cutoff)
    }

    const { data, error } = await query

    if (error) {
      console.error("Failed to fetch weight entries:", error)
    } else {
      setEntries(data || [])
    }
    setLoading(false)
  }, [user, timeRange, supabase])

  useEffect(() => {
    if (user) {
      fetchEntries()
    }
  }, [user, fetchEntries])

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from("weight_entries")
      .delete()
      .eq("id", id)
      .eq("user_id", user!.id)

    if (error) {
      console.error("Failed to delete weight entry:", error)
      return
    }

    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  // Compute summary stats
  const sorted = [...entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  const latest = sorted[0] ?? null
  const previous = sorted[1] ?? null
  const change =
    latest && previous ? latest.weight_kg - previous.weight_kg : null
  const changeLbs = change !== null ? kgToLbs(change) : null

  const TrendIcon =
    change !== null && change > 0.05
      ? TrendingUp
      : change !== null && change < -0.05
        ? TrendingDown
        : Minus

  return (
    <>
      <Header title="Weight" />
      <div className="p-4 lg:p-8 space-y-6">
        {/* Desktop page title */}
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold">Weight Tracking</h1>
          <p className="text-muted-foreground">
            Track your body weight and see trends over time
          </p>
        </div>

        {/* Summary stats */}
        {!authLoading && user && (
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Current
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : latest ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-bold tabular-nums">
                      {kgToLbs(latest.weight_kg).toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">lbs</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">--</span>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Change
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : changeLbs !== null ? (
                  <div className="flex items-center gap-1.5">
                    <TrendIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold tabular-nums">
                      {changeLbs > 0 ? "+" : ""}
                      {changeLbs.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">lbs</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">--</span>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold tabular-nums">
                      {entries.length}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick-add form */}
        {!authLoading && user && (
          <WeightForm userId={user.id} onSave={fetchEntries} />
        )}

        {/* Chart section */}
        {!authLoading && user && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Weight Trend</CardTitle>
                <div className="flex gap-1">
                  {TIME_RANGES.map((range) => (
                    <Button
                      key={range.value}
                      variant={timeRange === range.value ? "secondary" : "ghost"}
                      size="xs"
                      onClick={() => setTimeRange(range.value)}
                    >
                      {range.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <WeightChart entries={entries} unit="imperial" />
              )}
            </CardContent>
          </Card>
        )}

        {/* History section */}
        {!authLoading && user && (
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <WeightHistory entries={entries} onDelete={handleDelete} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
