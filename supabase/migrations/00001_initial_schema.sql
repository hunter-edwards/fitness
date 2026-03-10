-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  height_cm NUMERIC(5,1),
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  unit_system TEXT DEFAULT 'imperial' CHECK (unit_system IN ('metric', 'imperial')),
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own profile" ON profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Weight entries
CREATE TABLE weight_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_kg NUMERIC(5,2) NOT NULL,
  body_fat_pct NUMERIC(4,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_weight_entries_user_date ON weight_entries(user_id, date DESC);
ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own weight entries" ON weight_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Foods
CREATE TABLE foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  barcode TEXT,
  off_id TEXT,
  serving_size_g NUMERIC(7,1),
  serving_label TEXT DEFAULT '1 serving',
  calories_per_serving NUMERIC(7,1),
  protein_g NUMERIC(6,1),
  carbs_g NUMERIC(6,1),
  fat_g NUMERIC(6,1),
  fiber_g NUMERIC(6,1),
  sugar_g NUMERIC(6,1),
  sodium_mg NUMERIC(7,1),
  is_custom BOOLEAN DEFAULT true,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_foods_user_name ON foods(user_id, name);
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own foods" ON foods FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Meals
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_meals_user_date ON meals(user_id, date DESC);
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own meals" ON meals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Meal items
CREATE TABLE meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_id UUID REFERENCES foods(id) ON DELETE SET NULL,
  custom_name TEXT,
  servings NUMERIC(5,2) DEFAULT 1.0,
  calories NUMERIC(7,1),
  protein_g NUMERIC(6,1),
  carbs_g NUMERIC(6,1),
  fat_g NUMERIC(6,1),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_meal_items_meal ON meal_items(meal_id);
ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own meal items" ON meal_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid()));

-- Exercises
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'glutes', 'core', 'cardio', 'flexibility', 'olympic', 'other')),
  equipment TEXT,
  muscle_groups TEXT[],
  exercise_type TEXT DEFAULT 'strength' CHECK (exercise_type IN ('strength', 'cardio', 'flexibility', 'other')),
  video_url TEXT,
  instructions TEXT,
  is_custom BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exercises_user_name ON exercises(user_id, name);
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own exercises" ON exercises FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Workout plans
CREATE TABLE workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  source TEXT CHECK (source IN ('manual', 'uploaded', 'generated')),
  source_file_url TEXT,
  source_file_name TEXT,
  duration_weeks INTEGER,
  is_active BOOLEAN DEFAULT false,
  parsed_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own plans" ON workout_plans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Workouts
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES workout_plans(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  name TEXT,
  notes TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  total_volume_kg NUMERIC(10,1),
  calories_burned NUMERIC(7,1),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workouts_user_date ON workouts(user_id, date DESC);
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workouts" ON workouts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Workout sets
CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  set_type TEXT DEFAULT 'working' CHECK (set_type IN ('warmup', 'working', 'dropset', 'failure', 'amrap')),
  reps INTEGER,
  weight_kg NUMERIC(6,2),
  duration_seconds INTEGER,
  distance_km NUMERIC(6,2),
  rpe NUMERIC(3,1),
  notes TEXT,
  completed BOOLEAN DEFAULT true,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workout_sets_workout ON workout_sets(workout_id);
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workout sets" ON workout_sets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_sets.workout_id AND workouts.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_sets.workout_id AND workouts.user_id = auth.uid()));

-- Plan weeks
CREATE TABLE plan_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE plan_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own plan weeks" ON plan_weeks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM workout_plans WHERE workout_plans.id = plan_weeks.plan_id AND workout_plans.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workout_plans WHERE workout_plans.id = plan_weeks.plan_id AND workout_plans.user_id = auth.uid()));

-- Plan workouts
CREATE TABLE plan_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_week_id UUID NOT NULL REFERENCES plan_weeks(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE plan_workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own plan workouts" ON plan_workouts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM plan_weeks pw JOIN workout_plans wp ON wp.id = pw.plan_id WHERE pw.id = plan_workouts.plan_week_id AND wp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM plan_weeks pw JOIN workout_plans wp ON wp.id = pw.plan_id WHERE pw.id = plan_workouts.plan_week_id AND wp.user_id = auth.uid()));

-- Plan exercises
CREATE TABLE plan_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_workout_id UUID NOT NULL REFERENCES plan_workouts(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  sets INTEGER,
  reps TEXT,
  weight_suggestion TEXT,
  rest_seconds INTEGER,
  notes TEXT,
  video_url TEXT,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE plan_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own plan exercises" ON plan_exercises FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM plan_workouts pwo JOIN plan_weeks pw ON pw.id = pwo.plan_week_id JOIN workout_plans wp ON wp.id = pw.plan_id WHERE pwo.id = plan_exercises.plan_workout_id AND wp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM plan_workouts pwo JOIN plan_weeks pw ON pw.id = pwo.plan_week_id JOIN workout_plans wp ON wp.id = pw.plan_id WHERE pwo.id = plan_exercises.plan_workout_id AND wp.user_id = auth.uid()));

-- Activity entries
CREATE TABLE activity_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  steps INTEGER,
  active_minutes INTEGER,
  standing_hours INTEGER,
  distance_km NUMERIC(6,2),
  flights_climbed INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_activity_user_date ON activity_entries(user_id, date DESC);
ALTER TABLE activity_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own activity" ON activity_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Goals
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('weight', 'body_fat', 'strength', 'nutrition', 'activity', 'custom')),
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC(10,2),
  target_unit TEXT,
  current_value NUMERIC(10,2),
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  start_date DATE,
  target_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_goals_user_status ON goals(user_id, status);
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own goals" ON goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Nutrition targets
CREATE TABLE nutrition_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'default',
  calories INTEGER,
  protein_g INTEGER,
  carbs_g INTEGER,
  fat_g INTEGER,
  fiber_g INTEGER,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL,
  effective_until DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_nutrition_targets_user ON nutrition_targets(user_id, is_active);
ALTER TABLE nutrition_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own nutrition targets" ON nutrition_targets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Views
CREATE VIEW daily_nutrition_summary AS
SELECT
  m.user_id,
  m.date,
  COALESCE(SUM(mi.calories), 0) AS total_calories,
  COALESCE(SUM(mi.protein_g), 0) AS total_protein,
  COALESCE(SUM(mi.carbs_g), 0) AS total_carbs,
  COALESCE(SUM(mi.fat_g), 0) AS total_fat,
  COUNT(DISTINCT m.id) AS meal_count,
  COUNT(mi.id) AS item_count
FROM meals m
LEFT JOIN meal_items mi ON mi.meal_id = m.id
GROUP BY m.user_id, m.date;

CREATE VIEW daily_workout_summary AS
SELECT
  w.user_id,
  w.date,
  COUNT(w.id) AS workout_count,
  COALESCE(SUM(w.duration_minutes), 0) AS total_duration,
  COALESCE(SUM(w.total_volume_kg), 0) AS total_volume,
  COALESCE(SUM(w.calories_burned), 0) AS total_calories_burned,
  array_agg(DISTINCT w.name) FILTER (WHERE w.name IS NOT NULL) AS workout_names
FROM workouts w
WHERE w.status = 'completed'
GROUP BY w.user_id, w.date;
