import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CameraCapture } from '../components/CameraCapture'
import { ExportLogPdfButton } from '../components/ExportLogPdfButton'
import { PhotoGrid, type PhotoGridItem } from '../components/PhotoGrid'
import { deleteLog, getBundleGroupsForLog, getLogById, type SupabaseLog } from '../services/supabaseLogService'
import { deletePhoto, getPhotoUrl, getPhotosByLog, uploadPhoto, type SupabasePhoto } from '../services/supabasePhotoService'
import type { PhotoKind } from '../models/types'

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

  const [log, setLog] = useState<SupabaseLog | null>(null)
  const [groups, setGroups] = useState<Array<{ bundleId: number; bundleNumber: string; pipeNumbers: string[] }>>([])
  const [photos, setPhotos] = useState<SupabasePhoto[]>([])
  const [photoKind, setPhotoKind] = useState<PhotoKind>('site')
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const photoGridItems = useMemo<PhotoGridItem[]>(() => {
    return photos
      .map((photo) => ({
        id: photo.id,
        kind: photo.type,
        fileName: photo.file_name,
        url: getPhotoUrl(photo),
      }))
  }, [photos])

  const loadData = async () => {
    if (!Number.isFinite(logId)) {
      setErrorMessage('Invalid log ID.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [logRow, groupsRow, photoRows] = await Promise.all([
        getLogById(logId),
        getBundleGroupsForLog(logId),
        getPhotosByLog(logId),
      ])

      if (!logRow) {
        setLog(null)
        setGroups([])
        setPhotos([])
        setErrorMessage('Log not found.')
        return
      }

      setLog(logRow)
      setGroups(groupsRow)
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

    try {
      setIsSaving(true)
      await uploadPhoto({
        logId,
        file: newPhotoFile,
        type: photoKind,
      })

      setSuccessMessage('Photo saved.')
      setNewPhotoFile(null)
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
      <p>
        <Link to="/">Back to Dashboard</Link>
      </p>

      {isLoading ? <p className="muted">Loading log...</p> : null}
      {errorMessage ? <p className="message error">{errorMessage}</p> : null}

      {log ? (
        <>
          <div className="card">
            <h3 className="card-title">Log {log.log_number}</h3>
            <p className="muted">Pressure: {log.pressure_bar} bar</p>
            <p className="muted">Date: {formatDateTime(log.date_time)}</p>
            {log.notes ? <p>{log.notes}</p> : null}
            <div className="card-actions">
              <ExportLogPdfButton logId={logId} />
            </div>
          </div>

          <section className="group-section">
            <h3>Pipes Grouped by Bundle</h3>
            {groups.length === 0 ? <p className="muted">No pipes linked to this log.</p> : null}
            <div className="card-grid">
              {groups.map((group) => (
                <article className="card" key={group.bundleId || group.bundleNumber}>
                  <h4 className="card-title">Bundle {group.bundleNumber}</h4>
                  <p className="muted">Pipes: {group.pipeNumbers.join(', ') || 'None'}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="group-section">
            <h3>Photos</h3>
            <PhotoGrid photos={photoGridItems} onDeletePhoto={onDeletePhoto} />
            <div className="card-actions" style={{ marginTop: '0.75rem' }}>
              <button type="button" className="button-danger" onClick={() => void deleteLog(logId)}>
                Delete Log
              </button>
            </div>
          </section>

          <section className="group-section">
            <h3>Add Photo</h3>
            <form className="entry-form" onSubmit={onAddPhoto}>
              <div className="field-group">
                <label htmlFor="photoKind">Photo Type</label>
                <select
                  id="photoKind"
                  value={photoKind}
                  onChange={(event) => setPhotoKind(event.target.value as PhotoKind)}
                >
                  <option value="site">site</option>
                  <option value="gauge">gauge</option>
                </select>
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
