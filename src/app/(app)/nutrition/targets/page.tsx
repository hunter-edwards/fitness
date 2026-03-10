"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, Loader2, Check } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface Target {
  id: string
  name: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  is_active: boolean
  effective_from: string
}

export default function TargetsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [targets, setTargets] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
  })

  const fetchTargets = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data } = await supabase
      .from("nutrition_targets")
      .select(
        "id, name, calories, protein_g, carbs_g, fat_g, fiber_g, is_active, effective_from"
      )
      .eq("user_id", user.id)
      .order("is_active", { ascending: false })
      .order("effective_from", { ascending: false })
      .limit(10)

    if (data) {
      setTargets(data)

      // Pre-fill form with active target
      const active = data.find((t) => t.is_active)
      if (active) {
        setForm({
          calories: active.calories?.toString() || "",
          protein: active.protein_g?.toString() || "",
          carbs: active.carbs_g?.toString() || "",
          fat: active.fat_g?.toString() || "",
          fiber: active.fiber_g?.toString() || "",
        })
      }
    }

    setLoading(false)
  }, [user, supabase])

  useEffect(() => {
    fetchTargets()
  }, [fetchTargets])

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)

    // Deactivate old targets
    await supabase
      .from("nutrition_targets")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("is_active", true)

    // Create new target
    const { error } = await supabase.from("nutrition_targets").insert({
      user_id: user.id,
      name: "Daily Target",
      calories: parseFloat(form.calories) || null,
      protein_g: parseFloat(form.protein) || null,
      carbs_g: parseFloat(form.carbs) || null,
      fat_g: parseFloat(form.fat) || null,
      fiber_g: parseFloat(form.fiber) || null,
      is_active: true,
      effective_from: format(new Date(), "yyyy-MM-dd"),
    })

    if (!error) {
      await fetchTargets()
    }

    setSaving(false)
  }

  const estimatedTotalCal =
    (parseFloat(form.protein) || 0) * 4 +
    (parseFloat(form.carbs) || 0) * 4 +
    (parseFloat(form.fat) || 0) * 9

  return (
    <>
      <Header title="Macro Targets" />
      <div className="p-4 lg:p-8 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/nutrition">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold lg:text-2xl">Macro Targets</h1>
            <p className="text-sm text-muted-foreground">
              Set your daily nutrition goals
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Targets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="calories">Calories</Label>
                <Input
                  id="calories"
                  type="number"
                  min={0}
                  step="any"
                  placeholder="2000"
                  value={form.calories}
                  onChange={(e) => handleChange("calories", e.target.value)}
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
                    placeholder="150"
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
                    placeholder="250"
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
                    placeholder="65"
                    value={form.fat}
                    onChange={(e) => handleChange("fat", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fiber">Fiber (g)</Label>
                <Input
                  id="fiber"
                  type="number"
                  min={0}
                  step="any"
                  placeholder="30"
                  value={form.fiber}
                  onChange={(e) => handleChange("fiber", e.target.value)}
                />
              </div>

              {/* Macro calorie estimation */}
              {(form.protein || form.carbs || form.fat) && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    Estimated calories from macros
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {Math.round(estimatedTotalCal)} cal
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    P: {Math.round((parseFloat(form.protein) || 0) * 4)} +
                    C: {Math.round((parseFloat(form.carbs) || 0) * 4)} +
                    F: {Math.round((parseFloat(form.fat) || 0) * 9)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={saving}
            className="w-full"
            size="lg"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            Save Targets
          </Button>
        </form>

        <Separator />

        {/* Current targets */}
        {!loading && targets.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Target History
            </h2>
            {targets.map((target) => (
              <Card key={target.id} size="sm">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{target.name}</p>
                        {target.is_active && (
                          <Badge variant="default" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Since {format(new Date(target.effective_from), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {target.calories || "—"} cal
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        P: {target.protein_g || 0}g &middot;
                        C: {target.carbs_g || 0}g &middot;
                        F: {target.fat_g || 0}g
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
