import type { InlineRun, TextBlock } from '../ir'

/**
 * Разбор подписи узла/ребра из того, что отдал mermaid.
 *
 * mermaid отдаёт label в двух режимах (проверено на 12.2.0):
 *  - labelType: 'text'   — простой текст, перенос строки приходит ЛИТЕРАЛЬНО как "\n"
 *  - labelType: 'string' — markdown/HTML-строка: **bold**, `code`, <br>, HTML-entity
 *
 * Мы приводим оба к одному виду: строки -> прогоны с начертанием.
 */

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

/** Разбивает одну строку на прогоны по **bold**, *italic*, `code`. */
function parseInline(line: string): InlineRun[] {
  const runs: InlineRun[] = []
  // порядок важен: сначала `code`, потом **bold**, потом *italic*
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(line)) !== null) {
    if (m.index > last) runs.push({ text: line.slice(last, m.index) })
    if (m[1] !== undefined) runs.push({ text: m[1], code: true })
    else if (m[2] !== undefined) runs.push({ text: m[2], bold: true })
    else if (m[3] !== undefined) runs.push({ text: m[3], bold: true })
    else if (m[4] !== undefined) runs.push({ text: m[4], italic: true })
    else if (m[5] !== undefined) runs.push({ text: m[5], italic: true })
    last = m.index + m[0].length
  }
  if (last < line.length) runs.push({ text: line.slice(last) })

  // схлопываем пустые прогоны
  return runs.filter((r) => r.text.length > 0)
}

/** Убирает HTML-теги, которые мы не поддерживаем (<b>, <i> переводим в начертание). */
function stripTags(line: string): string {
  return line
    .replace(/<\/?(b|strong)>/gi, '')
    .replace(/<\/?(i|em)>/gi, '')
    .replace(/<[^>]+>/g, '')
}

/**
 * @param raw текст из mermaid
 * @param labelType 'string' = markdown/html, 'text' = простой текст
 */
export function parseLabel(raw: string | undefined | null, labelType?: string): TextBlock {
  if (!raw) return { lines: [] }

  // в режиме 'text' перенос приходит как литеральные два символа: \ n
  let text = labelType === 'text' ? raw.replace(/\\n/g, '\n') : raw

  // <br>, <br/>, <br /> -> перенос строки
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = decodeEntities(text)
  text = stripTags(text)

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l, i, arr) => !(l === '' && (i === 0 || i === arr.length - 1)))

  return { lines: lines.map(parseInline) }
}

/** Текст подписи в виде одной строки — для aria-label, alt и подсказок. */
export function textBlockToString(block: TextBlock | undefined): string {
  if (!block) return ''
  return block.lines.map((line: InlineRun[]) => line.map((r: InlineRun) => r.text).join('')).join(' ')
}
