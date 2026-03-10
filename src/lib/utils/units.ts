export function kgToLbs(kg: number): number {
  return kg * 2.20462
}

export function lbsToKg(lbs: number): number {
  return lbs / 2.20462
}

export function kmToMiles(km: number): number {
  return km * 0.621371
}

export function milesToKm(miles: number): number {
  return miles / 0.621371
}

export function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return `${feet}'${inches}"`
}

export function formatWeight(kg: number, unit: 'metric' | 'imperial'): string {
  if (unit === 'imperial') {
    return `${kgToLbs(kg).toFixed(1)} lbs`
  }
  return `${kg.toFixed(1)} kg`
}

export function formatWeightNumber(kg: number, unit: 'metric' | 'imperial'): number {
  if (unit === 'imperial') {
    return Number(kgToLbs(kg).toFixed(1))
  }
  return Number(kg.toFixed(1))
}

export function parseWeightToKg(value: number, unit: 'metric' | 'imperial'): number {
  if (unit === 'imperial') {
    return lbsToKg(value)
  }
  return value
}

export function formatDistance(km: number, unit: 'metric' | 'imperial'): string {
  if (unit === 'imperial') {
    return `${kmToMiles(km).toFixed(2)} mi`
  }
  return `${km.toFixed(2)} km`
}
