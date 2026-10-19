import { IR_VERSION, type TimelineIR, type TimelineLane, type TimelinePoint } from '../ir'
import { parseLabel } from './label'

/**
 * Таймлайн: mermaid `timeline` -> TimelineIR.
 *
 * Особенности API mermaid 12.2.0 (проверено прогоном):
 *  - `db.getSections()` -> строки секций, скобки в `section [Имя]` НЕ срезаются;
 *  - `db.getTasks()` -> { section, task, events[] }, тексты с хвостовыми пробелами;
 *  - метода `getTitle()` нет — заголовок берём регуляркой из исходника;
 *  - если секции нет, временная метка лежит в `task`, а `section` пустой.
 */

interface RawTask {
  id?: number
  section?: string
  type?: string
  task?: string
  events?: string[]
}

/** Убирает обрамляющие квадратные скобки: `[Первый этап]` -> `Первый этап`. */
export function stripSectionBrackets(section: string): string {
  const trimmed = section.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return trimmed.slice(1, -1).trim()
  return trimmed
}

/** `title История бренда` -> «История бренда» (без метода в API, поэтому из текста). */
export function extractTimelineTitle(source: string): string | undefined {
  const match = /^\s*title\s+(.+)$/m.exec(source)
  return match ? match[1].trim() : undefined
}

/** Слаг для id дорожки — стабильный и читаемый в тестах. */
function laneIdFrom(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return slug || `lane-${index}`
}

function toArray<T>(maybeMap: unknown): T[] {
  if (maybeMap instanceof Map) return [...maybeMap.values()] as T[]
  if (maybeMap && typeof maybeMap === 'object') return Object.values(maybeMap) as T[]
  return []
}

export function normalizeTimeline(db: any, source: string): TimelineIR {
  const warnings: string[] = []
  const tasks = toArray<RawTask>(db.getTasks?.())
  const rawSections = toArray<string>(db.getSections?.())

  const points: TimelinePoint[] = []
  const lanes = new Map<string, TimelineLane>()

  tasks.forEach((task, index) => {
    const sectionName = stripSectionBrackets(String(task.section ?? ''))
    const taskText = String(task.task ?? '').trim()
    const events = (task.events ?? [])
      .map((event) => parseLabel(String(event).trim()))
      .filter((event) => event.lines.length > 0)

    // если секции нет — временная метка лежит в task
    const labelSource = sectionName || taskText
    if (!labelSource) return

    const label = parseLabel(labelSource)
    const title = sectionName && taskText ? parseLabel(taskText) : undefined

    let laneId: string | undefined
    if (sectionName) {
      laneId = laneIdFrom(sectionName, lanes.size)
      const lane = lanes.get(laneId)
      if (lane) {
        lane.pointIds.push(`p-${index}`)
      } else {
        lanes.set(laneId, { id: laneId, label: parseLabel(sectionName), pointIds: [`p-${index}`] })
      }
    }

    points.push({
      id: `p-${index}`,
      label,
      ...(title ? { title } : {}),
      events,
      ...(laneId ? { laneId } : {}),
    })
  })

  if (!points.length) {
    warnings.push('В таймлайне не нашлось ни одной точки: нужны строки вида «2024 : событие».')
  }

  if (points.length > 20) {
    warnings.push(`Точек ${points.length}: подписи могут слипаться, шаг увеличен.`)
  }

  // секции, объявленные в разметке, но не давшие точек
  const usedSections = new Set([...lanes.values()].map((l) => l.id))
  const unused = rawSections
    .map(stripSectionBrackets)
    .filter((section) => section && !usedSections.has(laneIdFrom(section, 0)))
  if (unused.length) {
    warnings.push(`Пустые секции проигнорированы: ${unused.join(', ')}`)
  }

  return {
    v: IR_VERSION,
    type: 'timeline',
    title: extractTimelineTitle(source),
    points,
    lanes: [...lanes.values()],
    warnings,
  }
}
