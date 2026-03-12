import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import type { FoodPhotoAnalysis } from "@/types/food-vision"

const FOOD_ANALYSIS_SYSTEM_PROMPT = `You are an expert nutritionist and food analyst. Your job is to analyze a photo of food and provide a detailed nutritional breakdown.

ANALYSIS PROCESS:
1. IDENTIFY every distinct food item visible in the photo
2. ESTIMATE the portion size of each item using visual cues:
   - Plate size (standard dinner plate ~26cm / ~10in diameter)
   - Relative proportions of items to each other
   - Common serving conventions (a chicken breast is typically 120-200g, a cup of rice ~185g cooked)
   - Thickness and density of items
3. CALCULATE macronutrients for each item based on USDA-standard nutrition data per gram
4. CROSS-CHECK: Verify that calories = (protein*4) + (carbs*4) + (fat*9) within a 5% margin

PORTION ESTIMATION GUIDELINES:
- A fist-sized portion of rice/pasta = ~150-200g cooked
- A palm-sized piece of meat = ~100-140g
- A thumb-sized portion of fat/cheese = ~15-20g
- A cupped hand of vegetables = ~75-100g
- A standard bowl of soup = ~350-400ml
- A sandwich = estimate bread (2 slices ~60g) plus fillings separately
- A standard burrito/wrap = tortilla (~60g) plus fillings
- When in doubt, estimate CONSERVATIVELY (slightly lower rather than higher)

COOKING METHOD ADJUSTMENTS:
- Grilled/baked chicken breast: ~1.6 cal/g, 0.31g protein/g
- Fried foods: add 30-50% more calories vs baked/grilled due to oil absorption
- Sauces and dressings: identify and estimate separately (2 tbsp = ~30ml)
- Oil visible on food = add ~120 cal per tablespoon estimated
- Breaded/battered items: account for the coating (~50-80 cal extra per 100g)

COMMON FOOD REFERENCE DATA (per 100g cooked unless noted):
- White rice: 130 cal, 2.7g P, 28g C, 0.3g F
- Brown rice: 123 cal, 2.7g P, 26g C, 1g F
- Chicken breast (grilled): 165 cal, 31g P, 0g C, 3.6g F
- Salmon (baked): 208 cal, 20g P, 0g C, 13g F
- Broccoli (steamed): 35 cal, 2.4g P, 7g C, 0.4g F
- Pasta (cooked): 131 cal, 5g P, 25g C, 1.1g F
- Ground beef (85% lean): 250 cal, 26g P, 0g C, 15g F
- Egg (large, ~50g): 78 cal, 6g P, 0.6g C, 5g F
- Avocado: 160 cal, 2g P, 8.5g C, 15g F
- Sweet potato: 90 cal, 2g P, 21g C, 0.1g F

Return ONLY valid JSON with this exact schema. No markdown fences, no explanation:
{
  "meal_description": "Brief natural-language description of the full meal",
  "items": [
    {
      "name": "Food item name (specific, e.g. 'Grilled Chicken Breast' not just 'Chicken')",
      "estimated_portion": "Human-readable portion (e.g. '1 medium breast (~170g)')",
      "portion_grams": 170,
      "calories": 280,
      "protein": 53,
      "carbs": 0,
      "fat": 6,
      "fiber": 0,
      "sugar": 0,
      "confidence": "high",
      "notes": "Appears grilled with light seasoning"
    }
  ],
  "total_calories": 650,
  "total_protein": 72,
  "total_carbs": 55,
  "total_fat": 18,
  "analysis_notes": "Meal is high in protein and well-balanced. Consider adding more vegetables for fiber."
}

CONFIDENCE LEVELS:
- "high": clearly identifiable food, standard preparation (e.g. plain grilled chicken breast)
- "medium": identifiable but portion is hard to gauge or mixed dish (e.g. stir-fry, casserole)
- "low": partially obscured, unfamiliar preparation, or very hard to estimate (e.g. heavily sauced dish)

IMPORTANT RULES:
- Round calories to nearest whole number
- Round macros (protein, carbs, fat) to nearest whole number
- Round fiber and sugar to nearest 0.5g
- Always include ALL visible food items including condiments, beverages, sides
- If a food is partially hidden, state this in notes and estimate conservatively
- If you cannot identify a food at all, use name "Unidentified food" with confidence "low" and best-guess macros
- Totals MUST equal the sum of individual items
- Do NOT include drinks like water (0 cal) unless they clearly contain calories (juice, soda, milk, etc.)`

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured. Please set it in your environment variables." },
      { status: 500 }
    )
  }

  try {
    const { image_base64, media_type, context } = await request.json()

    if (!image_base64 || !media_type) {
      return NextResponse.json(
        { error: "image_base64 and media_type are required" },
        { status: 400 }
      )
    }

    if (image_base64.length > 20_000_000) {
      return NextResponse.json(
        { error: "Image too large. Please use a smaller image." },
        { status: 400 }
      )
    }

    const anthropic = new Anthropic({ apiKey })

    const userMessage = context
      ? `Analyze this food photo. Additional context from user: ${context}`
      : "Analyze this food photo and provide a detailed nutritional breakdown."

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: FOOD_ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type,
                data: image_base64,
              },
            },
            {
              type: "text",
              text: userMessage,
            },
          ],
        },
      ],
    })

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")

    let jsonStr = responseText.trim()
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    let analysis: FoodPhotoAnalysis
    try {
      analysis = JSON.parse(jsonStr)
    } catch {
      console.error("Food analysis returned invalid JSON:", jsonStr.slice(0, 500))
      return NextResponse.json(
        { error: "Failed to parse food analysis. Please try again with a clearer photo." },
        { status: 500 }
      )
    }

    if (!analysis.items || !Array.isArray(analysis.items) || analysis.items.length === 0) {
      return NextResponse.json(
        { error: "No food items could be identified in the photo. Please try a clearer photo." },
        { status: 422 }
      )
    }

    // Clean up and validate each item
    analysis.items = analysis.items.map((item) => ({
      name: item.name || "Unknown food",
      estimated_portion: item.estimated_portion || `~${item.portion_grams || 100}g`,
      portion_grams: typeof item.portion_grams === "number" ? item.portion_grams : 100,
      calories: typeof item.calories === "number" ? Math.round(item.calories) : 0,
      protein: typeof item.protein === "number" ? Math.round(item.protein) : 0,
      carbs: typeof item.carbs === "number" ? Math.round(item.carbs) : 0,
      fat: typeof item.fat === "number" ? Math.round(item.fat) : 0,
      fiber: typeof item.fiber === "number" ? Math.round(item.fiber * 2) / 2 : 0,
      sugar: typeof item.sugar === "number" ? Math.round(item.sugar * 2) / 2 : 0,
      confidence: (["high", "medium", "low"].includes(item.confidence) ? item.confidence : "medium") as "high" | "medium" | "low",
      notes: item.notes || null,
    }))

    // Recalculate totals from items to ensure consistency
    analysis.total_calories = analysis.items.reduce((sum, i) => sum + i.calories, 0)
    analysis.total_protein = analysis.items.reduce((sum, i) => sum + i.protein, 0)
    analysis.total_carbs = analysis.items.reduce((sum, i) => sum + i.carbs, 0)
    analysis.total_fat = analysis.items.reduce((sum, i) => sum + i.fat, 0)

    return NextResponse.json(analysis)
  } catch (err) {
    console.error("Food photo analysis error:", err)
    return NextResponse.json(
      { error: "Failed to analyze food photo. Please try again." },
      { status: 500 }
    )
  }
}
