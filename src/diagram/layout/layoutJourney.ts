import type { JourneyIR } from '../ir'
import type { FontSpec, TextMeasurer } from '../measure/textMetrics'

/**
 * Journey — вертикальный список: секции-заголовки + строки задач.
 */

export interface JourneyRow {
  y: number
  kind: 'section' | 'task'
  name: string
  score?: number
  people?: string
}

export interface JourneyLayout {
  width: number
  height: number
  rows: JourneyRow[]
}

const ROW_H = 40
const SECTION_H = 34
const PADDING = 24

export function layoutJourney(ir: JourneyIR, measurer: TextMeasurer, font: FontSpec): JourneyLayout {
  const rows: JourneyRow[] = []
  let y = PADDING

  const maxTask = Math.max(
    60,
    ...ir.sections.flatMap((s) => s.tasks.map((t) => measurer.measure(t.task, font))),
  )

  for (const section of ir.sections) {
    rows.push({ y, kind: 'section', name: section.name })
    y += SECTION_H
    for (const task of section.tasks) {
      rows.push({ y, kind: 'task', name: task.task, score: task.score, people: task.people.join(', ') })
      y += ROW_H
    }
  }

  return {
    width: PADDING * 2 + Math.ceil(maxTask) + 220,
    height: y + PADDING,
    rows,
  }
}
