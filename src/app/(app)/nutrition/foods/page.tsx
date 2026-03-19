"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Plus,
  Search,
  Star,
  Trash2,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
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
import { cn } from "@/lib/utils"

interface FoodRow {
  id: string
  name: string
  brand: string | null
  calories_per_serving: number | null
  protein_g: number | null
  serving_label: string
  is_custom: boolean
  is_favorite: boolean
  is_recipe: boolean
}

export default function FoodsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [foods, setFoods] = useState<FoodRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null)
  const [recipeIngredients, setRecipeIngredients] = useState<
    Record<string, { custom_name: string; servings: number; calories: number; protein_g: number; carbs_g: number; fat_g: number }[]>
  >({})

  const fetchFoods = useCallback(async () => {
    if (!user) return
    setLoading(true)

    let query = supabase
      .from("foods")
      .select(
        "id, name, brand, calories_per_serving, protein_g, serving_label, is_custom, is_favorite, is_recipe"
      )
      .eq("user_id", user.id)
      .order("is_favorite", { ascending: false })
      .order("name", { ascending: true })

    if (filter.trim()) {
      query = query.ilike("name", `%${filter.trim()}%`)
    }

    const { data } = await query.limit(100)
    setFoods(data || [])
    setLoading(false)
  }, [user, supabase, filter])

  useEffect(() => {
    fetchFoods()
  }, [fetchFoods])

  const toggleFavorite = async (food: FoodRow) => {
    const newValue = !food.is_favorite
    setFoods((prev) =>
      prev.map((f) =>
        f.id === food.id ? { ...f, is_favorite: newValue } : f
      )
    )

    await supabase
      .from("foods")
      .update({ is_favorite: newValue })
      .eq("id", food.id)
  }

  const deleteFood = async (id: string) => {
    setFoods((prev) => prev.filter((f) => f.id !== id))
    await supabase.from("foods").delete().eq("id", id)
  }

  const toggleRecipeExpand = async (foodId: string) => {
    if (expandedRecipe === foodId) {
      setExpandedRecipe(null)
      return
    }
    setExpandedRecipe(foodId)
    if (!recipeIngredients[foodId]) {
      const { data } = await supabase
        .from("food_ingredients")
        .select("custom_name, servings, calories, protein_g, carbs_g, fat_g")
        .eq("parent_food_id", foodId)
        .order("sort_order")
      setRecipeIngredients((prev) => ({ ...prev, [foodId]: data || [] }))
    }
  }

  return (
    <>
      <Header title="My Foods" />
      <div className="p-4 lg:p-8 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/nutrition">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold lg:text-2xl">My Foods</h1>
              <p className="text-sm text-muted-foreground">
                {foods.length} food{foods.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/nutrition/foods/recipe">
              <Button size="sm" variant="outline">
                <BookOpen className="h-4 w-4 mr-1" />
                Recipe
              </Button>
            </Link>
            <Link href="/nutrition/foods/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </Link>
          </div>
        </div>

        {/* Search filter */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter foods..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Food list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : foods.length > 0 ? (
          <div className="space-y-2">
            {foods.map((food) => (
              <div key={food.id} className="rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 px-3 py-3">
                  <button
                    onClick={() => toggleFavorite(food)}
                    className="shrink-0"
                  >
                    <Star
                      className={cn(
                        "h-4 w-4 transition-colors",
                        food.is_favorite
                          ? "fill-yellow-500 text-yellow-500"
                          : "text-muted-foreground hover:text-yellow-500"
                      )}
                    />
                  </button>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() =>
                      food.is_recipe
                        ? toggleRecipeExpand(food.id)
                        : undefined
                    }
                  >
                    <p className="text-sm font-medium truncate">{food.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {food.brand && <span>{food.brand} &middot; </span>}
                      {food.serving_label}
                      {food.is_recipe ? (
                        <span className="ml-1.5 text-xs text-purple-500 font-medium">
                          Recipe
                        </span>
                      ) : food.is_custom ? (
                        <span className="ml-1.5 text-xs text-primary">
                          Custom
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {food.calories_per_serving || 0} cal
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {food.protein_g || 0}g protein
                    </p>
                  </div>
                  {food.is_recipe && (
                    <button
                      onClick={() => toggleRecipeExpand(food.id)}
                      className="shrink-0 text-muted-foreground hover:text-foreground p-1"
                    >
                      {expandedRecipe === food.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  )}
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
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Food</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete &quot;{food.name}
                          &quot;? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => deleteFood(food.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                {/* Expanded ingredient list for recipes */}
                {food.is_recipe && expandedRecipe === food.id && (
                  <div className="px-3 pb-3 pt-0 border-t border-border/50 mx-3">
                    <p className="text-xs font-medium text-muted-foreground mt-2 mb-1.5">
                      Ingredients
                    </p>
                    {recipeIngredients[food.id] ? (
                      recipeIngredients[food.id].length > 0 ? (
                        <div className="space-y-1">
                          {recipeIngredients[food.id].map((ing, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-xs"
                            >
                              <span className="text-muted-foreground truncate">
                                {ing.custom_name}
                                {ing.servings !== 1 && (
                                  <span> x{ing.servings}</span>
                                )}
                              </span>
                              <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                                {Math.round(ing.calories * ing.servings)} cal
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No ingredients
                        </p>
                      )
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                {filter.trim()
                  ? "No foods match your filter"
                  : "No custom foods yet"}
              </p>
              {!filter.trim() && (
                <Link href="/nutrition/foods/new">
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Create Your First Food
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
