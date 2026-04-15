export function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / 1024).toFixed(1) + ' KB'
}

// Returns the actual rendered bounds of the image content inside an <img> element,
// accounting for object-fit letterboxing.
export function getImageRect(img: HTMLImageElement): DOMRect {
  const c = img.getBoundingClientRect()
  const natRatio = img.naturalWidth / img.naturalHeight
  const containerRatio = c.width / c.height
  let rW: number, rH: number
  if (natRatio > containerRatio) {
    rW = c.width
    rH = c.width / natRatio
  } else {
    rH = c.height
    rW = c.height * natRatio
  }
  return new DOMRect(c.left + (c.width - rW) / 2, c.top + (c.height - rH) / 2, rW, rH)
}
