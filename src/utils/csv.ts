function escapeCsvValue(value: string): string {
  const shouldQuote = value.includes(',') || value.includes('"') || value.includes('\n')
  if (!shouldQuote) {
    return value
  }

  return `"${value.replaceAll('"', '""')}"`
}

export function toCsv(headers: string[], rows: string[][]): string {
  const head = headers.map(escapeCsvValue).join(',')
  const body = rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(',')).join('\n')

  return body ? `${head}\n${body}` : head
}
