# AI-Native Features: Generation Hub, Composite Foods, Apple Health Sync

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the fitness app AI-native with conversational plan generation (workout, cardio, nutrition, goals), composite food/recipe support with ingredient breakdown, and Apple Health data sync via Shortcuts.

**Architecture:** Three independent feature tracks that can be built in parallel. All AI features use the existing Anthropic API pattern (Claude Haiku for fast responses, Sonnet for complex generation). Apple Health sync uses a new API endpoint with token-based auth.

**Tech Stack:** Next.js 16 API routes, Anthropic Claude API (Haiku + Sonnet), Supabase (new tables for recipes + health sync tokens), Apple Shortcuts for HealthKit bridge.

---

## Feature 1: AI Generation Hub

### Overview

A unified `/generate` page where users select what they want to create (workout plan, cardio plan, nutrition plan, goals), fill in 3-5 key form fields, then enter a mini chat where the AI asks 1-2 follow-up questions before generating structured output. The generated output previews inline and can be saved to the relevant system with one click.

### User Flow

```
/generate → Pick type → Fill key fields → AI asks follow-ups → Generate → Preview → Save
```

1. User navigates to `/generate` (accessible from bottom nav or dashboard quick action)
2. Picks a generation type: Workout Plan | Cardio Plan | Meal Plan | Goals
3. Fills 3-5 fields depending on type (see below)
4. Clicks "Generate" → AI asks 1-2 clarifying questions in a chat UI
5. User answers → AI generates the full plan
6. Output renders as a structured preview (not raw text)
7. User clicks "Save" → data is written to the appropriate DB tables

### Generation Types & Form Fields

#### Workout Plan Generator
**Form fields:**
- Goal: Muscle building / Strength / Athletic performance / General fitness
- Days per week: 2-6 (number picker)
- Experience level: Beginner / Intermediate / Advanced
- Available equipment: Gym / Home (dumbbells) / Bodyweight only
- Duration: 4 / 8 / 12 weeks

**AI follow-ups (1-2 of):**
- Any injuries or areas to avoid?
- Preference for specific training style? (PPL, Upper/Lower, Full body, Bro split)
- How long can each session be?

**Output:** `ParsedWeek[]` structure matching the existing plan parser output — weeks with workouts, exercises, sets, reps, weight suggestions. Saves to `workout_plans` + `plan_weeks` + `plan_workouts` + `plan_exercises` with `source: "generated"`.

**Save action:** Creates workout plan → user can schedule from `/plans/[id]` like uploaded plans.

#### Cardio Plan Generator
**Form fields:**
- Goal: Fat loss / Endurance / Race prep / General health
- Days per week: 2-6
- Current fitness level: Sedentary / Lightly active / Active / Very active
- Preferred cardio: Running / Cycling / Swimming / Mixed

**AI follow-ups:**
- Any upcoming race/event with a target date?
- Current weekly mileage or cardio volume?

**Output:** Weekly cardio schedule with session types (steady state, intervals, tempo, long run), duration, intensity zones, and progression across weeks. Saves as a workout plan with cardio exercises.

#### Meal Plan Generator
**Form fields:**
- Goal: Weight loss / Maintenance / Muscle gain
- Daily calorie target (auto-populated from nutrition_targets if set)
- Dietary restrictions: None / Vegetarian / Vegan / Keto / Gluten-free
- Meals per day: 3 / 4 / 5

**AI follow-ups:**
- Any food allergies?
- Cooking skill level / meal prep preference?

**Output:** 7-day meal plan with meals, foods, and macros per item. Each meal shows total calories/macros. Saves as foods (creating any new ones) + optionally sets nutrition targets.

**Save action:** Creates foods in user's library + optionally creates a week of meal entries.

#### Goal Generator
**Form fields:**
- Area: Weight / Strength / Activity / Nutrition / Body composition
- Current status: brief text input ("I weigh 195 lbs", "I can bench 185", etc.)
- Timeframe: 1 month / 3 months / 6 months / 1 year

**AI follow-ups:**
- What's your primary motivation?
- Any specific target numbers in mind?

**Output:** 2-4 SMART goals with specific targets, units, and target dates. Preview shows each goal with progress bar placeholder.

**Save action:** Creates `goals` records with category, target_value, target_unit, target_date.

### API Design

