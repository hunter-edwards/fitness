"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
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
import { Plus, Target, Trash2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import type { Database } from "@/types/database"

type Goal = Database["public"]["Tables"]["goals"]["Row"]

export default function GoalsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGoals = async () => {
    if (!user) return
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("status", { ascending: true })
      .order("created_at", { ascending: false })
    setGoals(data || [])
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
                              <span>
                                {goal.current_value ?? 0} {goal.target_unit || ""}
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
