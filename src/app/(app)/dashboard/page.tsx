"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Scale, UtensilsCrossed, Dumbbell, Footprints,
  Target, TrendingUp, TrendingDown, Minus,
} from "lucide-react"
import Link from "next/link"

interface DashboardData {
  latestWeight: number | null
  weightTrend: 'up' | 'down' | 'flat' | null
  todayCalories: number
  calorieTarget: number | null
  todayProtein: number
  proteinTarget: number | null
  todayWorkout: string | null
  workoutCount: number
  todaySteps: number | null
  activeGoals: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const today = format(new Date(), "yyyy-MM-dd")

  useEffect(() => {
    if (!user) return

    async function fetchDashboard() {
      const [weightRes, nutritionRes, workoutRes, activityRes, goalsRes, targetsRes] = await Promise.all([
        supabase
          .from("weight_entries")
          .select("weight_kg, date")
          .eq("user_id", user!.id)
          .order("date", { ascending: false })
          .limit(7),
        supabase
          .from("meals")
          .select("id, meal_items(calories, protein_g)")
          .eq("user_id", user!.id)
          .eq("date", today),
        supabase
          .from("workouts")
          .select("name, status")
          .eq("user_id", user!.id)
          .eq("date", today)
          .eq("status", "completed"),
        supabase
          .from("activity_entries")
          .select("steps")
          .eq("user_id", user!.id)
          .eq("date", today)
          .single(),
        supabase
          .from("goals")
          .select("id")
          .eq("user_id", user!.id)
          .eq("status", "active"),
        supabase
          .from("nutrition_targets")
          .select("calories, protein_g")
          .eq("user_id", user!.id)
          .eq("is_active", true)
          .single(),
      ])

      const weights = weightRes.data || []
      let weightTrend: 'up' | 'down' | 'flat' | null = null
      if (weights.length >= 2) {
        const diff = weights[0].weight_kg - weights[1].weight_kg
        weightTrend = diff > 0.1 ? 'up' : diff < -0.1 ? 'down' : 'flat'
      }

      type MealWithItems = { id: string; meal_items: { calories: number | null; protein_g: number | null }[] }
      const meals = (nutritionRes.data || []) as MealWithItems[]
      let todayCalories = 0
      let todayProtein = 0
      meals.forEach((meal) => {
        (meal.meal_items || []).forEach((item) => {
          todayCalories += item.calories || 0
          todayProtein += item.protein_g || 0
        })
      })

      const completedWorkouts = workoutRes.data || []

      setData({
        latestWeight: weights.length > 0 ? weights[0].weight_kg : null,
        weightTrend,
        todayCalories: Math.round(todayCalories),
        calorieTarget: targetsRes.data?.calories || null,
        todayProtein: Math.round(todayProtein),
        proteinTarget: targetsRes.data?.protein_g || null,
        todayWorkout: completedWorkouts.length > 0 ? completedWorkouts[0].name : null,
        workoutCount: completedWorkouts.length,
        todaySteps: activityRes.data?.steps || null,
        activeGoals: (goalsRes.data || []).length,
      })
      setLoading(false)
    }

    fetchDashboard()
  }, [user, supabase, today])

  const TrendIcon = data?.weightTrend === 'up' ? TrendingUp
    : data?.weightTrend === 'down' ? TrendingDown : Minus

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-4 lg:p-8 space-y-6">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {/* Weight Card */}
          <Link href="/weight">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Weight</CardTitle>
                <Scale className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : data?.latestWeight ? (
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">
                      {(data.latestWeight * 2.20462).toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">lbs</span>
                    {data.weightTrend && <TrendIcon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                )}
              </CardContent>
            </Card>
          </Link>

          {/* Calories Card */}
          <Link href="/nutrition">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Calories</CardTitle>
                <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div>
                    <span className="text-2xl font-bold">{data?.todayCalories || 0}</span>
                    {data?.calorieTarget && (
                      <span className="text-sm text-muted-foreground ml-1">
                        / {data.calorieTarget}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>

          {/* Protein Card */}
          <Link href="/nutrition">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Protein</CardTitle>
                <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div>
                    <span className="text-2xl font-bold">{data?.todayProtein || 0}g</span>
                    {data?.proteinTarget && (
                      <span className="text-sm text-muted-foreground ml-1">
                        / {data.proteinTarget}g
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>

          {/* Workout Card */}
          <Link href="/workouts">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Workouts</CardTitle>
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : data?.workoutCount ? (
                  <div>
                    <span className="text-2xl font-bold">{data.workoutCount}</span>
                    <p className="text-xs text-muted-foreground truncate">
                      {data.todayWorkout || "completed today"}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No workout yet</p>
                )}
              </CardContent>
            </Card>
          </Link>

          {/* Steps Card */}
          <Link href="/activity">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Steps</CardTitle>
                <Footprints className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <span className="text-2xl font-bold">
                    {data?.todaySteps?.toLocaleString() || "—"}
                  </span>
                )}
              </CardContent>
            </Card>
          </Link>

          {/* Goals Card */}
          <Link href="/goals">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Goals</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div>
                    <span className="text-2xl font-bold">{data?.activeGoals || 0}</span>
                    <span className="text-sm text-muted-foreground ml-1">active</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </>
  )
}
