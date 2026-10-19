import type { InlineRun, TextBlock } from '../ir'
import type { FontSpec, TextMeasurer } from './textMetrics'
import { mergeRuns, wrapBlock, type FitLine } from './wrapText'

/**
 * Fit-text: главное требование заказчика — «если текста много, блок не растягивается,
 * а уменьшается шрифт».
 *
 * Порядок: пробуем базовый размер -> если не влезает, бинарный поиск размера
 * в [minFontSize, baseFontSize] -> если и минимум не влезает, режем строки и ставим «…».
 * Переполнение бокса запрещено при любом исходе.
 */

export interface FitOptions {
  /** доступная ширина текстовой области (уже без паддингов) */
  maxWidth: number
  /** доступная высота текстовой области */
  maxHeight: number
  baseFontSize: number
  minFontSize: number
  lineHeightRatio: number
}

export interface FitResult {
  fontSize: number
  lineHeight: number
  lines: FitLine[]
  /** ширина самой длинной строки */
  width: number
  /** высота всего текста */
  height: number
  truncated: boolean
}

const EPS = 0.01
const ELLIPSIS = '…'

function layout(block: TextBlock, fontSize: number, opts: FitOptions, font: FontSpec, measurer: TextMeasurer) {
  const spec: FontSpec = { ...font, size: fontSize }
  const lines = wrapBlock(block, opts.maxWidth, spec, measurer)
  const lineHeight = fontSize * opts.lineHeightRatio
  const width = lines.reduce((max, l) => Math.max(max, l.width), 0)
  const height = lines.length * lineHeight
  return { lines, lineHeight, width, height }
}

function fits(layoutResult: { width: number; height: number }, opts: FitOptions): boolean {
  return layoutResult.width <= opts.maxWidth + EPS && layoutResult.height <= opts.maxHeight + EPS
}

function hasText(block: TextBlock): boolean {
  return block.lines.some((line) => line.some((run) => run.text.trim().length > 0))
}

function runsToChars(runs: InlineRun[]): InlineRun[] {
  const chars: InlineRun[] = []
  for (const run of runs) for (const ch of run.text) chars.push({ ...run, text: ch })
  return chars
}

/** Обрезает строку так, чтобы вместе с «…» она влезла в maxWidth. */
function withEllipsis(line: FitLine, maxWidth: number, spec: FontSpec, measurer: TextMeasurer): FitLine {
  const ellipsisWidth = measurer.measure(ELLIPSIS, spec)
  let chars = runsToChars(line.runs)

  const widthOf = (c: InlineRun[]) =>
    mergeRuns(c).reduce((sum, run) => sum + measurer.measure(run.text, { ...spec, weight: run.bold ? 600 : spec.weight }), 0)

  while (chars.length && widthOf(chars) + ellipsisWidth > maxWidth) chars.pop()

  const runs = mergeRuns(chars)
  // убираем хвостовой пробел перед многоточием
  const last = runs[runs.length - 1]
  if (last) last.text = last.text.replace(/\s+$/, '')
  const cleaned = runs.filter((r) => r.text.length > 0)
  cleaned.push({ text: ELLIPSIS })

  const width = cleaned.reduce(
    (sum, run) => sum + measurer.measure(run.text, { ...spec, weight: run.bold ? 600 : spec.weight }),
    0,
  )
  return { runs: cleaned, width }
}

export function fitText(
  block: TextBlock,
  opts: FitOptions,
  font: FontSpec,
  measurer: TextMeasurer,
): FitResult {
  const baseSpec: FontSpec = { ...font, size: opts.baseFontSize }
  const empty: FitResult = {
    fontSize: opts.baseFontSize,
    lineHeight: opts.baseFontSize * opts.lineHeightRatio,
    lines: [],
    width: 0,
    height: 0,
    truncated: false,
  }
  if (!hasText(block)) return empty

  // 1. базовый размер
  const base = layout(block, opts.baseFontSize, opts, font, measurer)
  if (fits(base, opts)) {
    return { fontSize: opts.baseFontSize, lineHeight: base.lineHeight, lines: base.lines, width: base.width, height: base.height, truncated: false }
  }

  // 2. бинарный поиск размера
  let lo = opts.minFontSize
  let hi = opts.baseFontSize
  let best: { fontSize: number; result: ReturnType<typeof layout> } | null = null

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const candidate = layout(block, mid, opts, font, measurer)
    if (fits(candidate, opts)) {
      best = { fontSize: mid, result: candidate }
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  if (best) {
    return {
      fontSize: best.fontSize,
      lineHeight: best.result.lineHeight,
      lines: best.result.lines,
      width: best.result.width,
      height: best.result.height,
      truncated: false,
    }
  }

  // 3. даже минимум не влезает — режем и ставим «…»
  const smallSpec: FontSpec = { ...font, size: opts.minFontSize }
  const smallest = layout(block, opts.minFontSize, opts, font, measurer)
  const lineHeight = smallest.lineHeight
  const allowedLines = Math.max(1, Math.floor(opts.maxHeight / lineHeight + EPS))
  const kept = smallest.lines.slice(0, allowedLines)

  if (kept.length) {
    kept[kept.length - 1] = withEllipsis(kept[kept.length - 1], opts.maxWidth, smallSpec, measurer)
  }

  const width = kept.reduce((max, l) => Math.max(max, l.width), 0)
  return {
    fontSize: opts.minFontSize,
    lineHeight,
    lines: kept,
    width,
    height: kept.length * lineHeight,
    truncated: true,
  }
}
