import Anthropic from "@anthropic-ai/sdk"

interface ParsedExercise {
  name: string
  sets: number | null
  reps: string | null
  weight_suggestion: string | null
  rest_seconds: number | null
  notes: string | null
}

interface ParsedWorkout {
  name: string
  day_of_week: number | null
  exercises: ParsedExercise[]
}

interface ParsedWeek {
  week_number: number
  name: string | null
  workouts: ParsedWorkout[]
}

const SYSTEM_PROMPT = `You are a fitness plan parser. Your job is to take raw text from a workout plan document and extract structured data from it.

Return ONLY valid JSON with this exact schema — no markdown fences, no explanation, just the JSON object:

{
  "weeks": [
    {
      "week_number": 1,
      "name": "Phase 1 - Foundation",
      "workouts": [
        {
          "name": "Push Day",
          "day_of_week": 1,
          "exercises": [
            {
              "name": "DB Bench Press",
              "sets": 4,
              "reps": "8-12",
              "weight_suggestion": "25 lb",
              "rest_seconds": 90,
              "notes": "2-sec negative, full ROM"
            }
          ]
        }
      ]
    }
  ]
}

Rules:
1. day_of_week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday. Use null if unknown.
2. If the plan covers multiple weeks with the SAME workout structure, still create separate week entries for each week. Include the phase name and week-specific notes (weight targets, progression cues) in the week name.
3. If a day is marked as "Rest" or has no lifting, skip it — do not create a workout for rest days.
4. For cardio/running that happens on the same day as lifting, add it as an exercise within that day's workout (e.g. name: "Easy Run", sets: 1, reps: "25 min", notes: "Walk 3 / Run 2 min x5").
5. If the plan has a separate running progression table, merge the correct week's running into the appropriate day's workout.
6. reps should be a string to handle ranges ("8-12"), rep schemes ("7+7+7"), time ("45-60s"), per-side ("10/leg"), or "Max".
7. rest_seconds should be an integer. Convert "90s" to 90, "2 min" to 120, etc. Use null if not specified.
8. weight_suggestion should include the unit (e.g. "25 lb", "35 lb KB", "30 lb target"). Pull from the plan's weight targets for the appropriate phase/week if available.
9. Include ALL exercises from the plan — compound lifts, isolation work, core/ab exercises, mobility work, etc.
10. If the plan has detailed exercise templates (like a "Workout Details" section), use those for the exercise lists. If the weekly schedule just says "Push Day" with no exercises listed, fill in exercises from the matching template.
11. Capture progressive overload notes. For weeks where the plan says to increase weight or test heavier weights, reflect that in the weight_suggestion field.
12. For exercises with time-based work (planks, stretching), use reps for the time (e.g. "45-60s") and sets for the number of sets.
13. Output EVERY week individually, even if they share the same structure. The plan might say "Weeks 1-2" — expand that into Week 1 and Week 2 separately.`

export async function parseWithAI(text: string): Promise<{ weeks: ParsedWeek[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. AI parsing requires an Anthropic API key.")
  }

  const anthropic = new Anthropic({ apiKey })

  // Truncate very long documents to stay within token limits
  const maxChars = 60000
  const truncatedText = text.length > maxChars
    ? text.slice(0, maxChars) + "\n\n[Document truncated]"
    : text

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: `Parse this workout plan into structured JSON:\n\n${truncatedText}`,
      },
    ],
    system: SYSTEM_PROMPT,
  })

  // Extract text response
  const responseText = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")

  // Parse JSON — handle cases where the model wraps in markdown fences
  let jsonStr = responseText.trim()
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
  }

  let parsed: { weeks: ParsedWeek[] }
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    console.error("AI parser returned invalid JSON:", jsonStr.slice(0, 500))
    throw new Error("AI parser returned invalid JSON. Try again or use a different file format.")
  }

  // Validate basic structure
  if (!parsed.weeks || !Array.isArray(parsed.weeks)) {
    throw new Error("AI parser did not return a valid plan structure.")
  }

  // Clean up and validate each week
  parsed.weeks = parsed.weeks
    .filter((w) => w.workouts && w.workouts.length > 0)
    .map((week, i) => ({
      week_number: week.week_number || i + 1,
      name: week.name || null,
      workouts: week.workouts
        .filter((wo) => wo.exercises && wo.exercises.length > 0)
        .map((wo) => ({
          name: wo.name || "Workout",
          day_of_week: typeof wo.day_of_week === "number" ? wo.day_of_week : null,
          exercises: wo.exercises.map((ex) => ({
            name: ex.name || "Unknown Exercise",
            sets: typeof ex.sets === "number" ? ex.sets : null,
            reps: ex.reps ? String(ex.reps) : null,
            weight_suggestion: ex.weight_suggestion || null,
            rest_seconds: typeof ex.rest_seconds === "number" ? ex.rest_seconds : null,
            notes: ex.notes || null,
          })),
        })),
    }))

  return parsed
}
