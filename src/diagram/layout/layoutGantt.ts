import type { GanttIR } from '../ir'

/**
 * Gantt: шкала времени по горизонтали, секции/задачи по вертикали.
 */

export interface GanttRow {
  y: number
  kind: 'section' | 'task'
  name: string
  x?: number
  width?: number
  endLabel?: string
}

export interface GanttLayout {
  width: number
  height: number
  rows: GanttRow[]
  axis: { x1: number; x2: number; ticks: { x: number; label: string }[] }
  labelW: number
}

const LABEL_W = 150
const ROW_H = 34
const SECTION_H = 30
const PADDING = 24
const TL_W = 620

export function layoutGantt(ir: GanttIR): GanttLayout {
  const all = ir.sections.flatMap((s) => s.tasks)
  if (!all.length) {
    return { width: LABEL_W + TL_W + PADDING, height: PADDING * 2, rows: [], axis: { x1: LABEL_W, x2: LABEL_W + TL_W, ticks: [] }, labelW: LABEL_W }
  }
  const min = Math.min(...all.map((t) => t.start))
  const max = Math.max(...all.map((t) => t.end), min + 1)
  const range = max - min || 1

  const xOf = (t: number) => LABEL_W + ((t - min) / range) * TL_W

  const rows: GanttRow[] = []
  let y = PADDING + (ir.title ? 28 : 0)

  for (const section of ir.sections) {
    rows.push({ y, kind: 'section', name: section.name })
    y += SECTION_H
    for (const task of section.tasks) {
      rows.push({
        y,
        kind: 'task',
        name: task.name,
        x: xOf(task.start),
        width: Math.max(2, xOf(task.end) - xOf(task.start)),
        endLabel: new Date(task.end).toISOString().slice(0, 10),
      })
      y += ROW_H
    }
  }

  // тики по времени (~6 делений)
  const ticks = Array.from({ length: 6 }, (_, i) => {
    const frac = i / 5
    const t = min + frac * range
    return { x: xOf(t), label: new Date(t).toISOString().slice(0, 10) }
  })

  return {
    width: LABEL_W + TL_W + PADDING,
    height: y + PADDING,
    rows,
    axis: { x1: LABEL_W, x2: LABEL_W + TL_W, ticks },
    labelW: LABEL_W,
  }
}
