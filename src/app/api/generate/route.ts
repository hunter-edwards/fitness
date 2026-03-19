import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type GenerateRequest = {
  type: "workout" | "cardio" | "meal" | "goals"
  fields: Record<string, string | number>
  messages?: { role: "user" | "assistant"; content: string }[]
  action: "chat" | "generate"
}

const CHAT_MODEL = "claude-haiku-4-5-20251001"
const GENERATE_MODEL = "claude-sonnet-4-20250514"

function getChatSystemPrompt(type: string): string {
  const typeLabels: Record<string, string> = {
    workout: "strength training workout plan",
    cardio: "cardio/endurance training plan",
    meal: "meal plan",
    goals: "fitness goals",
  }

  return `You are an expert fitness coach helping a client create a ${typeLabels[type] || "fitness plan"}. Your job is to ask smart follow-up questions to gather enough information to generate a high-quality, personalized plan.

Ask about relevant details like:
- For workouts/cardio: experience level, available equipment, days per week, time per session, injuries/limitations, specific goals (hypertrophy, strength, endurance), preferred exercises or styles
- For meals: dietary restrictions/preferences, calorie targets, number of meals per day, cooking skill, budget, foods they enjoy or dislike
- For goals: current stats, timeline, past experience, what they've tried before, how they'll measure progress

Respond with a JSON object (no markdown fences):
{
  "message": "Your follow-up question or acknowledgment",
  "ready": false
}

Set "ready" to true ONLY when you have gathered enough information to generate an excellent personalized plan (typically after 2-4 exchanges). When ready, set your message to a brief summary of what you'll generate.

Ask ONE focused question at a time. Be conversational and encouraging. Reference their previous answers to show you're listening.`
}

