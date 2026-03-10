import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ExportBundleButton } from '../components/ExportBundleButton'
import { LogCard } from '../components/LogCard'
import type { BundleRecord } from '../models/types'
import { getBundleById } from '../services/bundleService'
import { deleteLog, getLogsByBundle } from '../services/logService'
import { listPhotosByLogId } from '../services/photoService'
import { listPipesByLogId } from '../services/pipeService'

interface LogCardView {
  id: number
  logNumber: string
  pressureBar: number
  dateTime: string
  notes?: string
  createdAt: string
  updatedAt: string
  syncStatus: 'local' | 'synced' | 'modified' | 'deleted'
  pipeCount: number
  photoCount: number
}

type GroupedLogs = Record<string, LogCardView[]>

function groupByDate(logs: LogCardView[]): GroupedLogs {
  const groups: GroupedLogs = {}
  for (const log of logs) {
    const day = log.dateTime.split('T')[0] || 'Unknown'
    const list = groups[day] ?? []
    list.push(log)
    groups[day] = list
  }
  return groups
}

export function BundleDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const bundleId = Number(id)

  const [bundle, setBundle] = useState<BundleRecord | null>(null)
  const [logs, setLogs] = useState<LogCardView[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadBundle = async () => {
    if (!Number.isFinite(bundleId)) {
      setErrorMessage('Invalid bundle ID.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const bundleRow = await getBundleById(bundleId)
      if (!bundleRow) {
        setBundle(null)
        setLogs([])
        setErrorMessage('Bundle not found.')
        return
      }

      const logRows = await getLogsByBundle(bundleId)
      const views: LogCardView[] = []

      for (const log of logRows) {
        if (typeof log.id !== 'number') {
          continue
        }

        const [pipes, photos] = await Promise.all([
          listPipesByLogId(log.id),
          listPhotosByLogId(log.id),
        ])

        views.push({
          id: log.id,
          logNumber: log.log_number,
          pressureBar: log.pressure_bar,
          dateTime: log.date_time,
          notes: log.notes,
          createdAt: log.created_at,
          updatedAt: log.updated_at,
          syncStatus: log.sync_status,
          pipeCount: pipes.length,
          photoCount: photos.length,
        })
      }

      setBundle(bundleRow)
      setLogs(views)
    } catch {
      setErrorMessage('Could not load bundle details.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadBundle()
  }, [bundleId])

  const groupedLogs = useMemo(() => groupByDate(logs), [logs])
  const orderedDays = useMemo(() => Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a)), [groupedLogs])

  const onDeleteLog = async (logId: number) => {
    const ok = confirm('Are you sure you want to delete this item?')
    if (!ok) {
      return
    }

    try {
      await deleteLog(logId)
      await loadBundle()
    } catch {
      alert('Failed to delete log.')
    }
  }

  return (
    <section className="page">
      <h2>Bundle Detail</h2>
      <p>
        <Link to="/bundles">Back to Bundles</Link>
      </p>

      {isLoading ? <p className="muted">Loading bundle...</p> : null}
      {errorMessage ? <p className="message error">{errorMessage}</p> : null}

      {bundle ? (
        <>
          <p className="muted">Bundle Number: {bundle.bundle_number}</p>
          <div className="quick-links">
            <button type="button" onClick={() => navigate('/create-log')}>Create Log</button>
          </div>
          {typeof bundle.id === 'number' ? <ExportBundleButton bundleId={bundle.id} /> : null}
        </>
      ) : null}

      {!isLoading && !errorMessage && logs.length === 0 ? <p className="muted">This bundle has no logs yet.</p> : null}

      {orderedDays.map((day) => (
        <section key={day} className="group-section">
          <h3>{day}</h3>
          <div className="card-grid">
            {groupedLogs[day].map((log) => (
              <LogCard
                key={log.id}
                log={{
                  id: log.id,
                  bundle_id: bundleId,
                  log_number: log.logNumber,
                  pressure_bar: log.pressureBar,
                  date_time: log.dateTime,
                  notes: log.notes,
                  created_at: log.createdAt,
                  updated_at: log.updatedAt,
                  deleted_at: null,
                  sync_status: log.syncStatus,
                }}
                pipesCount={log.pipeCount}
                photosCount={log.photoCount}
                onDelete={onDeleteLog}
              />
            ))}
          </div>
        </section>
      ))}
    </section>
  )
}
