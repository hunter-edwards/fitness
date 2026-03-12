export interface OFFProduct {
  product_name?: string
  product_name_en?: string
  brands?: string
  code?: string
  _id?: string
  nutriments?: {
    "energy-kcal_100g"?: number
    "energy-kcal_serving"?: number
    proteins_100g?: number
    proteins_serving?: number
    carbohydrates_100g?: number
    carbohydrates_serving?: number
    fat_100g?: number
    fat_serving?: number
    fiber_100g?: number
    fiber_serving?: number
    sugars_100g?: number
    sugars_serving?: number
    sodium_100g?: number
    sodium_serving?: number
  }
  serving_size?: string
  serving_quantity?: number
}

export interface NormalizedFood {
  name: string
  brand: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  serving_size_g: number
  off_id: string
  barcode: string | null
}

export function normalizeProduct(p: OFFProduct): NormalizedFood | null {
  const name = p.product_name || p.product_name_en
  if (!name || name.trim().length === 0) return null

  const n = p.nutriments || {}
  const servingG = p.serving_quantity || 100
  const isPerServing = !!p.serving_quantity && p.serving_quantity > 0

  const calories = isPerServing
    ? n["energy-kcal_serving"] ?? (n["energy-kcal_100g"] ?? 0) * (servingG / 100)
    : n["energy-kcal_100g"] ?? 0

  const protein = isPerServing
    ? n.proteins_serving ?? (n.proteins_100g ?? 0) * (servingG / 100)
    : n.proteins_100g ?? 0

  const carbs = isPerServing
    ? n.carbohydrates_serving ?? (n.carbohydrates_100g ?? 0) * (servingG / 100)
    : n.carbohydrates_100g ?? 0

  const fat = isPerServing
    ? n.fat_serving ?? (n.fat_100g ?? 0) * (servingG / 100)
    : n.fat_100g ?? 0

  const fiber = isPerServing
    ? n.fiber_serving ?? (n.fiber_100g ?? 0) * (servingG / 100)
    : n.fiber_100g ?? 0

  const sugar = isPerServing
    ? n.sugars_serving ?? (n.sugars_100g ?? 0) * (servingG / 100)
    : n.sugars_100g ?? 0

  const sodium = isPerServing
    ? n.sodium_serving ?? (n.sodium_100g ?? 0) * (servingG / 100)
    : n.sodium_100g ?? 0

  return {
    name: name.trim(),
    brand: p.brands?.trim() || null,
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    sugar: Math.round(sugar * 10) / 10,
    sodium: Math.round(sodium * 1000),
    serving_size_g: Math.round(servingG),
    off_id: p._id || "",
    barcode: p.code || null,
  }
}
