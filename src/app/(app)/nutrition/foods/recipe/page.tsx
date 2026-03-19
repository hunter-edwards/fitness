"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  RecipeEditor,
  calculateRecipeTotals,
  type RecipeIngredient,
} from "@/components/nutrition/recipe-editor"
import { toast } from "sonner"

export default function CreateRecipePage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [servingLabel, setServingLabel] = useState("")
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])

  const totals = calculateRecipeTotals(ingredients)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !name.trim() || ingredients.length === 0) return
    setSaving(true)

    try {
      // Create parent recipe food with summed macros
      const { data: recipe, error } = await supabase
        .from("foods")
        .insert({
          user_id: user.id,
          name: name.trim(),
          serving_label: servingLabel.trim() || "1 recipe",
          serving_size_g: 0,
          calories_per_serving: Math.round(totals.calories),
          protein_g: Math.round(totals.protein_g * 10) / 10,
          carbs_g: Math.round(totals.carbs_g * 10) / 10,
          fat_g: Math.round(totals.fat_g * 10) / 10,
          is_custom: true,
          is_recipe: true,
          is_favorite: false,
        })
        .select("id")
        .single()

      if (error || !recipe) throw error

      // Create food_ingredients rows
      const ingredientRows = ingredients.map((ing, i) => ({
        parent_food_id: recipe.id,
        ingredient_food_id: ing.ingredient_food_id || null,
        custom_name: ing.custom_name,
        servings: ing.servings,
        calories: ing.calories,
        protein_g: ing.protein_g,
        carbs_g: ing.carbs_g,
        fat_g: ing.fat_g,
        sort_order: i,
      }))

      await supabase.from("food_ingredients").insert(ingredientRows)

      toast.success("Recipe created")
      router.push("/nutrition/foods")
    } catch {
      toast.error("Failed to create recipe")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Header title="Create Recipe" />
      <div className="p-4 lg:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/nutrition/foods">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold lg:text-2xl">Create Recipe</h1>
            <p className="text-sm text-muted-foreground">
              Combine foods into a reusable recipe
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recipe Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recipe-name">Recipe Name *</Label>
                <Input
                  id="recipe-name"
                  placeholder="e.g. Protein Smoothie"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serving-label">
                  Serving Label (optional)
                </Label>
                <Input
                  id="serving-label"
                  placeholder='e.g. "1 bowl" or "1 smoothie"'
                  value={servingLabel}
                  onChange={(e) => setServingLabel(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ingredients</CardTitle>
            </CardHeader>
            <CardContent>
              <RecipeEditor
                ingredients={ingredients}
                onChange={setIngredients}
              />
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={
              saving || !name.trim() || ingredients.length === 0
            }
            className="w-full"
            size="lg"
          >
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save Recipe
          </Button>
        </form>
      </div>
    </>
  )
}
