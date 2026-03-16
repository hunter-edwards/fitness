"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
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
  Dumbbell,
  Trophy,
  TrendingUp,
  Calendar,
} from "lucide-react"
import Link from "next/link"

interface Exercise {
  id: string
  name: string
  category: string | null
  equipment: string | null
  muscle_groups: string[] | null
  exercise_type: string
  instructions: string | null
  is_custom: boolean
}

interface HistorySet {
  id: string
  set_number: number
  set_type: string
  reps: number | null
  weight_kg: number | null
  rpe: number | null
  completed: boolean
}

interface WorkoutWithSets {
  id: string
  date: string
  name: string | null
  workout_sets: HistorySet[]
}

interface PersonalRecord {
  weight: number | null
  reps: number | null
  volume: number | null
  date: string | null
}

export default function ExerciseDetailPage() {
  const { user } = useAuth()
  const params = useParams()
  const exerciseId = params.id as string
  const supabase = createClient()

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [history, setHistory] = useState<WorkoutWithSets[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !exerciseId) return

    async function fetchData() {
      // Fetch exercise details
      const { data: exData, error: exError } = await supabase
        .from("exercises")
        .select(
          "id, name, category, equipment, muscle_groups, exercise_type, instructions, is_custom"
        )
        .eq("id", exerciseId)
        .single()

      if (exError || !exData) {
        console.error("Error fetching exercise:", exError)
        setLoading(false)
        return
      }

      setExercise(exData as Exercise)

      // Fetch workout history for this exercise
      const { data: setData } = await supabase
        .from("workout_sets")
        .select(
          "id, set_number, set_type, reps, weight_kg, rpe, completed, workout_id, workouts(id, date, name)"
        )
        .eq("exercise_id", exerciseId)
        .eq("completed", true)
        .order("created_at", { ascending: false })
        .limit(200)

      if (setData) {
        // Group by workout
        const workoutMap = new Map<string, WorkoutWithSets>()
        setData.forEach((s: Record<string, unknown>) => {
          const w = s.workouts as { id: string; date: string; name: string | null } | null
          if (!w) return
          if (!workoutMap.has(w.id)) {
            workoutMap.set(w.id, {
              id: w.id,
              date: w.date,
              name: w.name,
              workout_sets: [],
            })
          }
          workoutMap.get(w.id)!.workout_sets.push({
            id: s.id as string,
            set_number: s.set_number as number,
            set_type: s.set_type as string,
            reps: s.reps as number | null,
            weight_kg: s.weight_kg as number | null,
            rpe: s.rpe as number | null,
            completed: s.completed as boolean,
          })
        })

        const sorted = [...workoutMap.values()].sort(
          (a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        setHistory(sorted)
      }

      setLoading(false)
    }

    fetchData()
  }, [user, exerciseId, supabase])

  // Calculate personal records
  const pr: PersonalRecord = (() => {
    let maxWeight: number | null = null
    let maxReps: number | null = null
    let maxVolume: number | null = null
    let prDate: string | null = null

    history.forEach((w) => {
      w.workout_sets.forEach((s) => {
        if (s.weight_kg != null && (maxWeight === null || s.weight_kg > maxWeight)) {
          maxWeight = s.weight_kg
          prDate = w.date
        }
        if (s.reps != null && (maxReps === null || s.reps > maxReps)) {
          maxReps = s.reps
        }
        if (s.weight_kg != null && s.reps != null) {
          const vol = s.weight_kg * s.reps
          if (maxVolume === null || vol > maxVolume) {
            maxVolume = vol
          }
        }
      })
    })

    return { weight: maxWeight, reps: maxReps, volume: maxVolume, date: prDate }
  })()

  if (loading) {
    return (
      <>
        <Header title="Exercise" />
        <div className="p-4 lg:p-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }

  if (!exercise) {
    return (
      <>
        <Header title="Exercise" />
        <div className="p-4 lg:p-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Dumbbell className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Exercise not found</h3>
            <Link href="/workouts/exercises">
              <Button className="mt-4">Back to Exercises</Button>
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title={exercise.name} />
      <div className="p-4 lg:p-8 space-y-6">
        {/* Back + Title */}
        <div className="flex items-center gap-3">
          <Link href="/workouts/exercises">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold truncate">{exercise.name}</h1>
              {exercise.is_custom && (
                <Badge variant="outline" className="shrink-0">
                  Custom
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
              {exercise.category && (
                <span className="capitalize">{exercise.category}</span>
              )}
              {exercise.category && exercise.equipment && <span>-</span>}
              {exercise.equipment && (
                <span className="capitalize">{exercise.equipment}</span>
              )}
            </div>
          </div>
        </div>

        {/* Exercise info */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            {exercise.muscle_groups && exercise.muscle_groups.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Muscle Groups
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {exercise.muscle_groups.map((mg) => (
                    <Badge key={mg} variant="secondary" className="capitalize">
                      {mg}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Type</p>
              <p className="text-sm capitalize">{exercise.exercise_type}</p>
            </div>
            {exercise.instructions && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Instructions
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {exercise.instructions}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Personal records */}
        {history.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Best Weight</p>
                    <p className="text-lg font-bold tabular-nums">
                      {pr.weight != null
                        ? `${Math.round(pr.weight * 2.20462 * 10) / 10} lbs`
                        : "--"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Best Reps</p>
                    <p className="text-lg font-bold tabular-nums">
                      {pr.reps ?? "--"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Best Volume</p>
                    <p className="text-lg font-bold tabular-nums">
                      {pr.volume != null
                        ? `${Math.round(pr.volume * 2.20462).toLocaleString()}`
                        : "--"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No history yet. Complete a workout with this exercise to see
                your progress.
              </div>
            ) : (
              <div className="space-y-4">
                {history.slice(0, 20).map((w) => {
                  const bestSet = w.workout_sets.reduce(
                    (best, s) => {
                      const vol =
                        (s.weight_kg ?? 0) * (s.reps ?? 0)
                      const bestVol =
                        (best.weight_kg ?? 0) * (best.reps ?? 0)
                      return vol > bestVol ? s : best
                    },
                    w.workout_sets[0]
                  )
                  return (
                    <Link
                      key={w.id}
                      href={`/workouts/${w.id}`}
                      className="block"
                    >
                      <div className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors">
                        <div>
                          <p className="text-sm font-medium">
                            {w.name || "Workout"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(w.date), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium tabular-nums">
                            {w.workout_sets.length}{" "}
                            {w.workout_sets.length === 1 ? "set" : "sets"}
                          </p>
                          {bestSet?.weight_kg != null && (
                            <p className="text-xs text-muted-foreground tabular-nums">
                              Best:{" "}
                              {Math.round(
                                bestSet.weight_kg * 2.20462 * 10
                              ) / 10}{" "}
                              lbs x {bestSet.reps}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
