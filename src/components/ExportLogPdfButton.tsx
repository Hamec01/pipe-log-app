import { useState } from 'react'
import { generateLogPdf } from '../services/pdfReportService'

interface ExportLogPdfButtonProps {
  logId: number
}

export function ExportLogPdfButton({ logId }: ExportLogPdfButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const onExport = async () => {
    try {
      setIsExporting(true)
      await generateLogPdf(logId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not export PDF.'
      alert(message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button type="button" onClick={() => void onExport()} disabled={isExporting}>
      {isExporting ? 'Generating PDF...' : 'Export PDF Report'}
    </button>
  )
}
