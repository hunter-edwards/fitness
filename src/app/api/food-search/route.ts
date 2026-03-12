import { NextRequest, NextResponse } from "next/server"
import { type OFFProduct, normalizeProduct } from "@/lib/openfoodfacts"

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

    const results = products
      .map((p) => normalizeProduct(p))
      .filter((r): r is NonNullable<typeof r> => r !== null)

    return NextResponse.json(results)
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
