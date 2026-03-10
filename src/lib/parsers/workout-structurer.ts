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

const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
}

const DAY_ABBREVS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

// ── Table-aware parsing ──────────────────────────────────────────────

/**
 * Strip blank lines to get just the cell values.
 * Mammoth extracts each table cell as a line separated by blanks.
 */
function getNonBlankLines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean)
}

/**
 * Parse a table section from non-blank lines starting at `start`.
 * `columns` is the number of expected columns.
 * Reads rows until we hit a line that looks like a new section header.
 * Returns the rows as string[][] and the index after the last row.
 */
function parseTableRows(
  lines: string[],
  start: number,
  columns: number
): { rows: string[][]; nextIndex: number } {
  const rows: string[][] = []
  let i = start

  while (i + columns - 1 < lines.length) {
    // Check if this line is a section header (not a table data row)
    const line = lines[i]
    if (isSectionHeader(line)) break

    // Read `columns` consecutive lines as one row
    const row: string[] = []
    for (let c = 0; c < columns; c++) {
      row.push(lines[i + c])
    }
    rows.push(row)
    i += columns
  }

  return { rows, nextIndex: i }
}

function isSectionHeader(line: string): boolean {
  return (
    /^WEEKS?\s*\d/i.test(line) ||
    /^DAY\s*\d/i.test(line) ||
    /^Phase\s*\d/i.test(line) ||
    /^Running\s+Progression/i.test(line) ||
    /^Progressive\s+Overload/i.test(line) ||
    /^Workout\s+Details/i.test(line) ||
    /^12-Week\s+Running/i.test(line) ||
    /^Goal:/i.test(line) ||
    /^Weight\s+targets:/i.test(line) ||
    /^The\s+rule:/i.test(line) ||
    /^Buy\s+this\s+week:/i.test(line) ||
    /^These\s+are\s+your\s+base/i.test(line) ||
    /^3x\s+per\s+week/i.test(line)
  )
}

function parseRestToSeconds(rest: string): number | null {
  if (!rest || rest === "-") return null
  const minMatch = rest.match(/(\d+)\s*min/)
  if (minMatch) return parseInt(minMatch[1]) * 60
  const secMatch = rest.match(/(\d+)\s*s/)
  if (secMatch) return parseInt(secMatch[1])
  // Try bare number (assume seconds)
  const num = parseInt(rest)
  return isNaN(num) ? null : num
}

// ── Exercise template parsing ──────────────────────────────────────

interface ExerciseTemplate {
  dayNumber: number
  name: string
  dayOfWeek: number | null
  exercises: ParsedExercise[]
}

function parseExerciseTemplates(lines: string[]): ExerciseTemplate[] {
  const templates: ExerciseTemplate[] = []
  let i = 0

  while (i < lines.length) {
    // Look for "DAY X: NAME  DayOfWeek  |  ~XXmin"
    const dayMatch = lines[i].match(
      /^DAY\s*(\d+)\s*:\s*(.+?)(?:\s{2,}|\s*\|\s*)/i
    )
    if (!dayMatch) {
      i++
      continue
    }

    const dayNumber = parseInt(dayMatch[1])
    const rawName = dayMatch[2].trim()

    // Extract day of week from the line
    let dayOfWeek: number | null = null
    for (const [name, num] of Object.entries(DAY_MAP)) {
      if (lines[i].toLowerCase().includes(name)) {
        dayOfWeek = num
        break
      }
    }

    i++

    // Skip the table header row (Exercise / Sets / Reps / Rest / Notes)
    if (i < lines.length && /^Exercise$/i.test(lines[i])) {
      // Skip 5 header cells: Exercise, Sets, Reps, Rest, Notes
      i += 5
    }

    // Parse exercise rows (5 columns each)
    const exercises: ParsedExercise[] = []
    while (i + 4 < lines.length) {
      const name = lines[i]
      // Stop if we hit a section header or another DAY header
      if (isSectionHeader(name) || /^DAY\s*\d/i.test(name)) break

      const setsStr = lines[i + 1]
      const repsStr = lines[i + 2]
      const restStr = lines[i + 3]
      const notesStr = lines[i + 4]

      const sets = setsStr === "-" ? null : parseInt(setsStr)

      exercises.push({
        name,
        sets: isNaN(sets as number) ? null : sets,
        reps: repsStr === "-" ? null : repsStr,
        weight_suggestion: null,
        rest_seconds: parseRestToSeconds(restStr),
        notes: notesStr === "-" ? null : notesStr,
      })

      i += 5
    }

    templates.push({ dayNumber, name: rawName, dayOfWeek, exercises })
  }

  return templates
}

// ── Weekly schedule parsing ──────────────────────────────────────

interface WeekScheduleBlock {
  weekStart: number
  weekEnd: number
  phaseName: string
  blockName: string
  days: {
    dayAbbrev: string
    dayOfWeek: number
    lifting: string
    cardio: string
    notes: string
  }[]
}

