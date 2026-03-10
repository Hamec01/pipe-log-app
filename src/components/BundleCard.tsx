import { Link } from 'react-router-dom'
import { SyncStatusBadge } from './SyncStatusBadge'
import type { SyncStatus } from '../models/types'

interface BundleCardProps {
  id: number
  bundleNumber: string
  logsCount: number
  createdAt: string
  syncStatus: SyncStatus
  onDelete: (bundleId: number) => Promise<void> | void
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

export function BundleCard({ id, bundleNumber, logsCount, createdAt, syncStatus, onDelete }: BundleCardProps) {
  return (
    <article className="card">
      <h3 className="card-title">Bundle {bundleNumber}</h3>
      <SyncStatusBadge status={syncStatus} />
      <p className="muted">Logs: {logsCount}</p>
      <p className="muted">Created: {formatDateTime(createdAt)}</p>
      <div className="card-actions">
        <Link to={`/bundle/${id}`} className="button-link">Open</Link>
        <button type="button" className="button-danger" onClick={() => void onDelete(id)}>
          Delete Bundle
        </button>
      </div>
    </article>
  )
}
