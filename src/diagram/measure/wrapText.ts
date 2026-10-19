import type { InlineRun, TextBlock } from '../ir'
import type { FontSpec, TextMeasurer } from './textMetrics'

/**
 * Перенос текста по словам с сохранением начертаний.
 *
 * Слово — не строка, а набор прогонов (слово может быть частично жирным).
 * Явные переносы из разметки (`<br>`, `\n`) уважаются: каждая исходная строка
 * переносится независимо.
 */

export interface StyledWord {
  runs: InlineRun[]
}

export interface FitLine {
  runs: InlineRun[]
  width: number
}

function fontForRun(base: FontSpec, run: InlineRun): FontSpec {
  // жирный измеряем жирным — иначе перенос «поедет» относительно реального рендера
  const weight = run.bold ? 600 : base.weight
  const family = run.code ? base.family : base.family
  return { ...base, weight, family }
}

export function measureWord(word: StyledWord, font: FontSpec, measurer: TextMeasurer): number {
  let width = 0
  for (const run of word.runs) width += measurer.measure(run.text, fontForRun(font, run))
  return width
}

function measureRuns(runs: InlineRun[], font: FontSpec, measurer: TextMeasurer): number {
  return measureWord({ runs }, font, measurer)
}

/** Разбивает строку прогонов на слова (пробелы — разделители, схлопываются). */
export function splitRunsIntoWords(runs: InlineRun[]): StyledWord[] {
  const words: StyledWord[] = []
  let current: InlineRun[] = []

  const flush = () => {
    if (current.length) {
      words.push({ runs: current })
      current = []
    }
  }

  for (const run of runs) {
    const parts = run.text.split(/(\s+)/)
    for (const part of parts) {
      if (!part) continue
      if (/^\s+$/.test(part)) {
        flush()
        continue
      }
      current.push({ ...run, text: part })
    }
  }
  flush()
  return words
}

/** Режет слишком длинное слово на куски, каждый из которых влезает в maxWidth. */
function breakWord(word: StyledWord, maxWidth: number, font: FontSpec, measurer: TextMeasurer): StyledWord[] {
  const chars: StyledWord[] = []
  for (const run of word.runs) {
    for (const ch of run.text) chars.push({ runs: [{ ...run, text: ch }] })
  }

  const atoms: StyledWord[] = []
  let current: InlineRun[] = []
  let width = 0

  for (const charWord of chars) {
    const chWidth = measureWord(charWord, font, measurer)
    if (current.length && width + chWidth > maxWidth) {
      atoms.push({ runs: current })
      current = []
      width = 0
    }
    current.push(...charWord.runs)
    width += chWidth
  }
  if (current.length) atoms.push({ runs: current })
  return atoms
}

/** Склеивает соседние прогоны с одинаковым начертанием (меньше элементов в SVG). */
export function mergeRuns(runs: InlineRun[]): InlineRun[] {
  const out: InlineRun[] = []
  for (const run of runs) {
    if (!run.text) continue
    const prev = out[out.length - 1]
    if (prev && !!prev.bold === !!run.bold && !!prev.italic === !!run.italic && !!prev.code === !!run.code) {
      prev.text += run.text
    } else {
      out.push({ ...run })
    }
  }
  return out
}

function buildLine(atoms: StyledWord[], spaceWidth: number, font: FontSpec, measurer: TextMeasurer): FitLine {
  const runs: InlineRun[] = []
  atoms.forEach((atom, i) => {
    if (i > 0) runs.push({ text: ' ' })
    runs.push(...atom.runs)
  })
  const merged = mergeRuns(runs)
  return { runs: merged, width: measureRuns(merged, font, measurer) }
}

/**
 * Переносит TextBlock в строки шириной не больше maxWidth.
 * Пустая строка в исходнике сохраняется как пустая строка результата.
 */
export function wrapBlock(block: TextBlock, maxWidth: number, font: FontSpec, measurer: TextMeasurer): FitLine[] {
  const spaceWidth = measurer.measure(' ', font)
  const lines: FitLine[] = []

  const sourceLines = block.lines.length ? block.lines : [[]]

  for (const sourceLine of sourceLines) {
    const words = splitRunsIntoWords(sourceLine)
    if (!words.length) {
      lines.push({ runs: [], width: 0 })
      continue
    }

    // слова, которые сами шире строки, режем на атомы
    const atoms = words.flatMap((word) =>
      measureWord(word, font, measurer) > maxWidth ? breakWord(word, maxWidth, font, measurer) : [word],
    )

    let current: StyledWord[] = []
    let width = 0

    for (const atom of atoms) {
      const atomWidth = measureWord(atom, font, measurer)
      const add = current.length ? spaceWidth + atomWidth : atomWidth
      if (current.length && width + add > maxWidth) {
        lines.push(buildLine(current, spaceWidth, font, measurer))
        current = [atom]
        width = atomWidth
      } else {
        current.push(atom)
        width += add
      }
    }
    if (current.length) lines.push(buildLine(current, spaceWidth, font, measurer))
  }

  return lines
}

/** Удобная обёртка для простого текста (подписи рёбер, заголовки групп). */
export function wrapText(text: string, maxWidth: number, font: FontSpec, measurer: TextMeasurer): FitLine[] {
  return wrapBlock({ lines: [[{ text }]] }, maxWidth, font, measurer)
}
