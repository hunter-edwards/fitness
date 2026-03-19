import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
} from "date-fns"

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    )
  }

  try {
    const { period = "weekly" } = await request.json()
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Calculate date range for LAST completed period
    let fromDate: string
    let toDate: string
    let periodLabel: string

    if (period === "monthly") {
      const lastMonth = subMonths(new Date(), 1)
      fromDate = format(startOfMonth(lastMonth), "yyyy-MM-dd")
      toDate = format(endOfMonth(lastMonth), "yyyy-MM-dd")
      periodLabel = format(lastMonth, "MMMM yyyy")
    } else {
      const lastWeek = subWeeks(new Date(), 1)
      fromDate = format(startOfWeek(lastWeek, { weekStartsOn: 0 }), "yyyy-MM-dd")
      toDate = format(endOfWeek(lastWeek, { weekStartsOn: 0 }), "yyyy-MM-dd")
      periodLabel = `Week of ${format(startOfWeek(lastWeek, { weekStartsOn: 0 }), "MMM d")} - ${format(endOfWeek(lastWeek, { weekStartsOn: 0 }), "MMM d, yyyy")}`
    }

    // Gather all data for the period
    const [weightsRes, mealsRes, workoutsRes, activityRes, goalsRes, targetsRes] =
      await Promise.all([
        supabase
          .from("weight_entries")
          .select("date, weight_kg, body_fat_pct")
          .eq("user_id", user.id)
          .gte("date", fromDate)
          .lte("date", toDate)
          .order("date"),
        supabase
          .from("meals")
          .select(
            "date, meal_type, meal_items(calories, protein_g, carbs_g, fat_g)"
          )
          .eq("user_id", user.id)
          .gte("date", fromDate)
          .lte("date", toDate),
        supabase
          .from("workouts")
          .select(
            "date, name, status, duration_minutes, total_volume_kg, workout_sets(reps, weight_kg, set_type)"
          )
          .eq("user_id", user.id)
          .gte("date", fromDate)
          .lte("date", toDate),
        supabase
          .from("activity_entries")
          .select("date, steps, active_minutes")
          .eq("user_id", user.id)
          .gte("date", fromDate)
          .lte("date", toDate),
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
      ])

    const weights = weightsRes.data || []
    type MealRow = {
      date: string
      meal_type: string
      meal_items: {
        calories: number | null
        protein_g: number | null
        carbs_g: number | null
        fat_g: number | null
      }[]
    }
    const meals = (mealsRes.data || []) as MealRow[]
    const workouts = workoutsRes.data || []
    const activity = activityRes.data || []
    const goals = goalsRes.data || []
    const targets = targetsRes.data

    // Aggregate daily nutrition
    const nutByDay: Record<
      string,
      { cal: number; protein: number; carbs: number; fat: number; meals: number }
    > = {}
    meals.forEach((m) => {
      if (!nutByDay[m.date])
        nutByDay[m.date] = { cal: 0, protein: 0, carbs: 0, fat: 0, meals: 0 }
      nutByDay[m.date].meals++
      ;(m.meal_items || []).forEach((item) => {
        nutByDay[m.date].cal += item.calories || 0
        nutByDay[m.date].protein += item.protein_g || 0
        nutByDay[m.date].carbs += item.carbs_g || 0
        nutByDay[m.date].fat += item.fat_g || 0
      })
    })

    const nutDays = Object.entries(nutByDay)
    const avgCal =
      nutDays.length > 0
        ? Math.round(
            nutDays.reduce((s, [, n]) => s + n.cal, 0) / nutDays.length
          )
        : 0
    const avgProtein =
      nutDays.length > 0
        ? Math.round(
            nutDays.reduce((s, [, n]) => s + n.protein, 0) / nutDays.length
          )
        : 0
    const avgCarbs =
      nutDays.length > 0
        ? Math.round(
            nutDays.reduce((s, [, n]) => s + n.carbs, 0) / nutDays.length
          )
        : 0
    const avgFat =
      nutDays.length > 0
        ? Math.round(
            nutDays.reduce((s, [, n]) => s + n.fat, 0) / nutDays.length
          )
        : 0

    // Workout stats
    const completedWorkouts = workouts.filter(
      (w) => w.status === "completed"
    )
    const skippedWorkouts = workouts.filter((w) => w.status === "skipped")
    const totalVolKg = completedWorkouts.reduce(
      (s, w) => s + (w.total_volume_kg || 0),
      0
    )
    const totalDuration = completedWorkouts.reduce(
      (s, w) => s + (w.duration_minutes || 0),
      0
    )

    // Activity stats
    const avgSteps =
      activity.length > 0
        ? Math.round(
            activity.reduce((s, a) => s + (a.steps || 0), 0) / activity.length
          )
        : 0
    const avgActiveMin =
      activity.length > 0
        ? Math.round(
            activity.reduce((s, a) => s + (a.active_minutes || 0), 0) /
              activity.length
          )
        : 0

    const summary = `
${period.toUpperCase()} REPORT: ${periodLabel}
Date range: ${fromDate} to ${toDate}

WEIGHT:
- Entries: ${weights.length}
${
  weights.length >= 2
    ? `- Start: ${(weights[0].weight_kg * 2.20462).toFixed(1)} lbs
- End: ${(weights[weights.length - 1].weight_kg * 2.20462).toFixed(1)} lbs
- Change: ${((weights[weights.length - 1].weight_kg - weights[0].weight_kg) * 2.20462).toFixed(1)} lbs`
    : weights.length === 1
      ? `- Only entry: ${(weights[0].weight_kg * 2.20462).toFixed(1)} lbs`
      : "- No data"
}

NUTRITION (${nutDays.length} days logged):
- Avg daily: ${avgCal} cal, ${avgProtein}g protein, ${avgCarbs}g carbs, ${avgFat}g fat
${targets ? `- Targets: ${targets.calories} cal, ${targets.protein_g}g protein, ${targets.carbs_g}g carbs, ${targets.fat_g}g fat` : "- No targets set"}
${targets && nutDays.length > 0 && targets.calories > 0 ? `- Calorie adherence: ${Math.round((avgCal / targets.calories) * 100)}%\n${targets.protein_g > 0 ? `- Protein adherence: ${Math.round((avgProtein / targets.protein_g) * 100)}%` : ""}` : ""}
- Daily breakdown:
${nutDays.map(([date, n]) => `  ${date}: ${Math.round(n.cal)} cal, ${Math.round(n.protein)}g P`).join("\n")}

WORKOUTS:
- Completed: ${completedWorkouts.length}, Skipped: ${skippedWorkouts.length}
- Total duration: ${totalDuration} min
- Total volume: ${Math.round(totalVolKg * 2.20462).toLocaleString()} lbs
- Sessions: ${completedWorkouts.map((w) => `${w.name} (${w.duration_minutes || "?"}min)`).join(", ") || "none"}

ACTIVITY (${activity.length} days logged):
- Avg steps: ${avgSteps.toLocaleString()}
- Avg active minutes: ${avgActiveMin}

GOALS:
${goals.map((g) => `- ${g.title} (${g.category}): ${g.current_value ?? "?"} / ${g.target_value ?? "?"} ${g.target_unit || ""}`).join("\n") || "- None set"}
`.trim()

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: `You are a personal fitness coach writing a ${period} progress report for your client. Respond with a JSON object (no markdown fences) with this exact shape:
{
  "title": "short title for this report period",
  "grade": "A+ to F letter grade for overall adherence and effort",
  "summary": "2-3 sentence executive summary of the period",
  "sections": [
    {
      "title": "section name (e.g. Nutrition, Training, Activity, Recovery)",
      "grade": "A+ to F for this area",
      "body": "2-4 sentences analyzing this area with specific numbers. Mention what went well and what needs work."
    }
  ],
  "wins": ["specific accomplishment 1", "specific accomplishment 2"],
  "improvements": ["specific actionable improvement 1", "specific actionable improvement 2"],
  "focusNextPeriod": "1-2 sentence recommendation for the upcoming ${period === "monthly" ? "month" : "week"}"
}
Include 3-5 sections. Include 2-3 wins and 2-3 improvements. All weights in lbs. Be specific with numbers from the data. Be encouraging but honest.`,
        messages: [
          {
            role: "user",
            content: `Generate my ${period} fitness report:\n\n${summary}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error("Reports API error:", err)
      return NextResponse.json(
        { error: "AI report generation failed" },
        { status: 500 }
      )
    }

    const result = await response.json()
    const text = result.content?.[0]?.text || "{}"

    let report
    try {
      const cleaned = text.replace(/```json?\n?/g, "").replace(/```\n?/g, "")
      report = JSON.parse(cleaned)
    } catch {
      report = {
        title: periodLabel,
        grade: "?",
        summary: text,
        sections: [],
        wins: [],
        improvements: [],
        focusNextPeriod: "",
      }
    }

    return NextResponse.json({ report, period: periodLabel, fromDate, toDate })
  } catch (err) {
    console.error("Report generation error:", err)
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    )
  }
}
