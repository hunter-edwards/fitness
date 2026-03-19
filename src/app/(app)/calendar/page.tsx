"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek,
} from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeft, ChevronRight, Dumbbell, UtensilsCrossed, Scale, AlertTriangle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { TodaysWorkout } from "@/components/workouts/todays-workout"
import { toast } from "sonner"

interface DayData {
  workouts: { name: string | null; status: string }[]
  hasNutrition: boolean
  hasWeight: boolean
}

export default function CalendarPage() {
  const { user } = useAuth()
  const supabaseRef = useRef(createClient())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dayMap, setDayMap] = useState<Record<string, DayData>>({})
  const [loading, setLoading] = useState(true)
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [removing, setRemoving] = useState(false)

  const monthKey = format(currentMonth, "yyyy-MM")
  const monthStart = useMemo(() => startOfMonth(currentMonth), [monthKey])
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [monthKey])
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  useEffect(() => {
    if (!user) return
    setLoading(true)

    const supabase = supabaseRef.current
    const from = format(monthStart, "yyyy-MM-dd")
    const to = format(monthEnd, "yyyy-MM-dd")

    Promise.all([
      supabase
        .from("workouts")
        .select("date, name, status")
        .eq("user_id", user.id)
        .gte("date", from)
        .lte("date", to),
      supabase
        .from("meals")
        .select("date")
        .eq("user_id", user.id)
        .gte("date", from)
        .lte("date", to),
      supabase
        .from("weight_entries")
        .select("date")
        .eq("user_id", user.id)
        .gte("date", from)
        .lte("date", to),
    ]).then(([workoutsRes, mealsRes, weightRes]) => {
      const map: Record<string, DayData> = {}

      const initDay = (date: string) => {
        if (!map[date]) map[date] = { workouts: [], hasNutrition: false, hasWeight: false }
      }

      ;(workoutsRes.data || []).forEach((w: { date: string; name: string | null; status: string }) => {
        initDay(w.date)
        map[w.date].workouts.push({ name: w.name, status: w.status })
      })

      const nutritionDates = new Set((mealsRes.data || []).map((m: { date: string }) => m.date))
      nutritionDates.forEach((d) => {
        initDay(d)
        map[d].hasNutrition = true
      })

      const weightDates = new Set((weightRes.data || []).map((w: { date: string }) => w.date))
      weightDates.forEach((d) => {
        initDay(d)
        map[d].hasWeight = true
      })

      setDayMap(map)
      setLoading(false)
    })
  }, [user, monthKey])

  // Detect duplicate scheduled workouts across all plans (runs once on mount)
  useEffect(() => {
    if (!user) return
    const supabase = supabaseRef.current

    supabase
      .from("workouts")
      .select("id, date, name")
      .eq("user_id", user.id)
      .eq("status", "scheduled")
      .then(({ data }) => {
        if (!data) return
        const groups = new Map<string, number>()
        for (const w of data) {
          const key = `${w.date}|${w.name}`
          groups.set(key, (groups.get(key) || 0) + 1)
        }
        const dupes = Array.from(groups.values()).reduce(
          (sum, count) => sum + Math.max(0, count - 1),
          0
        )
        setDuplicateCount(dupes)
      })
  }, [user])

  async function handleRemoveDuplicates() {
    if (!user) return
    setRemoving(true)

    try {
      const supabase = supabaseRef.current

      const { data: scheduled } = await supabase
        .from("workouts")
        .select("id, date, name, created_at")
        .eq("user_id", user.id)
        .eq("status", "scheduled")
        .order("created_at", { ascending: true })

      if (!scheduled || scheduled.length === 0) {
        toast.info("No scheduled workouts found")
        return
      }

      // Group by date+name, keep the first (oldest) of each group
      const groups = new Map<string, typeof scheduled>()
      for (const w of scheduled) {
        const key = `${w.date}|${w.name}`
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(w)
      }

      const duplicateIds: string[] = []
      for (const [, group] of groups) {
        for (let i = 1; i < group.length; i++) {
          duplicateIds.push(group[i].id)
        }
      }

      if (duplicateIds.length === 0) {
        toast.info("No duplicate workouts found")
        return
      }

      // Batch delete
      const { error: setsErr } = await supabase
        .from("workout_sets")
        .delete()
        .in("workout_id", duplicateIds)
      if (setsErr) throw setsErr

      const { error: workoutsErr } = await supabase
        .from("workouts")
        .delete()
        .in("id", duplicateIds)
      if (workoutsErr) throw workoutsErr

      toast.success(`Removed ${duplicateIds.length} duplicate workouts`)
      setDuplicateCount(0)

      // Refresh calendar data by re-triggering the month fetch
      setDayMap({})
      setLoading(true)
      const from = format(monthStart, "yyyy-MM-dd")
      const to = format(monthEnd, "yyyy-MM-dd")

      const [workoutsRes, mealsRes, weightRes] = await Promise.all([
        supabase
          .from("workouts")
          .select("date, name, status")
          .eq("user_id", user.id)
          .gte("date", from)
          .lte("date", to),
        supabase
          .from("meals")
          .select("date")
          .eq("user_id", user.id)
          .gte("date", from)
          .lte("date", to),
        supabase
          .from("weight_entries")
          .select("date")
          .eq("user_id", user.id)
          .gte("date", from)
          .lte("date", to),
      ])

      const map: Record<string, DayData> = {}
      const initDay = (date: string) => {
        if (!map[date]) map[date] = { workouts: [], hasNutrition: false, hasWeight: false }
      }

      ;(workoutsRes.data || []).forEach((w: { date: string; name: string | null; status: string }) => {
        initDay(w.date)
        map[w.date].workouts.push({ name: w.name, status: w.status })
      })

      const nutritionDates = new Set((mealsRes.data || []).map((m: { date: string }) => m.date))
      nutritionDates.forEach((d) => { initDay(d); map[d].hasNutrition = true })

      const weightDates = new Set((weightRes.data || []).map((w: { date: string }) => w.date))
      weightDates.forEach((d) => { initDay(d); map[d].hasWeight = true })

      setDayMap(map)
      setLoading(false)
    } catch (err) {
      console.error("Remove duplicates error:", err)
      toast.error("Failed to remove duplicates")
    } finally {
      setRemoving(false)
    }
  }

  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null
  const selectedData = selectedKey ? dayMap[selectedKey] : null

  return (
    <>
      <Header title="Calendar" />
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-bold">{format(currentMonth, "MMMM yyyy")}</h2>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Duplicate Warning */}
        {duplicateCount > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    {duplicateCount} duplicate workout{duplicateCount !== 1 ? "s" : ""} detected
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Looks like a plan was scheduled twice
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveDuplicates}
                disabled={removing}
                className="shrink-0"
              >
                {removing && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                Remove Duplicates
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
              {d}
            </div>
          ))}

          {loading ? (
            Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))
          ) : (
            days.map((day) => {
              const key = format(day, "yyyy-MM-dd")
              const data = dayMap[key]
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isToday = isSameDay(day, new Date())
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
              const hasCompleted = data?.workouts.some((w) => w.status === "completed")
              const hasScheduled = data?.workouts.some((w) => w.status === "scheduled")
              const hasSkipped = data?.workouts.some((w) => w.status === "skipped")

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-sm transition-colors relative",
                    !isCurrentMonth && "text-muted-foreground/40",
                    isToday && "ring-1 ring-primary",
                    isSelected && "bg-primary text-primary-foreground",
                    !isSelected && "hover:bg-accent"
                  )}
                >
                  <span>{format(day, "d")}</span>
                  <div className="flex gap-0.5">
                    {hasCompleted && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                    {hasScheduled && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    {hasSkipped && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                    {data?.hasNutrition && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                    {data?.hasWeight && <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Completed</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Scheduled</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Skipped</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Nutrition</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> Weight</span>
        </div>

        {/* Day Detail */}
        {selectedDate && (
          <div className="space-y-3">
            {/* Workout preview with start/skip/resume/view */}
            {selectedData?.workouts.some((w) => ["scheduled", "in_progress", "completed"].includes(w.status)) && (
              <TodaysWorkout
                date={format(selectedDate, "yyyy-MM-dd")}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>{format(selectedDate, "EEEE, MMMM d, yyyy")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedData ? (
                  <p className="text-sm text-muted-foreground">No data recorded for this day</p>
                ) : (
                  <>
                    {selectedData.workouts.length > 0 && (
                      <div className="space-y-2">
                        {selectedData.workouts.map((w, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Dumbbell className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{w.name || "Workout"}</span>
                            <Badge
                              variant={
                                w.status === "completed" ? "default" :
                                w.status === "scheduled" ? "secondary" : "destructive"
                              }
                              className="text-xs"
                            >
                              {w.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedData.hasNutrition && (
                      <div className="flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Meals logged</span>
                      </div>
                    )}
                    {selectedData.hasWeight && (
                      <div className="flex items-center gap-2">
                        <Scale className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Weight recorded</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
