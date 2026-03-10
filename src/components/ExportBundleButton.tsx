import { useState } from 'react'
import { exportBundleZip } from '../services/exportService'

interface ExportBundleButtonProps {
  bundleId: number
}

export function ExportBundleButton({ bundleId }: ExportBundleButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleExport = async () => {
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      setIsExporting(true)
      const result = await exportBundleZip(bundleId)
      setSuccessMessage(`Exported: ${result.fileName}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not export bundle.'
      setErrorMessage(message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="export-block">
      <button type="button" onClick={handleExport} disabled={isExporting}>
        {isExporting ? 'Exporting...' : 'Export Bundle'}
      </button>
      {errorMessage ? <p className="message error">{errorMessage}</p> : null}
      {successMessage ? <p className="message success">{successMessage}</p> : null}
    </div>
  )
}