function parseWeeklySchedules(lines: string[]): WeekScheduleBlock[] {
  const blocks: WeekScheduleBlock[] = []
  let i = 0
  let currentPhase = ""

  while (i < lines.length) {
    // Track phase names
    const phaseMatch = lines[i].match(/^Phase\s*(\d+)\s*:\s*(.+)/i)
    if (phaseMatch) {
      currentPhase = `Phase ${phaseMatch[1]}: ${phaseMatch[2].trim()}`
      i++
      continue
    }

    // Look for "WEEKS X–Y    Name"
    const weeksMatch = lines[i].match(
      /^WEEKS?\s*(\d+)\s*[–\-]\s*(\d+)\s+(.+)/i
    )
    if (!weeksMatch) {
      i++
      continue
    }

    const weekStart = parseInt(weeksMatch[1])
    const weekEnd = parseInt(weeksMatch[2])
    const blockName = weeksMatch[3].trim()

    i++

    // Skip the table header (Day / Lifting / Cardio / Focus & Notes = 4 columns)
    if (i < lines.length && /^Day$/i.test(lines[i])) {
      i += 4 // skip Day, Lifting, Cardio, Focus / Notes
    }

    // Parse 7 day rows (4 columns each)
    const days: WeekScheduleBlock["days"] = []
    for (let d = 0; d < 7 && i + 3 < lines.length; d++) {
      const dayAbbrev = lines[i].toLowerCase()
      // Verify this is actually a day abbreviation
      const dayNum = DAY_MAP[dayAbbrev]
      if (dayNum === undefined) break

      days.push({
        dayAbbrev: lines[i],
        dayOfWeek: dayNum,
        lifting: lines[i + 1],
        cardio: lines[i + 2],
        notes: lines[i + 3],
      })
      i += 4
    }

    blocks.push({ weekStart, weekEnd, phaseName: currentPhase, blockName, days })
  }

  return blocks
}

// ── Running progression parsing ────────────────────────────────

interface RunningWeek {
  week: number
  run1: string
  run2: string
  run3: string
}

function parseRunningProgression(lines: string[]): RunningWeek[] {
  const runs: RunningWeek[] = []
  let i = 0

  // Find the running table header "Week" that appears after a "Running Progression" section
  let foundSection = false
  while (i < lines.length) {
    if (/Running\s+Progression/i.test(lines[i])) {
      foundSection = true
    }
    // Look for the actual table header "Week" after finding the section
    if (foundSection && /^Week$/i.test(lines[i])) {
      i += 4 // skip Week, Run 1 — Easy, Run 2 — Easy, Run 3 — Intervals
      break
    }
    i++
  }

  // Parse 12 rows (4 columns each)
  while (i + 3 < lines.length) {
    const weekNum = parseInt(lines[i])
    if (isNaN(weekNum)) break

    runs.push({
      week: weekNum,
      run1: lines[i + 1],
      run2: lines[i + 2],
      run3: lines[i + 3],
    })
    i += 4
  }

  return runs
}

// ── Progressive overload parsing ────────────────────────────────

interface OverloadTarget {
  exercise: string
  current: string
  wk1_4: string
  wk5_8: string
  moveUpWhen: string
}

function parseOverloadTargets(lines: string[]): OverloadTarget[] {
  const targets: OverloadTarget[] = []
  let i = 0

  // Find "Progressive Overload Targets"
  while (i < lines.length) {
    if (/^Progressive\s+Overload\s+Targets/i.test(lines[i])) {
      i++
      break
    }
    i++
  }

  // Skip header (Exercise / Current / Wk 1-4 / Wk 5-8 / Move Up When... = 5 columns)
  if (i < lines.length && /^Exercise$/i.test(lines[i])) {
    i += 5
  }

  // Parse rows (5 columns each)
  while (i + 4 < lines.length) {
    const name = lines[i]
    if (isSectionHeader(name)) break

    targets.push({
      exercise: name,
      current: lines[i + 1],
      wk1_4: lines[i + 2],
      wk5_8: lines[i + 3],
      moveUpWhen: lines[i + 4],
    })
    i += 5
  }

  return targets
}

// ── Weight suggestion lookup ────────────────────────────────────

