"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  Play,
  Dumbbell,
  ChevronDown,
  ChevronUp,
  Clock,
  X,
} from "lucide-react"
import { toast } from "sonner"

interface ScheduledSet {
  id: string
  exercise_id: string
  set_number: number
  set_type: string
  reps: number | null
  weight_kg: number | null
  notes: string | null
  sort_order: number
}

interface ScheduledWorkout {
  id: string
  name: string | null
  date: string
  status: string
  plan_id: string | null
  workout_sets: ScheduledSet[]
}

interface ExerciseInfo {
  id: string
  name: string
}

interface GroupedExercise {
  exerciseId: string
  exerciseName: string
  sets: ScheduledSet[]
}

interface TodaysWorkoutProps {
  /** Date to show workout for, defaults to today */
  date?: string
  /** Whether to show a compact version (for dashboard) vs full version */
  compact?: boolean
  /** Custom class name for the wrapper */
  className?: string
}

export function TodaysWorkout({
  date,
  compact = false,
  className,
}: TodaysWorkoutProps) {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [workouts, setWorkouts] = useState<ScheduledWorkout[]>([])
  const [exercises, setExercises] = useState<Map<string, ExerciseInfo>>(
    new Map()
  )
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(!compact)
  const [starting, setStarting] = useState(false)

  const targetDate = date || format(new Date(), "yyyy-MM-dd")

  useEffect(() => {
    if (!user) return

    async function fetchScheduledWorkouts() {
      const { data, error } = await supabase
        .from("workouts")
        .select(
          "id, name, date, status, plan_id, workout_sets(id, exercise_id, set_number, set_type, reps, weight_kg, notes, sort_order)"
        )
        .eq("user_id", user!.id)
        .eq("date", targetDate)
        .eq("status", "scheduled")
        .order("created_at", { ascending: true })

      if (error) {
        console.error("Error fetching scheduled workouts:", error)
        setLoading(false)
        return
      }

      const scheduled = (data || []) as ScheduledWorkout[]
      setWorkouts(scheduled)

      // Fetch exercise names for all unique exercise IDs
      const allExerciseIds = new Set<string>()
      scheduled.forEach((w) => {
        w.workout_sets.forEach((s) => allExerciseIds.add(s.exercise_id))
      })

      if (allExerciseIds.size > 0) {
        const { data: exData } = await supabase
          .from("exercises")
          .select("id, name")
          .in("id", [...allExerciseIds])

        if (exData) {
          const map = new Map<string, ExerciseInfo>()
          exData.forEach((ex) => map.set(ex.id, ex))
          setExercises(map)
        }
      }

      setLoading(false)
    }

    fetchScheduledWorkouts()
  }, [user, targetDate, supabase])

  function groupSets(sets: ScheduledSet[]): GroupedExercise[] {
    const sorted = [...sets].sort((a, b) => a.sort_order - b.sort_order)
    const groups: GroupedExercise[] = []
    const seen = new Map<string, number>()

    sorted.forEach((set) => {
      const idx = seen.get(set.exercise_id)
      if (idx !== undefined) {
        groups[idx].sets.push(set)
      } else {
        seen.set(set.exercise_id, groups.length)
        groups.push({
          exerciseId: set.exercise_id,
          exerciseName:
            exercises.get(set.exercise_id)?.name || "Unknown Exercise",
          sets: [set],
        })
      }
    })

    return groups
  }

  async function handleStartWorkout(workout: ScheduledWorkout) {
    setStarting(true)

    const grouped = groupSets(workout.workout_sets)

    // Build the activeWorkout state that the active workout page expects
    const workoutState = {
      name: workout.name || `Workout - ${format(new Date(), "MMM d")}`,
      scheduledWorkoutId: workout.id,
      exercises: grouped.map((g) => ({
        exerciseId: g.exerciseId,
        exerciseName: g.exerciseName,
        sets: g.sets.map((s) => ({
          setNumber: s.set_number,
          setType: s.set_type,
          reps: s.reps,
          weight: s.weight_kg
            ? Math.round(s.weight_kg * 2.20462 * 10) / 10
            : null,
          rpe: null,
          completed: false,
        })),
      })),
    }

    // Update workout status to in_progress
    await supabase
      .from("workouts")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", workout.id)

    localStorage.setItem("activeWorkout", JSON.stringify(workoutState))
    router.push("/workouts/active")
  }

  async function handleSkipWorkout(workout: ScheduledWorkout) {
    await supabase
      .from("workouts")
      .update({ status: "skipped" })
      .eq("id", workout.id)

    setWorkouts((prev) => prev.filter((w) => w.id !== workout.id))
    toast.success("Workout skipped")
  }

  if (loading) {
    return <Skeleton className={cn("h-32 w-full", className)} />
  }

  if (workouts.length === 0) {
    return null // Don't render anything if no scheduled workouts
  }

  return (
    <div className={cn("space-y-3", className)}>
      {workouts.map((workout) => {
        const grouped = groupSets(workout.workout_sets)
        const totalSets = workout.workout_sets.length
        const totalExercises = grouped.length

        return (
          <Card
            key={workout.id}
            className="border-primary/20 bg-primary/[0.02]"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="rounded-full bg-primary/10 p-1.5">
                    <Dumbbell className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">
                      {workout.name || "Scheduled Workout"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {totalExercises}{" "}
                      {totalExercises === 1 ? "exercise" : "exercises"} -{" "}
                      {totalSets} {totalSets === 1 ? "set" : "sets"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!compact && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setExpanded(!expanded)}
                    >
                      {expanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Exercise preview - always show in compact, toggle in full */}
              {(compact || expanded) && (
                <div className="space-y-1">
                  {grouped
                    .slice(0, compact ? 5 : undefined)
                    .map((group, i) => (
                      <div
                        key={group.exerciseId}
                        className="flex items-center justify-between text-sm py-1"
                      >
                        <span className="truncate text-muted-foreground">
                          {group.exerciseName}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2 tabular-nums">
                          {group.sets.length}{" "}
                          {group.sets.length === 1 ? "set" : "sets"}
                          {group.sets[0]?.reps && ` × ${group.sets[0].reps}`}
                          {group.sets[0]?.weight_kg && (
                            <>
                              {" "}
                              @{" "}
                              {Math.round(
                                group.sets[0].weight_kg * 2.20462
                              )}{" "}
                              lbs
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                  {compact && grouped.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      +{grouped.length - 5} more exercises
                    </p>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleStartWorkout(workout)}
                  disabled={starting}
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  {starting ? "Loading..." : "Start Workout"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSkipWorkout(workout)}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Skip
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
