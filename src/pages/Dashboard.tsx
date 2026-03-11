import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SearchAllResult } from '../services/supabaseSearchService'
import { searchAll } from '../services/supabaseSearchService'

interface FilterState {
  pressureMin: string
  pressureMax: string
  dateFrom: string
  dateTo: string
}

const INITIAL_FILTERS: FilterState = {
  pressureMin: '',
  pressureMax: '',
  dateFrom: '',
  dateTo: '',
}

function toIsoOrUndefined(value: string): string | undefined {
  if (!value) {
    return undefined
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function toNumberOrUndefined(value: string): number | undefined {
  if (!value.trim()) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export function DashboardPage() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)
  const [results, setResults] = useState<SearchAllResult>({ bundles: [], logs: [], pipes: [] })
  const [isSearching, setIsSearching] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      const run = async () => {
        setErrorMessage(null)

        const hasQuery = query.trim().length > 0
        const hasFilter =
          Boolean(filters.dateFrom) ||
          Boolean(filters.dateTo) ||
          Boolean(filters.pressureMin.trim()) ||
          Boolean(filters.pressureMax.trim())

        if (!hasQuery && !hasFilter) {
          setResults({ bundles: [], logs: [], pipes: [] })
          return
        }

        try {
          setIsSearching(true)
          const next = await searchAll(query, {
            pressureMin: toNumberOrUndefined(filters.pressureMin),
            pressureMax: toNumberOrUndefined(filters.pressureMax),
            dateFromIso: toIsoOrUndefined(filters.dateFrom),
            dateToIso: toIsoOrUndefined(filters.dateTo),
          })
          setResults(next)
        } catch {
          setErrorMessage('Search failed.')
        } finally {
          setIsSearching(false)
        }
      }

      void run()
    }, 300)

    return () => clearTimeout(timer)
  }, [query, filters])

  return (
    <section className="page">
      <h2>Dashboard</h2>

      <div className="field-group">
        <label htmlFor="globalSearch">Search</label>
        <input
          id="globalSearch"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Bundle / Log / Pipe"
        />
      </div>

      <div className="field-row field-row-2">
        <div className="field-group">
          <label htmlFor="dateFrom">Date From</label>
          <input
            id="dateFrom"
            type="datetime-local"
            value={filters.dateFrom}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
          />
        </div>

        <div className="field-group">
          <label htmlFor="dateTo">Date To</label>
          <input
            id="dateTo"
            type="datetime-local"
            value={filters.dateTo}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
          />
        </div>
      </div>

      <div className="field-row field-row-2">
        <div className="field-group">
          <label htmlFor="pressureMin">Pressure Min (bar)</label>
          <input
            id="pressureMin"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={filters.pressureMin}
            onChange={(event) => setFilters((prev) => ({ ...prev, pressureMin: event.target.value }))}
          />
        </div>

        <div className="field-group">
          <label htmlFor="pressureMax">Pressure Max (bar)</label>
          <input
            id="pressureMax"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={filters.pressureMax}
            onChange={(event) => setFilters((prev) => ({ ...prev, pressureMax: event.target.value }))}
          />
        </div>
      </div>

      {isSearching ? <p className="muted">Searching...</p> : null}
      {errorMessage ? <p className="message error">{errorMessage}</p> : null}

      <section className="group-section">
        <h3>Bundles</h3>
        {results.bundles.length === 0 ? <p className="muted">No bundle matches.</p> : null}
        <div className="card-grid">
          {results.bundles.map((bundle) => (
            <article className="card" key={bundle.id}>
              <h4 className="card-title">Bundle {bundle.bundle_number}</h4>
              <p className="muted">Pipes: {bundle.pipes.map((pipe) => pipe.pipe_number).join(', ') || 'None'}</p>
              <p className="muted">Logs: {bundle.logs.map((log) => log.log_number).join(', ') || 'None'}</p>
              <Link to={`/bundle/${bundle.id}`} className="button-link">Open</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="group-section">
        <h3>Logs</h3>
        {results.logs.length === 0 ? <p className="muted">No log matches.</p> : null}
        <div className="card-grid">
          {results.logs.map((log) => (
            <article className="card" key={log.id}>
              <h4 className="card-title">{log.log_number} - {log.pressure_bar} bar</h4>
              <p className="muted">Date: {formatDateTime(log.date_time)}</p>
              <p className="muted">Bundles: {log.bundles.map((bundle) => bundle.bundle_number).join(', ') || 'None'}</p>
              <p className="muted">Pipes: {log.pipes.map((pipe) => pipe.pipe_number).join(', ') || 'None'}</p>
              <p className="muted">Photos: {log.photo_count}</p>
              <Link to={`/log/${log.id}`} className="button-link">Open Log</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="group-section">
        <h3>Pipes</h3>
        {results.pipes.length === 0 ? <p className="muted">No pipe matches.</p> : null}
        <div className="card-grid">
          {results.pipes.map((pipe) => (
            <article className="card" key={pipe.id}>
              <h4 className="card-title">{pipe.pipe_number}</h4>
              <p className="muted">Bundles: {pipe.bundles.map((bundle) => bundle.bundle_number).join(', ') || 'None'}</p>
              <p className="muted">Logs: {pipe.logs.map((log) => log.log_number).join(', ') || 'None'}</p>
              <p className="muted">Log Photos: {pipe.photos.map((photo) => `${photo.type}:${photo.file_name}`).join(', ') || 'None'}</p>
              {pipe.logs[0] ? (
                <Link to={`/log/${pipe.logs[0].id}`} className="button-link">Open Related Log</Link>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
