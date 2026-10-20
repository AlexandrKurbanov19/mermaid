import { IR_VERSION, type GanttIR, type GanttSection } from '../ir'

/**
 * mermaid `gantt` -> GanttIR.
 * db.getSections() — имена секций; db.getTasks() — [{section, task, id, startTime, endTime}].
 * Даты уже распарсены mermaid в ISO-строки.
 */

function toArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[]
  return []
}

function ts(v: any): number {
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d.getTime() : 0
}

export function normalizeGantt(db: any, source: string): GanttIR {
  const warnings: string[] = []
  const sections = toArray<string>(db.getSections?.())
  const tasks = toArray<any>(db.getTasks?.())
  const title = db.getDiagramTitle?.() || db.getAccTitle?.()

  const sectionsArr: GanttSection[] = sections.map((name) => ({
    name: String(name),
    tasks: tasks
      .filter((t) => String(t.section) === String(name))
      .map((t) => ({ id: String(t.id ?? ''), name: String(t.task ?? '').trim(), start: ts(t.startTime), end: ts(t.endTime || t.startTime) })),
  }))

  return { v: IR_VERSION, type: 'gantt', ...(title ? { title: String(title) } : {}), sections: sectionsArr, warnings }
}
