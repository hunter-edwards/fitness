"use client"

import { useState, useCallback } from "react"
import {
  Plus,
  Search,
  X,
  Minus,
  GripVertical,
  Loader2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

export interface RecipeIngredient {
  id?: string
  ingredient_food_id?: string | null
  custom_name: string
  servings: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

interface RecipeEditorProps {
  ingredients: RecipeIngredient[]
  onChange: (ingredients: RecipeIngredient[]) => void
}

interface FoodSearchResult {
  id: string
  name: string
  brand: string | null
  calories_per_serving: number
  protein_g: number
  carbs_g: number
  fat_g: number
  serving_size_g: number
}

export function RecipeEditor({ ingredients, onChange }: RecipeEditorProps) {
  const { user } = useAuth()
  const supabase = createClient()
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualForm, setManualForm] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  })

  const searchFoods = useCallback(
    async (q: string) => {
      if (!user || q.trim().length < 2) {
        setSearchResults([])
        return
      }
      setSearching(true)
      const { data } = await supabase
        .from("foods")
        .select(
          "id, name, brand, calories_per_serving, protein_g, carbs_g, fat_g, serving_size_g"
        )
        .eq("user_id", user.id)
        .eq("is_recipe", false)
        .ilike("name", `%${q}%`)
        .limit(10)

      setSearchResults(data || [])
      setSearching(false)
    },
    [user, supabase]
  )

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (value.trim().length >= 2) {
      searchFoods(value)
    } else {
      setSearchResults([])
    }
  }

  const addFromFood = (food: FoodSearchResult) => {
    const newIngredient: RecipeIngredient = {
      ingredient_food_id: food.id,
      custom_name: food.name,
      servings: 1,
      calories: food.calories_per_serving || 0,
      protein_g: food.protein_g || 0,
      carbs_g: food.carbs_g || 0,
      fat_g: food.fat_g || 0,
    }
    onChange([...ingredients, newIngredient])
    setShowSearch(false)
    setSearchQuery("")
    setSearchResults([])
  }

  const addManual = () => {
    if (!manualForm.name.trim()) return
    const newIngredient: RecipeIngredient = {
      ingredient_food_id: null,
      custom_name: manualForm.name.trim(),
      servings: 1,
      calories: parseFloat(manualForm.calories) || 0,
      protein_g: parseFloat(manualForm.protein) || 0,
      carbs_g: parseFloat(manualForm.carbs) || 0,
      fat_g: parseFloat(manualForm.fat) || 0,
    }
    onChange([...ingredients, newIngredient])
    setManualMode(false)
    setManualForm({ name: "", calories: "", protein: "", carbs: "", fat: "" })
    setShowSearch(false)
  }

  const removeIngredient = (index: number) => {
    onChange(ingredients.filter((_, i) => i !== index))
  }

  const updateServings = (index: number, newServings: number) => {
    onChange(
      ingredients.map((ing, i) =>
        i === index ? { ...ing, servings: Math.max(0.25, newServings) } : ing
      )
    )
  }

  const totals = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.calories * ing.servings,
      protein: acc.protein + ing.protein_g * ing.servings,
      carbs: acc.carbs + ing.carbs_g * ing.servings,
      fat: acc.fat + ing.fat_g * ing.servings,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Ingredients</Label>
        <span className="text-xs text-muted-foreground">
          {ingredients.length} item{ingredients.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Ingredient list */}
      {ingredients.map((ing, index) => (
        <div
          key={index}
          className="rounded-lg bg-muted/50 px-3 py-2.5 space-y-2"
        >
          <div className="flex items-center gap-2">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{ing.custom_name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {Math.round(ing.calories * ing.servings)} cal &middot; P:{" "}
                {Math.round(ing.protein_g * ing.servings * 10) / 10}g &middot;
                C: {Math.round(ing.carbs_g * ing.servings * 10) / 10}g &middot;
                F: {Math.round(ing.fat_g * ing.servings * 10) / 10}g
              </p>
            </div>
            <button
              onClick={() => removeIngredient(index)}
              className="text-muted-foreground hover:text-destructive p-1 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 pl-5">
            <span className="text-xs text-muted-foreground">Servings:</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => updateServings(index, ing.servings - 0.25)}
                disabled={ing.servings <= 0.25}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                min={0.25}
                step={0.25}
                value={ing.servings}
                onChange={(e) =>
                  updateServings(index, parseFloat(e.target.value) || 1)
                }
                className="h-7 w-16 text-center text-sm px-1"
              />
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => updateServings(index, ing.servings + 0.25)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      {/* Add ingredient UI */}
      {showSearch ? (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {!manualMode ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search your foods..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                    autoFocus
                  />
                </div>

                {searching && (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {searchResults.map((food) => (
                      <button
                        key={food.id}
                        onClick={() => addFromFood(food)}
                        className="w-full text-left rounded-md px-2 py-2 hover:bg-muted transition-colors"
                      >
                        <p className="text-sm font-medium truncate">
                          {food.name}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {food.calories_per_serving} cal &middot; P:{" "}
                          {food.protein_g}g &middot; C: {food.carbs_g}g &middot;
                          F: {food.fat_g}g
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setManualMode(true)}
                    className="text-xs"
                  >
                    Add manually
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSearch(false)
                      setSearchQuery("")
                      setSearchResults([])
                    }}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Ingredient Name</Label>
                  <Input
                    placeholder="e.g. Olive Oil"
                    value={manualForm.name}
                    onChange={(e) =>
                      setManualForm((p) => ({ ...p, name: e.target.value }))
                    }
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Cal</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={manualForm.calories}
                      onChange={(e) =>
                        setManualForm((p) => ({
                          ...p,
                          calories: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">P (g)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={manualForm.protein}
                      onChange={(e) =>
                        setManualForm((p) => ({
                          ...p,
                          protein: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">C (g)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={manualForm.carbs}
                      onChange={(e) =>
                        setManualForm((p) => ({ ...p, carbs: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">F (g)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={manualForm.fat}
                      onChange={(e) =>
                        setManualForm((p) => ({ ...p, fat: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={addManual}
                    disabled={!manualForm.name.trim()}
                  >
                    Add
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setManualMode(false)
                      setManualForm({
                        name: "",
                        calories: "",
                        protein: "",
                        carbs: "",
                        fat: "",
                      })
                    }}
                  >
                    Back
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSearch(true)}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Ingredient
        </Button>
      )}

      {/* Totals */}
      {ingredients.length > 0 && (
        <div className="rounded-lg border px-3 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Recipe Totals</p>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums">
                {Math.round(totals.calories)} cal
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                P: {Math.round(totals.protein * 10) / 10}g &middot; C:{" "}
                {Math.round(totals.carbs * 10) / 10}g &middot; F:{" "}
                {Math.round(totals.fat * 10) / 10}g
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function calculateRecipeTotals(ingredients: RecipeIngredient[]) {
  return ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.calories * ing.servings,
      protein_g: acc.protein_g + ing.protein_g * ing.servings,
      carbs_g: acc.carbs_g + ing.carbs_g * ing.servings,
      fat_g: acc.fat_g + ing.fat_g * ing.servings,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )
}
