import { jsPDF } from 'jspdf'
import { db } from '../db/db'

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_')
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image blob.'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

export async function generateLogPdf(logId: number): Promise<string> {
  const log = await db.logs.get(logId)
  if (!log || log.deleted_at) {
    throw new Error('Log not found.')
  }

  const bundle = await db.bundles.get(log.bundle_id)
  if (!bundle || bundle.deleted_at) {
    throw new Error('Bundle not found for log.')
  }

  const links = (await db.log_pipes.where('log_id').equals(logId).toArray()).filter((item) => !item.deleted_at)
  const pipeIds = links.map((item) => item.pipe_id)
  const pipes = (await db.pipes.bulkGet(pipeIds)).filter((item): item is NonNullable<typeof item> => item != null && !item.deleted_at)
  const photos = (await db.photos.where('log_id').equals(logId).toArray()).filter((item) => !item.deleted_at)

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  let y = 16

  doc.setFontSize(16)
  doc.text('Pipe Pressure Test Report', 14, y)
  y += 8

  doc.setFontSize(11)
  doc.text(`Bundle: ${bundle.bundle_number}`, 14, y)
  y += 6
  doc.text(`Log: ${log.log_number}`, 14, y)
  y += 6
  doc.text(`Date: ${new Date(log.date_time).toLocaleString()}`, 14, y)
  y += 6
  doc.text(`Pressure: ${log.pressure_bar} bar`, 14, y)
  y += 6
  doc.text(`Sync status: ${log.sync_status}`, 14, y)
  y += 8

  if (log.notes) {
    doc.setFontSize(10)
    const noteLines = doc.splitTextToSize(`Notes: ${log.notes}`, pageWidth - 28)
    doc.text(noteLines, 14, y)
    y += noteLines.length * 5 + 2
  }

  doc.setFontSize(12)
  doc.text('Pipes', 14, y)
  y += 6
  doc.setFontSize(10)

  if (pipes.length === 0) {
    doc.text('No linked pipes.', 14, y)
    y += 6
  } else {
    for (const pipe of pipes) {
      if (y > pageHeight - 12) {
        doc.addPage()
        y = 16
      }
      doc.text(`- ${pipe.pipe_number}`, 16, y)
      y += 5
    }
  }

  y += 4
  doc.setFontSize(12)
  doc.text('Photos', 14, y)
  y += 6

  if (photos.length === 0) {
    doc.setFontSize(10)
    doc.text('No photos attached.', 14, y)
  } else {
    for (const photo of photos) {
      if (y > pageHeight - 55) {
        doc.addPage()
        y = 16
      }

      doc.setFontSize(10)
      const label = `${photo.kind.toUpperCase()} - ${photo.file_name}`
      doc.text(label, 14, y)
      y += 4

      try {
        const dataUrl = await blobToDataUrl(photo.blob)
        const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
        doc.addImage(dataUrl, format, 14, y, 70, 50)
        y += 54
      } catch {
        doc.text('[Image could not be rendered in PDF]', 14, y)
        y += 6
      }
    }
  }

  const fileName = `report_bundle_${sanitizeFileName(bundle.bundle_number)}_log_${sanitizeFileName(log.log_number)}.pdf`
  doc.save(fileName)
  return fileName
}
