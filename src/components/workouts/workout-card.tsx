"use client"

import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Dumbbell, Weight, Calendar } from "lucide-react"

export interface WorkoutCardData {
  id: string
  name: string | null
  date: string
  duration_minutes: number | null
  total_volume_kg: number | null
  exercise_count: number
  status: "scheduled" | "in_progress" | "completed" | "skipped"
}

interface WorkoutCardProps {
  workout: WorkoutCardData
  onClick?: (id: string) => void
}

const statusConfig: Record<
  WorkoutCardData["status"],
  { label: string; className: string }
> = {
  completed: {
    label: "Completed",
    className: "bg-green-500/15 text-green-400 border-green-500/25",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  },
  skipped: {
    label: "Skipped",
    className: "bg-red-500/15 text-red-400 border-red-500/25",
  },
}

export function WorkoutCard({ workout, onClick }: WorkoutCardProps) {
  const status = statusConfig[workout.status]
  const volumeLbs = workout.total_volume_kg
    ? Math.round(workout.total_volume_kg * 2.20462)
    : null

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors hover:bg-accent/50",
        onClick && "active:scale-[0.98]"
      )}
      onClick={() => onClick?.(workout.id)}
    >
      <CardContent className="pt-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">
                {workout.name || "Workout"}
              </h3>
              <Badge className={cn("shrink-0", status.className)}>
                {status.label}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{format(new Date(workout.date), "MMM d, yyyy")}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {workout.duration_minutes != null && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{workout.duration_minutes} min</span>
                </div>
              )}
              {volumeLbs != null && (
                <div className="flex items-center gap-1">
                  <Weight className="h-3.5 w-3.5" />
                  <span>{volumeLbs.toLocaleString()} lbs</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Dumbbell className="h-3.5 w-3.5" />
                <span>
                  {workout.exercise_count}{" "}
                  {workout.exercise_count === 1 ? "exercise" : "exercises"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
