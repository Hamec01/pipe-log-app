import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  deleteBundle,
  getOrCreateBundleByNumber,
  listBundleSummaries,
} from '../services/supabaseBundleService'

interface BundleView {
  id: number
  bundleNumber: string
  createdAt: string
  pipesCount: number
  logsCount: number
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

export function BundlesPage() {
  const [bundleNumber, setBundleNumber] = useState('')
  const [bundles, setBundles] = useState<BundleView[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadBundles = async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const rows = await listBundleSummaries()
      const views = rows
        .filter((row) => typeof row.bundle.id === 'number')
        .map((row) => ({
          id: row.bundle.id as number,
          bundleNumber: row.bundle.bundle_number,
          createdAt: row.bundle.created_at,
          pipesCount: row.pipesCount,
          logsCount: row.logsCount,
        }))

      setBundles(views)
    } catch {
      setErrorMessage('Could not load bundles.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadBundles()
  }, [])

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      setIsSubmitting(true)
      const created = await getOrCreateBundleByNumber(bundleNumber)
      setSuccessMessage(`Bundle ${created.bundle_number} is ready.`)
      setBundleNumber('')
      await loadBundles()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create bundle.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const onDeleteBundle = async (bundleId: number) => {
    const ok = confirm('Are you sure you want to delete this item?')
    if (!ok) {
      return
    }

    try {
      await deleteBundle(bundleId)
      await loadBundles()
    } catch {
      alert('Failed to delete bundle.')
    }
  }

  return (
    <section className="page">
      <h2>Bundles</h2>

      <form className="entry-form" onSubmit={onCreate}>
        <div className="field-row">
          <div className="field-group">
            <label htmlFor="bundleNumber">New Bundle Number</label>
            <input
              id="bundleNumber"
              value={bundleNumber}
              onChange={(event) => setBundleNumber(event.target.value)}
              placeholder="Example: 111304"
              required
            />
          </div>
          <div className="field-group field-group-end">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Create Bundle'}
            </button>
          </div>
        </div>

        {errorMessage ? <p className="message error">{errorMessage}</p> : null}
        {successMessage ? <p className="message success">{successMessage}</p> : null}
      </form>

      {isLoading ? <p className="muted">Loading bundles...</p> : null}
      {!isLoading && bundles.length === 0 ? <p className="muted">No bundles yet.</p> : null}

      <div className="card-grid">
        {bundles.map((bundle) => (
          <article key={bundle.id} className="card">
            <h3 className="card-title">Bundle {bundle.bundleNumber}</h3>
            <p className="muted">Pipes: {bundle.pipesCount}</p>
            <p className="muted">Related Logs: {bundle.logsCount}</p>
            <p className="muted">Created: {formatDateTime(bundle.createdAt)}</p>
            <div className="card-actions">
              <Link to={`/bundle/${bundle.id}`} className="button-link">Open</Link>
              <button type="button" className="button-danger" onClick={() => void onDeleteBundle(bundle.id)}>
                Delete Bundle
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
