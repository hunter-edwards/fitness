"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WorkoutCard, type WorkoutCardData } from "@/components/workouts/workout-card"
import { Plus, Dumbbell } from "lucide-react"
import Link from "next/link"

export default function WorkoutsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [workouts, setWorkouts] = useState<WorkoutCardData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function fetchWorkouts() {
      // Fetch workouts with their exercise counts
      const { data: workoutRows, error } = await supabase
        .from("workouts")
        .select("id, name, date, status, duration_minutes, total_volume_kg, workout_sets(exercise_id)")
        .eq("user_id", user!.id)
        .order("date", { ascending: false })
        .limit(50)

      if (error) {
        console.error("Error fetching workouts:", error)
        setLoading(false)
        return
      }

      const mapped: WorkoutCardData[] = (workoutRows || []).map((w) => {
        // Count unique exercises in the workout
        const exerciseIds = new Set(
          (w.workout_sets as { exercise_id: string }[] || []).map(
            (s) => s.exercise_id
          )
        )
        return {
          id: w.id,
          name: w.name,
          date: w.date,
          duration_minutes: w.duration_minutes,
          total_volume_kg: w.total_volume_kg,
          exercise_count: exerciseIds.size,
          status: w.status as WorkoutCardData["status"],
        }
      })

      setWorkouts(mapped)
      setLoading(false)
    }

    fetchWorkouts()
  }, [user, supabase])

  return (
    <>
      <Header title="Workouts" />
      <div className="p-4 lg:p-8 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="hidden lg:block">
            <h1 className="text-3xl font-bold">Workouts</h1>
            <p className="text-muted-foreground">
              Track and review your training sessions
            </p>
          </div>
          <Link href="/workouts/new">
            <Button size="lg">
              <Plus className="h-4 w-4 mr-1.5" />
              New Workout
            </Button>
          </Link>
        </div>

        {/* Workout list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : workouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Dumbbell className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No workouts yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Start your first workout to begin tracking your progress
            </p>
            <Link href="/workouts/new">
              <Button>
                <Plus className="h-4 w-4 mr-1.5" />
                Start Workout
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {workouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onClick={(id) => router.push(`/workouts/${id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
