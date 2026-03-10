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
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, FileUp, Calendar, ChevronRight } from "lucide-react"
import type { Database } from "@/types/database"

type Plan = Database["public"]["Tables"]["workout_plans"]["Row"]

export default function PlansPage() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    supabase
      .from("workout_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPlans(data || [])
        setLoading(false)
      })
  }, [user, supabase])

  return (
    <>
      <Header title="Plans" />
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="hidden lg:block">
            <h1 className="text-3xl font-bold">Workout Plans</h1>
            <p className="text-muted-foreground">Upload or create training programs</p>
          </div>
          <Link href="/plans/upload">
            <Button>
              <FileUp className="mr-2 h-4 w-4" />
              Upload Plan
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileUp className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">No plans yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a PDF, DOCX, or Markdown file to auto-generate your workout program
              </p>
              <Link href="/plans/upload">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Upload Your First Plan
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <Link key={plan.id} href={`/plans/${plan.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{plan.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {plan.description || "No description"}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </CardHeader>
                  <CardContent className="flex items-center gap-3">
                    {plan.is_active && (
                      <Badge variant="default">Active</Badge>
                    )}
                    {plan.duration_weeks && (
                      <Badge variant="secondary">
                        <Calendar className="mr-1 h-3 w-3" />
                        {plan.duration_weeks} weeks
                      </Badge>
                    )}
                    <Badge variant="outline">{plan.source || "manual"}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(plan.created_at), "MMM d, yyyy")}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
