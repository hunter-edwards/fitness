"use client"

import { useState } from "react"
import { Check, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FoodPhotoAnalysis, AnalyzedFoodItem } from "@/types/food-vision"

interface AnalysisResultsSheetProps {
  analysis: FoodPhotoAnalysis
  mealLabel: string
  adding: boolean
  onAddItems: (items: AnalyzedFoodItem[]) => void
  onSearchItem: (name: string) => void
  onClose: () => void
}

const confidenceColors: Record<string, string> = {
  high: "bg-green-500/15 text-green-400",
  medium: "bg-yellow-500/15 text-yellow-400",
  low: "bg-red-500/15 text-red-400",
}

export function AnalysisResultsSheet({
  analysis,
  mealLabel,
  adding,
  onAddItems,
  onSearchItem,
  onClose,
}: AnalysisResultsSheetProps) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(analysis.items.map((_, i) => i))
  )

  const toggleItem = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const selectedItems = analysis.items.filter((_, i) => selected.has(i))
  const totalCalories = selectedItems.reduce((sum, i) => sum + i.calories, 0)
  const totalProtein = selectedItems.reduce((sum, i) => sum + i.protein, 0)
  const totalCarbs = selectedItems.reduce((sum, i) => sum + i.carbs, 0)
  const totalFat = selectedItems.reduce((sum, i) => sum + i.fat, 0)

  return (
    <div className="flex flex-col gap-4 max-h-[70vh] overflow-hidden">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">
          {analysis.meal_description}
        </p>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto space-y-2 -mx-4 px-4">
        {analysis.items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "rounded-lg border px-3 py-3 transition-colors cursor-pointer",
              selected.has(index)
                ? "border-primary/40 bg-primary/5"
                : "border-transparent bg-muted/50 opacity-60"
            )}
            onClick={() => toggleItem(index)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                {/* Checkbox */}
                <div
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                    selected.has(index)
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/40"
                  )}
                >
                  {selected.has(index) && <Check className="h-3 w-3" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        confidenceColors[item.confidence]
                      )}
                    >
                      {item.confidence}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.estimated_portion}
                  </p>
                  {item.notes && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5 italic">
                      {item.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular-nums">
                  {item.calories} cal
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  P: {item.protein}g &middot; C: {item.carbs}g &middot; F:{" "}
                  {item.fat}g
                </p>
              </div>
            </div>

            {/* Search in database option */}
            <button
              className="mt-2 flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onSearchItem(item.name)
              }}
            >
              <Search className="h-3 w-3" />
              Search in database instead
            </button>
          </div>
        ))}
      </div>

      {/* Analysis notes */}
      {analysis.analysis_notes && (
        <p className="text-xs text-muted-foreground/70 italic border-t pt-3">
          {analysis.analysis_notes}
        </p>
      )}

      {/* Totals */}
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            Total ({selectedItems.length} item
            {selectedItems.length !== 1 ? "s" : ""})
          </p>
          <p className="text-sm font-semibold tabular-nums">
            {totalCalories} cal
          </p>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums mt-1">
          Protein: {totalProtein}g &middot; Carbs: {totalCarbs}g &middot; Fat:{" "}
          {totalFat}g
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={selectedItems.length === 0 || adding}
          onClick={() => onAddItems(selectedItems)}
        >
          {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Add to {mealLabel}
        </Button>
      </div>
    </div>
  )
}
