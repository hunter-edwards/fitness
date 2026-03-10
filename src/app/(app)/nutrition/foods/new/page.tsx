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
import { Separator } from "@/components/ui/separator"

export default function NewFoodPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: "",
    brand: "",
    serving_size_g: "",
    serving_label: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
    sugar: "",
    sodium: "",
  })

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.name.trim() || !form.calories) return

    setSaving(true)
    const { error } = await supabase.from("foods").insert({
      user_id: user.id,
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      serving_size_g: parseFloat(form.serving_size_g) || 100,
      serving_label: form.serving_label.trim() || `${form.serving_size_g || 100}g`,
      calories_per_serving: parseFloat(form.calories) || 0,
      protein_g: parseFloat(form.protein) || 0,
      carbs_g: parseFloat(form.carbs) || 0,
      fat_g: parseFloat(form.fat) || 0,
      fiber_g: parseFloat(form.fiber) || null,
      sugar_g: parseFloat(form.sugar) || null,
      sodium_mg: parseFloat(form.sodium) || null,
      is_custom: true,
      is_favorite: false,
    })

    if (!error) {
      router.push("/nutrition/foods")
    }
    setSaving(false)
  }

  return (
    <>
      <Header title="New Food" />
      <div className="p-4 lg:p-8 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/nutrition/foods">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold lg:text-2xl">Create Food</h1>
            <p className="text-sm text-muted-foreground">
              Add a custom food to your database
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Food Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. Chicken Breast"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand (optional)</Label>
                <Input
                  id="brand"
                  placeholder="e.g. Kirkland"
                  value={form.brand}
                  onChange={(e) => handleChange("brand", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="serving_size_g">Serving Size (g)</Label>
                  <Input
                    id="serving_size_g"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="100"
                    value={form.serving_size_g}
                    onChange={(e) =>
                      handleChange("serving_size_g", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serving_label">Serving Label</Label>
                  <Input
                    id="serving_label"
                    placeholder='e.g. "1 breast" or "100g"'
                    value={form.serving_label}
                    onChange={(e) =>
                      handleChange("serving_label", e.target.value)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Macronutrients */}
          <Card>
            <CardHeader>
              <CardTitle>Macronutrients (per serving)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="calories">Calories *</Label>
                <Input
                  id="calories"
                  type="number"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={form.calories}
                  onChange={(e) => handleChange("calories", e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="protein">Protein (g)</Label>
                  <Input
                    id="protein"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={form.protein}
                    onChange={(e) => handleChange("protein", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="carbs">Carbs (g)</Label>
                  <Input
                    id="carbs"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={form.carbs}
                    onChange={(e) => handleChange("carbs", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fat">Fat (g)</Label>
                  <Input
                    id="fat"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={form.fat}
                    onChange={(e) => handleChange("fat", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional nutrients */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Nutrients (optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="fiber">Fiber (g)</Label>
                  <Input
                    id="fiber"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={form.fiber}
                    onChange={(e) => handleChange("fiber", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sugar">Sugar (g)</Label>
                  <Input
                    id="sugar"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={form.sugar}
                    onChange={(e) => handleChange("sugar", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sodium">Sodium (mg)</Label>
                  <Input
                    id="sodium"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={form.sodium}
                    onChange={(e) => handleChange("sodium", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Submit */}
          <Button
            type="submit"
            disabled={saving || !form.name.trim() || !form.calories}
            className="w-full"
            size="lg"
          >
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save Food
          </Button>
        </form>
      </div>
    </>
  )
}
