import { useEffect, useMemo, useRef, useState } from 'react'

interface CameraCaptureProps {
  id: string
  label: string
  file: File | null
  onFileChange: (file: File | null) => void
  required?: boolean
  removeLabel?: string
}

export function CameraCapture({
  id,
  label,
  file,
  onFileChange,
  required = false,
  removeLabel = 'Remove Photo',
}: CameraCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous)
        }
        return null
      })
      return
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return url
    })

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  const fileInfo = useMemo(() => {
    if (!file) {
      return 'No file selected'
    }

    const sizeKb = (file.size / 1024).toFixed(1)
    return `${file.name} (${sizeKb} KB)`
  }, [file])

  const handleSelectedFile = (selected: File | null) => {
    onFileChange(selected)

    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
    }

    if (galleryInputRef.current) {
      galleryInputRef.current.value = ''
    }
  }

  const removeFile = () => {
    handleSelectedFile(null)
  }

  return (
    <div className="field-group">
      <label>{label}</label>
      <div className="card-actions">
        <button type="button" onClick={() => cameraInputRef.current?.click()}>
          Take Photo
        </button>
        <button type="button" onClick={() => galleryInputRef.current?.click()}>
          Choose Existing Image
        </button>
      </div>
      <input
        id={`${id}-camera`}
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        required={required && !file}
        style={{ display: 'none' }}
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null
          handleSelectedFile(selected)
        }}
      />
      <input
        id={`${id}-gallery`}
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        required={required && !file}
        style={{ display: 'none' }}
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null
          handleSelectedFile(selected)
        }}
      />
      <small className="muted">{fileInfo}</small>

      {previewUrl ? (
        <img
          src={previewUrl}
          alt={`${label} preview`}
          style={{ width: '100%', maxWidth: '260px', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}
        />
      ) : null}

      {file ? (
        <button type="button" className="button-danger" onClick={removeFile}>
          {removeLabel}
        </button>
      ) : null}
    </div>
  )
}
