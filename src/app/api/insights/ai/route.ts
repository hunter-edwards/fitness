import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { subDays, format } from "date-fns"

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    )
  }

  try {
    const { days = 30 } = await request.json()
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const from = format(subDays(new Date(), days), "yyyy-MM-dd")

    // Gather data
    const [weightsRes, mealsRes, workoutsRes, activityRes, goalsRes] = await Promise.all([
      supabase
        .from("weight_entries")
        .select("date, weight_kg, body_fat_pct")
        .eq("user_id", user.id)
        .gte("date", from)
        .order("date"),
      supabase
        .from("meals")
        .select("date, meal_items(calories, protein_g, carbs_g, fat_g)")
        .eq("user_id", user.id)
        .gte("date", from),
      supabase
        .from("workouts")
        .select("date, name, duration_minutes, total_volume_kg, status")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("date", from),
      supabase
        .from("activity_entries")
        .select("date, steps, active_minutes")
        .eq("user_id", user.id)
        .gte("date", from),
      supabase
        .from("goals")
        .select("title, category, target_value, current_value, target_unit, status")
        .eq("user_id", user.id)
        .eq("status", "active"),
    ])

    // Summarize
    const weights = weightsRes.data || []
    type MealRow = { date: string; meal_items: { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }[] }
    const meals = (mealsRes.data || []) as MealRow[]
    const workouts = workoutsRes.data || []
    const activity = activityRes.data || []
    const goals = goalsRes.data || []

    // Aggregate daily nutrition
    const nutMap: Record<string, { cal: number; protein: number; carbs: number; fat: number }> = {}
    meals.forEach((m) => {
      if (!nutMap[m.date]) nutMap[m.date] = { cal: 0, protein: 0, carbs: 0, fat: 0 }
      ;(m.meal_items || []).forEach((item) => {
        nutMap[m.date].cal += item.calories || 0
        nutMap[m.date].protein += item.protein_g || 0
        nutMap[m.date].carbs += item.carbs_g || 0
        nutMap[m.date].fat += item.fat_g || 0
      })
    })

    const nutDays = Object.values(nutMap)
    const avgCal = nutDays.length > 0
      ? Math.round(nutDays.reduce((s, n) => s + n.cal, 0) / nutDays.length)
      : 0
    const avgProtein = nutDays.length > 0
      ? Math.round(nutDays.reduce((s, n) => s + n.protein, 0) / nutDays.length)
      : 0

    const summary = `
FITNESS DATA SUMMARY (Last ${days} days):

WEIGHT:
- Entries: ${weights.length}
${weights.length > 0 ? `- Start: ${(weights[0].weight_kg * 2.20462).toFixed(1)} lbs
- End: ${(weights[weights.length - 1].weight_kg * 2.20462).toFixed(1)} lbs
- Change: ${((weights[weights.length - 1].weight_kg - weights[0].weight_kg) * 2.20462).toFixed(1)} lbs` : "- No data"}

NUTRITION:
- Days logged: ${nutDays.length}
- Avg daily calories: ${avgCal}
- Avg daily protein: ${avgProtein}g

WORKOUTS:
- Sessions: ${workouts.length}
- Avg per week: ${(workouts.length / (days / 7)).toFixed(1)}
${workouts.length > 0 ? `- Avg duration: ${Math.round(workouts.reduce((s, w) => s + (w.duration_minutes || 0), 0) / workouts.length)} min` : ""}

ACTIVITY:
- Days logged: ${activity.length}
${activity.length > 0 ? `- Avg steps: ${Math.round(activity.reduce((s, a) => s + (a.steps || 0), 0) / activity.length)}` : "- No data"}

ACTIVE GOALS:
${goals.map((g) => `- ${g.title} (${g.category}): ${g.current_value ?? "?"} / ${g.target_value ?? "?"} ${g.target_unit || ""}`).join("\n") || "- None set"}
`.trim()

    // Call Claude
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
        system: "You are a concise fitness analytics assistant. Analyze the user's fitness data and provide actionable insights. Focus on trends, correlations between nutrition and performance, areas for improvement, and positive progress. Be specific with numbers. Keep it under 300 words.",
        messages: [
          {
            role: "user",
            content: `Analyze my fitness data and give me insights:\n\n${summary}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error("Claude API error:", err)
      return NextResponse.json({ error: "AI analysis failed" }, { status: 500 })
    }

    const result = await response.json()
    const analysis = result.content?.[0]?.text || "No analysis generated"

    return NextResponse.json({ analysis })
  } catch (err) {
    console.error("AI insights error:", err)
    return NextResponse.json(
      { error: "Failed to generate AI insights" },
      { status: 500 }
    )
  }
}
