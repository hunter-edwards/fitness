"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Coffee,
  Sun,
  Moon,
  Cookie,
  ChevronDown,
  Plus,
  Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface MealItem {
  id: string
  food_id: string | null
  custom_name: string | null
  servings: number
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  food?: {
    name: string
    brand: string | null
    serving_label: string
  } | null
}

type MealType = "breakfast" | "lunch" | "dinner" | "snack"

interface MealCardProps {
  mealType: MealType
  date: string
  items: MealItem[]
  onDelete: (itemId: string) => void
}

const mealConfig: Record<
  MealType,
  { label: string; icon: typeof Coffee; color: string }
> = {
  breakfast: {
    label: "Breakfast",
    icon: Coffee,
    color: "text-amber-500",
  },
  lunch: {
    label: "Lunch",
    icon: Sun,
    color: "text-orange-500",
  },
  dinner: {
    label: "Dinner",
    icon: Moon,
    color: "text-indigo-400",
  },
  snack: {
    label: "Snack",
    icon: Cookie,
    color: "text-pink-500",
  },
}

export function MealCard({ mealType, date, items, onDelete }: MealCardProps) {
  const [expanded, setExpanded] = useState(items.length > 0)
  const config = mealConfig[mealType]
  const Icon = config.icon

  const totalCalories = items.reduce(
    (sum, item) => sum + (item.calories || 0),
    0
  )
  const totalProtein = items.reduce(
    (sum, item) => sum + (item.protein_g || 0),
    0
  )

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg bg-muted",
                config.color
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{config.label}</CardTitle>
              {items.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {items.length} item{items.length !== 1 ? "s" : ""} &middot;{" "}
                  {Math.round(totalProtein)}g protein
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tabular-nums">
              {Math.round(totalCalories)} cal
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                expanded && "rotate-180"
              )}
            />
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.food?.name || item.custom_name || "Unknown food"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.servings} serving{item.servings !== 1 ? "s" : ""}
                      {item.food?.brand && (
                        <span> &middot; {item.food.brand}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-2">
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">
                        {Math.round(item.calories || 0)} cal
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        P: {Math.round(item.protein_g || 0)}g &middot; C:{" "}
                        {Math.round(item.carbs_g || 0)}g &middot; F:{" "}
                        {Math.round(item.fat_g || 0)}g
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(item.id)
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              No foods logged yet
            </p>
          )}

          <Link
            href={`/nutrition/search?meal=${mealType}&date=${date}`}
            className="mt-3 block"
          >
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Food
            </Button>
          </Link>
        </CardContent>
      )}
    </Card>
  )
}
