export const EXERCISE_CATEGORIES = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs',
  'glutes', 'core', 'cardio', 'flexibility', 'olympic', 'other',
] as const

export const EQUIPMENT_TYPES = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight',
  'kettlebell', 'bands', 'smith_machine', 'other',
] as const

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

export const SET_TYPES = ['warmup', 'working', 'dropset', 'failure', 'amrap'] as const

export const GOAL_CATEGORIES = [
  'weight', 'body_fat', 'strength', 'nutrition', 'activity', 'custom',
] as const

export const TIME_RANGES = [
  { label: '1W', value: '7d', days: 7 },
  { label: '1M', value: '30d', days: 30 },
  { label: '3M', value: '90d', days: 90 },
  { label: '6M', value: '180d', days: 180 },
  { label: '1Y', value: '365d', days: 365 },
  { label: 'All', value: 'all', days: 99999 },
] as const

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Weight', href: '/weight', icon: 'Scale' },
  { label: 'Nutrition', href: '/nutrition', icon: 'UtensilsCrossed' },
  { label: 'Workouts', href: '/workouts', icon: 'Dumbbell' },
  { label: 'Plans', href: '/plans', icon: 'ClipboardList' },
  { label: 'Calendar', href: '/calendar', icon: 'CalendarDays' },
  { label: 'Activity', href: '/activity', icon: 'Footprints' },
  { label: 'Goals', href: '/goals', icon: 'Target' },
  { label: 'Insights', href: '/insights', icon: 'TrendingUp' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
] as const

export const BOTTOM_NAV_ITEMS = [
  { label: 'Home', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Nutrition', href: '/nutrition', icon: 'UtensilsCrossed' },
  { label: 'Workout', href: '/workouts', icon: 'Dumbbell' },
  { label: 'Calendar', href: '/calendar', icon: 'CalendarDays' },
  { label: 'More', href: '/insights', icon: 'MoreHorizontal' },
] as const
