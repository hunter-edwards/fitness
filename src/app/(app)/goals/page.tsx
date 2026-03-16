"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { format, subDays } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Plus, Target, Trash2, CheckCircle2, Pencil, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import type { Database } from "@/types/database"

type Goal = Database["public"]["Tables"]["goals"]["Row"]

export default function GoalsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  const syncGoalProgress = useCallback(async (goals: Goal[]) => {
    if (!user) return goals

    const activeGoals = goals.filter((g) => g.status === "active")
    if (activeGoals.length === 0) return goals

    const updates: { id: string; current_value: number }[] = []

    // Fetch latest weight for weight goals
    const weightGoals = activeGoals.filter((g) => g.category === "weight")
    if (weightGoals.length > 0) {
      const { data: latestWeight } = await supabase
        .from("weight_entries")
        .select("weight_kg")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(1)
        .single()

      if (latestWeight) {
        const weightLbs = Math.round(latestWeight.weight_kg * 2.20462 * 10) / 10
        const weightKg = Math.round(latestWeight.weight_kg * 10) / 10
        weightGoals.forEach((g) => {
          const val = g.target_unit === "kg" ? weightKg : weightLbs
          if (g.current_value !== val) {
            updates.push({ id: g.id, current_value: val })
          }
        })
      }
    }

    // Fetch avg daily steps for activity goals
    const activityGoals = activeGoals.filter((g) => g.category === "activity")
    if (activityGoals.length > 0) {
      const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd")
      const { data: recentActivity } = await supabase
        .from("activity_entries")
        .select("steps, active_minutes")
        .eq("user_id", user.id)
        .gte("date", weekAgo)

      if (recentActivity && recentActivity.length > 0) {
        const avgSteps = Math.round(
          recentActivity.reduce((s, a) => s + (a.steps || 0), 0) / recentActivity.length
        )
        const avgMinutes = Math.round(
          recentActivity.reduce((s, a) => s + (a.active_minutes || 0), 0) / recentActivity.length
        )
        activityGoals.forEach((g) => {
          const unit = (g.target_unit || "").toLowerCase()
          let val: number | null = null
          if (unit.includes("step")) val = avgSteps
          else if (unit.includes("min")) val = avgMinutes
          else val = avgSteps // default to steps
          if (val !== null && g.current_value !== val) {
            updates.push({ id: g.id, current_value: val })
          }
        })
      }
    }

    // Fetch avg daily nutrition for nutrition goals
    const nutritionGoals = activeGoals.filter((g) => g.category === "nutrition")
    if (nutritionGoals.length > 0) {
      const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd")
      const { data: recentMeals } = await supabase
        .from("meals")
        .select("date, meal_items(calories, protein_g)")
        .eq("user_id", user.id)
        .gte("date", weekAgo)

      if (recentMeals && recentMeals.length > 0) {
        type MealRow = { date: string; meal_items: { calories: number | null; protein_g: number | null }[] }
        const dailyTotals: Record<string, { cals: number; protein: number }> = {}
        ;(recentMeals as MealRow[]).forEach((m) => {
          if (!dailyTotals[m.date]) dailyTotals[m.date] = { cals: 0, protein: 0 }
          ;(m.meal_items || []).forEach((item) => {
            dailyTotals[m.date].cals += item.calories || 0
            dailyTotals[m.date].protein += item.protein_g || 0
          })
        })
        const days = Object.values(dailyTotals)
        const avgCals = Math.round(days.reduce((s, d) => s + d.cals, 0) / days.length)
        const avgProtein = Math.round(days.reduce((s, d) => s + d.protein, 0) / days.length)

        nutritionGoals.forEach((g) => {
          const unit = (g.target_unit || "").toLowerCase()
          let val: number | null = null
          if (unit.includes("cal")) val = avgCals
          else if (unit.includes("g") || unit.includes("protein")) val = avgProtein
          else val = avgCals
          if (val !== null && g.current_value !== val) {
            updates.push({ id: g.id, current_value: val })
          }
        })
      }
    }

    // Batch update changed goals
    if (updates.length > 0) {
      await Promise.all(
        updates.map((u) =>
          supabase
            .from("goals")
            .update({ current_value: u.current_value, updated_at: new Date().toISOString() })
            .eq("id", u.id)
        )
      )

      // Apply updates to local state
      return goals.map((g) => {
        const update = updates.find((u) => u.id === g.id)
        return update ? { ...g, current_value: update.current_value } : g
      })
    }

    return goals
  }, [user, supabase])

  const fetchGoals = async () => {
    if (!user) return
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("status", { ascending: true })
      .order("created_at", { ascending: false })

    const goals = data || []
    const synced = await syncGoalProgress(goals)
    setGoals(synced)
    setLoading(false)
  }

  useEffect(() => {
    fetchGoals()
  }, [user])

  async function handleDelete(id: string) {
    await supabase.from("goals").delete().eq("id", id)
    toast.success("Goal deleted")
    fetchGoals()
  }

  async function handleAchieve(id: string) {
    await supabase.from("goals").update({ status: "achieved" }).eq("id", id)
    toast.success("Goal achieved!")
    fetchGoals()
  }

  const activeGoals = goals.filter((g) => g.status === "active")
  const achievedGoals = goals.filter((g) => g.status === "achieved")

  function getProgress(goal: Goal): number {
    if (!goal.target_value || !goal.current_value) return 0
    return Math.min(100, (goal.current_value / goal.target_value) * 100)
  }

  const categoryColors: Record<string, string> = {
    weight: "bg-purple-500/10 text-purple-500",
    body_fat: "bg-orange-500/10 text-orange-500",
    strength: "bg-red-500/10 text-red-500",
    nutrition: "bg-green-500/10 text-green-500",
    activity: "bg-blue-500/10 text-blue-500",
    custom: "bg-gray-500/10 text-gray-500",
  }

  return (
    <>
      <Header title="Goals" />
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="hidden lg:block">
            <h1 className="text-3xl font-bold">Goals</h1>
            <p className="text-muted-foreground">Set targets and track your progress</p>
          </div>
          <Link href="/goals/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Goal
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : goals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">No goals yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Set weight, strength, nutrition, or activity goals
              </p>
              <Link href="/goals/new">
                <Button><Plus className="mr-2 h-4 w-4" />Create Your First Goal</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {activeGoals.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Active Goals</h2>
                {activeGoals.map((goal) => {
                  const progress = getProgress(goal)
                  return (
                    <Card key={goal.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{goal.title}</CardTitle>
                            {goal.description && (
                              <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                            )}
                          </div>
                          <Badge className={categoryColors[goal.category] || ""}>{goal.category}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {goal.target_value && (
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="flex items-center gap-1">
                                {goal.current_value ?? 0} {goal.target_unit || ""}
                                {["weight", "activity", "nutrition"].includes(goal.category) && (
                                  <RefreshCw className="h-3 w-3 text-muted-foreground" />
                                )}
                              </span>
                              <span className="text-muted-foreground">
                                {goal.target_value} {goal.target_unit || ""}
                              </span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {goal.target_date && (
                            <span className="text-xs text-muted-foreground">
                              Target: {format(new Date(goal.target_date), "MMM d, yyyy")}
                            </span>
                          )}
                          <div className="ml-auto flex gap-1">
                            <Link href={`/goals/${goal.id}`}>
                              <Button variant="ghost" size="sm">
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAchieve(goal.id)}
                            >
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger
                                render={<Button variant="ghost" size="sm" />}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Goal</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this goal.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(goal.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {achievedGoals.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-muted-foreground">Achieved</h2>
                {achievedGoals.map((goal) => (
                  <Card key={goal.id} className="opacity-60">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <CardTitle className="text-base">{goal.title}</CardTitle>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
