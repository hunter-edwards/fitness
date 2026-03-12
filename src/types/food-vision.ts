/** A single food item identified by Claude Vision from a photo */
export interface AnalyzedFoodItem {
  name: string
  estimated_portion: string
  portion_grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  confidence: "high" | "medium" | "low"
  notes: string | null
}

/** Full response from the food photo analysis API */
export interface FoodPhotoAnalysis {
  meal_description: string
  items: AnalyzedFoodItem[]
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  analysis_notes: string | null
}
