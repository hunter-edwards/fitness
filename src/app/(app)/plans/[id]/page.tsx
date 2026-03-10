"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Clock,
  Timer,
  Trash2,
  Calendar,
  Play,
  ArrowLeft,
} from "lucide-react"

interface PlanExercise {
  id: string
  exercise_name: string
  sets: number | null
  reps: string | null
  weight_suggestion: string | null
  rest_seconds: number | null
  notes: string | null
  sort_order: number
}

interface PlanWorkout {
  id: string
  name: string
  day_of_week: number | null
  sort_order: number
  plan_exercises: PlanExercise[]
}

interface PlanWeek {
  id: string
  week_number: number
  name: string | null
  plan_workouts: PlanWorkout[]
}

interface Plan {
  id: string
  name: string
  description: string | null
  source: string | null
  source_file_name: string | null
  duration_weeks: number | null
  is_active: boolean
  created_at: string
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const DAY_SHORTS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [plan, setPlan] = useState<Plan | null>(null)
  const [weeks, setWeeks] = useState<PlanWeek[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([0]))
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user || !id) return

    async function loadPlan() {
      // Load plan details
      const { data: planData } = await supabase
        .from("workout_plans")
        .select("*")
        .eq("id", id)
        .eq("user_id", user!.id)
        .single()

      if (!planData) {
        router.push("/plans")
        return
      }
      setPlan(planData as Plan)

      // Load weeks with nested workouts and exercises
      const { data: weeksData } = await supabase
        .from("plan_weeks")
        .select(`
          id,
          week_number,
          name,
          plan_workouts (
            id,
            name,
            day_of_week,
            sort_order,
            plan_exercises (
              id,
              exercise_name,
              sets,
              reps,
              weight_suggestion,
              rest_seconds,
              notes,
              sort_order
            )
          )
        `)
        .eq("plan_id", id)
        .order("week_number", { ascending: true })

      if (weeksData) {
        // Sort workouts and exercises within each week
        const sorted = (weeksData as PlanWeek[]).map((week) => ({
          ...week,
          plan_workouts: (week.plan_workouts || [])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((wo) => ({
              ...wo,
              plan_exercises: (wo.plan_exercises || []).sort(
                (a, b) => a.sort_order - b.sort_order
              ),
            })),
        }))
        setWeeks(sorted)
      }

      setLoading(false)
    }

    loadPlan()
  }, [user, id, supabase, router])

  async function handleDelete() {
    if (!plan || !confirm("Delete this plan? This cannot be undone.")) return
    setDeleting(true)
    await supabase.from("workout_plans").delete().eq("id", plan.id)
    router.push("/plans")
  }

  async function handleToggleActive() {
    if (!plan || !user) return
    // Deactivate all other plans first
    if (!plan.is_active) {
      await supabase
        .from("workout_plans")
        .update({ is_active: false })
        .eq("user_id", user.id)
    }
    const { data } = await supabase
      .from("workout_plans")
      .update({ is_active: !plan.is_active })
      .eq("id", plan.id)
      .select()
      .single()
    if (data) setPlan(data as Plan)
  }

  function toggleWeek(idx: number) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function expandAll() {
    setExpandedWeeks(new Set(weeks.map((_, i) => i)))
  }

  function collapseAll() {
    setExpandedWeeks(new Set())
  }

  function formatRest(seconds: number): string {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`
    }
    return `${seconds}s`
  }

  if (loading) {
    return (
      <>
        <Header title="Plan" />
        <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }

  if (!plan) return null

  const totalExercises = weeks.reduce(
    (sum, w) =>
      sum +
      w.plan_workouts.reduce(
        (ws, wo) => ws + wo.plan_exercises.length,
        0
      ),
    0
  )
  const totalWorkouts = weeks.reduce((sum, w) => sum + w.plan_workouts.length, 0)

  return (
    <>
      <Header title={plan.name} />
      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Back button */}
        <Link href="/plans" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          All Plans
        </Link>

        {/* Plan header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">{plan.name}</h1>
            {plan.description && (
              <p className="text-muted-foreground mt-1">{plan.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {plan.is_active && <Badge variant="default">Active</Badge>}
              {plan.duration_weeks && (
                <Badge variant="secondary">
                  <Calendar className="mr-1 h-3 w-3" />
                  {plan.duration_weeks} weeks
                </Badge>
              )}
              <Badge variant="secondary">
                <Dumbbell className="mr-1 h-3 w-3" />
                {totalWorkouts} workouts
              </Badge>
              <Badge variant="secondary">{totalExercises} exercises</Badge>
              {plan.source && <Badge variant="outline">{plan.source}</Badge>}
              {plan.source_file_name && (
                <span className="text-xs text-muted-foreground">
                  from {plan.source_file_name}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={plan.is_active ? "outline" : "default"}
              size="sm"
              onClick={handleToggleActive}
            >
              <Play className="mr-1 h-4 w-4" />
              {plan.is_active ? "Deactivate" : "Set Active"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Week controls */}
        {weeks.length > 1 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
        )}

        {/* Weeks */}
        {weeks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              No weeks found in this plan. Try re-uploading the file.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {weeks.map((week, wi) => (
              <Card key={week.id}>
                <button
                  onClick={() => toggleWeek(wi)}
                  className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors text-left"
                >
                  <div>
                    <span className="font-semibold">
                      Week {week.week_number}
                    </span>
                    {week.name && (
                      <span className="text-muted-foreground ml-2 text-sm">
                        {week.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {week.plan_workouts.length} workouts
                    </Badge>
                    {expandedWeeks.has(wi) ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {expandedWeeks.has(wi) && (
                  <CardContent className="pt-0 space-y-4">
                    <Separator />
                    {week.plan_workouts.map((workout) => (
                      <div
                        key={workout.id}
                        className="border rounded-lg overflow-hidden"
                      >
                        {/* Workout header */}
                        <div className="bg-accent/30 px-4 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Dumbbell className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">
                              {workout.name}
                            </span>
                          </div>
                          {workout.day_of_week !== null && (
                            <Badge variant="outline" className="text-xs">
                              {DAY_NAMES[workout.day_of_week]}
                            </Badge>
                          )}
                        </div>

                        {/* Exercise list */}
                        <div className="divide-y">
                          {workout.plan_exercises.map((ex) => (
                            <div
                              key={ex.id}
                              className="px-4 py-2.5 flex items-start gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">
                                  {ex.exercise_name}
                                </p>
                                {ex.notes && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {ex.notes}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {ex.sets && ex.reps && (
                                  <Badge variant="secondary" className="text-xs font-mono">
                                    {ex.sets}×{ex.reps}
                                  </Badge>
                                )}
                                {!ex.sets && ex.reps && (
                                  <Badge variant="secondary" className="text-xs">
                                    {ex.reps}
                                  </Badge>
                                )}
                                {ex.weight_suggestion && (
                                  <Badge variant="outline" className="text-xs">
                                    {ex.weight_suggestion}
                                  </Badge>
                                )}
                                {ex.rest_seconds && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                    <Timer className="h-3 w-3" />
                                    {formatRest(ex.rest_seconds)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Created {format(new Date(plan.created_at), "MMMM d, yyyy 'at' h:mm a")}
        </p>
      </div>
    </>
  )
}
