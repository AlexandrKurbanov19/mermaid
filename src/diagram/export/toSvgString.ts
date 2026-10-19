import { font } from '../theme'
import { getEmbeddedFontCss } from './embedFonts'

/**
 * SVG-строка для скачивания и для растеризации.
 *
 * Отличия от того, что в DOM:
 *  - добавлен xmlns (без него файл не откроется в редакторах);
 *  - явные width/height (некоторые просмотрщики игнорируют viewBox без размеров);
 *  - встроен шрифт (см. embedFonts);
 *  - убран React-мусор вроде aria-* и data-*.
 */
export interface SvgExportOptions {
  /** убрать белую подложку (для PNG с прозрачностью) */
  transparent?: boolean
}

export async function toSvgString(svg: SVGSVGElement, opts: SvgExportOptions = {}): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')

  if (opts.transparent) {
    clone.querySelector('#canvas-bg')?.remove()
  }

  const viewBox = clone.getAttribute('viewBox') ?? '0 0 100 100'
  const [, , vbWidth, vbHeight] = viewBox.split(/\s+/).map(Number)
  clone.setAttribute('width', String(vbWidth))
  clone.setAttribute('height', String(vbHeight))

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = `
${await getEmbeddedFontCss()}
text { font-family: ${font.family}; }
`.trim()
  clone.insertBefore(style, clone.firstChild)

  // убираем интерактивные/служебные атрибуты — в файле они не нужны
  for (const el of [clone, ...Array.from(clone.querySelectorAll('*'))]) {
    el.removeAttribute?.('aria-label')
    el.removeAttribute?.('role')
    for (const attr of Array.from(el.attributes ?? [])) {
      if (attr.name.startsWith('data-')) el.removeAttribute(attr.name)
    }
  }

  return new XMLSerializer().serializeToString(clone)
}

/** Скачивание файла через временную ссылку. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // отзываем URL чуть позже, чтобы браузер успел начать скачивание
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadSvg(svgString: string, filename = 'schema.svg'): void {
  downloadBlob(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }), filename)
}
