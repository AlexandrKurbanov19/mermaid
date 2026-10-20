import { IR_VERSION, type JourneyIR, type JourneySection } from '../ir'

/**
 * mermaid `journey` -> JourneyIR.
 * db.getSections() -> ['Утро', ...]; db.getTasks() -> [{section, people[], task, score}].
 */

function toArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[]
  return []
}

export function normalizeJourney(db: any, source: string): JourneyIR {
  const sections = toArray<string>(db.getSections?.())
  const tasks = toArray<any>(db.getTasks?.())
  const title = db.getDiagramTitle?.() || db.getAccTitle?.()

  const sectionsArr: JourneySection[] = sections.map((name) => ({
    name: String(name),
    tasks: tasks
      .filter((t) => String(t.section) === String(name))
      .map((t) => ({ task: String(t.task ?? '').trim(), score: Number(t.score ?? 0), people: toArray<string>(t.people).map(String) })),
  }))

  return { v: IR_VERSION, type: 'journey', ...(title ? { title: String(title) } : {}), sections: sectionsArr, warnings: [] }
}
