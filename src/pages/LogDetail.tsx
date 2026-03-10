import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CameraCapture } from '../components/CameraCapture'
import { ExportLogPdfButton } from '../components/ExportLogPdfButton'
import { PhotoGrid, type PhotoGridItem } from '../components/PhotoGrid'
import { PipeList } from '../components/PipeList'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import type { PhotoKind, PhotoRecord, PipeRecord, LogRecord } from '../models/types'
import { getLogById } from '../services/logService'
import { createPhotoObjectUrl, deletePhoto, listPhotosByLogId, savePhoto } from '../services/photoService'
import { listPipesByLogId } from '../services/pipeService'

function formatDateTime(isoValue: string): string {
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) {
    return isoValue
  }

  return date.toLocaleString()
}

export function LogDetailPage() {
  const { id } = useParams()
  const logId = Number(id)

  const [log, setLog] = useState<LogRecord | null>(null)
  const [pipes, setPipes] = useState<PipeRecord[]>([])
  const [photos, setPhotos] = useState<PhotoRecord[]>([])
  const [photoKind, setPhotoKind] = useState<PhotoKind>('site')
  const [selectedPipeId, setSelectedPipeId] = useState<string>('')
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const pipeById = useMemo(() => {
    const map = new Map<number, PipeRecord>()
    for (const pipe of pipes) {
      if (typeof pipe.id === 'number') {
        map.set(pipe.id, pipe)
      }
    }
    return map
  }, [pipes])

  const photoGridItems = useMemo<PhotoGridItem[]>(() => {
    return photos
      .filter((photo): photo is PhotoRecord & { id: number } => typeof photo.id === 'number')
      .map((photo) => ({
        id: photo.id,
        kind: photo.kind,
        fileName: photo.file_name,
        pipeNumber: typeof photo.pipe_id === 'number' ? pipeById.get(photo.pipe_id)?.pipe_number : undefined,
        url: createPhotoObjectUrl(photo.blob),
      }))
  }, [photos, pipeById])

  useEffect(() => {
    return () => {
      for (const photo of photoGridItems) {
        URL.revokeObjectURL(photo.url)
      }
    }
  }, [photoGridItems])

  const loadData = async () => {
    if (!Number.isFinite(logId)) {
      setErrorMessage('Invalid log ID.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [logRow, pipeRows, photoRows] = await Promise.all([
        getLogById(logId),
        listPipesByLogId(logId),
        listPhotosByLogId(logId),
      ])

      if (!logRow) {
        setLog(null)
        setPipes([])
        setPhotos([])
        setErrorMessage('Log not found.')
        return
      }

      setLog(logRow)
      setPipes(pipeRows)
      setPhotos(photoRows)
    } catch {
      setErrorMessage('Could not load log details.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [logId])

  const onAddPhoto = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!Number.isFinite(logId)) {
      setErrorMessage('Invalid log ID.')
      return
    }

    if (!newPhotoFile) {
      setErrorMessage('Select a photo file first.')
      return
    }

    const parsedPipeId = selectedPipeId ? Number(selectedPipeId) : undefined
    if (photoKind === 'pipe' && typeof parsedPipeId !== 'number') {
      setErrorMessage('Select a pipe for pipe-type photo.')
      return
    }

    try {
      setIsSaving(true)
      await savePhoto({
        logId,
        file: newPhotoFile,
        kind: photoKind,
        pipeId: photoKind === 'pipe' ? parsedPipeId : undefined,
      })

      setSuccessMessage('Photo saved.')
      setNewPhotoFile(null)
      setSelectedPipeId('')
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save photo.'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  const onDeletePhoto = async (photoId: number) => {
    const ok = confirm('Are you sure you want to delete this item?')
    if (!ok) {
      return
    }

    try {
      await deletePhoto(photoId)
      await loadData()
    } catch {
      alert('Failed to delete photo.')
    }
  }

  return (
    <section className="page">
      <h2>Log Detail</h2>
      {log ? (
        <p>
          <Link to={`/bundle/${log.bundle_id}`}>Back to Bundle</Link>
        </p>
      ) : null}

      {isLoading ? <p className="muted">Loading log...</p> : null}
      {errorMessage ? <p className="message error">{errorMessage}</p> : null}

      {log ? (
        <>
          <div className="card">
            <h3 className="card-title">Log {log.log_number}</h3>
            <SyncStatusBadge status={log.sync_status} />
            <p className="muted">Pressure: {log.pressure_bar} bar</p>
            <p className="muted">Date: {formatDateTime(log.date_time)}</p>
            {log.notes ? <p>{log.notes}</p> : null}
            <div className="card-actions">
              <ExportLogPdfButton logId={logId} />
            </div>
          </div>

          <section className="group-section">
            <h3>Pipes</h3>
            <PipeList pipes={pipes.map((pipe) => pipe.pipe_number)} />
          </section>

          <section className="group-section">
            <h3>Photos</h3>
            <PhotoGrid photos={photoGridItems} onDeletePhoto={onDeletePhoto} />
          </section>

          <section className="group-section">
            <h3>Add Photo</h3>
            <form className="entry-form" onSubmit={onAddPhoto}>
              <div className="field-row">
                <div className="field-group">
                  <label htmlFor="photoKind">Photo Type</label>
                  <select
                    id="photoKind"
                    value={photoKind}
                    onChange={(event) => setPhotoKind(event.target.value as PhotoKind)}
                  >
                    <option value="site">site</option>
                    <option value="gauge">gauge</option>
                    <option value="pipe">pipe</option>
                  </select>
                </div>

                <div className="field-group">
                  <label htmlFor="pipeSelect">Pipe (optional unless type is pipe)</label>
                  <select
                    id="pipeSelect"
                    value={selectedPipeId}
                    onChange={(event) => setSelectedPipeId(event.target.value)}
                    disabled={pipes.length === 0}
                  >
                    <option value="">No specific pipe</option>
                    {pipes
                      .filter((pipe): pipe is PipeRecord & { id: number } => typeof pipe.id === 'number')
                      .map((pipe) => (
                        <option key={pipe.id} value={String(pipe.id)}>
                          {pipe.pipe_number}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <CameraCapture
                id="newPhoto"
                label="Photo File"
                file={newPhotoFile}
                onFileChange={setNewPhotoFile}
                required
              />

              {successMessage ? <p className="message success">{successMessage}</p> : null}

              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Add Photo'}
              </button>
            </form>
          </section>
        </>
      ) : null}
    </section>
  )
}
