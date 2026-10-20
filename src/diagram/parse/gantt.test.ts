import { describe, expect, it } from 'vitest'
import mermaid from 'mermaid'
import { normalizeGantt } from './normalizeGantt'
import type { GanttIR } from '../ir'

async function g(source: string): Promise<GanttIR> {
  mermaid.initialize({ startOnLoad: false })
  const r = await mermaid.mermaidAPI.getDiagramFromText(source)
  return normalizeGantt(r.db, source)
}

describe('gantt: парсинг', () => {
  it('секции, задачи, даты', async () => {
    const ir = await g(`gantt
    title План
    section Этап 1
      Дизайн :a1, 2024-01-01, 5d`)
    expect(ir.title).toBe('План')
    expect(ir.sections[0].name).toBe('Этап 1')
    const task = ir.sections[0].tasks[0]
    expect(task.name).toBe('Дизайн')
    expect(task.end).toBeGreaterThan(task.start)
    expect(new Date(task.start).toISOString()).toBe('2024-01-01T00:00:00.000Z')
  })
})