**POST `/api/generate`**
```typescript
{
  type: "workout" | "cardio" | "meal" | "goals",
  fields: Record<string, string | number>,  // form field values
  messages?: { role: "user" | "assistant", content: string }[],  // chat history
  action: "chat" | "generate"  // chat = get follow-up questions, generate = produce output
}
```

**Response (action: "chat"):**
```typescript
{
  message: string,  // AI's follow-up question
  ready: boolean    // true if AI has enough info to generate
}
```

**Response (action: "generate"):**
```typescript
{
  type: "workout" | "cardio" | "meal" | "goals",
  data: WorkoutPlanData | MealPlanData | GoalData,  // structured output
  summary: string  // human-readable summary
}
```

### Save Endpoints

Each generation type has its own save logic. For workout/cardio plans, reuse the existing plan save logic from `/plans/upload`. For meals, create foods + meal entries. For goals, create goal records.

**POST `/api/generate/save`**
```typescript
{
  type: "workout" | "cardio" | "meal" | "goals",
  data: object  // the generated data from /api/generate
}
```

### UI Components

- `src/app/(app)/generate/page.tsx` — Main generation page
- `src/components/generate/type-selector.tsx` — Card grid to pick generation type
- `src/components/generate/generation-form.tsx` — Dynamic form based on type
- `src/components/generate/chat-interface.tsx` — Mini chat for AI follow-ups
- `src/components/generate/preview-workout.tsx` — Workout plan preview
- `src/components/generate/preview-meals.tsx` — Meal plan preview
- `src/components/generate/preview-goals.tsx` — Goals preview

### Navigation

Add "Generate" to quick actions on dashboard when contextually relevant. Add to the "More" section in bottom nav or as a prominent button on the plans page.

---

## Feature 2: Composite Foods (Recipes)

### Overview

Extend the foods system to support recipes — foods composed of multiple ingredients. When AI analyzes a meal (text or photo), users can "Save as Recipe" to create a parent food with linked ingredients. Each ingredient has its own macros, and the parent's macros are the sum. Ingredients can be edited, added, or removed, and the parent auto-recalculates.

### Database Changes

**New table: `food_ingredients`**
```sql
CREATE TABLE food_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_food_id UUID REFERENCES foods(id) ON DELETE CASCADE,
  ingredient_food_id UUID REFERENCES foods(id) ON DELETE SET NULL,
  custom_name TEXT,  -- fallback if ingredient_food_id is null
  servings NUMERIC DEFAULT 1,
  calories NUMERIC,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Modify `foods` table:**
- Add column: `is_recipe BOOLEAN DEFAULT false`

### How It Works

1. **Creating a recipe from AI analysis:**
   - User analyzes food via text/photo on `/nutrition/search` (AI tab)
   - AI returns items: `[{ name: "Grilled Chicken", calories: 284, ... }, { name: "Rice", calories: 200, ... }]`
   - New button: "Save as Recipe" (alongside existing "Add All to Meal")
   - Dialog: name the recipe (e.g., "Chicken Rice Bowl"), edit individual ingredients
   - Creates parent food (`is_recipe: true`) with summed macros
   - Creates `food_ingredients` rows for each item
   - Each ingredient: if a matching food exists in user's library, link it; otherwise create a new food and link it

2. **Creating a recipe manually:**
   - New "Create Recipe" button on `/nutrition/foods`
   - Form: recipe name + search/add ingredients from food library
   - Each ingredient has adjustable servings
   - Total macros calculated live as ingredients are added/edited

3. **Editing a recipe:**
   - On food detail or edit page, if `is_recipe`, show ingredient list
   - Add/remove/edit ingredient servings
   - Parent food macros recalculate on save

4. **Using a recipe:**
   - Recipes appear in "My Foods" like any other food
   - When logging a meal, select recipe → adjusts by servings like a normal food
   - Macro ring shows recipe's total macros × servings logged

### UI Changes

- `src/app/(app)/nutrition/search/page.tsx` — Add "Save as Recipe" button to AI results
- `src/app/(app)/nutrition/foods/page.tsx` — Add "Create Recipe" button, show recipe badge
- `src/components/nutrition/recipe-editor.tsx` — New component for editing recipe ingredients
- `src/components/nutrition/recipe-preview.tsx` — Shows ingredient breakdown when viewing a recipe

### RLS Policy

```sql
-- food_ingredients inherits access from parent food
CREATE POLICY "Users can manage ingredients of their foods"
  ON food_ingredients FOR ALL
  USING (parent_food_id IN (SELECT id FROM foods WHERE user_id = auth.uid()));
