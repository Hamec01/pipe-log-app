import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CameraCapture } from '../components/CameraCapture'
import { PipeList } from '../components/PipeList'
import type { BundleRecord } from '../models/types'
import { db } from '../db/db'
import { getOrCreateBundleByNumber, listBundles } from '../services/bundleService'
import { createLogWithPipesAndPhotos } from '../services/logService'
import { extractPressureFromImage } from '../services/ocrService'
import { dateTimeLocalToIso, nowDateTimeLocalValue } from '../utils/date'
import { parsePipeNumbers } from '../utils/pipeParser'

interface FormState {
  bundleNumber: string
  logNumber: string
  pressureBar: string
  dateTimeLocal: string
  notes: string
  pipesRaw: string
}

const INITIAL_FORM: FormState = {
  bundleNumber: '',
  logNumber: '',
  pressureBar: '',
  dateTimeLocal: nowDateTimeLocalValue(),
  notes: '',
  pipesRaw: '',
}

export function CreateLogPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [bundles, setBundles] = useState<BundleRecord[]>([])
  const [gaugePhotoFile, setGaugePhotoFile] = useState<File | null>(null)
  const [sitePhotoFile, setSitePhotoFile] = useState<File | null>(null)
  const [isDetectingPressure, setIsDetectingPressure] = useState(false)
  const [pressureHint, setPressureHint] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const ocrRequestRef = useRef(0)

  const parsedPipes = useMemo(() => parsePipeNumbers(form.pipesRaw), [form.pipesRaw])

  useEffect(() => {
    const loadBundles = async () => {
      try {
        const rows = await listBundles()
        setBundles(rows)
      } catch {
        setErrorMessage('Could not load bundle list.')
      }
    }

    void loadBundles()
  }, [])

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setForm({
      ...INITIAL_FORM,
      dateTimeLocal: nowDateTimeLocalValue(),
    })
    setGaugePhotoFile(null)
    setSitePhotoFile(null)
    setIsDetectingPressure(false)
    setPressureHint(null)
  }

  const onResetLocalDatabase = async () => {
    const ok = confirm('Reset local database?')
    if (!ok) {
      return
    }

    await db.delete()
    window.location.reload()
  }

  const handleGaugePhotoChange = async (file: File | null) => {
    setGaugePhotoFile(file)
    setPressureHint(null)

    if (!file) {
      return
    }

    const requestId = ocrRequestRef.current + 1
    ocrRequestRef.current = requestId

    try {
      setIsDetectingPressure(true)
      const detected = await extractPressureFromImage(file)

      // Ignore stale OCR results when user selected another file.
      if (ocrRequestRef.current !== requestId) {
        return
      }

      if (typeof detected === 'number') {
        setField('pressureBar', String(detected))
        setPressureHint(`Detected pressure: ${detected} bar`)
      } else {
        setPressureHint('Pressure not detected. You can enter it manually.')
      }
    } catch {
      if (ocrRequestRef.current === requestId) {
        setPressureHint('OCR failed. You can enter pressure manually.')
      }
    } finally {
      if (ocrRequestRef.current === requestId) {
        setIsDetectingPressure(false)
      }
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSaving) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)

    const bundleNumber = form.bundleNumber.trim()
    const logNumber = form.logNumber.trim()
    const pressureBar = Number(form.pressureBar)
    const dateTimeIso = dateTimeLocalToIso(form.dateTimeLocal)

    if (!bundleNumber) {
      setErrorMessage('Bundle number is required.')
      return
    }

    if (!logNumber) {
      setErrorMessage('Log number is required.')
      return
    }

    if (!Number.isFinite(pressureBar)) {
      setErrorMessage('Pressure must be a valid number.')
      return
    }

    if (Number.isNaN(new Date(dateTimeIso).getTime())) {
      setErrorMessage('Date/time is invalid.')
      return
    }

    if (parsedPipes.length === 0) {
      setErrorMessage('Add at least one pipe number.')
      return
    }

    if (!gaugePhotoFile) {
      setErrorMessage('Gauge photo is required.')
      return
    }

    try {
      setIsSaving(true)

      // 1) Create or reuse bundle
      const bundle = await getOrCreateBundleByNumber(bundleNumber)
      if (typeof bundle.id !== 'number') {
        throw new Error('Bundle ID is missing.')
      }

      // 2) create log
      // 3) parse pipe numbers
      // 4) create or reuse pipes
      // 5) create log_pipes relations
      // 6) save gauge photo blob
      // 7) save optional site photo blob
      const result = await createLogWithPipesAndPhotos({
        bundle,
        logNumber,
        pressureBar,
        dateTimeIso,
        notes: form.notes,
        pipeNumbers: parsedPipes,
        gaugePhotoFile,
        sitePhotoFile: sitePhotoFile ?? undefined,
      })

      setSuccessMessage(`Log ${result.log.log_number} saved successfully.`)
      resetForm()

      const rows = await listBundles()
      setBundles(rows)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save log.'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="page">
      <h2>Create Log</h2>
      <p className="muted">Bundle to log to pipes to photos to save</p>
      {import.meta.env.DEV ? (
        <div className="card-actions" style={{ marginBottom: '0.75rem' }}>
          <button type="button" className="button-danger" onClick={() => void onResetLocalDatabase()}>
            Reset Local Database
          </button>
        </div>
      ) : null}

      <form className="entry-form" onSubmit={handleSubmit}>
        <div className="field-group">
          <label htmlFor="bundleNumber">Bundle Number</label>
          <input
            id="bundleNumber"
            list="bundle-options"
            value={form.bundleNumber}
            onChange={(event) => setField('bundleNumber', event.target.value)}
            placeholder="Example: 111304"
            required
          />
          <datalist id="bundle-options">
            {bundles.map((bundle) => (
              <option key={bundle.id ?? bundle.bundle_number} value={bundle.bundle_number} />
            ))}
          </datalist>
        </div>

        <div className="field-row">
          <div className="field-group">
            <label htmlFor="logNumber">Log Number</label>
            <input
              id="logNumber"
              value={form.logNumber}
              onChange={(event) => setField('logNumber', event.target.value)}
              placeholder="Example: LOG-014"
              required
            />
          </div>

          <div className="field-group">
            <label htmlFor="pressureBar">Pressure (bar)</label>
            <input
              id="pressureBar"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.pressureBar}
              onChange={(event) => setField('pressureBar', event.target.value)}
              placeholder="Example: 12.5"
              required
            />
          </div>
        </div>

        <div className="field-group">
          <label htmlFor="dateTime">Date and Time</label>
          <input
            id="dateTime"
            type="datetime-local"
            value={form.dateTimeLocal}
            onChange={(event) => setField('dateTimeLocal', event.target.value)}
            required
          />
        </div>

        <div className="field-group">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            rows={3}
            value={form.notes}
            onChange={(event) => setField('notes', event.target.value)}
            placeholder="Optional notes"
          />
        </div>

        <CameraCapture
          id="gaugePhoto"
          label="Gauge Photo (required)"
          file={gaugePhotoFile}
          onFileChange={(file) => {
            void handleGaugePhotoChange(file)
          }}
          removeLabel="Remove Gauge Photo"
          required
        />
        {isDetectingPressure ? <p className="muted">Detecting pressure...</p> : null}
        {pressureHint ? <p className="message success">{pressureHint}</p> : null}

        <CameraCapture
          id="sitePhoto"
          label="Site Photo (optional)"
          file={sitePhotoFile}
          onFileChange={setSitePhotoFile}
          removeLabel="Remove Site Photo"
        />

        <div className="field-group">
          <label htmlFor="pipesRaw">Pipe Numbers</label>
          <textarea
            id="pipesRaw"
            rows={5}
            value={form.pipesRaw}
            onChange={(event) => setField('pipesRaw', event.target.value)}
            placeholder="Use newline, comma, or space separators"
            required
          />
          <small className="muted">
            Unique pipes found: <strong>{parsedPipes.length}</strong>
          </small>
        </div>

        <div className="preview-box">
          <h3>Pipe Preview</h3>
          <PipeList pipes={parsedPipes} />
        </div>

        {errorMessage ? <p className="message error">{errorMessage}</p> : null}
        {successMessage ? <p className="message success">{successMessage}</p> : null}

        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Log'}
        </button>
      </form>
    </section>
  )
}
