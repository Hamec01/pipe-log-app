import { jsPDF } from 'jspdf'
import { db } from '../db/db'
import { listBundlePipeGroupsByLogId } from './pipeService'

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
  if (!log) {
    throw new Error('Log not found.')
  }

  const groups = await listBundlePipeGroupsByLogId(logId)
  const photos = await db.photos.where('log_id').equals(logId).toArray()

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  let y = 16

  doc.setFontSize(16)
  doc.text('Pipe Pressure Test Report', 14, y)
  y += 8

  doc.setFontSize(11)
  doc.text(`Log: ${log.log_number}`, 14, y)
  y += 6
  doc.text(`Date: ${new Date(log.date_time).toLocaleString()}`, 14, y)
  y += 6
  doc.text(`Pressure: ${log.pressure_bar} bar`, 14, y)
  y += 8

  if (log.notes) {
    doc.setFontSize(10)
    const noteLines = doc.splitTextToSize(`Notes: ${log.notes}`, pageWidth - 28)
    doc.text(noteLines, 14, y)
    y += noteLines.length * 5 + 2
  }

  doc.setFontSize(12)
  doc.text('Bundle and Pipe Groups', 14, y)
  y += 6

  if (groups.length === 0) {
    doc.setFontSize(10)
    doc.text('No bundle/pipe links for this log.', 14, y)
    y += 6
  } else {
    for (const group of groups) {
      if (y > pageHeight - 20) {
        doc.addPage()
        y = 16
      }

      doc.setFontSize(11)
      doc.text(`Bundle ${group.bundle.bundle_number}`, 14, y)
      y += 5
      doc.setFontSize(10)
      for (const pipe of group.pipes) {
        if (y > pageHeight - 14) {
          doc.addPage()
          y = 16
        }
        doc.text(`- ${pipe.pipe_number}`, 18, y)
        y += 4
      }
      y += 2
    }
  }

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
      doc.text(`${photo.kind.toUpperCase()} - ${photo.file_name}`, 14, y)
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

  const fileName = `report_log_${sanitizeFileName(log.log_number)}.pdf`
  doc.save(fileName)
  return fileName
}