```

---

## Feature 3: Apple Health Sync via Shortcuts

### Overview

Since this is a web app (not native iOS), we bridge Apple Health using Apple Shortcuts. The app provides a sync API endpoint authenticated with a per-user token. Users install a pre-configured Shortcut that reads HealthKit data and POSTs it to the API. The Shortcut can run manually or on an automation schedule.

### Database Changes

**New table: `health_sync_tokens`**
```sql
CREATE TABLE health_sync_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,  -- random 32-char hex string
  name TEXT DEFAULT 'Apple Health',
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### API Endpoint

**POST `/api/health-sync`**

Accepts activity data from the Apple Shortcut. Auth via `Authorization: Bearer <token>` header (the sync token, not Supabase auth).

```typescript
// Request body
{
  date: "2026-03-19",  // YYYY-MM-DD
  steps?: number,
  active_calories?: number,  // kcal burned during exercise
  active_minutes?: number,
  distance_km?: number,
  flights_climbed?: number,
  resting_calories?: number,  // basal metabolic rate calories
  workout_calories?: number,  // calories from Apple Watch workouts
  heart_rate_avg?: number,
  heart_rate_resting?: number
}
```

**Behavior:**
- Validates token → looks up user
- Upserts `activity_entries` for that date (merges with any existing manual data)
- For workout calories: adds to `active_minutes` or creates a separate activity metric
- Returns `{ success: true, date, synced_fields: [...] }`

### Apple Shortcut Design

The Shortcut does:
1. Get today's date (or prompt for date range)
2. Read from Health: Steps, Active Energy, Exercise Minutes, Walking+Running Distance, Flights Climbed
3. Read from Health: Workout sessions → sum calories burned
4. Build JSON payload
5. POST to `https://<app-url>/api/health-sync` with Bearer token
6. Show confirmation notification

We'll provide:
- A downloadable `.shortcut` file (or iCloud link)
- Setup instructions in the app's settings page
- The Shortcut URL pre-filled with the user's sync token

### Settings Page Changes

**`src/app/(app)/settings/page.tsx`** — Add "Apple Health" section:
- Generate/regenerate sync token
- Show current token (copyable)
- Show "Install Shortcut" button (links to iCloud Shortcut)
- Show last synced timestamp
- Toggle to enable/disable sync
- Setup instructions expandable section

### Activity Page Changes

**`src/app/(app)/activity/page.tsx`** — Show sync status:
- Badge showing "Synced from Apple Health" on auto-synced entries
- Differentiate manual vs synced data in the UI
- Add Apple Health calories burned to the activity summary

### Modify `activity_entries` table

Add columns:
```sql
ALTER TABLE activity_entries ADD COLUMN source TEXT DEFAULT 'manual';  -- 'manual' | 'apple_health'
ALTER TABLE activity_entries ADD COLUMN active_calories NUMERIC;  -- kcal burned during exercise
ALTER TABLE activity_entries ADD COLUMN resting_calories NUMERIC;  -- basal metabolic
ALTER TABLE activity_entries ADD COLUMN workout_calories NUMERIC;  -- from Watch workouts
```

---

## Implementation Order (Recommended)

These three features are independent and can be built in any order. Recommended priority:

### Phase 1: Composite Foods / Recipes
- Smallest scope, highest immediate value
- Unblocks better AI meal tracking (save analyzed meals as reusable recipes)
- ~8-10 tasks

### Phase 2: AI Generation Hub
- Largest scope, most impactful for "AI-native" feel
- Build workout generator first (most complex), then cardio, meals, goals
- ~15-20 tasks

### Phase 3: Apple Health Sync
- Independent infrastructure work
- Requires Supabase migration + Shortcut creation
- ~8-10 tasks

### Total estimated tasks: ~30-40

---

## Key Design Decisions

1. **Single `/generate` page** vs separate pages per type → Single page reduces navigation, shared components
2. **Claude Sonnet for generation** (not Haiku) → Plan generation needs higher quality output for structured multi-week plans
3. **Recipes as enhanced foods** (not a separate entity) → Recipes work everywhere foods work, no special-casing in meal logging
4. **Shortcut-based Health sync** vs native app → Web app limitation, but Shortcuts are powerful and can be automated
5. **Sync token auth** vs Supabase auth → Shortcuts can't do OAuth, simple token is secure enough for personal use
6. **Upsert strategy for health sync** → Merge with manual data rather than overwrite, preserving user's manual entries
