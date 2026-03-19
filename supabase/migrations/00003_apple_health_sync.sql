-- Health sync tokens for Apple Health Shortcuts integration
CREATE TABLE health_sync_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT 'Apple Health',
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE health_sync_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sync tokens"
  ON health_sync_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add sync-related columns to activity_entries
ALTER TABLE activity_entries ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE activity_entries ADD COLUMN active_calories NUMERIC;
ALTER TABLE activity_entries ADD COLUMN resting_calories NUMERIC;
ALTER TABLE activity_entries ADD COLUMN workout_calories NUMERIC;
ALTER TABLE activity_entries ADD COLUMN heart_rate_avg INTEGER;
ALTER TABLE activity_entries ADD COLUMN heart_rate_resting INTEGER;
