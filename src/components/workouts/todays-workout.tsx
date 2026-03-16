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
  X,
  CheckCircle2,
  RotateCcw,
  Eye,
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
  duration_minutes: number | null
  total_volume_kg: number | null
  started_at: string | null
  completed_at: string | null
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

    async function fetchTodaysWorkouts() {
      // Fetch ALL workouts for this date (scheduled, in_progress, and completed)
      const { data, error } = await supabase
        .from("workouts")
        .select(
          "id, name, date, status, plan_id, duration_minutes, total_volume_kg, started_at, completed_at, workout_sets(id, exercise_id, set_number, set_type, reps, weight_kg, notes, sort_order)"
        )
        .eq("user_id", user!.id)
        .eq("date", targetDate)
        .in("status", ["scheduled", "in_progress", "completed"])
        .order("created_at", { ascending: true })

      if (error) {
        console.error("Error fetching today's workouts:", error)
        setLoading(false)
        return
      }

      const todaysWorkouts = (data || []) as ScheduledWorkout[]
      setWorkouts(todaysWorkouts)

      // Fetch exercise names for all unique exercise IDs
      const allExerciseIds = new Set<string>()
      todaysWorkouts.forEach((w) => {
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

    fetchTodaysWorkouts()
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
    if (!user) return
    setStarting(true)

    const grouped = groupSets(workout.workout_sets)
    const now = new Date().toISOString()

    // Create a NEW session workout — the scheduled workout stays untouched
    const { data: session, error: sessionError } = await supabase
      .from("workouts")
      .insert({
        user_id: user.id,
        date: workout.date,
        name: workout.name,
        status: "in_progress",
        started_at: now,
        plan_id: workout.plan_id,
      })
      .select("id")
      .single()

    if (sessionError || !session) {
      console.error("Error creating workout session:", sessionError)
      toast.error("Failed to start workout")
      setStarting(false)
      return
    }

    // Copy workout_sets from the scheduled workout to the session
    // (so the session can be rebuilt from DB if localStorage is lost)
    if (workout.workout_sets.length > 0) {
      const sessionSets = workout.workout_sets.map((s) => ({
        workout_id: session.id,
        exercise_id: s.exercise_id,
        set_number: s.set_number,
        set_type: s.set_type,
        reps: s.reps,
        weight_kg: s.weight_kg,
        notes: s.notes,
        sort_order: s.sort_order,
        completed: false,
      }))
      await supabase.from("workout_sets").insert(sessionSets)
    }

    // Build the activeWorkout state — sessionId is the NEW record, not the template
    const workoutState = {
      name: workout.name || `Workout - ${format(new Date(), "MMM d")}`,
      sessionId: session.id,
      startedAt: now,
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

    localStorage.setItem("activeWorkout", JSON.stringify(workoutState))
    router.push("/workouts/active")
  }

  function handleResumeWorkout(inProgressWorkout: ScheduledWorkout) {
    // Check if there's an active workout in localStorage
    const stored = localStorage.getItem("activeWorkout")
    if (stored) {
      router.push("/workouts/active")
    } else {
      // If no localStorage data, rebuild it from the in_progress workout in DB
      const grouped = groupSets(inProgressWorkout.workout_sets)
      const workoutState = {
        name: inProgressWorkout.name || `Workout - ${format(new Date(), "MMM d")}`,
        sessionId: inProgressWorkout.id,
        startedAt: inProgressWorkout.started_at || new Date().toISOString(),
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
      localStorage.setItem("activeWorkout", JSON.stringify(workoutState))
      router.push("/workouts/active")
    }
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
    return null // Don't render anything if no workouts for this date
  }

  // Check if there's an active session (prevents starting a new one)
  const hasActiveSession = workouts.some((w) => w.status === "in_progress")
  // Check if user already completed a session today
  const hasCompletedSession = workouts.some((w) => w.status === "completed")

  // Sort workouts: in_progress first, then scheduled, then completed
  const sortedWorkouts = [...workouts].sort((a, b) => {
    const order: Record<string, number> = { in_progress: 0, scheduled: 1, completed: 2 }
    return (order[a.status] ?? 3) - (order[b.status] ?? 3)
  })

  return (
    <div className={cn("space-y-3", className)}>
      {sortedWorkouts.map((workout) => {
        const grouped = groupSets(workout.workout_sets)
        const totalSets = workout.workout_sets.length
        const totalExercises = grouped.length
        const isInProgress = workout.status === "in_progress"
        const isCompleted = workout.status === "completed"
        const isScheduled = workout.status === "scheduled"

        return (
          <Card
            key={workout.id}
            className={cn(
              isInProgress && "border-yellow-500/30 bg-yellow-500/[0.03]",
              isScheduled && "border-primary/20 bg-primary/[0.02]",
              isCompleted && "border-green-500/20 bg-green-500/[0.02]"
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      "rounded-full p-1.5",
                      isInProgress && "bg-yellow-500/10",
                      isScheduled && "bg-primary/10",
                      isCompleted && "bg-green-500/10"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : isInProgress ? (
                      <RotateCcw className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <Dumbbell className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base truncate">
                        {workout.name || "Workout"}
                      </CardTitle>
                      {isInProgress && (
                        <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/25 shrink-0">
                          In Progress
                        </Badge>
                      )}
                      {isCompleted && (
                        <Badge className="bg-green-500/15 text-green-600 border-green-500/25 shrink-0">
                          Completed
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isCompleted && workout.duration_minutes ? (
                        <>
                          {workout.duration_minutes} min
                          {workout.total_volume_kg
                            ? ` · ${Math.round(workout.total_volume_kg * 2.20462).toLocaleString()} lbs`
                            : ""}
                        </>
                      ) : (
                        <>
                          {totalExercises}{" "}
                          {totalExercises === 1 ? "exercise" : "exercises"} -{" "}
                          {totalSets} {totalSets === 1 ? "set" : "sets"}
                        </>
                      )}
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
              {(compact || expanded) && !isCompleted && (
                <div className="space-y-1">
                  {grouped
                    .slice(0, compact ? 5 : undefined)
                    .map((group) => (
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

              {/* Completed workout summary */}
              {isCompleted && (compact || expanded) && (
                <div className="space-y-1">
                  {grouped
                    .slice(0, compact ? 3 : undefined)
                    .map((group) => (
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
                        </span>
                      </div>
                    ))}
                  {compact && grouped.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{grouped.length - 3} more exercises
                    </p>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {isScheduled && (
                  <>
                    {hasActiveSession ? (
                      <p className="flex-1 text-xs text-muted-foreground text-center py-1.5">
                        Finish your active workout first
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleStartWorkout(workout)}
                        disabled={starting}
                      >
                        <Play className="h-3.5 w-3.5 mr-1.5" />
                        {starting
                          ? "Loading..."
                          : hasCompletedSession
                            ? "Start Again"
                            : "Start Workout"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSkipWorkout(workout)}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Skip
                    </Button>
                  </>
                )}

                {isInProgress && (
                  <Button
                    size="sm"
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                    onClick={() => handleResumeWorkout(workout)}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Resume Workout
                  </Button>
                )}

                {isCompleted && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push(`/workouts/${workout.id}`)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    View Details
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
