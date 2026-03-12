"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Search,
  Loader2,
  Camera,
  ScanBarcode,
} from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CameraCapture } from "@/components/nutrition/camera-capture"
import { BarcodeScanner } from "@/components/nutrition/barcode-scanner"
import { AnalysisResultsSheet } from "@/components/nutrition/analysis-results-sheet"
import type { FoodPhotoAnalysis, AnalyzedFoodItem } from "@/types/food-vision"

type MealType = "breakfast" | "lunch" | "dinner" | "snack"

interface FoodResult {
  id?: string
  name: string
  brand: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
  sodium?: number
  serving_size_g: number
  off_id?: string
  barcode?: string | null
  source: "local" | "off"
}

export default function FoodSearchPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const mealType = (searchParams.get("meal") || "snack") as MealType
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10)

  const [query, setQuery] = useState("")
  const [localResults, setLocalResults] = useState<FoodResult[]>([])
  const [offResults, setOffResults] = useState<FoodResult[]>([])
  const [localLoading, setLocalLoading] = useState(false)
  const [offLoading, setOffLoading] = useState(false)
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null)
  const [servings, setServings] = useState(1)
  const [adding, setAdding] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("my-foods")

  // Camera & scanning state
  const [showCamera, setShowCamera] = useState(false)
  const [showBarcode, setShowBarcode] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResults, setAnalysisResults] = useState<FoodPhotoAnalysis | null>(null)
  const [showAnalysisResults, setShowAnalysisResults] = useState(false)
  const [barcodeLoading, setBarcodeLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchLocal = useCallback(
    async (q: string) => {
      if (!user || q.trim().length === 0) {
        setLocalResults([])
        return
      }
      setLocalLoading(true)

      const { data } = await supabase
        .from("foods")
        .select(
          "id, name, brand, calories_per_serving, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, serving_size_g"
        )
        .eq("user_id", user.id)
        .ilike("name", `%${q}%`)
        .limit(20)

      if (data) {
        setLocalResults(
          data.map((f) => ({
            id: f.id,
            name: f.name,
            brand: f.brand,
            calories: f.calories_per_serving || 0,
            protein: f.protein_g || 0,
            carbs: f.carbs_g || 0,
            fat: f.fat_g || 0,
            fiber: f.fiber_g || 0,
            sugar: f.sugar_g || 0,
            sodium: f.sodium_mg || 0,
            serving_size_g: f.serving_size_g || 100,
            source: "local" as const,
          }))
        )
      }
      setLocalLoading(false)
    },
    [user, supabase]
  )

  const searchOFF = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setOffResults([])
      return
    }
    setOffLoading(true)

    try {
      const res = await fetch("/api/food-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      })

      if (res.ok) {
        const data = await res.json()
        setOffResults(
          data.map((f: FoodResult) => ({
            ...f,
            source: "off" as const,
          }))
        )
      }
    } catch {
      // Silently fail
    }
    setOffLoading(false)
  }, [])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (query.trim().length === 0) {
      setLocalResults([])
      setOffResults([])
      return
    }

    debounceRef.current = setTimeout(() => {
      searchLocal(query)
      searchOFF(query)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, searchLocal, searchOFF])

  const handleSelectFood = (food: FoodResult) => {
    setSelectedFood(food)
    setServings(1)
  }

  const handleAddFood = async () => {
    if (!selectedFood || !user) return
    setAdding(true)

    try {
      // Save food to local DB if from OpenFoodFacts
      let foodId = selectedFood.id
      if (selectedFood.source === "off") {
        const { data: newFood } = await supabase
          .from("foods")
          .insert({
            user_id: user.id,
            name: selectedFood.name,
            brand: selectedFood.brand,
            barcode: selectedFood.barcode || null,
            off_id: selectedFood.off_id || null,
            serving_size_g: selectedFood.serving_size_g,
            serving_label: `${selectedFood.serving_size_g}g`,
            calories_per_serving: selectedFood.calories,
            protein_g: selectedFood.protein,
            carbs_g: selectedFood.carbs,
            fat_g: selectedFood.fat,
            fiber_g: selectedFood.fiber || null,
            sugar_g: selectedFood.sugar || null,
            sodium_mg: selectedFood.sodium || null,
            is_custom: false,
            is_favorite: false,
          })
          .select("id")
          .single()

        if (newFood) {
          foodId = newFood.id
        }
      }

      // Find or create meal
      let { data: existingMeal } = await supabase
        .from("meals")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", date)
        .eq("meal_type", mealType)
        .single()

      let mealId = existingMeal?.id

      if (!mealId) {
        const { data: newMeal } = await supabase
          .from("meals")
          .insert({
            user_id: user.id,
            date,
            meal_type: mealType,
          })
          .select("id")
          .single()

        mealId = newMeal?.id
      }

      if (mealId) {
        await supabase.from("meal_items").insert({
          meal_id: mealId,
          food_id: foodId || null,
          custom_name: foodId ? null : selectedFood.name,
          servings,
          calories: Math.round(selectedFood.calories * servings),
          protein_g: Math.round(selectedFood.protein * servings * 10) / 10,
          carbs_g: Math.round(selectedFood.carbs * servings * 10) / 10,
          fat_g: Math.round(selectedFood.fat * servings * 10) / 10,
        })
      }

      router.push("/nutrition")
    } catch {
      // Handle error
    } finally {
      setAdding(false)
    }
  }

  // --- Photo analysis handlers ---

  const handlePhotoCapture = async (
    base64: string,
    mediaType: "image/jpeg" | "image/png" | "image/webp"
  ) => {
    setShowCamera(false)
    setAnalyzing(true)

    try {
      const res = await fetch("/api/food-photo-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64, media_type: mediaType }),
      })

      if (res.ok) {
        const analysis: FoodPhotoAnalysis = await res.json()
        setAnalysisResults(analysis)
        setShowAnalysisResults(true)
      } else {
        const err = await res.json()
        alert(err.error || "Failed to analyze photo. Please try again.")
      }
    } catch {
      alert("Failed to analyze photo. Please check your connection and try again.")
    } finally {
      setAnalyzing(false)
    }
  }

  const handleBarcodeScan = async (barcode: string) => {
    setShowBarcode(false)
    setBarcodeLoading(true)

    try {
      const res = await fetch("/api/barcode-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      })

      if (res.ok) {
        const food = await res.json()
        handleSelectFood({
          ...food,
          source: "off" as const,
        })
      } else {
        const err = await res.json()
        alert(err.error || "Product not found for this barcode.")
      }
    } catch {
      alert("Failed to look up barcode. Please check your connection and try again.")
    } finally {
      setBarcodeLoading(false)
    }
  }

  const handleAddAnalyzedItems = async (items: AnalyzedFoodItem[]) => {
    if (!user || items.length === 0) return
    setAdding(true)

    try {
      // Find or create meal
      let { data: existingMeal } = await supabase
        .from("meals")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", date)
        .eq("meal_type", mealType)
        .single()

      let mealId = existingMeal?.id

      if (!mealId) {
        const { data: newMeal } = await supabase
          .from("meals")
          .insert({
            user_id: user.id,
            date,
            meal_type: mealType,
          })
          .select("id")
          .single()

        mealId = newMeal?.id
      }

      if (mealId) {
        const mealItems = items.map((item) => ({
          meal_id: mealId!,
          food_id: null,
          custom_name: item.name,
          servings: 1,
          calories: item.calories,
          protein_g: item.protein,
          carbs_g: item.carbs,
          fat_g: item.fat,
        }))

        await supabase.from("meal_items").insert(mealItems)
      }

      setShowAnalysisResults(false)
      setAnalysisResults(null)
      router.push("/nutrition")
    } catch {
      alert("Failed to add food items. Please try again.")
    } finally {
      setAdding(false)
    }
  }

  const handleSearchItem = (name: string) => {
    setShowAnalysisResults(false)
    setQuery(name)
    setActiveTab("search")
  }

  const renderFoodItem = (food: FoodResult) => (
    <button
      key={`${food.source}-${food.id || food.off_id || food.name}`}
      className="w-full text-left"
      onClick={() => handleSelectFood(food)}
    >
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-3 hover:bg-muted transition-colors">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{food.name}</p>
          {food.brand && (
            <p className="text-xs text-muted-foreground truncate">
              {food.brand}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {food.serving_size_g}g per serving
          </p>
        </div>
        <div className="text-right ml-3 shrink-0">
          <p className="text-sm font-semibold tabular-nums">
            {food.calories} cal
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            P: {food.protein}g &middot; C: {food.carbs}g &middot; F: {food.fat}g
          </p>
        </div>
      </div>
    </button>
  )

  const mealLabels: Record<MealType, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack",
  }

  return (
    <>
      <Header title="Add Food" />
      <div className="p-4 lg:p-8 space-y-4">
        {/* Back button and title */}
        <div className="flex items-center gap-3">
          <Link href="/nutrition">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold lg:text-2xl">Add Food</h1>
            <p className="text-sm text-muted-foreground">
              {mealLabels[mealType]} &middot; {date}
            </p>
          </div>
        </div>

        {/* Scan action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setShowCamera(true)}
            disabled={analyzing}
          >
            <Camera className="h-4 w-4 mr-2" />
            Scan Food
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setShowBarcode(true)}
            disabled={barcodeLoading}
          >
            <ScanBarcode className="h-4 w-4 mr-2" />
            Scan Barcode
          </Button>
        </div>

        {/* Analyzing overlay */}
        {(analyzing || barcodeLoading) && (
          <Card>
            <CardContent className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm font-medium">
                {analyzing ? "Analyzing your meal..." : "Looking up product..."}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {analyzing
                  ? "AI is identifying food items and estimating nutrition"
                  : "Searching the food database"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search foods..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as string)}
        >
          <TabsList className="w-full">
            <TabsTrigger value="my-foods" className="flex-1">
              My Foods
            </TabsTrigger>
            <TabsTrigger value="search" className="flex-1">
              Search
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-foods">
            <div className="space-y-2 mt-3">
              {localLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : localResults.length > 0 ? (
                localResults.map(renderFoodItem)
              ) : query.trim().length > 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No foods found in your database
                    </p>
                    <Link href="/nutrition/foods/new">
                      <Button variant="outline" size="sm" className="mt-3">
                        Create Custom Food
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Search your saved foods
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="search">
            <div className="space-y-2 mt-3">
              {offLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : offResults.length > 0 ? (
                offResults.map(renderFoodItem)
              ) : query.trim().length > 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No results found
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Search the OpenFoodFacts database
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Serving size dialog */}
      <Dialog
        open={!!selectedFood}
        onOpenChange={(open) => {
          if (!open) setSelectedFood(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedFood?.name}</DialogTitle>
          </DialogHeader>

          {selectedFood && (
            <div className="space-y-4">
              {selectedFood.brand && (
                <p className="text-sm text-muted-foreground">
                  {selectedFood.brand}
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="servings">
                  Servings ({selectedFood.serving_size_g}g each)
                </Label>
                <Input
                  id="servings"
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={servings}
                  onChange={(e) =>
                    setServings(Math.max(0.25, parseFloat(e.target.value) || 1))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Calories</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {Math.round(selectedFood.calories * servings)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Protein</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {Math.round(selectedFood.protein * servings * 10) / 10}g
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Carbs</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {Math.round(selectedFood.carbs * servings * 10) / 10}g
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fat</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {Math.round(selectedFood.fat * servings * 10) / 10}g
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={handleAddFood}
              disabled={adding}
              className="w-full sm:w-auto"
            >
              {adding && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add to {mealLabels[mealType]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Camera capture sheet */}
      <Sheet open={showCamera} onOpenChange={setShowCamera}>
        <SheetContent side="bottom" className="max-h-[90vh]">
          <SheetHeader>
            <SheetTitle>Scan Food</SheetTitle>
          </SheetHeader>
          <div className="p-4 pt-0">
            <CameraCapture
              onCapture={handlePhotoCapture}
              onCancel={() => setShowCamera(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Barcode scanner sheet */}
      <Sheet open={showBarcode} onOpenChange={setShowBarcode}>
        <SheetContent side="bottom" className="max-h-[90vh]">
          <SheetHeader>
            <SheetTitle>Scan Barcode</SheetTitle>
          </SheetHeader>
          <div className="p-4 pt-0">
            <BarcodeScanner
              onScan={handleBarcodeScan}
              onCancel={() => setShowBarcode(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Analysis results sheet */}
      <Sheet open={showAnalysisResults} onOpenChange={setShowAnalysisResults}>
        <SheetContent side="bottom" className="max-h-[85vh]">
          <SheetHeader>
            <SheetTitle>Food Analysis Results</SheetTitle>
          </SheetHeader>
          <div className="p-4 pt-0">
            {analysisResults && (
              <AnalysisResultsSheet
                analysis={analysisResults}
                mealLabel={mealLabels[mealType]}
                adding={adding}
                onAddItems={handleAddAnalyzedItems}
                onSearchItem={handleSearchItem}
                onClose={() => {
                  setShowAnalysisResults(false)
                  setAnalysisResults(null)
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
