import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BundlePipeGroupEditor, type BundlePipeGroupDraft } from '../components/BundlePipeGroupEditor'
import { CameraCapture } from '../components/CameraCapture'
import type { SupabaseBundle } from '../services/supabaseBundleService'
import { listBundles } from '../services/supabaseBundleService'
import { createLogWithBundleGroupsAndPhotos } from '../services/supabaseLogService'
import { extractPressureFromImage } from '../services/ocrService'
import { dateTimeLocalToIso, nowDateTimeLocalValue } from '../utils/date'
import { parsePipeNumbers } from '../utils/pipeParser'

interface FormState {
  logNumber: string
  pressureBar: string
  dateTimeLocal: string
  notes: string
}

const INITIAL_FORM: FormState = {
  logNumber: '',
  pressureBar: '',
  dateTimeLocal: nowDateTimeLocalValue(),
  notes: '',
}

function createEmptyGroup(): BundlePipeGroupDraft {
  return {
    id: crypto.randomUUID(),
    bundleNumber: '',
    pipesRaw: '',
  }
}

export function CreateLogPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [groups, setGroups] = useState<BundlePipeGroupDraft[]>([createEmptyGroup()])
  const [bundles, setBundles] = useState<SupabaseBundle[]>([])
  const [gaugePhotoFile, setGaugePhotoFile] = useState<File | null>(null)
  const [sitePhotoFile, setSitePhotoFile] = useState<File | null>(null)
  const [isDetectingPressure, setIsDetectingPressure] = useState(false)
  const [pressureHint, setPressureHint] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const ocrRequestRef = useRef(0)

  const bundleSuggestions = useMemo(() => bundles.map((bundle) => bundle.bundle_number), [bundles])

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

  const updateGroup = (groupId: string, patch: Partial<BundlePipeGroupDraft>) => {
    setGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, ...patch } : group)))
  }

  const addGroup = () => {
    setGroups((prev) => [...prev, createEmptyGroup()])
  }

  const removeGroup = (groupId: string) => {
    setGroups((prev) => {
      if (prev.length <= 1) {
        return prev
      }
      return prev.filter((group) => group.id !== groupId)
    })
  }

  const resetForm = () => {
    setForm({ ...INITIAL_FORM, dateTimeLocal: nowDateTimeLocalValue() })
    setGroups([createEmptyGroup()])
    setGaugePhotoFile(null)
    setSitePhotoFile(null)
    setIsDetectingPressure(false)
    setPressureHint(null)
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

    const logNumber = form.logNumber.trim()
    const pressureBar = Number(form.pressureBar)
    const dateTimeIso = dateTimeLocalToIso(form.dateTimeLocal)

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

    if (!gaugePhotoFile) {
      setErrorMessage('Gauge photo is required.')
      return
    }

    const parsedGroups = groups.map((group) => ({
      bundleNumber: group.bundleNumber.trim(),
      pipeNumbers: parsePipeNumbers(group.pipesRaw),
    }))

    if (parsedGroups.some((group) => !group.bundleNumber)) {
      setErrorMessage('Each group must have a bundle number.')
      return
    }

    if (parsedGroups.some((group) => group.pipeNumbers.length === 0)) {
      setErrorMessage('Each group must include at least one pipe.')
      return
    }

    try {
      setIsSaving(true)
      const result = await createLogWithBundleGroupsAndPhotos({
        logNumber,
        pressureBar,
        dateTimeIso,
        notes: form.notes,
        bundleGroups: parsedGroups,
        gaugePhotoFile,
        sitePhotoFile: sitePhotoFile ?? undefined,
      })

      setSuccessMessage(`Log ${result.log.log_number} saved successfully.`)
      resetForm()

      const rows = await listBundles()
      setBundles(rows)
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Could not save log.'
      const message = rawMessage.startsWith('Failed at step:')
        ? rawMessage
        : 'Failed at step: create log flow'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="page">
      <h2>Create Log</h2>
      <p className="muted">One log can include pipes from multiple bundles.</p>

      <form className="entry-form" onSubmit={handleSubmit}>
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

        <div className="card-actions">
          <button type="button" onClick={addGroup}>Add Bundle Group</button>
        </div>

        {groups.map((group, index) => (
          <BundlePipeGroupEditor
            key={group.id}
            index={index}
            group={group}
            bundleSuggestions={bundleSuggestions}
            canRemove={groups.length > 1}
            onBundleChange={(groupId, bundleNumber) => updateGroup(groupId, { bundleNumber })}
            onPipesChange={(groupId, pipesRaw) => updateGroup(groupId, { pipesRaw })}
            onRemove={removeGroup}
          />
        ))}

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

        {errorMessage ? <p className="message error">{errorMessage}</p> : null}
        {successMessage ? <p className="message success">{successMessage}</p> : null}

        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Log'}
        </button>
      </form>
    </section>
  )
}
