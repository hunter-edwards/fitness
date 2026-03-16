import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface FoodItem {
  name: string
  estimated_serving_g: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    )
  }

  try {
    const { description } = await request.json()

    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: `You are a nutrition estimation assistant. The user will describe food they ate. Break it down into individual ingredients/components, estimate reasonable serving sizes from context clues (e.g. "splash" of milk ≈ 30ml, "2 scoops whey protein" ≈ 62g), and provide estimated nutritional info for each.

Respond with ONLY valid JSON in this exact format, no other text:
{
  "items": [
    {
      "name": "Ingredient name",
      "estimated_serving_g": 100,
      "calories": 150,
      "protein_g": 10,
      "carbs_g": 20,
      "fat_g": 5
    }
  ]
}

Rules:
- Be reasonable with estimates based on typical serving sizes
- Round numbers to whole values for calories, one decimal for macros
- If an ingredient has negligible nutrition (like ice, water), still include it with zeros
- Use common sense for vague quantities ("some", "a bit", "splash")
- Name each item clearly (e.g. "Whole Milk" not just "milk")`,
        messages: [
          {
            role: "user",
            content: `Estimate the nutrition for this food: ${description.trim()}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error("Claude API error:", err)
      return NextResponse.json(
        { error: "AI analysis failed" },
        { status: 500 }
      )
    }

    const result = await response.json()
    let text = (result.content?.[0]?.text || "").trim()

    // Strip markdown code fences if present (e.g. ```json ... ```)
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) {
      text = fenceMatch[1].trim()
    }

    // Parse JSON from response
    const parsed = JSON.parse(text)
    const items: FoodItem[] = (parsed.items || []).map((item: FoodItem) => ({
      name: String(item.name || "Unknown"),
      estimated_serving_g: Math.round(Number(item.estimated_serving_g) || 0),
      calories: Math.round(Number(item.calories) || 0),
      protein_g: Math.round((Number(item.protein_g) || 0) * 10) / 10,
      carbs_g: Math.round((Number(item.carbs_g) || 0) * 10) / 10,
      fat_g: Math.round((Number(item.fat_g) || 0) * 10) / 10,
    }))

    return NextResponse.json({ items })
  } catch (err) {
    console.error("Analyze food error:", err)
    return NextResponse.json(
      { error: "Failed to analyze food description" },
      { status: 500 }
    )
  }
}
