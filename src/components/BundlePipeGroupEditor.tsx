import { useMemo } from 'react'
import { parsePipeNumbers } from '../utils/pipeParser'
import { PipeList } from './PipeList'

export interface BundlePipeGroupDraft {
  id: string
  bundleNumber: string
  pipesRaw: string
}

interface BundlePipeGroupEditorProps {
  index: number
  group: BundlePipeGroupDraft
  bundleSuggestions: string[]
  canRemove: boolean
  onBundleChange: (groupId: string, bundleNumber: string) => void
  onPipesChange: (groupId: string, pipesRaw: string) => void
  onRemove: (groupId: string) => void
}

export function BundlePipeGroupEditor({
  index,
  group,
  bundleSuggestions,
  canRemove,
  onBundleChange,
  onPipesChange,
  onRemove,
}: BundlePipeGroupEditorProps) {
  const parsedPipes = useMemo(() => parsePipeNumbers(group.pipesRaw), [group.pipesRaw])

  return (
    <section className="group-section">
      <h3>Bundle Group {index + 1}</h3>

      <div className="field-group">
        <label htmlFor={`bundle-${group.id}`}>Bundle Number</label>
        <input
          id={`bundle-${group.id}`}
          list={`bundle-options-${group.id}`}
          value={group.bundleNumber}
          onChange={(event) => onBundleChange(group.id, event.target.value)}
          placeholder="Example: 111304"
          required
        />
        <datalist id={`bundle-options-${group.id}`}>
          {bundleSuggestions.map((bundleNumber) => (
            <option key={`${group.id}-${bundleNumber}`} value={bundleNumber} />
          ))}
        </datalist>
      </div>

      <div className="field-group">
        <label htmlFor={`pipes-${group.id}`}>Pipe Numbers</label>
        <textarea
          id={`pipes-${group.id}`}
          rows={5}
          value={group.pipesRaw}
          onChange={(event) => onPipesChange(group.id, event.target.value)}
          placeholder="Use newline, comma, or space separators"
          required
        />
        <small className="muted">
          Unique pipes found: <strong>{parsedPipes.length}</strong>
        </small>
      </div>

      <div className="preview-box">
        <h4>Pipe Preview</h4>
        <PipeList pipes={parsedPipes} />
      </div>

      <div className="card-actions">
        <button type="button" className="button-danger" disabled={!canRemove} onClick={() => onRemove(group.id)}>
          Remove Group
        </button>
      </div>
    </section>
  )
}
