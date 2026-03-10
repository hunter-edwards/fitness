"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  Timer,
  Check,
  Circle,
  ChevronRight,
  Square,
  Plus,
  Pause,
  RotateCcw,
} from "lucide-react"

type SetType = "warmup" | "working" | "dropset" | "failure" | "amrap"

interface ActiveSet {
  setNumber: number
  setType: SetType
  reps: number | null
  weight: number | null
  rpe: number | null
  completed: boolean
}

interface ActiveExercise {
  exerciseId: string
  exerciseName: string
  sets: ActiveSet[]
}

interface WorkoutState {
  name: string
  exercises: ActiveExercise[]
}

const REST_OPTIONS = [60, 90, 120, 180] as const

const setTypeConfig: Record<SetType, { label: string; short: string; color: string }> = {
  warmup: { label: "Warm-up", short: "W", color: "text-yellow-400" },
  working: { label: "Working", short: "S", color: "text-foreground" },
  dropset: { label: "Drop Set", short: "D", color: "text-purple-400" },
  failure: { label: "Failure", short: "F", color: "text-red-400" },
  amrap: { label: "AMRAP", short: "A", color: "text-orange-400" },
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default function ActiveWorkoutPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [workout, setWorkout] = useState<WorkoutState | null>(null)
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [restSeconds, setRestSeconds] = useState(0)
  const [restDuration, setRestDuration] = useState<number>(90)
  const [isResting, setIsResting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [startedAt] = useState(() => new Date().toISOString())

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load workout state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("activeWorkout")
    if (stored) {
      try {
        const parsed: WorkoutState = JSON.parse(stored)
        setWorkout(parsed)
      } catch {
        router.push("/workouts/new")
      }
    } else {
      router.push("/workouts/new")
    }
  }, [router])

  // Elapsed time timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Rest timer
  useEffect(() => {
    if (isResting && restSeconds > 0) {
      restTimerRef.current = setInterval(() => {
        setRestSeconds((prev) => {
          if (prev <= 1) {
            setIsResting(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => {
        if (restTimerRef.current) clearInterval(restTimerRef.current)
      }
    }
  }, [isResting, restSeconds])

  // Persist state to localStorage on changes
  useEffect(() => {
    if (workout) {
      localStorage.setItem("activeWorkout", JSON.stringify(workout))
    }
  }, [workout])

  const currentExercise = workout?.exercises[currentExerciseIndex]

  const updateSet = useCallback(
    (
      setIndex: number,
      data: Partial<{ reps: number | null; weight: number | null; rpe: number | null; setType: SetType }>
    ) => {
      setWorkout((prev) => {
        if (!prev) return prev
        const exercises = [...prev.exercises]
        const ex = { ...exercises[currentExerciseIndex] }
        const sets = [...ex.sets]
        sets[setIndex] = { ...sets[setIndex], ...data }
        ex.sets = sets
        exercises[currentExerciseIndex] = ex
        return { ...prev, exercises }
      })
    },
    [currentExerciseIndex]
  )

  const completeSet = useCallback(
    (setIndex: number) => {
      setWorkout((prev) => {
        if (!prev) return prev
        const exercises = [...prev.exercises]
        const ex = { ...exercises[currentExerciseIndex] }
        const sets = [...ex.sets]
        sets[setIndex] = { ...sets[setIndex], completed: !sets[setIndex].completed }
        ex.sets = sets
        exercises[currentExerciseIndex] = ex
        return { ...prev, exercises }
      })

      // Start rest timer if completing a set (marking as done)
      if (workout?.exercises[currentExerciseIndex].sets[setIndex] && !workout.exercises[currentExerciseIndex].sets[setIndex].completed) {
        setRestSeconds(restDuration)
        setIsResting(true)
      }
    },
    [currentExerciseIndex, workout, restDuration]
  )

  const addSet = useCallback(() => {
    setWorkout((prev) => {
      if (!prev) return prev
      const exercises = [...prev.exercises]
      const ex = { ...exercises[currentExerciseIndex] }
      const nextNum = ex.sets.length + 1
      ex.sets = [
        ...ex.sets,
        {
          setNumber: nextNum,
          setType: "working" as SetType,
          reps: null,
          weight: null,
          rpe: null,
          completed: false,
        },
      ]
      exercises[currentExerciseIndex] = ex
      return { ...prev, exercises }
    })
  }, [currentExerciseIndex])

  const nextExercise = useCallback(() => {
    if (!workout) return
    if (currentExerciseIndex < workout.exercises.length - 1) {
      setCurrentExerciseIndex((prev) => prev + 1)
      setIsResting(false)
      setRestSeconds(0)
    }
  }, [currentExerciseIndex, workout])

  const prevExercise = useCallback(() => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex((prev) => prev - 1)
      setIsResting(false)
      setRestSeconds(0)
    }
  }, [currentExerciseIndex])

  const skipRest = useCallback(() => {
    setIsResting(false)
    setRestSeconds(0)
  }, [])

  const handleFinish = async () => {
    if (!user || !workout) return

    setSaving(true)
    try {
      const now = new Date().toISOString()
      const today = format(new Date(), "yyyy-MM-dd")
      const durationMinutes = Math.round(elapsedSeconds / 60)

      // Calculate total volume in kg (convert lbs to kg)
      let totalVolumeKg = 0
      workout.exercises.forEach((ex) => {
        ex.sets.forEach((s) => {
          if (s.completed && s.weight && s.reps) {
            totalVolumeKg += (s.weight / 2.20462) * s.reps
          }
        })
      })

      // Create workout record
      const { data: workoutRecord, error: workoutError } = await supabase
        .from("workouts")
        .insert({
          user_id: user.id,
          date: today,
          name: workout.name || null,
          status: "completed" as const,
          started_at: startedAt,
          completed_at: now,
          duration_minutes: durationMinutes,
          total_volume_kg: Math.round(totalVolumeKg * 100) / 100,
        })
        .select("id")
        .single()

      if (workoutError || !workoutRecord) {
        console.error("Error creating workout:", workoutError)
        setSaving(false)
        return
      }

      // Create all workout sets (convert lbs to kg for storage)
      const setsToInsert = workout.exercises.flatMap((ex, exIdx) =>
        ex.sets.map((s, sIdx) => ({
          workout_id: workoutRecord.id,
          exercise_id: ex.exerciseId,
          set_number: s.setNumber,
          set_type: s.setType,
          reps: s.reps,
          weight_kg: s.weight
            ? Math.round((s.weight / 2.20462) * 100) / 100
            : null,
          rpe: s.rpe,
          completed: s.completed,
          sort_order: exIdx * 100 + sIdx,
        }))
      )

      const { error: setsError } = await supabase
        .from("workout_sets")
        .insert(setsToInsert)

      if (setsError) {
        console.error("Error creating sets:", setsError)
      }

      // Clean up localStorage
      localStorage.removeItem("activeWorkout")
      router.push("/workouts")
    } catch (err) {
      console.error("Error finishing workout:", err)
    } finally {
      setSaving(false)
    }
  }

  if (!workout || !currentExercise) {
    return (
      <>
        <Header title="Active Workout" />
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Loading workout...</p>
        </div>
      </>
    )
  }

  const totalSets = workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.length,
    0
  )
  const completedSets = workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
    0
  )
  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0

  const currentSetIndex = currentExercise.sets.findIndex(
    (s) => !s.completed
  )
  const currentSetNum =
    currentSetIndex >= 0 ? currentSetIndex + 1 : currentExercise.sets.length

  return (
    <>
      <Header title="Active Workout" />
      <div className="p-4 lg:p-8 space-y-4">
        {/* Top bar: timer + progress */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <span className="text-2xl font-mono font-bold tabular-nums">
              {formatTime(elapsedSeconds)}
            </span>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{workout.name}</p>
            <p className="text-xs text-muted-foreground">
              {completedSets}/{totalSets} sets
            </p>
          </div>
        </div>

        <Progress value={progressPercent} className="h-2" />

        {/* Rest timer overlay */}
        {isResting && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Rest
                  </p>
                  <p className="text-3xl font-mono font-bold tabular-nums text-primary">
                    {formatTime(restSeconds)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Rest duration selector */}
                <div className="flex gap-1">
                  {REST_OPTIONS.map((sec) => (
                    <button
                      key={sec}
                      onClick={() => {
                        setRestDuration(sec)
                        setRestSeconds(sec)
                      }}
                      className={cn(
                        "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                        restDuration === sec
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={skipRest}>
                  Skip
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Exercise navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevExercise}
            disabled={currentExerciseIndex === 0}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Prev
          </Button>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Exercise {currentExerciseIndex + 1} of{" "}
              {workout.exercises.length}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={nextExercise}
            disabled={
              currentExerciseIndex >= workout.exercises.length - 1
            }
          >
            Next
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>

        {/* Current exercise */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">
                {currentExercise.exerciseName}
              </CardTitle>
              <Badge variant="secondary">
                Set {currentSetNum}/{currentExercise.sets.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Column headers */}
            <div className="flex items-center gap-2 px-3 text-xs text-muted-foreground">
              <span className="w-8 text-center">#</span>
              <span className="flex-1 text-center">Weight (lbs)</span>
              <span className="flex-1 text-center">Reps</span>
              <span className="w-14 text-center">RPE</span>
              <span className="w-7" />
            </div>

            {currentExercise.sets.map((set, idx) => {
              const typeConf = setTypeConfig[set.setType]
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                    set.completed
                      ? "border-green-500/25 bg-green-500/5"
                      : idx === currentSetIndex
                        ? "border-primary/30 bg-primary/5"
                        : "border-border"
                  )}
                >
                  {/* Set number with type indicator */}
                  <div className="w-8 text-center shrink-0">
                    <span
                      className={cn(
                        "text-xs font-bold",
                        typeConf.color
                      )}
                    >
                      {typeConf.short}
                      {set.setNumber}
                    </span>
                  </div>

                  {/* Weight */}
                  <div className="flex-1 min-w-0">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="lbs"
                      value={set.weight ?? ""}
                      onChange={(e) =>
                        updateSet(idx, {
                          weight: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      className="h-8 text-center text-sm"
                      disabled={set.completed}
                    />
                  </div>

                  {/* Reps */}
                  <div className="flex-1 min-w-0">
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="reps"
                      value={set.reps ?? ""}
                      onChange={(e) =>
                        updateSet(idx, {
                          reps: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      className="h-8 text-center text-sm"
                      disabled={set.completed}
                    />
                  </div>

                  {/* RPE */}
                  <div className="w-14 shrink-0">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="RPE"
                      min={1}
                      max={10}
                      step={0.5}
                      value={set.rpe ?? ""}
                      onChange={(e) =>
                        updateSet(idx, {
                          rpe: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      className="h-8 text-center text-xs"
                      disabled={set.completed}
                    />
                  </div>

                  {/* Complete toggle */}
                  <Button
                    variant={set.completed ? "default" : "outline"}
                    size="icon-sm"
                    className={cn(
                      "shrink-0",
                      set.completed &&
                        "bg-green-600 hover:bg-green-700 text-white"
                    )}
                    onClick={() => completeSet(idx)}
                  >
                    {set.completed ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )
            })}

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={addSet}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Set
            </Button>
          </CardContent>
        </Card>

        {/* Exercise list (quick nav) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              All Exercises
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {workout.exercises.map((ex, idx) => {
              const exCompleted = ex.sets.every((s) => s.completed)
              const exPartial =
                ex.sets.some((s) => s.completed) && !exCompleted
              return (
                <button
                  key={ex.exerciseId}
                  onClick={() => {
                    setCurrentExerciseIndex(idx)
                    setIsResting(false)
                    setRestSeconds(0)
                  }}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    idx === currentExerciseIndex
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {exCompleted ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : exPartial ? (
                      <Pause className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="truncate">{ex.exerciseName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {ex.sets.filter((s) => s.completed).length}/
                    {ex.sets.length}
                  </span>
                </button>
              )
            })}
          </CardContent>
        </Card>

        {/* Finish button */}
        <div className="flex flex-col gap-2 pt-2 pb-8">
          <Button
            size="lg"
            onClick={handleFinish}
            disabled={saving}
            className="w-full"
          >
            <Square className="h-4 w-4 mr-1.5" />
            {saving ? "Saving..." : "Finish Workout"}
          </Button>
        </div>
      </div>
    </>
  )
}

