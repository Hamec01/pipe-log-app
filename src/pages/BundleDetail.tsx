import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ExportBundleButton } from '../components/ExportBundleButton'
import {
  getBundleById,
  listBundleLogs,
  listBundlePipes,
  type SupabaseBundle,
  type SupabaseLogSummary,
} from '../services/supabaseBundleService'
import { deleteLog } from '../services/supabaseLogService'
import { getPhotosByLog } from '../services/supabasePhotoService'
import { listPipesByLog } from '../services/supabasePipeService'

interface LogCardView {
  log: SupabaseLogSummary
  pipeCount: number
  photoCount: number
}

export function BundleDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const bundleId = Number(id)

  const [bundle, setBundle] = useState<SupabaseBundle | null>(null)
  const [bundlePipes, setBundlePipes] = useState<Array<{ id: number; pipe_number: string }>>([])
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
        setBundlePipes([])
        setLogs([])
        setErrorMessage('Bundle not found.')
        return
      }

      const [pipes, logRows] = await Promise.all([listBundlePipes(bundleId), listBundleLogs(bundleId)])

      const views: LogCardView[] = []
      for (const log of logRows) {
        if (typeof log.id !== 'number') {
          continue
        }

        const [linkedPipes, photos] = await Promise.all([listPipesByLog(log.id), getPhotosByLog(log.id)])

        views.push({
          log,
          pipeCount: linkedPipes.length,
          photoCount: photos.length,
        })
      }

      setBundle(bundleRow)
      setBundlePipes(pipes)
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

          <section className="group-section">
            <h3>Pipes in Bundle</h3>
            {bundlePipes.length === 0 ? <p className="muted">No pipes linked to this bundle yet.</p> : null}
            <div className="card-grid">
              {bundlePipes.map((pipe) => (
                <article key={pipe.id ?? pipe.pipe_number} className="card">
                  <h4 className="card-title">{pipe.pipe_number}</h4>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <section className="group-section">
        <h3>Related Logs</h3>
        {!isLoading && !errorMessage && logs.length === 0 ? <p className="muted">This bundle has no related logs yet.</p> : null}
        <div className="card-grid">
          {logs.map((item) => (
            <article key={item.log.id} className="card">
              <h4 className="card-title">Log {item.log.log_number}</h4>
              <p className="muted">Pressure: {item.log.pressure_bar} bar</p>
              <p className="muted">Date: {new Date(item.log.date_time).toLocaleString()}</p>
              <p className="muted">Pipes: {item.pipeCount} | Photos: {item.photoCount}</p>
              {item.log.notes ? <p>{item.log.notes}</p> : null}
              <div className="card-actions">
                <Link to={`/log/${item.log.id}`} className="button-link">Open Log</Link>
                <button type="button" className="button-danger" onClick={() => void onDeleteLog(item.log.id)}>
                  Delete Log
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
