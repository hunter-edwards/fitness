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

const PATTERNS = {
  week: /(?:week|wk|phase)\s*(\d+)/i,
  day: /(?:day|d)\s*(\d+)/i,
  dayName: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i,
  workoutName: /^(?:workout\s*[a-z]?|(?:push|pull|legs?|upper|lower|chest|back|shoulders?|arms?|full\s*body|cardio|rest)\s*(?:day)?)/i,
  exercise: /^(.+?)[\s\-:]+(\d+)\s*[x×]\s*(\d+[\-\d]*)/m,
  exerciseAlt: /^(.+?)\s*[-–:]\s*(\d+)\s*(?:sets?)\s*(?:of|x|×)?\s*(\d+[\-\d]*)\s*(?:reps?)?/im,
  weight: /(?:@|at)\s*(\d+(?:\.\d+)?)\s*(?:lbs?|kg|pounds?)/i,
  rpe: /(?:rpe|RPE)\s*(\d+(?:\.\d+)?)/,
  rest: /(?:rest|pause)\s*[:=]?\s*(\d+)\s*(?:sec(?:onds?)?|s|min(?:utes?)?|m)/i,
  percentage: /(\d+)\s*%\s*(?:of\s*)?(?:1?\s*rm|max)/i,
  setsReps: /(\d+)\s*[x×]\s*(\d+[\-\d]*)/,
}

const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
}

export function structureWorkout(text: string): { weeks: ParsedWeek[] } {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean)
  const weeks: ParsedWeek[] = []
  let currentWeek: ParsedWeek | null = null
  let currentWorkout: ParsedWorkout | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check for week marker
    const weekMatch = line.match(PATTERNS.week)
    if (weekMatch) {
      if (currentWorkout && currentWorkout.exercises.length > 0) {
        if (!currentWeek) currentWeek = { week_number: 1, name: null, workouts: [] }
        currentWeek.workouts.push(currentWorkout)
      }
      if (currentWeek) weeks.push(currentWeek)

      currentWeek = {
        week_number: parseInt(weekMatch[1]),
        name: line.replace(weekMatch[0], "").trim() || null,
        workouts: [],
      }
      currentWorkout = null
      continue
    }

    // Check for day/workout marker
    const dayMatch = line.match(PATTERNS.day)
    const dayNameMatch = line.match(PATTERNS.dayName)
    const workoutNameMatch = line.match(PATTERNS.workoutName)

    if (dayMatch || dayNameMatch || workoutNameMatch) {
      // Don't treat this as a workout header if it also looks like an exercise
      const alsoExercise = PATTERNS.exercise.test(line) || PATTERNS.exerciseAlt.test(line)
      if (!alsoExercise) {
        if (currentWorkout && currentWorkout.exercises.length > 0) {
          if (!currentWeek) currentWeek = { week_number: 1, name: null, workouts: [] }
          currentWeek.workouts.push(currentWorkout)
        }

        let dayOfWeek: number | null = null
        if (dayNameMatch) {
          dayOfWeek = DAY_MAP[dayNameMatch[1].toLowerCase()] ?? null
        }

        currentWorkout = {
          name: line.replace(/[-–:]+$/, "").trim(),
          day_of_week: dayOfWeek,
          exercises: [],
        }
        continue
      }
    }

    // Try to parse exercise
    const exercise = parseExerciseLine(line)
    if (exercise) {
      if (!currentWorkout) {
        currentWorkout = { name: "Workout", day_of_week: null, exercises: [] }
      }
      if (!currentWeek) {
        currentWeek = { week_number: 1, name: null, workouts: [] }
      }
      currentWorkout.exercises.push(exercise)
    }
  }

  // Flush remaining
  if (currentWorkout && currentWorkout.exercises.length > 0) {
    if (!currentWeek) currentWeek = { week_number: 1, name: null, workouts: [] }
    currentWeek.workouts.push(currentWorkout)
  }
  if (currentWeek && currentWeek.workouts.length > 0) {
    weeks.push(currentWeek)
  }

  // If no weeks were detected but we have workouts, wrap in a single week
  if (weeks.length === 0 && currentWeek) {
    weeks.push(currentWeek)
  }

  return { weeks }
}

function parseExerciseLine(line: string): ParsedExercise | null {
  // Try primary pattern: "Bench Press 3x8"
  let match = line.match(PATTERNS.exercise)
  if (!match) {
    // Try alt: "Bench Press - 3 sets of 8 reps"
    match = line.match(PATTERNS.exerciseAlt)
  }

  if (!match) {
    // Try just sets x reps anywhere in line
    const srMatch = line.match(PATTERNS.setsReps)
    if (srMatch) {
      const name = line.substring(0, line.indexOf(srMatch[0])).replace(/[-–:]+$/, "").trim()
      if (name && name.length > 1 && name.length < 80) {
        match = [line, name, srMatch[1], srMatch[2]]
      }
    }
  }

  if (!match) return null

  const name = match[1].replace(/[-–:]+$/, "").trim()
  // Filter out obvious non-exercise lines
  if (name.length < 2 || name.length > 80) return null
  if (/^(note|rest|warm\s*up|cool\s*down|stretch)/i.test(name) && !PATTERNS.setsReps.test(line)) {
    return null
  }

  const sets = parseInt(match[2])
  const reps = match[3]

  // Check for weight suggestion
  let weightSuggestion: string | null = null
  const weightMatch = line.match(PATTERNS.weight)
  const pctMatch = line.match(PATTERNS.percentage)
  const rpeMatch = line.match(PATTERNS.rpe)
  if (weightMatch) weightSuggestion = weightMatch[0].trim()
  else if (pctMatch) weightSuggestion = pctMatch[0].trim()
  else if (rpeMatch) weightSuggestion = `RPE ${rpeMatch[1]}`

  // Check for rest
  let restSeconds: number | null = null
  const restMatch = line.match(PATTERNS.rest)
  if (restMatch) {
    const val = parseInt(restMatch[1])
    const unit = restMatch[0].toLowerCase()
    restSeconds = unit.includes("min") || unit.includes("m") ? val * 60 : val
  }

  // Remaining text as notes
  let notes: string | null = null
  const notePatterns = [/note[s]?[:]\s*(.+)/i, /\(([^)]+)\)/]
  for (const p of notePatterns) {
    const nm = line.match(p)
    if (nm) {
      notes = nm[1].trim()
      break
    }
  }

  return {
    name,
    sets: isNaN(sets) ? null : sets,
    reps: reps || null,
    weight_suggestion: weightSuggestion,
    rest_seconds: restSeconds,
    notes,
  }
}
