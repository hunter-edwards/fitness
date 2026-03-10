"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { Trash2 } from "lucide-react"
import { kgToLbs } from "@/lib/utils/units"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface WeightEntry {
  id: string
  date: string
  weight_kg: number
  body_fat_pct: number | null
  notes: string | null
}

interface WeightHistoryProps {
  entries: WeightEntry[]
  onDelete: (id: string) => void
}

export function WeightHistory({ entries, onDelete }: WeightHistoryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Sort newest first
  const sorted = [...entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  if (sorted.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No weight entries yet. Start logging above.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {sorted.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="text-sm text-muted-foreground w-20 shrink-0">
              {format(parseISO(entry.date), "MMM d, yyyy")}
            </div>
            <div className="font-medium tabular-nums">
              {kgToLbs(entry.weight_kg).toFixed(1)} lbs
            </div>
            {entry.body_fat_pct !== null && (
              <div className="text-sm text-muted-foreground tabular-nums">
                {entry.body_fat_pct}% BF
              </div>
            )}
            {entry.notes && (
              <div className="text-sm text-muted-foreground truncate max-w-[200px] hidden sm:block">
                {entry.notes}
              </div>
            )}
          </div>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-destructive shrink-0"
                />
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the weight entry from{" "}
                  {format(parseISO(entry.date), "MMM d, yyyy")}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    setDeletingId(entry.id)
                    onDelete(entry.id)
                  }}
                  disabled={deletingId === entry.id}
                >
                  {deletingId === entry.id ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ))}
    </div>
  )
}
