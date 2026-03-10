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
}

export default function FoodsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [foods, setFoods] = useState<FoodRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")

  const fetchFoods = useCallback(async () => {
    if (!user) return
    setLoading(true)

    let query = supabase
      .from("foods")
      .select(
        "id, name, brand, calories_per_serving, protein_g, serving_label, is_custom, is_favorite"
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
          <Link href="/nutrition/foods/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </Link>
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
              <div
                key={food.id}
                className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-3"
              >
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
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{food.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {food.brand && <span>{food.brand} &middot; </span>}
                    {food.serving_label}
                    {food.is_custom && (
                      <span className="ml-1.5 text-xs text-primary">
                        Custom
                      </span>
                    )}
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
                        Are you sure you want to delete &quot;{food.name}&quot;?
                        This action cannot be undone.
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
