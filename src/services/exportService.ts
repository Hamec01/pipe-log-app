import JSZip from 'jszip'
import { db } from '../db/db'
import { toCsv } from '../utils/csv'
import { buildPhotoExportName } from '../utils/fileNaming'

interface ExportResult {
  fileName: string
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function exportBundleZip(bundleId: number): Promise<ExportResult> {
  const bundle = await db.bundles.get(bundleId)
  if (!bundle) {
    throw new Error('Bundle not found.')
  }

  const bundlePipeLinks = await db.bundle_pipes.where('bundle_id').equals(bundleId).toArray()
  const pipeIds = [...new Set(bundlePipeLinks.map((row) => row.pipe_id))]
  const pipes = pipeIds.length > 0 ? await db.pipes.bulkGet(pipeIds) : []

  const pipeById = new Map<number, string>()
  for (const pipe of pipes) {
    if (pipe?.id) {
      pipeById.set(pipe.id, pipe.pipe_number)
    }
  }

  const logLinks = pipeIds.length > 0 ? await db.log_pipes.where('pipe_id').anyOf(pipeIds).toArray() : []
  const logIds = [...new Set(logLinks.map((row) => row.log_id))]
  const logs = logIds.length > 0 ? await db.logs.bulkGet(logIds) : []
  const filteredLogs = logs.filter((log): log is NonNullable<typeof log> => log != null)

  const photos = logIds.length > 0 ? await db.photos.where('log_id').anyOf(logIds).toArray() : []

  const zip = new JSZip()
  const photosFolder = zip.folder('photos')
  if (!photosFolder) {
    throw new Error('Could not create photos folder in zip.')
  }

  const counters = new Map<string, number>()
  const exportNameByPhotoId = new Map<number, string>()

  for (const photo of photos) {
    if (typeof photo.id !== 'number') {
      continue
    }

    const log = filteredLogs.find((item) => item.id === photo.log_id)
    if (!log) {
      continue
    }

    const key = `${log.id}|${photo.kind}`
    const order = (counters.get(key) ?? 0) + 1
    counters.set(key, order)

    const exportFileName = buildPhotoExportName({
      bundleNumber: bundle.bundle_number,
      logNumber: log.log_number,
      kind: photo.kind,
      order,
      sourceFileName: photo.file_name,
      mimeType: photo.mime_type,
    })

    photosFolder.file(exportFileName, photo.blob)
    exportNameByPhotoId.set(photo.id, exportFileName)
  }

  const headers = ['bundle_number', 'log_number', 'date_time', 'pressure_bar', 'pipe_numbers', 'photo_files']
  const csvRows: string[][] = []

  for (const log of filteredLogs.sort((a, b) => b.date_time.localeCompare(a.date_time))) {
    if (typeof log.id !== 'number') {
      continue
    }

    const pipeNumbers = [...new Set(
      logLinks
        .filter((link) => link.log_id === log.id)
        .map((link) => pipeById.get(link.pipe_id) ?? '')
        .filter((value) => value.length > 0),
    )]

    const photoFiles = photos
      .filter((photo) => photo.log_id === log.id)
      .map((photo) => (typeof photo.id === 'number' ? exportNameByPhotoId.get(photo.id) : undefined))
      .filter((name): name is string => Boolean(name))

    csvRows.push([
      bundle.bundle_number,
      log.log_number,
      log.date_time,
      String(log.pressure_bar),
      pipeNumbers.join(';'),
      photoFiles.join(';'),
    ])
  }

  const csvText = toCsv(headers, csvRows)
  zip.file(`bundle_${bundle.bundle_number}.csv`, csvText)

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const zipFileName = `bundle_${bundle.bundle_number}.zip`
  triggerDownload(zipBlob, zipFileName)

  return { fileName: zipFileName }
}
