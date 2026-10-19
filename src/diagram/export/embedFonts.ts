/**
 * Встраивание шрифта в SVG.
 *
 * Зачем: когда SVG грузится в <img> для растеризации в PNG, он изолирован —
 * шрифты страницы ему не видны, и текст молча подменяется фолбэком (метрики «едут»).
 * Поэтому @font-face с base64 внутри самого SVG.
 */

const FONT_FILES = [
  { weight: 400, file: 'SBSansText-Regular.woff2' },
  { weight: 500, file: 'SBSansText-Medium.woff2' },
  { weight: 600, file: 'SBSansText-Semibold.woff2' },
  { weight: 700, file: 'SBSansText-Bold.woff2' },
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
    FONT_FILES.map(async ({ weight, file }) => {
      const res = await fetch(`/fonts/${file}`)
      if (!res.ok) throw new Error(`не удалось загрузить шрифт ${file}: ${res.status}`)
      const base64 = toBase64(await res.arrayBuffer())
      return `@font-face{font-family:'SB Sans Text';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${base64}) format('woff2');}`
    }),
  )

  cache = faces.join('\n')
  return cache
}
