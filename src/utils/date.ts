function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function nowDateTimeLocalValue(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function dateTimeLocalToIso(localValue: string): string {
  return new Date(localValue).toISOString()
}
