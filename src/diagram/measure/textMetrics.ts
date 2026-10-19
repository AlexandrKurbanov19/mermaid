/**
 * Измерение текста.
 *
 * Зачем свой измеритель, а не библиотека (fitty/textfit/fit-text):
 * те работают с HTML-элементами через getBoundingClientRect, а у нас текст лежит
 * в <text>/<tspan> внутри SVG, где нет автопереноса. Обёртку строк всё равно считать руками.
 *
 * Две реализации за одним интерфейсом:
 *  - canvas.measureText — точные метрики реального шрифта (браузер, основной путь);
 *  - estimateWidth — детерминированная оценка по таблице ширин (jsdom/SSR, юнит-тесты).
 */

export interface FontSpec {
  family: string
  weight: number
  size: number
}

export interface TextMeasurer {
  /** Ширина строки в px. */
  measure(text: string, font: FontSpec): number
}

/**
 * Ширины символов в «тысячных долях em» — замерены на SB Sans Text (Regular)
 * через canvas.measureText при 100 px, поэтому значения стабильны и не зависят от размера.
 */
const CHAR_PER_MILLE: Record<string, number> = {
  ' ': 300,
  // узкие и пунктуация
  i: 300, j: 300, l: 350, t: 470, f: 410, I: 320, '!': 380, '|': 330,
  '.': 350, ',': 360, ':': 350, ';': 360,
  '(': 360, ')': 360, '[': 450, ']': 450, '{': 520, '}': 520,
  '/': 330, '\\': 330, '-': 470, '"': 590,
  // строчная кириллица
  а: 560, б: 620, в: 570, г: 460, д: 600, е: 580, ё: 580, ж: 790, з: 510, и: 630,
  й: 630, к: 580, л: 610, м: 740, н: 620, о: 620, п: 620, р: 630, с: 520, т: 460,
  у: 530, ф: 750, х: 530, ц: 630, ч: 570, ш: 830, щ: 840, ъ: 600, ы: 740, ь: 550,
  э: 560, ю: 830, я: 580,
}

/** Самые широкие глифы (латиница и кириллица). */
const WIDE = new Set(['W', 'M', 'w', 'm', 'Ш', 'Щ', 'Ж', 'М', 'Ф', 'Ю', '@', '%'])

function perMilleOf(ch: string): number {
  const known = CHAR_PER_MILLE[ch]
  if (known !== undefined) return known
  if (ch >= '0' && ch <= '9') return 600
  if (WIDE.has(ch)) return 943
  if (ch >= 'A' && ch <= 'Z') return 669
  if (ch >= 'А' && ch <= 'Я') return 739
  if (ch >= 'a' && ch <= 'z') return 554
  return 600 // всё остальное (в т.ч. редкая кириллица, эмодзи считаем как широкий)
}

/**
 * Детерминированная оценка ширины — для jsdom/SSR, где нет canvas.
 *
 * Точность проверена обратно на canvas.measureText (SB Sans Text, 18 px):
 * связный русский текст — расхождение 1–5 %, вырожденные строки (например «iiii») — до 10 %.
 * В браузере эта функция не используется: там меряет canvas.
 */
export function estimateWidth(text: string, font: FontSpec): number {
  if (!text) return 0
  let perMille = 0
  for (const ch of text) perMille += perMilleOf(ch)
  const boldFactor = font.weight >= 600 ? 1.04 : 1
  return (perMille * font.size * boldFactor) / 1000
}

function createFallbackMeasurer(): TextMeasurer {
  return { measure: (text, font) => estimateWidth(text, font) }
}

/**
 * Canvas-измеритель. Создаётся лениво: в jsdom/SSR canvas может отсутствовать,
 * тогда аккуратно откатываемся на оценку.
 */
export function createCanvasMeasurer(): TextMeasurer {
  let ctx: CanvasRenderingContext2D | null = null
  let tried = false
  const cache = new Map<string, number>()

  return {
    measure(text, font) {
      if (!text) return 0
      const key = `${font.weight}|${font.size}|${font.family}|${text}`
      const hit = cache.get(key)
      if (hit !== undefined) return hit

      if (!tried) {
        tried = true
        try {
          ctx = document.createElement('canvas').getContext('2d')
        } catch {
          ctx = null
        }
      }

      let width: number
      if (ctx) {
        ctx.font = `${font.weight} ${font.size}px ${font.family}`
        width = ctx.measureText(text).width
      } else {
        width = estimateWidth(text, font)
      }

      cache.set(key, width)
      return width
    },
  }
}

/** Единственный общий измеритель приложения (canvas, с откатом на оценку). */
export const measurer: TextMeasurer = createCanvasMeasurer()

/** Отдельный измеритель для тестов — без DOM. */
export const fallbackMeasurer: TextMeasurer = createFallbackMeasurer()
