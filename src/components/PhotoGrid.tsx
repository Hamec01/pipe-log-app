import type { PhotoKind } from '../models/types'

export interface PhotoGridItem {
  id: number
  kind: PhotoKind
  url: string
  fileName: string
  pipeNumber?: string
}

interface PhotoGridProps {
  photos: PhotoGridItem[]
  onDeletePhoto?: (photoId: number) => Promise<void> | void
}

export function PhotoGrid({ photos, onDeletePhoto }: PhotoGridProps) {
  if (photos.length === 0) {
    return <p className="muted">No photos yet.</p>
  }

  return (
    <div className="photo-grid">
      {photos.map((photo) => (
        <figure key={photo.id} className="photo-card">
          <img src={photo.url} alt={`${photo.kind} ${photo.fileName}`} loading="lazy" />
          <figcaption>
            <strong>{photo.kind.toUpperCase()}</strong>
            {photo.pipeNumber ? <span> | Pipe: {photo.pipeNumber}</span> : null}
            <div className="muted">{photo.fileName}</div>
            {onDeletePhoto ? (
              <button
                type="button"
                className="button-danger"
                onClick={() => void onDeletePhoto(photo.id)}
              >
                Delete Photo
              </button>
            ) : null}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
