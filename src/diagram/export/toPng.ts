/**
 * Растеризация SVG -> PNG.
 *
 * Схема: SVG-строка (со вшитым шрифтом) -> Blob URL -> Image -> canvas -> PNG-блоб.
 * html-to-image/dom-to-image не нужны: мы рендерим SVG сами, лишний слой не требуется.
 */

export interface PngOptions {
  /** масштаб: 2 = retina-качество по умолчанию */
  scale?: number
  /** прозрачный фон вместо белого */
  transparent?: boolean
  /** предохранитель: максимальная сторона результата */
  maxSide?: number
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Не удалось растеризовать SVG'))
    img.src = url
  })
}

export async function svgToPngBlob(svgString: string, opts: PngOptions = {}): Promise<Blob> {
  const scale = opts.scale ?? 2
  const maxSide = opts.maxSide ?? 4096

  const url = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = await loadImage(url)
    const naturalWidth = img.naturalWidth || img.width
    const naturalHeight = img.naturalHeight || img.height

    const limit = Math.min(1, maxSide / Math.max(naturalWidth * scale, naturalHeight * scale))
    const width = Math.max(1, Math.round(naturalWidth * scale * limit))
    const height = Math.max(1, Math.round(naturalHeight * scale * limit))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas недоступен')

    if (!opts.transparent) {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)
    }
    ctx.drawImage(img, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Не удалось получить PNG')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function svgToPngDataUrl(svgString: string, opts: PngOptions = {}): Promise<string> {
  const blob = await svgToPngBlob(svgString, opts)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Не удалось прочитать PNG'))
    reader.readAsDataURL(blob)
  })
}
