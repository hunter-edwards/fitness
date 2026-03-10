"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  ExercisePicker,
  type ExerciseItem,
} from "@/components/workouts/exercise-picker"
import { SetLogger, type SetType } from "@/components/workouts/set-logger"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Plus,
  X,
  Play,
  Save,
  ArrowLeft,
  Dumbbell,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import Link from "next/link"

interface WorkoutExercise {
  exercise: ExerciseItem
  sets: {
    setNumber: number
    setType: SetType
    reps: number | null
    weight: number | null
    rpe: number | null
    completed: boolean
  }[]
  expanded: boolean
}

export default function NewWorkoutPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [workoutName, setWorkoutName] = useState("")
  const [exercises, setExercises] = useState<ExerciseItem[]>([])
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>(
    []
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Fetch available exercises
  useEffect(() => {
    if (!user) return

    async function fetchExercises() {
      const { data } = await supabase
        .from("exercises")
        .select("id, name, category, equipment, muscle_groups")
        .or(`user_id.eq.${user!.id},is_custom.eq.false`)
        .order("name")

      if (data) setExercises(data)
    }

    fetchExercises()
  }, [user, supabase])

  const addExercise = useCallback((exercise: ExerciseItem) => {
    setWorkoutExercises((prev) => {
      // Don't add duplicates
      if (prev.some((we) => we.exercise.id === exercise.id)) return prev
      return [
        ...prev,
        {
          exercise,
          sets: [
            {
              setNumber: 1,
              setType: "working" as SetType,
              reps: null,
              weight: null,
              rpe: null,
              completed: false,
            },
          ],
          expanded: true,
        },
      ]
    })
    setPickerOpen(false)
  }, [])

  const removeExercise = useCallback((exerciseId: string) => {
    setWorkoutExercises((prev) =>
      prev.filter((we) => we.exercise.id !== exerciseId)
    )
  }, [])

  const toggleExpanded = useCallback((exerciseId: string) => {
    setWorkoutExercises((prev) =>
      prev.map((we) =>
        we.exercise.id === exerciseId
          ? { ...we, expanded: !we.expanded }
          : we
      )
    )
  }, [])

  const addSet = useCallback((exerciseId: string) => {
    setWorkoutExercises((prev) =>
      prev.map((we) => {
        if (we.exercise.id !== exerciseId) return we
        const nextNum = we.sets.length + 1
        return {
          ...we,
          sets: [
            ...we.sets,
            {
              setNumber: nextNum,
              setType: "working" as SetType,
              reps: null,
              weight: null,
              rpe: null,
              completed: false,
            },
          ],
        }
      })
    )
  }, [])

  const updateSet = useCallback(
    (
      exerciseId: string,
      setIndex: number,
      data: Partial<{ setType: SetType; reps: number | null; weight: number | null; rpe: number | null }>
    ) => {
      setWorkoutExercises((prev) =>
        prev.map((we) => {
          if (we.exercise.id !== exerciseId) return we
          const newSets = [...we.sets]
          newSets[setIndex] = { ...newSets[setIndex], ...data }
          return { ...we, sets: newSets }
        })
      )
    },
    []
  )

  const toggleSetComplete = useCallback(
    (exerciseId: string, setIndex: number) => {
      setWorkoutExercises((prev) =>
        prev.map((we) => {
          if (we.exercise.id !== exerciseId) return we
          const newSets = [...we.sets]
          newSets[setIndex] = {
            ...newSets[setIndex],
            completed: !newSets[setIndex].completed,
          }
          return { ...we, sets: newSets }
        })
      )
    },
    []
  )

  const handleStartWorkout = () => {
    // Save state to localStorage for the active page to pick up
    const workoutState = {
      name: workoutName || `Workout - ${format(new Date(), "MMM d")}`,
      exercises: workoutExercises.map((we) => ({
        exerciseId: we.exercise.id,
        exerciseName: we.exercise.name,
        sets: we.sets,
      })),
    }
    localStorage.setItem("activeWorkout", JSON.stringify(workoutState))
    router.push("/workouts/active")
  }

  const handleSaveCompleted = async () => {
    if (!user || workoutExercises.length === 0) return

    setSaving(true)
    try {
      const now = new Date().toISOString()
      const today = format(new Date(), "yyyy-MM-dd")

      // Calculate total volume (convert lbs to kg for storage)
      let totalVolumeKg = 0
      workoutExercises.forEach((we) => {
        we.sets.forEach((s) => {
          if (s.weight && s.reps) {
            totalVolumeKg += (s.weight / 2.20462) * s.reps
          }
        })
      })

      // Create workout record
      const { data: workout, error: workoutError } = await supabase
        .from("workouts")
        .insert({
          user_id: user.id,
          date: today,
          name: workoutName || null,
          status: "completed" as const,
          started_at: now,
          completed_at: now,
          total_volume_kg: Math.round(totalVolumeKg * 100) / 100,
        })
        .select("id")
        .single()

      if (workoutError || !workout) {
        console.error("Error creating workout:", workoutError)
        setSaving(false)
        return
      }

      // Create workout sets
      const setsToInsert = workoutExercises.flatMap((we, exIdx) =>
        we.sets.map((s, sIdx) => ({
          workout_id: workout.id,
          exercise_id: we.exercise.id,
          set_number: s.setNumber,
          set_type: s.setType,
          reps: s.reps,
          weight_kg: s.weight ? Math.round((s.weight / 2.20462) * 100) / 100 : null,
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

      router.push("/workouts")
    } catch (err) {
      console.error("Error saving workout:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Header title="New Workout" />
      <div className="p-4 lg:p-8 space-y-6">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <Link href="/workouts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="hidden lg:block">
            <h1 className="text-3xl font-bold">New Workout</h1>
            <p className="text-muted-foreground">
              Build your workout and start training
            </p>
          </div>
        </div>

        {/* Workout name */}
        <div className="space-y-2">
          <Label htmlFor="workout-name">Workout Name (optional)</Label>
          <Input
            id="workout-name"
            placeholder="e.g. Push Day, Upper Body, Leg Day..."
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
          />
        </div>

        <Separator />

        {/* Exercise list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Exercises</h2>
            <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
              <DialogTrigger
                render={
                  <Button variant="outline" size="sm">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Exercise
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Exercise</DialogTitle>
                </DialogHeader>
                <ExercisePicker
                  exercises={exercises}
                  onSelect={addExercise}
                  selectedIds={workoutExercises.map((we) => we.exercise.id)}
                />
              </DialogContent>
            </Dialog>
          </div>

          {workoutExercises.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Dumbbell className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Add exercises to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            workoutExercises.map((we) => (
              <Card key={we.exercise.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleExpanded(we.exercise.id)}
                      className="flex items-center gap-2 text-left"
                    >
                      {we.expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <CardTitle>{we.exercise.name}</CardTitle>
                      <span className="text-xs text-muted-foreground">
                        {we.sets.length} {we.sets.length === 1 ? "set" : "sets"}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeExercise(we.exercise.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                {we.expanded && (
                  <CardContent className="space-y-2">
                    {/* Column headers */}
                    <div className="flex items-center gap-2 px-3 text-xs text-muted-foreground">
                      <span className="w-16">Type</span>
                      <span className="flex-1 text-center">Weight (lbs)</span>
                      <span className="flex-1 text-center">Reps</span>
                      <span className="w-12 text-center">RPE</span>
                      <span className="w-7" />
                    </div>

                    {we.sets.map((set, idx) => (
                      <SetLogger
                        key={idx}
                        setNumber={set.setNumber}
                        setType={set.setType}
                        reps={set.reps}
                        weight={set.weight}
                        rpe={set.rpe}
                        completed={set.completed}
                        onChange={(data) =>
                          updateSet(we.exercise.id, idx, data)
                        }
                        onComplete={() =>
                          toggleSetComplete(we.exercise.id, idx)
                        }
                      />
                    ))}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => addSet(we.exercise.id)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Set
                    </Button>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Action buttons */}
        {workoutExercises.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={handleSaveCompleted}
              disabled={saving}
              className="sm:order-1"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? "Saving..." : "Save as Completed"}
            </Button>
            <Button onClick={handleStartWorkout} className="sm:order-2">
              <Play className="h-4 w-4 mr-1.5" />
              Start Workout
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
