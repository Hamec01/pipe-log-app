export function sanitizePipeNumber(pipeNumber: string): string {
  return pipeNumber.replaceAll('/', '-').replaceAll(' ', '')
}

function twoDigit(value: number): string {
  return String(value).padStart(2, '0')
}

export function buildPhotoExportName(params: {
  bundleNumber: string
  logNumber: string
  kind: 'gauge' | 'site' | 'pipe'
  order: number
  pipeNumber?: string
  sourceFileName: string
  mimeType: string
}): string {
  const { bundleNumber, logNumber, kind, order, pipeNumber } = params
  const extension = 'jpg'

  if (kind === 'pipe') {
    const safePipe = sanitizePipeNumber(pipeNumber ?? 'unknown')
    return `bundle_${bundleNumber}__log_${logNumber}__pipe_${safePipe}__${twoDigit(order)}.${extension}`
  }

  return `bundle_${bundleNumber}__log_${logNumber}__${kind}__${twoDigit(order)}.${extension}`
}
