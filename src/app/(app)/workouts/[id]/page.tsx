"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Dumbbell,
  Weight,
} from "lucide-react"
import Link from "next/link"

interface WorkoutSet {
  id: string
  exercise_id: string
  set_number: number
  set_type: "warmup" | "working" | "dropset" | "failure" | "amrap"
  reps: number | null
  weight_kg: number | null
  rpe: number | null
  completed: boolean
  sort_order: number
}

interface WorkoutDetail {
  id: string
  name: string | null
  date: string
  notes: string | null
  status: "scheduled" | "in_progress" | "completed" | "skipped"
  started_at: string | null
  completed_at: string | null
  duration_minutes: number | null
  total_volume_kg: number | null
  calories_burned: number | null
  workout_sets: WorkoutSet[]
}

interface ExerciseInfo {
  id: string
  name: string
  category: string | null
  equipment: string | null
}

interface GroupedExercise {
  exercise: ExerciseInfo
  sets: WorkoutSet[]
}

const setTypeConfig: Record<string, { label: string; short: string; color: string }> = {
  warmup: { label: "Warm-up", short: "W", color: "text-yellow-400" },
  working: { label: "Working", short: "S", color: "text-foreground" },
  dropset: { label: "Drop Set", short: "D", color: "text-purple-400" },
  failure: { label: "Failure", short: "F", color: "text-red-400" },
  amrap: { label: "AMRAP", short: "A", color: "text-orange-400" },
}

const statusConfig: Record<string, { label: string; className: string }> = {
  completed: {
    label: "Completed",
    className: "bg-green-500/15 text-green-400 border-green-500/25",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  },
  skipped: {
    label: "Skipped",
    className: "bg-red-500/15 text-red-400 border-red-500/25",
  },
}

export default function WorkoutDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const workoutId = params.id as string
  const supabase = createClient()

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null)
  const [exercises, setExercises] = useState<Map<string, ExerciseInfo>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !workoutId) return

    async function fetchWorkout() {
      const { data, error } = await supabase
        .from("workouts")
        .select(
          "id, name, date, notes, status, started_at, completed_at, duration_minutes, total_volume_kg, calories_burned, workout_sets(id, exercise_id, set_number, set_type, reps, weight_kg, rpe, completed, sort_order)"
        )
        .eq("id", workoutId)
        .eq("user_id", user!.id)
        .single()

      if (error || !data) {
        console.error("Error fetching workout:", error)
        setLoading(false)
        return
      }

      setWorkout(data as WorkoutDetail)

      // Fetch exercise info for all unique exercise IDs
      const exerciseIds = [
        ...new Set(
          (data.workout_sets as WorkoutSet[]).map((s) => s.exercise_id)
        ),
      ]

      if (exerciseIds.length > 0) {
        const { data: exerciseData } = await supabase
          .from("exercises")
          .select("id, name, category, equipment")
          .in("id", exerciseIds)

        if (exerciseData) {
          const map = new Map<string, ExerciseInfo>()
          exerciseData.forEach((ex) => map.set(ex.id, ex))
          setExercises(map)
        }
      }

      setLoading(false)
    }

    fetchWorkout()
  }, [user, workoutId, supabase])

  // Group sets by exercise, maintaining sort order
  const groupedExercises: GroupedExercise[] = (() => {
    if (!workout) return []
    const sorted = [...workout.workout_sets].sort(
      (a, b) => a.sort_order - b.sort_order
    )
    const groups: GroupedExercise[] = []
    const seen = new Map<string, number>()

    sorted.forEach((set) => {
      const idx = seen.get(set.exercise_id)
      if (idx !== undefined) {
        groups[idx].sets.push(set)
      } else {
        seen.set(set.exercise_id, groups.length)
        groups.push({
          exercise: exercises.get(set.exercise_id) || {
            id: set.exercise_id,
            name: "Unknown Exercise",
            category: null,
            equipment: null,
          },
          sets: [set],
        })
      }
    })

    return groups
  })()

  const volumeLbs = workout?.total_volume_kg
    ? Math.round(workout.total_volume_kg * 2.20462)
    : null

  const status = workout ? statusConfig[workout.status] : null

  if (loading) {
    return (
      <>
        <Header title="Workout" />
        <div className="p-4 lg:p-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }

  if (!workout) {
    return (
      <>
        <Header title="Workout" />
        <div className="p-4 lg:p-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Dumbbell className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Workout not found</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              This workout may have been deleted
            </p>
            <Link href="/workouts">
              <Button>Back to Workouts</Button>
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title={workout.name || "Workout"} />
      <div className="p-4 lg:p-8 space-y-6">
        {/* Back + Title */}
        <div className="flex items-center gap-3">
          <Link href="/workouts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold truncate">
                {workout.name || "Workout"}
              </h1>
              {status && (
                <Badge className={cn("shrink-0", status.className)}>
                  {status.label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>{format(new Date(workout.date), "EEEE, MMMM d, yyyy")}</span>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-lg font-bold tabular-nums">
                    {workout.duration_minutes
                      ? `${workout.duration_minutes} min`
                      : "--"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Weight className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Volume</p>
                  <p className="text-lg font-bold tabular-nums">
                    {volumeLbs
                      ? `${volumeLbs.toLocaleString()} lbs`
                      : "--"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Exercises</p>
                  <p className="text-lg font-bold tabular-nums">
                    {groupedExercises.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        {workout.notes && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">{workout.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Exercises */}
        <div className="space-y-4">
          {groupedExercises.map((group, gIdx) => {
            const completedSets = group.sets.filter((s) => s.completed).length
            return (
              <Card key={gIdx}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {group.exercise.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {group.exercise.category && (
                          <span className="capitalize">
                            {group.exercise.category}
                          </span>
                        )}
                        {group.exercise.category &&
                          group.exercise.equipment && <span>-</span>}
                        {group.exercise.equipment && (
                          <span className="capitalize">
                            {group.exercise.equipment}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {completedSets}/{group.sets.length} sets
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Column headers */}
                  <div className="flex items-center gap-2 px-3 pb-1 text-xs text-muted-foreground border-b mb-1">
                    <span className="w-10">Set</span>
                    <span className="flex-1 text-center">Weight</span>
                    <span className="flex-1 text-center">Reps</span>
                    <span className="w-12 text-center">RPE</span>
                  </div>

                  {group.sets.map((set, sIdx) => {
                    const typeConf = setTypeConfig[set.set_type] || setTypeConfig.working
                    const weightLbs = set.weight_kg
                      ? Math.round(set.weight_kg * 2.20462 * 10) / 10
                      : null
                    return (
                      <div
                        key={set.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                          set.completed
                            ? "bg-green-500/5"
                            : "opacity-50"
                        )}
                      >
                        <span
                          className={cn(
                            "w-10 font-medium text-xs",
                            typeConf.color
                          )}
                        >
                          {typeConf.short}{set.set_number}
                        </span>
                        <span className="flex-1 text-center tabular-nums font-medium">
                          {weightLbs != null ? `${weightLbs} lbs` : "--"}
                        </span>
                        <span className="flex-1 text-center tabular-nums font-medium">
                          {set.reps != null ? set.reps : "--"}
                        </span>
                        <span className="w-12 text-center tabular-nums text-muted-foreground">
                          {set.rpe != null ? set.rpe : "--"}
                        </span>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Empty state */}
        {groupedExercises.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Dumbbell className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                No exercises recorded for this workout
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
