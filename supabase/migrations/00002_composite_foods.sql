-- Add is_recipe flag to foods
ALTER TABLE foods ADD COLUMN is_recipe BOOLEAN DEFAULT false;

-- Food ingredients (recipe components)
CREATE TABLE food_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  ingredient_food_id UUID REFERENCES foods(id) ON DELETE SET NULL,
  custom_name TEXT,
  servings NUMERIC DEFAULT 1,
  calories NUMERIC,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_food_ingredients_parent ON food_ingredients(parent_food_id);
ALTER TABLE food_ingredients ENABLE ROW LEVEL SECURITY;

-- RLS: users can manage ingredients of their own foods
CREATE POLICY "Users can manage ingredients of their foods"
  ON food_ingredients FOR ALL TO authenticated
  USING (parent_food_id IN (SELECT id FROM foods WHERE user_id = auth.uid()))
  WITH CHECK (parent_food_id IN (SELECT id FROM foods WHERE user_id = auth.uid()));
