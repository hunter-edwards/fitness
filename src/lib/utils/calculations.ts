export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100
  return weightKg / (heightM * heightM)
}

export function calculateTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: 'male' | 'female',
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
): number {
  // Mifflin-St Jeor equation
  let bmr: number
  if (gender === 'male') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161
  }

  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  }

  return Math.round(bmr * multipliers[activityLevel])
}

export function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight
  // Epley formula
  return Math.round(weight * (1 + reps / 30))
}

export function calculateEMA(data: number[], span: number): number[] {
  if (data.length === 0) return []
  const k = 2 / (span + 1)
  const ema: number[] = [data[0]]
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k))
  }
  return ema
}

export function calculateWeeklyChange(
  entries: { date: string; value: number }[]
): number | null {
  if (entries.length < 2) return null
  const sorted = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const daysDiff =
    (new Date(last.date).getTime() - new Date(first.date).getTime()) /
    (1000 * 60 * 60 * 24)
  if (daysDiff < 1) return null
  const weeksDiff = daysDiff / 7
  return (last.value - first.value) / weeksDiff
}
