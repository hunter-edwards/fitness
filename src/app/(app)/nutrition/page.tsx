"use client"

import { useEffect, useState, useCallback } from "react"
import { format, addDays, subDays } from "date-fns"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Settings, Apple } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MacroRing } from "@/components/nutrition/macro-ring"
import { MealCard, type MealItem } from "@/components/nutrition/meal-card"

type MealType = "breakfast" | "lunch" | "dinner" | "snack"

interface MealWithItems {
  id: string
  meal_type: MealType
  meal_items: MealItem[]
}

interface Targets {
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
}

export default function NutritionPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [meals, setMeals] = useState<MealWithItems[]>([])
  const [targets, setTargets] = useState<Targets | null>(null)
  const [loading, setLoading] = useState(true)

  const dateStr = format(selectedDate, "yyyy-MM-dd")
  const isToday = format(new Date(), "yyyy-MM-dd") === dateStr

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [mealsRes, targetsRes] = await Promise.all([
      supabase
        .from("meals")
        .select(
          `
          id,
          meal_type,
          meal_items (
            id,
            food_id,
            custom_name,
            servings,
            calories,
            protein_g,
            carbs_g,
            fat_g,
            food:foods (
              name,
              brand,
              serving_label
            )
          )
        `
        )
        .eq("user_id", user.id)
        .eq("date", dateStr),
      supabase
        .from("nutrition_targets")
        .select("calories, protein_g, carbs_g, fat_g")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single(),
    ])

    if (mealsRes.data) {
      setMeals(mealsRes.data as unknown as MealWithItems[])
    }
    if (targetsRes.data) {
      setTargets(targetsRes.data)
    }

    setLoading(false)
  }, [user, dateStr, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDelete = async (itemId: string) => {
    const { error } = await supabase
      .from("meal_items")
      .delete()
      .eq("id", itemId)

    if (!error) {
      setMeals((prev) =>
        prev.map((meal) => ({
          ...meal,
          meal_items: meal.meal_items.filter((item) => item.id !== itemId),
        }))
      )
    }
  }

  const getMealItems = (type: MealType): MealItem[] => {
    const meal = meals.find((m) => m.meal_type === type)
    return meal?.meal_items || []
  }

  const totals = meals.reduce(
    (acc, meal) => {
      meal.meal_items.forEach((item) => {
        acc.calories += item.calories || 0
        acc.protein += item.protein_g || 0
        acc.carbs += item.carbs_g || 0
        acc.fat += item.fat_g || 0
      })
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"]

  return (
    <>
      <Header title="Nutrition" />
      <div className="p-4 lg:p-8 space-y-6">
        {/* Desktop heading */}
        <div className="hidden lg:flex lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Nutrition</h1>
            <p className="text-muted-foreground">Track your daily food intake</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/nutrition/foods">
              <Button variant="outline" size="sm">
                <Apple className="h-4 w-4 mr-1" />
                My Foods
              </Button>
            </Link>
            <Link href="/nutrition/targets">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-1" />
                Targets
              </Button>
            </Link>
          </div>
        </div>

        {/* Date navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedDate((d) => subDays(d, 1))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h2 className="text-lg font-semibold">
              {isToday ? "Today" : format(selectedDate, "EEEE")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {format(selectedDate, "MMMM d, yyyy")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Daily summary rings */}
        {loading ? (
          <div className="flex justify-around py-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-[72px] w-[72px] rounded-full" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex justify-around py-2">
            <MacroRing
              current={totals.calories}
              target={targets?.calories || 2000}
              label="Calories"
            />
            <MacroRing
              current={totals.protein}
              target={targets?.protein_g || 150}
              label="Protein"
            />
            <MacroRing
              current={totals.carbs}
              target={targets?.carbs_g || 250}
              label="Carbs"
            />
            <MacroRing
              current={totals.fat}
              target={targets?.fat_g || 65}
              label="Fat"
            />
          </div>
        )}

        {/* Meal cards */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {mealTypes.map((type) => (
              <MealCard
                key={type}
                mealType={type}
                date={dateStr}
                items={getMealItems(type)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Mobile quick links */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link href="/nutrition/foods" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Apple className="h-4 w-4 mr-1" />
              My Foods
            </Button>
          </Link>
          <Link href="/nutrition/targets" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Settings className="h-4 w-4 mr-1" />
              Targets
            </Button>
          </Link>
        </div>
      </div>
    </>
  )
}
