# Fitness App - Claude Context

## Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Library**: shadcn/ui (built on @base-ui/react, NOT @radix-ui)
- **Database**: Supabase (PostgreSQL with RLS)
- **Auth**: Supabase Auth
- **React**: React 19
- **Icons**: lucide-react
- **Toasts**: sonner
- **Date handling**: date-fns

## Repository
- **Repo**: `hunter-edwards/fitness` on GitHub
- **Main branch**: `main`
- **Dev workflow**: Uses Claude git worktrees (`.claude/worktrees/`)

## Key Conventions

### Units
- **Storage**: All weights stored in **kg** in database (`weight_kg`)
- **Display**: All weights displayed in **lbs** (imperial default)
- **Conversion**: `kg * 2.20462 = lbs`, `lbs / 2.20462 = kg`
- Height stored in cm, displayed in inches

### shadcn/ui (Base UI)
- Uses `@base-ui/react`, NOT `@radix-ui`
- Components use `render` prop for composition, NOT `asChild`
  ```tsx
  // CORRECT:
  <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>
  // WRONG:
  <AlertDialogTrigger asChild><Button>
  ```
- Button has custom sizes: `"icon-sm"` for small icon buttons

### Supabase Client
- Client-side: `import { createClient } from "@/lib/supabase/client"`
- Server-side: `import { createClient } from "@/lib/supabase/server"`
- Auth hook: `import { useAuth } from "@/hooks/use-auth"` → `const { user } = useAuth()`
- RLS policies require authenticated user — anon key can't query user data

### Build
- Run `npx next build` (may need `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ | tail -1)/bin:$PATH"` first)
- Always verify build passes before committing

## Architecture

### Workout System (Session Model)
Workouts follow a **template + session** pattern:
- **Scheduled workouts** (status: `"scheduled"`) are templates — they persist and can be started repeatedly
- **Starting a workout** creates a NEW session record (status: `"in_progress"`) in the DB, separate from the template
- **Finishing** marks the session as `"completed"` — the template stays `"scheduled"`
- **Deleting** a completed session only removes that session log — the template remains
- **Skipping** marks the template as `"skipped"` (removes from schedule)
- **Active workout state** stored in `localStorage` key `"activeWorkout"` with `startedAt` timestamp for persistent timer
- The `sessionId` field in localStorage tracks the DB record for the active session

### Workout Statuses
- `scheduled` — Template/planned workout from a plan
- `in_progress` — Active session being performed
- `completed` — Finished session with logged sets
- `skipped` — User chose to skip this scheduled workout

### TodaysWorkout Component
Reusable component (`src/components/workouts/todays-workout.tsx`) used on:
- Dashboard (compact mode)
- Workouts page (full mode)
- Calendar page (for selected date)

Shows all workout statuses with appropriate actions:
- Scheduled → Start / Skip
- In Progress → Resume
- Completed → View Details

### Dashboard Features
- Workout & logging streaks
- Quick actions (contextual suggestions)
- Today's workout preview (TodaysWorkout compact)
- Stat cards (weight, calories, protein, workouts, steps, goals)
- Weekly summary

### Goals System
- Auto-syncing progress for weight, activity, and nutrition goals
- Categories: weight, body_fat, strength, nutrition, activity, custom
- Edit page at `/goals/[id]`

## File Structure

### Pages (src/app/)
```
(auth)/login, signup
(app)/dashboard, calendar, settings, activity, insights
(app)/workouts/, workouts/[id], workouts/active, workouts/new
(app)/workouts/exercises/, exercises/[id], exercises/new
(app)/plans/, plans/[id], plans/upload
(app)/nutrition/, nutrition/foods, foods/new, search, targets
(app)/weight/
(app)/goals/, goals/[id], goals/new
api/analyze-food, food-search, insights/ai, parse-plan
```

### Components (src/components/)
```
layout/     → bottom-nav, header, sidebar
nutrition/  → macro-ring, meal-card
weight/     → weight-chart, weight-form, weight-history
workouts/   → exercise-picker, set-logger, todays-workout, workout-card
ui/         → shadcn components (alert-dialog, button, card, input, etc.)
```

### Database Tables
```
profiles, weight_entries, foods, meals, meal_items,
exercises, workouts, workout_sets,
workout_plans, plan_weeks, plan_workouts, plan_exercises,
activity_entries, goals, nutrition_targets
Views: daily_nutrition_summary, daily_workout_summary
```

## Recent Changes (Session History)

### Session 1: Bug fixes & missing features
- Fixed broken workout detail page (`/workouts/[id]`)
- Fixed broken exercise detail page (`/workouts/exercises/[id]`)
- Fixed height field bug in settings (was storing inches as cm)
- Added edit functionality for weight entries (inline editing)
- Added edit page for goals (`/goals/[id]`)

### Session 2: Dashboard overhaul & goal sync
- Dashboard streaks (workout streak + logging streak)
- Quick actions (contextual "what to do next" suggestions)
- Weekly summary card
- Auto-updating goal progress from real data (weight, activity, nutrition)

### Session 3: Today's workout component
- Created reusable `TodaysWorkout` component
- Integrated into dashboard, workouts page, and calendar page
- Shows exercise preview, set/rep details, Start/Skip buttons

### Session 4: Workout persistence & session model
- Active workout timer now persists across page navigation (startedAt in localStorage)
- Introduced template + session model:
  - Starting a workout creates a NEW session record (doesn't mutate the template)
  - Scheduled workouts persist as reusable templates
  - Deleting a session doesn't remove the underlying scheduled workout
- TodaysWorkout shows all statuses (scheduled, in_progress, completed)
- Resume button for in-progress workouts
- "Start Again" when completed session exists
- Added edit mode to workout detail page (inline reps/weight/RPE editing)
- Added delete functionality to workout detail page with confirmation dialog