function getWeightForExercise(
  exerciseName: string,
  weekNum: number,
  overloadTargets: OverloadTarget[]
): string | null {
  const lower = exerciseName.toLowerCase()
  for (const target of overloadTargets) {
    const targetLower = target.exercise.toLowerCase()
    // Fuzzy match: check if exercise name contains the target name or vice versa
    if (lower.includes(targetLower) || targetLower.includes(lower) ||
        (lower.includes("bench") && targetLower.includes("bench")) ||
        (lower.includes("press") && targetLower.includes("press") && !lower.includes("close")) ||
        (lower.includes("curl") && targetLower.includes("curl")) ||
        (lower.includes("row") && targetLower.includes("row")) ||
        (lower.includes("lateral") && targetLower.includes("lateral")) ||
        (lower.includes("skull") && targetLower.includes("skull")) ||
        (lower.includes("goblet") && targetLower.includes("goblet")) ||
        (lower.includes("swing") && targetLower.includes("swing"))) {
      if (weekNum <= 4) return target.wk1_4
      if (weekNum <= 8) return target.wk5_8
      // Weeks 9-12: use wk5_8 as base (the plan describes going heavier)
      return target.wk5_8 + "+"
    }
  }
  return null
}

// ── Match workout name to template ──────────────────────────────

function findTemplate(
  liftingName: string,
  templates: ExerciseTemplate[]
): ExerciseTemplate | null {
  const lower = liftingName.toLowerCase()
  for (const t of templates) {
    const tLower = t.name.toLowerCase()
    // Direct match
    if (lower === tLower) return t
    // Partial match
    if (lower.includes("push") && tLower.includes("push")) return t
    if (lower.includes("pull") && tLower.includes("pull")) return t
    if (lower.includes("arms") && tLower.includes("arms")) return t
    if (lower.includes("power") && tLower.includes("power")) return t
    if (lower.includes("legs") && tLower.includes("legs")) return t
    if (lower.includes("light legs") && tLower.includes("light legs")) return t
  }
  return null
}

// ── Main entry point ────────────────────────────────────────────

export function structureWorkout(text: string): { weeks: ParsedWeek[] } {
  const lines = getNonBlankLines(text)

  // Try table-aware parsing first
  const tableResult = tryTableParsing(lines)
  if (tableResult && tableResult.weeks.length > 0) {
    return tableResult
  }

  // Fall back to legacy line-by-line parsing
  return legacyParse(lines)
}

function tryTableParsing(lines: string[]): { weeks: ParsedWeek[] } | null {
  // Parse all the sections
  const templates = parseExerciseTemplates(lines)
  const scheduleBlocks = parseWeeklySchedules(lines)
  const runningWeeks = parseRunningProgression(lines)
  const overloadTargets = parseOverloadTargets(lines)

  // Need at least schedule blocks OR templates to do table parsing
  if (scheduleBlocks.length === 0 && templates.length === 0) return null

  const weeks: ParsedWeek[] = []

  // If we have schedule blocks, expand each 2-week block into individual weeks
  if (scheduleBlocks.length > 0) {
    for (const block of scheduleBlocks) {
      for (let wn = block.weekStart; wn <= block.weekEnd; wn++) {
        const weekName = block.phaseName
          ? `${block.phaseName} — ${block.blockName}`
          : block.blockName

        const workouts: ParsedWorkout[] = []
        const running = runningWeeks.find((r) => r.week === wn)

        for (const day of block.days) {
          // Skip rest days and days with no lifting
          if (
            day.lifting === "-" ||
            day.lifting.toLowerCase() === "rest" ||
            !day.lifting
          ) {
            continue
          }

          // Find the exercise template for this workout
          const template = findTemplate(day.lifting, templates)
          let exercises: ParsedExercise[] = []

          if (template) {
            // Clone exercises from template with weight suggestions
            exercises = template.exercises.map((ex) => ({
              ...ex,
              weight_suggestion:
                getWeightForExercise(ex.name, wn, overloadTargets) ||
                ex.weight_suggestion,
              notes: day.notes && day.notes !== "-"
                ? [ex.notes, day.notes].filter(Boolean).join(" | ")
                : ex.notes,
            }))
          }

          // Add running if applicable for this day
          if (day.cardio && day.cardio !== "-" && running) {
            let runDesc: string | null = null
            if (day.cardio.includes("Run 1")) runDesc = running.run1
            else if (day.cardio.includes("Run 2")) runDesc = running.run2
            else if (day.cardio.includes("Run 3")) runDesc = running.run3

            if (runDesc) {
              exercises.push({
                name: day.cardio,
                sets: 1,
                reps: runDesc,
                weight_suggestion: null,
                rest_seconds: null,
                notes: day.notes && day.notes !== "-"
                  ? day.notes
                  : null,
              })
            }
          } else if (day.cardio && day.cardio !== "-" && !running) {
            // Add cardio even without running table details
            exercises.push({
              name: day.cardio,
              sets: 1,
              reps: null,
              weight_suggestion: null,
              rest_seconds: null,
              notes: day.notes && day.notes !== "-" ? day.notes : null,
            })
          }

          if (exercises.length > 0) {
            workouts.push({
              name: day.lifting,
              day_of_week: day.dayOfWeek,
              exercises,
            })
          }
        }

        if (workouts.length > 0) {
          weeks.push({
            week_number: wn,
            name: weekName,
            workouts,
          })
        }
      }
    }
  } else if (templates.length > 0) {
    // No schedule blocks — just use templates as a single week
    const workouts = templates.map((t) => ({
      name: t.name,
      day_of_week: t.dayOfWeek,
      exercises: t.exercises,
    }))
    weeks.push({ week_number: 1, name: null, workouts })
  }

  return { weeks }
}

