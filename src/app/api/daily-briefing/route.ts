import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { format, subDays } from "date-fns"

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    )
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const today = format(new Date(), "yyyy-MM-dd")
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd")

    // Gather yesterday's data + today's schedule + goals + targets
    const [
      yesterdayMealsRes,
      yesterdayWorkoutsRes,
      yesterdayActivityRes,
      todayScheduledRes,
      goalsRes,
      targetsRes,
      recentWeightsRes,
    ] = await Promise.all([
      supabase
        .from("meals")
        .select("meal_type, meal_items(calories, protein_g, carbs_g, fat_g)")
        .eq("user_id", user.id)
        .eq("date", yesterday),
      supabase
        .from("workouts")
        .select(
          "name, status, duration_minutes, total_volume_kg, workout_sets(exercise_id, reps, weight_kg, set_type)"
        )
        .eq("user_id", user.id)
        .eq("date", yesterday)
        .in("status", ["completed", "skipped"]),
      supabase
        .from("activity_entries")
        .select("steps, active_minutes")
        .eq("user_id", user.id)
        .eq("date", yesterday)
        .single(),
      supabase
        .from("workouts")
        .select(
          "name, workout_sets(exercise_id, reps, weight_kg, exercises:exercise_id(name))"
        )
        .eq("user_id", user.id)
        .eq("date", today)
        .eq("status", "scheduled"),
      supabase
        .from("goals")
        .select(
          "title, category, target_value, current_value, target_unit, status"
        )
        .eq("user_id", user.id)
        .eq("status", "active"),
      supabase
        .from("nutrition_targets")
        .select("calories, protein_g, carbs_g, fat_g")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single(),
      supabase
        .from("weight_entries")
        .select("date, weight_kg")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(7),
    ])

    // Aggregate yesterday's nutrition
    type MealRow = {
      meal_type: string
      meal_items: {
        calories: number | null
        protein_g: number | null
        carbs_g: number | null
        fat_g: number | null
      }[]
    }
    const yesterdayMeals = (yesterdayMealsRes.data || []) as MealRow[]
    let yCal = 0,
      yProtein = 0,
      yCarbs = 0,
      yFat = 0
    yesterdayMeals.forEach((m) => {
      ;(m.meal_items || []).forEach((item) => {
        yCal += item.calories || 0
        yProtein += item.protein_g || 0
        yCarbs += item.carbs_g || 0
        yFat += item.fat_g || 0
      })
    })

    const targets = targetsRes.data
    const yesterdayWorkouts = yesterdayWorkoutsRes.data || []
    const yesterdayActivity = yesterdayActivityRes.data
    const todayScheduled = todayScheduledRes.data || []
    const goals = goalsRes.data || []
    const recentWeights = recentWeightsRes.data || []

    // Build summary text
    const summary = `
YESTERDAY'S ACTIVITY (${yesterday}):

NUTRITION:
- Total: ${Math.round(yCal)} cal, ${Math.round(yProtein)}g protein, ${Math.round(yCarbs)}g carbs, ${Math.round(yFat)}g fat
- Meals logged: ${yesterdayMeals.length} (${yesterdayMeals.map((m) => m.meal_type).join(", ") || "none"})
${targets ? `- Targets: ${targets.calories} cal, ${targets.protein_g}g protein, ${targets.carbs_g}g carbs, ${targets.fat_g}g fat` : "- No nutrition targets set"}
${targets ? `- Adherence: ${Math.round((yCal / targets.calories) * 100)}% calories, ${Math.round((yProtein / targets.protein_g) * 100)}% protein` : ""}

WORKOUTS:
${
  yesterdayWorkouts.length > 0
    ? yesterdayWorkouts
        .map((w) => {
          const volLbs = w.total_volume_kg
            ? Math.round(w.total_volume_kg * 2.20462)
            : 0
          return `- ${w.name} (${w.status}): ${w.duration_minutes || "?"}min, ${volLbs} lbs volume, ${w.workout_sets?.length || 0} sets`
        })
        .join("\n")
    : "- No workout yesterday"
}

ACTIVITY:
${yesterdayActivity ? `- Steps: ${yesterdayActivity.steps || 0}, Active minutes: ${yesterdayActivity.active_minutes || 0}` : "- No activity data"}

WEIGHT TREND (last 7 entries):
${recentWeights.length > 0 ? recentWeights.map((w) => `- ${w.date}: ${(w.weight_kg * 2.20462).toFixed(1)} lbs`).join("\n") : "- No entries"}

---

TODAY'S SCHEDULE (${today}):
${
  todayScheduled.length > 0
    ? todayScheduled
        .map((w) => {
          return `- ${w.name} (${w.workout_sets?.length || 0} sets planned)`
        })
        .join("\n")
    : "- No workouts scheduled"
}

ACTIVE GOALS:
${goals.map((g) => `- ${g.title} (${g.category}): ${g.current_value ?? "?"} / ${g.target_value ?? "?"} ${g.target_unit || ""}`).join("\n") || "- None"}
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
        system: `You are a personal fitness coach reviewing your client's day. Respond with a JSON object (no markdown fences) with this exact shape:
{
  "yesterdayRecap": "2-3 sentence summary of yesterday's performance across nutrition, workout, and activity. Be specific with numbers. Mention what went well and what was missed.",
  "suggestions": [
    { "text": "actionable suggestion for today", "category": "nutrition|workout|activity|recovery" },
    { "text": "another suggestion", "category": "..." }
  ]
}
Provide 2-4 suggestions. Be encouraging but honest. Reference actual numbers from the data. All weights in lbs. Keep each suggestion under 30 words. The recap should be under 60 words.`,
        messages: [
          {
            role: "user",
            content: `Review my fitness data and give me my daily briefing:\n\n${summary}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error("Daily briefing API error:", err)
      return NextResponse.json(
        { error: "AI briefing failed" },
        { status: 500 }
      )
    }

    const result = await response.json()
    const text = result.content?.[0]?.text || "{}"

    // Parse JSON response, handle possible markdown fences
    let briefing
    try {
      const cleaned = text.replace(/```json?\n?/g, "").replace(/```\n?/g, "")
      briefing = JSON.parse(cleaned)
    } catch {
      briefing = {
        yesterdayRecap: text,
        suggestions: [],
      }
    }

    return NextResponse.json({ briefing })
  } catch (err) {
    console.error("Daily briefing error:", err)
    return NextResponse.json(
      { error: "Failed to generate daily briefing" },
      { status: 500 }
    )
  }
}
