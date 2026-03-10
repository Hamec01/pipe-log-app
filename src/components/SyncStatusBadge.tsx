import type { SyncStatus } from '../models/types'

interface SyncStatusBadgeProps {
  status: SyncStatus
}

const LABELS: Record<SyncStatus, string> = {
  local: 'Local',
  synced: 'Synced',
  modified: 'Modified',
  deleted: 'Deleted',
}

const COLORS: Record<SyncStatus, string> = {
  local: 'var(--color-info)',
  synced: 'var(--color-success)',
  modified: 'var(--color-warning)',
  deleted: 'var(--color-danger)',
}

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.2rem 0.5rem',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 700,
        color: '#fff',
        backgroundColor: COLORS[status],
      }}
    >
      {LABELS[status]}
    </span>
  )
}
