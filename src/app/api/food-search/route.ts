import { NextRequest, NextResponse } from "next/server"

interface OFFProduct {
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

interface NormalizedFood {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, page = 1 } = body

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      )
    }

    const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      query.trim()
    )}&json=true&page_size=20&page=${page}&fields=product_name,product_name_en,brands,code,_id,nutriments,serving_size,serving_quantity`

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "FitTrack/1.0 (fitness-app)",
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to search foods" },
        { status: 502 }
      )
    }

    const data = await response.json()
    const products: OFFProduct[] = data.products || []

    const results: NormalizedFood[] = products
      .filter((p) => {
        const name = p.product_name || p.product_name_en
        return name && name.trim().length > 0
      })
      .map((p) => {
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
          name: (p.product_name || p.product_name_en || "").trim(),
          brand: p.brands?.trim() || null,
          calories: Math.round(calories),
          protein: Math.round(protein * 10) / 10,
          carbs: Math.round(carbs * 10) / 10,
          fat: Math.round(fat * 10) / 10,
          fiber: Math.round(fiber * 10) / 10,
          sugar: Math.round(sugar * 10) / 10,
          sodium: Math.round(sodium * 1000) / 1, // convert to mg
          serving_size_g: Math.round(servingG),
          off_id: p._id || "",
          barcode: p.code || null,
        }
      })

    return NextResponse.json(results)
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
