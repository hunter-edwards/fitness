"use client"

import { useEffect, useState } from "react"
import { format, subDays, differenceInDays, startOfWeek, endOfWeek } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
  Scale, UtensilsCrossed, Dumbbell, Footprints,
  Target, TrendingUp, TrendingDown, Minus,
  Flame, ChevronRight, Plus, Zap,
} from "lucide-react"
import Link from "next/link"
import { TodaysWorkout } from "@/components/workouts/todays-workout"

interface DashboardData {
  latestWeight: number | null
  weightTrend: "up" | "down" | "flat" | null
  todayCalories: number
  calorieTarget: number | null
  todayProtein: number
  proteinTarget: number | null
  todayWorkout: string | null
  workoutCount: number
  todaySteps: number | null
  activeGoals: number
}

interface StreakData {
  workoutStreak: number
  loggingStreak: number
}

interface WeeklySummary {
  workoutsCompleted: number
  workoutsScheduled: number
  avgCalories: number
  calorieTarget: number | null
  totalVolumeLbs: number
  weightChange: number | null
}

interface QuickAction {
  label: string
  description: string
  href: string
  icon: React.ReactNode
  priority: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [streaks, setStreaks] = useState<StreakData | null>(null)
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null)
  const [quickActions, setQuickActions] = useState<QuickAction[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const today = format(new Date(), "yyyy-MM-dd")

  useEffect(() => {
    if (!user) return

    async function fetchDashboard() {
      const weekStart = format(startOfWeek(new Date()), "yyyy-MM-dd")
      const weekEnd = format(endOfWeek(new Date()), "yyyy-MM-dd")
      const streak30 = format(subDays(new Date(), 30), "yyyy-MM-dd")

      const [
        weightRes,
        nutritionRes,
        workoutRes,
        activityRes,
        goalsRes,
        targetsRes,
        streakWorkoutsRes,
        streakMealsRes,
        streakWeightRes,
        weekWorkoutsRes,
        weekNutritionRes,
        weekWeightRes,
      ] = await Promise.all([
        // Existing dashboard data
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
        // Streak data - last 30 days of workouts
        supabase
          .from("workouts")
          .select("date")
          .eq("user_id", user!.id)
          .eq("status", "completed")
          .gte("date", streak30)
          .order("date", { ascending: false }),
        // Streak data - last 30 days of meals
        supabase
          .from("meals")
          .select("date")
          .eq("user_id", user!.id)
          .gte("date", streak30)
          .order("date", { ascending: false }),
        // Streak data - last 30 days of weight
        supabase
          .from("weight_entries")
          .select("date")
          .eq("user_id", user!.id)
          .gte("date", streak30)
          .order("date", { ascending: false }),
        // Weekly summary - workouts
        supabase
          .from("workouts")
          .select("status, total_volume_kg")
          .eq("user_id", user!.id)
          .gte("date", weekStart)
          .lte("date", weekEnd),
        // Weekly summary - nutrition
        supabase
          .from("meals")
          .select("date, meal_items(calories)")
          .eq("user_id", user!.id)
          .gte("date", weekStart)
          .lte("date", weekEnd),
        // Weekly summary - weight (start + end of week)
        supabase
          .from("weight_entries")
          .select("weight_kg, date")
          .eq("user_id", user!.id)
          .gte("date", weekStart)
          .lte("date", weekEnd)
          .order("date", { ascending: true }),
      ])

      // === Existing dashboard data ===
      const weights = weightRes.data || []
      let weightTrend: "up" | "down" | "flat" | null = null
      if (weights.length >= 2) {
        const diff = weights[0].weight_kg - weights[1].weight_kg
        weightTrend = diff > 0.1 ? "up" : diff < -0.1 ? "down" : "flat"
      }

      type MealWithItems = {
        id: string
        meal_items: { calories: number | null; protein_g: number | null }[]
      }
      const meals = (nutritionRes.data || []) as MealWithItems[]
      let todayCalories = 0
      let todayProtein = 0
      meals.forEach((meal) => {
        ;(meal.meal_items || []).forEach((item) => {
          todayCalories += item.calories || 0
          todayProtein += item.protein_g || 0
        })
      })

      const completedWorkouts = workoutRes.data || []

      const dashData: DashboardData = {
        latestWeight: weights.length > 0 ? weights[0].weight_kg : null,
        weightTrend,
        todayCalories: Math.round(todayCalories),
        calorieTarget: targetsRes.data?.calories || null,
        todayProtein: Math.round(todayProtein),
        proteinTarget: targetsRes.data?.protein_g || null,
        todayWorkout:
          completedWorkouts.length > 0 ? completedWorkouts[0].name : null,
        workoutCount: completedWorkouts.length,
        todaySteps: activityRes.data?.steps || null,
        activeGoals: (goalsRes.data || []).length,
      }
      setData(dashData)

      // === Calculate streaks ===
      const workoutDates = new Set(
        (streakWorkoutsRes.data || []).map(
          (w: { date: string }) => w.date
        )
      )
      const mealDates = new Set(
        (streakMealsRes.data || []).map(
          (m: { date: string }) => m.date
        )
      )
      const weightDates = new Set(
        (streakWeightRes.data || []).map(
          (w: { date: string }) => w.date
        )
      )

      // Workout streak: consecutive days with a completed workout going backwards from today
      let workoutStreak = 0
      for (let i = 0; i < 30; i++) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd")
        if (workoutDates.has(d)) {
          workoutStreak++
        } else if (i > 0) {
          break
        }
        // If today has no workout, streak is 0 but we check yesterday
        if (i === 0 && !workoutDates.has(d)) {
          // Check if yesterday had one (streak still alive)
          const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd")
          if (workoutDates.has(yesterday)) {
            // Don't count today, start from yesterday
            for (let j = 1; j < 30; j++) {
              const dd = format(subDays(new Date(), j), "yyyy-MM-dd")
              if (workoutDates.has(dd)) {
                workoutStreak++
              } else {
                break
              }
            }
          }
          break
        }
      }

      // Logging streak: consecutive days with ANY logging (workout, meal, or weight)
      let loggingStreak = 0
      for (let i = 0; i < 30; i++) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd")
        if (
          workoutDates.has(d) ||
          mealDates.has(d) ||
          weightDates.has(d)
        ) {
          loggingStreak++
        } else if (i > 0) {
          break
        }
        if (
          i === 0 &&
          !workoutDates.has(d) &&
          !mealDates.has(d) &&
          !weightDates.has(d)
        ) {
          for (let j = 1; j < 30; j++) {
            const dd = format(subDays(new Date(), j), "yyyy-MM-dd")
            if (
              workoutDates.has(dd) ||
              mealDates.has(dd) ||
              weightDates.has(dd)
            ) {
              loggingStreak++
            } else {
              break
            }
          }
          break
        }
      }

      setStreaks({ workoutStreak, loggingStreak })

      // === Weekly summary ===
      const weekWorkouts = weekWorkoutsRes.data || []
      const weekCompleted = weekWorkouts.filter(
        (w: { status: string }) => w.status === "completed"
      )
      const weekScheduled = weekWorkouts.filter(
        (w: { status: string }) => w.status === "scheduled"
      )
      const totalVolKg = weekCompleted.reduce(
        (sum: number, w: { total_volume_kg: number | null }) =>
          sum + (w.total_volume_kg || 0),
        0
      )

      type WeekMealRow = {
        date: string
        meal_items: { calories: number | null }[]
      }
      const weekMeals = (weekNutritionRes.data || []) as WeekMealRow[]
      const dailyCals: Record<string, number> = {}
      weekMeals.forEach((m) => {
        if (!dailyCals[m.date]) dailyCals[m.date] = 0
        ;(m.meal_items || []).forEach((item) => {
          dailyCals[m.date] += item.calories || 0
        })
      })
      const calDays = Object.values(dailyCals)
      const avgCals =
        calDays.length > 0
          ? Math.round(calDays.reduce((a, b) => a + b, 0) / calDays.length)
          : 0

      const weekWeights = weekWeightRes.data || []
      let wkWeightChange: number | null = null
      if (weekWeights.length >= 2) {
        const first = weekWeights[0].weight_kg
        const last = weekWeights[weekWeights.length - 1].weight_kg
        wkWeightChange = (last - first) * 2.20462 // in lbs
      }

      setWeekly({
        workoutsCompleted: weekCompleted.length,
        workoutsScheduled: weekScheduled.length,
        avgCalories: avgCals,
        calorieTarget: targetsRes.data?.calories || null,
        totalVolumeLbs: Math.round(totalVolKg * 2.20462),
        weightChange: wkWeightChange
          ? Math.round(wkWeightChange * 10) / 10
          : null,
      })

      // === Quick actions ===
      const actions: QuickAction[] = []

      // No workout today
      if (completedWorkouts.length === 0) {
        actions.push({
          label: "Start a Workout",
          description: "No workout logged today",
          href: "/workouts/new",
          icon: <Dumbbell className="h-4 w-4" />,
          priority: 1,
        })
      }

      // No nutrition today
      if (todayCalories === 0) {
        actions.push({
          label: "Log Nutrition",
          description: "No meals logged today",
          href: "/nutrition",
          icon: <UtensilsCrossed className="h-4 w-4" />,
          priority: 2,
        })
      }

      // No weight entry recently
      const lastWeightDate = weights.length > 0 ? weights[0].date : null
      const daysSinceWeight = lastWeightDate
        ? differenceInDays(new Date(), new Date(lastWeightDate))
        : 999
      if (daysSinceWeight >= 3) {
        actions.push({
          label: "Log Weight",
          description:
            daysSinceWeight >= 999
              ? "No weight entries yet"
              : `Last entry ${daysSinceWeight} days ago`,
          href: "/weight",
          icon: <Scale className="h-4 w-4" />,
          priority: 3,
        })
      }

      // Has scheduled workouts today
      const todayScheduled = weekWorkouts.filter(
        (w: { status: string }) => w.status === "scheduled"
      )
      // Check if there's a scheduled workout for today specifically
      // (weekWorkouts is the whole week, but a scheduled workout for today is high priority)

      // No active goals
      if ((goalsRes.data || []).length === 0) {
        actions.push({
          label: "Set a Goal",
          description: "Stay motivated with targets",
          href: "/goals/new",
          icon: <Target className="h-4 w-4" />,
          priority: 5,
        })
      }

      actions.sort((a, b) => a.priority - b.priority)
      setQuickActions(actions.slice(0, 3))

      setLoading(false)
    }

    fetchDashboard()
  }, [user, supabase, today])

  const TrendIcon =
    data?.weightTrend === "up"
      ? TrendingUp
      : data?.weightTrend === "down"
        ? TrendingDown
        : Minus

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-4 lg:p-8 space-y-6">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        {/* Streaks */}
        {!loading && streaks && (streaks.workoutStreak > 0 || streaks.loggingStreak > 0) && (
          <div className="flex gap-3">
            {streaks.workoutStreak > 0 && (
              <Card className="flex-1 border-orange-500/20 bg-orange-500/5">
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="rounded-full bg-orange-500/15 p-2">
                    <Flame className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">
                      {streaks.workoutStreak}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      day workout streak
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            {streaks.loggingStreak > 0 && (
              <Card className="flex-1 border-blue-500/20 bg-blue-500/5">
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="rounded-full bg-blue-500/15 p-2">
                    <Zap className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">
                      {streaks.loggingStreak}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      day logging streak
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        {loading && (
          <div className="flex gap-3">
            <Skeleton className="h-20 flex-1" />
            <Skeleton className="h-20 flex-1" />
          </div>
        )}

        {/* Quick Actions */}
        {!loading && quickActions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {quickActions.map((action, i) => (
                <Link key={i} href={action.href}>
                  <div className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground">
                        {action.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{action.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Today's Workout */}
        {!loading && <TodaysWorkout compact />}

        {/* Today's Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {/* Weight Card */}
          <Link href="/weight">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Weight
                </CardTitle>
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
                    <span className="text-sm text-muted-foreground">
                      lbs
                    </span>
                    {data.weightTrend && (
                      <TrendIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No data yet
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>

          {/* Calories Card */}
          <Link href="/nutrition">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Calories
                </CardTitle>
                <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div>
                    <span className="text-2xl font-bold">
                      {data?.todayCalories || 0}
                    </span>
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
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Protein
                </CardTitle>
                <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div>
                    <span className="text-2xl font-bold">
                      {data?.todayProtein || 0}g
                    </span>
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
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Workouts
                </CardTitle>
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : data?.workoutCount ? (
                  <div>
                    <span className="text-2xl font-bold">
                      {data.workoutCount}
                    </span>
                    <p className="text-xs text-muted-foreground truncate">
                      {data.todayWorkout || "completed today"}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No workout yet
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>

          {/* Steps Card */}
          <Link href="/activity">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Steps
                </CardTitle>
                <Footprints className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <span className="text-2xl font-bold">
                    {data?.todaySteps?.toLocaleString() || "\u2014"}
                  </span>
                )}
              </CardContent>
            </Card>
          </Link>

          {/* Goals Card */}
          <Link href="/goals">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Goals
                </CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div>
                    <span className="text-2xl font-bold">
                      {data?.activeGoals || 0}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">
                      active
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* This Week Summary */}
        {!loading && weekly && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Workouts row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Workouts</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold tabular-nums">
                    {weekly.workoutsCompleted}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    completed
                  </span>
                  {weekly.workoutsScheduled > 0 && (
                    <span className="text-xs text-blue-400 ml-1.5">
                      +{weekly.workoutsScheduled} scheduled
                    </span>
                  )}
                </div>
              </div>

              {/* Avg Calories row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Avg Calories</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold tabular-nums">
                    {weekly.avgCalories > 0 ? weekly.avgCalories.toLocaleString() : "\u2014"}
                  </span>
                  {weekly.calorieTarget && weekly.avgCalories > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      / {weekly.calorieTarget}
                    </span>
                  )}
                </div>
              </div>

              {/* Volume row */}
              {weekly.totalVolumeLbs > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Total Volume</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums">
                    {weekly.totalVolumeLbs.toLocaleString()} lbs
                  </span>
                </div>
              )}

              {/* Weight Change row */}
              {weekly.weightChange !== null && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Weight Change</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums">
                    {weekly.weightChange > 0 ? "+" : ""}
                    {weekly.weightChange} lbs
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {loading && <Skeleton className="h-40 w-full" />}
      </div>
    </>
  )
}
