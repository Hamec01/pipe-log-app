import { createWorker } from 'tesseract.js'

function parsePressureCandidates(text: string): number[] {
  const matches = text.match(/\d{2,4}(?:[.,]\d+)?/g) ?? []

  return matches
    .map((item) => Number(item.replace(',', '.')))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 2000)
}

export async function extractPressureFromImage(imageBlob: Blob): Promise<number | null> {
  const worker = await createWorker('eng')

  try {
    const result = await worker.recognize(imageBlob)
    const text = result.data.text ?? ''
    const candidates = parsePressureCandidates(text)

    if (candidates.length === 0) {
      return null
    }

    return candidates[0]
  } finally {
    await worker.terminate()
  }
}