function getGenerateSystemPrompt(type: string): string {
  switch (type) {
    case "workout":
      return `You are an expert strength & conditioning coach creating a personalized workout plan. Generate a structured workout program based on the user's requirements.

Respond with a JSON object (no markdown fences) matching this exact structure:
{
  "weeks": [
    {
      "week_number": 1,
      "name": "Week 1",
      "workouts": [
        {
          "name": "Push Day",
          "day_of_week": 1,
          "exercises": [
            {
              "name": "Bench Press",
              "sets": 4,
              "reps": "8-12",
              "weight_suggestion": null,
              "rest_seconds": 90,
              "notes": null
            }
          ]
        }
      ]
    }
  ]
}

Guidelines:
- day_of_week is 0=Sunday through 6=Saturday
- Include appropriate warm-up notes where relevant
- Use rep ranges (e.g. "8-12") for hypertrophy, specific reps (e.g. "5") for strength
- rest_seconds should reflect the exercise type (60-90s for accessories, 120-180s for compounds)
- weight_suggestion can be null or a string like "moderate" or "RPE 7-8"
- Include 4-8 exercises per workout depending on the split
- Ensure balanced programming with proper push/pull ratios
- Add notes for form cues on complex movements`

    case "cardio":
      return `You are an expert endurance coach creating a personalized cardio/conditioning plan. Generate a structured cardio program based on the user's requirements.

Respond with a JSON object (no markdown fences) matching this exact structure:
{
  "weeks": [
    {
      "week_number": 1,
      "name": "Week 1",
      "workouts": [
        {
          "name": "Easy Run",
          "day_of_week": 1,
          "exercises": [
            {
              "name": "Running",
              "sets": 1,
              "reps": "30 min",
              "weight_suggestion": null,
              "rest_seconds": 0,
              "notes": "Zone 2 heart rate, conversational pace"
            }
          ]
        }
      ]
    }
  ]
}

Guidelines:
- day_of_week is 0=Sunday through 6=Saturday
- For cardio, use "reps" field for duration (e.g. "30 min", "5K", "8x400m")
- Include variety: steady state, intervals, tempo work, recovery sessions
- Use notes for pace/intensity guidance (heart rate zones, RPE, pace targets)
- Progress volume and intensity appropriately across weeks
- Include rest/recovery days
- Cardio exercises include: Running, Cycling, Swimming, Rowing, Elliptical, Jump Rope, HIIT Circuit, Walking`

    case "meal":
      return `You are an expert nutritionist creating a personalized meal plan. Generate a structured meal plan based on the user's requirements.

Respond with a JSON object (no markdown fences) matching this exact structure:
{
  "days": [
    {
      "day_number": 1,
      "meals": [
        {
          "meal_type": "breakfast",
          "foods": [
            {
              "name": "Greek Yogurt",
              "serving_size_g": 200,
              "calories": 130,
              "protein_g": 20,
              "carbs_g": 8,
              "fat_g": 0.5
            }
          ]
        }
      ]
    }
  ]
}

Guidelines:
- meal_type should be one of: "breakfast", "lunch", "dinner", "snack"
- Provide realistic, accurate macro estimates for each food
- Ensure daily totals align with the user's calorie and macro targets
- Include variety across days to prevent monotony
- Use common, accessible foods unless the user specifies otherwise
- serving_size_g should be realistic serving sizes
- Generate 3-7 days depending on the user's request
- Balance macros appropriately across meals`

    case "goals":
      return `You are an expert fitness coach helping set SMART goals. Generate personalized, achievable fitness goals based on the user's requirements and current situation.

Respond with a JSON object (no markdown fences) matching this exact structure:
{
  "goals": [
    {
      "title": "Lose 10 lbs",
      "category": "weight",
      "target_value": 185,
      "target_unit": "lbs",
      "target_date": "2026-06-19"
    }
  ]
}

Guidelines:
- category must be one of: "weight", "body_fat", "strength", "nutrition", "activity", "custom"
- target_date should be realistic (use ISO format YYYY-MM-DD)
- target_unit examples: "lbs", "%", "reps", "cal", "steps", "min"
- Generate 3-6 complementary goals that work together
- Make goals specific and measurable
- Set realistic timelines based on the user's experience level
- Include a mix of short-term (4-6 weeks) and longer-term (3-6 months) goals
- Today's date is ${new Date().toISOString().split("T")[0]}`

    default:
      return "You are a fitness expert. Generate structured fitness data as JSON."
  }
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
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: GenerateRequest = await request.json()
    const { type, fields, messages = [], action } = body

    if (!type || !action) {
      return NextResponse.json(
        { error: "Missing required fields: type, action" },
        { status: 400 }
      )
    }

    const fieldsContext = Object.entries(fields || {})
      .filter(([, v]) => v !== "" && v !== undefined && v !== null)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n")

    if (action === "chat") {
      const userMessage = `I want to create a ${type} plan.\n\nHere's what I've filled in so far:\n${fieldsContext || "- (nothing yet)"}\n\nPlease ask me a follow-up question to help create the best plan possible.`

      const chatMessages = [
        { role: "user" as const, content: userMessage },
        ...messages,
      ]

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: CHAT_MODEL,
          max_tokens: 512,
          system: getChatSystemPrompt(type),
          messages: chatMessages,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        console.error("Generate chat API error:", err)
        return NextResponse.json(
          { error: "AI chat request failed" },
          { status: 500 }
        )
      }

      const result = await response.json()
      const text = result.content?.[0]?.text || "{}"

      let parsed
      try {
        const cleaned = text.replace(/```json?\n?/g, "").replace(/```\n?/g, "")
        parsed = JSON.parse(cleaned)
      } catch {
        parsed = { message: text, ready: false }
      }

      return NextResponse.json({
        message: parsed.message || text,
        ready: parsed.ready || false,
      })
    }

    if (action === "generate") {
      const conversationContext =
        messages.length > 0
          ? `\n\nConversation with the user:\n${messages.map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`).join("\n")}`
          : ""

      const generateMessage = `Generate a ${type} plan with the following requirements:\n\n${fieldsContext || "(no specific fields)"}${conversationContext}`

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: GENERATE_MODEL,
          max_tokens: 8192,
          system: getGenerateSystemPrompt(type),
          messages: [
            {
              role: "user",
              content: generateMessage,
            },
          ],
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        console.error("Generate API error:", err)
        return NextResponse.json(
          { error: "AI generation failed" },
          { status: 500 }
        )
      }

      const result = await response.json()
      const text = result.content?.[0]?.text || "{}"

      let data
      try {
        const cleaned = text.replace(/```json?\n?/g, "").replace(/```\n?/g, "")
        data = JSON.parse(cleaned)
      } catch {
        return NextResponse.json(
          { error: "Failed to parse AI response as JSON" },
          { status: 500 }
        )
      }

      // Generate a human-readable summary
      let summary = ""
      switch (type) {
        case "workout":
        case "cardio": {
          const weeks = data.weeks || []
          const totalWorkouts = weeks.reduce(
            (sum: number, w: { workouts?: unknown[] }) =>
              sum + (w.workouts?.length || 0),
            0
          )
          summary = `Generated a ${weeks.length}-week ${type} plan with ${totalWorkouts} total workouts.`
          break
        }
        case "meal": {
          const days = data.days || []
          const totalMeals = days.reduce(
            (sum: number, d: { meals?: unknown[] }) =>
              sum + (d.meals?.length || 0),
            0
          )
          summary = `Generated a ${days.length}-day meal plan with ${totalMeals} total meals.`
          break
        }
        case "goals": {
          const goals = data.goals || []
          summary = `Generated ${goals.length} personalized fitness goals.`
          break
        }
      }

      return NextResponse.json({ type, data, summary })
    }

    return NextResponse.json(
      { error: "Invalid action. Must be 'chat' or 'generate'." },
      { status: 400 }
    )
  } catch (err) {
    console.error("Generate route error:", err)
    return NextResponse.json(
      { error: "Failed to process generation request" },
      { status: 500 }
    )
  }
}
