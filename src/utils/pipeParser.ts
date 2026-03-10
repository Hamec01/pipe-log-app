export function parsePipeNumbers(input: string): string[] {
  const parts = input
    .split(/[\n,\s]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  const unique = new Set<string>()
  const ordered: string[] = []

  for (const part of parts) {
    if (!unique.has(part)) {
      unique.add(part)
      ordered.push(part)
    }
  }

  return ordered
}
