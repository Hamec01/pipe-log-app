import { useEffect, useState, type FormEvent } from 'react'
import { BundleCard } from '../components/BundleCard'
import { createBundleIfNotExists, deleteBundle, getAllBundles } from '../services/bundleService'
import { getLogsByBundle } from '../services/logService'

interface BundleView {
  id: number
  bundleNumber: string
  createdAt: string
  syncStatus: 'local' | 'synced' | 'modified' | 'deleted'
  logsCount: number
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
      const rows = await getAllBundles()

      const views = await Promise.all(
        rows
          .filter((bundle): bundle is typeof bundle & { id: number } => typeof bundle.id === 'number')
          .map(async (bundle) => {
            const logs = await getLogsByBundle(bundle.id)
            return {
              id: bundle.id,
              bundleNumber: bundle.bundle_number,
              createdAt: bundle.created_at,
              syncStatus: bundle.sync_status,
              logsCount: logs.length,
            }
          }),
      )

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
      const created = await createBundleIfNotExists(bundleNumber)
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
          <BundleCard
            key={bundle.id}
            id={bundle.id}
            bundleNumber={bundle.bundleNumber}
            logsCount={bundle.logsCount}
            createdAt={bundle.createdAt}
            syncStatus={bundle.syncStatus}
            onDelete={onDeleteBundle}
          />
        ))}
      </div>
    </section>
  )
}
