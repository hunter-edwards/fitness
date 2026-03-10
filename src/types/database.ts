export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          email: string | null
          avatar_url: string | null
          height_cm: number | null
          date_of_birth: string | null
          gender: 'male' | 'female' | 'other' | null
          activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | null
          unit_system: 'metric' | 'imperial'
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          email?: string | null
          avatar_url?: string | null
          height_cm?: number | null
          date_of_birth?: string | null
          gender?: 'male' | 'female' | 'other' | null
          activity_level?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | null
          unit_system?: 'metric' | 'imperial'
          timezone?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      weight_entries: {
        Row: {
          id: string
          user_id: string
          date: string
          weight_kg: number
          body_fat_pct: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          weight_kg: number
          body_fat_pct?: number | null
          notes?: string | null
        }
        Update: Partial<Database['public']['Tables']['weight_entries']['Insert']>
      }
      foods: {
        Row: {
          id: string
          user_id: string
          name: string
          brand: string | null
          barcode: string | null
          off_id: string | null
          serving_size_g: number | null
          serving_label: string
          calories_per_serving: number | null
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
          fiber_g: number | null
          sugar_g: number | null
          sodium_mg: number | null
          is_custom: boolean
          is_favorite: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          brand?: string | null
          barcode?: string | null
          off_id?: string | null
          serving_size_g?: number | null
          serving_label?: string
          calories_per_serving?: number | null
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          sugar_g?: number | null
          sodium_mg?: number | null
          is_custom?: boolean
          is_favorite?: boolean
        }
        Update: Partial<Database['public']['Tables']['foods']['Insert']>
      }
      meals: {
        Row: {
          id: string
          user_id: string
          date: string
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          name?: string | null
        }
        Update: Partial<Database['public']['Tables']['meals']['Insert']>
      }
      meal_items: {
        Row: {
          id: string
          meal_id: string
          food_id: string | null
          custom_name: string | null
          servings: number
          calories: number | null
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
          created_at: string
        }
        Insert: {
          id?: string
          meal_id: string
          food_id?: string | null
          custom_name?: string | null
          servings?: number
          calories?: number | null
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
        }
        Update: Partial<Database['public']['Tables']['meal_items']['Insert']>
      }
      exercises: {
        Row: {
          id: string
          user_id: string
          name: string
          category: string | null
          equipment: string | null
          muscle_groups: string[] | null
          exercise_type: 'strength' | 'cardio' | 'flexibility' | 'other'
          video_url: string | null
          instructions: string | null
          is_custom: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          category?: string | null
          equipment?: string | null
          muscle_groups?: string[] | null
          exercise_type?: 'strength' | 'cardio' | 'flexibility' | 'other'
          video_url?: string | null
          instructions?: string | null
          is_custom?: boolean
        }
        Update: Partial<Database['public']['Tables']['exercises']['Insert']>
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          plan_id: string | null
          date: string
          name: string | null
          notes: string | null
          status: 'scheduled' | 'in_progress' | 'completed' | 'skipped'
          started_at: string | null
          completed_at: string | null
          duration_minutes: number | null
          total_volume_kg: number | null
          calories_burned: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id?: string | null
          date: string
          name?: string | null
          notes?: string | null
          status?: 'scheduled' | 'in_progress' | 'completed' | 'skipped'
          started_at?: string | null
          completed_at?: string | null
          duration_minutes?: number | null
          total_volume_kg?: number | null
          calories_burned?: number | null
        }
        Update: Partial<Database['public']['Tables']['workouts']['Insert']>
      }
      workout_sets: {
        Row: {
          id: string
          workout_id: string
          exercise_id: string
          set_number: number
          set_type: 'warmup' | 'working' | 'dropset' | 'failure' | 'amrap'
          reps: number | null
          weight_kg: number | null
          duration_seconds: number | null
          distance_km: number | null
          rpe: number | null
          notes: string | null
          completed: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          workout_id: string
          exercise_id: string
          set_number: number
          set_type?: 'warmup' | 'working' | 'dropset' | 'failure' | 'amrap'
          reps?: number | null
          weight_kg?: number | null
          duration_seconds?: number | null
          distance_km?: number | null
          rpe?: number | null
          notes?: string | null
          completed?: boolean
          sort_order: number
        }
        Update: Partial<Database['public']['Tables']['workout_sets']['Insert']>
      }
      workout_plans: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          source: 'manual' | 'uploaded' | 'generated' | null
          source_file_url: string | null
          source_file_name: string | null
          duration_weeks: number | null
          is_active: boolean
          parsed_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          source?: 'manual' | 'uploaded' | 'generated' | null
          source_file_url?: string | null
          source_file_name?: string | null
          duration_weeks?: number | null
          is_active?: boolean
          parsed_data?: Json | null
        }
        Update: Partial<Database['public']['Tables']['workout_plans']['Insert']>
      }
      plan_weeks: {
        Row: {
          id: string
          plan_id: string
          week_number: number
          name: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          week_number: number
          name?: string | null
          notes?: string | null
        }
        Update: Partial<Database['public']['Tables']['plan_weeks']['Insert']>
      }
      plan_workouts: {
        Row: {
          id: string
          plan_week_id: string
          day_of_week: number | null
          name: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          plan_week_id: string
          day_of_week?: number | null
          name: string
          sort_order: number
        }
        Update: Partial<Database['public']['Tables']['plan_workouts']['Insert']>
      }
      plan_exercises: {
        Row: {
          id: string
          plan_workout_id: string
          exercise_id: string | null
          exercise_name: string
          sets: number | null
          reps: string | null
          weight_suggestion: string | null
          rest_seconds: number | null
          notes: string | null
          video_url: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          plan_workout_id: string
          exercise_id?: string | null
          exercise_name: string
          sets?: number | null
          reps?: string | null
          weight_suggestion?: string | null
          rest_seconds?: number | null
          notes?: string | null
          video_url?: string | null
          sort_order: number
        }
        Update: Partial<Database['public']['Tables']['plan_exercises']['Insert']>
      }
      activity_entries: {
        Row: {
          id: string
          user_id: string
          date: string
          steps: number | null
          active_minutes: number | null
          standing_hours: number | null
          distance_km: number | null
          flights_climbed: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          steps?: number | null
          active_minutes?: number | null
          standing_hours?: number | null
          distance_km?: number | null
          flights_climbed?: number | null
          notes?: string | null
        }
        Update: Partial<Database['public']['Tables']['activity_entries']['Insert']>
      }
      goals: {
        Row: {
          id: string
          user_id: string
          category: 'weight' | 'body_fat' | 'strength' | 'nutrition' | 'activity' | 'custom'
          title: string
          description: string | null
          target_value: number | null
          target_unit: string | null
          current_value: number | null
          exercise_id: string | null
          start_date: string | null
          target_date: string | null
          status: 'active' | 'achieved' | 'abandoned'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category: 'weight' | 'body_fat' | 'strength' | 'nutrition' | 'activity' | 'custom'
          title: string
          description?: string | null
          target_value?: number | null
          target_unit?: string | null
          current_value?: number | null
          exercise_id?: string | null
          start_date?: string | null
          target_date?: string | null
          status?: 'active' | 'achieved' | 'abandoned'
        }
        Update: Partial<Database['public']['Tables']['goals']['Insert']>
      }
      nutrition_targets: {
        Row: {
          id: string
          user_id: string
          name: string
          calories: number | null
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
          fiber_g: number | null
          is_active: boolean
          effective_from: string
          effective_until: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string
          calories?: number | null
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          is_active?: boolean
          effective_from: string
          effective_until?: string | null
        }
        Update: Partial<Database['public']['Tables']['nutrition_targets']['Insert']>
      }
    }
    Views: {
      daily_nutrition_summary: {
        Row: {
          user_id: string
          date: string
          total_calories: number
          total_protein: number
          total_carbs: number
          total_fat: number
          meal_count: number
          item_count: number
        }
      }
      daily_workout_summary: {
        Row: {
          user_id: string
          date: string
          workout_count: number
          total_duration: number
          total_volume: number
          total_calories_burned: number
          workout_names: string[]
        }
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
