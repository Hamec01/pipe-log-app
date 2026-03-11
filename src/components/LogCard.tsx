import { Link } from 'react-router-dom'
import type { LogRecord } from '../models/types'
import { SyncStatusBadge } from './SyncStatusBadge'

interface LogCardProps {
  log: LogRecord
  pipesCount: number
  photosCount: number
  onDelete: (logId: number) => Promise<void> | void
}

function formatDateTime(isoValue: string): string {
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) {
    return isoValue
  }

  return date.toLocaleString()
}

export function LogCard({ log, pipesCount, photosCount, onDelete }: LogCardProps) {
  return (
    <article className="card">
      <h3 className="card-title">Log {log.log_number}</h3>
      <p className="muted">Pressure: {log.pressure_bar} bar</p>
      <p className="muted">Date: {formatDateTime(log.date_time)}</p>
      <p className="muted">Pipes: {pipesCount} | Photos: {photosCount}</p>
      {log.notes ? <p>{log.notes}</p> : null}
      <SyncStatusBadge status={log.sync_status ?? 'local'} />
      {typeof log.id === 'number' ? (
        <div className="card-actions">
          <Link to={`/log/${log.id}`} className="button-link">Open Log</Link>
          <button type="button" className="button-danger" onClick={() => void onDelete(log.id as number)}>
            Delete Log
          </button>
        </div>
      ) : null}
    </article>
  )
}
