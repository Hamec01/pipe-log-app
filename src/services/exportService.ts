import JSZip from 'jszip'
import { db } from '../db/db'
import { toCsv } from '../utils/csv'
import { buildPhotoExportName } from '../utils/fileNaming'

interface ExportResult {
  fileName: string
}

interface ExportedPhoto {
  id: number
  logId: number
  kind: 'gauge' | 'site' | 'pipe'
  pipeId?: number
  fileName: string
  blob: Blob
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
  if (!bundle || bundle.deleted_at) {
    throw new Error('Bundle not found.')
  }

  const logs = (await db.logs.where('bundle_id').equals(bundleId).toArray()).filter((log) => !log.deleted_at)
  const logIds = logs
    .map((log) => log.id)
    .filter((id): id is number => typeof id === 'number')

  const allPipes = (await db.pipes.where('bundle_id').equals(bundleId).toArray()).filter((pipe) => !pipe.deleted_at)
  const [all_log_pipes, allPhotos] =
    logIds.length > 0
      ? await Promise.all([
          db.log_pipes.where('log_id').anyOf(logIds).toArray().then((rows) => rows.filter((row) => !row.deleted_at)),
          db.photos.where('log_id').anyOf(logIds).toArray().then((rows) => rows.filter((row) => !row.deleted_at)),
        ])
      : [[], []]

  const pipeNumberById = new Map<number, string>()
  for (const pipe of allPipes) {
    if (typeof pipe.id === 'number') {
      pipeNumberById.set(pipe.id, pipe.pipe_number)
    }
  }

  const logPipeIds = new Map<number, number[]>()
  for (const row of all_log_pipes) {
    const list = logPipeIds.get(row.log_id) ?? []
    list.push(row.pipe_id)
    logPipeIds.set(row.log_id, list)
  }

  const zip = new JSZip()
  const photosFolder = zip.folder('photos')
  if (!photosFolder) {
    throw new Error('Could not create photos folder in zip.')
  }

  const exportNameByPhotoId = new Map<number, string>()
  const photosByLogId = new Map<number, ExportedPhoto[]>()
  const counters = new Map<string, number>()

  for (const photo of allPhotos) {
    if (typeof photo.id !== 'number') {
      continue
    }

    const log = logs.find((item) => item.id === photo.log_id)
    if (!log) {
      continue
    }

    const keyParts = [String(photo.log_id), photo.kind]
    if (photo.kind === 'pipe') {
      keyParts.push(String(photo.pipe_id ?? 'unknown'))
    }
    const counterKey = keyParts.join('|')
    const order = (counters.get(counterKey) ?? 0) + 1
    counters.set(counterKey, order)

    const exportFileName = buildPhotoExportName({
      bundleNumber: bundle.bundle_number,
      logNumber: log.log_number,
      kind: photo.kind,
      order,
      pipeNumber: typeof photo.pipe_id === 'number' ? pipeNumberById.get(photo.pipe_id) : undefined,
      sourceFileName: photo.file_name,
      mimeType: photo.mime_type,
    })

    photosFolder.file(exportFileName, photo.blob)
    exportNameByPhotoId.set(photo.id, exportFileName)

    const list = photosByLogId.get(photo.log_id) ?? []
    list.push({
      id: photo.id,
      logId: photo.log_id,
      kind: photo.kind,
      pipeId: photo.pipe_id,
      fileName: exportFileName,
      blob: photo.blob,
    })
    photosByLogId.set(photo.log_id, list)
  }

  const headers = ['bundle_number', 'log_number', 'date_time', 'pressure_bar', 'pipe_number', 'photo_files']
  const csvRows: string[][] = []

  for (const log of logs) {
    if (typeof log.id !== 'number') {
      continue
    }

    const linkedPipeIds = logPipeIds.get(log.id) ?? []
    const linkedPipeNumbers = linkedPipeIds.map((pipeId) => pipeNumberById.get(pipeId) ?? '')

    const logPhotos = photosByLogId.get(log.id) ?? []

    const buildPhotoListForPipe = (pipeId?: number): string => {
      const names = logPhotos
        .filter((photo) => {
          if (photo.kind === 'pipe') {
            return typeof pipeId === 'number' && photo.pipeId === pipeId
          }

          return true
        })
        .map((photo) => exportNameByPhotoId.get(photo.id))
        .filter((name): name is string => Boolean(name))

      return names.join(';')
    }

    if (linkedPipeIds.length === 0) {
      csvRows.push([
        bundle.bundle_number,
        log.log_number,
        log.date_time,
        String(log.pressure_bar),
        '',
        buildPhotoListForPipe(),
      ])
      continue
    }

    linkedPipeIds.forEach((pipeId, index) => {
      csvRows.push([
        bundle.bundle_number,
        log.log_number,
        log.date_time,
        String(log.pressure_bar),
        linkedPipeNumbers[index] ?? '',
        buildPhotoListForPipe(pipeId),
      ])
    })
  }

  const csvText = toCsv(headers, csvRows)
  const csvFileName = `bundle_${bundle.bundle_number}.csv`
  zip.file(csvFileName, csvText)

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const zipFileName = `bundle_${bundle.bundle_number}.zip`
  triggerDownload(zipBlob, zipFileName)

  return {
    fileName: zipFileName,
  }
}
