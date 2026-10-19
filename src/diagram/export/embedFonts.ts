/**
 * Встраивание шрифта в SVG.
 *
 * Зачем: когда SVG грузится в <img> для растеризации в PNG, он изолирован —
 * шрифты страницы ему не видны, и текст молча подменяется фолбэком (метрики «едут»).
 * Поэтому @font-face с base64 внутри самого SVG.
 */

import regularUrl from '../../theme/fonts/SBSansText-Regular.woff2?url'
import mediumUrl from '../../theme/fonts/SBSansText-Medium.woff2?url'
import semiboldUrl from '../../theme/fonts/SBSansText-Semibold.woff2?url'
import boldUrl from '../../theme/fonts/SBSansText-Bold.woff2?url'

/**
 * URL берём через `?url`, чтобы Vite подставил правильный base
 * (на GitHub Pages проект живёт в подпапке `/<repo>/`, и абсолютный `/fonts/...` там ломается).
 */
const FONT_FILES = [
  { weight: 400, url: regularUrl },
  { weight: 500, url: mediumUrl },
  { weight: 600, url: semiboldUrl },
  { weight: 700, url: boldUrl },
] as const

let cache: string | null = null

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** CSS с base64-шрифтами. Кэшируется: файлы не меняются в течение сессии. */
export async function getEmbeddedFontCss(): Promise<string> {
  if (cache) return cache

  const faces = await Promise.all(
    FONT_FILES.map(async ({ weight, url }) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`не удалось загрузить шрифт ${url}: ${res.status}`)
      const base64 = toBase64(await res.arrayBuffer())
      return `@font-face{font-family:'SB Sans Text';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${base64}) format('woff2');}`
    }),
  )

  cache = faces.join('\n')
  return cache
}
