import { NextRequest, NextResponse } from "next/server"
import { type OFFProduct, normalizeProduct } from "@/lib/openfoodfacts"

export async function POST(request: NextRequest) {
  try {
    const { barcode } = await request.json()

    if (!barcode || typeof barcode !== "string" || barcode.trim().length === 0) {
      return NextResponse.json(
        { error: "Barcode is required" },
        { status: 400 }
      )
    }

    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      barcode.trim()
    )}.json?fields=product_name,product_name_en,brands,code,_id,nutriments,serving_size,serving_quantity`

    const response = await fetch(url, {
      headers: { "User-Agent": "FitTrack/1.0 (fitness-app)" },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to look up barcode" },
        { status: 502 }
      )
    }

    const data = await response.json()

    if (data.status === 0 || !data.product) {
      return NextResponse.json(
        { error: "Product not found for this barcode" },
        { status: 404 }
      )
    }

    const product = data.product as OFFProduct
    // Ensure the barcode is set from the request since OFF may not return it in the product fields
    if (!product.code) {
      product.code = barcode.trim()
    }

    const normalized = normalizeProduct(product)

    if (!normalized) {
      return NextResponse.json(
        { error: "Product found but has no name. Cannot process." },
        { status: 422 }
      )
    }

    return NextResponse.json(normalized)
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