// ── Legacy regex parser (fallback) ────────────────────────────

const LEGACY_PATTERNS = {
  week: /(?:week|wk|phase)\s*(\d+)/i,
  day: /(?:day|d)\s*(\d+)/i,
  dayName:
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i,
  workoutName:
    /^(?:workout\s*[a-z]?|(?:push|pull|legs?|upper|lower|chest|back|shoulders?|arms?|full\s*body|cardio|rest)\s*(?:day)?)/i,
  exercise: /^(.+?)[\s\-:]+(\d+)\s*[x×]\s*(\d+[\-\d]*)/m,
  exerciseAlt:
    /^(.+?)\s*[-–:]\s*(\d+)\s*(?:sets?)\s*(?:of|x|×)?\s*(\d+[\-\d]*)\s*(?:reps?)?/im,
  weight: /(?:@|at)\s*(\d+(?:\.\d+)?)\s*(?:lbs?|kg|pounds?)/i,
  rpe: /(?:rpe|RPE)\s*(\d+(?:\.\d+)?)/,
  rest: /(?:rest|pause)\s*[:=]?\s*(\d+)\s*(?:sec(?:onds?)?|s|min(?:utes?)?|m)/i,
  percentage: /(\d+)\s*%\s*(?:of\s*)?(?:1?\s*rm|max)/i,
  setsReps: /(\d+)\s*[x×]\s*(\d+[\-\d]*)/,
}

function legacyParse(lines: string[]): { weeks: ParsedWeek[] } {
  const weeks: ParsedWeek[] = []
  let currentWeek: ParsedWeek | null = null
  let currentWorkout: ParsedWorkout | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const weekMatch = line.match(LEGACY_PATTERNS.week)
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

    const dayMatch = line.match(LEGACY_PATTERNS.day)
    const dayNameMatch = line.match(LEGACY_PATTERNS.dayName)
    const workoutNameMatch = line.match(LEGACY_PATTERNS.workoutName)

    if (dayMatch || dayNameMatch || workoutNameMatch) {
      const alsoExercise =
        LEGACY_PATTERNS.exercise.test(line) || LEGACY_PATTERNS.exerciseAlt.test(line)
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

    const exercise = parseLegacyExerciseLine(line)
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

  if (currentWorkout && currentWorkout.exercises.length > 0) {
    if (!currentWeek) currentWeek = { week_number: 1, name: null, workouts: [] }
    currentWeek.workouts.push(currentWorkout)
  }
  if (currentWeek && currentWeek.workouts.length > 0) {
    weeks.push(currentWeek)
  }

  return { weeks }
}

function parseLegacyExerciseLine(line: string): ParsedExercise | null {
  let match = line.match(LEGACY_PATTERNS.exercise)
  if (!match) {
    match = line.match(LEGACY_PATTERNS.exerciseAlt)
  }

  if (!match) {
    const srMatch = line.match(LEGACY_PATTERNS.setsReps)
    if (srMatch) {
      const name = line.substring(0, line.indexOf(srMatch[0])).replace(/[-–:]+$/, "").trim()
      if (name && name.length > 1 && name.length < 80) {
        match = [line, name, srMatch[1], srMatch[2]]
      }
    }
  }

  if (!match) return null

  const name = match[1].replace(/[-–:]+$/, "").trim()
  if (name.length < 2 || name.length > 80) return null
  if (/^(note|rest|warm\s*up|cool\s*down|stretch)/i.test(name) && !LEGACY_PATTERNS.setsReps.test(line)) {
    return null
  }

  const sets = parseInt(match[2])
  const reps = match[3]

  let weightSuggestion: string | null = null
  const weightMatch = line.match(LEGACY_PATTERNS.weight)
  const pctMatch = line.match(LEGACY_PATTERNS.percentage)
  const rpeMatch = line.match(LEGACY_PATTERNS.rpe)
  if (weightMatch) weightSuggestion = weightMatch[0].trim()
  else if (pctMatch) weightSuggestion = pctMatch[0].trim()
  else if (rpeMatch) weightSuggestion = `RPE ${rpeMatch[1]}`

  let restSeconds: number | null = null
  const restMatch = line.match(LEGACY_PATTERNS.rest)
  if (restMatch) {
    const val = parseInt(restMatch[1])
    const unit = restMatch[0].toLowerCase()
    restSeconds = unit.includes("min") || unit.includes("m") ? val * 60 : val
  }

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
